# `<sampleId>` 有效性裁定 V2

## 结论

`VALIDITY=<VALID | INVALID_TECHNICAL | VALID_NEGATIVE_OUTCOME>`

- 样本编号：
- cohort：`g1a-20260727-rc9-01`
- candidate attempt：
- candidate manifest ID / hash：
- independent review ID / hash：
- 该 CM/C 的完整 IR history：

| IR ID | status | review record hash | technical-invalid reason hash | rejection hash |
|---|---|---|---|---|
|  |  |  |  |  |

- 是否枚举该 CM/C 的全部 IR：
- 是否不存在实质失败 IR：
- seal attempt / record hash：
- sealed candidate index hash：
- agent task：
- 是否进入七个有效样本分母：
- 替补编号（如有）：
- 裁定者：
- 裁定 UTC：

## Candidate 与 authority

- source SHA：
- dependency integration SHA：
- build ID：
- artifact SHA-256：
- archive SHA-256：
- scenario：`0.5.0`
- schema：`gate1-playtest-v2`
- protocol：`weekly-management-slice-playtest-v0.2`
- player packet hash：
- interview hash：
- capture host hash：

说明 candidate manifest、全部 IR 历史、seal record、sealed candidate index 与构建
指纹是否形成完整闭环。任一不一致，或存在实质失败 IR 时立即停止，不继续产品
裁定。

## 隔离与只读

- `fork_turns=none` 证据：
- 全新应用会话证据：
- 前序原型暴露：
- 上下文污染：
- 与其他 RC9 场次 overlap 审计：
- 只读纪律：
- 主持策略泄漏或代操作：

## Capture 证据

- `captureKind`：
- `finalTick` / `blockedAtTick`：
- `isComplete`：
- 服务端 raw：
- 服务端 raw 实际 SHA-256 / bytes：
- SHA sidecar 路径 / 声明的 raw SHA-256：
- canonical receipt 路径 / 声明的 raw SHA-256 / bytes：
- 浏览器下载实际 SHA-256 / bytes：
- sidecar 声明是否匹配服务端 raw：
- receipt 声明是否匹配服务端 raw：
- 浏览器下载是否逐字节匹配服务端 raw：
- `allClaimsMatchServerRaw`：
- 保存成功后才清空：
- agent 原文路径：

若为 blocked，说明它为何是原型自身可复现阻断或为何属于技术无效。负面结果本身
不是无效理由。

## Legacy 编辑人工裁定

| Week | action IDs | 数量 | 证据/理由 |
|---|---|---:|---|
| 1 |  |  |  |
| 2 |  |  |  |

该栏只作 V0.1 诊断，不参与 RC9 PASS。

## V2 管理承诺人工裁定

逐个 `decisionIntentId + weekIndex` 记录：

| intent | Week | machine disposition | 人工有效 | choice set 合格 | 持久后果 | 证据/理由 |
|---|---:|---|---:|---:|---:|---|
|  |  |  |  |  |  |  |

核对：

- 至少两个可达、后果可见的 `non-dominated` option；
- 玩家明确选择，不是 CTA、默认焦点或键盘误提交；
- before/final decision hash 与最终状态一致；
- undo/redo 和同意图聚合正确；
- consequence refs 在状态、界面或 recap 中兑现；
- 其他意图没有污染该 intent；
- raw 中确有对应动作，未人工补造。

## 人工—机器差异

| candidate ID | 机器结果 | 人工结果 | raw/recap/访谈证据 | 理由 |
|---|---|---|---|---|
|  |  |  |  |  |

没有差异时写 `none`，不得留空。

## 产品证据

- 初始观察：
- 两周流程：
- 预测变化与原因：
- 人物及影响：
- 地图动作与影响：
- 第二周完整检查：
- 第二周完整重排：
- comparison 中立性：
- 持续后果可见性：
- 主持提示：
- 技术中断：

## 症状与根因聚类

| 症状 ID | 复现 | P0/P1/P2 建议 | 根因 cluster | 是否影响 validity |
|---|---|---|---|---|
|  |  |  |  |  |

缺陷和负面体验必须保留，即使样本技术无效。

## 最终理由

用可核验证据说明为何属于：

- `VALID`；
- `VALID_NEGATIVE_OUTCOME`；
- 或协议允许的具体 `INVALID_TECHNICAL`。

不得以策略差、理解失败、承诺数不达标、P0/P1 或不符合设计者偏好作为技术无效
理由。

## 状态锁

```text
Gate 1A = <NOT_STARTED | IN_PROGRESS | 最终代理结论>
Gate 1H = PENDING
Gate 2  = LOCKED
```
