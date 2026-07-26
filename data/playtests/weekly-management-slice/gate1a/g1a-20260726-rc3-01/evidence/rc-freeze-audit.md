# Gate 1A RC3 冻结审计记录

## 结论

Vite 8 技术基线修正已经完成，`g1-rc-20260726.3` 满足进入独立冻结复核的
技术条件。本记录不是最终 `RC_FREEZE=YES` 决定，也不是正式代理样本。

旧 cohort `g1a-20260726-rc2-01` 在 A01 启动前因实际使用 Vite 7.3.6 被判定为
`RC_FREEZE=NO`，其档案保留但标记 `SUPERSEDED`。

## RC 身份

| 字段 | 冻结值 |
|---|---|
| RC ref | `refs/heads/codex/gate1-rc-20260726.3` |
| Git SHA | `57621e670e69a2b4c7c283a6614ab1bdefd71ca1` |
| Git tree | `60bfedd43321d5f7ff29a9e7b6dcc5e49fe25536` |
| source-tree hash | `6c2ffe8e0edd2097f88d2589313ecd41a68a0e3cf68674302b459a87440efb36` |
| source-tree algorithm | `sha256-git-blob-path-manifest-v1` |
| source-tree file count | 37 |
| build ID | `g1-rc-20260726.3` |
| artifact hash | `6c173733662fdb79160d6188c4fb8883d87d2e68dea5c47c632e373b13b2c725` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| fixed seed | `104729` |

`sha256-git-blob-path-manifest-v1` 的规范输入是 RC 提交中所有已跟踪
`prototype/` 文件，按路径升序，每行严格序列化为
`<path><TAB><Git blob object ID><LF>`，包含最终 LF，不包含 file mode 或 object type。

## 技术基线修正

| 包 | RC2 | RC3 |
|---|---|---|
| Vite | 7.3.6 | 8.1.5 |
| `@vitejs/plugin-react` | 5.x | 6.0.4 |
| Vitest | 3.2.7 | 4.1.10 |
| `vite-node` | Vitest 间接提供 | 6.0.0 显式依赖 |
| Playwright | 1.62.0 | 1.62.0 |

首轮升级验证在 RC 构建的初态哈希步骤暴露 `vite-node` 不再由 Vitest 4
隐式提供；将它作为显式开发依赖后，RC 构建与 E2E 恢复通过。未修改玩法规则、
场景、玩家包或 Gate 阈值。

## 双 clean clone 复算

两个互不依赖的 clean clone 均检出
`refs/heads/codex/gate1-rc-20260726.3`：

- clone A：`/private/tmp/new-era-g1a-rc3-a.Z0OJZ1/repo`
- clone B：`/private/tmp/new-era-g1a-rc3-b.5zxkx7/repo`

两者均执行：

```bash
npm ci
npm run rc:build -- \
  --build-id g1-rc-20260726.3 \
  --git-sha 57621e670e69a2b4c7c283a6614ab1bdefd71ca1
```

结果：

- Node `v24.18.0`；
- 两次 `npm ci` 均成功，审计时 0 vulnerabilities；
- 两次构建均得到同一 artifact hash；
- clone A 的 lint 通过；
- Vitest 7 个文件、44 项测试通过；
- `rc:verify` 通过；
- Chromium E2E 在 `1440×900` 与 `1280×720` 两个项目均通过，共 2/2；
- E2E 覆盖真实下载 payload、匿名 allowlist、清空隔离、键盘激活、可见焦点、
  非颜色状态、横向溢出及 console/page error。

冻结文件：

| 文件 | SHA-256 |
|---|---|
| `rc-dist/artifact-manifest.json` | `dfc52462e57a43ee150e77f8701f5084ae06ba0928f56972693a921102725aae` |
| `rc-dist/rc-build.json` | `2ff64c82c2341758d339e5e1e987286be8c13bb93c86e4f4570952924a1cb4ad` |
| `rc-dist.tar` | `9813823966382d6c01bcb175a6d477fd6d96d7d78e5fb9b5fc034c5063989c63` |

## 独立 UI 审计

全新 agent `TECH-A98` 只通过 RC3 玩家 UI 完成：

- 周初三个问题复述；
- `action-0001` 两格批量修改与撤销；
- 北侧绕行切换南侧短通路，并观察粮食/维修联动；
- 第一周与第二周复盘；
- tick 2010 导出回执；
- 结束并清空后返回新会话入口。

无流程阻断。完整记录见 `evidence/TECH-A98-ui-audit.md`。该场不计入 A01–A07。

## 边界

- 当前状态为 `FROZEN_PENDING_INDEPENDENT_REVIEW`；
- A01 前仍须由未参与实现、构建和 TECH-A98 的新 agent 从远端复核 ref、
  manifest、archive、协议与 Gate 锁；
- Gate 1H 保持 `PENDING`；
- Gate 2 保持 `LOCKED`；
- Gate 1A 的任何结论均不能解锁 Gate 2。
