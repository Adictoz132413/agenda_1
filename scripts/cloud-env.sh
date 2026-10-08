# Source this file in the Codex cloud environment before running Cargo or Tauri.
export CARGO_HOME=/workspace/.montana-tools/cargo
export RUSTUP_HOME=/workspace/.montana-tools/rustup
export PATH="$CARGO_HOME/bin:/workspace/.montana-tools/sysroot/usr/bin:$PATH"
export PKG_CONFIG_PATH=/workspace/.montana-tools/sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/workspace/.montana-tools/sysroot/usr/share/pkgconfig
export LIBRARY_PATH=/workspace/.montana-tools/sysroot/usr/lib/x86_64-linux-gnu${LIBRARY_PATH:+:$LIBRARY_PATH}
export LD_LIBRARY_PATH=/workspace/.montana-tools/sysroot/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
export npm_config_cache=/workspace/.npm-cache
