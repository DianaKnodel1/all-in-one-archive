# Sporadische „Keine Landing für … konfiguriert.“

## Was ich geprüft habe

Die Meldung kommt aus dem Landing-Renderer auf Server 1 (`landing-server/server.js`, Zeile 402). Sie wird ausgegeben, sobald die Domain-Abfrage keine Zeile liefert — und zwar **auch dann, wenn die Abfrage gar nicht beantwortet wurde**.

In `loadLanding(domain)` passiert aktuell Folgendes:

```text
Datenbank-Abfrage
   ├── Antwort ok        → Zeile merken (60 s)
   ├── HTTP-Fehler       → Fehler loggen, row = null  ──┐
   └── Timeout / Netz    → Fehler loggen, row = null  ──┤
                                                        ▼
                              null wird 60 s lang gecacht → jede Anfrage
                              in dieser Minute bekommt 404 „Keine Landing …"
```

Das erklärt genau das beobachtete Verhalten: es trifft **eine** Domain, **nur manchmal**, für **kurze Zeit**, während andere Landings normal laufen — weil deren Zeile noch im Cache liegt. Ein einzelner Aussetzer der Backend-Verbindung (Timeout, kurzer 5xx, Ratelimit) reicht, um eine Landing eine Minute lang offline zu nehmen. Bewerber sehen in dieser Zeit nur den Fehlertext.

Zusätzlich: dieselbe Funktion beantwortet Caddys `on_demand_tls`-Nachfrage (`/_internal/ask`). Fällt sie in ein solches Fehlerfenster, kann auch die Zertifikatsausstellung für eine neue Domain scheitern.

Die Ursache ist damit hinreichend eingegrenzt, ohne dass sie „Landing fehlt in der Datenbank" wäre — eine dauerhaft fehlende Zeile würde permanent 404 liefern, nicht sporadisch.

## Was geändert wird

Alles in `landing-server/server.js` (plus dieselbe Logik in `landing-server/server.ts`, damit beide Varianten gleich bleiben):

1. **Fehler nie als „nicht vorhanden" cachen.** Nur ein erfolgreicher Abruf schreibt in den Cache. Fehlerfälle werden klar von „Domain existiert wirklich nicht" getrennt.
2. **Letzten bekannten Stand weiterliefern (stale-while-error).** Eine einmal erfolgreich geladene Landing wird im Speicher behalten und bei Backend-Störung weiter ausgeliefert, statt einen 404 zu zeigen. Erst wenn nie eine Zeile geladen wurde, gibt es eine Fehlerseite.
3. **Kurzer Retry.** Fehlgeschlagene Abfragen werden einmal nach ~300 ms wiederholt, Timeout von 10 s auf 6 s gesenkt, damit ein Retry innerhalb einer normalen Ladezeit passt.
4. **Negativ-Cache getrennt und kurz.** Ein echtes „Domain nicht in der Tabelle" wird nur ~15 s gemerkt (statt 60 s), damit eine frisch angelegte Landing schneller live geht.
5. **Hintergrund-Refresh.** Abgelaufene Einträge werden asynchron erneuert; die Anfrage wird sofort mit dem vorhandenen Stand beantwortet, statt auf die Datenbank zu warten.
6. **Bessere Fehlerseite statt Rohtext.** Wenn wirklich keine Landing existiert: eine schlichte, freundliche Seite mit Hinweis („Diese Seite ist gerade nicht verfügbar") statt der technischen Meldung. Bei Backend-Störung ohne bekannten Stand: HTTP 503 mit `Retry-After`, damit Suchmaschinen die Seite nicht als dauerhaft weg werten.
7. **`/_internal/ask` unverändert streng**, aber ebenfalls ohne Fehler-Caching, damit Zertifikate nicht an einem Aussetzer scheitern.
8. **Diagnose:** Zähler für Fehlversuche pro Domain im vorhandenen `/_internal`-Bereich abrufbar, damit sich künftig belegen lässt, ob es wieder auftritt.

## Danach

Deploy auf Server 1 (Renderer neu starten), dann `personalservice-gmbh.de` und zwei weitere Landings prüfen. Falls die Fehler weiter auftauchen, zeigen die neuen Log-Zeilen dann direkt, ob es Timeouts, HTTP-Fehler oder tatsächlich fehlende Datensätze sind.

## Offene Frage (kann parallel laufen)

Falls du im Journal von Server 1 nachsehen kannst: `journalctl -u landing-server --since "2 days ago" | grep "DB-Error"` — die Zeilen dort bestätigen, welcher Fehlertyp es ist. Für die Umsetzung ist das nicht nötig, es macht die Bestätigung nur schneller.
