# Godot ENGINE_EVALUATION_E0 Fixture 与 Measurement Annex V0.1

| 字段 | 内容 |
|---|---|
| 状态 | `PROPOSED_NOT_AUTHORIZED` |
| 父计划 | `2026-08-01-godot-engine-evaluation-e0-and-engine-gate.md` |
| 用途 | 在 Owner 授权前冻结 E0 的合成负载、动作轨迹、采样窗口与失败口径 |
| 数据边界 | 仅合成数据；不读取正式地图、地图 fixture、产品 UI、玩法规则或正式素材 |

本 annex 是父计划的传递性授权输入。执行授权必须同时绑定父计划 SHA-256、本 annex
SHA-256 和 exact base ref；任一字节变化都需要新授权和新 run id。

## 1. 固定项目参数

```text
renderer=gl_compatibility
initial_viewport=960x540
resize_viewport=1280x720
stretch_mode=disabled
tile_size=16x16
layer_count=3
camera_start=(0,0)
camera_step_pixels=64
camera_position_smoothing=false
camera_drag_horizontal=false
camera_drag_vertical=false
```

三个 layer 固定为：

1. `Ground`：矩形区域 100% 填充 atlas tile `(0,0)`；
2. `Detail`：当 `(x + 2*y) % 4 == 0` 时填充 atlas tile `(1,0)`；
3. `Overlay`：当 `(3*x + y) % 16 == 0` 时填充 atlas tile `(2,0)`。

atlas 只包含三个由代码生成的 16×16 RGBA8 纯色 tile。颜色固定为：

```text
Ground=#566B4FFF
Detail=#9A8F62FF
Overlay=#5F718CFF
```

不得通过替换颜色、改变 alpha、删减 layer 或复用同一 cell buffer 改变负载。

## 2. 固定 fixtures

### 2.1 Nominal fixture

```text
grid=64x36
Ground=2304 cells
Detail=576 cells
Overlay=144 cells
total=3024 cells
```

### 2.2 Stress fixture

```text
grid=256x144
Ground=36864 cells
Detail=9216 cells
Overlay=2304 cells
total=48384 cells
```

runner 必须在运行开始时输出 grid、每层 cell 数、总 cell 数、`get_used_rect()` 和
fixture id。任一计数不符立即非零退出，不得继续采样。

## 3. 固定 action trace

输入 action 固定为：

```text
e0_camera_right = physical key D
e0_camera_down  = physical key S
e0_camera_left  = physical key A
e0_camera_up    = physical key W
```

主要 E0 输入证据使用以下固定 harness 向已确认 PID 和前台 game window 发送按键：

```text
injector_binary=/usr/bin/osascript
injector_script=scripts/e0_input_injector.applescript
focus_wait_ms=1000
key_down_ms=100
inter_key_gap_ms=250
post_action_process_frames=1
event_observation_timeout_ms=2000
inputProvenance=OS_INJECTED_INPUT
```

Phase 0 记录 `/usr/bin/osascript` 的 real path、SHA-256 与 macOS identity；injector script
属于冻结 E0 source archive，并由 source manifest 记录 SHA。不得表述为物理键盘或真人
输入。Accessibility/focus capability preflight 失败统一记为
`TEST_HARNESS_FAIL / E0_NOT_RUN`，不得裁成 Godot input FAIL。

按键发送顺序固定为：

```text
D down/up → S down/up → A down/up → W down/up
```

期望 Camera2D center 变化：

```text
(0,0) → (64,0) → (64,64) → (0,64) → (0,0)
```

应用必须逐事件记录 `pressed`、`echo`、`keycode`、`physical_keycode`、resolved action、
处理前后 camera center 和单调递增 sequence。只有 `pressed=true && echo=false` 允许产生
一次 64px 变化；key-up 和 echo 必须产生零变化。每个 action 恰好一次有效变化，否则
输入验证 FAIL。Camera2D position 改变后必须调用 `force_update_scroll()`，再等待一个
process frame 后读取 `get_screen_center_position()`。

### 3.1 Harness 与 Godot input failure 分类

| 现场结果 | 唯一分类 | 对 ENGINE_GATE 的含义 |
|---|---|---|
| Phase 0 Accessibility/focus capability 不通过 | `TEST_HARNESS_FAIL / E0_NOT_RUN` | 不裁定引擎 |
| `osascript` spawn error、timeout 或 nonzero exit | `TEST_HARNESS_FAIL / INPUT_SUBTEST_NOT_RUN` | E0 为 `INCOMPLETE`，不裁成引擎失败 |
| 注入前或注入后 target PID/window identity 不匹配、焦点漂移 | `TEST_HARNESS_FAIL / INPUT_SUBTEST_INCONCLUSIVE` | E0 为 `INCOMPLETE` |
| `osascript` exit 0，但 2000ms 内没有匹配的应用 `InputEventKey` | `TEST_HARNESS_INCONCLUSIVE / INPUT_DELIVERY_UNPROVEN` | 不裁成 Godot input FAIL |
| 已记录匹配 `InputEventKey`，但 resolved action 缺失或错误 | `GODOT_INPUT_ACTION_FAIL` | ENGINE_GATE required item FAIL |
| event/action 正确，但 camera delta、multiplicity 或最终 center 错误 | `GODOT_INPUT_CAMERA_FAIL` | ENGINE_GATE required item FAIL |
| event、action、camera trace 全部匹配 | `INPUT_SUBTEST_PASS` | 只表示该 E0 输入子项通过 |

每次注入必须记录 injector binary/script SHA、ordered argv、start/end timestamp、exit code、
stdout/stderr、注入前后 target PID/window/focus identity，以及应用 event sequence。只有已经
看到匹配的应用 `InputEventKey` 后，才允许把后续 action/camera 错误归因于 Godot E0
实现；“命令成功但应用无事件”不得通过推断改写为引擎失败。

窗口 resize trace 固定为：

```text
960x540 → 1280x720 → 960x540
```

每一步必须记录 window size、viewport visible rect、camera center 和截图 SHA。

## 4. 固定运行与采样窗口

每个 fixture 使用全新 game process 运行 3 次：

```text
warmup_frames=120
timed_sample_seconds=10.0
fps_window_seconds=1.0
fps_window_count=10
minimum_sample_frames=120
repeat_count=3
```

warmup 完成后把第一个 sample frame 的单调时钟记为 `t=0`。随后采样到单调时钟
`t>=10.0s`，只统计时间戳满足 `0.0<=t<10.0` 的完整样本；`t>=10.0` 的终止帧不纳入
统计。每帧记录：

```text
frame_index
monotonic_timestamp_ns
TIME_FPS
TIME_PROCESS
TIME_PHYSICS_PROCESS
MEMORY_STATIC
OBJECT_NODE_COUNT
RENDER_TOTAL_OBJECTS_IN_FRAME
RENDER_TOTAL_DRAW_CALLS_IN_FRAME
RENDER_VIDEO_MEM_USED
```

必须保留 10 秒内全部原始 frame samples，不得只保留聚合值。`TIME_FPS` 仍作为原始
monitor 值记录，但因 Godot 只每秒更新一次，不得把逐帧重复值当作独立 FPS observations。
FPS 判定只使用 10 个等墙钟窗口：`[0,1)`、`[1,2)`……`[9,10)`，每个窗口的 FPS
observation 等于该窗口内 frame sample 数除以 1.0 秒。不得丢弃首尾窗口或按帧数加权。

## 5. 数值失败口径

以下仅是 E0 本机风险筛查阈值，不是产品性能预算。

### 5.1 所有运行的硬失败

- parse、resource、script、render error 数必须为 0；
- fixture/layer/cell count 必须与本 annex 完全一致；
- 采样结束时 `OBJECT_NODE_COUNT` 必须等于 `t=0` baseline node count；
- process 必须在合同时间内正常结束，且结束后 PID 不存在；
- 10 秒内必须至少取得 120 个 frame samples；不得缺失/重复 frame index、出现非单调
  timestamp 或非有限数值。

### 5.2 Nominal fixture

- 10 个等墙钟 FPS observations 的 median 必须 `>=55`；
- `TIME_PROCESS` 的 p95 必须 `<=16.67ms`；
- `TIME_PROCESS >33.33ms` 的样本数必须 `<=floor(0.01*n)`，其中 `n` 为该次运行
  10 秒内的 frame sample 数；
- 三次运行均须单独通过，不允许以三次平均掩盖失败。

### 5.3 Stress fixture

- `TIME_PROCESS` 的 p95 必须 `<=33.33ms`；
- `TIME_PROCESS >50ms` 的样本数必须 `<=floor(0.02*n)`；
- 三次运行均须完成 10 秒 timed sample 并正常退出。

### 5.4 Memory 与 node growth

以 `t=0` 的第一个 sample 为 baseline：

- 结束时 `MEMORY_STATIC` 不得超过 `baseline + max(8MiB, baseline*5%)`；
- 分别计算 `[0,10/3)`、`[10/3,20/3)`、`[20/3,10)` 三个等墙钟窗口的 median
  memory；若三个 median 严格递增，且第三段比第一段增加超过 8MiB，则 FAIL；
- `OBJECT_NODE_COUNT` 在 10 秒 timed sample 内不得发生任何非合同定义的增长。

### 5.5 Resize 与 input

- 三个 resize checkpoint 必须分别为 960×540、1280×720、960×540；
- 在 `stretch_mode=disabled` 下，viewport visible rect 必须与对应窗口尺寸一致；
- action trace 的四个有效 key-down 必须各产生且只产生一次 64px camera delta；
- 最终 camera center 必须回到 `(0,0)`；
- 任一 echo、key-up 或未知 action 改变 camera 即 FAIL。

## 6. 统计规则

- p95 使用升序样本中的 `ceil(0.95*n)-1` 零基索引；
- 偶数 `n` 的 median 取零基索引 `n/2-1` 与 `n/2` 两项算术平均；奇数 `n` 取零基
  索引 `floor(n/2)`；10 个 FPS observations 固定取零基索引 4 与 5 的算术平均；
- 时间统一转换为毫秒后再比较；原始 Godot 值和转换值都必须保留；
- MiB 固定为 `1024*1024` bytes；
- 不得删除 outlier、平滑原始样本、改变 warmup/timed sample，或把逐帧 `TIME_FPS`
  重复值当作独立 FPS observations；
- 任一 monitor 在目标 renderer/window 模式不可用时记为 `NOT_AVAILABLE`，ENGINE_GATE
  不得给出 PASS，除非新计划和新授权明确替换该指标。

## 7. 变更与结论规则

以下任一改变都使原执行授权失效：

- fixture 尺寸、layer、密度、atlas、cell count；
- viewport、resize trace、action trace；
- warmup、sample、repeat、统计公式；
- 任一 PASS/FAIL 阈值；
- Godot binary/version/SHA、renderer 或运行模式。

失败时保留该 run 的 source archive、raw samples、logs 和 report。不得缩小 fixture、移动
阈值或删除失败 run 后沿用同一授权重跑。
