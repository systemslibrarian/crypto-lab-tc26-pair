# TC26 Pair

**Shipovnik · Hypericum · Streebog**

An interactive browser lab for two TC26 post-quantum signature proposals: the
code-based Shipovnik scheme and the stateless hash-based Hypericum scheme.

> **Not production cryptography.** This is a teaching demo. The full signers and
> verifiers are pinned QApp C reference implementations compiled to WebAssembly;
> the visible one-round Stern protocol and four-leaf Merkle tree are reduced,
> explicitly labeled teaching models. Secrets stay in browser memory, but the
> code is not audited or hardened against side channels.

## What It Is

Shipovnik turns Stern's three-challenge identification protocol into a
non-interactive signature using Fiat-Shamir. Its security target is syndrome
decoding: the signer proves knowledge of a low-weight codeword matching a public
syndrome without revealing that witness.

Hypericum follows the stateless hash-signature design family associated with
SPHINCS+: FORS+C trees, WOTS+C chains, and an XMSS hypertree. The pinned
`m_128_20` implementation uses Streebog-256 in tree and chain hash roles and
Streebog-512 for message hashing. The demo imports the same `@li0ard/streebog`
package as the related World Hashes lab for its inspectable hash slots, while
the complete signer and verifier execute QApp's bundled C implementation.

## Exhibits

1. **Shipovnik Stern round** — Seal three Streebog commitments, choose any of
   the three challenges, and recompute the two opened commitments. A
   witness-free transcript visibly answers two branches and is caught by the
   third, yielding a measured per-round detection probability of `1/3`.
2. **Fiat-Shamir step** — Derive the challenge from the message and commitments
   with Streebog-512, replacing the interactive verifier question.
3. **Shipovnik reference path** — Verify the deterministic zero-entropy QApp
   fixture, sign a chosen message with browser entropy, and flip one response
   byte so the real verifier rejects it.
4. **Hypericum hash slots** — Inspect every input and Streebog-256 output in a
   computed four-leaf Merkle slice, beside the full `m_128_20` FORS+C, WOTS+C,
   and two-layer XMSS structure.
5. **Hypericum reference path** — Verify QApp's published deterministic
   `output_m_128_20.txt` example, optionally run its complete portable signer in
   a worker, and alter one signature byte to exercise rejection.
6. **The Mirror** — Compare Hypericum with SLH-DSA and show a logarithmic size
   chart for SLH-DSA-SHA2-128s, Hypericum, and Shipovnik.

## When to Use It

- Use it to study how the same hash-signature architecture can be instantiated
  with a national hash primitive.
- Use it to inspect Stern's commit/challenge/respond structure and its
  cut-and-choose soundness before looking at the full signature encoding.
- Use it to test the pinned QApp reference artifacts in a browser environment.
- Do **not** use it to protect production keys or messages. The WebAssembly
  ports prioritize faithful, inspectable execution rather than constant-time
  behavior, memory zeroization, or deployment hardening.
- Do **not** read the reduced teaching tree or one Stern round as the complete
  security construction; the page labels both boundaries explicitly.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-tc26-pair](https://systemslibrarian.github.io/crypto-lab-tc26-pair/)**

Open Stern branches, measure a cheating prover's detection probability, inspect
executed Streebog slots, verify both pinned reference signatures, and make both
real verifiers reject changed signatures.

## What Can Go Wrong

- **Large signatures** — the deterministic Shipovnik fixture is 805,868 bytes;
  its API reserves a 1,072,662-byte maximum. Correct verification does not make
  that bandwidth cost disappear.
- **Slow portable signing** — measured cold/warm Hypericum `m_128_20` WASM
  fixture runs took 11–83 seconds on the development machine. Signing runs in a
  worker and never substitutes a fake signature while waiting.
- **Hash assumptions remain hash assumptions** — Hypericum's green verifier
  does not provide security beyond its hash functions, parameters, and complete
  construction.
- **Endianness drift** — Streebog-256 and Streebog-512 byte order is pinned by
  GOST vectors, the QApp fixture digests, and cross-lab package consistency.
- **Reduced-model confusion** — the visible Merkle slice and one Stern round
  execute real operations but deliberately use small dimensions for inspection.

## Real-World Usage

TC26 is Russia's cryptographic standardization body. Shipovnik and Hypericum
are post-quantum signature proposals developed by Kryptonite/QApp and published
with open BSD-2-Clause C reference implementations. This lab presents that
provenance neutrally and makes no claim that either proposal is superior to a
NIST-standardized scheme.

## How to Run Locally

```bash
npm install
npm run dev
```

The checked-in WebAssembly files are reproducible from pinned upstream commits:

```bash
brew install cmake emscripten   # macOS, once
npm run wasm:build
npm run fixtures:generate
```

No backend or environment variables are required.

## Related Demos

- [Sphincs Ledger](https://systemslibrarian.github.io/crypto-lab-sphincs-ledger/) — SLH-DSA/SPHINCS+ and its SHA-256 Merkle/WOTS+ structure.
- [World Hashes](https://systemslibrarian.github.io/crypto-lab-world-hashes/) — Streebog-256 and Streebog-512 alongside other national hash standards.
- [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) — the full browser-demo catalog.

## Build & Verify

- **16 unit tests** cover GOST known-answer vectors, all three Stern branches,
  computed soundness behavior, Fiat-Shamir determinism, Hypericum tree wiring,
  fixture integrity, full QApp sign/verify paths, and tamper rejection.
- **Four pinned reference checks** cover Streebog-256, Streebog-512, Hypericum
  `m_128_20`, and Shipovnik's documented deterministic entropy path. Fixture
  provenance and SHA-256 fingerprints live in
  [`public/fixtures/manifest.json`](public/fixtures/manifest.json).
- **Three browser tests** independently recompute the displayed tree and
  soundness claims, exercise both real verifier failure paths, enforce stale
  verdict retirement, and scan reachable desktop/mobile states for zero WCAG
  2.1 A/AA violations plus arithmetic text and non-text contrast.
- The WebAssembly builds pin
  [`QAPP-tech/hypericum_tc26`](https://github.com/QAPP-tech/hypericum_tc26) at
  `f3f2540` and
  [`QAPP-tech/shipovnik_tc26`](https://github.com/QAPP-tech/shipovnik_tc26) at
  `a9139ef`. BSD-2 attribution is preserved in
  [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt).

```bash
npm test
npm run build
npm run test:a11y
```

## Performance

On the development machine, Shipovnik signs and verifies its 806 KB fixture in
about 200 ms per operation. Cold and warm runs of the complete portable
Hypericum fixture path measured 11–83 seconds. Browser timings vary; all
expensive work runs in workers so interaction remains responsive.

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*