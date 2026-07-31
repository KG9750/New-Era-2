#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "open3"
require "rbconfig"

ROOT = File.expand_path("..", __dir__)
OUTPUT_JSON = File.join(ROOT, "data/item-library/branch-baseline-r2g.json")
OUTPUT_MARKDOWN = File.join(ROOT, "data/item-library/branch-baseline-r2g.md")

STAGES = [
  {
    "id" => "r1",
    "role" => "candidate_baseline",
    "artifact" => "data/item-library/item-library-r1-candidate-bundle.json",
    "review" => "docs/item-library/reviews/item-library-r1-candidate-baseline-independent-review-2026-07-27.md",
    "review_h1" => "# 候选物品库 R1 基线独立审查报告",
    "review_field" => "最终裁定",
    "review_value" => "P0=0 / P1=0 / P2=0 / REVIEW_PASS",
    "status_field" => nil,
    "status_value" => "REVIEW_PASS",
    "authorization_value" => "无"
  },
  {
    "id" => "r2a",
    "role" => "semantic_audit",
    "artifact" => "data/item-library/semantic-audit-r2a.json",
    "review" => "docs/item-library/reviews/item-library-r2a-review-status-2026-07-30.md",
    "review_h1" => "# 候选物品库 R2-A 复审状态",
    "review_field" => "独立 subagent 第三轮",
    "review_value" => "REVIEW_PASS（P0=0 / P1=0 / P2=0）",
    "status_field" => "最终状态",
    "status_value" => "R2A_REVIEW_PASS",
    "authorization_value" => "无"
  },
  {
    "id" => "r2b",
    "role" => "flow_audit",
    "artifact" => "data/item-library/flow-audit-r2b.json",
    "review" => "docs/item-library/reviews/item-library-r2b-review-status-2026-07-30.md",
    "review_h1" => "# 候选物品库 R2-B 复审状态",
    "review_field" => "独立 subagent 第三轮",
    "review_value" => "REVIEW_PASS（P0=0 / P1=0 / P2=0）",
    "status_field" => "最终状态",
    "status_value" => "R2B_REVIEW_PASS",
    "authorization_value" => "无"
  },
  {
    "id" => "r2c",
    "role" => "calibration_proposals",
    "artifact" => "data/item-library/calibration-proposals-r2c.json",
    "review" => "docs/item-library/reviews/item-library-r2c-review-status-2026-07-30.md",
    "review_h1" => "# 候选物品库 R2-C 审查状态",
    "review_field" => "独立 subagent 第二轮",
    "review_value" => "REVIEW_PASS（P0=0 / P1=0 / P2=0）",
    "status_field" => "最终状态",
    "status_value" => "R2C_REVIEW_PASS",
    "authorization_value" => "NONE"
  },
  {
    "id" => "r2d",
    "role" => "selection_packs",
    "artifact" => "data/item-library/selection-packs-r2d.json",
    "review" => "docs/item-library/reviews/item-library-r2d-review-status-2026-07-31.md",
    "review_h1" => "# 候选物品库 R2-D 审查状态",
    "review_field" => "独立 subagent 第三轮",
    "review_value" => "REVIEW_PASS（P0=0 / P1=0 / P2=0）",
    "status_field" => "最终状态",
    "status_value" => "R2D_REVIEW_PASS",
    "authorization_value" => "NONE"
  },
  {
    "id" => "r2e",
    "role" => "consumer_handoff",
    "artifact" => "data/item-library/consumer-handoff-r2e.json",
    "review" => "docs/item-library/reviews/item-library-r2e-review-status-2026-07-31.md",
    "review_h1" => "# 候选物品库 R2-E 审查状态",
    "review_field" => "独立 subagent 第三轮",
    "review_value" => "REVIEW_PASS（P0=0 / P1=0 / P2=0）",
    "status_field" => "最终状态",
    "status_value" => "R2E_REVIEW_PASS",
    "authorization_value" => "NONE"
  },
  {
    "id" => "r2f",
    "role" => "adoption_record_templates",
    "artifact" => "data/item-library/adoption-record-templates-r2f.json",
    "review" => "docs/item-library/reviews/item-library-r2f-review-status-2026-07-31.md",
    "review_h1" => "# 候选物品库 R2-F 审查状态",
    "review_field" => "独立 subagent 第三轮复审",
    "review_value" => "REVIEW_PASS（P0=0 / P1=0 / P2=0）",
    "status_field" => "当前状态",
    "status_value" => "R2F_REVIEW_PASS",
    "authorization_value" => "NONE"
  }
].freeze

SOURCE_PATHS = %w[
  docs/design-docs/item-and-manufacturing-system-v0.1.md
  docs/design-docs/item-and-manufacturing-system-v0.1-freeze-decision-2026-07-26.md
  docs/item-library/item-library-content-quota-plan-v0.1.md
  docs/item-library/item-library-r1-candidate-baseline-contract-v0.1.md
  scripts/validate_item_library.rb
  data/item-library/coverage-report.c7.md
  data/item-library/item-library-r1-candidate-bundle.json
  docs/item-library/reviews/item-library-r1-candidate-baseline-independent-review-2026-07-27.md
  docs/item-library/item-library-semantic-audit-contract-v0.1.md
  scripts/audit_item_library_semantics.rb
  data/item-library/semantic-audit-r2a.json
  data/item-library/semantic-audit-r2a.md
  docs/item-library/reviews/item-library-r2a-review-status-2026-07-30.md
  docs/item-library/item-library-flow-audit-contract-v0.1.md
  scripts/audit_item_library_flows.rb
  data/item-library/flow-audit-r2b.json
  data/item-library/flow-audit-r2b.md
  docs/item-library/reviews/item-library-r2b-review-status-2026-07-30.md
  docs/item-library/item-library-calibration-contract-v0.1.md
  scripts/propose_item_library_calibration.rb
  data/item-library/calibration-proposals-r2c.json
  data/item-library/calibration-proposals-r2c.md
  docs/item-library/reviews/item-library-r2c-review-status-2026-07-30.md
  docs/item-library/item-library-selection-pack-contract-v0.1.md
  scripts/build_item_library_selection_packs.rb
  data/item-library/selection-packs-r2d.json
  data/item-library/selection-packs-r2d.md
  docs/item-library/reviews/item-library-r2d-review-status-2026-07-31.md
  docs/item-library/item-library-consumer-handoff-contract-v0.1.md
  scripts/build_item_library_consumer_handoff.rb
  data/item-library/consumer-handoff-r2e.json
  data/item-library/consumer-handoff-r2e.md
  docs/item-library/reviews/item-library-r2e-review-status-2026-07-31.md
  docs/item-library/item-library-adoption-record-contract-v0.1.md
  scripts/validate_item_library_adoption_records.rb
  data/item-library/adoption-record-schema-r2f.json
  data/item-library/adoption-record-templates-r2f.json
  data/item-library/adoption-record-templates-r2f.md
  docs/item-library/reviews/item-library-r2f-review-status-2026-07-31.md
  docs/item-library/item-library-branch-baseline-contract-v0.1.md
  scripts/build_item_library_branch_baseline.rb
].freeze

UPSTREAM_VALIDATIONS = (
  %w[c1 c2 c3 c4 c5 c6 c7].map do |profile|
    [profile, "scripts/validate_item_library.rb", ["--profile", profile]]
  end + [
    ["r2a", "scripts/audit_item_library_semantics.rb", []],
    ["r2b", "scripts/audit_item_library_flows.rb", []],
    ["r2c", "scripts/propose_item_library_calibration.rb", []],
    ["r2d", "scripts/build_item_library_selection_packs.rb", []],
    ["r2e", "scripts/build_item_library_consumer_handoff.rb", []],
    ["r2f", "scripts/validate_item_library_adoption_records.rb", []]
  ]
).freeze

def canonicalize_json(value)
  case value
  when Hash
    value.keys.sort.to_h { |key| [key, canonicalize_json(value[key])] }
  when Array
    value.map { |entry| canonicalize_json(entry) }
  else
    value
  end
end

def canonical_sha(value)
  Digest::SHA256.hexdigest(JSON.generate(canonicalize_json(value)))
end

def absolute(relative_path)
  File.join(ROOT, relative_path)
end

def file_sha(relative_path)
  Digest::SHA256.file(absolute(relative_path)).hexdigest
end

def load_json(relative_path)
  JSON.parse(File.read(absolute(relative_path)))
rescue JSON::ParserError => error
  abort "BRANCH_BASELINE=FAIL\n- JSON 无效 #{relative_path}: #{error.message}"
end

def logical_sha(report, field)
  Digest::SHA256.hexdigest(JSON.generate(report.reject { |key, _value| key == field }))
end

def upstream_validation(label, script, arguments)
  stdout, stderr, status = Open3.capture3(
    RbConfig.ruby,
    absolute(script),
    *arguments,
    chdir: ROOT
  )
  return [nil, "#{label} 上游验证失败：#{(stdout + stderr).lines.last(8).join.strip}"] unless status.success?

  fields = Hash.new { |hash, key| hash[key] = [] }
  stdout.each_line do |line|
    match = line.strip.match(/\A([A-Z0-9_]+)=(.*)\z/)
    fields[match[1]] << match[2] if match
  end
  [fields, nil]
end

def output_value(outputs, label, field)
  values = outputs.fetch(label).fetch(field, [])
  return values.first if values.length == 1

  nil
end

def source_file_errors(report, label)
  source_files = report["source_files"]
  return ["#{label} source_files 必须是对象"] unless source_files.is_a?(Hash)

  source_files.each_with_object([]) do |(path, expected_sha), errors|
    errors << "#{label} 来源缺失或 SHA 漂移 #{path}" unless File.file?(absolute(path)) && file_sha(path) == expected_sha
  end
end

def normalized_metadata(document, expected_h1)
  preamble = document.split(/^## /, 2).first
  lines = preamble.lines.map(&:strip).reject(&:empty?)
  return nil unless lines.shift == expected_h1

  lines.each_with_object({}) do |line, values|
    match = line.match(/\A\*\*(.+?)：\*\*\s*(.+)\z/)
    return nil unless match
    return nil if values.key?(match[1])

    values[match[1]] = match[2].delete("`")
  end
end

def review_errors(stage)
  path = stage.fetch("review")
  metadata = normalized_metadata(File.read(absolute(path)), stage.fetch("review_h1"))
  return ["#{stage.fetch("id")} 审查文档 H1 或顶部元数据无效"] unless metadata

  errors = []
  expected = {
    stage.fetch("review_field") => stage.fetch("review_value"),
    "运行时授权" => stage.fetch("authorization_value")
  }
  expected["实现验证"] = "PASS" unless stage.fetch("id") == "r1"
  status_field = stage["status_field"]
  expected[status_field] = stage.fetch("status_value") if status_field
  expected.each do |field, value|
    actual = metadata[field]
    errors << "#{stage.fetch("id")} 顶部字段 #{field} 必须唯一且为 #{value}" unless actual == value
  end
  errors
end

write = false
ARGV.each do |argument|
  case argument
  when "--write"
    write = true
  else
    abort "BRANCH_BASELINE=FAIL\n- 未知参数 #{argument}"
  end
end

errors = []
errors << "阶段 ID 或来源路径重复" unless STAGES.map { |stage| stage.fetch("id") }.uniq.length == STAGES.length && SOURCE_PATHS.uniq.length == SOURCE_PATHS.length
SOURCE_PATHS.each { |path| errors << "缺少来源文件 #{path}" unless File.file?(absolute(path)) }
unless errors.empty?
  warn "BRANCH_BASELINE=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

r1 = load_json(STAGES[0].fetch("artifact"))
r2a = load_json(STAGES[1].fetch("artifact"))
r2b = load_json(STAGES[2].fetch("artifact"))
r2c = load_json(STAGES[3].fetch("artifact"))
r2d = load_json(STAGES[4].fetch("artifact"))
r2e = load_json(STAGES[5].fetch("artifact"))
r2f = load_json(STAGES[6].fetch("artifact"))

validation_outputs = {}
UPSTREAM_VALIDATIONS.each do |label, script, arguments|
  fields, error = upstream_validation(label, script, arguments)
  if error
    errors << error
  else
    validation_outputs[label] = fields
  end
end
STAGES.each { |stage| errors.concat(review_errors(stage)) }
unless errors.empty?
  warn "BRANCH_BASELINE=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

baseline_id = r1["baseline_id"]
r1_payload = r1["payload"]
r1_inventory = r1_payload.fetch("inventory_items")
r1_non_inventory = r1_payload.fetch("non_inventory_definitions")
r1_recipes = r1_payload.fetch("recipes")
r1_transitions = r1_payload.fetch("transitions")
catalog_count = r1_inventory.length + r1_non_inventory.length
payload_sha = canonical_sha(r1_payload)
r1_file_sha = file_sha(STAGES[0].fetch("artifact"))
errors << "R1 baseline_id 错误" unless baseline_id == "new-era-2.item-library.r1-c7-candidate"
errors << "R1 状态或授权错误" unless r1["status"] == "candidate_only" && r1["runtime_authorization"] == "NONE"
actual_r1_counts = {
  "inventory_items" => r1_inventory.length,
  "non_inventory_definitions" => r1_non_inventory.length,
  "catalog_definitions" => catalog_count,
  "recipes" => r1_recipes.length,
  "transitions" => r1_transitions.length
}
expected_r1_counts = {
  "inventory_items" => 196,
  "non_inventory_definitions" => 24,
  "catalog_definitions" => 220,
  "recipes" => 90,
  "transitions" => 24
}
errors << "R1 实际内容计数不再是冻结值" unless actual_r1_counts == expected_r1_counts
errors << "R1 声明计数与实际内容不一致" unless r1["counts"] == actual_r1_counts
errors << "R1 Payload SHA 无法复算" unless r1["payload_sha256"] == payload_sha
{
  "ITEM_COUNT" => r1_inventory.length,
  "NON_INVENTORY_DEFINITION_COUNT" => r1_non_inventory.length,
  "CATALOG_DEFINITION_COUNT" => catalog_count,
  "RECIPE_COUNT" => r1_recipes.length,
  "TRANSITION_COUNT" => r1_transitions.length
}.each do |field, expected|
  errors << "C7 输出 #{field} 与实际内容不一致" unless output_value(validation_outputs, "c7", field) == expected.to_s
end

r1_source_rows = r1["source_files"]
if r1_source_rows.is_a?(Array) && r1_source_rows.all? { |row| row.is_a?(Hash) && row.keys.sort == %w[path sha256] }
  r1_sources = r1_source_rows.to_h { |row| [row.fetch("path"), row.fetch("sha256")] }
  errors << "R1 嵌套来源文件数必须为 32 且路径唯一" unless r1_source_rows.length == 32 && r1_sources.length == 32
  r1_sources.each do |path, expected_sha|
    errors << "R1 嵌套来源缺失或 SHA 漂移 #{path}" unless File.file?(absolute(path)) && file_sha(path) == expected_sha
  end
else
  errors << "R1 source_files 结构错误"
  r1_sources = {}
end

[r2a, r2b, r2c, r2d, r2e, r2f].each_with_index do |report, index|
  errors.concat(source_file_errors(report, STAGES[index + 1].fetch("id")))
end

actual_logical_shas = {
  "r1" => payload_sha,
  "r2a" => logical_sha(r2a, "audit_sha256"),
  "r2b" => logical_sha(r2b, "audit_sha256"),
  "r2c" => logical_sha(r2c, "report_sha256"),
  "r2d" => logical_sha(r2d, "report_sha256"),
  "r2e" => logical_sha(r2e, "report_sha256"),
  "r2f" => logical_sha(r2f, "report_sha256")
}
declared_logical_shas = {
  "r1" => r1["payload_sha256"],
  "r2a" => r2a["audit_sha256"],
  "r2b" => r2b["audit_sha256"],
  "r2c" => r2c["report_sha256"],
  "r2d" => r2d["report_sha256"],
  "r2e" => r2e["report_sha256"],
  "r2f" => r2f["report_sha256"]
}
actual_logical_shas.each do |stage, actual_sha|
  errors << "#{stage} 逻辑 SHA 无法复算" unless declared_logical_shas[stage] == actual_sha
end
{
  "r2a" => "AUDIT_SHA256",
  "r2b" => "AUDIT_SHA256",
  "r2c" => "REPORT_SHA256",
  "r2d" => "REPORT_SHA256",
  "r2e" => "REPORT_SHA256",
  "r2f" => "REPORT_SHA256"
}.each do |stage, field|
  errors << "#{stage} 验证输出 #{field} 与复算值不一致" unless output_value(validation_outputs, stage, field) == actual_logical_shas.fetch(stage)
end

overlay_operations = r2c.fetch("numeric_patch_proposals").flat_map { |proposal| proposal.fetch("operations") }
actual_overlay_sha = canonical_sha(overlay_operations)
errors << "R2-C overlay SHA 无法复算" unless r2c["overlay_sha256"] == actual_overlay_sha

[r2a, r2b, r2c, r2d, r2e].each_with_index do |report, index|
  errors << "#{STAGES[index + 1].fetch("id")} baseline_id 漂移" unless report["source_baseline_id"] == baseline_id
  errors << "#{STAGES[index + 1].fetch("id")} payload SHA 漂移" unless report["source_payload_sha256"] == payload_sha
  errors << "#{STAGES[index + 1].fetch("id")} runtime_authorization 必须 NONE" unless report["runtime_authorization"] == "NONE"
end

errors << "R2-B 未绑定 R2-A" unless r2b["source_semantic_audit_sha256"] == r2a["audit_sha256"]
errors << "R2-C 未绑定 R2-A/R2-B/R1" unless r2c["source_semantic_audit_sha256"] == r2a["audit_sha256"] && r2c["source_flow_audit_sha256"] == r2b["audit_sha256"] && r2c["source_bundle_file_sha256"] == r1_file_sha
errors << "R2-D 未绑定 R2-A/R2-B/R2-C/R1" unless r2d["source_semantic_audit_sha256"] == r2a["audit_sha256"] && r2d["source_flow_audit_sha256"] == r2b["audit_sha256"] && r2d["source_calibration_report_sha256"] == r2c["report_sha256"] && r2d["source_calibration_overlay_sha256"] == actual_overlay_sha && r2d["source_bundle_file_sha256"] == r1_file_sha
errors << "R2-E 未绑定 R2-D/R1 文件与审查状态" unless r2e["source_selection_report_sha256"] == r2d["report_sha256"] && r2e["source_selection_report_file_sha256"] == file_sha(STAGES[4].fetch("artifact")) && r2e["source_r2d_review_file_sha256"] == file_sha(STAGES[4].fetch("review")) && r2e["source_bundle_file_sha256"] == r1_file_sha
errors << "R2-F 未绑定 R2-E 文件、审查状态与 schema" unless r2f["source_handoff_report_sha256"] == r2e["report_sha256"] && r2f["source_handoff_file_sha256"] == file_sha(STAGES[5].fetch("artifact")) && r2f["source_r2e_review_file_sha256"] == file_sha(STAGES[5].fetch("review")) && r2f["schema_file_sha256"] == file_sha("data/item-library/adoption-record-schema-r2f.json")

errors << "R2-A/R2-B 状态漂移" unless r2a["status"] == "candidate_only" && r2b["status"] == "candidate_only"
errors << "R2-C 边界漂移" unless r2c["status"] == "candidate_only" && r2c["proposal_mode"] == "proposal_only" && r2c["candidate_overlay_only"] == true && r2c["whole_bundle_runtime_import_allowed"] == false
errors << "R2-D 边界漂移" unless r2d["status"] == "candidate_only" && r2d["selection_pack_status"] == "reference_only" && r2d["whole_bundle_runtime_import_allowed"] == false
errors << "R2-E 边界漂移" unless r2e["status"] == "candidate_only" && r2e["handoff_status"] == "reference_only" && r2e["adoption_state"] == "not_adopted" && r2e["runtime_readiness"] == "blocked" && r2e["runtime_authorization"] == "NONE" && r2e["whole_bundle_runtime_import_allowed"] == false && r2e["consumer_adoption_record_generated"] == false
errors << "R2-F 边界漂移" unless r2f["record_status"] == "template_only" && r2f["submission_ready"] == false && r2f["adoption_state"] == "not_adopted" && r2f["runtime_authorization"] == "NONE" && r2f["submitted_record_count"] == 0

r2c_boundary = r2c["acceptance_boundary"]
r2c_expected_requirements = [
  "explicit stable-ID selection",
  "separate runtime schema",
  "target Gate authorization",
  "runtime and player-test evidence"
]
errors << "R2-C acceptance_boundary 漂移" unless r2c_boundary.is_a?(Hash) && r2c_boundary["r1_modified"] == false && r2c_boundary["runtime_authorized"] == false && r2c_boundary["gate_status_changed"] == false && r2c_boundary["future_adoption_requires"] == r2c_expected_requirements
[r2d, r2e, r2f].each_with_index do |report, index|
  boundary = report["acceptance_boundary"]
  errors << "#{%w[R2-D R2-E R2-F][index]} acceptance_boundary 必须全部 false" unless boundary.is_a?(Hash) && boundary.values.all? { |value| value == false }
end

r2d_pack_count = r2d.fetch("packs").length
r2e_manifest_count = r2e.fetch("manifests").length
r2f_templates = r2f.fetch("templates")
decision_groups = %w[stable_id_decisions calibration_decisions accepted_outlier_decisions mass_review_decisions]
r2f_decision_rows = r2f_templates.flat_map { |template| decision_groups.flat_map { |key| template.fetch(key) } }
r2f_stable_slots = r2f_templates.sum { |template| template.fetch("stable_id_decisions").length }
r2f_unresolved_count = r2f_decision_rows.count { |row| row["decision"] == "unresolved" }
r2f_submitted_count = r2f["submitted_record_count"]
errors << "R2-D pack 实际计数与声明不一致" unless r2d.dig("counts", "packs") == r2d_pack_count && r2d_pack_count == 4
errors << "R2-E manifest 实际计数与声明不一致" unless r2e.dig("counts", "manifests") == r2e_manifest_count && r2e_manifest_count == 4
errors << "R2-F template/decision 实际计数与声明不一致" unless r2f.dig("counts", "templates") == r2f_templates.length && r2f.dig("counts", "stable_id_decision_slots") == r2f_stable_slots && r2f.dig("counts", "all_decision_slots") == r2f_decision_rows.length && r2f.dig("counts", "unresolved_decision_slots") == r2f_unresolved_count && r2f_templates.length == 4 && r2f_stable_slots == 151 && r2f_decision_rows.length == 171 && r2f_unresolved_count == 171 && r2f_submitted_count == 0
errors << "R2-F 决策或证据已被预填" unless r2f_decision_rows.all? { |row| row["decision"] == "unresolved" && row["rationale"].nil? } && r2f_templates.all? { |template| template.fetch("evidence").values.all?(&:nil?) }

{
  "r2d" => { "PACK_COUNT" => r2d_pack_count },
  "r2e" => { "MANIFEST_COUNT" => r2e_manifest_count },
  "r2f" => {
    "TEMPLATE_COUNT" => r2f_templates.length,
    "STABLE_ID_DECISION_SLOT_COUNT" => r2f_stable_slots,
    "ALL_DECISION_SLOT_COUNT" => r2f_decision_rows.length,
    "UNRESOLVED_DECISION_SLOT_COUNT" => r2f_unresolved_count,
    "SUBMITTED_RECORD_COUNT" => r2f_submitted_count
  }
}.each do |stage, fields|
  fields.each do |field, expected|
    errors << "#{stage} 输出 #{field} 与实际内容不一致" unless output_value(validation_outputs, stage, field) == expected.to_s
  end
end

unless errors.empty?
  warn "BRANCH_BASELINE=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

logical_shas = actual_logical_shas
runtime_authorizations = {
  "r1" => r1.fetch("runtime_authorization"),
  "r2a" => r2a.fetch("runtime_authorization"),
  "r2b" => r2b.fetch("runtime_authorization"),
  "r2c" => r2c.fetch("runtime_authorization"),
  "r2d" => r2d.fetch("runtime_authorization"),
  "r2e" => r2e.fetch("runtime_authorization"),
  "r2f" => r2f.fetch("runtime_authorization")
}

stage_chain = STAGES.map do |stage|
  {
    "stage" => stage.fetch("id"),
    "role" => stage.fetch("role"),
    "artifact_path" => stage.fetch("artifact"),
    "artifact_file_sha256" => file_sha(stage.fetch("artifact")),
    "logical_sha256" => logical_shas.fetch(stage.fetch("id")),
    "review_path" => stage.fetch("review"),
    "review_file_sha256" => file_sha(stage.fetch("review")),
    "review_status" => stage.fetch("status_value"),
    "runtime_authorization" => runtime_authorizations.fetch(stage.fetch("id"))
  }
end

frozen_counts = {
  "inventory_items" => r1_inventory.length,
  "non_inventory_definitions" => r1_non_inventory.length,
  "catalog_definitions" => catalog_count,
  "recipes" => r1_recipes.length,
  "transitions" => r1_transitions.length,
  "selection_packs" => r2d_pack_count,
  "consumer_manifests" => r2e_manifest_count,
  "adoption_templates" => r2f_templates.length,
  "stable_id_decision_slots" => r2f_stable_slots,
  "all_decision_slots" => r2f_decision_rows.length,
  "unresolved_decision_slots" => r2f_unresolved_count,
  "submitted_records" => r2f_submitted_count,
  "r1_nested_source_files" => r1_sources.length,
  "branch_source_files" => SOURCE_PATHS.length
}
frozen_boundary = r2f.fetch("acceptance_boundary").merge("mainline_merged" => false)

core = {
  "schema_version" => "new-era-2.item-library.branch-baseline.r2g.v0.1",
  "baseline_id" => "new-era-2.item-library.r2-reviewed-branch-baseline",
  "status" => "reference_only",
  "source_baseline_id" => baseline_id,
  "source_payload_sha256" => payload_sha,
  "source_bundle_file_sha256" => r1_file_sha,
  "adoption_state" => r2f.fetch("adoption_state"),
  "runtime_readiness" => r2e.fetch("runtime_readiness"),
  "runtime_authorization" => r2f.fetch("runtime_authorization"),
  "whole_bundle_runtime_import_allowed" => r2e.fetch("whole_bundle_runtime_import_allowed"),
  "counts" => frozen_counts,
  "stage_chain" => stage_chain,
  "r1_nested_source_files" => r1_sources.sort.to_h,
  "source_files" => SOURCE_PATHS.sort.to_h { |path| [path, file_sha(path)] },
  "acceptance_boundary" => frozen_boundary
}
manifest_sha = canonical_sha(core)
manifest = core.merge("manifest_sha256" => manifest_sha)
json_output = JSON.pretty_generate(manifest) + "\n"

lines = []
lines << "# 候选物品库 R2-G 支干冻结基线"
lines << ""
lines << "**基线 ID：** `#{manifest.fetch("baseline_id")}`"
lines << "**状态：** `#{manifest.fetch("status")}`"
lines << "**采纳状态：** `#{manifest.fetch("adoption_state")}`"
lines << "**运行时就绪：** `#{manifest.fetch("runtime_readiness")}`"
lines << "**运行时授权：** `#{manifest.fetch("runtime_authorization")}`"
lines << "**Manifest SHA-256：** `#{manifest_sha}`"
lines << ""
lines << "## 1. 冻结内容"
lines << ""
lines << "- 目录定义：#{frozen_counts.fetch("catalog_definitions")}（#{frozen_counts.fetch("inventory_items")} 个库存物品 + #{frozen_counts.fetch("non_inventory_definitions")} 个非库存定义）"
lines << "- 工艺：#{frozen_counts.fetch("recipes")}"
lines << "- 转换流程：#{frozen_counts.fetch("transitions")}"
lines << "- 主题选择包 / 消费 manifest / 空白采纳模板：#{frozen_counts.fetch("selection_packs")} / #{frozen_counts.fetch("consumer_manifests")} / #{frozen_counts.fetch("adoption_templates")}"
lines << "- 决策槽：#{frozen_counts.fetch("all_decision_slots")}，全部 unresolved；真实 submitted：#{frozen_counts.fetch("submitted_records")}"
lines << ""
lines << "## 2. 审查链"
lines << ""
lines << "| 阶段 | 角色 | 审查状态 | 逻辑 SHA-256 |"
lines << "|---|---|---|---|"
stage_chain.each do |stage|
  lines << "| #{stage.fetch("stage").upcase} | #{stage.fetch("role")} | `#{stage.fetch("review_status")}` | `#{stage.fetch("logical_sha256")}` |"
end
lines << ""
lines << "## 3. 来源完整性"
lines << ""
lines << "- R1 嵌套来源文件：#{frozen_counts.fetch("r1_nested_source_files")}"
lines << "- 支干冻结来源文件：#{frozen_counts.fetch("branch_source_files")}"
lines << "- R1 Bundle 文件 SHA-256：`#{r1_file_sha}`"
lines << "- R1 Payload SHA-256：`#{payload_sha}`"
lines << ""
lines << "## 4. 验证"
lines << ""
lines << "```bash"
lines << "ruby scripts/build_item_library_branch_baseline.rb --write"
lines << "ruby scripts/build_item_library_branch_baseline.rb"
lines << "```"
lines << ""
lines << "## 5. 边界"
lines << ""
lines << "本基线只提供 `reference_only` 支干交接入口。它不代表主干采纳、运行时 schema、Gate 授权、真人试玩或合并完成。"
markdown_output = lines.join("\n") + "\n"

if write
  File.write(OUTPUT_JSON, json_output)
  File.write(OUTPUT_MARKDOWN, markdown_output)
  puts "BRANCH_BASELINE_JSON=WRITTEN #{OUTPUT_JSON}"
  puts "BRANCH_BASELINE_MARKDOWN=WRITTEN #{OUTPUT_MARKDOWN}"
else
  {
    OUTPUT_JSON => json_output,
    OUTPUT_MARKDOWN => markdown_output
  }.each do |path, expected|
    unless File.file?(path) && File.read(path) == expected
      abort "BRANCH_BASELINE=FAIL\n- #{File.basename(path)} 缺失或已过期；使用 --write 刷新"
    end
  end
end

puts "BRANCH_BASELINE=PASS"
puts "STAGE_COUNT=#{stage_chain.length}"
puts "CATALOG_DEFINITION_COUNT=#{frozen_counts.fetch("catalog_definitions")}"
puts "RECIPE_COUNT=#{frozen_counts.fetch("recipes")}"
puts "TRANSITION_COUNT=#{frozen_counts.fetch("transitions")}"
puts "SELECTION_PACK_COUNT=#{frozen_counts.fetch("selection_packs")}"
puts "CONSUMER_MANIFEST_COUNT=#{frozen_counts.fetch("consumer_manifests")}"
puts "ADOPTION_TEMPLATE_COUNT=#{frozen_counts.fetch("adoption_templates")}"
puts "ALL_DECISION_SLOT_COUNT=#{frozen_counts.fetch("all_decision_slots")}"
puts "UNRESOLVED_DECISION_SLOT_COUNT=#{frozen_counts.fetch("unresolved_decision_slots")}"
puts "SUBMITTED_RECORD_COUNT=#{frozen_counts.fetch("submitted_records")}"
puts "R1_NESTED_SOURCE_FILE_COUNT=#{frozen_counts.fetch("r1_nested_source_files")}"
puts "BRANCH_SOURCE_FILE_COUNT=#{frozen_counts.fetch("branch_source_files")}"
puts "MANIFEST_SHA256=#{manifest_sha}"
puts "R1_BUNDLE_FILE_SHA256=#{r1_file_sha}"
puts "ADOPTION_STATE=#{manifest.fetch("adoption_state")}"
puts "RUNTIME_AUTHORIZATION=#{manifest.fetch("runtime_authorization")}"
