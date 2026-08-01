# ENGINE_EVALUATION_E0 执行报告

## 结论

```text
run_id=20260801-e0-01
ENGINE_EVALUATION_E0=INCOMPLETE_TEST_HARNESS
E0_RUNTIME=E0_NOT_RUN
ENGINE_GATE=NOT_RUN
```

Phase 0 的 Godot、.NET、export template 与 `osascript` 身份核验通过，但 macOS
Accessibility preflight 返回 `UI elements enabled=false`，随后按键注入探针以
`exit=1 / errorCode=1002 / osascript 不允许发送按键` 失败。根据冻结 annex 的唯一分类，
这是 `TEST_HARNESS_FAIL / E0_NOT_RUN`，不是 Godot 输入失败或 Engine Gate 失败。

本 run 已在 Phase 0 硬停止。没有创建或加载 Godot project，没有进入 Phase 1–3，
没有执行 parse、import、headless runtime、真实窗口、性能采样或 export；因此不能对
Godot 基础工程风险给出 `PASS`、`CONDITIONAL` 或 `FAIL`。

## 授权与绑定

| 字段 | 值 |
|---|---|
| authorization | `ENGINE_EVALUATION_E0_EXECUTION_AUTHORIZATION_V1` |
| plan ref | `codex/godot-e0-plan-freeze-20260801@8cff10572216e31941bacde8fe85b7c98549c462` |
| plan SHA-256 | `a75f807fb3315834624a3bf69251a8d6cd989fa5ab6891d58b446d6374ea0652` |
| annex SHA-256 | `c72906b5b4ddfeae45bb2816aac9eda1ac0530c5193a65355d5e33b52fc2c1ed` |
| execution base | `codex/godot-e0-execution-base-20260801@b020775522f83c4731ba318905d3d436c2f51f60` |
| execution base manifest SHA-256 | `204305df4111e827ef95e7fcf828629463341dd05875f72f77be390e60255f2f` |
| owner authorization SHA-256 | `f9471911be5e6f8570bc1c7b1bf1ee22a9311e2cfefa48c8181dcd862463d843` |
| bootstrap receipt SHA-256 | `728fa20400838163bf1e4fbf5d27f97d6abd6ed0f640d62ed1a3a28a29f7f38a` |
| target branch | `codex/godot-engine-evaluation-e0-20260801-e0-01` |
| target head at stop | `b020775522f83c4731ba318905d3d436c2f51f60` |

## 逐项结果

统计口径：`PASS=7 / FAIL=1 / NOT_TESTED=21`。唯一 FAIL 是测试 harness 进入条件，
不计作 Godot 或 ENGINE_GATE 失败。

| ID | 检查项 | 结果 | 证据 |
|---|---|---|---|
| P0-01 | 授权、plan、annex、base 与 bootstrap receipt 绑定 | PASS | `00-authority-and-scope.json`、`e0-bootstrap-receipt.json` |
| P0-02 | clean worktree、隔离路径与初始 ABSENT/empty 条件 | PASS | `e0-bootstrap-receipt.json`、`11-scope-audit.json` |
| P0-03 | Godot 4.7.1 identity、SHA、架构、签名、notarization ticket、license | PASS | `01-environment-identity.json`、`logs/phase0-identity.txt` |
| P0-04 | .NET 10.0.302 identity 与 SHA | PASS | `01-environment-identity.json`、`logs/phase0-identity.txt` |
| P0-05 | 本机 export template inventory 与 SHA | PASS | `01-environment-identity.json`；仅证明模板存在 |
| P0-06 | `/usr/bin/osascript` identity 与 SHA | PASS | `01-environment-identity.json`、`logs/phase0-identity.txt` |
| P0-07 | 前台应用切换与恢复 focus probe | PASS | `01-environment-identity.json`、`logs/phase0-harness.txt` |
| P0-08 | Accessibility 与按键注入 capability | FAIL | `UI elements enabled=false`；注入 `exit=1/errorCode=1002` |
| P1-01 | Godot project 创建 | NOT_TESTED | Phase 0 硬停止；project `ABSENT` |
| P1-02 | 合成 atlas、TileMapLayer 与 fixture | NOT_TESTED | Phase 0 硬停止 |
| P1-03 | fail-closed runner 与失败向量 | NOT_TESTED | Phase 0 硬停止 |
| P1-04 | editor save/close/reopen witness | NOT_TESTED | Phase 0 硬停止 |
| P1-05 | source freeze、inventory 与 deterministic archive | NOT_TESTED | source 未创建；source SHA/manifest/archive 均 `UNSET` |
| P2-01 | parse 与 import | NOT_TESTED | Phase 0 硬停止 |
| P2-02 | 三次 headless repeat | NOT_TESTED | Phase 0 硬停止 |
| P2-03 | macOS release export | NOT_TESTED | template 存在不等于 export PASS |
| P2-04 | bundle inner executable launch | NOT_TESTED | 未生成 export artifact |
| P2-05 | LaunchServices launch | NOT_TESTED | 未生成 export artifact |
| P3-01 | 真实 editor/runtime window witness | NOT_TESTED | Godot 未启动 |
| P3-02 | scene manifest 与 frozen source 对照 | NOT_TESTED | project/source 未创建 |
| P3-03 | OS-injected input 与 Camera2D trace | NOT_TESTED | harness preflight 未通过 |
| P3-04 | 960×540 → 1280×720 → 960×540 resize trace | NOT_TESTED | runtime 未运行 |
| P3-05 | nominal fixture performance | NOT_TESTED | runtime 未运行 |
| P3-06 | stress fixture performance | NOT_TESTED | runtime 未运行 |
| P3-07 | nominal/stress screenshots | NOT_TESTED | runtime 未运行 |
| DIST-01 | distribution signing | NOT_TESTED | 不在本轮已执行范围 |
| DIST-02 | Gatekeeper assessment | NOT_TESTED | 不在本轮已执行范围 |
| DIST-03 | export notarization | NOT_TESTED | 不在本轮已执行范围 |
| DIST-04 | 跨机器 macOS 分发 | NOT_TESTED | 不在本轮已执行范围 |

## 环境身份摘要

```text
Godot version=4.7.1.stable.mono.official.a13da4feb
Godot SHA-256=d11dc4a241ec29a347e13c8c7706e49433379ae1f9fc6a6e6819efb3891fce97
.NET version=10.0.302
.NET SHA-256=ed8eb05ce0598b40df34f464d16063b30896c7e28dc1ac9e94554a8aff9676ed
osascript SHA-256=fbe034addbf9968a34f634684c318b1ad86f1d057b38a67d981d5bd43cd15989
```

完整 identity、允许的 environment 字段与 ordered argv 见
`01-environment-identity.json` 和 `04-command-manifest.json`。

## 证据包完整性与缺项

当前 run 的真实 Phase 0 证据包括：

- `00-authority-and-scope.json`
- `01-environment-identity.json`
- `04-command-manifest.json`
- `11-scope-audit.json`
- `e0-bootstrap-receipt.json`
- `logs/phase0-identity.txt`
- `logs/phase0-harness.txt`

下列合同文件没有创建，属于已披露缺项，不以空 placeholder 冒充：

| 缺项 | 状态与原因 |
|---|---|
| `02-source-inventory.sha256` | MISSING / NOT_TESTED；Phase 1 未开始 |
| `02a-source-archive.tar` | MISSING / NOT_TESTED；没有 E0 source 可归档 |
| `02b-source-archive.sha256` | MISSING / NOT_TESTED；没有 source archive |
| `03-project-manifest.json` | MISSING / NOT_TESTED；project 未创建 |
| `05-import-write-set.json` | MISSING / NOT_TESTED；import 未执行 |
| `06-headless-repeat-results.json` | MISSING / NOT_TESTED；headless runtime 未执行 |
| `07-editor-session.json` | MISSING / NOT_TESTED；editor 未启动 |
| `08-runtime-input-camera.json` | MISSING / NOT_TESTED；input subtest 未运行 |
| `09-performance-raw.json` | MISSING / NOT_TESTED；性能采样未运行 |
| `10-export-manifest.json` | MISSING / NOT_TESTED；export 未执行 |
| `screenshots/` | MISSING / NOT_TESTED；未进入真实窗口阶段 |

`external_output_root` 保持为空。不存在 export artifact hash、performance samples、
runtime logs、screenshots、project/source manifest 或 deterministic source archive，不能从
identity 与 template 存在性推断这些项目通过。

## Scope audit 与 Gate 状态

```text
Godot project created=false
Godot project loaded=false
plugins created/enabled=0
product assets read/written=0
gameplay rules read/written=0
Gate changes=0
Phase 1=NOT_RUN
Phase 2=NOT_RUN
Phase 3=NOT_RUN
ENGINE_GATE=NOT_RUN
```

Gate 1H、Gate 2、C04/C05 与地图 Gate 均未被本 run 改变。TypeScript simulation core 的
既有权威地位不变；本 run 不授权 Godot product foundation、platform shell 或实质产品开发。

## 后续条件

本 run 只能封存，不能在授予 Accessibility 权限后原地续跑。若 Owner 决定继续 E0，
必须先在 macOS 隐私与安全性设置中给实际执行按键注入的宿主应用授予 Accessibility
权限并验证 `UI elements enabled=true`，随后使用新的 `run_id`、新的隔离路径与新的精确
执行授权重新开始。新 run 不得覆盖本 run 的失败证据。

当前非权威建议是：不裁定 ENGINE_GATE，保留本证据 lineage，并等待新的执行授权。
