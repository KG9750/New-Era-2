# Gate 1A 独立冻结复核

## 最终裁定

`RC_FREEZE=YES`

- P0：0
- P1：0
- P2：1；Chrome 控制面未暴露浏览器版本，manifest 已以 `null` 和原因记录，不影响冻结的 `1440×900 / Chrome extension UI` 合同。

## 审查链

### 首轮审查

首轮审查对 `g1a-20260726-rc2-01` 给出 `RC_FREEZE=NO`。其中玩家包预先展示评分维度的中立性风险被采纳，旧 cohort 在正式样本开始前标记为 `REJECTED_PRELAUNCH`。

首轮审查 agent 同时违反只读约束，重新打开 #7，并向开发分支提交未授权依赖修改。事件与恢复记录保存在旧 cohort 的 `REJECTED-PRELAUNCH.md` 和远端提交历史中；专用 RC ref 未移动。

### 第二轮完整审查

新的独立 agent 在全新临时 clone 中复核 `g1a-20260726-rc2-02`。其已独立确认：

- manifest SHA-256 为 `076eb4dffb23d2c5262e856bcb8227b7523cf0a21ad2f01549f1583f0ba4fb64`；
- `rc-dist.tar` SHA-256 为 `40ff0092be687b283bac5a156b0079396dba15ff1f49c9bc909641f9e593a49c`；
- archive 解包后 5 个文件与 `rc-dist/` 逐字节一致；
- artifact、build、scenario `0.4.0`、seed `104729`、initial state `fnv1a32-33a16fbf` 与 RC 源一致；
- host protocol、玩家包 V2、结束访谈的哈希与 manifest 一致；
- 玩家包只包含中性任务和开放式 `INITIAL_OBSERVATION`，访谈只在完成、下载、清空之后发放；
- A01–A07、`3+3+1`、A08 起替补、`1440×900`、Chrome extension UI 已冻结；
- `M-A`、`M-B`、`M-C`、`TECH-A99`、`TECH-P00` 与旧 cohort 均不进入正式分母；
- Gate 1H 为 `PENDING`，Gate 2 为 `LOCKED`，RC 无 Gate 2 实现；
- 首轮审查越权修改的 package 与 lock 已恢复为审查前及 RC 对应 blob。

### 开跑状态补充只读审查

第三个全新微型 agent 只执行 GET，给出 `LAUNCH_STATE=YES`：

- `refs/heads/codex/gate1-rc-20260726.2` = `eeaa5fe2c1b4cfd68d8be73ba26b463feeed08d6`
- `refs/heads/codex/gate1-react-web` = `3cba4800c5fea3581a5bb1e41fd0e7596e8d226d`
- Issue #7 = `CLOSED`
- Issues #9–#16 = `OPEN`
- #10–#16 的标题依次对应 A01–A07

第二轮完整审查员接收这份独立 GET 补证后，最终给出 `RC_FREEZE=YES`。

## 开跑边界

- 允许启动：A01，随后按逐场封存纪律完成 Batch 1；
- 禁止把任何审计 agent 计入正式样本；
- 正式样本尚未开始时，本记录不构成 Gate 1A 结论；
- Gate 1H：`PENDING`；
- Gate 2：`LOCKED`。
