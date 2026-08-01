# Godot E0 Execution Base Candidate Manifest

| 字段 | 内容 |
|---|---|
| 状态 | `EXECUTION_BASE_CANDIDATE_NOT_AUTHORIZED` |
| Candidate branch | `codex/godot-e0-execution-base-20260801` |
| Parent plan ref | `codex/godot-e0-plan-freeze-20260801@8cff10572216e31941bacde8fe85b7c98549c462` |
| Parent of plan ref | `main@428b5ff329888bb8016408c6b519542d042285ae` |
| 用途 | 为 E0 Authorized Bootstrap 提供最小、可复核的治理与技术输入集合 |
| 非授权 | 本 manifest、candidate branch 或后续 commit 均不自动授权 Bootstrap、Godot、ENGINE_GATE 或任何玩法/地图 Gate |

## 1. 直接输入清单

| 路径 | SHA-256 |
|---|---|
+| `AGENTS.md` | `fa0180ead0bc574c3c124d202608940bccd6cc5d7a027bd060670d297982be6d` |
| `CONTEXT.md` | `f5832ce29bbccbd2c9041a9775f468cb0577435a9b8cd8138d792036a82ee632` |
| `PLANS.md` | `cf9ff90399e2db90ca8d0fc8b9fef4fb1a76e8a5ad0da116acbd4aba6e38908c` |
| `DESIGN.md` | `082ab92566b99fc3797d23716d8a86981538130100b2dbb2cd68f61703d4c537` |
| `FRONTEND.md` | `baef85664666c4badaf0a17ed4a06d45d74d1681a09f33ba4a12bdd0e2eefdd4` |
| `docs/agents/game-development-workflow.md` | `b532e35911cdd4a7a663c0bdf0b92ecfe22688b1e7e57cf003208f768a8def54` |
| `docs/agents/issue-tracker.md` | `26b6afdf4d824621aca70086907c7decdfd7ce414c45b4a194f736c7a21aedd6` |
| `docs/agents/triage-labels.md` | `561f96ec4646ec56d53c0dde73f5ec8c2b8024e60c0ab4854ecd59a15480e954` |
| `docs/agents/domain.md` | `b4a8144f66c31f4b6ce40a1ac6af4750ef05577a46cf27734531fac1a5856ba0` |
| `docs/exec-plans/active/2026-07-26-react-web-gate-1-2-development-plan.md` | `abe8b2def4fe092cb1705d9b8e18984e9037cd1a0d53b6c5130216c15d12ea29` |
| `docs/exec-plans/evidence/2026-07-31-current-project-status.md` | `55908b778d4f5ba3afb51c7f2ddf80aa81e7d164f0e81196fc054b5ef4974080` |
| `docs/exec-plans/active/2026-08-01-godot-engine-evaluation-e0-and-engine-gate.md` | `a75f807fb3315834624a3bf69251a8d6cd989fa5ab6891d58b446d6374ea0652` |
| `docs/exec-plans/active/2026-08-01-godot-engine-evaluation-e0-fixture-and-measurement-annex-v0.1.md` | `c72906b5b4ddfeae45bb2816aac9eda1ac0530c5193a65355d5e33b52fc2c1ed` |

前 11 项来自 2026-08-01 当前工作区的只读快照；主计划与 annex 继承自已经 R3
`PLAN_REVIEW_PASS` 并远端回读的 plan ref。最终 execution-base commit 必须使本表全部
SHA 可复算。

`docs/agents/game-development-workflow.md` 的权威输入字节包含一个 terminal blank line；
为保持表中 SHA，本 candidate 原样保留。`git diff --check` 允许且只能报告这一项
`new blank line at EOF`，不得出现其他 whitespace error。

## 2. Scope

本 candidate 只允许包含：

- 根治理入口：`AGENTS.md`、`CONTEXT.md`、`PLANS.md`、`DESIGN.md`、`FRONTEND.md`；
- AGENTS 直接引用的 issue/triage/domain 约定；
- Godot/Web 分阶段工作流；
- React Gate 1–2 权威计划；
- 当前项目状态快照；
- 已冻结的 E0 主计划与 fixture/measurement annex；
- 本 manifest。

明确不包含：

- `prototype/`、`spikes/`、`assets/`、`data/`、`tests/` 或 runtime source；
- 地图候选、生产素材、Godot plugin、MCP plugin 或现有 smoke；
- C04/C05 executable/evidence namespace；
- Gate 1A/1H 样本、cohort、真人证据或 ENGINE_GATE 结果；
- 当前脏工作树中的其他 tracked/untracked 文件。

`PLANS.md`、`DESIGN.md` 或其他入口指向但未列入本 manifest 的路径，只是项目导航，
不能在本 candidate 中被当作存在、已冻结或已授权的 artifact。E0 只依赖本 manifest
列出的直接输入。

## 3. Candidate acceptance

提交与远端回读必须同时满足：

- parent 精确为 `8cff10572216e31941bacde8fe85b7c98549c462`；
- commit diff 只涉及本 manifest 列出的 11 个补充输入与本 manifest 本身；主计划/annex
  必须保持 inherited bytes 不变；
- 表中 13 项 SHA 全部在 fresh clone 中复算一致；
- Git worktree clean；
- `spikes/godot-engine-evaluation-e0/` 与任何 E0 output/evidence run root 均不存在；
- 状态保持：

```text
ENGINE_EVALUATION_E0=PROPOSED_NOT_AUTHORIZED
ENGINE_GATE=NOT_RUN
GODOT_PRODUCTION_FOUNDATION=NOT_AUTHORIZED
GATE_1H=PENDING
GATE_2=LOCKED
```

只有 Owner 后续同时绑定 plan ref/file SHA、annex SHA、execution-base exact commit、全部
bootstrap 路径、durable evidence remote/ref 和 operator，才可能进入 Authorized
Bootstrap。本 candidate 不代替该 Owner receipt。
