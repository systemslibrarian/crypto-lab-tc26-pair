#!/usr/bin/env bash
set -euo pipefail

readonly UPSTREAM_URL="https://github.com/QAPP-tech/hypericum_tc26.git"
readonly UPSTREAM_COMMIT="f3f254038e5539132d112e8f97332a2a351131fe"
readonly ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly SOURCE_DIR="${TMPDIR:-/tmp}/crypto-lab-hypericum-${UPSTREAM_COMMIT}"
readonly BUILD_DIR="${TMPDIR:-/tmp}/crypto-lab-hypericum-build-${UPSTREAM_COMMIT}"
readonly OUTPUT_DIR="$ROOT_DIR/src/wasm"

command -v emcmake >/dev/null || {
  printf '%s\n' 'Emscripten is required: https://emscripten.org/docs/getting_started/downloads.html' >&2
  exit 1
}

if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  git clone "$UPSTREAM_URL" "$SOURCE_DIR"
fi
git -C "$SOURCE_DIR" fetch --depth 1 origin "$UPSTREAM_COMMIT"
git -C "$SOURCE_DIR" checkout --detach "$UPSTREAM_COMMIT"

rm -rf "$BUILD_DIR"
emcmake cmake \
  -S "$SOURCE_DIR" \
  -B "$BUILD_DIR" \
  -DPARAMSET=m_128_20 \
  -DGOST_OPTIMIZATION=0 \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" --target hypericum --parallel

mkdir -p "$OUTPUT_DIR"
emcc \
  "$ROOT_DIR/native/hypericum_wrapper.c" \
  "$BUILD_DIR/libhypericum.a" \
  "$BUILD_DIR/streebog/libstreebog.a" \
  -I"$SOURCE_DIR/include" \
  -I"$SOURCE_DIR" \
  -I"$BUILD_DIR" \
  -O3 \
  --no-entry \
  -sALLOW_MEMORY_GROWTH=1 \
  -sENVIRONMENT=web,node \
  -sEXPORT_ES6=1 \
  -sMODULARIZE=1 \
  -sEXPORTED_FUNCTIONS='["_malloc","_free","_tc26_hypericum_public_key_bytes","_tc26_hypericum_secret_key_bytes","_tc26_hypericum_signature_bytes","_tc26_hypericum_seed_bytes","_tc26_hypericum_seed","_tc26_hypericum_keypair","_tc26_hypericum_sign","_tc26_hypericum_verify"]' \
  -sEXPORTED_RUNTIME_METHODS='["HEAPU8"]' \
  -o "$OUTPUT_DIR/hypericum.js"

printf 'Built %s and %s\n' "$OUTPUT_DIR/hypericum.js" "$OUTPUT_DIR/hypericum.wasm"