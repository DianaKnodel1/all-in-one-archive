## Ziel

1. Die Vertrags-Templates-Seite wird nach Unternehmen gruppiert, damit sie auch bei 10–15 Firmen (30–45 Verträgen) übersichtlich bleibt.
2. Der neue efficacitas-Arbeitsvertrag wird als fertige Vorlage mit Platzhaltern eingebaut, sodass du ihn mit einem Klick übernehmen kannst.

## Teil 1 – Gruppierung nach Unternehmen

Wichtig vorab: Es braucht **keine neue Datenbanktabelle und keine echte "Gruppe"**. Jedes Template hat bereits eine Firmenzuordnung (`tenant_id`). Die Gruppe wird also rein in der Darstellung gebildet – automatisch, ohne Pflegeaufwand, ohne Migrationsrisiko. Neue Firmen erscheinen sofort als eigener Block.

Umbau der Seite „Vertrags-Templates":

```text
▾ UWK Consulting GmbH                       3 Vorlagen · 3 aktiv
    Minijob    · Minijob Vertrag      v1   [an] ✎ ⧉ 🗑
    Teilzeit   · Teilzeit Vertrag     v1   [an] ✎ ⧉ 🗑
    Vollzeit   · Vollzeit Vertrag     v1   [an] ✎ ⧉ 🗑
▸ BV Agentur                                3 Vorlagen · 3 aktiv
▸ Kadermarketing Agentur                    3 Vorlagen · 2 aktiv
▸ Digital DGI GmbH                          3 Vorlagen · 3 aktiv
```

- Jede Firma wird ein aufklappbarer Block (Accordion) mit Firmenname, Anzahl Vorlagen und Anzahl aktiver Vorlagen.
- Standard: alle Blöcke zugeklappt, außer es ist nur eine Firma vorhanden oder ein Firmenfilter ist gesetzt.
- Innerhalb einer Firma werden die Vorlagen fest nach Minijob → Teilzeit → Vollzeit sortiert, nicht nach Erstellungsdatum.
- Warnhinweis pro Firma, wenn eine Beschäftigungsart ohne aktive Vorlage ist (z. B. „Teilzeit: keine aktive Vorlage") – das ist heute die häufigste stille Fehlerquelle bei der Vertragsgenerierung.
- Zusätzlich ein Suchfeld über Titel/Firma; die bestehenden Filter (Firma, Typ) bleiben.
- Die Seitennummerierung entfällt zugunsten der Gruppierung (aufgeklappt wird immer nur eine Firma).
- Die große Platzhalter-Box wird zu einem einklappbaren Hinweis („Verfügbare Platzhalter anzeigen"), damit die Liste sofort sichtbar ist.

Alle Aktionen (aktiv schalten, bearbeiten, duplizieren, löschen) bleiben unverändert – nur Darstellung.

## Teil 2 – Neuer Arbeitsvertrag als Vorlage

Der von dir geschickte efficacitas-Vertrag wird 1:1 als Vorlagentext hinterlegt, mit Platzhaltern statt fester Daten. Im Dialog „Neues Template" kommt oben eine Auswahl „Vorlage als Startpunkt": *Standardvertrag* oder *Home-Office / auftragsbezogen (efficacitas-Form)*. Auswahl füllt das Textfeld, danach frei editierbar.

Ersetzt werden:

| Im Originaltext | Platzhalter |
|---|---|
| efficacitas GmbH | `{{company_name}}` |
| Korbacher Str. 20 / 34508 Willingen | `{{company_address}}` |
| Vertreten durch Silvia Köster | `{{company_ceo_name}}` |
| Hassan Abdelkader | `{{first_name}} {{last_name}}` |
| Münchener Str. 57, 85051 Ingolstadt | `{{address}}` |
| beginnt am 16.06.2026 | `{{start_date}}` |
| bis zu € 603,- netto | `{{monthly_salary}}` |
| bis zu 6 Wochenstunden | `{{weekly_hours}}` |
| Willingen, den 16.06.2026 | `{{company_city}}, den {{date}}` |
| Ingolstadt, Hassan Abdelkader | `{{city}}, {{first_name}} {{last_name}}` |

Der versehentlich mitkopierte Chat-Zeitstempel („[16.06.2026 16:16] Geld NochMehrGeld:") vor § 7 wird entfernt.

Zwei Werte gibt es heute noch nicht als Platzhalter:

- **Stellenbezeichnung** („Mobile-App-Prüfer/in via Home-Office (m/w/d)") – bleibt als fester Text in der Vorlage und ist pro Firma im Editor anpassbar. Ein eigener Platzhalter wäre nur sinnvoll, wenn die Bezeichnung pro Mitarbeiter variiert; sag Bescheid, dann ergänze ich `{{job_title}}` inkl. Feld in der Mandantenverwaltung.
- **Probezeitdauer (3 Monate)** – bleibt fester Text.

Da die Vergütung hier auftragsbezogen ist („bis zu … netto"), passen die vorhandenen Standardwerte pro Beschäftigungsart (Minijob 556 €, Teilzeit 1.200 €, Vollzeit 2.400 €). Für die 603 € kannst du entweder beim Mitarbeiter ein individuelles Gehalt hinterlegen (gibt es bereits) oder ich setze den Betrag fest in die Vorlage – sag mir, was dir lieber ist; Standard meiner Umsetzung: Platzhalter `{{monthly_salary}}`, damit es pro Mitarbeiter steuerbar bleibt.

## Technische Details

- Betroffene Datei: `src/routes/admin.contracts.tsx` (Gruppierung, Suchfeld, Vorlagenauswahl, zweiter Vorlagentext als Konstante).
- Keine Datenbankänderung, keine Migration, keine Änderung an der Vertragserzeugung (`src/lib/contract-utils.ts`) – bestehende Verträge und Signaturen bleiben unangetastet.
- `usePagination` entfällt auf dieser Seite; `PaginationBar` bleibt für andere Seiten erhalten.
