import {
  BadgeCheck,
  ExternalLink,
  FileSignature,
  GitBranch,
  Hash,
  Menu,
  Play,
  RefreshCw,
  Scale,
  ShieldCheck,
  TriangleAlert,
  createIcons,
} from 'lucide';

import './styles.css';
import { buildTeachingHypertree, type HypertreeNode } from './hypericum/hypertree';
import {
  createSternTranscript,
  deriveFiatShamirChallenge,
  TEACHING_INSTANCE,
  TEACHING_SECRET,
  verifySternOpening,
  type Bit,
  type SternChallenge,
  type SternTranscript,
} from './shipovnik/stern';
import { ReferenceWorkerClient } from './ui/worker-client';

interface ReferenceResult {
  passed?: boolean;
  verified?: boolean;
  accepted?: boolean;
  signatureBytes?: number;
  signatureHash?: string;
  changedByte?: number;
}

type Tone = 'idle' | 'running' | 'pass' | 'fail' | 'alarm';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app mount point');

app.innerHTML = `
  <div class="page-shell">
    <div class="cl-hero">
      <div class="cl-hero-main">
        <h1 class="cl-hero-title">TC26 Pair</h1>
        <p class="cl-hero-sub">Shipovnik &middot; Hypericum &middot; Streebog</p>
        <p class="cl-hero-desc">Run the QApp reference verifiers, open one Stern proof round, and trace Streebog through a Hypericum-style hash tree.</p>
      </div>
      <aside class="cl-hero-why" aria-label="Why it matters">
        <span class="cl-hero-why-label">WHY IT MATTERS</span>
        <p class="cl-hero-why-text">Post-quantum categories cross borders, while implementations and primitives differ. This pair puts a national hash inside a familiar stateless tree and turns a code-based proof into a signature.</p>
      </aside>
    </div>

    <nav class="pane-tabs" role="tablist" aria-label="TC26 signature labs">
      <button class="pane-tab is-active" id="tab-shipovnik" role="tab" aria-selected="true" aria-controls="panel-shipovnik" data-pane="shipovnik">
        <i data-lucide="git-branch" aria-hidden="true"></i><span>Shipovnik</span>
      </button>
      <button class="pane-tab" id="tab-hypericum" role="tab" aria-selected="false" aria-controls="panel-hypericum" data-pane="hypericum" tabindex="-1">
        <i data-lucide="hash" aria-hidden="true"></i><span>Hypericum</span>
      </button>
      <button class="pane-tab" id="tab-mirror" role="tab" aria-selected="false" aria-controls="panel-mirror" data-pane="mirror" tabindex="-1">
        <i data-lucide="scale" aria-hidden="true"></i><span>The Mirror</span>
      </button>
    </nav>

    <section class="pane" id="panel-shipovnik" role="tabpanel" aria-labelledby="tab-shipovnik">
      <div class="pane-heading">
        <div>
          <p class="eyebrow">Code-based zero knowledge</p>
          <h2>Open one branch. Hide the other two.</h2>
          <p class="pane-intro">A prover commits to three linked views of a secret low-weight codeword. The verifier opens one view at random; Fiat-Shamir replaces that live question with a Streebog-derived challenge.</p>
        </div>
        <div class="kat-badge is-running" id="ship-kat-badge" data-state="running" role="status" aria-live="polite">
          <span class="kat-mark">RUN</span><span>QApp KAT loading</span>
        </div>
      </div>

      <div class="stern-workbench">
        <div class="stern-stage">
          <div class="section-label"><span>01</span> Commit</div>
          <div class="commit-grid" id="commit-grid" role="group" aria-label="Three Streebog commitments"></div>
          <button class="button button-secondary" id="new-round" type="button">
            <i data-lucide="refresh-cw" aria-hidden="true"></i><span class="button-label">New commitments</span>
          </button>
        </div>

        <div class="stern-stage">
          <div class="section-label"><span>02</span> Challenge</div>
          <div class="challenge-picker" role="group" aria-label="Choose a Stern challenge">
            <button type="button" class="challenge-button" data-challenge="0" aria-pressed="false"><span>0</span> permutation + mask</button>
            <button type="button" class="challenge-button" data-challenge="1" aria-pressed="false"><span>1</span> permutation + masked secret</button>
            <button type="button" class="challenge-button" data-challenge="2" aria-pressed="false"><span>2</span> two permuted vectors</button>
          </div>
        </div>

        <div class="stern-stage response-stage">
          <div class="section-label"><span>03</span> Response</div>
          <div class="response-copy" id="stern-response">The commitments are sealed. Choose one branch for the verifier to open.</div>
          <div class="status status-idle" id="stern-status" role="status" aria-live="polite">
            <span class="status-mark">WAIT</span>
            <span><strong>No challenge checked</strong><small>The unopened branches remain hidden.</small></span>
          </div>
        </div>
      </div>

      <div class="proof-actions" role="group" aria-label="Stern proof actions">
        <button class="button button-primary" id="fiat-shamir" type="button">
          <i data-lucide="shield-check" aria-hidden="true"></i><span class="button-label">Derive Fiat-Shamir challenge</span>
        </button>
        <button class="button button-warning" id="run-cheater" type="button">
          <i data-lucide="triangle-alert" aria-hidden="true"></i><span class="button-label">Test a prover without the witness</span>
        </button>
      </div>
      <p class="scope-note">Teaching round: <code>n = 12</code>, weight <code>3</code>. QApp reference: <code>n = 2,896</code>, weight <code>318</code>, repeated <code>219</code> times.</p>

      <section class="cheat-result" id="cheat-result" aria-labelledby="cheat-title">
        <div>
          <p class="eyebrow" id="cheat-title">Cut and choose</p>
          <p id="cheat-summary">Run the witness-free prover to measure which openings survive.</p>
        </div>
        <div class="branch-outcomes" id="branch-outcomes"></div>
        <div class="soundness-metric">
          <span>caught per round</span>
          <strong id="caught-probability">not measured</strong>
          <small id="repeated-soundness">The full reference scheme repeats 219 rounds.</small>
        </div>
      </section>

      <section class="reference-console" aria-labelledby="ship-reference-title">
        <div class="console-heading">
          <div>
            <p class="eyebrow">Full reference path</p>
            <h3 id="ship-reference-title">Shipovnik sign / verify</h3>
          </div>
          <span class="runtime-chip">QApp C &rarr; WASM</span>
        </div>
        <label for="ship-message">Message</label>
        <textarea id="ship-message" rows="3" maxlength="160">test test test</textarea>
        <div class="button-row">
          <button class="button button-primary" id="ship-sign" type="button"><i data-lucide="file-signature" aria-hidden="true"></i><span class="button-label">Sign and verify</span></button>
          <button class="button button-danger" id="ship-tamper" type="button" disabled><i data-lucide="triangle-alert" aria-hidden="true"></i><span class="button-label">Change one signature byte</span></button>
        </div>
        <div class="status status-running" id="ship-result" role="status" aria-live="polite">
          <span class="status-mark">RUN</span><span><strong>Checking fixture</strong><small>The real verifier is loading in a worker.</small></span>
        </div>
        <div class="negative-claim" data-negative-claim="shipovnik-size">
          <strong>VALID, AND 805,868 BYTES.</strong>
          <span>The pinned signature works; correctness does not make the Stern transcript small. The API reserves up to 1,072,662 bytes.</span>
        </div>
      </section>
    </section>

    <section class="pane" id="panel-hypericum" role="tabpanel" aria-labelledby="tab-hypericum" hidden>
      <div class="pane-heading">
        <div>
          <p class="eyebrow">Stateless hash-based signature</p>
          <h2>Keep the tree. Change the hash slots.</h2>
          <p class="pane-intro">Hash-based signatures authenticate one-time keys through Merkle trees. Hypericum uses the SPHINCS+ family shape, with GOST Streebog filling the compression and message-hash roles.</p>
        </div>
        <div class="kat-badge is-running" id="hyper-kat-badge" data-state="running" role="status" aria-live="polite">
          <span class="kat-mark">RUN</span><span>QApp KAT loading</span>
        </div>
      </div>

      <div class="hyper-layout">
        <section class="tree-lab" aria-labelledby="tree-title">
          <div class="section-label"><span>Executed slice</span> Streebog-256</div>
          <h3 id="tree-title">A four-leaf Merkle slice</h3>
          <label for="hyper-message">Message entering the teaching slice</label>
          <textarea id="hyper-message" rows="3" maxlength="160">National primitives, shared post-quantum structure</textarea>
          <div class="tree-canvas" id="tree-canvas" role="group" aria-label="Computed Streebog Merkle tree"></div>
          <div class="hash-inspector">
            <span class="hash-inspector-label" id="hash-node-label">Selected hash slot</span>
            <div class="code-pair">
              <div><span>input bytes</span><code id="hash-input" tabindex="0" role="region" aria-label="Selected hash input"></code></div>
              <div><span>Streebog-256</span><code id="hash-output" tabindex="0" role="region" aria-label="Selected hash output"></code></div>
            </div>
          </div>
          <p class="scope-note">This four-leaf tree executes the hash-and-wire mechanism. The full <code>m_128_20</code> signer below runs QApp's 20-level, two-layer construction.</p>
        </section>

        <aside class="structure-map" aria-labelledby="structure-title">
          <p class="eyebrow">m_128_20 structure</p>
          <h3 id="structure-title">Where Streebog runs</h3>
          <ol class="flow-list" role="list">
            <li role="listitem"><span class="flow-node">message</span><span class="flow-hash">Streebog-512</span></li>
            <li role="listitem"><span class="flow-node">13 FORS+C trees, height 11</span><span class="flow-hash">Streebog-256</span></li>
            <li role="listitem"><span class="flow-node">WOTS+C chains, w = 16</span><span class="flow-hash">Streebog-256</span></li>
            <li role="listitem"><span class="flow-node">XMSS layer 0, height 10</span><span class="flow-hash">Streebog-256</span></li>
            <li role="listitem"><span class="flow-node">XMSS layer 1, height 10</span><span class="flow-hash">Streebog-256</span></li>
            <li role="listitem"><span class="flow-node">public root</span></li>
          </ol>
        </aside>
      </div>

      <section class="reference-console" aria-labelledby="hyper-reference-title">
        <div class="console-heading">
          <div>
            <p class="eyebrow">Full reference path</p>
            <h3 id="hyper-reference-title">Hypericum sign / verify</h3>
          </div>
          <span class="runtime-chip">m_128_20 &middot; QApp C &rarr; WASM</span>
        </div>
        <p class="performance-note"><strong>Portable reference build:</strong> measured cold/warm fixture runs took 11&ndash;83 seconds; signing runs in a worker so the page remains usable.</p>
        <div class="button-row">
          <button class="button button-primary" id="hyper-sign" type="button"><i data-lucide="file-signature" aria-hidden="true"></i><span class="button-label">Sign and verify this message</span></button>
          <button class="button button-danger" id="hyper-tamper" type="button" disabled><i data-lucide="triangle-alert" aria-hidden="true"></i><span class="button-label">Change one signature byte</span></button>
        </div>
        <div class="status status-running" id="hyper-result" role="status" aria-live="polite">
          <span class="status-mark">RUN</span><span><strong>Checking fixture</strong><small>The real verifier is loading in a worker.</small></span>
        </div>
        <div class="negative-claim" data-negative-claim="hash-reduction">
          <strong>VALID, WITH A LIMIT.</strong>
          <span>The fixture verifies, but a hash-based construction inherits the security limits of its hash and parameter choices; a green signature proves no more.</span>
        </div>
      </section>
    </section>

    <section class="pane" id="panel-mirror" role="tabpanel" aria-labelledby="tab-mirror" hidden>
      <div class="pane-heading">
        <div>
          <p class="eyebrow">Two categories, one comparison</p>
          <h2>The structures travel. The primitives change.</h2>
          <p class="pane-intro">Hypericum occupies the stateless hash-signature lane beside SLH-DSA. Shipovnik takes a different route: repeated zero-knowledge proofs of knowledge for a syndrome-decoding witness.</p>
        </div>
      </div>

      <div class="mirror-grid">
        <article class="mirror-item">
          <span class="mirror-label">Hash-based</span>
          <h3>Hypericum</h3>
          <p>FORS+C, WOTS+C, and a hypertree, with Streebog-256/512 in the hash roles.</p>
          <span class="mirror-peer">Nearest NIST mirror: SLH-DSA</span>
        </article>
        <article class="mirror-item">
          <span class="mirror-label">Code-based ZK</span>
          <h3>Shipovnik</h3>
          <p>Stern commitments, one of three challenges, repeated and made non-interactive with Fiat-Shamir.</p>
          <span class="mirror-peer">No code-based signature was selected in NIST's first PQC standards.</span>
        </article>
      </div>

      <section class="size-section" aria-labelledby="size-title">
        <div class="section-label"><span>Bytes on the wire</span> logarithmic scale</div>
        <h3 id="size-title">Signature size changes the engineering</h3>
        <div class="size-chart" role="img" aria-label="Logarithmic comparison of signature byte sizes">
          <div class="size-row"><span>SLH-DSA-SHA2-128s</span><div class="bar-track"><span class="bar bar-slh" style="--bar-size: 45%"></span></div><strong>7,856 B</strong></div>
          <div class="size-row"><span>Hypericum m_128_20</span><div class="bar-track"><span class="bar bar-hyper" style="--bar-size: 49%"></span></div><strong>9,772 B</strong></div>
          <div class="size-row"><span>Shipovnik fixture</span><div class="bar-track"><span class="bar bar-ship" style="--bar-size: 94%"></span></div><strong>805,868 B</strong></div>
          <div class="size-row"><span>Shipovnik maximum</span><div class="bar-track"><span class="bar bar-max" style="--bar-size: 100%"></span></div><strong>1,072,662 B</strong></div>
        </div>
        <p class="chart-source">SLH-DSA-SHA2-128s size: FIPS 205. Hypericum and Shipovnik sizes: pinned QApp fixtures in this repository.</p>
      </section>

      <aside class="real-world" aria-labelledby="real-world-title">
        <div><p class="eyebrow">Real-world context</p><h3 id="real-world-title">TC26 and national primitives</h3></div>
        <p>TC26 is Russia's cryptographic standardization body. These proposals pair post-quantum signature structures with GOST Streebog, while the reference implementations used here were published by QApp under BSD-2-Clause terms.</p>
      </aside>

      <nav class="related-links" aria-label="Related Crypto Lab demos">
        <a href="https://systemslibrarian.github.io/crypto-lab-sphincs-ledger/" target="_blank" rel="noopener">SLH-DSA in Sphincs Ledger <i data-lucide="external-link" aria-hidden="true"></i></a>
        <a href="https://systemslibrarian.github.io/crypto-lab-world-hashes/" target="_blank" rel="noopener">Streebog in World Hashes <i data-lucide="external-link" aria-hidden="true"></i></a>
      </nav>

      <details class="sources">
        <summary>Sources and scope</summary>
        <ul>
          <li><a href="https://github.com/QAPP-tech/shipovnik_tc26" target="_blank" rel="noopener">QAPP-tech/shipovnik_tc26</a>, pinned at <code>a9139ef</code>.</li>
          <li><a href="https://github.com/QAPP-tech/hypericum_tc26" target="_blank" rel="noopener">QAPP-tech/hypericum_tc26</a>, pinned at <code>f3f2540</code>.</li>
          <li><a href="https://www.rfc-editor.org/rfc/rfc6986" target="_blank" rel="noopener">RFC 6986 / GOST R 34.11-2012</a> for Streebog.</li>
          <li>Stern, <cite>A New Identification Scheme Based on Syndrome Decoding</cite>, CRYPTO 1993.</li>
          <li><a href="./THIRD_PARTY_NOTICES.txt">BSD-2 attribution for the compiled reference code</a>.</li>
        </ul>
        <p>This is not production crypto. The signers and verifiers are compiled reference C; the reduced Stern round and four-leaf Merkle slice are inspectable teaching models. The page does not make a new hardness claim, implement Streebog internals, or claim superiority over NIST selections.</p>
      </details>
    </section>
  </div>
`;

createIcons({
  icons: {
    BadgeCheck,
    ExternalLink,
    FileSignature,
    GitBranch,
    Hash,
    Menu,
    Play,
    RefreshCw,
    Scale,
    ShieldCheck,
    TriangleAlert,
  },
});

const shipWorker = new ReferenceWorkerClient(
  new Worker(new URL('./shipovnik/worker.ts', import.meta.url), { type: 'module' }),
);
const hyperWorker = new ReferenceWorkerClient(
  new Worker(new URL('./hypericum/worker.ts', import.meta.url), { type: 'module' }),
);

function element<ElementType extends HTMLElement>(selector: string): ElementType {
  const found = document.querySelector<ElementType>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat('en-US').format(bytes);
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

function setStatus(selector: string, tone: Tone, title: string, detail: string): void {
  const status = element<HTMLElement>(selector);
  status.className = `status status-${tone}`;
  status.dataset.tone = tone;
  const mark = status.querySelector<HTMLElement>('.status-mark');
  const strong = status.querySelector<HTMLElement>('strong');
  const small = status.querySelector<HTMLElement>('small');
  if (mark) mark.textContent = tone === 'pass' ? 'PASS' : tone === 'fail' ? 'FAIL' : tone === 'alarm' ? 'CAUGHT' : tone === 'running' ? 'RUN' : 'WAIT';
  if (strong) strong.textContent = title;
  if (small) small.textContent = detail;
}

function setKat(selector: string, state: 'running' | 'pass' | 'fail', label: string): void {
  const badge = element<HTMLElement>(selector);
  badge.className = `kat-badge is-${state}`;
  badge.dataset.state = state;
  const mark = badge.querySelector<HTMLElement>('.kat-mark');
  const text = badge.querySelector<HTMLElement>('span:last-child');
  if (mark) mark.textContent = state === 'pass' ? 'PASS' : state === 'fail' ? 'FAIL' : 'RUN';
  if (text) text.textContent = label;
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean, busyLabel: string): void {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  const label = button.querySelector<HTMLElement>('.button-label');
  if (!label) return;
  if (busy) {
    button.dataset.idleLabel = label.textContent ?? '';
    label.textContent = busyLabel;
  } else if (button.dataset.idleLabel) {
    label.textContent = button.dataset.idleLabel;
    delete button.dataset.idleLabel;
  }
}

function setupTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const activate = (tab: HTMLButtonElement): void => {
    for (const candidate of tabs) {
      const active = candidate === tab;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-selected', String(active));
      candidate.tabIndex = active ? 0 : -1;
      const panel = element<HTMLElement>(`#${candidate.getAttribute('aria-controls') ?? ''}`);
      panel.hidden = !active;
    }
    tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (offset !== 0) {
        event.preventDefault();
        activate(tabs[(index + offset + tabs.length) % tabs.length]);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        activate(event.key === 'Home' ? tabs[0] : tabs[tabs.length - 1]);
      }
    });
  });
}

const fixedMask: Bit[] = [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1];
const fixedPermutation = [4, 9, 1, 7, 3, 11, 0, 8, 5, 2, 10, 6];
let sternTranscript: SternTranscript;

function randomBitVector(length: number): Bit[] {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => (value & 1) as Bit);
}

function randomPermutation(length: number): number[] {
  const permutation = Array.from({ length }, (_, index) => index);
  const random = crypto.getRandomValues(new Uint32Array(length));
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = random[index] % (index + 1);
    [permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]];
  }
  return permutation;
}

function renderCommitments(): void {
  const commitments = [
    ['C0', 'permutation + syndrome', sternTranscript.commitments.permutationAndSyndrome],
    ['C1', 'permuted mask', sternTranscript.commitments.permutedMask],
    ['C2', 'permuted masked secret', sternTranscript.commitments.permutedMaskedSecret],
  ];
  const grid = element<HTMLElement>('#commit-grid');
  grid.replaceChildren(...commitments.map(([name, label, digest]) => {
    const item = document.createElement('div');
    item.className = 'commitment';
    const title = document.createElement('strong');
    title.textContent = name;
    const description = document.createElement('span');
    description.textContent = label;
    const code = document.createElement('code');
    code.textContent = shortHash(digest);
    item.append(title, description, code);
    return item;
  }));
}

function newSternRound(): void {
  sternTranscript = createSternTranscript(
    TEACHING_INSTANCE,
    TEACHING_SECRET,
    randomBitVector(TEACHING_SECRET.length),
    randomPermutation(TEACHING_SECRET.length),
  );
  renderCommitments();
  document.querySelectorAll<HTMLButtonElement>('[data-challenge]').forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
  });
  element<HTMLElement>('#stern-response').textContent = 'The commitments are sealed. Choose one branch for the verifier to open.';
  setStatus('#stern-status', 'idle', 'No challenge checked', 'The unopened branches remain hidden.');
}

function inspectChallenge(challenge: SternChallenge, source: 'verifier' | 'fiat-shamir'): void {
  document.querySelectorAll<HTMLButtonElement>('[data-challenge]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.challenge) === challenge));
  });
  const opening = sternTranscript.openings[challenge];
  const accepted = verifySternOpening(TEACHING_INSTANCE, sternTranscript.commitments, opening);
  const descriptions = [
    'Opened the permutation and random mask; C0 and C1 recompute.',
    'Opened the permutation and masked secret; the public syndrome repairs C0 and C2 recomputes.',
    'Opened both permuted vectors; C1 and C2 recompute and the secret keeps weight 3.',
  ];
  element<HTMLElement>('#stern-response').textContent = `${source === 'fiat-shamir' ? 'Streebog selected' : 'Verifier selected'} branch ${challenge}. ${descriptions[challenge]}`;
  setStatus(
    '#stern-status',
    accepted ? 'pass' : 'fail',
    accepted ? `Challenge ${challenge} accepted` : `Challenge ${challenge} rejected`,
    accepted ? 'Two commitments opened consistently; one remains hidden.' : 'The opened values do not match the sealed commitments.',
  );
}

function runCheatingProver(): void {
  const fakeSecret: Bit[] = [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  const transcript = createSternTranscript(
    TEACHING_INSTANCE,
    fakeSecret,
    fixedMask,
    fixedPermutation,
  );
  const outcomes = ([0, 1, 2] as SternChallenge[]).map((challenge) => ({
    challenge,
    accepted: verifySternOpening(TEACHING_INSTANCE, transcript.commitments, transcript.openings[challenge]),
  }));
  const passed = outcomes.filter((outcome) => outcome.accepted).length;
  const caughtPerRound = (outcomes.length - passed) / outcomes.length;
  const repeatedEscape = (passed / outcomes.length) ** 219;
  const list = element<HTMLElement>('#branch-outcomes');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Cheating prover outcomes');
  list.replaceChildren(...outcomes.map((outcome) => {
    const item = document.createElement('div');
    item.className = `branch-outcome ${outcome.accepted ? 'is-pass' : 'is-caught'}`;
    item.setAttribute('role', 'listitem');
    item.textContent = `Branch ${outcome.challenge}: ${outcome.accepted ? 'opens' : 'caught'}`;
    return item;
  }));
  element<HTMLElement>('#cheat-summary').textContent = `This transcript has the right weight but the wrong public syndrome. It can answer ${passed} of ${outcomes.length} challenges.`;
  element<HTMLElement>('#caught-probability').textContent = `${outcomes.length - passed}/${outcomes.length} = ${(caughtPerRound * 100).toFixed(1)}%`;
  element<HTMLElement>('#repeated-soundness').textContent = `Computed escape chance across 219 independent rounds: ${repeatedEscape.toExponential(2)}.`;
  element<HTMLElement>('#cheat-result').classList.add('has-result');
}

function setupStern(): void {
  newSternRound();
  element<HTMLButtonElement>('#new-round').addEventListener('click', newSternRound);
  document.querySelectorAll<HTMLButtonElement>('[data-challenge]').forEach((button) => {
    button.addEventListener('click', () => inspectChallenge(Number(button.dataset.challenge) as SternChallenge, 'verifier'));
  });
  element<HTMLButtonElement>('#fiat-shamir').addEventListener('click', () => {
    const message = element<HTMLTextAreaElement>('#ship-message').value;
    inspectChallenge(deriveFiatShamirChallenge(message, sternTranscript.commitments), 'fiat-shamir');
  });
  element<HTMLButtonElement>('#run-cheater').addEventListener('click', runCheatingProver);
}

function renderTree(message: string): void {
  const tree = buildTeachingHypertree(message);
  const canvas = element<HTMLElement>('#tree-canvas');
  const rows: HypertreeNode[][] = [[tree.root], tree.parents, tree.leaves];
  const selectNode = (node: HypertreeNode, button: HTMLButtonElement): void => {
    canvas.querySelectorAll<HTMLButtonElement>('.tree-node').forEach((candidate) => candidate.setAttribute('aria-pressed', 'false'));
    button.setAttribute('aria-pressed', 'true');
    element<HTMLElement>('#hash-node-label').textContent = `${node.label} input and digest`;
    element<HTMLElement>('#hash-input').textContent = node.inputHex;
    element<HTMLElement>('#hash-output').textContent = node.digestHex;
  };
  const fragments = rows.map((nodes, rowIndex) => {
    const row = document.createElement('div');
    row.className = `tree-row tree-row-${rowIndex}`;
    for (const node of nodes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tree-node';
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<span>${node.label}</span><code>${shortHash(node.digestHex)}</code><small>Streebog-256</small>`;
      button.addEventListener('click', () => selectNode(node, button));
      row.append(button);
    }
    return row;
  });
  canvas.replaceChildren(...fragments);
  const rootButton = canvas.querySelector<HTMLButtonElement>('.tree-node');
  if (rootButton) selectNode(tree.root, rootButton);
}

function setupTree(): void {
  const input = element<HTMLTextAreaElement>('#hyper-message');
  let renderTimer = 0;
  renderTree(input.value);
  input.addEventListener('input', () => {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => renderTree(input.value), 120);
  });
}

async function initializeShipovnik(): Promise<void> {
  try {
    const result = await shipWorker.request<ReferenceResult>({ action: 'kat' });
    if (!result.passed || !result.verified || !result.signatureHash || !result.signatureBytes) {
      throw new Error('Fixture digest or verifier result did not match');
    }
    setKat('#ship-kat-badge', 'pass', 'QApp KAT matches');
    setStatus('#ship-result', 'pass', 'Fixture signature accepted', `${formatBytes(result.signatureBytes)} bytes, SHA-256 ${shortHash(result.signatureHash)}.`);
    element<HTMLButtonElement>('#ship-tamper').disabled = false;
  } catch (error) {
    setKat('#ship-kat-badge', 'fail', 'QApp KAT failed');
    setStatus('#ship-result', 'fail', 'Reference path unavailable', error instanceof Error ? error.message : String(error));
  }
}

async function initializeHypericum(): Promise<void> {
  try {
    const result = await hyperWorker.request<ReferenceResult>({ action: 'kat' });
    if (!result.passed || !result.verified || !result.signatureHash || !result.signatureBytes) {
      throw new Error('Fixture digest or verifier result did not match');
    }
    setKat('#hyper-kat-badge', 'pass', 'QApp KAT matches');
    setStatus('#hyper-result', 'pass', 'Fixture signature accepted', `${formatBytes(result.signatureBytes)} bytes, SHA-256 ${shortHash(result.signatureHash)}.`);
    element<HTMLButtonElement>('#hyper-tamper').disabled = false;
  } catch (error) {
    setKat('#hyper-kat-badge', 'fail', 'QApp KAT failed');
    setStatus('#hyper-result', 'fail', 'Reference path unavailable', error instanceof Error ? error.message : String(error));
  }
}

function setupReferenceControls(): void {
  const shipInput = element<HTMLTextAreaElement>('#ship-message');
  const shipSign = element<HTMLButtonElement>('#ship-sign');
  const shipTamper = element<HTMLButtonElement>('#ship-tamper');
  let shipBoundMessage = shipInput.value;
  shipInput.addEventListener('input', () => {
    if (shipInput.value === shipBoundMessage) return;
    shipTamper.disabled = true;
    setStatus('#ship-result', 'idle', 'Previous verdict retired', 'Sign the current message before testing its signature.');
  });
  shipSign.addEventListener('click', async () => {
    setButtonBusy(shipSign, true, 'Signing...');
    shipTamper.disabled = true;
    setStatus('#ship-result', 'running', 'Signing with QApp WASM', 'Generating 219 commitment rounds and checking the result.');
    try {
      const result = await shipWorker.request<ReferenceResult>({ action: 'sign', message: shipInput.value });
      if (!result.verified || !result.signatureHash || !result.signatureBytes) throw new Error('The generated signature did not verify');
      shipBoundMessage = shipInput.value;
      setStatus('#ship-result', 'pass', 'Signature accepted', `${formatBytes(result.signatureBytes)} bytes, SHA-256 ${shortHash(result.signatureHash)}.`);
      shipTamper.disabled = false;
    } catch (error) {
      setStatus('#ship-result', 'fail', 'Signing failed', error instanceof Error ? error.message : String(error));
    } finally {
      setButtonBusy(shipSign, false, 'Signing...');
    }
  });
  shipTamper.addEventListener('click', async () => {
    shipTamper.disabled = true;
    setStatus('#ship-result', 'running', 'Verifying changed signature', 'Byte 42,048 has been flipped inside the response section.');
    try {
      const result = await shipWorker.request<ReferenceResult>({ action: 'tamper' });
      setStatus(
        '#ship-result',
        result.accepted ? 'fail' : 'fail',
        result.accepted ? 'Unsafe acceptance' : 'Changed signature rejected',
        result.accepted ? 'The verifier accepted modified bytes.' : `The real verifier rejected the change at byte ${formatBytes(result.changedByte ?? 0)}.`,
      );
    } catch (error) {
      setStatus('#ship-result', 'fail', 'Verification failed closed', error instanceof Error ? error.message : String(error));
    }
  });

  const hyperInput = element<HTMLTextAreaElement>('#hyper-message');
  const hyperSign = element<HTMLButtonElement>('#hyper-sign');
  const hyperTamper = element<HTMLButtonElement>('#hyper-tamper');
  let hyperBoundMessage = hyperInput.value;
  hyperInput.addEventListener('input', () => {
    if (hyperInput.value === hyperBoundMessage) return;
    hyperTamper.disabled = true;
    setStatus('#hyper-result', 'idle', 'Previous verdict retired', 'Sign the current message before testing its signature.');
  });
  hyperSign.addEventListener('click', async () => {
    setButtonBusy(hyperSign, true, 'Signing in worker...');
    hyperTamper.disabled = true;
    setStatus('#hyper-result', 'running', 'Signing with QApp WASM', 'Portable Streebog tree traversal is running off the main thread.');
    try {
      const result = await hyperWorker.request<ReferenceResult>({ action: 'sign', message: hyperInput.value });
      if (!result.verified || !result.signatureHash || !result.signatureBytes) throw new Error('The generated signature did not verify');
      hyperBoundMessage = hyperInput.value;
      setStatus('#hyper-result', 'pass', 'Signature accepted', `${formatBytes(result.signatureBytes)} bytes, SHA-256 ${shortHash(result.signatureHash)}.`);
      hyperTamper.disabled = false;
    } catch (error) {
      setStatus('#hyper-result', 'fail', 'Signing failed', error instanceof Error ? error.message : String(error));
    } finally {
      setButtonBusy(hyperSign, false, 'Signing in worker...');
    }
  });
  hyperTamper.addEventListener('click', async () => {
    hyperTamper.disabled = true;
    setStatus('#hyper-result', 'running', 'Verifying changed signature', 'Byte 48 has been flipped inside the signature.');
    try {
      const result = await hyperWorker.request<ReferenceResult>({ action: 'tamper' });
      setStatus(
        '#hyper-result',
        'fail',
        result.accepted ? 'Unsafe acceptance' : 'Changed signature rejected',
        result.accepted ? 'The verifier accepted modified bytes.' : `The real verifier rejected the change at byte ${result.changedByte ?? 0}.`,
      );
    } catch (error) {
      setStatus('#hyper-result', 'fail', 'Verification failed closed', error instanceof Error ? error.message : String(error));
    }
  });
}

setupTabs();
setupStern();
setupTree();
setupReferenceControls();
void initializeShipovnik();
void initializeHypericum();