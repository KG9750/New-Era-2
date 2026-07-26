# RC8 A30 / M-C 并发会话污染事件

## 裁定

| 对象 | 最终处置 |
|---|---|
| `A30 / 6e3bad8c-234f-4171-a843-8bd815ea7e6c` | `INVALID_TECHNICAL_CONCURRENT_SESSION_CONTAMINATION` |
| `M-C / 0809d5c5-8f73-48ca-a25e-0cb73d8dc625` | `QUARANTINED_NOT_FORMAL_SAMPLE` |
| Gate 1A 分母 | `0/7 valid` |
| 替补 | `A37` |
| Gate 1H | `PENDING` |
| Gate 2 | `LOCKED` |

测试运营负责人 agent `/root/gate1a_test_ops_lead` 于
`2026-07-26T16:16:15Z` 作出本裁定。它只影响样本有效性，不构成 RC8 产品
玩法失败，也不改变 Gate 1H 或 Gate 2。

## 原始证据

### A30 标记的 candidate capture

- raw：`../captures/g1-rc-20260726.8-A30-6e3bad8c-234f-4171-a843-8bd815ea7e6c.json`
- receipt：同名 `.receipt.json`
- sidecar：同名 `.sha256`
- bytes：`62403`
- SHA-256：`1cc1e64092013ea3264558cb2814b2c2bd9a8b404ac32b49d2db3a0f9942b016`
- machine interval：`1785081565221–1785081763969`
- UTC：`2026-07-26T15:59:25.221Z–16:02:43.969Z`
- complete / tick `2010` / two weeks / two recaps

### 未授权 M-C capture

- raw：`../captures/g1-rc-20260726.8-M-C-0809d5c5-8f73-48ca-a25e-0cb73d8dc625.json`
- receipt：同名 `.receipt.json`
- sidecar：同名 `.sha256`
- bytes：`63176`
- SHA-256：`f6b62ac9cdea9525df8670e679a4a2a0577d3474f2d883ff8cb6bd157bbde2c4`
- machine interval：`1785081644511–1785081859103`
- UTC：`2026-07-26T16:00:44.511Z–16:04:19.103Z`
- complete / tick `2010` / two weeks / two recaps

两场重叠 `119458 ms`。它们的动作链也不同：A30 标记场在第一周使用化肥；
M-C 场在第二周使用化肥并接受第一周粮食缺口。两份 capture 不是同一 raw 的
重复保存。

## 受委派 agent 的技术审计原文

> 1) 否。我只新建并控制了一个 Chrome 游戏标签页，没有创建、控制或看到第二个游戏页面、标签或会话。
>
> 2) 是。我创建会话前看到匿名编号默认显示为 `M-C`，之后整个会话元数据也始终显示 `M-C`；没有看到 `A30`。
>
> 3) 否。所有操作确实只发生在一个页面，但该页面显示的是 `M-C`，不是 `A30`。
>
> 4) 否。我未收到任何其他玩家的结果或提示。

结束访谈 V4 曾写“将匿名编号填写为 A30”并引用 `6e3bad8c…`。技术审计与该
访谈直接冲突。由于 collaboration 工具没有暴露 agent session UUID，机器记录
无法消解冲突；两组陈述全部保留，均不用于聚合产品指标。

## 根因边界

- RC8 入口的匿名编号默认值是 `M-C`；
- 正式合同要求每个 agent 使用全新且相互隔离的应用会话；
- 运行时同一 host 实际出现两个重叠 session；
- 没有证据证明上下文答案泄露、源码读取或产品自身流程阻断。

因此 reason code 仅为
`INVALID_TECHNICAL_CONCURRENT_SESSION_CONTAMINATION`。不得把它扩大写成
产品失败，也不得把 M-C 改名补进 A30。

## 不可变处置

1. 六个 capture 文件保持原字节；
2. A30 编号永久保留、不复用；
3. M-C 只作为未授权并发污染证据隔离；
4. A37 为首个替补；
5. A31 前必须完成 host、浏览器页面和 capture inventory 的逐场隔离预检。
