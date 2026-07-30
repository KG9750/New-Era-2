# 12 人样板库 V0.1 R1 独立 Codex 复审

**固定受审提交：**
`982e93b981bccb8d7aadc173914bc18363d17cb8`

**比较基线：**
`e860cfb9f3d47b25c47600e872d2c2ad9d83d45e`

**审查方式：** 全新上下文 Codex agent，只读审查；未使用 Claude Code 或任何
外部 LLM

**结论：** `P0=0 / P1=1 / P2=0 / P3=0 / REVIEW_FAIL`

## P1：合法但未包含固定样板来源的候选库会令 validator 抛异常

固定提交在 `validateCharacterSampleLibrary()` 中先确认 source library 自身机器
合同没有 blocked finding，随后调用 `createCharacterSampleBase()` 构造规范
样板。若 source library 合法但不包含 12 个固定来源人物，构造过程会直接抛出：

```text
Error: Missing source character char_b032f4309fc7025b
```

独立 reviewer 使用两种 source 复现：

1. 正式 generator 生成的同 seed、`count: 1` 候选库；
2. 正式 generator 生成的不同 seed、`count: 50` 候选库。

两者都通过 `validateCharacterLibrary()` 自身机器合同，但都不是当前样板包绑定的
来源库。这证明 malformed `null` source 的测试不足以覆盖“结构合法但身份错误”
的 source。

影响：validator 仍不满足对任意反序列化 sample/source 输入 never throw、
fail-closed 的 P1 合同。

最小修复：

- 在构造 canonical base 前预检全部 `SAMPLE_DRAFTS.source_character_id`；
- 任一固定来源不存在时直接返回 blocked findings；
- 增加合法 1 人库与不同 seed 合法 50 人库的 never-throw 回归测试。

## 已通过的原 finding

独立 reviewer 同时确认：

- 固定 schema、library、sample、culture、purpose、gate、pair、source 和
  narrative 的协调篡改均被 blocked；
- source 姓名与 sample 姓名协调篡改时，source 与 sample 都被阻断；
- internal 与 player-hidden renderer/artifact 已分离；
- 玩家版不存在 16 种 MBTI 代码、内部类型或同类型提示；
- internal 与 player-hidden Markdown 均有持久化逐字节 golden test；
- 工程、交涉、医疗、研究、防卫均跨 E/I；
- S09 如实记录生产 `E0/I1`、后勤 `E1/I0`，未冒充八技能全部跨极；
- 至少 10 个场景形成双方都有即时代价与长期风险的真实权衡；
- 重复度 warning 持久化为 `redline_max=3/12`；
- 原三项 P2 已关闭。

## 固定验证

Node `v24.18.0`：

- Vitest：10 files / 114 tests PASS；
- TypeScript：PASS；
- Vite build：PASS；
- `git diff --check e860cfb..982e93b`：PASS；
- `LANG=C` 与 `LANG=zh_CN.UTF-8` 三份产物逐字节一致。

固定 SHA-256：

- JSON：
  `c713af518ecaaad63ed699f7468d4422053c83da400e87eae6833422f4a1f3dc`；
- internal Markdown：
  `ecfd6ebbdb4ae335d30acf1ab99654eff18a6e260597d3ef17391bccdb3b5cae`；
- player-hidden Markdown：
  `7907f18fcb9db9cff326bef44c2e3a76f0dee98ad49eca4ecab9cdc93ad59984`。

审查工作树前后均 clean；reviewer 未修改、stage、commit 或 push。

## 门禁边界

- A1：`NOT_STARTED`；
- E01–E06：`NOT_RUN`；
- MBTI 玩家验证：`NOT_RUN`；
- Gate 1H：未完成；
- 完整 M12、PartyValidation、人口状态机、NPC 往返：未完成。

只有修复本轮 P1 并再次由全新 Codex reviewer 达到 `P0=0 / P1=0`，代码层面
才允许改为 `REVIEW_PASS`。自动化结果不得替代人工门禁。
