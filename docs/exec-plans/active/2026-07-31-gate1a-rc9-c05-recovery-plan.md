# Gate 1A RC9 C05 recovery plan proposal v0.3

Status: `PROPOSED_UNAUTHORIZED`

This file is a pre-authority proposal only. It is not a repository plan,
`plan_ref`, source commit, candidate attempt, evidence namespace, or permission
to run any numbered sample.

## 1. Trigger and frozen outcome

C04 ended at its sole authorized P07 execution:

- remote rejection commit:
  `d9b0d6a3c3d333011a4bef34d0bc91ee17c96b40`;
- remote tree:
  `5d9c124dff7984da20241a3596c3f90e49c4251a`;
- rejection record SHA-256:
  `34386e1021450d727cc9429930f543cc76fe59e26363786e2ce04d685d95b121`;
- P07 execution-failure SHA-256:
  `700997861cb93de9e8fef240d728bbd2ff9d78c39dba6366085c3f26d1e828cf`;
- Issue #58 registration:
  `https://github.com/KG9750/New-Era-2/issues/58#issuecomment-5141068711`.

The following state is immutable:

- `C04=REJECTED_PRE_DIAGNOSTIC`;
- `P07=TECHNICAL_EXECUTION_FAILURE_CONSUMED`;
- `P08=NOT_STARTED_CONSUMED_BY_ATTEMPT_FAILURE`;
- `D16-D20=NOT_STARTED_CONSUMED_BY_ATTEMPT_FAILURE`;
- `CM01=UNALLOCATED`;
- `Gate 1H=PENDING`;
- `Gate 2=LOCKED`;
- `output_ref=UNSET`.

C04, P07/P08, and D16-D20 must never be rerun, deleted, repaired, re-signed,
or reused.

## 2. Proposed C05 namespace

If separately authorized after this proposal is frozen:

| Object | Proposed identity |
|---|---|
| candidate attempt | `C05` |
| build ID | `g1-rc-20260731.rc9-c05` |
| anti-pass | `TECH-RC9-P09`, `TECH-RC9-P10` |
| blind diagnostics | `TECH-RC9-D21` through `TECH-RC9-D25` |
| first candidate manifest, if later earned | `CM01` |
| authority profile | `rc9-v03-c05` |
| Phase 6 root | `candidates/C05/evidence/phase6-01` |

`phase6-01` is a fresh C05 namespace, not C04 `retry-04`.

P09/P10 and D21-D25 are permanently excluded from the Gate 1A and Gate 1H
formal denominators.

## 3. Authority topology

The proposed topology is:

```text
R = d9b0d6a3...  C04 rejection baseline
  -> P5          C05 plan-only commit
P5 -> X5         C05 executable-contract-only commit

X5 -> S5         C05 source commit
X5 -> I5         C05 dependency integration commit with source blobs identical to S5
I5 -> E5         C05 Phase 6 / anti-pass / diagnostics evidence commits
```

Rules:

1. `P5` contains only the authorized C05 plan file.
2. `X5` contains only an Owner-hash-bound executable-contract amendment to
   this plan. It must freeze all exact values listed in sections 5 through 7
   and cannot create C05/P09/P10/D21-D25 directories, source, runtime, build,
   evidence, or authority outputs.
3. Neither `P5` nor `X5` authorizes `S5`, `I5`, or execution. A later
   `C05_IMPLEMENTATION_AUTHORITY` must bind the reviewed `X5` commit.
4. `S5` and `I5` must have identical blob IDs and modes for every C05 source
   allowlist path.
5. C01-C04, all prior P/D samples, all failed Phase 6 roots, and all rejection
   records remain byte-for-byte immutable.
6. Artifact metadata binds to `S5`; integration evidence binds separately to
   `I5`.
7. No evidence commit may be used as `sourceSha`.
8. `E5`, `CM01`, review, seal, and `output_ref` remain unset until their own
   gates are satisfied.

## 4. Root-cause separation

C04 did not expose a gameplay/runtime defect. It exposed an execution-transport
defect:

- shell Playwright `chromium.launch()` failed before browser context creation
  because the cached headless shell could not load ICU data;
- shell Playwright `channel=chrome` also terminated under the same sandbox
  process boundary;
- the C04 runtime artifact, Phase 6, authority, and runtime-equivalence evidence
  remain historically valid but do not admit C04.

C05 must not treat the transport defect as permission to weaken anti-pass,
capture, ledger, isolation, or no-rerun contracts.

## 5. Frozen browser transport proposal

Before any C05 numbered namespace is created, C05 proposes to freeze the
existing Playwright MCP channel already named by the diagnostic contract.

Readiness probes completed outside every canonical candidate/sample namespace:

1. in-app Browser opened and closed a `data:` page successfully;
2. in-app Browser loaded a scratch loopback capture host at
   `http://127.0.0.1:4210/`;
3. the page exposed the expected fixed-session entry UI;
4. the only console error was a non-functional `/favicon.ico` 404;
5. `browser_run_code_unsafe` saved a scratch download to
   `/private/tmp/c05-browser-preflight-download.txt`;
6. shell verification observed exactly 17 bytes:
   `pass-c05-download`.

The Owner-hash-bound `X5` amendment must freeze, before any implementation or
namespace creation:

- separate complete transport profiles for P09/P10 and D21-D25;
- one exact Browser/Playwright MCP package name, resolved version, integrity,
  server argv, tool namespace, and inventory for each profile;
- one browser, context, page, origin, and application session per sample;
- exact P09/P10 tool allowlist and arguments;
- exact C05 versions of both diagnostic unsafe-code blocks, their SHA-256
  values, and all C05 cookie/session/error identities;
- exact production origin and exact download `saveAs` canonical paths;
- capture-host start/stop and no-concurrent-session checks;
- a zero-output transport preflight that runs before creating each numbered
  sample root.

The following remain prohibited:

- shell `chromium.launch()` or `channel=chrome`;
- Computer Use;
- Chrome plugin;
- an unreviewed browser provider;
- changing transport after a numbered namespace has been created;
- calling shell, Git, files, Issue, plan, thresholds, or other samples from a
  player diagnostic.

## 6. C05 source work

The C05 source implementation must be test-first and limited to the complete,
duplicate-free exact-path allowlist and A/M rule for each path frozen by `X5`.
A mechanical diff guard must reject every path outside that table. It must:

1. add an exact attempt mapping:
   - C05/P09 = prominent-CTA/repeat-submit, W1/W2 `1/1`;
   - C05/P10 = minimal-intervention/invalid-consequence, W1/W2 `0/0`;
   - C05 diagnostics = D21-D25;
2. reject P07/P08 or D16-D20 being rebound to C05;
3. accept `candidateAttempt=C05` only with the C05 authority profile and exact
   source/integration/build identities;
4. update production manifest and fixture validators together;
5. add valid C05 fixtures and cross-attempt rejection fixtures;
6. deep-verify raw, sidecar, receipt, browser download, host validation, ledger
   validation, per-week terminal counts, repeat-submit deltas, no-clobber, and
   denominator exclusions;
7. extend frozen-evidence guards so C04 rejection evidence is immutable;
8. retain scenario `0.5.1`, protocol
   `weekly-management-slice-playtest-v0.3`, schema `gate1-playtest-v2`, and the
   existing gameplay/ledger semantics;
9. prove runtime equivalence to the frozen C03 artifact, allowing only C05
   build/source metadata to differ;
10. create a new source SHA and a distinct dependency integration SHA.

No gameplay, balance, UI, scenario, protocol, schema, Gate threshold, or
formal-denominator change is authorized.

## 7. Node and Phase 6 preflight

`X5` must freeze one executable Node 24 identity that is actually runnable in
the execution environment, including:

- absolute path and resolved real path;
- exact version;
- binary SHA-256;
- exact process-local `PATH`;
- one complete, ordered command table with command IDs, exact argv, working
  directory, environment, canonical output and sidecar paths, expected exit,
  and a rule rejecting missing, reordered, repeated, or extra commands;
- source/integration Git binding.

Before any `phase6-01` output is created:

1. run zero-output syntax/module/browser-transport probes;
2. run lint and the complete test suite directly in a scratch clone;
3. prove the C05 root, P09/P10 roots, and all D21-D25 roots are absent;
4. prove the worktree and authority bindings are clean;
5. prove C01-C04 frozen guards pass.

The one-shot allocation and consumption state machine must be frozen in `X5`
and is already normatively constrained as follows:

1. Issuing `C05_IMPLEMENTATION_AUTHORITY` creates the C05 attempt and
   atomically allocates P09/P10/D21-D25. Every ID initially has state
   `ALLOCATED_NOT_STARTED_LOCKED`; allocation does not mean that a sample has
   started or been consumed.
2. Phase 6 consumes its authority at the first invocation of its zero-output
   identity/module/transport preflight, before any canonical output exists.
3. After Phase 6 and all required reviews pass, P09 alone becomes
   `ALLOCATED_NOT_STARTED_ELIGIBLE`. Each later sample becomes eligible only
   after its exact predecessor is complete, sealed, committed, pushed, and
   remotely verified as required by sections 8 and 9.
4. The first transport-preflight tool call, capture-host or CLI-process start,
   canonical-root create attempt, or application-session create attempt for a
   sample, whichever occurs first, consumes that sample and changes only that
   ID to `STARTED_CONSUMED`. At P09's first event, the separate C05
   sample-batch execution authority is also consumed.
5. A successful sample becomes `COMPLETED_CONSUMED`. A failed sample becomes
   `FAILED_CONSUMED`, rejects C05, and atomically changes every allocated but
   not yet started later P/D ID to
   `NOT_STARTED_CONSUMED_BY_ATTEMPT_FAILURE`.
6. A Phase 6 failure after its consumption likewise rejects C05 and atomically
   changes all allocated P09/P10/D21-D25 IDs to
   `NOT_STARTED_CONSUMED_BY_ATTEMPT_FAILURE`.
7. A failed preflight is a real failure, not an unconsumed rehearsal.

`X5` must freeze this exact state set, transition table, predecessor order,
event precedence, atomic failure transition, and verifier rejection criteria.

After either authority is consumed, any command, pair, partial output, identity
mismatch, or failure rejects C05. There is no C05 Phase 6 retry unless a future
Owner decision creates a new candidate attempt instead.

The exact ordered `X5` command table must reproduce all of the following C04
coverage; this list is a coverage requirement and never substitutes for that
exact table:

- lint;
- complete unit/integration tests;
- schema fixtures;
- manifest fixtures;
- build;
- RC build and verification;
- E2E against the RC artifact;
- deterministic archive and archive verification;
- clean-clone reproducibility;
- C01-C04 frozen-evidence guards;
- runtime equivalence;
- exact command identity records and sidecars;
- three independent read-only reviews with
  `P0=0 / P1=0 / P2=0 / PASS`.

## 8. P09 and P10

Execution is strictly serial:

```text
Phase 6 PASS + reviews PASS
  -> P09 complete + seal + commit + push + remote verification
  -> P10 complete + seal + commit + push + remote verification
```

P09:

- prominent CTA / repeat-submit;
- W1/W2 terminal commitments `1/1`;
- CTA, open, close, locate, expand, Continue, default focus, reload, and
  identical export retry add zero commitments;
- the same intent produces at most one terminal commitment;
- direct schedule edits do not backfill a terminal.

P10:

- minimal intervention / invalid consequence;
- W1/W2 terminal commitments `0/0`;
- both opportunities settle as omission without blocking the ordinary
  two-week flow.

Both:

- use the C05 build and authority;
- raw and browser download are byte-identical;
- the sidecar and receipt each satisfy their own exact `X5` schema and
  independently bind the raw filename, byte count, and SHA-256;
- frozen host and ledger validators pass;
- finish at tick `2010` with two recaps;
- clear the application session after capture;
- stop the capture host;
- never enter a formal denominator.

Any failure consumes P09/P10 and D21-D25, rejects C05, and stops all later work.

## 9. D21-D25

Only after P10 is committed, pushed, and remotely verified may D21 begin.

The existing standalone Codex CLI isolation contract remains authoritative:

- five fresh, strictly serial CLI processes and workspaces;
- neutral player packet only;
- one frozen Playwright MCP provider and exact leaf allowlist;
- one browser context/page/application session;
- complete two weeks, tick `2010`, two recaps;
- private raw evidence content-addressed, read-only, and immutable;
- public structural projection and isolation verifier PASS;
- raw and browser download byte identity;
- sidecar and receipt independent schema validation and binding to the raw
  filename, byte count, and SHA-256;
- host and ledger validators PASS;
- session clear, interview, and host stop;
- permanent Gate 1A/Gate 1H denominator exclusion.

No Browser/Chrome/Computer-Use/Node-REPL equivalence substitution may be made
inside D21-D25.

## 10. CM01, review, seal, and Gate boundary

Passing Phase 6, P09/P10, and D21-D25 only permits a later Owner decision on
allocating `CM01`.

It does not:

- admit C05;
- create a formal RC or cohort;
- pass Gate 1A;
- satisfy Gate 1H;
- unlock Gate 2;
- set `output_ref`.

CM01, independent review, seal, formal RC/cohort, and any Gate conclusion remain
separate authority boundaries.

## 11. Failure and next-number rule

If C05 fails after any C05 authority is consumed:

- C05/P09-P10/D21-D25 become permanently read-only;
- all allocated P/D IDs are consumed, including those not run;
- CM01 is consumed only if it has already been created;
- no in-place repair, retry, deletion, re-signing, or selective rerun;
- the next candidate/number set must be assigned by a later Owner decision.

## 12. Immediate authorization boundary

The only authority requested by this proposal is:

`C05_PLAN_ONLY_PREAUTH_V3`

It supersedes the failed blob binding
`c2e75d3955cdd161285fa06cff989bea38c3f65f9678b35beb77e2c53bb1d0ab`
only for the next plan-only decision. It does not erase, overwrite, or convert
the v0.1 or v0.2 review failures into PASS.

It would authorize:

1. place the exact reviewed proposal into a new repository C05 plan file;
2. obtain two independent read-only plan reviews against the same blob;
3. if and only if both reviews are
   `P0=0 / P1=0 / P2=0 / PASS`, create and push one plan-only commit;
4. register the new `plan_ref` without closing #58 or changing any Gate.

It would not authorize:

- creating C05, P09/P10, or D21-D25 directories;
- modifying source/runtime/build files;
- running source or integration Phase 6;
- creating S5, I5, E5, CM01, review, seal, formal RC/cohort, or `output_ref`;
- changing Gate 1A, Gate 1H, or Gate 2.

The next authority after a successful P5 publication is
`C05_EXECUTABLE_CONTRACT_PREAUTH`. It may only:

1. place one exact Owner-hash-bound `X5` amendment into the same plan file;
2. obtain two independent read-only reviews of that exact amendment blob;
3. if and only if both are `P0=0 / P1=0 / P2=0 / PASS`, publish the
   executable-contract-only `X5` commit and register it;
4. keep all C05 implementation and numbered namespaces absent.

Implementation requires a still later, separate
`C05_IMPLEMENTATION_AUTHORITY` bound to the reviewed `X5` commit. Neither
the present `C05_PLAN_ONLY_PREAUTH_V3` nor the future
`C05_EXECUTABLE_CONTRACT_PREAUTH` authorizes implementation or execution.
