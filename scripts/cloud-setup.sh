#!/usr/bin/env bash
set -euo pipefail
cd /workspace/agenda_1
source scripts/cloud-env.sh
mkdir -p /workspace/.montana-tools
if ! command -v rustc >/dev/null; then
  curl --fail --location --proto '=https' --tlsv1.2 https://sh.rustup.rs -o /tmp/montana-rustup.sh
  sh /tmp/montana-rustup.sh -y --profile minimal --default-toolchain 1.99.0 --no-modify-path
fi
# A signed Debian package index and verified package hashes, without root access.
mkdir -p /workspace/.montana-tools/apt/{lists/partial,archives/partial}
cat > /workspace/.montana-tools/apt/sources.list <<'SOURCES'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie-updates main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://security.debian.org/debian-security trixie-security main
SOURCES
cat > /workspace/.montana-tools/apt/apt.conf <<'CONFIG'
Dir::Etc::main "-";
Dir::Etc::parts "-";
Dir::Etc::sourcelist "/workspace/.montana-tools/apt/sources.list";
Dir::Etc::sourceparts "-";
Dir::State::lists "/workspace/.montana-tools/apt/lists";
Dir::Cache::archives "/workspace/.montana-tools/apt/archives";
APT::Get::List-Cleanup "0";
Debug::NoLocking "true";
CONFIG
export APT_CONFIG=/workspace/.montana-tools/apt/apt.conf
/usr/bin/apt-get update
/usr/bin/apt-get install --download-only --no-install-recommends -y libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev patchelf xvfb webkit2gtk-driver
mkdir -p /workspace/.montana-tools/sysroot
for deb in /workspace/.montana-tools/apt/archives/*.deb; do
  dpkg-deb -x "$deb" /workspace/.montana-tools/sysroot
done
python3 - <<'PY'
from pathlib import Path
root=Path('/workspace/.montana-tools/sysroot')
for file in root.rglob('*.pc'):
    contents=file.read_text()
    if str(root) not in contents:
        file.write_text(contents.replace('/usr',str(root)+'/usr'))
for file in (root/'usr/lib/x86_64-linux-gnu').iterdir():
    if file.is_symlink() and not file.exists():
        target=Path('/usr/lib/x86_64-linux-gnu')/file.readlink().name
        if target.exists():
            file.unlink()
            file.symlink_to(target)
PY
pkg-config --modversion gtk+-3.0 webkit2gtk-4.1
npm ci --no-audit --no-fund
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
