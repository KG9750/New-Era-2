# Gate 1A RC4 冻结审计记录

## 结论

`g1-rc-20260726.4` 已关闭 RC3 独立冻结复核发现的两项 P1 状态一致性问题，
满足进入新的独立冻结复核的技术条件。本记录不是最终 `RC_FREEZE=YES` 决定，
也不是正式代理样本。

## RC 身份

| 字段 | 冻结值 |
|---|---|
| RC ref | `refs/heads/codex/gate1-rc-20260726.4` |
| Git SHA | `a769877871f232b3722c02a184ccbc3426950887` |
| Git tree | `efcc989c7f84883242b9fabe99030feca8c60c0a` |
| source-tree hash | `59f67b4e698a3f72e54522c5da479da711c252b95d304fda1c7ca714b6a6baf1` |
| source-tree algorithm | `sha256-git-blob-path-manifest-v1` |
| source-tree file count | 37 |
| build ID | `g1-rc-20260726.4` |
| artifact hash | `0c84ce60f0fd3305a90fac23fcdfbd47cd67b16a6a0b2b72751da11de6cb6b58` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| fixed seed | `104729` |

源树规范输入为 RC 提交中全部已跟踪 `prototype/` 文件，按路径升序，每行
`<path><TAB><Git blob object ID><LF>`，包含最终 LF。

## RC3 阻断关闭

| 编号 | RC3 症状 | RC4 证据 |
|---|---|---|
| `M-C-UI-01` | 补足检修后摘要和定位卡仍显示旧状态 | 摘要与定位卡即时同步为 2 / 2 检修块 |
| `M-C-UI-02` | 第二周主预测 `14–15`，复盘计划 `12–13` | 接受请求后主预测与终局复盘计划均为 `12–13` |

新增两项回归后，Vitest 由 44 项增至 46 项。

## 双 clean clone 复算

两个独立 clone 均检出 `refs/heads/codex/gate1-rc-20260726.4`：

- clone A：`/private/tmp/new-era-g1a-rc4-a.6flMTR/repo`
- clone B：`/private/tmp/new-era-g1a-rc4-b.Oo37q1/repo`

两者均执行：

```bash
npm ci
npm run rc:build -- \
  --build-id g1-rc-20260726.4 \
  --git-sha a769877871f232b3722c02a184ccbc3426950887
```

结果：

- Node `v24.18.0`；
- Vite 8.1.5、plugin-react 6.0.4、Vitest 4.1.10、vite-node 6.0.0；
- 两次 `npm ci` 均成功，审计时 0 vulnerabilities；
- 两次构建得到相同 artifact hash；
- lint 通过；
- Vitest 7 个文件、46 项测试通过；
- `rc:verify` 通过；
- Chromium E2E 在 `1440×900` 与 `1280×720` 共 2/2 通过；
- E2E 覆盖下载 payload、匿名 allowlist、清空隔离、键盘激活、可见焦点、
  非颜色状态、横向溢出及 console/page error。

冻结文件：

| 文件 | SHA-256 |
|---|---|
| `rc-dist/artifact-manifest.json` | `e17610a3f719b497b06696c8a94f1bc69f1357c042e87a72884b5ada46f45914` |
| `rc-dist/rc-build.json` | `bb63417fbb1369de16c6b1d053256f9b36480847fe160fbf9dc086a0fa11cb93` |
| `rc-dist.tar` | `008ea767eb9bf0dac567cf2917d3c19537d4257585ebfc0f2fcadad61764d01a` |

## 独立 UI 审计

全新 agent `TECH-A97` 只通过 RC4 玩家 UI 完成：

- 水泵第 2 个检修块及摘要/定位卡即时一致性验证；
- 南侧短通路及粮食/维修因果验证；
- 两周推进与林禾学习请求；
- 第二周主预测和复盘计划区间一致性验证；
- tick 2010 导出回执；
- 结束并清空后返回新会话入口。

无产品流程阻断。完整记录见 `evidence/TECH-A97-ui-audit.md`，不计入 A01–A07。

## 正式样本协议

正式样本继续使用两阶段协议：开始前只发中性玩家包；完成两周、下载并清空后，
再发统一结束访谈。A01–A07、`3 + 3 + 1`、A08 起替补、同一 RC、上下文隔离、
视口和 Gate 锁均保持不变。

## 边界

- 当前状态为 `FROZEN_PENDING_INDEPENDENT_REVIEW`；
- A01 前必须由未参与实现、构建和 TECH-A97 的新 agent 从远端复核；
- Gate 1H 保持 `PENDING`；
- Gate 2 保持 `LOCKED`；
- Gate 1A 的任何结论均不能解锁 Gate 2。
