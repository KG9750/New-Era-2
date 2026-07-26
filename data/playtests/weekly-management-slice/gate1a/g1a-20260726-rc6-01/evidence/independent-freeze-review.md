# Gate 1A RC6 独立冻结复核

## 最终裁定

`RC_FREEZE=YES`

- P0：0
- P1：0
- P2：1

reviewer 未参与 RC6 实现和运营冻结制备。本轮以 Certo `复审` 模式从远端
fresh clone 只读复算；未修改文件、分支、RC ref、Issue 或远端状态，未创建或
启动 A16–A22。

## 冻结身份

| 字段 | 复算值 |
|---|---|
| 开发分支提交 | `03750f5ba1855091776fbd73f7674a0c20b42517` |
| RC ref | `refs/heads/codex/gate1-rc-20260726.6` |
| RC SHA | `affc5d8a0c9664a3724d1c31cb3d67682c818af9` |
| RC tree | `58d37186e6cc0491c7c819ed5e2ddda760d77e4f` |
| source-tree hash | `33c9ad2eb1b586790497445313d61905646a0aebdc741f085c68ea7ea95c9576` |
| manifest SHA-256 | `d783334effd1515ae29dfe844277f4e5341459dd97617b25139381440848ed09` |
| artifact hash | `096a4cd2d971be5b0503f1727ec02505f3d3a1a54a2c01d2afa0ff369d1df2ee` |
| archive SHA-256 | `a8de5f7ab63e1afc5d16c3279e6db37602779a90d3d44dec2e17df0a68394385` |

## 独立复算

- `npm ci` 通过，0 vulnerabilities；
- lint 通过；
- Vitest 7 个文件、47/47 通过；
- fresh RC build 与冻结 artifact hash 一致；
- `rc:verify` 通过；
- fresh `dist` 与冻结 `rc-dist` 逐字节一致；
- Chromium `1440×900` 为 8/8，`1280×720` 为 8/8，总计 16/16；
- deterministic tar 的成员、顺序、权限、属主、时间戳和哈希一致；
- manifest sidecar 与全部引用哈希一致。

## RC5 P1 关闭

RC6 的 blocked capture 已证明：

- 原型中途可复现阻断可保存 raw、SHA sidecar、canonical receipt 与浏览器下载；
- 阻断原因限制为 1–240 字；
- `blockedAtTick=finalTick<2010`、`isComplete=false`；
- 唯一 `blocked-capture-created`，禁止混入 `export-created`；
- 保存成功前禁止清空；
- 完整场次仍严格要求 tick 2010、两周、两份 recap 和唯一
  `export-created`。

因此 RC5 原 P1“中途阻断无法留存三件套”已解决。

## 治理核验

- A09 为 `SUPERSEDED_RC_REVOKED_AFTER_SESSION`，不进入任何分母或后续 P1
  聚类；
- A10–A15 未实例化；
- A01–A15 编号不复用；
- RC6 roster 为 A16–A22，批次 `3 + 3 + 1`，替补从 A23 开始；
- RC5→RC6 未修改模拟、场景、数值、阈值或 Gate 2；
- Gate 1H=`PENDING`；
- Gate 2=`LOCKED`。

## 唯一残余 P2

blocked 专属 UI 测试尚未单独注入 HTTP 失败，并直接比较首次与重试 POST
bytes。当前实现复用已验证的 `pendingCaptureRef`，complete 路径已有同 raw
公开断言。该项建议后续补强，但不构成冻结阻断。

## 开跑边界

本裁定允许在记录提交后关闭 #7、创建 A16–A22，并按逐场封存纪律启动 Gate
1A。它不表示 Gate 1A 已执行或通过，更不表示 Gate 1H 已执行或 Gate 2 已解锁。
