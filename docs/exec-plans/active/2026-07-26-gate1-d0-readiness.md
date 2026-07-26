# Gate 1 D0 开工前置门记录

**项目：** Project-004-New Era 2
**日期：** 2026-07-26
**对应计划：** `2026-07-26-react-web-gate-1-2-development-plan.md`
**当前结论：** `D14_RC_FROZEN / GATE_1A_AWAITING_FREEZE_REVIEW / GATE_1H_DEFERRED`
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
| 测试运营负责人由项目 Owner 确认 | 完成 | Owner 已授权当前主 agent `/root`；职责合同见 `2026-07-26-gate1-agent-test-operations.md` |
| 代理试玩 A、B、C 已确认 | 完成 | D4、D9、D14 分别新建三个干净 agent 会话 `M-A`、`M-B`、`M-C`，不计入 Gate 1A 七样本 |
| Gate 1A 七样本合同 | 完成 | `A01`–`A07` 使用同一 RC，按 `3 + 3 + 1` 分批执行；上下文、应用会话和结果隔离；无效替补从 `A08` 递增 |
| Gate 1A 七个独立席位 | 完成 | 汇总 #9；A01–A07 分别为 #10–#16；全部阻塞于 #7 正式 RC 冻结，不提前实例化 agent 会话 |
| Gate 1 正式 RC | 完成 | `refs/heads/codex/gate1-rc-20260726.2` 固定指向 `eeaa5fe2c1b4cfd68d8be73ba26b463feeed08d6`；双 clean clone 得到相同 artifact hash |
| Gate 1A cohort manifest | 完成 | `g1a-20260726-rc2-01` 因玩家包诱导风险在开跑前被否决；`g1a-20260726-rc2-02` 已以两阶段协议重新冻结，正式样本尚未开始 |
| 独立冻结复核 | 待完成 | 新建独立 agent 对 manifest、archive、RC ref、Gate 锁和运营证据做只读复核；只有 `RC_FREEZE=YES` 才能启动 A01 |
| Gate 1H 暂缓边界 | 完成 | 真人主持、候选人台账与知情同意在恢复 Gate 1H 前另行准备；当前保持 `PENDING` |
| Gate 2 解锁规则 | 完成 | Gate 1A 任何结论都不解锁 Gate 2；只有 Gate 1H `PASS` 才能解锁规格工作 |
| Issue 状态迁移 | 完成 | #2、#4、#6 已改为 `ready-for-agent`；#8 已改为 `[Gate 1H][DEFERRED]` + `needs-info` |

## 2. D0 边界

`D0_A_READY` 只解锁 D1 开发，不解锁正式样本或后续 Gate。当前 RC 与 cohort 虽已冻结，仍有以下边界：

- #2–#6 与 `M-A`、`M-B`、`M-C` 已完成，均不得计入 Gate 1A 七样本；
- A01–A07 只在独立冻结复核给出 `RC_FREEZE=YES` 后按 `3 + 3 + 1` 实例化；
- `TECH-A99` 与 `TECH-P00` 只用于技术审计，不得改作正式样本或替补；
- 不得把本地只读分支指针误报为远端分支状态；
- 不得把静态审查、自动化 E2E 或里程碑试玩计入 `A01`–`A07`；
- Gate 1H 保持 `PENDING`，Gate 2 保持 `LOCKED`。

## 3. 后续执行顺序

1. 将 cohort manifest、archive 与冻结证据发布到远端实施分支，保持 RC ref 不移动；
2. 关闭 #7，并由新的独立 agent 给出 `RC_FREEZE=YES/NO`；
3. 若为 `YES`，按 #10–#12、#13–#15、#16 三批执行 Gate 1A；若为 `NO`，不得实例化 A01；
4. 在 #9 发布代理结论，始终保留 `Gate 1H: PENDING` 与 `Gate 2: LOCKED`；
5. #8 只在项目 Owner 明确恢复 Gate 1H 后继续。
