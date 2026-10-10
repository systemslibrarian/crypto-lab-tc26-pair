# Compiled reference provenance

The manifest in `src/wasm/provenance.json` records both shipped WASM SHA-256
fingerprints, the immutable QAPP source revisions, and the selected test SDK.
It retains `originalCompiler: null`: a successful reproduction does not identify
the original build environment or establish a cryptographic/constant-time audit.

Run:

~~~sh
python3 scripts/test-wasm-provenance.py -v
python3 scripts/check-wasm-provenance.py --check
python3 scripts/check-wasm-provenance.py --rebuild
~~~

`--check` validates the complete two-artifact inventory and the tracked bytes.
Its success means **fingerprint verified, rebuild unverified**. Empty, omitted,
duplicate, malformed, missing and non-regular evidence cannot pass. Exit 1
identifies an observed mismatch or failed build; exit 2 means evidence is
unreadable, incomplete or changed during collection.

`--rebuild` invokes the existing build scripts with a new empty output directory
and compiler cache for each artifact. The scripts create fresh source clones at
the exact recorded commits and new build directories. Shared temporary clones,
untracked upstream edits and cached project objects/archives are not reused.
The checker never replaces shipped JS/WASM. `WASM_OUTPUT_DIR` selects separate
output when calling a build script directly; normal `npm run wasm:build` still
writes the explicitly requested project outputs. Only temporary directories
created by that invocation are removed.

The report captures actual executable paths, hashes/version output, repository
SHA at start/end, manifest/build-script/wrapper hashes, build exit codes,
fingerprints, fresh WASM comparison and a separate JS adapter comparison. Missing
outputs from a successful build remain incomplete; a stale tracked artifact
cannot stand in for fresh output. A timeout stops the whole process group.
Changed tracked inputs or HEAD invalidate the observation. The exact-byte gate
currently covers the two WASM files; adapter comparisons are separately reported.
Use `--output PATH` to retain reports/logs outside the default ignored
`provenance-results/`, and `--timeout SECONDS` to bound each build.

## Independently tested SDK selection

The official Emscripten 6.0.10 SDK is pinned to:

- emsdk commit `a2b92777574c2feda07994cd4f1079a3dfc151f8`
- release hash `666337b525e673e769121856d175f6f52b8ead64`
- release-map SHA-256 `28ab300d0110f50c2ea6b456ae5218e66ab4d959cd5d56d75a424d2696b73440`

The read-only **WASM provenance rebuild** PR workflow verifies the SDK source
and release-map identities before installing that version. It runs the offline
positive/negative controls, both clean source builds and exact comparisons, then
preserves the report and full logs even on failure. It does not publish or commit
artifacts. The workflow does not claim that a selected SDK is the original one.

A clean Mac arm64 official-SDK run on 2026-10-10 reproduced both WASM and both JS
adapters exactly, independently of the earlier Homebrew 6.0.10-git run. The
version string alone was not treated as environment identity: the official SDK
source/release pins and actual tools were recorded. New source/build directories
and initially empty compiler caches were used. Canonical temporary paths avoid
the macOS `/var` versus `/private/var` alias breaking relative SDK system-library
paths; the initial failed attempt is retained in the maintenance evidence.

The historical CI Emscripten 4.0.23 builds succeeded but **both WASM hashes
mismatched**. That selected environment remains in `historicalTestCompilers` and
[run 37892405640](https://github.com/systemslibrarian/crypto-lab-tc26-pair/actions/runs/37892405640).
It is not relabeled as reproduced. The earlier Mac reports/logs remain in
`audits/rebuild-2026-10-09/`. Updated official-SDK observations are kept in
`audits/rebuild-2026-10-10/`, with the actual inspected source SHA and input hashes.

A match establishes byte correspondence for these source/wrapper inputs in the
recorded environment. Reference KATs, real-WASM browser claims, implementation
security, original compiler identity, and the scanner's opaque-WASM coverage are
separate evidence categories.
