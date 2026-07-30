## Ziel
Der Ablauf wird verbindlich auf **Bewerbung → Terminwahl → Bestätigungsmail → späteres Interview** gestellt. Gleichzeitig werden kaputte CTA-Platzhalter und paralleler Doppelversand technisch blockiert.

## Bestätigte Ursachen
- Die öffentliche Bewerbungsroute fällt derzeit auf den direkten `/interview/...`-Link zurück, wenn sie keinen aktiven internen Kalender für die aufgelöste Landing findet. Der interne Modus verhindert diesen Fallback noch nicht ausdrücklich.
- Der Landing-Code kann die Terminwahl bereits direkt unter dem Formular anzeigen, sobald die API eine `/termin/buchen/<token>`-URL zurückgibt.
- Die Reminder-Renderer erkennen CTA-Blöcke nur, wenn die URL mindestens ein Zeichen enthält. Bei leerem Link bleibt deshalb `{{cta:Jetzt Termin buchen|}}` sichtbar.
- Der neue Doppelversand-Index ist in dieser geprüften Backend-Instanz nicht vorhanden. Damit ist der Datenbank-Schutz hier noch nicht ausgerollt. Der bestehende Deploy-Prozess kann zudem eine neue Migration beim ersten Bootstrap nur als „bereits angewendet“ markieren.

## Umsetzung
1. **Buchungsablauf erzwingen**
   - Bei `booking_mode = internal` niemals direkt zum Interview weiterleiten.
   - Einen vorhandenen aktiven Source-/Fast-Track-Kalender auflösen und eine stabile Buchungs-URL mit Magic Token zurückgeben.
   - Fehlt trotz internem Modus ein Kalender, einen klaren konfigurationsbezogenen Fehler liefern statt den falschen Interview-Schritt zu öffnen.
   - Die vorhandene Inline-Terminwahl des Landing-Formulars weiterverwenden, damit die Bestätigung wie beim AZB-Theme wirkt und direkt die Terminwahl anschließt.

2. **E-Mail-CTA robust rendern**
   - CTA-Syntax mit leerem Link in Bewerbungs-, Bewerbungs-Reminder- und Termin-Reminder-Mails vollständig konsumieren.
   - Ist ein gültiger Ersatzlink vorhanden, einen echten Button rendern; andernfalls den CTA-Block entfernen, niemals Rohsyntax anzeigen.
   - Im Einladungspfad den Fallback-Button direkt als HTML erzeugen, statt nochmals unverarbeitete Template-Syntax an den Wrapper zu geben.

3. **Doppelversand endgültig blockieren**
   - Eine neue idempotente Reparaturmigration hinzufügen, damit auch Installationen mit vorpopulierter Migrationshistorie den Unique-Index sicher erhalten.
   - Alte Mehrfachprotokolle auf `superseded` setzen und anschließend genau eine automatische Mail pro Vorlage, Empfänger, Bewerbung und Tag zulassen.
   - Den bereits ergänzten „Claim vor SMTP-Versand“ beibehalten; parallele Cron-Läufe verlieren dann vor dem tatsächlichen Versand.
   - Manuelle „Erneut senden“-Aktionen bleiben über ihre eigene Nonce erlaubt.

4. **Deployment und Prüfung**
   - Portal/Frontend inklusive Landing-Assets deployen und die betroffenen Landing Pages neu veröffentlichen.
   - Backend-Funktionen und neue Migration mit dem Backend-Deploy ausrollen.
   - Danach prüfen: Formular zeigt Terminwahl statt Interview, Bestätigungs- und Reminder-Mail enthalten einen echten Button, DB-Indizes existieren, parallele Testläufe erzeugen nur einen Versand.

## Noch wichtig
Die aktuelle Cloud-Testdatenbank enthält keinen Datensatz für `gtm-strategies.de`; die produktive Konfiguration liegt damit offenbar im self-hosted Backend. Die konkrete Domain-/Schedule-Zuordnung wird deshalb nach dem Selfhosting-Deploy dort verifiziert.