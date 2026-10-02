#!/usr/bin/env bash
set -euo pipefail

# A newly installed inactive unit may be unloaded; reset only retained failures.
if systemctl is-failed --quiet bridge-online.service; then
  systemctl reset-failed bridge-online.service
fi
systemctl enable --now bridge-online.service
