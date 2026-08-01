# ENGINE_EVALUATION_E0 Run 20260801-e0-02 独立审查

## 1. 审查结论

```text
P0=0
P1=0
P2=2
REVIEW_PASS
```

本结论仅表示：冻结证据准确记录了本 run 在 Phase 1 source freeze 处失败并硬停止，足以作为失败 evidence 发布。

本结论明确不表示：

```text
ENGINE_EVALUATION_E0=PASS
ENGINE_EVALUATION_E0=COMPLETE
ENGINE_GATE=PASS
ENGINE_GATE=CONDITIONAL
ENGINE_GATE=FAIL
Godot production foundation authorized
```

当前边界必须保持：

```text
ENGINE_EVALUATION_E0=INCOMPLETE
ENGINE_GATE=NOT_RUN
ENGINE_GATE_RECOMMENDATION=DO_NOT_ADJUDICATE
GODOT_PRODUCTION_FOUNDATION=NOT_AUTHORIZED
GATE_1H=PENDING
GATE_2=LOCKED
```

允许仅发布并永久保留本 run 的失败 evidence。不得据此继续、修补、amend 或重用
`20260801-e0-02`，不得运行 Phase 2/3，不得裁定 `ENGINE_GATE`。任何后续 E0 都必须使用
新 run id、新 Owner 精确授权、新 source commit 和新 source archive。

## 2. 审查绑定

| 字段 | 值 |
|---|---|
| Run ID | `20260801-e0-02` |
| Evidence staging | `/private/tmp/new-era-godot-engine-e0-staging-20260801-e0-02` |
| Review worktree | `/private/tmp/new-era-godot-engine-e0-worktree-20260801-e0-02/repo` |
| Execution base SHA | `b020775522f83c4731ba318905d3d436c2f51f60` |
| Frozen source SHA | `e0622aff7188b9e4774a4d698c39a37e4c5a6908` |
| Plan SHA-256 | `a75f807fb3315834624a3bf69251a8d6cd989fa5ab6891d58b446d6374ea0652` |
| Annex SHA-256 | `c72906b5b4ddfeae45bb2816aac9eda1ac0530c5193a65355d5e33b52fc2c1ed` |
| Pre-review inventory SHA-256 | `f714448e6c7a14fb1e068bceb22b79a7fb50b0dc745041b6954d63508955114f` |
| Source archive SHA-256 | `9761d4f98a536135b2f5176128ba4be2d79128dc0ed47b04bbf5fc291727cc69` |
| Godot identity | `4.7.1.stable.mono.official.a13da4feb` |

审查采用对抗式、证据优先标准：只接受可从冻结文件、Git object 和 raw evidence 独立复算的陈述。

审查全程只读；未修改任何文件，未运行 Godot，未推送，未改变 Git 状态。

## 3. 独立复算结果

### 3.1 Pre-review inventory

- `pre-review-inventory.sha256` 的独立 SHA-256 为
  `f714448e6c7a14fb1e068bceb22b79a7fb50b0dc745041b6954d63508955114f`。
- inventory 共列出 35 个文件；staging 中除 inventory 自身外实际也有 35 个文件。
- 逐文件复算结果为 `35/35 OK`。
- 未发现 inventory 遗漏文件、无对应实体的条目或 hash 漂移。
- inventory 自身由审查输入提供的外部 SHA-256 绑定，不构成遗漏。

### 3.2 Source archive 与 exact source commit

独立复算确认：

- source SHA `e0622aff7188b9e4774a4d698c39a37e4c5a6908` 是 commit object；
- 其唯一 parent 为 execution base `b020775522f83c4731ba318905d3d436c2f51f60`；
- 对 exact source SHA 及 pathspec `spikes/godot-engine-evaluation-e0` 重新生成的
  `git archive --format=tar` 与 `02a-source-archive.tar` byte-for-byte 一致；
- 重算 archive SHA-256 为
  `9761d4f98a536135b2f5176128ba4be2d79128dc0ed47b04bbf5fc291727cc69`；
- tar 共 34 个 entries，其中 26 个文件；source commit 对应 subtree 也是 26 个 tracked 文件；
- archive 内 26 个文件与 source commit blobs 逐文件 `26/26 MATCH`；
- `02b-source-archive.sha256` 的声明值与重算值一致。

因此，archive 忠实封存了失败 source commit 的完整 E0 source subtree；archive 的确定性
陈述成立。这里的 PASS 只表示 archive/tree 绑定正确，不表示被封存的 source 符合
source-freeze scope。

### 3.3 Source-freeze 分类

独立复算得到：

```text
declared inventory entries = 12
actual tracked entries      = 26
unexpected .godot files     = 13
inventory self unbound      = true
classification              = SOURCE_FREEZE_SCOPE_FAIL
```

- `SOURCE_INVENTORY.sha256` 声明的 12 个 intended source 文件均存在，且 `12/12` hash
  与 exact source commit 一致；
- actual tree 比 declared inventory 多 14 个 tracked 文件；
- 其中 13 个为 `.godot/` editor-generated cache；
- 第 14 个为 tracked 的 `SOURCE_INVENTORY.sha256` 自身，未由其内容绑定；
- `02-source-inventory.sha256`、`03-project-manifest.json`、`11-scope-audit.json`、
  `logs/phase1-source-freeze-failure.txt` 与 Git tree 对上述数字和分类一致。

因此，`SOURCE_FREEZE_SCOPE_FAIL` 是正确且唯一的 source-freeze 分类。提交后的立即硬停止
符合计划；不得通过删除 cache、amend source commit 或覆盖 archive 把本 run 改写为成功 run。

### 3.4 Phase 1 raw evidence 与报告

- nominal JSON 与 log payload 完全一致：`Ground=2304`、`Detail=576`、`Overlay=144`、
  `total=3024`；
- stress JSON 与 log payload 完全一致：`Ground=36864`、`Detail=9216`、`Overlay=2304`、
  `total=48384`；
- 两个成功 runner 均记录 3 个 `TileMapLayer`、一个 `Camera2D`、正确 fixture id、grid 与 cell count；
- missing-scene、bad-resource-type、fixture-mismatch 三个失败向量的 JSON 与 log payload
  分别完全一致；
- `04-command-manifest.json` 记录的预期退出码分别为 `21`、`22`、`23`；
- Phase 1 Godot raw logs 没有回显 ordered argv，command manifest 将其明确标为
  `ARTIFACT_BOUND_RECONSTRUCTION`，报告也公开了这一限制，没有伪装成 `RECORDED_EXACT`；
- deterministic archive 的两次生成 hash 一致，且本次独立复算再次确认 byte-for-byte 一致；
- 报告状态表的 `PASS=10 / FAIL=1 / NOT_TESTED_OR_MISSING=7 / ENGINE_GATE_NOT_RUN=1`
  与表内项目计数一致。

报告没有把 check-only、headless runner 或 editor 截图扩大解释为 Phase 2/3、export、输入、
窗口性能或 ENGINE_GATE 通过。

### 3.5 Phase 2、Phase 3 与 ENGINE_GATE

冻结 evidence 中没有以下 Phase 2/3 artifacts：

```text
05-import-write-set.json
06-headless-repeat-results.json
07-editor-session.json
08-runtime-input-camera.json
09-performance-raw.json
10-export-manifest.json
```

报告和 command manifest 均明确记录：

- Phase 2 import、headless repeat、export、local launch：`NOT_TESTED / MISSING`；
- Phase 3 read-only editor、OS input、resize、performance：`NOT_TESTED / MISSING`；
- distribution signing、Gatekeeper、notarization、cross-machine：`NOT_TESTED`；
- `ENGINE_GATE=NOT_RUN`；
- recommendation 为 `DO_NOT_ADJUDICATE`。

这些状态与计划的 hard-stop 和 ENGINE_GATE decision rules 一致。现有证据既不能支持
`PASS` 或 `CONDITIONAL`，也不足以将 Godot 引擎裁为 `FAIL`。

### 3.6 Product、scope 与 Gate 边界

- source commit 相对 execution base 的 26 个 changed paths 全部位于
  `spikes/godot-engine-evaluation-e0/`；
- 未发现 `addons/`、插件、autoload、正式素材或玩法规则实现；
- 未发现产品地图、产品 UI、React 权威规则或 Gate evidence 的读写证据；
- TypeScript simulation authority 未改变；
- evidence-only lineage 被明确禁止 merge/cherry-pick 到 production ancestry；
- `Gate 1H=PENDING`、`Gate 2=LOCKED`、地图 runtime 和生产素材保持锁定；
- C04/C05 状态未因本 run 改变；Godot production foundation 未获授权。

## 4. Findings

### P0

`0`

未发现会导致失败分类、source/archive 身份、Gate 边界或 evidence publication 根本失真的问题。

### P1

`0`

未发现会阻止仅发布本失败 evidence 的重大问题。

### P2-1：截图扩展名与实际编码不一致

**证据**

- 文件路径为 `screenshots/editor-save-close-reopen.png`；
- 文件 metadata 与 magic bytes 表明其实际格式为 JPEG；
- 尺寸为 `1392×768`；
- 文件 hash `37dc92e0aaaed76ba2e6284f029ec17f7ca0256312ecc5dbd1abb42e7d54fb35`
  与 frozen inventory 一致。

**影响**

不会改变截图像素内容、source-freeze failure 或 Gate 结论，但 `.png` 扩展名可能使严格按
扩展名选择 decoder、MIME 或 publication metadata 的工具产生误判。

**最小修正**

不得修改或重编码 frozen staging 文件。发布 final inventory 时保留原路径和原 hash，
同时由本审查永久登记：

```text
declared_path_extension=.png
detected_media_type=image/jpeg
pixel_dimensions=1392x768
```

### P2-2：单张最终态截图不能独立证明完整 save/close/reopen 时序

**证据**

截图可见 `E0.tscn`、`New Era E0 Disposable Evaluation` 项目标题、Godot
`4.7.1.stable.mono`、scene root 和工程文件列表。但证据包只有单张最终打开状态截图，
没有 before/close/reopen 的连续截图、视频、带时间序列的 GUI log 或 OS event trace。

**影响**

截图足以作为 editor、project、scene 和最终打开状态的 GUI witness，但不能由独立 reviewer
单凭该文件证明完整的 save → close → reopen 时序。因此，报告中该项 `PASS` 的可采信范围
必须受限，不得扩大解释为 Phase 3 editor/runtime/render PASS。

**最小修正**

不修改 frozen staging。由本审查固定解释边界：

```text
PROVES: final editor/project/scene identity and open-state witness
DOES_NOT_INDEPENDENTLY_PROVE: complete save/close/reopen temporal sequence
DOES_NOT_PROVE: Phase 3 runtime, render, input, resize, or performance
```

该限制不改变已经独立成立的 `SOURCE_FREEZE_SCOPE_FAIL`。

## 5. 发布与后续授权边界

`REVIEW_PASS` 只允许将以下内容作为失败 evidence 闭环发布：exact failed source archive、
raw JSON/logs/截图、source-freeze failure report、本独立审查、`DO_NOT_ADJUDICATE`
recommendation、final inventory，以及按既有 no-clobber、durable remote/ref 和 readback 规则
完成的 evidence-only publication。

发布后仍必须保持：

```text
RUN_20260801_E0_02=FAILED_AND_FROZEN
ENGINE_EVALUATION_E0=INCOMPLETE
ENGINE_GATE=NOT_RUN
ENGINE_GATE_RECOMMENDATION=DO_NOT_ADJUDICATE
```

本审查不允许继续 Phase 2/3、修改或 amend source commit、覆盖 source archive、把本 run
包装为 E0 PASS、裁定 ENGINE_GATE、授权 Godot production foundation、改变 Gate 1H/Gate 2/
地图/C04/C05/TypeScript 权威状态，或 merge/cherry-pick source/evidence lineage 到
production ancestry。

## 6. 最终判定

```text
P0=0
P1=0
P2=2
REVIEW_PASS
FAILURE_EVIDENCE_PUBLICATION=ALLOWED
E0_CONTINUATION=NOT_ALLOWED
ENGINE_GATE_ADJUDICATION=NOT_ALLOWED
```

`REVIEW_PASS` 的对象是“本失败 evidence 的真实性、可复算性和边界表达”，不是 Godot、
E0、source freeze 或 ENGINE_GATE。

