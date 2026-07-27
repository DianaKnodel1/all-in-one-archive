## Ziel

Im Chat-Kopf und in der Begrüßung sollen der echte Recruiter-Name (z. B. Merlin Schneider), sein Profilbild und der richtige Firmenname erscheinen — nicht „Sabine Schneider" und nicht der Domain-Slug „personalservice-gmbh.de".

## Was ich im Code sehe

Es gibt zwei Stellen, die die Anzeige bestimmen, und beide können das Falsche liefern:

1. **Server (Begrüßungstext der KI):** Bei einer Vermittlungs-/Broker-Bewerbung hat aktuell die **Quell-Landing Vorrang** vor der verknüpften Fast-Track-Landing. Firmenname und Recruiter:in werden also von der Vermittlungsseite genommen, obwohl das Gespräch die Fast-Track-Firma führt. Fehlt dort ein Recruiter-Name, greift der fest verdrahtete Fallback „Sabine Schneider".
2. **Chat-Kopfzeile (Browser):** Die Seite liest die Landing-Daten direkt aus der Datenbank. Öffentlich lesbar sind aber nur **veröffentlichte** Landing-Pages. Ist die verknüpfte Fast-Track-Seite nicht veröffentlicht, kommt nichts zurück und die Seite fällt auf die Vermittlungsseite bzw. auf „Sabine Schneider" ohne Bild zurück.

Ob bei dir zusätzlich einfach kein Recruiter-Name/Bild gepflegt ist, muss vor dem Fix einmal geprüft werden — das ist Schritt 1.

## Schritt 1 — Datenlage prüfen (Backend-Server)

Ein Prüfbefehl, der Quell- und Fast-Track-Seite nebeneinander zeigt (Name, Bild, Firmenname, Veröffentlichungsstatus, Verknüpfung). Ergebnis entscheidet, ob es nur ein Pflege-Thema ist oder wirklich die Auflösungslogik.

## Schritt 2 — Serverseitige Auflösung korrigieren

- Bei Bewerbungen aus einer Vermittlungs-/Broker-Landing bekommt die **verknüpfte Fast-Track-Landing Vorrang** für Firmenname, Recruiter-Name, Profilbild und Interview-Prompt; die Quell-Landing dient nur noch als Ersatz für fehlende Felder.
- Betrifft die gemeinsame Interview-Logik sowie den Chat- und den Voice-Einstieg, damit alle Wege dasselbe Ergebnis liefern.
- Der harte Fallback „Sabine Schneider" wird durch eine neutrale Formulierung („Ihr HR-Team" bzw. der gepflegte Firmenname) ersetzt, damit nie wieder ein erfundener Name erscheint.
- Sieht der Firmenname wie eine Domain aus (z. B. `personalservice-gmbh.de`), wird er für die Anzeige lesbar aufbereitet, statt die Domain vorzulesen.

## Schritt 3 — Kopfzeile aus derselben Quelle speisen

- Die Interview-Seite erhält Recruiter-Name, Profilbild und Firmenname künftig **mit der Server-Antwort** beim Start des Gesprächs, statt selbst in der Datenbank zu suchen. Damit stimmen Kopfzeile und Begrüßungstext immer überein und unveröffentlichte Fast-Track-Seiten sind kein Problem mehr.
- Die bisherige Direktabfrage bleibt nur als Notfall-Ersatz erhalten.
- Gleiches für die Voice-Variante des Gesprächs.

## Schritt 4 — Kleines Prüfskript

Ein Skript, das für eine Landing-Page anzeigt, welcher Recruiter, welches Bild und welcher Firmenname im Gespräch tatsächlich verwendet würden — damit sich so ein Fall künftig in einer Minute klären lässt.

## Schritt 5 — Deploy

Portal (`git pull && bash scripts/deploy.sh`) und Backend-Server; danach ein Testgespräch über die BV-Agentur-Fast-Track-Seite.

## Technische Details

- `src/lib/interview-engine.server.ts`: Priorität in `loadInterviewContext` umdrehen (fasttrack vor landing), `recruiterAvatarUrl` mit ausgeben, Fallback-Name neutralisieren.
- `src/routes/api/public/interview-chat.ts`: identische Priorität im Inline-Zweig; `init`-Antwort um `recruiter_name`, `recruiter_avatar_url`, `company_name` erweitern.
- `src/routes/interview.$appId.tsx` und `src/routes/interview.voice.$appId.tsx`: Branding aus der Init-Antwort übernehmen, DB-Abfrage nur als Fallback, `"Sabine Schneider"`-Literale entfernen.
- Neues Skript `scripts/check-interview-branding.sh`.
