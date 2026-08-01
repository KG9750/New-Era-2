# ENGINE_EVALUATION_E0 Run 20260801-e0-02 Report

## 结论

`ENGINE_EVALUATION_E0=INCOMPLETE`

本 run 的 Phase 0 通过。Phase 1 的脚本解析、nominal/stress scene-manifest runner、三个
fail-closed 失败向量和一次真实 editor save/close/reopen witness 已产生证据；但 source
commit 错误纳入 13 个 `.godot/` editor cache 文件，且 `SOURCE_INVENTORY.sha256` 自身未被
其内容绑定。post-commit audit 因此唯一分类为 `SOURCE_FREEZE_SCOPE_FAIL`，并立即硬停止。

Phase 2 与 Phase 3 均未运行；这不是 Godot 引擎失败，也不是 `ENGINE_GATE=FAIL`。
`ENGINE_GATE=NOT_RUN`。

## 绑定身份

- run id：`20260801-e0-02`
- plan ref：`codex/godot-e0-plan-freeze-20260801@8cff10572216e31941bacde8fe85b7c98549c462`
- plan SHA-256：`a75f807fb3315834624a3bf69251a8d6cd989fa5ab6891d58b446d6374ea0652`
- annex SHA-256：`c72906b5b4ddfeae45bb2816aac9eda1ac0530c5193a65355d5e33b52fc2c1ed`
- execution base：`b020775522f83c4731ba318905d3d436c2f51f60`
- frozen source：`e0622aff7188b9e4774a4d698c39a37e4c5a6908`
- Godot：`4.7.1.stable.mono.official.a13da4feb`
- source archive SHA-256：`9761d4f98a536135b2f5176128ba4be2d79128dc0ed47b04bbf5fc291727cc69`

## 状态总表

| 项目 | 状态 | 证据/说明 |
|---|---|---|
| Phase 0 identity / authorization | PASS | `00-authority-and-scope.json`、`01-environment-identity.json` |
| Phase 0 Accessibility / focus harness | PASS | `logs/phase0-harness.txt` |
| Phase 1 check-only | PASS | `logs/phase1-check-only.log` |
| Phase 1 nominal 3024-cell runner | PASS | `phase1-runner-nominal.json` |
| Phase 1 stress 48384-cell runner | PASS | `phase1-runner-stress.json` |
| Phase 1 missing scene vector | PASS | expected exit `21`；`phase1-vector-missing.json` |
| Phase 1 bad resource type vector | PASS | expected exit `22`；`phase1-vector-bad-type.json` |
| Phase 1 fixture mismatch vector | PASS | expected exit `23`；`phase1-vector-mismatch.json` |
| Phase 1 editor save/close/reopen witness | PASS | `screenshots/editor-save-close-reopen.png`，1392×768；只证明 editor/scene identity 与 reopen witness，不证明 Phase 3 runtime/render |
| Phase 1 deterministic source archive | PASS | 两次 `git archive` byte-for-byte 一致，见 `02b-source-archive.sha256` |
| Phase 1 source freeze | FAIL | 26 个实际 tracked entries 对 12 个 declared entries；13 个意外 `.godot/` cache；inventory self-entry 未绑定 |
| Phase 2 import write set | NOT_TESTED / MISSING | 硬停止后未运行；不创建 `05-import-write-set.json` 占位文件 |
| Phase 2 headless repeat | NOT_TESTED / MISSING | 不创建 `06-headless-repeat-results.json` 占位文件 |
| Phase 2 export / local launches | NOT_TESTED / MISSING | 不创建 `10-export-manifest.json` 占位文件 |
| Phase 3 read-only editor session | NOT_TESTED / MISSING | 不创建 `07-editor-session.json` 占位文件 |
| Phase 3 OS-injected input / camera / resize | NOT_TESTED / MISSING | 不创建 `08-runtime-input-camera.json` 占位文件 |
| Phase 3 nominal/stress performance | NOT_TESTED / MISSING | 不创建 `09-performance-raw.json` 占位文件 |
| distribution signing / Gatekeeper / notarization / cross-machine | NOT_TESTED | E0 原计划即不覆盖 |
| ENGINE_GATE | NOT_RUN | 缺少 required Phase 2/3；Owner 无可裁定的完整 E0 |

计数：`PASS=10`、`FAIL=1`、`NOT_TESTED_OR_MISSING=7`、`ENGINE_GATE_NOT_RUN=1`。

## 硬停止原因

pre-commit guard 将 `!` 放在 pipeline 前并依赖 `set -e`。由于 shell 对被 `!` 反转状态的
pipeline 不执行预期的 errexit，guard 虽打印 `.godot/` 路径，commit 仍继续。提交后 tree
audit 检出不一致，run 随即停止；未 amend、未删除 cache、未运行 Phase 2/3，也未把失败
source 覆盖为修复版本。

## 已知证据限制

Phase 1 Godot raw logs 未自行回显 ordered argv。`04-command-manifest.json` 对这几条命令
明确标记为 `ARTIFACT_BOUND_RECONSTRUCTION`，而非 `RECORDED_EXACT`。这会降低命令级
审计强度，但不会改变已经成立的 source-freeze 硬停止结论。

## 治理边界

- React/TypeScript 仍为玩法规则权威。
- `Gate 1H=PENDING`，`Gate 2=LOCKED`。
- C04/C05、地图 runtime、正式素材与生产 Godot foundation 状态均不改变。
- 本 evidence-only lineage 禁止 merge/cherry-pick 到 production ancestry。
- 若继续 E0，必须使用新 run id `20260801-e0-03`、新的 Owner 精确授权和新的 source archive；不得修补或重用本 run。

