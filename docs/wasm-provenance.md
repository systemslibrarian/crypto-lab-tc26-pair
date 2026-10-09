# Compiled reference provenance

`src/wasm/provenance.json` records the committed WASM SHA-256 fingerprints and
the immutable upstream revisions already used by the build scripts. The wrappers
and upstream source are readable. A matching fingerprint identifies the shipped
artifact; it does not establish correspondence with the C source.

Run `python3 scripts/check-wasm-provenance.py --check` to check those fingerprints.
The read-only **WASM provenance rebuild** workflow additionally installs the pinned
Emscripten 4.0.23 SDK revision and runs `--rebuild`, preserving each build log and
an exact byte comparison in its artifact. It never deploys or pushes rebuilt files.

The original compiler version was not recorded. Version 4.0.23 is the selected
test environment, not a claim about the original build. A mismatch remains an
unreproduced artifact and may reflect compiler or build differences; it is not a
cryptographic failure. A matching rebuild supports byte correspondence in this
environment, while the reference KAT and browser checks answer different questions.
