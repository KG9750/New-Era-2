# ENGINE_EVALUATION_E0 Phase 0 独立审查

## 审查结论

```text
run_id=20260801-e0-01
P0=0
P1=1
P2=1
REVIEW=REVIEW_FAIL

ENGINE_EVALUATION_E0=INCOMPLETE_TEST_HARNESS
E0_RUNTIME=E0_NOT_RUN
ENGINE_GATE=NOT_RUN
```

`REVIEW_FAIL` 仅表示当前证据包尚未完全满足冻结计划的可复核证据合同，不表示
Godot 运行失败，也不表示 ENGINE_GATE FAIL。

Phase 0 的 Accessibility capability 不通过，依照冻结 annex，其唯一分类确为
`TEST_HARNESS_FAIL / E0_NOT_RUN`。本 run 应继续保持硬停止，不得创建或加载 Godot
project，不得进入 Phase 1–3，也不得裁定 ENGINE_GATE。

## 审查身份与边界

本审查由未参与实施的新鲜独立上下文完成，只读取：

- 冻结 plan ref
  `codex/godot-e0-plan-freeze-20260801@8cff10572216e31941bacde8fe85b7c98549c462`
- 冻结主计划
- 冻结 fixture/measurement annex V0.1
- staging root
  `/private/tmp/new-era-godot-engine-e0-staging-20260801-e0-01`
- `15-pre-review-inventory.sha256` 绑定的八个 pre-review 文件

本审查没有修改文件、Git 或 GitHub，没有运行 Godot，没有申请或改变 macOS
Accessibility 权限，也没有改变任何 Gate 状态。

## 完整性核验

首先执行：

```text
shasum -a 256 -c 15-pre-review-inventory.sha256
```

结果：

```text
00-authority-and-scope.json: OK
01-environment-identity.json: OK
04-command-manifest.json: OK
11-scope-audit.json: OK
12-engine-evaluation-e0-report.md: OK
e0-bootstrap-receipt.json: OK
logs/phase0-harness.txt: OK
logs/phase0-identity.txt: OK
```

冻结计划与 annex 的现场复算结果分别为：

```text
plan_sha256=a75f807fb3315834624a3bf69251a8d6cd989fa5ab6891d58b446d6374ea0652
annex_sha256=c72906b5b4ddfeae45bb2816aac9eda1ac0530c5193a65355d5e33b52fc2c1ed
```

均与 Owner authorization、bootstrap receipt 和报告中的绑定值一致。

## 已确认事项

1. `run_id`、plan、annex、execution base、目标 branch/worktree、external roots、
   candidate evidence path 和 durable evidence ref 在现有文件间一致。
2. `logs/phase0-harness.txt` 记录：
   - `UI elements enabled=false`
   - focus probe 返回成功并声明恢复原前台应用
   - Shift 注入返回 `exit=1 / errorCode=1002`
   - 错误为 `osascript 不允许发送按键`
3. 冻结 annex 明确规定 Phase 0 Accessibility/focus capability 不通过时，唯一分类为
   `TEST_HARNESS_FAIL / E0_NOT_RUN`，不得归因于 Godot input 或 Engine Gate。
4. bootstrap receipt、command manifest、scope audit 与报告一致声明：
   - Godot project 未创建、未加载；
   - editor、import、runtime、export 均未运行；
   - Phase 1–3 均为 `NOT_RUN`；
   - ENGINE_GATE 为 `NOT_RUN`；
   - 没有插件、产品素材、玩法规则或 Gate 改动。
5. 报告明确披露 source archive、project manifest、runtime、performance、export 和
   screenshot 等缺项，没有用空 placeholder 冒充执行证据。
6. 报告没有把 identity PASS、template 存在或 harness failure 写成 runtime PASS、
   E0 COMPLETE 或 ENGINE_GATE FAIL。

## Findings

### P1-01：Phase 0 command/raw evidence 不能完整复核 ordered argv

`04-command-manifest.json` 对 focus probe 和 Shift injection probe 使用：

```text
<frozen inline focus probe>
<frozen inline shift down/up probe>
```

这不是实际执行的完整 ordered argv 或内联脚本文本。该 manifest 也没有为每条命令
绑定 cwd、允许的 environment 字段及完整 stdout/stderr；Godot 签名、架构、
notarization、license、template inventory、Git/receipt preflight 等已宣称完成的检查，
也没有对应的实际命令记录。

因此，`12-engine-evaluation-e0-report.md` 中“完整 identity、允许的 environment 字段与
ordered argv 见 01 和 04”的表述超过了当前冻结证据能够支持的范围。

此缺陷不改变早停分类：已有精确 Accessibility query 返回 `false`，按 annex 已足以触发
`TEST_HARNESS_FAIL / E0_NOT_RUN`。但在 command manifest 补齐或相关声明降级前，证据包
不能取得独立 `REVIEW_PASS`。

最小修正：

- 如果原始、未改写的命令记录仍存在，将实际 focus/injection 脚本文本或 argv、cwd、
  allowlisted environment、exit code、stdout/stderr 纳入证据；
- 为其余 Phase 0 identity/preflight 检查补入实际命令记录；
- 如果原始记录不可恢复，不得重构后冒充原始证据；应把相应项目标为
  `REPORTED_UNVERIFIED` 或 `NOT_TESTED`，并删除“完整 ordered argv”表述；
- 不需要、也不得为修复本 finding 启动 Godot 或进入 Phase 1。

### P2-01：export template 的 PASS 声明超过“精确清单与许可证”证据

`01-environment-identity.json` 只记录 macOS 和 Windows release template 的 SHA，并把
Web/Linux 合并记为 `NOT_AVAILABLE_OR_NOT_TESTED`。当前文件没有提供 template 的精确
路径/清单，也没有明确的 template license 证据。

因此报告中的 `P0-05=PASS` 以及“export template 身份核验通过”不完全满足冻结计划
要求的“精确清单、版本和许可证”。

最小修正：

- 若原始精确 inventory 与 license capture 存在，将其纳入证据并绑定 SHA；
- 否则把 `P0-05` 降为 `NOT_TESTED`，明确现有 SHA 只证明两个 release template 文件
  被记录，不能证明完整 template inventory；
- 同步修正报告中的 PASS/FAIL/NOT_TESTED 统计。

## 修订与复审要求

实施者完成上述最小修正后，应：

1. 更新 `12-engine-evaluation-e0-report.md` 的证据表述与统计；
2. 重新生成 pre-review inventory；
3. 由新的独立上下文复核修订后的冻结证据；
4. 只有在新审查达到 `P0=0 / P1=0` 且 P2 已明确处置后，才能写
   `REVIEW_PASS`。

不得通过补授 Accessibility 权限后继续使用当前 `run_id`。若 Owner 决定重新执行 E0，
必须使用新的 run id、隔离路径和精确授权。

## 非权威建议

```text
ENGINE_GATE_RECOMMENDATION=DO_NOT_ADJUDICATE
ENGINE_GATE=NOT_RUN
GODOT_PRODUCTION_FOUNDATION=NOT_AUTHORIZED
NEXT_ACTION=HARDEN_CURRENT_FAILURE_EVIDENCE_THEN_REQUEST_NEW_RUN_AUTHORIZATION
```

当前 run 应作为 `INCOMPLETE_TEST_HARNESS` 失败证据保留。以上建议不是 Owner Gate
决议，也不解锁任何 Godot 产品开发、Gate 1H、Gate 2 或地图 Gate。
