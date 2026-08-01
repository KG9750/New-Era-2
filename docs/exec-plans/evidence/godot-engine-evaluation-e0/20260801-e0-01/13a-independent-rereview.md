# ENGINE_EVALUATION_E0 Phase 0 补救独立复审

## 复审结论

```text
run_id=20260801-e0-01
P0=0
P1=1
P2=0
REVIEW=REVIEW_FAIL

ENGINE_EVALUATION_E0=INCOMPLETE_TEST_HARNESS
E0_RUNTIME=E0_NOT_RUN
ENGINE_GATE=NOT_RUN
```

首次审查的 `P2-01` 已通过保守降级妥善处置；`P1-01` 的主体已修正，但仍有一个原
finding 明确覆盖的 preflight 项保留了未经完整原始命令证据支持的 `PASS`，因此尚不能关闭。

本次 `REVIEW_FAIL` 只表示补救尚未完全满足冻结证据合同，不表示 Godot 运行失败，也不表示 ENGINE_GATE FAIL。

## 审查身份与边界

本复审由未参与实施及首次审查的新鲜独立上下文完成，仅只读检查：

- 冻结 plan ref
  `codex/godot-e0-plan-freeze-20260801@8cff10572216e31941bacde8fe85b7c98549c462`
- 冻结主计划及 fixture/measurement annex V0.1
- staging root
  `/private/tmp/new-era-godot-engine-e0-staging-20260801-e0-01`
- `15a-remediation-review-inventory.sha256` 绑定的文件
- 首次 `13-independent-review.md`
- 修订前后两份 `12-engine-evaluation-e0-report.md`

本复审没有修改文件、Git 或 GitHub，没有运行 Godot，没有申请或改变 Accessibility 权限。

## 完整性核验

执行：

```text
shasum -a 256 -c 15a-remediation-review-inventory.sha256
```

全部通过：

```text
00-authority-and-scope.json: OK
01-environment-identity.json: OK
04-command-manifest.json: OK
11-scope-audit.json: OK
12-engine-evaluation-e0-report.md: OK
12-pre-remediation-engine-evaluation-e0-report.md: OK
13-independent-review.md: OK
15-pre-review-inventory.sha256: OK
e0-bootstrap-receipt.json: OK
logs/phase0-harness.txt: OK
logs/phase0-identity.txt: OK
```

冻结 ref 的现场复算值为：

```text
plan_sha256=a75f807fb3315834624a3bf69251a8d6cd989fa5ab6891d58b446d6374ea0652
annex_sha256=c72906b5b4ddfeae45bb2816aac9eda1ac0530c5193a65355d5e33b52fc2c1ed
```

与授权及报告绑定值一致。

## 修订前报告保全

旧 `15-pre-review-inventory.sha256` 对原报告绑定：

```text
ccae573b317566dd2a09ea52bee21b6757af5e39322a07c2a1390bdcda98d157
  12-engine-evaluation-e0-report.md
```

当前保全副本复算为：

```text
ccae573b317566dd2a09ea52bee21b6757af5e39322a07c2a1390bdcda98d157
  12-pre-remediation-engine-evaluation-e0-report.md
```

两者完全一致。首次失败报告没有被覆盖、改写或以重构证据替代。修订后报告具有独立 hash：

```text
f613e73e4649298acc03da3d886411989006e2bb4ffe127b853954668b57f4ef
  12-engine-evaluation-e0-report.md
```

首次独立审查也作为独立文件保留并由补救清单绑定。

## 首次 finding 处置判断

### P1-01：部分修复，尚未关闭

修订报告已完成以下正确处置：

1. 删除了“完整 identity、environment 与 ordered argv 见 01/04”的过度声明。
2. 将 Godot、.NET、`osascript` identity 和 focus probe 降为 `REPORTED_UNVERIFIED`。
3. 新增上位输入 SHA 缺项，并明确 focus/injection inline script、逐命令 cwd、
   allowlisted environment、stdout/stderr 缺失。
4. 明确这些值只是现场观察，不是完整独立复核证明。
5. 没有事后重构 inline script 或命令输出冒充原始证据。

但首次 P1-01 明确包括缺少 command/raw provenance 的“Git/receipt preflight”。修订报告仍写：

```text
P0-02 | clean worktree、隔离路径与初始 ABSENT/empty 条件 | PASS
```

`e0-bootstrap-receipt.json` 保存了创建 worktree/root 的 `createdArgv`，但没有保存用于判定
`before.ABSENT`、创建后 Git clean、output empty、candidate path absent 等历史状态的实际
检查命令、cwd、exit code 和 stdout/stderr。`11-scope-audit.json` 同样是结论记录，不是这些
检查的原始 command witness。

修订报告自己又统一承认：

```text
每条 identity/preflight 命令的 cwd、allowlisted environment 与 stdout/stderr 缺失
```

因此 `P0-02=PASS` 与报告的保守证据口径相冲突。仅依据当前文件证据，无法把首次
P1-01 完全关闭。

最小修正：

- 将 `P0-02` 从 `PASS` 降为 `REPORTED_UNVERIFIED`；
- 将统计改为 `PASS=1 / FAIL=1 / NOT_TESTED=22 / REPORTED_UNVERIFIED=6`；
- 保留 receipt、scope audit 和原日志原样，不重构或补造历史命令证据；
- 不需要也不得运行 Godot、重新执行 preflight 或复用当前 run。

完成这一个报告级修正后，P1-01 才可关闭。

### P2-01：已关闭

修订报告已将 export template 项从 `PASS` 降为 `P0-05=NOT_TESTED`，并明确披露：

- 现有证据只记录两个 release 文件 SHA；
- 缺少精确路径清单；
- 缺少 template license capture；
- template 存在不能推导 export PASS。

统计也已相应更新。没有补造 inventory 或 license 原始证据。首次 `P2-01` 已得到完整、
保守且可审计的处置。

## Harness 与 Gate 分类复核

文件证据一致记录：

```text
UI elements enabled=false
shift injection exit=1
errorCode=1002
classification=TEST_HARNESS_FAIL / E0_NOT_RUN
```

其中 `04-command-manifest.json` 逐字保存的 Accessibility query 及其
`exit=0 / stdout=false` 已足以按照冻结 annex 触发 Phase 0 硬停止。缺失的 injection
inline script 不会把此分类转换为 Godot input failure。

其余文件一致声明：

```text
Godot project created=false
Godot project loaded=false
Phase 1=NOT_RUN
Phase 2=NOT_RUN
Phase 3=NOT_RUN
ENGINE_GATE=NOT_RUN
```

修订报告没有把 identity 观察、template 存在或 harness failure 写成 runtime PASS、
E0 COMPLETE 或 ENGINE_GATE FAIL。

## 最终判断

```text
P1-01=PARTIALLY_REMEDIATED_NOT_CLOSED
P2-01=CLOSED
ENGINE_EVALUATION_E0=INCOMPLETE_TEST_HARNESS
E0_RUNTIME=E0_NOT_RUN
ENGINE_GATE=NOT_RUN
GODOT_PRODUCTION_FOUNDATION=NOT_AUTHORIZED
```

当前证据可继续作为真实的 Phase 0 harness failure lineage 保留，但在 `P0-02` 完成上述
保守降级并接受新的 targeted review 前，不应写入 `REVIEW_PASS`。

任何后续 E0 执行仍必须使用新的 run id、隔离路径和 Owner 精确授权；不得在当前 run
补授权限后续跑。
