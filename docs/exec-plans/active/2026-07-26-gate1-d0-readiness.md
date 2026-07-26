# Gate 1 D0 开工前置门记录

**项目：** Project-004-New Era 2
**日期：** 2026-07-26
**对应计划：** `2026-07-26-react-web-gate-1-2-development-plan.md`
**当前结论：** `D0_A_READY / D14_RC5_FREEZE_PENDING / GATE_1A_RESTART_PENDING / GATE_1H_DEFERRED`
**实施分支：** `codex/gate1-react-web`

---

## 1. 当前检查结果

| D0 条件 | 状态 | 证据或剩余动作 |
|---|---|---|
| 既有 Gate 1 基线存在 | 完成 | 已通过 GitHub API 核验提交 `897a11af8cf14974b67e31f7f18c3fffab77d0dc` 存在 |
| 双轨权威文档形成远端提交基线 | 完成 | 远端提交 `2550617be5eff4226e9e140be741d619fcb6f5a3`；基于 `codex/gate1-react-web` 创建，未依赖本地只读分支指针 |
| 检查提交边界 | 完成 | 只提交本轮双轨计划、协议、状态入口和运营合同，不使用 `git add -A` |
| Node 24 LTS 可用 | 完成 | 已验证 `PATH=/opt/homebrew/opt/node@24/bin:$PATH node --version` 输出 `v24.18.0`、`npm --version` 输出 `11.16.0`；根目录 `.node-version` 固定 `24.18.0` |
| 实施负责人已记录 | 完成 | 当前 Codex 工程实施任务，分支 `codex/gate1-react-web` |
| 测试运营负责人由项目 Owner 确认 | 完成 | Owner 已授权由 agent 负责；当前为 `/root/gate1_test_coordinator`（Planck），职责合同见 `2026-07-26-gate1-agent-test-operations.md` |
| 代理试玩 A、B、C 已确认 | 完成 | D4、D9、D14 分别新建三个干净 agent 会话 `M-A`、`M-B`、`M-C`，不计入 Gate 1A 七样本 |
| Gate 1A 七样本合同 | 完成 | RC5 使用 `A09`–`A15`，按 `3 + 3 + 1` 分批执行；上下文、应用会话和结果隔离；无效替补从 `A16` 递增 |
| Gate 1A 七个独立席位 | 待创建 | 汇总仍为 #9；RC4 的 #10–#17 仅保留历史，RC5 独立复核通过后创建 A09–A15 七个新 Issues |
| Gate 1 正式 RC | 候选完成 | `refs/heads/codex/gate1-rc-20260726.5` 固定指向 `2d40aa102bd51107c07cbe176f798a93a37663f3`；双 clean clone 得到相同 Vite 8 artifact、初态和确定性 archive |
| Gate 1A cohort manifest | 待独立复核 | RC4 因 A01 匿名 JSON 无法核验而永久作废；`g1a-20260726-rc5-01` 已冻结 A09–A15、显式 capture dir、玩家包、访谈与三件套规则 |
| 独立冻结复核 | 待完成 | 必须由未参与 RC5 实现、TECH-P98 和冻结制备的新 agent 从远端复算；只有 `P0=0 / P1=0 / RC_FREEZE=YES` 才关闭 #7 |
| Gate 1H 暂缓边界 | 完成 | 真人主持、候选人台账与知情同意在恢复 Gate 1H 前另行准备；当前保持 `PENDING` |
| Gate 2 解锁规则 | 完成 | Gate 1A 任何结论都不解锁 Gate 2；只有 Gate 1H `PASS` 才能解锁规格工作 |
| Issue 状态迁移 | 部分完成 | #8 保持 `[Gate 1H][DEFERRED]` + `needs-info`；#7 保持 OPEN，#9 及 RC4 #10–#17 待 RC5 冻结通过后迁移 |

## 2. D0 边界

`D0_A_READY` 只解锁 D1 开发，不解锁正式样本或后续 Gate。当前 RC5 与 cohort
仍等待独立复核，边界如下：

- #2–#6 与 `M-A`、`M-B`、`M-C` 已完成，均不得计入 Gate 1A 七样本；
- A09–A15 只在 RC5 独立冻结复核给出 `RC_FREEZE=YES` 后按 `3 + 3 + 1` 实例化；
- `TECH-A97`、`TECH-A98`、`TECH-A99`、`TECH-P00` 与 `TECH-P98` 只用于技术审计，不得改作正式样本或替补；
- payload 内 `P98` 永久保留为技术编号，不得分配给 Gate 1H 真人；
- 不得把本地只读分支指针误报为远端分支状态；
- 不得把静态审查、自动化 E2E 或里程碑试玩计入 RC5 的 `A09`–`A15`；
- Gate 1H 保持 `PENDING`，Gate 2 保持 `LOCKED`。

## 3. 后续执行顺序

1. 推送 RC5 cohort、manifest、checksum、archive、TECH-P98 与冻结审计；
2. 由全新独立 agent 从远端复核；只有 `RC_FREEZE=YES` 才关闭 #7；
3. 将 #10–#17 标记为 RC4 历史并关闭仍开放项，创建 A09–A15 七个独立 Issues，更新 #9；
4. 按 A09–A11、A12–A14、A15 三批执行 Gate 1A，每场先保存下载、核验三件套、清空，再发送统一结束访谈；
5. 每场完成有效性裁定和证据封存后才开始下一场；
6. 在 #9 发布代理结论，始终保留 `Gate 1H: PENDING` 与 `Gate 2: LOCKED`；
7. #8 只在项目 Owner 明确恢复 Gate 1H 后继续。
