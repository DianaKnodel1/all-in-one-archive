## Ziel

Der Portal-Server (Server 2, `/opt/apps/portal`) zeigt noch auf das alte Repo. Er soll auf `https://github.com/DianaKnodel1/all-in-one-archive.git` umgestellt und neu deployed werden.

## Befehle (auf Server 2 als root)

```bash
cd /opt/apps/portal

# 1) Aktuelles Remote anzeigen (Kontrolle)
git remote -v

# 2) Auf das neue Repo umstellen
git remote set-url origin https://github.com/DianaKnodel1/all-in-one-archive.git

# 3) Neuen Stand holen (hart, lokale Änderungen werden verworfen)
git fetch --all --prune
git reset --hard origin/main

# 4) Backend + Frontend deployen
bash scripts/deploy-backend.sh
sudo /opt/apps/portal/scripts/deploy.sh
```

Hinweis: Ist das Repo privat, braucht Schritt 3 einen Zugang. Dann statt Schritt 2:

```bash
git remote set-url origin https://<DEIN-GITHUB-USER>:<PERSONAL-ACCESS-TOKEN>@github.com/DianaKnodel1/all-in-one-archive.git
```

## Was im Projekt noch angepasst wird

`scripts/deploy.sh` und `scripts/setup-server2.sh` tragen den neuen Link bereits als Standard, aber diese Änderung liegt aktuell nur hier im Lovable-Projekt. Damit der Server sie bekommt, muss der aktuelle Projektstand einmal in das neue GitHub-Repo gepusht werden (Lovable → GitHub-Sync auf `DianaKnodel1/all-in-one-archive` verbinden). Danach genügt auf dem Server dauerhaft:

```bash
cd /opt/apps/portal && git pull && bash scripts/deploy-backend.sh && sudo scripts/deploy.sh
```

denn `deploy.sh` korrigiert `origin` ab dann selbst.

## Prüfung nach dem Deploy

- `systemctl status portal.service` muss aktiv sein
- `curl -I http://127.0.0.1:3000/login` liefert 200
- Login im Browser über die Portal-Domain testen

## Nächster Schritt, wenn du zustimmst

Ich kann in der Umsetzung zusätzlich einen kleinen Check in `deploy.sh` ergänzen, der nach dem Start explizit protokolliert, aus welchem Repo/Commit gerade deployed wurde — damit du sofort siehst, ob der richtige Stand live ist.
