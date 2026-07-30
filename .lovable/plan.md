## 1. SMTP-Warnung aufs Dashboard verlegen

Aktuell steht das rote Panel „X Domain(s) können aktuell keine Mails versenden“ mitten im E-Mail-Center (`admin.email-center.tsx`).

- Logik in eine eigene Komponente `SmtpTroubleNotice` auslösen (Tenants mit Pause / SMTP-Fehler / fehlenden Zugangsdaten).
- Auf dem Dashboard (`/admin`) als kompakte Meldung anzeigen: eine Zeile „2 Domains können keine Mails versenden“ + aufklappbare Details + Button „Zu Domains“.
- Im E-Mail-Center nur noch ein schmaler einzeiliger Hinweis statt des großen roten Blocks.

## 2. Fehler „task_assignments.webid_client_name“ beim Mitarbeiter

Ursache (verifiziert): Die Spalten `webid_client_name`, `webid_status`, `webid_start_url` existieren nur in den manuellen Migrationen `20260805000000_webid_assignment.sql` und `20260806000000_webid_start_url.sql`. Auf dem selbst gehosteten Backend sind diese offenbar nicht angewendet — die Auftragsseite fragt sie aber fest ab, daher bricht das Laden komplett ab.

Zwei Maßnahmen:
- **Robust machen:** WebID-Spalten in `_employee/tasks.$assignmentId.tsx` (und Admin-Detailseite) nicht mehr fest abfragen. Da WebID ohnehin deaktiviert ist, wird die Abfrage ohne diese Felder ausgeführt bzw. bei Fehler auf eine Variante ohne WebID-Felder zurückgefallen. Damit funktioniert die Seite unabhängig vom Datenbankstand.
- **Nachziehen:** Die beiden WebID-Migrationen zusätzlich in die Auto-Apply-Liste des Deploy-Skripts aufnehmen, damit das Backend beim nächsten Deploy denselben Stand hat.

## 3. „Post“ ausblenden

Eintrag „Post“ aus der Sidebar-Gruppe *Kommunikation* (`AdminLayout.tsx`) und aus der Befehlspalette entfernen. Route und Code bleiben bestehen, nur nicht mehr verlinkt.

## 4. Einstellungen übersichtlicher

`/admin/settings` ist aktuell eine lange Kachel-Liste ohne Ordnung. Neu:

```text
Einstellungen
├─ Tabs / Abschnitte
│   ├─ Marke & Domains   → Domains/Tenants, Landing-Generator, Infrastruktur
│   ├─ Bewerbung         → Verfügbarkeit, Buchungslimits, KI-Assistent
│   ├─ Kommunikation     → E-Mail-Vorlagen, Erinnerungen, SMS
│   ├─ Aufträge          → Standard-Aufträge, Verträge
│   └─ Konto & Team      → Teamleiter, Passwort, Design/Theme
```

- Klare Überschriften pro Abschnitt, gleiche Kachelgröße, kurze Beschreibungen.
- Breitere Seite (aktuell auf schmale Spalte begrenzt), damit die Kacheln nicht untereinander kleben.

## 5. E-Mail-System – vollständiger Nachweis

Prüfbericht statt Bauchgefühl. Ich prüfe und dokumentiere pro Mail-Typ:

- Auslöser, Zeitpunkt, maximale Anzahl, Sperr-Schlüssel (Claim), Cron-Intervall.
- Ob die Duplikat-Sperren (eindeutiger Index + Vorab-Reservierung) im Repo **und** auf dem Backend aktiv sind (Migrationen `20260807…`, `20260808000000_email_event_claims.sql`).
- Ob alle Cron-Jobs registriert sind und ohne Platzhalter laufen.
- Ergebnis als Tabelle im Chat plus Skript `scripts/mail-final-audit.sh`, das den Status jederzeit gegen das Live-Backend prüft.

Gefundene Lücken werden im selben Zug behoben.

## Technische Hinweise

- Betroffene Dateien: `src/routes/admin.index.tsx`, `src/routes/admin.email-center.tsx`, neue `src/components/admin/SmtpTroubleNotice.tsx`, `src/components/AdminLayout.tsx`, `src/components/AdminCommandPalette.tsx`, `src/routes/admin.settings.tsx`, `src/routes/_employee/tasks.$assignmentId.tsx`, `src/routes/admin.assignments.$assignmentId.tsx`, `scripts/deploy.sh`.
- Keine Änderung an der Mail-Logik selbst, außer es zeigt eine Lücke im Audit.
