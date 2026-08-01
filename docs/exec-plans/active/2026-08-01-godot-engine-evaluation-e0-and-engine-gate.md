# Godot ENGINE_EVALUATION_E0 与 ENGINE_GATE 执行计划

| 字段 | 内容 |
|---|---|
| 项目 | Project-004-New Era 2 |
| 状态 | `PROPOSED_NOT_AUTHORIZED` |
| 日期 | 2026-08-01 |
| 计划工期 | 3–5 个净工作日 |
| 目标 | 用一次默认废弃的合成技术评估，判断 Godot 4.7.1 的基础工具链、编辑器、运行态与 macOS 导出风险是否可接受 |
| 非目标 | 开始 Godot 产品开发、迁移玩法规则、制作正式地图/UI/素材、安装或选定插件、改变任何玩法 Gate |
| Fixture/measurement annex | `2026-08-01-godot-engine-evaluation-e0-fixture-and-measurement-annex-v0.1.md` |
| 独立复审 | R0 `0/5/1`；R1 `0/4/2`；R2 `0/0/1`；R3 targeted `P0=0 / P1=0 / P2=0 / PLAN_REVIEW_PASS` |

---

## 0. 决策结论与当前边界

本计划建立两个此前不存在的技术术语，但不通过建文档自动授权执行：

```text
ENGINE_EVALUATION_E0
  = 一次性、隔离、合成数据、默认废弃的 Godot 技术评估

ENGINE_GATE
  = 根据 E0 的真实运行证据，对 Godot 基础技术风险作出的工程判断
```

二者与现有玩法 Gate 的关系固定为：

```text
E0 PASS
  != ENGINE_GATE PASS
  != Godot production foundation authorized
  != Gate 1H PASS
  != Gate 2 unlocked
```

当前正式路线保持不变：

```text
Gate 1H 真人 PASS
  → React/TypeScript Gate 2 规格与实现
  → Gate 2 PASS
  → 冻结跨引擎迁移合同
  → 一次性迁移与 parity 验证
  → 切换唯一规则权威
  → Gate 3 Godot 战术垂直切片
```

TypeScript 模拟内核在 Gate 2 完成前继续是唯一玩法规则权威。E0 不得读取、重写、
复制或解释正式经营规则；不得建立与 TypeScript 并行演化的 GDScript/C# 规则内核。

若 Owner 希望在 Gate 2 前保留一个极窄的 Godot platform shell，必须在
`ENGINE_GATE PASS` 后另行批准 `OWNER_GODOT_PLATFORM_SHELL_AMENDMENT`，明确可保留
目录、代码、生命周期和删除规则。本计划本身不包含该修订。

## 1. 要回答的五个问题

E0 只回答以下问题：

1. 固定的 Godot 4.7.1 Mono 二进制能否在隔离工程中稳定完成解析、导入、场景加载和退出？
2. 无插件 GDScript 工程能否用合成 atlas、`TileMapLayer`、`Camera2D` 和声明式
   `InputMap` 完成最小 2D 地图呈现与输入闭环？
3. headless 与真实窗口两条运行路径是否都能生成可定位、可复查的日志与性能数据？
4. 本机现有 export template 能否完成一次真实 macOS release export，并运行导出物？
5. 上述结果是否足以把 Godot 的基础工程风险评为 `PASS`、`CONDITIONAL` 或 `FAIL`？

E0 不回答“核心玩法是否好玩”“正式地图是否成立”“最终 UI 应如何组织”“战斗是否
可行”或“Godot 是否已经成为生产引擎”。这些问题仍由各自的玩法、地图和迁移 Gate
决定。

## 2. 权威输入与已确认环境

### 2.1 项目内权威输入

执行前必须重新读取并记录 SHA-256：

1. `AGENTS.md`
2. `CONTEXT.md`
3. `PLANS.md`
4. `docs/agents/game-development-workflow.md`
5. `docs/exec-plans/active/2026-07-26-react-web-gate-1-2-development-plan.md`
6. 本计划
7. `docs/exec-plans/active/2026-08-01-godot-engine-evaluation-e0-fixture-and-measurement-annex-v0.1.md`

Owner 执行授权必须同时绑定本计划 SHA-256、fixture/measurement annex SHA-256 和
exact base ref；annex 是传递性授权输入，不得在授权后由实施者补填或改写。

现有两个项目仅作工作流参考，不作为 E0 起点或通过证据：

- `spikes/godot-ai-smoke`
- `spikes/godot-mcp-native-smoke`

`reference_map_test.gd/.tscn` 是 Node2D 自绘视觉语言 spike，不是 `TileMapLayer`
实现，不得复制或晋级为 E0/产品地图。

### 2.2 本轮 discovery 已确认但执行前必须重验的环境

```text
Godot binary:
/Volumes/Leo_LLM/Toolchains/NewEra/godot-4.7.1/Godot_mono.app/Contents/MacOS/Godot

Godot version:
4.7.1.stable.mono.official.a13da4feb

Godot binary SHA-256:
d11dc4a241ec29a347e13c8c7706e49433379ae1f9fc6a6e6819efb3891fce97

.NET binary:
/Users/leo/.dotnet/dotnet

.NET version:
10.0.302

.NET binary SHA-256:
ed8eb05ce0598b40df34f464d16063b30896c7e28dc1ac9e94554a8aff9676ed
```

PATH 中当前没有 `godot` 或 `godot4`。所有 E0 命令必须使用固定绝对路径。若二进制、
版本或 SHA 与上述记录不同，Phase 0 失败并停止；不得静默改用其他 Godot。

本机已发现 `4.7.1.stable.mono` 的 macOS 与 Windows release templates，但当前没有
E0 `export_presets.cfg`，也没有绑定该工程的真实 export PASS。模板存在不能写成导出
已通过。

## 3. 执行现场、允许写入与生命周期

### 3.1 进入条件

以下条件全部满足后才允许执行：

- Owner 明确授权本计划的冻结版本；
- 使用来源明确、与授权 ref 一致的 clean clone/worktree；
- 当前 C04/C05、Gate 1H、Gate 2 和地图 Gate 状态被记录但不修改；
- E0 独立 branch、worktree、工程目录和证据根在运行前冻结；
- 实施者与最终独立审查者不是同一上下文。

当前高度脏乱的 `codex/map-design-development` 工作树不得作为正式 E0 现场。

### 3.2 Authorized Bootstrap

Owner 授权后、Phase 0 前只允许一次 bootstrap。Owner receipt 必须冻结：

```text
plan_sha256
fixture_annex_sha256
base_ref
target_branch
target_worktree
external_output_root
external_evidence_staging_root
candidate_evidence_path
bootstrap_receipt_path
durable_evidence_remote
durable_evidence_ref
remote_publish_authorized=true
bootstrap_operator
```

bootstrap 只允许：

1. 验证 target branch/worktree/output/evidence staging root 在创建前均为 `ABSENT`；
2. 从 exact base ref 创建 `codex/godot-engine-evaluation-e0` clean worktree；
3. 创建空的 external output root 与 external evidence staging root；
4. 在 Owner receipt 指定的 `bootstrap_receipt_path` 写入唯一文件
   `e0-bootstrap-receipt.json`；该路径必须位于 evidence staging root，receipt 记录 base
   ref、创建命令 ordered argv、创建后 Git clean status、所有绝对路径、durable remote/ref
   和 Owner receipt hash；
5. 不创建 Godot project、candidate evidence path、source 文件或任何插件。

bootstrap 失败即终止本次授权；不得清理后复用同一 run id。Phase 0 只能只读核对
bootstrap receipt，不得在计划外补建遗漏对象。

### 3.3 固定隔离命名

```text
branch: codex/godot-engine-evaluation-e0
project: spikes/godot-engine-evaluation-e0/
external output root: /private/tmp/new-era-godot-engine-e0-<run-id>/
candidate evidence: docs/exec-plans/evidence/godot-engine-evaluation-e0/<run-id>/
durable evidence ref: codex/godot-engine-evaluation-e0-evidence-<run-id>
```

以上路径由 Owner receipt 绑定，不能由实施者现场改名。E0 branch 默认不合入产品主线。
每个成功或失败 run 都必须保留报告、manifest、文本日志、原始性能数据、必要截图、
artifact hashes 和 deterministic source archive；不把 E0 工程当作生产祖先。

### 3.4 E0 唯一允许的工程内容

- 一个无插件 Godot 4.7.1 工程；
- GDScript；
- 由代码生成的纯色合成 atlas；
- 2–3 个 `TileMapLayer`；
- 一个固定 `Camera2D`；
- 在 `project.godot` 中声明的最小 `InputMap`；
- 一个 fail-closed scene-load runner；
- import、headless runtime、真实窗口、性能采样和 macOS export 所需的最小脚本；
- E0 manifest、日志、截图、性能 JSON 和最终报告。

明确禁止：

- 启用或复制 Godot AI、MCP Native、State Charts、Phantom Camera、GUT、gdUnit4、
  Dialogue Manager、Konado 或任何其他插件；
- 读取或导入正式地图、地图候选素材、P0a fixture、产品 UI 或 React 权威规则；
- 导航、寻路、占用、权限、战斗、自由意志日、存档、网络或正式输入架构；
- 使用已废弃的 `TileMap`；
- C# 玩法实现；
- 对现有两个 smoke 运行 `--import`、headless editor 或 export；
- 将 E0 文件命名为 `production`、`foundation`、`main` 或类似可保留产品组件。

## 4. 允许的 API 与实现模式

E0 只使用本地 Godot 4.7.1 API 已交叉确认的最小表面：

| 能力 | 允许 API / 模式 |
|---|---|
| Scene 检查与加载 | `ResourceLoader.exists()`、`ResourceLoader.load()`、`PackedScene.instantiate()` |
| TileSet | `TileSet.tile_size`、`TileSet.add_source()` |
| 合成 atlas | `Image.create_empty()`、`Image.fill()`、`ImageTexture.create_from_image()` |
| Atlas source | `TileSetAtlasSource.texture`、`texture_region_size`、`create_tile()` |
| Tile layer | `TileMapLayer.set_cell()`、`erase_cell()`、`get_used_rect()`、`local_to_map()`、`map_to_local()` |
| Camera | `Camera2D.make_current()`、`get_screen_center_position()`、`force_update_scroll()` |
| Input | `InputMap` 中已声明的 action；测试脚本只验证 action 与结果，不构建产品输入层 |
| Viewport/display | `Viewport.get_visible_rect()`、`DisplayServer.get_name()`、窗口/屏幕尺寸读取 |
| 性能 | `Performance.get_monitor()` |

性能采样至少包括：

```text
TIME_FPS
TIME_PROCESS
TIME_PHYSICS_PROCESS
MEMORY_STATIC
OBJECT_NODE_COUNT
RENDER_TOTAL_OBJECTS_IN_FRAME
RENDER_TOTAL_DRAW_CALLS_IN_FRAME
RENDER_VIDEO_MEM_USED
```

禁止在每帧调用 `TileMapLayer.update_internals()`；禁止用 headless 的显示、FPS 或 draw
calls 推断真实窗口性能；禁止用第一帧无报错代替稳定运行。

## 5. Phase 0：身份、许可与 clean-worktree preflight

### What to implement

1. 只读确认授权 ref、branch/worktree、Git clean 状态和上位文档 hashes。
2. 重新确认 Godot/.NET 绝对路径、版本、SHA、签名和 architecture。
3. 记录 export template 精确清单、版本和许可证；不安装缺失模板。
4. 建立 E0 task contract，冻结 run id、允许目录、输出目录、视口、合成 fixture、
   运行命令和停止条件；fixture、采样窗口和数值阈值必须逐字引用已授权 annex，
   不得在此阶段重新选择。
5. 读取并验证 `e0-bootstrap-receipt.json`；确认 project 与 candidate evidence path 仍为
   `ABSENT`，output root 为空，evidence staging root 只包含 exact receipt；receipt SHA、
   directory inventory、worktree、durable remote/ref 与 Owner receipt 完全匹配。
6. 只执行非 Godot harness preflight：确认 `/usr/bin/osascript` identity/SHA、System Events
   Accessibility capability 和 focus capability。失败记为 `TEST_HARNESS_FAIL / E0_NOT_RUN`，
   不启动 Godot、不裁定 ENGINE_GATE。

### References

- `docs/agents/game-development-workflow.md` 的权威顺序、单任务合同、工作树纪律。
- Godot command-line tutorial 与本机 `--help`。
- Godot、.NET、本计划和上位文档的现场 hashes。

### Verification checklist

- [ ] Git ref 与 clean worktree 可复算。
- [ ] Godot 路径、版本、SHA、签名和架构全部匹配。
- [ ] `.NET` 只记录环境身份；E0 实现语言仍为 GDScript。
- [ ] 未发现或启用任何 E0 plugin/autoload。
- [ ] bootstrap receipt 绑定 plan SHA、annex SHA、base ref 和全部绝对路径。
- [ ] worktree clean；project/candidate evidence path 仍为 `ABSENT`；output root 为空，
  evidence staging root 只包含 receipt。
- [ ] osascript identity 与 Accessibility/focus capability preflight 通过；失败状态不会被写成引擎失败。
- [ ] `Gate 1H=PENDING`、`Gate 2=LOCKED`、地图 runtime/生产素材锁定状态原样记录。

### Anti-pattern guards

- 任一 identity 漂移即停止，不现场升级或换二进制。
- 脏工作树、未知 ref、缺失 bootstrap receipt 或复用已有输出根均为 preflight FAIL。
- 此阶段不得启动编辑器、导入资源或创建工程。

## 6. Phase 1：建立 disposable 无插件工程与 fail-closed runner

### What to implement

1. 在已授权的 E0 branch/worktree 创建最小 `project.godot`。
2. 固定 960×540 Compatibility renderer；只声明 E0 所需 input actions。
3. 用 GDScript 程序生成纯色 atlas，建立 2–3 个 `TileMapLayer` 和固定 Camera2D。
4. 严格按 fixture/measurement annex 建立 nominal 3024-cell 与 stress 48384-cell 合成
   负载；不得修改 layer、密度、atlas、viewport、action trace 或统计口径。
5. 建立 fail-closed runner：scene 不存在、类型错误、加载失败、实例化失败、fixture
   数量不符或日志含未处理错误时返回非零。
6. 建立仅供 E0 的 macOS release preset，并纳入 tracked source。
7. 在真实 editor GUI 中完成一次 save/close/reopen，生成 GUI witness；随后运行
   scene-manifest runner，把 editor 最终保存字节作为冻结候选。
8. 生成 source inventory 和 E0 manifest，记录所有 tracked 工程文件 SHA。
9. 将最终 E0 source 提交到 evaluation-only source ref，并用 `git archive --format=tar`
   从该 exact source SHA 生成 deterministic source archive；记录 archive SHA-256、base
   ref 和 source ref。每个后续 run 都绑定该 archive，不得从脏工作树执行。
10. source freeze 后 tracked source 全部只读。任一源码修复都必须先封存当前失败 run，
   再创建新的 child run id、source commit 和
   source archive；不得让新源码覆盖旧 run 的 archive 或 evidence。

### References

- Godot `TileMapLayer`、`TileSet`、`TileSetAtlasSource`、`ResourceLoader`、
  `PackedScene` 官方文档。
- 本机 Godot 4.7.1 `GodotSharp.xml` 用于方法存在性交叉核验。
- 现有 smoke 只参考启动、保存、日志和证据闭环，不复制 plugin/autoload/source。

### Verification checklist

- [ ] 工程中没有 `addons/`、EditorPlugin、autoload、网络或 MCP 配置。
- [ ] `rg`/manifest 证明没有正式资产与正式规则路径。
- [ ] 使用 `TileMapLayer`，没有 deprecated `TileMap`。
- [ ] atlas bytes 全部由 E0 脚本生成，无外部素材 lineage。
- [ ] runner 的正例与至少三个失败向量产生预期退出码。
- [ ] source inventory 与 manifest 可复算且无工程目录外写入。
- [ ] deterministic source archive 可解包、可复算，并包含独立审查所需完整源码。
- [ ] export preset 与 editor 最终保存的 scene bytes 已包含在 source archive；archive 后 Git clean。

### Anti-pattern guards

- 不复制 `reference_map_test.gd` 的 `_draw()` 地图。
- 不以 `--check-only` 通过宣称整个工程或运行态通过。
- 不调用 `ProjectSettings.save()` 改写运行中的源工程。

## 7. Phase 2：headless、导入、日志与 macOS export

### What to implement

1. 在 E0 工程上运行 script parse/check，记录完整 argv、exit code、stdout/stderr。
2. 运行一次 headless import，记录 `.godot` 与其他实际 write set。
3. 连续三次运行相同的 headless scene-load/runtime 路径，确认结果与 manifest 稳定。
4. 使用 source archive 已冻结的 macOS release preset 导出到外部 output root；不得新建
   或修改 `export_presets.cfg`。
5. 记录 export 日志、退出码和 `.app` tree inventory/hash。
6. 执行两种明确区分的本机启动验证：
   - bundle inner executable：记录 absolute executable、ordered argv、PID、exit code、
     runtime log 和退出后 PID absence；
   - LaunchServices：使用冻结的 `open -n -W --args ...` 路径，记录 `open` argv/exit、
     目标 bundle PID、runtime log 和 clean termination；不得把 `open` exit code写成
     game process exit code。
7. 本轮只验证 local export/local launch。distribution signing、Gatekeeper assessment、
   notarization 与其他 Mac 均固定记为 `NOT_TESTED`。
8. 将“本机命令可脚本化”记录为 local automation evidence，不宣称 cloud CI 已通过。

### Recommended command shapes

```bash
"$GODOT_BIN" --headless --path "$E0_ROOT" \
  --script res://tests/e0_runner.gd --check-only

"$GODOT_BIN" --headless --path "$E0_ROOT" --import \
  --log-file "$E0_OUTPUT/import.log"

"$GODOT_BIN" --headless --path "$E0_ROOT" \
  --scene res://scenes/E0.tscn --quit-after 300 \
  --log-file "$E0_OUTPUT/runtime-headless.log"

"$GODOT_BIN" --headless --path "$E0_ROOT" \
  --export-release "E0 macOS" "$E0_OUTPUT/export/NewEraE0.app" \
  --log-file "$E0_OUTPUT/export.log"
```

正式执行合同必须把变量解析为绝对路径并记录；不得照抄未解析变量作为证据。

### References

- Godot command-line tutorial。
- Godot exporting projects 文档。
- 本机 `--help` 确认的 `--headless`、`--path`、`--script`、`--check-only`、
  `--import`、`--scene`、`--quit-after`、`--log-file`、`--export-release`。

### Verification checklist

- [ ] 每条命令有 ordered argv、cwd、allowlisted environment、exit code 和独立日志。
- [ ] 每条运行命令前后均复算 tracked source manifest 并确认 Git clean；任一漂移立即
  封存为失败 run，不继续执行。
- [ ] import write set 只位于 E0 worktree/output root 内。
- [ ] 三次 headless 结果、fixture identity 和关键计数一致。
- [ ] export preset、template version、artifact inventory/hash 已保存。
- [ ] inner executable 与 LaunchServices 两条 local launch 都绑定实际 executable/PID、
  argv、日志和 clean termination；只有 inner executable 记录 game exit code。
- [ ] signing、Gatekeeper、notarization 和跨机器分发均明确为 `NOT_TESTED`。
- [ ] 日志无未处置 parse/import/resource/runtime error。
- [ ] 没有写入现有 smoke、正式资产、React prototype 或 Gate evidence。

### Anti-pattern guards

- 未安装的 Web/Linux/Windows 能力记为 `NOT_TESTED`，不补装、不推断通过。
- 不用 export template 存在代替 export PASS。
- 不用一次 `--quit` 成功代替重复 scene/runtime 验证。

## 8. Phase 3：真实窗口、输入、镜头与性能验证

### What to implement

1. 启动明确绑定 E0 工程的真实 Godot editor session；通过 OS process/window 证据记录
   Godot executable、PID、project path、window title 和截图，不宣称获得插件级 editor state。
2. 使用无插件 E0 scene-manifest runner 加载 source archive 已冻结的 `.tscn`，递归输出 node type/path、
   resource path、TileMapLayer cell count、Camera2D current 状态和 SHA；与 source manifest
   交叉核对。
3. 以只读验证方式在真实 editor GUI 打开、关闭并重新打开 scene，不执行 save/edit；
   Phase 1 的最终 save/reopen witness 必须存在，Phase 3 前后 tracked source manifest 与
   Git clean 必须完全一致。
4. 运行 nominal fixture，按 annex 使用 macOS OS-level automation 向已确认 PID/window
   注入 D/S/A/W；证据必须标为 `OS_INJECTED_INPUT`。应用记录原始 `InputEventKey`、
   resolved action、sequence 及前后 Camera2D center；不得写成物理键盘或真人输入。
5. 分别运行 nominal 与 stress fixture；严格按 annex 的 120 帧预热、10 个等墙钟
   1 秒 FPS 窗口、10 秒 timed sample、三次全新 process、统计公式和数值阈值生成
   raw 与 summary 数据。
6. 在 960×540 目标视口保存至少一张 nominal 和一张 stress 截图，读取 game/editor
   logs 后停止项目。

### E0 technical screening thresholds

所有 fixture、action、resize、warmup/sample/repeat、p95/median、long-frame、memory、
node growth 和输入 multiplicity 口径，以已授权 fixture/measurement annex V0.1 为唯一
权威。本计划不复制第二套数值。任一阈值改变都需要新 plan/ref、Owner 授权和 run id。
这些阈值只用于 E0 本机风险筛查，不是未来产品性能预算。

### References

- `docs/agents/game-development-workflow.md` 的 Godot editor/runtime 验证闭环。
- Godot `Camera2D`、`InputMap`、`DisplayServer`、`Viewport`、`Performance` 文档。

### Verification checklist

- [ ] 真实 editor 与 game process 都绑定 E0 工程路径和 Godot binary SHA。
- [ ] Phase 1 scene 保存/重开后结构一致；Phase 3 只读打开前后 tracked source bytes 不变。
- [ ] OS-level injected input 路径已验证并准确标为 `OS_INJECTED_INPUT`；未冒充物理键盘。
- [ ] `07-editor-session.json` 记录 process/window/GUI witness 与 scene-manifest runner 来源。
- [ ] `08-runtime-input-camera.json` 记录 input provenance、event/action sequence、camera/viewport 前后值。
- [ ] viewport/display identity 与截图、日志、性能样本绑定同一 run id。
- [ ] nominal/stress 原始性能样本均存在，未用 headless 数值替代真实窗口。
- [ ] 停止后 game process 消失，editor/game 日志均已读取。

### Anti-pattern guards

- 截图不能替代日志和性能样本。
- headless 结果不能替代真实窗口输入与渲染。
- E0 不评价正式地图美术、镜头手感或玩家体验。

## 9. Phase 4：ENGINE_GATE 报告与独立审查

### What to implement

1. 生成 E0 report，逐项列出 `PASS / FAIL / NOT_TESTED`，不隐藏跳过项。
2. 报告绑定授权 ref、source SHA、Godot/.NET identity、project manifest、所有运行 argv、
   deterministic source archive、logs、screenshots、performance samples 和 export artifact hash。
3. 生成 scope audit，证明 E0 没有读取/写入正式地图、产品 UI、规则或 Gate evidence。
4. 封存 external evidence staging root 的 immutable manifest；新鲜独立 agent 只读复核
   manifest 绑定的 source archive、raw evidence 和边界，输出 P0/P1/P2 与明确结论。
5. 根据原始报告和独立审查形成非权威 `engine-gate-recommendation.md`；它不能替代
   Owner decision。
6. 以 no-clobber 方式创建 candidate evidence path，发布完整 source archive、raw
   evidence、独立审查、recommendation 与 final inventory；不得只发布成功 run。
7. 将 candidate evidence commit 发布到 Owner receipt 明确授权的 durable evidence remote/ref；
   用 `git ls-remote` 读回 exact commit，并在全新临时 readback clone 中检出该 exact commit，
   逐文件复算 remote-ref tree 与 final inventory。
   发布或读回失败统一记为 `EVIDENCE_PUBLICATION_FAIL`，不得清理 worktree/staging，也不得
   宣称 ENGINE_EVALUATION_E0 完成。
8. durable evidence 验证通过后，Owner 才发布最终 ENGINE_GATE decision；decision 必须
   绑定 durable remote/ref、exact commit、final inventory SHA 和 recommendation SHA，
   并明确生命周期。Owner decision 是独立 authority receipt，不伪装成证据包的自我裁定。

### ENGINE_GATE decision rules

`PASS` 必须同时满足：

- Phase 0–3 所有 required checklist 通过；
- 无插件工程可重复完成 parse/import/headless/runtime，且 annex 的每个数值门槛通过；
- 真实窗口 scene、input、camera、viewport、日志和性能证据完整；
- macOS release export 与导出物运行通过；
- 无越界写入、正式资产 lineage 或玩法规则实现；
- 独立审查 `P0=0 / P1=0`，P2 有明确处置；
- 所有未测试平台和能力被准确标为 `NOT_TESTED`，包括 distribution signing、
  Gatekeeper、notarization 与跨机器 macOS 分发。

`CONDITIONAL` 仅适用于核心链已运行，但存在一个不会通过缩小样本掩盖的明确工程
缺口，例如可复现长帧、导出配置缺口或日志污染。条件必须可单独验证；新的运行需要
新 run id，不覆盖旧证据。

`FAIL` 包括但不限于：identity 漂移、无法完成稳定 scene/load/runtime、已观察到匹配
`InputEventKey` 后发生的 action/camera 合同失败、窗口失败、macOS export/launch 失败且无法在 E0 内解释、写入越界、证据不完整，或
为取得通过而引入插件/正式资产/玩法规则。

injector spawn/timeout/nonzero、焦点漂移，或 injector exit 0 但应用未观察到匹配
`InputEventKey`，必须按 annex 分类为 `TEST_HARNESS_FAIL/INCONCLUSIVE`；E0 结论为
`INCOMPLETE`，不得写成 ENGINE_GATE FAIL 或 PASS。

### Verification checklist

- [ ] 报告的每项结论都能回溯到 raw evidence。
- [ ] PASS 数、FAIL 数、NOT_TESTED 数明确，不能只写总评。
- [ ] 独立审查使用冻结 source/evidence，而不是实施者口头说明。
- [ ] Gate 决议明确写出 E0 生命周期：`ARCHIVE_EVIDENCE_AND_DISCARD_WORKTREE`，或
  `ARCHIVE_EVIDENCE_AND_RETAIN_EVALUATION_REF_PENDING_AMENDMENT`。
- [ ] 无论成功或失败，每个已启动 run 的 deterministic source archive 与 raw evidence
  均保留；丢弃 worktree/branch 不删除审计 archive。
- [ ] candidate evidence path 由 final inventory 绑定全部 run、review 和 recommendation，且创建前为 `ABSENT`。
- [ ] durable evidence remote/ref 已读回 exact commit，逐文件 inventory 复算通过；该 ref
  是 evidence-only lineage，禁止 merge/cherry-pick 到 production ancestry。
- [ ] durable evidence 验证通过前未删除 worktree、branch、staging 或任何失败 run。
- [ ] Gate 1H、Gate 2、C04/C05、地图 Gate 状态未变化。

### Anti-pattern guards

- `REVIEW_PASS`、自动化 PASS 或 E0 PASS 均不能自动写成 ENGINE_GATE PASS。
- ENGINE_GATE PASS 不能自动创建/保留 Godot production foundation。
- 不把 agent 操作或技术截图写成真人试玩证据。

## 10. 最终证据包

最小证据清单：

```text
00-authority-and-scope.json
01-environment-identity.json
02-source-inventory.sha256
02a-source-archive.tar
02b-source-archive.sha256
03-project-manifest.json
04-command-manifest.json
05-import-write-set.json
06-headless-repeat-results.json
07-editor-session.json
08-runtime-input-camera.json
09-performance-raw.json
10-export-manifest.json
11-scope-audit.json
12-engine-evaluation-e0-report.md
13-independent-review.md
14-engine-gate-recommendation.md
logs/
screenshots/
```

文件编号只是内容合同，不要求为了凑数量创建空文件。原始日志和截图必须由 manifest
列出 SHA；缺项必须在报告中写 `NOT_TESTED` 或 `MISSING`，不得以空 placeholder 冒充。

command manifest 禁止保存完整 environment dump。每条命令只记录以下 allowlist：

```text
PATH
DOTNET_ROOT
LANG
LC_ALL
TMPDIR
GODOT_DISPLAY_DRIVER
GODOT_RENDERING_METHOD
```

未设置项记为 `UNSET`。任何名称包含 `TOKEN`、`KEY`、`SECRET`、`PASS`、`AUTH`、
`COOKIE`、`CREDENTIAL`、`SESSION`、`PROXY` 的变量一律不得写入证据；日志与 receipt
发布前必须执行同一 denylist 扫描。不得记录 GitHub、Codex 或其他服务凭据的值或 hash。

## 11. 未来迁移合同缺口（本计划不实施）

当前 TypeScript `stableStateHash` 是 FNV-1a 32-bit，导出不包含完整权威状态，也没有
冻结 canonical serialization 或逐动作 checkpoints。它足以服务当前 Web 回归，不足以
证明跨引擎 parity。

Gate 2 PASS 后的迁移计划至少还需冻结：

- 版本化 canonical state schema；
- 字段顺序、字符串、整数/浮点、缺省值和错误语义；
- 完整初态、种子和 ordered action envelopes；
- 每个 transition 的完整 canonical state 与事件输出；
- SHA-256 golden vectors；
- TS freeze、Godot candidate、parity PASS 和唯一权威切换顺序；
- 切换后旧运行路径的删除或只读封存规则。

E0 只能在最终报告中登记这些缺口，不得提前实现 parity harness。

## 12. 预计工期与停止线

| 净工作日 | 目标 | 停止条件 |
|---|---|---|
| Bootstrap | Owner 授权后创建 clean worktree 与空 external roots，形成 bootstrap receipt | 任一目标预先存在或 base ref 不符即停止 |
| Day 1 | Phase 0–1：preflight、无插件工程、合成 TileMapLayer、runner、source archive | identity/隔离/annex/source freeze 失败即停止 |
| Day 2 | Phase 2：parse/import/headless 重复运行 | 出现工程外写入或无法稳定加载即停止 |
| Day 3 | Phase 2–3：macOS export、真实窗口、输入和性能 | export/窗口基础链无法成立则进入报告，不扩范围救场 |
| Day 4 | 仅处理 E0 内可复现的最小缺陷并重跑新 run id | 不引入插件、正式资产或玩法规则 |
| Day 5 | Phase 4：报告、独立审查、ENGINE_GATE 决策 | 到期强制停止，不转成开放式 foundation |

工作量上限为 5 个净工作日。超出时默认停止并出具 `INCOMPLETE` 报告；不得通过扩大
计划、持续安装插件或先做产品功能来“验证 Godot”。

## 13. 计划完成定义

本计划文档完成，不代表 E0 已执行。只有同时满足以下条件，才可说
`ENGINE_EVALUATION_E0=COMPLETE`：

- 获得针对冻结计划/ref 的执行授权；
- Phase 0–3 在隔离现场真实执行；
- E0 报告、raw evidence 和 scope audit 完整；
- 新鲜独立审查完成；
- Owner 发布 ENGINE_GATE 决议；
- E0 source 生命周期已明确处理。

在此之前统一状态保持：

```text
ENGINE_EVALUATION_E0=PROPOSED_NOT_AUTHORIZED
ENGINE_GATE=NOT_RUN
GODOT_PRODUCTION_FOUNDATION=NOT_AUTHORIZED
GATE_1H=PENDING
GATE_2=LOCKED
```
