#!/usr/bin/env bash
set -euo pipefail

# Build as the deployment user first; this script only installs prepared artifacts.
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
node_binary=${1:?Usage: sudo bash deploy/install.sh /absolute/path/to/node}
if [[ $EUID -ne 0 || $node_binary != /* || ! -x $node_binary ]]; then
  echo 'Run as root with an absolute executable Node path.' >&2
  exit 1
fi
"$node_binary" -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 13)) process.exit(1)' || {
  echo 'Node.js 22.13 or newer is required; use Node.js 24.' >&2
  exit 1
}
command -v rsync >/dev/null
test -f "$repo_dir/node_modules/tsx/package.json"
test -f "$repo_dir/client/dist/index.html"
grep -q '/bridge_online/assets/' "$repo_dir/client/dist/index.html" || {
  echo 'Build the client with VITE_BASE_PATH=/bridge_online/ before installing.' >&2
  exit 1
}
getent passwd bridge-online >/dev/null || useradd --system --user-group \
  --home-dir /var/lib/bridge-online --no-create-home --shell /usr/sbin/nologin bridge-online
if systemctl cat bridge-online.service >/dev/null 2>&1; then
  systemctl stop bridge-online.service
fi
empty_dir=$(mktemp -d)
trap 'rm -rf -- "$empty_dir"' EXIT
install -d -m 0755 /opt/bridge-online
install -m 0644 "$repo_dir/package.json" /opt/bridge-online/package.json
rsync -a --delete --chown=root:root --chmod=a+rX \
  "$repo_dir/node_modules/" /opt/bridge-online/node_modules/
for workspace in shared server client; do
  install -d -m 0755 "/opt/bridge-online/$workspace"
  install -m 0644 "$repo_dir/$workspace/package.json" "/opt/bridge-online/$workspace/package.json"
  dependency_source="$repo_dir/$workspace/node_modules"
  if [[ ! -d $dependency_source ]]; then dependency_source=$empty_dir; fi
  rsync -a --delete --chown=root:root --chmod=a+rX \
    "$dependency_source/" "/opt/bridge-online/$workspace/node_modules/"
done
for workspace in shared server; do
  rsync -a --delete --chown=root:root --chmod=D755,F644 \
    "$repo_dir/$workspace/src/" "/opt/bridge-online/$workspace/src/"
  install -m 0644 "$repo_dir/$workspace/tsconfig.json" "/opt/bridge-online/$workspace/tsconfig.json"
done
install -m 0644 "$repo_dir/tsconfig.json" /opt/bridge-online/tsconfig.json
install -d -m 0755 /opt/bridge-online/www/bridge_online
rsync -a --delete --chown=root:root --chmod=D755,F644 \
  "$repo_dir/client/dist/" /opt/bridge-online/www/bridge_online/
install -m 0755 "$node_binary" /opt/bridge-online/node
install -d -m 0700 /etc/bridge-online
if [[ ! -e /etc/bridge-online/server.env ]]; then
  install -m 0600 "$repo_dir/deploy/systemd/server.env.example" /etc/bridge-online/server.env
fi
install -m 0644 "$repo_dir/deploy/systemd/bridge-online.service" /etc/systemd/system/bridge-online.service
systemd-analyze verify /etc/systemd/system/bridge-online.service
systemctl daemon-reload
echo 'Installed. Review /etc/bridge-online/server.env and migrate existing data before starting.'
echo 'Start with: sudo systemctl enable --now bridge-online.service'
