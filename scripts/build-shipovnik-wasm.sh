#!/usr/bin/env bash
set -euo pipefail

readonly UPSTREAM_URL="https://github.com/QAPP-tech/shipovnik_tc26.git"
readonly UPSTREAM_COMMIT="a9139ef6178a6dfebac3ae328817a361f0e85256"
readonly ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly SOURCE_DIR="${TMPDIR:-/tmp}/crypto-lab-shipovnik-${UPSTREAM_COMMIT}"
readonly BUILD_DIR="${TMPDIR:-/tmp}/crypto-lab-shipovnik-build-${UPSTREAM_COMMIT}"
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
  -DGOST_OPTIMIZATION=0 \
  -DENTROPY_SOURCE=/dev/zero \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" --target shipovnik --parallel

mkdir -p "$OUTPUT_DIR"
emcc \
  "$ROOT_DIR/native/shipovnik_wrapper.c" \
  "$BUILD_DIR/libshipovnik.a" \
  "$BUILD_DIR/streebog/libstreebog.a" \
  -I"$SOURCE_DIR/include/shipovnik" \
  -O3 \
  --no-entry \
  -sALLOW_MEMORY_GROWTH=1 \
  -sENVIRONMENT=web,node \
  -sEXPORT_ES6=1 \
  -sMODULARIZE=1 \
  -sEXPORTED_FUNCTIONS='["_malloc","_free","_tc26_shipovnik_public_key_bytes","_tc26_shipovnik_secret_key_bytes","_tc26_shipovnik_signature_max_bytes","_tc26_shipovnik_keypair_entropy_bytes","_tc26_shipovnik_sign_entropy_bytes","_tc26_shipovnik_keypair","_tc26_shipovnik_sign","_tc26_shipovnik_verify"]' \
  -sEXPORTED_RUNTIME_METHODS='["HEAPU8"]' \
  -o "$OUTPUT_DIR/shipovnik.js"

printf 'Built %s and %s\n' "$OUTPUT_DIR/shipovnik.js" "$OUTPUT_DIR/shipovnik.wasm"