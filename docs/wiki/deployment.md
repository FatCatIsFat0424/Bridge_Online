# Deploy with systemd

Public URL: **https://acserver.csie.org/bridge_online/**.
Prerequisites: Debian/Ubuntu Linux, systemd, rsync, sudo, Node.js 24, and an existing
local Nginx HTTPS virtual host for `acserver.csie.org` with working DNS, TLS, and
certificate renewal. Run commands from the repository root on the target host.

## Layout

| Path                                   | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `/opt/bridge-online`                   | Root-owned application, dependencies, and a copy of Node |
| `/opt/bridge-online/www/bridge_online` | Built frontend                                           |
| `/etc/bridge-online/server.env`        | Root-only runtime configuration                          |
| `/var/lib/bridge-online/database.json` | Persistent database                                      |
| `journalctl -u bridge-online`          | Application logs                                         |

One non-root backend process runs per JSON database. systemd makes the application
read-only, creates its writable state directory, restarts failed processes, and
allows 60 seconds for graceful shutdown. The copied Node binary avoids dependence
on an interactive shell or nvm. Build on the deployment host's OS and architecture.

## Build and install

### One-command deployment on this host

Prepare artifacts as the normal deployment user:

```bash
npm exec --yes --package=node@24 -- bash deploy/build.sh
```

This installs locked dependencies, runs typecheck/lint/tests, builds the subpath
frontend, and saves the selected Node binary in ignored `.deploy/node`.
Deployment scripts are checked with `bash -n`, and the Nginx configuration tool
uses standard-library tests: `python3 -B -m unittest discover -s deploy/tests`.
After that, deploy with one command (sudo requests your password if needed):

```bash
bash /home/acaccel/Brdige_Online/deploy/deploy.sh
```

The wrapper targets this host's existing `/etc/nginx/sites-enabled/acserver.csie.org`.
It validates the active configuration, rejects a conflicting port or unmanaged
Bridge route, saves protected backups under `/var/backups/bridge-online`, stops
the existing backend for a consistent database backup, and installs the prepared
artifacts. It adds managed includes to the existing HTTP/HTTPS blocks, migrating
the previous inline HTTP redirect block to `bridge-online-http.conf`,
validates/reloads Nginx, starts/enables systemd, and checks both local and public
health endpoints. Other applications' routes remain unchanged. Repeated runs
update the managed routes without duplicating them. A shared Nginx deployment
lock serializes cooperating service installers; a final comparison rejects site
edits made while application artifacts were being installed.

If Nginx validation/reload or the final health check fails, the previous Nginx
site and both snippets are restored. Application files are not automatically rolled back;
use the backup path and service logs reported by the script. Existing environment
settings must match this host's supplied deployment configuration. The wrapper
refuses first-time deployment if repository data still needs migration; follow
the migration section below first. No password is stored by these scripts.

### Manual installation

```bash
node --version # Use Node.js 24; project minimum is 22.13.
npm ci --include=dev
npm run typecheck
npm run lint
npm test
VITE_BASE_PATH=/bridge_online/ VITE_SERVER_URL='' npm run build:client
sudo bash deploy/install.sh "$(node -p 'process.execPath')"
sudoedit /etc/bridge-online/server.env
```

Keep development dependencies: the server uses `tsx` at runtime. The installer
copies only prepared runtime artifacts and stops an existing service before
updating. It leaves the service stopped for configuration/data checks, preserves
existing `server.env`, never copies a database, and does not change Nginx.

The provided environment already targets this deployment:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
TRUST_PROXY_LOOPBACK=true
CLIENT_ORIGIN=https://acserver.csie.org
DATABASE_PATH=/var/lib/bridge-online/database.json
```

`CLIENT_ORIGIN` must not contain `/bridge_online` or a trailing slash. The backend
binds to localhost. If port 3001 is occupied, change `PORT`, all Nginx upstream
ports, and local health commands together. Do not expose the backend publicly.
Loopback proxy trust requires the local proxy to overwrite `X-Forwarded-For`, as
the supplied snippet does; this keeps per-client login rate limits. A remote proxy
needs a separately reviewed trust configuration.

Use `KEY=value` without `export` or shell expansion. Keep the database under the
state directory because other paths are read-only to the service.
`VITE_BASE_PATH` controls assets, Router, API, and Socket.IO paths. Keep
`VITE_SERVER_URL` empty and `VITE_SOCKET_PATH` unset for this deployment. Frontend
settings require a rebuild. Optional browser-visible TURN settings belong in
`client/.env.local`; see [voice chat](./voice-chat.md).

## Existing database: migrate once

Stop the original writer before backing up and copying its data. Never run two
processes against the same JSON database. Skip this section for a new installation;
the application creates an empty database on first start.

```bash
sudo install -d -m 0700 /var/backups/bridge-online
sudo install -m 0600 server/data/database.json \
  "/var/backups/bridge-online/pre-systemd-$(date -u +%Y%m%dT%H%M%SZ).json"
sudo install -d -o bridge-online -g bridge-online -m 0700 /var/lib/bridge-online
sudo test ! -e /var/lib/bridge-online/database.json && \
  sudo install -o bridge-online -g bridge-online -m 0600 \
    server/data/database.json /var/lib/bridge-online/database.json
```

If the destination already exists, inspect it and follow the
[storage/restore guide](./accounts-and-storage.md); do not overwrite it during updates.

## Add Nginx locations

```bash
sudo install -d -m 0755 /etc/nginx/snippets
sudo install -m 0644 deploy/nginx/bridge-online.conf /etc/nginx/snippets/bridge-online.conf
sudo install -m 0644 deploy/nginx/bridge-online-http.conf /etc/nginx/snippets/bridge-online-http.conf
sudo nginx -T
```

Find the existing HTTPS `server` block with `server_name acserver.csie.org` in the
output, then edit its source file using `sudoedit`. Add this line once inside it:

```nginx
include /etc/nginx/snippets/bridge-online.conf;
```

In the existing HTTP `server` block, add the redirect include once:

```nginx
include /etc/nginx/snippets/bridge-online-http.conf;
```

Keep the site's existing TLS configuration and other locations. Do not include
these snippets at `http` scope or create another virtual host. The HTTPS snippet
handles `/bridge_online` redirection,
SPA fallback, API/Socket prefix removal, and cookies scoped to `/bridge_online/`.
WebSocket headers follow the [Nginx reference](https://nginx.org/en/docs/http/websocket.html).

## Start and verify

```bash
sudo nginx -t
sudo systemctl enable --now bridge-online.service
sudo systemctl reload nginx
sudo systemctl status bridge-online.service --no-pager
curl --fail http://127.0.0.1:3001/health
curl --fail https://acserver.csie.org/bridge_online/health
```

Both health checks should return `{"status":"ok"}`. Open the public URL, sign in,
create a room, refresh `/bridge_online/login`, and confirm Socket.IO connectivity.
Restart the backend and confirm persisted state restores. Browser microphone/TURN
connectivity must be checked on the target network. If migrating from a root-path
deployment, clear the old `bridge_session` cookie once before signing in again.

## Operations, updates, and rollback

The API proxy allows a 3 MiB request body so a supported 2 MiB background image
fits after base64 JSON encoding. Application routes still enforce their own limits.
Deploy the updated Nginx snippet as well as the frontend when applying this fix.

Health checks poll for up to 30 seconds and require HTTP 200 with JSON
`status: ok`. This covers connection refusal during Node startup and temporary
404/502 responses while Nginx workers switch configurations after a reload.
Only an unsuccessful polling window triggers configuration rollback.

The deployment startup helper resets systemd failure counters only when the unit
is failed. Newly installed inactive units can be unloaded by systemd and must not
require `reset-failed` before `enable --now`. If an earlier deployment stopped at
that step, rerun `bash deploy/deploy.sh`; rebuilding or deleting data is unnecessary.

```bash
sudo journalctl -u bridge-online.service -n 100 --no-pager
sudo journalctl -u bridge-online.service -f
sudo systemctl restart bridge-online.service
sudo systemctl stop bridge-online.service
```

Build and validate the new revision before an update. Record the previous deployed
revision and build settings, then stop and back up before running the installer:

```bash
sudo systemctl stop bridge-online.service
sudo install -d -m 0700 /var/backups/bridge-online
sudo cp -p /var/lib/bridge-online/database.json \
  "/var/backups/bridge-online/database-$(date -u +%Y%m%dT%H%M%SZ).json"
sudo bash deploy/install.sh "$(node -p 'process.execPath')"
sudo systemctl start bridge-online.service
curl --fail https://acserver.csie.org/bridge_online/health
```

Updates have downtime. Keep a protected off-host backup too. Reinstall/test/reload
Nginx only when its snippet changes. For rollback, rebuild the previous revision
and deploy its matching dependencies/frontend. Restore old data only if schema
compatibility requires it, with the backend stopped; this discards newer writes.
Preserve database ownership `bridge-online` and mode `0600`.

After fixing repeated failures, run `sudo systemctl reset-failed bridge-online`
and start again. Inspect logs for Node version, configuration, database permissions,
schema, or port conflicts. Never delete the database as a startup workaround.
See [systemd execution settings](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)
for environment-file and state-directory behavior.
