# Gate 1 D0 开工前置门记录

**项目：** Project-004-New Era 2
**日期：** 2026-07-26
**对应计划：** `2026-07-26-react-web-gate-1-2-development-plan.md`
**当前结论：** `D14_RC7_FREEZE_REVIEW_PENDING / GATE_1A_RESTART_PENDING / GATE_1H_DEFERRED`
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
| 测试运营负责人由项目 Owner 确认 | 完成 | Owner 已授权由 agent 负责；当前实际负责人为根 agent `/root`，职责合同见 `2026-07-26-gate1-agent-test-operations.md` |
| 代理试玩 A、B、C 已确认 | 完成 | D4、D9、D14 分别新建三个干净 agent 会话 `M-A`、`M-B`、`M-C`，不计入 Gate 1A 七样本 |
| Gate 1A 七样本合同 | 完成 | RC7 使用 `A23`–`A29`，按 `3 + 3 + 1` 分批执行；上下文、应用会话和结果隔离；无效替补从 `A30` 递增 |
| Gate 1A 七个独立席位 | 待冻结通过后创建 | 汇总 #9；A16–A22 对应 #25–#31 并已历史化。RC7 独立 `RC_FREEZE=YES` 后创建 A23–A29 |
| Gate 1 正式 RC | 完成 | `refs/heads/codex/gate1-rc-20260726.7` 固定指向 `d8bb0728b61eb6a189a5d4726177761e92ca89f7`；双 clean clone 得到相同 Vite 8 artifact、初态和确定性 archive |
| Gate 1A cohort manifest | 制备中 | `g1a-20260726-rc7-01` 固定 A23–A29、显式 capture dir、玩家包 V5、访谈 V3，以及包含终局状态转换故障的 blocked 三件套规则 |
| 独立冻结复核 | 待执行 | 必须由未参与 RC7 实现和冻结制备的 reviewer 从远端复算并给出 `RC_FREEZE=YES`；#7 当前保持 `OPEN` |
| Gate 1H 暂缓边界 | 完成 | 真人主持、候选人台账与知情同意在恢复 Gate 1H 前另行准备；当前保持 `PENDING` |
| Gate 2 解锁规则 | 完成 | Gate 1A 任何结论都不解锁 Gate 2；只有 Gate 1H `PASS` 才能解锁规格工作 |
| Issue 状态迁移 | 部分完成 | #7 已因 RC6 后置 P1 重新打开；#8 保持 `[Gate 1H][DEFERRED]` + `needs-info`；#9 保持 `OPEN`；#10–#31 已历史化；A23–A29 尚未创建 |

## 2. D0 边界

`D14_RC7_FREEZE_REVIEW_PENDING` 尚未解锁 Gate 1A 正式代理样本，更不解锁真人轨或后续 Gate。
边界如下：

- #2–#6 与 `M-A`、`M-B`、`M-C` 已完成，均不得计入 Gate 1A 七样本；
- A01–A22 永久保留历史且编号不复用；A23–A29 只在 RC7 独立冻结复核给出 `RC_FREEZE=YES` 后按 `3 + 3 + 1` 实例化；
- `TECH-A97`、`TECH-A98`、`TECH-A99`、`TECH-P00` 与 `TECH-P98` 只用于技术审计，不得改作正式样本或替补；
- payload 内 `P98` 永久保留为技术编号，不得分配给 Gate 1H 真人；
- 不得把本地只读分支指针误报为远端分支状态；
- 不得把静态审查、自动化 E2E、代码复审或里程碑试玩计入 RC7 的 `A23`–`A29`；
- Gate 1H 保持 `PENDING`，Gate 2 保持 `LOCKED`。

## 3. 后续执行顺序

1. 提交 RC7 cohort manifest、玩家包、访谈、RC6 历史化说明和冻结审计；
2. 由独立 reviewer 对远端 ref、manifest、archive、终局 blocked capture 合同与 Gate 锁给出 `RC_FREEZE=YES`；
3. 关闭 #7，创建 A23–A29 七个席位并在 #9 记录新 roster；
4. 启动 manifest 冻结的 4196 loopback capture host并完成空白会话预检；
5. 按 A23–A25、A26–A28、A29 三批逐场执行；每场先保存下载、核验三件套、清空，再发送统一结束访谈；
6. 每场完成有效性裁定和证据封存后才开始下一场；
7. 在 #9 发布代理结论，始终保留 `Gate 1H: PENDING` 与 `Gate 2: LOCKED`；
8. #8 只在项目 Owner 明确恢复 Gate 1H 后继续。
