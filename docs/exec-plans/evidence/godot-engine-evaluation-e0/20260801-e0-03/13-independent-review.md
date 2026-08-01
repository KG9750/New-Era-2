# ENGINE_EVALUATION_E0 `20260801-e0-03` 独立只读审查

## 结论

```text
P0=0
P1=0
P2=1
REVIEW_PASS
REVIEW_SCOPE=FAILURE_EVIDENCE_PUBLICATION_ONLY

ENGINE_EVALUATION_E0=INCOMPLETE
SOURCE_COMMIT=NOT_CREATED
SOURCE_FREEZE=NOT_RUN
PHASE_2=NOT_RUN
PHASE_3=NOT_RUN
ENGINE_GATE=NOT_RUN
ENGINE_GATE_RECOMMENDATION=DO_NOT_ADJUDICATE
```

本次 `REVIEW_PASS` 仅表示：现有 artifacts 足以忠实发布并永久保留一次因 pre-Godot guard false PASS 而终止的失败运行证据。

它不允许：

- 续跑、修补或重新解释 `e0-03`；
- 将 partial runner/editor evidence 提升为 E0 完成；
- 裁定 `ENGINE_GATE=PASS / CONDITIONAL / FAIL`；
- 创建 Godot production foundation；
- 改变 React/TypeScript 权威、Gate 1H、Gate 2、C04/C05、地图 runtime 或生产素材状态。

## 逐项复算

### 1. Pre-review inventory

- `pre-review-inventory.sha256`：
  - 物理记录数：`123`
  - 文件自身 SHA-256：`3c88c97bcf5c98cc923d5a92b40c7864a63ba8670418158d4a2881cb89608626`
  - 逐文件重新执行 SHA-256 校验：`123 OK / 0 FAIL`
- Owner authorization package：
  - `ec18e6a8861011ff8f4c712c376ee03b34e18036edc247969eec83950ab0a60c`
- Remediation contract：
  - `0526cc10803a8c3b350b9be575fec7733074d4b38ef783bb38d8ff941ae34855`

结论：inventory 与两项授权绑定均无漂移。

### 2. `EXPECTED_SOURCE_PATHS.txt` false PASS

独立复算结果：

```text
SHA-256=af73b86fcc5c68e9ff284c6179e018e8ddc43963c6a21acb102105070b4706bc
physical_lines=15
nonempty_entries=14
blank_entries=1
```

第 15 行为空行，因此不满足 remediation contract 的严格 14-entry 格式。

证据链一致：

- `phase0-task-contract.json` 将同一 `af73b86…` 文件错误记录为 `expectedSourcePathCount=14` 和 `PASS`；
- `logs/phase1-hard-stop.txt` 记录 preflight 使用 `sed '/^$/d'` 过滤空行；
- `phase0-retroactive-guard-audit.json` hash-bind 原始 task contract，并仅 supersede 其 PASS 解释；
- `03-project-manifest.json` 和最终报告均将其分类为：

```text
PRE_GODOT_SOURCE_ALLOWLIST_FORMAT_FAIL
GODOT_STARTED_BEFORE_PRE_GODOT_REQUIREMENTS_PASS
```

结论：这是过滤非法空行造成的真实 false PASS，而不是合规的 14-line allowlist。

### 3. False PASS 后的 Godot 执行及 Git 状态

23 组 command records 中存在随后执行的 Godot 命令，包括：

- `phase1-check-only`
- nominal/stress runner
- 三个 fail-closed vector
- `phase1-editor-first`
- `phase1-editor-reopen`

因此 Godot 确实在该 false PASS 后进入 Phase 1 partial execution。

失败 worktree 复算：

```text
HEAD=b020775522f83c4731ba318905d3d436c2f51f60
source_commit=NOT_CREATED
staged_paths=14
staged_dotgodot_paths=0
tracked_dotgodot_paths=0
ignored_dotgodot_files=12
```

14 个 staged path 全部位于 `spikes/godot-engine-evaluation-e0/`。`.godot` cache 存在，但未 tracked/staged。

结论：没有 source commit，HEAD 仍为 execution base，不能把 index 或 ignored cache 解释为 source freeze。

### 4. Pre-freeze tar

对保留的 `02a-pre-freeze-source-archive.tar` 连续两次独立读取计算均为：

```text
f1bf9e3c8e1354fc30d4fcbbbdcf79d3220a28d10e2104b4dbc294e6ae01864c
```

tar 内含 14 个 source files；路径集合及逐成员内容 SHA 与 `02-pre-freeze-source-inventory.sha256` 完全一致。

它明确不是冻结合同要求的 Git archive/source freeze：

- source commit 未创建；
- tar members 带有 `leo/wheel` owner 信息及 14 种不同 mtime；
- 报告明确标为 `pre-freeze worktree tar`；
- `SOURCE_FREEZE=NOT_RUN`。

### 5. Command records、runner 与 JPEG sequence

Command evidence 复算：

```text
manifest_command_count=23
pre_records=23
result_records=23
command_id_sets_match=true
pre_record_hash_bindings_match=true
manifest_vs_pre_fields_match=true
manifest_vs_result_fields_match=true
stdout_staged_copy_hashes_match=true
stderr_staged_copy_hashes_match=true
errors=0
```

Runner partial evidence：

- check-only：exit `0`，只证明脚本可进入检查；
- nominal：exit `0`，`3024` cells；
- stress：exit `0`，`48384` cells；
- missing scene：exit `21`；
- bad resource type：exit `22`；
- fixture mismatch：exit `23`。

三张图片均经文件类型、尺寸、SHA 和视觉检查：

1. `editor-seq-01-after-save.jpg`：JPEG，`1392×768`，显示 `E0.tscn` Godot editor；
2. `editor-seq-02-editor-closed.jpg`：JPEG，`920×436`，Finder 可见，witness 同时记录 Godot PID 缺席；
3. `editor-seq-03-scene-reopened.jpg`：JPEG，`1392×768`，再次显示同一 `E0.tscn` editor。

这些只构成 Phase 1 partial evidence，不替代冻结 source、Phase 2/3 或运行性能证据。

### 6. Phase/Gate 与产品边界

- 23 条命令仅覆盖 Phase 0/1；不存在 Phase 2/3 command record。
- 证据包缺少正常 Phase 2/3 应产生的 import-repeat、export、runtime input/camera、performance raw artifacts。
- `03-project-manifest.json`、`11-scope-audit.json`、报告和 recommendation 一致记录：
  - `PHASE_2=NOT_RUN`
  - `PHASE_3=NOT_RUN`
  - `ENGINE_GATE=NOT_RUN`
  - `DO_NOT_ADJUDICATE`
- staged scope、command argv 与 manifests 未显示 plugin、product map/UI、gameplay rule 或正式资产进入本 run。
- React/TypeScript 权威不变；`Gate 1H=PENDING`、`Gate 2=LOCKED`；C04/C05、地图 runtime、生产素材和 production foundation 均不变。

## Findings

### P0：0

无。

### P1：0

无。未发现阻止失败 evidence-only 发布的问题。

### P2：1 — 第二次 tar generation 未作为独立 artifact 保留

证据：

- `03-project-manifest.json` 声明 `secondGenerationByteForByteEqual=true`；
- staging 中只保留一份 `02a-pre-freeze-source-archive.tar` 和一行对应 hash；
- 当前可独立证明的是“同一保留文件重复读取 SHA 一致”，不能仅凭现有 artifacts 独立证明两个分别生成的 tar byte-for-byte 相同。

影响：

- 不影响 allowlist false PASS、Godot 已执行、source commit 未创建或 Phase 2/3 未运行等失败事实；
- 不阻止失败 evidence 发布；
- 该 tar 仍不得称为 Git archive、deterministic source freeze 或两份独立生成物的完整证明。

最小修正：

- 不修改或补跑 `e0-03`；在本独立审查中永久披露此证据限制。
- 若 Owner 另行授权新 run，保留两份独立生成的 tar 或至少保留分别 hash-bind 两次生成过程的 raw command/result records，再比较其 SHA。

## 发布许可

允许的唯一后续动作是：将当前失败 artifacts、本独立审查和 final inventory 发布到授权的 evidence-only ref，并完成 no-clobber publication、远端 exact commit readback 和逐文件 inventory 复算。

在这些发布验证真正完成前，不得声称 durable evidence 已发布成功。

最终裁定：

```text
REVIEW_PASS
ALLOW_FAILURE_EVIDENCE_ONLY_PUBLICATION=true
ALLOW_E0_03_CONTINUATION=false
ALLOW_ENGINE_GATE_ADJUDICATION=false
ALLOW_PRODUCTION_OR_GATE_CHANGE=false
```
