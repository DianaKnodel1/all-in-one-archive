## Ziel

Der von dir geschickte Vertrag wird zur **Standardvorlage** – in identischer Schreibweise für Minijob, Teilzeit und Vollzeit. Firmendaten und Bewerber-/Mitarbeiterdaten kommen automatisch aus dem jeweiligen Mandanten bzw. der Person.

## 1. Der Vertragstext als kanonische Vorlage

Der Text liegt bereits fast fertig als Vorlage „Home-Office / auftragsbezogen" in der Vertrags-Templates-Seite. Er wird zur **Standardvorlage** hochgestuft (die alte, kürzere „Standardvertrag"-Variante wandert nach hinten bzw. entfällt als Vorauswahl).

Automatisch ersetzt werden:

| Im Vertrag | Quelle |
|---|---|
| efficacitas GmbH | Firmenname des Mandanten |
| Korbacher Str. 20, 34508 Willingen | Firmenadresse des Mandanten |
| Silvia Köster | Geschäftsführer/in des Mandanten |
| Hassan Abdelkader | Vor-/Nachname der Person |
| Münchener Str. 57, 85051 Ingolstadt | Adresse der Person |
| 16.06.2026 (Beginn) | Startdatum des Arbeitsverhältnisses |
| € 603,- netto | Gehalt (individuell → Mandant → Standard je Art) |
| bis zu 6 Wochenstunden | Wochenstunden (individuell → Standard je Art) |
| Willingen, den … / Ingolstadt, … | Firmenstadt + Datum / Wohnort + Name |

Der Chat-Zeitstempel („[16.06.2026 16:16] Geld NochMehrGeld:") kommt nicht in die Vorlage.

## 2. Die drei Beschäftigungsarten

Gleicher Wortlaut, nur diese Stellen unterscheiden sich (sonst wäre der Text juristisch unsauber):

- **§ 4 Arbeitszeit**: Minijob „bis zu {{weekly_hours}} Wochenstunden auf Nebenjobbasis", Teilzeit „bis zu {{weekly_hours}} Wochenstunden in Teilzeit", Vollzeit „{{weekly_hours}} Wochenstunden in Vollzeit".
- **§ 3 Vergütung**: der Satz zur Minijob-Grenze („Sollte das Guthaben … Minijob-Grenze überschreiten") bleibt nur beim Minijob; bei Teilzeit/Vollzeit entfällt er.
- Standardwerte, wenn nichts hinterlegt ist: Minijob 556 € / 10 Std., Teilzeit 1.200 € / 20 Std., Vollzeit 2.400 € / 40 Std. Individuelle Werte pro Person (Admin → Personen → Individueller Arbeitsvertrag) haben immer Vorrang.

Alles andere (§ 1, 2, 5–11, Stellenbezeichnung „Mobile-App-Prüfer/in via Home-Office (m/w/d)", Probezeit 3 Monate) bleibt in allen drei Varianten wortgleich.

## 3. Ausrollen auf alle Firmen

Auf der Seite „Vertrags-Templates" kommt ein Button **„Standardvorlage für alle Firmen anlegen"**:

- legt je Mandant die fehlenden Vorlagen für Minijob/Teilzeit/Vollzeit an und setzt sie aktiv;
- **überschreibt nichts** ohne Rückfrage: existiert für eine Firma+Art bereits eine Vorlage, wird sie in der Vorschau als „vorhanden – wird übersprungen" gelistet, mit optionalem Häkchen „bestehende Vorlagen durch neue Version ersetzen" (dann als neue Version, alte bleibt im Verlauf).
- Vorher-Dialog zeigt genau, was angelegt/ersetzt wird.

Zusätzlich pro Firmenblock ein kleiner Button „fehlende Arten ergänzen".

## 4. Fallback, wenn eine Firma keine Vorlage hat

Der eingebaute Notfall-Vertrag (heute ein anderer, längerer Text mit festen 603 € und Minijob-Bezug) wird durch denselben Standardtext ersetzt, damit ein Mitarbeiter nie einen abweichenden Vertrag sieht.

## Technische Details

- `src/lib/contract-templates.ts` (neu): kanonischer Vorlagentext + Variantenlogik je Beschäftigungsart, als einzige Quelle.
- `src/routes/admin.contracts.tsx`: Vorlagenauswahl auf Standard umstellen, Bulk-Rollout-Dialog, „fehlende Arten ergänzen".
- `src/lib/contract-utils.ts`: `generateFallbackContract` nutzt die neue Quelle; Platzhalter-Auflösung bleibt unverändert.
- Keine Datenbank-Migration nötig – es werden nur Zeilen in `contract_templates` angelegt. Bereits unterschriebene Verträge bleiben unberührt (die sind als Text gespeichert).
