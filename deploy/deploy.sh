#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
node_binary="$repo_dir/.deploy/node"
if [[ ! -x $node_binary || ! -f $repo_dir/client/dist/index.html ]]; then
  echo 'Build first: npm exec --yes --package=node@24 -- bash deploy/build.sh' >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  exec sudo bash "$repo_dir/deploy/deploy.sh"
fi
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
for tool in python3 rsync nginx systemctl flock; do command -v "$tool" >/dev/null; done
exec 9>/run/lock/bridge-online-deploy.lock
flock -n 9 || { echo 'Another Bridge Online deployment is running.' >&2; exit 1; }

site_file=$(readlink -f /etc/nginx/sites-enabled/acserver.csie.org)
test -f "$site_file"
systemctl is-active --quiet nginx
nginx -t
if ! systemctl is-active --quiet bridge-online.service; then
  python3 - <<'PY'
import socket
with socket.socket() as listener:
    try:
        listener.bind(('127.0.0.1', 3001))
    except OSError:
        raise SystemExit('Port 3001 is occupied. Resolve the conflict before deploying.')
PY
fi
if [[ -f $repo_dir/server/data/database.json && ! -f /var/lib/bridge-online/database.json ]]; then
  echo 'Existing repository data found. Stop its writer and migrate it using docs/wiki/deployment.md first.' >&2
  exit 1
fi
# Keep the automated deployment aligned with its fixed local proxy configuration.
if [[ -f /etc/bridge-online/server.env ]]; then
  python3 - /etc/bridge-online/server.env "$repo_dir/deploy/systemd/server.env.example" <<'PY'
import sys
from pathlib import Path

def values(path):
    result = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            key, separator, value = line.partition('=')
            if not separator:
                raise SystemExit('Invalid environment file; review /etc/bridge-online/server.env.')
            result[key] = value
    return result

actual, expected = map(values, sys.argv[1:])
for key, value in expected.items():
    if actual.get(key) != value:
        raise SystemExit(f'Review {key} in /etc/bridge-online/server.env before automated deployment.')
PY
fi

install -d -m 0700 /var/backups/bridge-online
backup_dir=$(mktemp -d "/var/backups/bridge-online/deploy-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
cp -p "$site_file" "$backup_dir/site.conf"
snippet=/etc/nginx/snippets/bridge-online.conf
if [[ -f $snippet ]]; then cp -p "$snippet" "$backup_dir/snippet.conf"; fi
if [[ -f /etc/bridge-online/server.env ]]; then
  cp -p /etc/bridge-online/server.env "$backup_dir/server.env"
fi
python3 "$repo_dir/deploy/configure-nginx.py" --input "$site_file" --output "$backup_dir/site.new.conf"
nginx_changed=false
on_error() {
  local status=$?
  trap - ERR
  if [[ $nginx_changed == true ]]; then
    cp -p "$backup_dir/site.conf" "$site_file"
    if [[ -f $backup_dir/snippet.conf ]]; then
      cp -p "$backup_dir/snippet.conf" "$snippet"
    else
      rm -f -- "$snippet"
    fi
    if nginx -t; then systemctl reload nginx || true; fi
  fi
  echo "Deployment failed. Backups: $backup_dir. Inspect: journalctl -u bridge-online -n 100" >&2
  exit "$status"
}
trap on_error ERR
if systemctl cat bridge-online.service >/dev/null 2>&1; then
  systemctl stop bridge-online.service
fi
if [[ -f /var/lib/bridge-online/database.json ]]; then
  cp -p /var/lib/bridge-online/database.json "$backup_dir/database.json"
fi
bash "$repo_dir/deploy/install.sh" "$node_binary"
bash "$repo_dir/deploy/start-service.sh"
python3 "$repo_dir/deploy/wait-for-health.py" http://127.0.0.1:3001/health
install -d -m 0755 /etc/nginx/snippets
nginx_changed=true
install -m 0644 "$repo_dir/deploy/nginx/bridge-online.conf" "$snippet"
cat "$backup_dir/site.new.conf" > "$site_file"
nginx -t
systemctl reload nginx
python3 "$repo_dir/deploy/wait-for-health.py" https://acserver.csie.org/bridge_online/health
trap - ERR
echo
echo 'Deployed: https://acserver.csie.org/bridge_online/'
echo "Backups: $backup_dir"
systemctl status bridge-online.service --no-pager
