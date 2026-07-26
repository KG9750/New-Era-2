# Gate 1A RC 冻结前审计记录

## 结论

`g1-rc-20260726.2` 已满足进入独立冻结复核的技术条件。本记录不是正式代理样本；`TECH-P00`、`TECH-A99`、`M-A`、`M-B`、`M-C` 均不得计入 A01–A07。

## RC 身份

| 字段 | 冻结值 |
|---|---|
| RC ref | `refs/heads/codex/gate1-rc-20260726.2` |
| Git SHA | `eeaa5fe2c1b4cfd68d8be73ba26b463feeed08d6` |
| Git tree | `63a90de7a021aac407109e8eafa499375b80ddde` |
| source tree manifest SHA-256 | `c6f5ed5289257584eddbb563c8ac63d5c614c0cd01842110e196e572cdef8ca4` |
| build ID | `g1-rc-20260726.2` |
| artifact SHA-256 | `dfcc2ba275128bf0e6c14097d35dcc87600b6d9ee1a55257d25e691c7410f174` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| fixed seed | `104729` |

冻结构建生成后、运营证据提交前的远端只读核验中，`codex/gate1-rc-20260726.2` 与当时的 `codex/gate1-react-web` 均指向上述 Git SHA。运营证据随后只提交到开发分支；RC ref 是不可变测试引用，后续运营提交不得移动该 ref。

## 双 clean clone 复算

审计使用两个互不依赖的 clean clone，二者 HEAD 均为冻结 Git SHA，且工作树 clean：

- clone A：`/private/tmp/new-era-g1a-audit-a.KBhY4I/repo`
- clone B：`/private/tmp/new-era-g1a-audit-b.h25x8r/repo`

两者均执行：

```bash
npm ci
npm run rc:build -- \
  --build-id g1-rc-20260726.2 \
  --git-sha eeaa5fe2c1b4cfd68d8be73ba26b463feeed08d6
```

结果：

- 两次构建均得到同一 `artifactHash`；
- 两次 `npm ci` 均成功，审计时报告 0 vulnerabilities；
- clone A 通过 lint、7 个 Vitest 文件中的 44 项测试、`rc:verify`；
- clone A 的 Chromium E2E 在 `1440×900` 与 `1280×720` 两个项目上均通过，共 2/2；
- E2E 覆盖真实下载 payload、匿名字段、结束清空、可见焦点、非颜色状态、横向溢出，以及 console/page error；
- clone B 独立复算得到同一构建内容哈希。

冻结构建元数据的文件校验：

| 文件 | SHA-256 |
|---|---|
| `rc-dist/artifact-manifest.json` | `d6906dc39c78b0c826e45a0673c41786c92720f6f501eb3cd0d40a9398c7a626` |
| `rc-dist/rc-build.json` | `331932966b16bfff3e81b979938d401df019f4c9486885e3d6d04b644f949aa3` |
| `rc-dist.tar` | `40ff0092be687b283bac5a156b0079396dba15ff1f49c9bc909641f9e593a49c` |

## TECH-P00 浏览器审计

`TECH-P00` 由独立 agent 仅通过 Chrome 玩家界面执行，未读取或修改仓库、源码、测试、Issue、开发者控制台或其他样本记录。

动作顺序：

1. 创建匿名编号 `P00` 的固定初态会话；
2. 展开完整周计划；
3. 选中两个不同人物的活动块并批量改为“学习”；
4. 撤销该批量事务；
5. 在地图开启南侧短通路；
6. 下载匿名 JSON；
7. 结束并清空会话。

可见结果：

- 批量事务显示 `action-0001`，同一动作影响 2 个活动块；
- 撤销回执引用 `action-0001`，两个活动块恢复原计划；
- 地图由北侧绕行 860 米 / 损耗 6，改为南侧短通路 470 米 / 损耗 2；
- 粮食预测由 3–11 变为 7–15，维修保障由 3–5 变为 2–4；
- 页面显示已导出 tick 54 的匿名记录；
- 清空后返回“开始匿名新会话”入口。

浏览器下载事件监听在 10 秒后超时，但导出文件实际落盘并由运营负责人按 SHA-256 封存为：

- `evidence/TECH-P00-export.json`
- SHA-256：`2342085a2b61c24c0a7c3b4a88336ba84f4e45f46d4295a4f9b81d6c2dcf9c21`

该 JSON 的 RC 指纹与冻结值一致。其 viewport 元数据为 `1696x1503`，因此 `TECH-P00` 只证明候选编辑、撤销、地图、导出和清空证据链，不证明正式 cohort 的 `1440×900` 环境。正式 A01–A07 仍必须逐场核对冻结 viewport。

## 边界

- 本记录只支持 `RC_FREEZE` 独立复核，不预先给出 Gate 1A 结论。
- A01 启动前必须由新的独立 agent 校验 cohort manifest、RC archive、协议与 Gate 锁。
- Gate 1H 保持 `PENDING`。
- Gate 2 保持 `LOCKED`，且当前 RC 不含 Gate 2 代码。
