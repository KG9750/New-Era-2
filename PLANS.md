# Plans

Execution-plan entrypoint for `Project-004-New Era 2`.

## Current Active Plan

- `docs/exec-plans/active/2026-07-29-gate1a-rc9-c04-recovery-plan.md` — 当前 `plan_ref=05ca9bd0777280d2a455a12ddd4d6a5a46a0c086`（supersedes `f0ba061250d8633669eff625f7aa8809b789e682`）的 C04 纵向恢复计划；A01 已 fail-closed 并永久保存，唯一有效 Phase 6 root 为 `phase6-retry-01`。在保持 `standalone-codex-cli-v2`、ChatGPT app absolute Codex binary 与 Node 24 identity 不变的前提下，只有完整重跑通过后才允许 #50 分配 CM01。
- `docs/exec-plans/active/2026-07-27-gate1a-rc9-c03-recovery-plan.md` — C03 历史纵向恢复计划；玩法、P05/P06 与 D11–D15 已完成，但最终在 RC9-11 freeze preparation 以 `REJECTED_FREEZE_PREPARATION` 收口，C03 及其全部证据永久只读。
- `docs/exec-plans/active/2026-07-27-gate1a-rc9-remediation-plan.md` — RC8 `AGENT_PROXY_FAIL` 后的 RC9 责任承诺模型受控转向与复测计划；修复周结转、化肥生命周期、tick 1002 换周状态和 request 遥测分类，使用新协议/schema/scenario、两阶段封存与 A38–A44 全新七样本 cohort。
- `docs/exec-plans/active/2026-07-26-v0.4-prototype-validation-plan.md` — V0.4 分阶段原型验证总控计划；Gate 0 已通过，下一步是 Gate 1 两周经营原型，不直接开发完整三个月。
- `docs/exec-plans/active/2026-07-26-react-web-gate-1-2-development-plan.md` — Gate 1 React Web 灰盒的 D0 开工门与 15–18 个净开发工作日垂直切片计划；先执行 Gate 1A agent 代理验证，Gate 1H 真人验证暂缓。
- `docs/exec-plans/active/2026-07-26-gate1-agent-test-operations.md` — Gate 1 双轨测试运营合同；RC8 的 A30 因同 host 并发违反串行隔离而保持技术无效，A37 已完成替补；A31–A37 七个有效样本的有效编辑数组为 W1 `3,1,1,2,3,2,2`、W2 `2,1,1,2,2,1,1`，中位数 `2 / 1` 同时未达 `3–5`，最终仍为 `AGENT_PROXY_FAIL`。
- `docs/exec-plans/active/2026-07-26-gate1-dual-track-independent-review.md` — 双轨合同独立复核；最终 P0=0 / P1=0 / P2=0 / REVIEW_PASS。
- `docs/exec-plans/active/2026-07-26-gate1-d0-readiness.md` — D0-A 与 RC8 冻结通过，但 Gate 1A 最终为 `AGENT_PROXY_FAIL`；Gate 1H 继续暂缓，Gate 2 继续锁定。
- `data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01/gate1a-final-report.md` — RC8 七个有效代理样本、post-seal §8.1 计数复核、`P0=0 / P1=2 / P2=1` 两个根因聚类与最终失败裁定；Gate 1H 保持 `PENDING`，Gate 2 保持 `LOCKED`。

## Directories

- `docs/exec-plans/active/`: active or pending plans.
- `docs/exec-plans/completed/`: completed plans and results.
- `docs/exec-plans/tech-debt-tracker.md`: cross-cutting technical debt.

## Plan Requirements

- Goal and success criteria.
- Step-by-step implementation.
- Verification for each step.
- Risks or assumptions.
