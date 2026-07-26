# Gate 1A RC5 独立冻结复核

## 最终裁定

`RC_FREEZE=YES`

- P0：0
- P1：0
- P2：0

两名未参与 RC5 实现、TECH-P98 和冻结制备的 reviewer 分别使用 fresh clone 与
GitHub 只读 API。两轮发现的全部 P1 均在正式样本启动前关闭，并由原发现者增量
复核。审查员未修改共享工作区、clone tracked 文件或远端状态，未创建或启动
A09–A15。

## 审查身份

| reviewer | fresh clone | 作用 |
|---|---|---|
| A | `/tmp/new-era2-rc5-audit.1cIEmq/repo` | 全量技术审查、Issue 治理与 Gate 2 语义复审 |
| B | `/tmp/new-era-2-rc5-review.VFRRLl/repo` | 独立全量复算、权威协议交叉审查与最终增量复核 |

最终远端状态：

- 运营冻结与协议修正提交：`61fbd8e50a8b72a3cef052f20b30cd24674626f7`
- RC ref：`refs/heads/codex/gate1-rc-20260726.5`
- RC SHA：`2d40aa102bd51107c07cbe176f798a93a37663f3`
- RC tree：`c152f1487ec370a4b6534adf0bac92336b8186d8`

## 技术核验

### RC、源树与提交边界

- 远端 RC ref 精确指向 RC SHA；
- RC5 tracked `prototype/` 共 39 个文件；
- source manifest 独立复算为
  `9a81cf360f9b9efd80e67327ba0fc0d4723ed3865421eaded81219f198502d27`；
- 运营提交相对 RC5 的 `prototype/` 零差异；
- 后续协议修正只改两份权威文档、manifest 和 sidecar，RC artifact 未变。

### Manifest 与 archive

- 最终 `cohort-manifest.json` SHA：
  `4b81bc1f0277682867cf75f4f8694fc2fd77dbc5246e88c9245e76d3384b6fc6`；
- sidecar 校验通过；
- manifest 全部 9 个 path/SHA 引用 9/9 通过；
- 玩家测试协议最终 SHA：
  `b1370041b26c75db3d533b16db7c8918aa9a5c32f5a08eabf14a8a5e06850a73`；
- artifact manifest 内四个 payload 文件的大小和 SHA 全部匹配；
- `rc-dist.tar` SHA：
  `c449247c34615e7fb2f19e8372588f70a26dba55b7203c1faac31f25721b52c3`；
- archive 共八个按路径排序的唯一条目，无重复，uid/gid 为 0，
  owner/group 为 `root/root`，日期统一为 2000-01-01；
- 未发现 macOS metadata，解包后与冻结 `rc-dist/` 逐字节一致。

### Fresh build 与测试

两名 reviewer 的独立复算结果一致：

- Node `v24.18.0`，npm `11.16.0`；
- Vite 8.1.5，Vitest 4.1.10；
- `npm ci` 成功，0 vulnerabilities；
- fresh build artifact：
  `ec09284f9dfb7976356a510b1039092f85dc91dd6eb94e649ca138040431d65f`；
- initial state：`fnv1a32-33a16fbf`；
- fresh `dist` 与冻结 `rc-dist` 零差异；
- lint 通过；
- Vitest 7 文件、47/47 通过；
- capture host `node --check` 通过；
- `rc:verify` 通过；
- Chromium `1440×900` 5/5、`1280×720` 5/5，共 10/10 通过。

Reviewer B 记录到默认 `/opt/homebrew/bin/node` 的本机动态库断链；显式使用项目
冻结的现有 Node 24 后全部验证通过。这是审查机环境观察，不是候选制品缺陷，
最终不保留为 RC P2。

### Capture 与 TECH-P98

- loopback host 是 artifact 内冻结 payload，只绑定 `127.0.0.1`；
- manifest 启动命令显式提供冻结 `--capture-dir`；
- TECH-P98 raw 为 62761 字节，SHA 为
  `5319377ce23276fa41e40d0be873d01f44d3f68380bf8e90eb11ebb60f42e498`；
- raw、SHA sidecar 与 receipt 完全自洽；
- payload 为 tick 2010、两周完成、两份 recap、唯一终局 `export-created`；
- 隐私扫描未发现邮箱、私人路径、外部 URL、IP、姓名、手机号、微信号或
  operator/player name；
- `P98` 永久排除 Gate 1A、Gate 1H 和未来真人编号分配。

### RC4 历史与中性协议

- RC4 manifest、archive、freeze audit 和 independent review 原样保留；
- A01 的 agent 原始输出、样本记录和有效性裁定原样保留；
- A01 为 `INVALID_TECHNICAL`，不进入 RC5 分母；
- 玩家包不泄露阈值、正确答案、推荐策略或已知缺陷；
- 结束访谈为物理分离文件，只在试玩、保存下载与清空后发放；
- RC5 不存在正式 `samples/` 或 `captures/`，A09–A15 尚未启动。

## P1 发现与关闭

### 第一轮：GitHub 旧 roster 与 Gate 2 语义证据

Reviewer A 初次给出 `P0=0 / P1=2 / P2=0 / RC_FREEZE=NO`：

1. #11–#17 仍为旧 RC4 的可执行席位，#9 仍写旧负责人和 roster；
2. 尚未完成 RC4→RC5 与当前 39 个源文件的 Gate 2 语义扫描。

修正并复审后：

- #9 已统一为 Planck、A09–A15、A16 起替补，并继续 blocked by OPEN #7；
- #10–#17 全部 `CLOSED + wontfix`，只作 RC4 historical/superseded；
- 未创建 A09–A15 Issues；
- RC4→RC5 只增加 Gate 1 capture、保存校验和回归测试；
- 当前 source tree 未发现主题经济、豁免、排名、军备、战斗或相应状态、动作、
  类型、页面和规则；唯一 `theme` 命中是 HTML `theme-color`。

Reviewer A 增量结论为 `P0=0 / P1=0 / P2=0 / RC_FREEZE=YES`。

### 第二轮：权威协议残留旧 roster

Reviewer B 交叉审查发现：

- 被 manifest 直接引用的玩家测试协议仍写 `/root`、A01–A07、A08 起替补；
- 两周切片设计规格仍保留同一旧规则。

因此先给出 `P0=0 / P1=1 / P2=1 / RC_FREEZE=NO`；P2 仅为上述审查机 Node
环境观察。

提交 `61fbd8e50a8b72a3cef052f20b30cd24674626f7` 修正后，Reviewer B 从远端
增量确认：

- 玩家测试协议、两周切片设计规格、运营合同、总控计划和开发计划统一为
  Planck、A09–A15、A16 起替补；
- 历史独立复核报告顶部明确标注旧值只适用最初基线；
- manifest sidecar 与 9 个引用 SHA 全部通过；
- `formalSamplesStarted=false`；
- #7 OPEN，#9 OPEN，#10–#17 全部 CLOSED+wontfix；
- Gate 1H `PENDING`，Gate 2 `LOCKED`。

Reviewer B 最终增量结论为 `P0=0 / P1=0 / P2=0 / RC_FREEZE=YES`。

## 开跑边界

允许：

- 关闭 #7；
- 创建 A09–A15 七个独立 Issues；
- 由 Planck 按 A09–A11、A12–A14、A15 和逐场封存纪律运营。

不代表：

- Gate 1A 已执行或通过；
- Gate 1H 已执行或通过；
- Gate 2 已解锁。

冻结后仍必须保持 `Gate 1H=PENDING`、`Gate 2=LOCKED`，并确保 A09–A15
使用全新独立上下文和相同冻结 RC5。
