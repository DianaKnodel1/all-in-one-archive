## Plan

1. **Probe-Skript reparieren**
   - Das aktuelle Skript findet im Edge-Container zwar `edge-runtime`, führt den Deno/Nodemailer-Test aber nicht wirklich aus.
   - Ich passe es so an, dass es den vorhandenen Deno-Pfad aus `edge-runtime` korrekt nutzt oder alternativ klar meldet, wenn der Test im Container nicht möglich ist.

2. **Diagnose-Ausgabe eindeutig machen**
   - Ausgabe soll getrennt zeigen:
     - Verbindung möglich oder Timeout
     - Login erfolgreich oder `535 authentication failed`
     - Port 587 STARTTLS vs. 465 SSL
     - ob Benutzername/Absender voneinander abweichen
   - Keine Passwörter oder Secret-Werte werden ausgegeben.

3. **Nächsten Backend-Befehl liefern**
   - Danach bekommst du wieder einen kurzen Copy/Paste-Block für den Backend-Server.
   - Wenn dann weiterhin `535` kommt, ist es sicher Provider/Postfach/Freigabe/App-Passwort und nicht Portal-Code, Netzwerk oder Cron.

4. **Optionaler Folgecheck**
   - Falls der Login klappt, prüfen wir danach den tatsächlichen Test-Mail-Versand im Portal und ob der Tenant automatisch entpausiert wird.