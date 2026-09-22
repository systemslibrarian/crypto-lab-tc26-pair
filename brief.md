# BUILD BRIEF — crypto-lab-tc26-pair

Binding spec: ./CRYPTO-LAB-TEMPLATE.md (gitignored copy of _MASTER-TEMPLATE.md).
Catalog root CLAUDE.md wins where they touch.
Lifecycle: Build → Teach → Look → Accessibility → README → Deploy.

## KEY FACTS PINNED (verify each before it enters shipped copy)

- Shipovnik and Hypericum are Russian TC26 post-quantum signature schemes,
  developed by Kryptonite/QApp. Open C reference implementations exist under a
  BSD-2 licence: QAPP-tech/shipovnik_tc26 and QAPP-tech/hypericum_tc26. Preserve
  the BSD-2 copyright/attribution on any ported code.
- Shipovnik = Stern's code-based zero-knowledge IDENTIFICATION protocol made
  non-interactive by Fiat-Shamir. Security rests on syndrome decoding (code-based),
  and the signatures are large — the classic Stern-signature tradeoff. Ties to the
  catalog's syndrome / code-based labs (grep to confirm which exist).
- Hypericum = a stateless HASH-based signature in the SPHINCS+ family, instantiated
  over GOST Streebog (GOST 34.11-2012) instead of SHA-2/SHAKE. Param sets look like
  b_256_64 / m_256_20 etc. Ties directly to sphincs-ledger (SLH-DSA) and world-
  hashes (Streebog) — grep to confirm both exist.
- The teaching payload: a national PQ suite mirrors NIST's categories with national
  primitives — Hypericum is "SPHINCS+ but over Streebog," and Shipovnik is a code-
  based ZK signature, an approach NIST did not standardize. Confirm all structural
  claims against the specs; docs are primarily in Russian — verify, don't guess.

## NEW DEMO BRIEF

repo name      : crypto-lab-tc26-pair
short name (H1): TC26 Pair
subtitle       : Shipovnik · Hypericum · Streebog
one-liner      : Russia's two post-quantum signatures — a code-based zero-knowledge
                 scheme and a SPHINCS+-family hash signature built on Streebog.
concept        : Post-quantum categories are universal; the primitives inside them
                 are national. Swap SHA for Streebog and you have Hypericum; take
                 Stern's ZK proof to a signature and you have Shipovnik.
primitives/spec: Shipovnik (Stern + Fiat-Shamir, code-based), Hypericum (stateless
                 hash-based / SPHINCS+ family over GOST Streebog); TC26 specs.
--accent       : #ffb84d   (assigned centrally — do not change here)
favicon        : 🌹
in scope       : Shipovnik sign/verify and Hypericum sign/verify, each KAT-verified
                 against the QApp reference vectors; the Stern ZK round made
                 visible; the Streebog-for-SHA swap in the SPHINCS+ structure shown
                 explicitly; a size/tradeoff comparison against SLH-DSA.
non-goals      : No new hardness claim. No attack. No re-implementation of Streebog
                 internals (that is world-hashes; use it as the hash). No full high-
                 parameter signing in JS if intractable — use the BSD-2 reference
                 (WASM) + KAT vectors. Not a claim of superiority over NIST picks.
                 No political framing beyond neutral provenance.

## §1.1 SCOPE

Three panes.
1. HYPERICUM — sign/verify, KAT-verified; show the SPHINCS+ hypertree with Streebog
   in the hash slots (the national-primitive swap).
2. SHIPOVNIK (HEADLINE) — one Stern zero-knowledge round shown interactively
   (commit / challenge / response, cut-and-choose), then Fiat-Shamir'd into a
   signature; verify.
3. THE MIRROR — the two placed against their NIST analogues (Hypericum↔SLH-DSA;
   code-based ZK as the approach NIST left out), with a signature-size comparison.

## §1.2 SECURITY / CORRECTNESS INVARIANTS (beat features on conflict)

INV-1  Hypericum sign→verify round-trips and matches the QApp reference KAT for a
       named parameter set; Shipovnik sign→verify round-trips and matches its
       reference KAT. Both fixture-pinned; confirm the vector source before pinning.
INV-2  Hypericum's hash slots are Streebog, executed: the page computes a Streebog
       digest inside the structure and it matches world-hashes' Streebog for the
       same input (cross-lab consistency), not asserted.
INV-3  The Stern round is executed: a correct response passes the challenge and a
       cheating prover is caught with the protocol's soundness probability, computed
       from the page's own protocol run.
INV-4  A tampered Hypericum or Shipovnik signature fails verification against the
       real verifier; fail-closed.
INV-5  MUTATION GATE (§4.1c/§4.1d): perturbing the Streebog slot, the hypertree
       wiring, or the Stern challenge logic must make the owning KAT/verify FAIL.
INV-6  NEGATIVE CLAIM (§4.1d): state, tied to a fixture, a real limitation — e.g.
       Shipovnik's large signature size, or "hash-based security reduces to the
       hash, no more" — with the mechanism working AND the limit on screen together.

## §1.3 ARCHITECTURE

ALGORITHM SOURCE (normative):
Port from the BSD-2 QApp references (shipovnik_tc26, hypericum_tc26), compiled to
WASM where JS is intractable, preserving BSD-2 attribution. Hand-roll ONLY the
inspectable teaching pieces: the Stern commit/challenge/response round, and the
SPHINCS+ hypertree view with the Streebog slot exposed. Streebog itself comes from
a named implementation consistent with world-hashes. KAT vectors from the QApp
reference packages are the acceptance test (INV-1). No faked math; if a parameter
set won't run in-browser, use the reference/WASM path and say so on-page. NOTE: the
reference docs are Russian — verify every structural claim against the spec, do not
infer from the code alone.

Modules: src/shipovnik/ (stern round isolated), src/hypericum/ (hypertree + hash
slot isolated), src/ui/. Client-side; WASM allowed. No network backend.

## §1.4 UI

PANE 1 — Hypericum
  Sign a short message, verify; show the hypertree and highlight the Streebog hash
  slots. KAT badge. Plain-language intro ("what hash-based signatures are, why a
  national hash goes in the slot") first.
PANE 2 — Shipovnik (HEADLINE)
  Step one Stern round: prover commits, verifier challenges (three cases), prover
  responds, verifier checks; a cheating prover is caught. Then Fiat-Shamir collapses
  the interaction into a signature. SHOW the cut-and-choose; don't narrate it.
PANE 3 — The Mirror
  Hypericum next to SLH-DSA (same family, different hash); Shipovnik as the code-
  based ZK approach; a signature-size bar chart. Link sphincs-ledger and world-
  hashes (grep to confirm both exist).

REAL-WORLD box: TC26 is Russia's cryptographic standardization body; these are its
post-quantum signature line, paired with GOST Streebog.

HERO — three roles distinct:
  subtitle    : spec label only
  description : Shipovnik and Hypericum run and verified, Streebog in the slots
  why it matters: PQ categories are shared; the primitives inside are national

## §1.5 VISUAL SEMANTICS

green = KAT matches / verify accepts / Stern round passes.  red, sticky = KAT fail
or rejected verify.  alarm = a caught cheating prover reads as the finding, not a
failure of the demo.  highlight = the Streebog slot / the challenged Stern branch.
Icon+text+color; no decorative motion; draw the hypertree and code objects honestly.

## §1.6 EDGE CASES

- Streebog-256 vs -512 and byte/endianness: the top cross-lab consistency hazard
  (must match world-hashes exactly).
- Stern soundness probability per round and repetition count: label it; a reduced
  view must not imply full soundness.
- Hypericum parameter-set names (b_256_64 etc.): pin from the spec; the WOTS/FORS
  wiring is the easy structural error.
- Shipovnik's large signatures: display the real size, don't truncate silently.
- WASM/reference load failure: clear message, never a fake signature.

## §1.7 EXTENSION SEAMS

- A four-way national-suite view alongside quantum-vault-kpqc and tc26 (grep to
  confirm). Mark // [extension].
- Shipovnik's underlying syndrome-decoding hardness as a link to the code-based labs.
- A Hypericum-vs-SPHINCS+C parameter comparison panel.

## VERIFY BEFORE WRITING COPY — do not assert, grep

- grep CATEGORIES; propose from {POST-QUANTUM | SIGNATURES}. Do not state a
  category is new.
- grep the catalog for existing Shipovnik / Hypericum / Stern / code-based-sig /
  SPHINCS coverage and report overlaps before any "first"/"only" phrasing; confirm
  sphincs-ledger and world-hashes exist before linking.
- grep for crypto-lab-tc26-* / crypto-lab-shipovnik-* / crypto-lab-hypericum-*
  collisions before creating.
- Confirm the QApp reference KAT source, the Hypericum parameter-set names, the
  Streebog instantiation, and the Stern/Fiat-Shamir structure against the specs —
  docs are Russian, so verify each rather than inferring from code.

## CI GATES (existing mechanisms — reference, do not reinvent)

- e2e/claims.spec.ts — §4.1b cross-checks (round-trip + KAT; Streebog slot vs
  world-hashes; Stern soundness recomputed), §4.1c mutation discipline, §4.1d the
  signature-size / hash-reduction negative claim.
- §4 axe/WCAG gate. §5 README. §6.1/6.2 dependabot + deploy dispatch.
- §4.1d: no CLAIMS.yaml / THREAT-MODEL.md / second-language verifier.

## CITATIONS (verify each against the primary source before it ships)

- QAPP-tech/shipovnik_tc26 (BSD-2) — Shipovnik reference + KAT.
- QAPP-tech/hypericum_tc26 (BSD-2) — Hypericum reference + KAT.
- The TC26 Shipovnik and Hypericum specifications (Kryptonite/QApp).
- Stern, "A New Identification Scheme Based on Syndrome Decoding," CRYPTO 1993 —
  for the ZK protocol Shipovnik builds on.
- GOST 34.11-2012 (Streebog) — the hash inside Hypericum; consistent with
  crypto-lab-world-hashes.# BUILD BRIEF — crypto-lab-tc26-pair

Binding spec: ./CRYPTO-LAB-TEMPLATE.md (gitignored copy of _MASTER-TEMPLATE.md).
Catalog root CLAUDE.md wins where they touch.
Lifecycle: Build → Teach → Look → Accessibility → README → Deploy.

## KEY FACTS PINNED (verify each before it enters shipped copy)

- Shipovnik and Hypericum are Russian TC26 post-quantum signature schemes,
  developed by Kryptonite/QApp. Open C reference implementations exist under a
  BSD-2 licence: QAPP-tech/shipovnik_tc26 and QAPP-tech/hypericum_tc26. Preserve
  the BSD-2 copyright/attribution on any ported code.
- Shipovnik = Stern's code-based zero-knowledge IDENTIFICATION protocol made
  non-interactive by Fiat-Shamir. Security rests on syndrome decoding (code-based),
  and the signatures are large — the classic Stern-signature tradeoff. Ties to the
  catalog's syndrome / code-based labs (grep to confirm which exist).
- Hypericum = a stateless HASH-based signature in the SPHINCS+ family, instantiated
  over GOST Streebog (GOST 34.11-2012) instead of SHA-2/SHAKE. Param sets look like
  b_256_64 / m_256_20 etc. Ties directly to sphincs-ledger (SLH-DSA) and world-
  hashes (Streebog) — grep to confirm both exist.
- The teaching payload: a national PQ suite mirrors NIST's categories with national
  primitives — Hypericum is "SPHINCS+ but over Streebog," and Shipovnik is a code-
  based ZK signature, an approach NIST did not standardize. Confirm all structural
  claims against the specs; docs are primarily in Russian — verify, don't guess.

## NEW DEMO BRIEF

repo name      : crypto-lab-tc26-pair
short name (H1): TC26 Pair
subtitle       : Shipovnik · Hypericum · Streebog
one-liner      : Russia's two post-quantum signatures — a code-based zero-knowledge
                 scheme and a SPHINCS+-family hash signature built on Streebog.
concept        : Post-quantum categories are universal; the primitives inside them
                 are national. Swap SHA for Streebog and you have Hypericum; take
                 Stern's ZK proof to a signature and you have Shipovnik.
primitives/spec: Shipovnik (Stern + Fiat-Shamir, code-based), Hypericum (stateless
                 hash-based / SPHINCS+ family over GOST Streebog); TC26 specs.
--accent       : #ffb84d   (assigned centrally — do not change here)
favicon        : 🌹
in scope       : Shipovnik sign/verify and Hypericum sign/verify, each KAT-verified
                 against the QApp reference vectors; the Stern ZK round made
                 visible; the Streebog-for-SHA swap in the SPHINCS+ structure shown
                 explicitly; a size/tradeoff comparison against SLH-DSA.
non-goals      : No new hardness claim. No attack. No re-implementation of Streebog
                 internals (that is world-hashes; use it as the hash). No full high-
                 parameter signing in JS if intractable — use the BSD-2 reference
                 (WASM) + KAT vectors. Not a claim of superiority over NIST picks.
                 No political framing beyond neutral provenance.

## §1.1 SCOPE

Three panes.
1. HYPERICUM — sign/verify, KAT-verified; show the SPHINCS+ hypertree with Streebog
   in the hash slots (the national-primitive swap).
2. SHIPOVNIK (HEADLINE) — one Stern zero-knowledge round shown interactively
   (commit / challenge / response, cut-and-choose), then Fiat-Shamir'd into a
   signature; verify.
3. THE MIRROR — the two placed against their NIST analogues (Hypericum↔SLH-DSA;
   code-based ZK as the approach NIST left out), with a signature-size comparison.

## §1.2 SECURITY / CORRECTNESS INVARIANTS (beat features on conflict)

INV-1  Hypericum sign→verify round-trips and matches the QApp reference KAT for a
       named parameter set; Shipovnik sign→verify round-trips and matches its
       reference KAT. Both fixture-pinned; confirm the vector source before pinning.
INV-2  Hypericum's hash slots are Streebog, executed: the page computes a Streebog
       digest inside the structure and it matches world-hashes' Streebog for the
       same input (cross-lab consistency), not asserted.
INV-3  The Stern round is executed: a correct response passes the challenge and a
       cheating prover is caught with the protocol's soundness probability, computed
       from the page's own protocol run.
INV-4  A tampered Hypericum or Shipovnik signature fails verification against the
       real verifier; fail-closed.
INV-5  MUTATION GATE (§4.1c/§4.1d): perturbing the Streebog slot, the hypertree
       wiring, or the Stern challenge logic must make the owning KAT/verify FAIL.
INV-6  NEGATIVE CLAIM (§4.1d): state, tied to a fixture, a real limitation — e.g.
       Shipovnik's large signature size, or "hash-based security reduces to the
       hash, no more" — with the mechanism working AND the limit on screen together.

## §1.3 ARCHITECTURE

ALGORITHM SOURCE (normative):
Port from the BSD-2 QApp references (shipovnik_tc26, hypericum_tc26), compiled to
WASM where JS is intractable, preserving BSD-2 attribution. Hand-roll ONLY the
inspectable teaching pieces: the Stern commit/challenge/response round, and the
SPHINCS+ hypertree view with the Streebog slot exposed. Streebog itself comes from
a named implementation consistent with world-hashes. KAT vectors from the QApp
reference packages are the acceptance test (INV-1). No faked math; if a parameter
set won't run in-browser, use the reference/WASM path and say so on-page. NOTE: the
reference docs are Russian — verify every structural claim against the spec, do not
infer from the code alone.

Modules: src/shipovnik/ (stern round isolated), src/hypericum/ (hypertree + hash
slot isolated), src/ui/. Client-side; WASM allowed. No network backend.

## §1.4 UI

PANE 1 — Hypericum
  Sign a short message, verify; show the hypertree and highlight the Streebog hash
  slots. KAT badge. Plain-language intro ("what hash-based signatures are, why a
  national hash goes in the slot") first.
PANE 2 — Shipovnik (HEADLINE)
  Step one Stern round: prover commits, verifier challenges (three cases), prover
  responds, verifier checks; a cheating prover is caught. Then Fiat-Shamir collapses
  the interaction into a signature. SHOW the cut-and-choose; don't narrate it.
PANE 3 — The Mirror
  Hypericum next to SLH-DSA (same family, different hash); Shipovnik as the code-
  based ZK approach; a signature-size bar chart. Link sphincs-ledger and world-
  hashes (grep to confirm both exist).

REAL-WORLD box: TC26 is Russia's cryptographic standardization body; these are its
post-quantum signature line, paired with GOST Streebog.

HERO — three roles distinct:
  subtitle    : spec label only
  description : Shipovnik and Hypericum run and verified, Streebog in the slots
  why it matters: PQ categories are shared; the primitives inside are national

## §1.5 VISUAL SEMANTICS

green = KAT matches / verify accepts / Stern round passes.  red, sticky = KAT fail
or rejected verify.  alarm = a caught cheating prover reads as the finding, not a
failure of the demo.  highlight = the Streebog slot / the challenged Stern branch.
Icon+text+color; no decorative motion; draw the hypertree and code objects honestly.

## §1.6 EDGE CASES

- Streebog-256 vs -512 and byte/endianness: the top cross-lab consistency hazard
  (must match world-hashes exactly).
- Stern soundness probability per round and repetition count: label it; a reduced
  view must not imply full soundness.
- Hypericum parameter-set names (b_256_64 etc.): pin from the spec; the WOTS/FORS
  wiring is the easy structural error.
- Shipovnik's large signatures: display the real size, don't truncate silently.
- WASM/reference load failure: clear message, never a fake signature.

## §1.7 EXTENSION SEAMS

- A four-way national-suite view alongside quantum-vault-kpqc and tc26 (grep to
  confirm). Mark // [extension].
- Shipovnik's underlying syndrome-decoding hardness as a link to the code-based labs.
- A Hypericum-vs-SPHINCS+C parameter comparison panel.

## VERIFY BEFORE WRITING COPY — do not assert, grep

- grep CATEGORIES; propose from {POST-QUANTUM | SIGNATURES}. Do not state a
  category is new.
- grep the catalog for existing Shipovnik / Hypericum / Stern / code-based-sig /
  SPHINCS coverage and report overlaps before any "first"/"only" phrasing; confirm
  sphincs-ledger and world-hashes exist before linking.
- grep for crypto-lab-tc26-* / crypto-lab-shipovnik-* / crypto-lab-hypericum-*
  collisions before creating.
- Confirm the QApp reference KAT source, the Hypericum parameter-set names, the
  Streebog instantiation, and the Stern/Fiat-Shamir structure against the specs —
  docs are Russian, so verify each rather than inferring from code.

## CI GATES (existing mechanisms — reference, do not reinvent)

- e2e/claims.spec.ts — §4.1b cross-checks (round-trip + KAT; Streebog slot vs
  world-hashes; Stern soundness recomputed), §4.1c mutation discipline, §4.1d the
  signature-size / hash-reduction negative claim.
- §4 axe/WCAG gate. §5 README. §6.1/6.2 dependabot + deploy dispatch.
- §4.1d: no CLAIMS.yaml / THREAT-MODEL.md / second-language verifier.

## CITATIONS (verify each against the primary source before it ships)

- QAPP-tech/shipovnik_tc26 (BSD-2) — Shipovnik reference + KAT.
- QAPP-tech/hypericum_tc26 (BSD-2) — Hypericum reference + KAT.
- The TC26 Shipovnik and Hypericum specifications (Kryptonite/QApp).
- Stern, "A New Identification Scheme Based on Syndrome Decoding," CRYPTO 1993 —
  for the ZK protocol Shipovnik builds on.
- GOST 34.11-2012 (Streebog) — the hash inside Hypericum; consistent with
  crypto-lab-world-hashes.