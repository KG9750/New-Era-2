# ENGINE_GATE 非权威建议

## 建议

```text
run_id=20260801-e0-01
ENGINE_GATE_RECOMMENDATION=DO_NOT_ADJUDICATE
ENGINE_GATE=NOT_RUN
ENGINE_EVALUATION_E0=INCOMPLETE_TEST_HARNESS
E0_RUNTIME=E0_NOT_RUN
GODOT_PRODUCTION_FOUNDATION=NOT_AUTHORIZED
```

本建议不是 Owner ENGINE_GATE decision，也不具备解锁任何开发或 Gate 的权限。

## 依据

1. Phase 0 的精确 Accessibility query 返回 `UI elements enabled=false`。
2. Shift 注入探针记录 `exit=1 / errorCode=1002 / osascript 不允许发送按键`。
3. 冻结 annex 将该情形唯一分类为 `TEST_HARNESS_FAIL / E0_NOT_RUN`，不得裁为 Godot
   input failure 或 ENGINE_GATE FAIL。
4. Godot project 未创建或加载，Phase 1–3、parse、import、runtime、真实窗口、性能与
   export 全部未运行。
5. 最终独立关闭复审为 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`；这个 PASS 只证明失败
   证据与审查 lineage 完整，不证明 E0 或 Engine Gate 通过。

因此，本 run 没有足够的运行证据支持 `PASS`、`CONDITIONAL` 或 `FAIL` 任何 Engine Gate
裁定。唯一安全建议是保持 `ENGINE_GATE=NOT_RUN`。

## 生命周期建议

在 durable evidence remote/ref 完成 no-clobber 发布和全新 clone 回读前，保留当前
worktree、staging 与 output root。发布验证完成后，建议 Owner：

```text
ARCHIVE_EVIDENCE_AND_DISCARD_WORKTREE
```

durable evidence ref 应继续作为 evidence-only lineage 保留，不得 merge 或 cherry-pick 到
production ancestry。当前 target worktree 没有 Godot project/source，丢弃它不会删除 E0
产品实现，但实际删除仍应等待 Owner 后续决定；本次执行不自行清理。

## 新 run 的前置条件

若 Owner 希望重新执行 E0，应先：

1. 在 macOS 隐私与安全性中，为实际执行 `osascript` 按键注入的宿主应用授予
   Accessibility 权限；
2. 在新授权前只读确认 `UI elements enabled=true`；
3. 使用新的 run id、target branch/worktree、output root、staging root 与 candidate path；
4. 重新绑定冻结 plan/annex、execution base 与 Owner authorization；
5. 从 Phase 0 重新开始，不复用本 run，也不覆盖本失败证据。

本建议不授权在新 run 前创建 Godot project，不改变 React/TypeScript 规则权威，也不改变
Gate 1H、Gate 2、C04/C05 或地图 Gate。
