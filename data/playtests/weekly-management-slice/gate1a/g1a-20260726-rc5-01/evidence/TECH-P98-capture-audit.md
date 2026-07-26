# Gate 1A RC5 TECH-P98 捕获技术验证

## 结论

`TECH_CAPTURE=PASS`

TECH-P98 使用 RC5 的真实 Chrome 玩家界面完成两周，并形成服务端 write-once
证据三件套。浏览器下载、服务端 raw 文件、SHA sidecar 与 canonical receipt
逐字节一致；保存成功后网页会话可以清空，而服务端证据保持存在。

本场只验证证据采集链，不计入 Gate 1A 或 Gate 1H 正式样本，也不得改作替补。
payload 内既有匿名编号 `P98` 作为永久技术编号保留，不得在未来分配给真人。

## 固定身份

| 字段 | 值 |
|---|---|
| sample | `P98` |
| build | `g1-rc-20260726.5` |
| Git SHA | `2d40aa102bd51107c07cbe176f798a93a37663f3` |
| artifact | `ec09284f9dfb7976356a510b1039092f85dc91dd6eb94e649ca138040431d65f` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| seed | `104729` |
| session | `c5602ff6-cf5d-4277-adda-5b0813630316` |
| viewport | `1440×900` |
| browser profile | Chrome `Speed` |

## 实际流程

TECH-P98 只通过玩家 UI：

1. 补足第二个水泵预防检修块；
2. 开启南侧短通路；
3. 推进第一周并进入复盘；
4. 进入第二周，接受林禾学习请求；
5. 推进至第二周复盘和最终 tick 2010；
6. 点击“下载匿名 JSON”；
7. 等待页面显示“已保存并校验 tick 2010 的匿名记录”；
8. 点击“结束并清空会话”，确认返回固定初态入口。

raw 记录包含 `finalTick=2010`、两份周复盘和终局状态；第一周实际粮食 12，
第二周计划 12–13、实际 12。

## 下载与服务端证据

浏览器 CDP 下载事件：

- suggested filename：
  `g1-rc-20260726.5-P98-c5602ff6-cf5d-4277-adda-5b0813630316.json`
- total bytes：`62761`
- received bytes：`62761`
- final state：`completed`

服务端目录：

`evidence/TECH-P98-capture/`

三件套：

| 文件 | 字节 | SHA-256 或内容 |
|---|---:|---|
| raw JSON | 62761 | `5319377ce23276fa41e40d0be873d01f44d3f68380bf8e90eb11ebb60f42e498` |
| `.sha256` | 129 | 指向同一 raw SHA 和同一文件名 |
| `.receipt.json` | 571 | bytes、SHA、sample、session、build、Git 与 artifact 均匹配 |

操作系统下载文件同为 62761 字节，SHA-256 同为
`5319377ce23276fa41e40d0be873d01f44d3f68380bf8e90eb11ebb60f42e498`。
核验后该下载副本已移动到 macOS 废纸篓；仓库内服务端三件套继续保留。

## 清空与持久性

清空后页面返回“开始匿名新会话”，并显示上一场已从网页内存清空。清空后再次
核对，服务端 raw、sidecar 与 receipt 仍全部存在且互相一致。

## 边界

- 这不是正式玩家样本；
- 这不证明 Gate 1A 或 Gate 1H 通过；
- `P98` 永久排除 Gate 1H 真人编号分配；
- `Gate 1H=PENDING`；
- `Gate 2=LOCKED`。
