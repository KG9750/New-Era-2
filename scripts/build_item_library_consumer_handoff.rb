#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "set"

ROOT = File.expand_path("..", __dir__)
BUNDLE_PATH = File.join(ROOT, "data/item-library/item-library-r1-candidate-bundle.json")
SELECTION_REPORT_PATH = File.join(ROOT, "data/item-library/selection-packs-r2d.json")
R2D_REVIEW_PATH = File.join(ROOT, "docs/item-library/reviews/item-library-r2d-review-status-2026-07-31.md")
CONTRACT_PATH = File.join(ROOT, "docs/item-library/item-library-consumer-handoff-contract-v0.1.md")
JSON_REPORT_PATH = File.join(ROOT, "data/item-library/consumer-handoff-r2e.json")
MARKDOWN_REPORT_PATH = File.join(ROOT, "data/item-library/consumer-handoff-r2e.md")

EXPECTED_BASELINE_ID = "new-era-2.item-library.r1-c7-candidate"
NODE_GROUPS = %w[inventory_items non_inventory_definitions recipes transitions].freeze
REQUIRED_BLOCKERS = %w[
  runtime_schema_defined
  target_gate_authorized
  r2c_proposals_adjudicated
  manual_reviews_resolved
  external_supply_policy_defined
  save_migration_assessed
  runtime_validation_completed
  human_playtest_completed
].freeze

def parse_arguments(argv)
  options = { write: false }
  argv.each do |argument|
    case argument
    when "--write"
      options[:write] = true
    else
      abort "CONSUMER_HANDOFF=FAIL\n- 未知参数 #{argument}"
    end
  end
  options
end

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

def code(value)
  96.chr + value.to_s + 96.chr
end

def all_node_ids(nodes)
  NODE_GROUPS.flat_map { |group| nodes.fetch(group) }.uniq.sort
end

def top_metadata(document, expected_h1)
  preamble = document.split(/^## /, 2).first
  lines = preamble.lines.map(&:strip).reject(&:empty?)
  return nil unless lines.shift == expected_h1

  lines.each_with_object({}) do |line, fields|
    match = line.match(/\A\*\*(.+?)：\*\* (.+)\z/)
    return nil unless match

    key = match[1]
    return nil if fields.key?(key)

    fields[key] = match[2]
  end
end

def review_section_gate(document, title)
  pattern = /^## \d+\. #{Regexp.escape(title)}\s*\n(.*?)(?=^## |\z)/m
  sections = document.scan(pattern)
  return [] unless sections.length == 1

  sections.first.first.scan(/```text\s*\n(.*?)\n```/m).map do |match|
    match.first.lines.map(&:strip).reject(&:empty?)
  end
end

def r2d_review_pass?(document)
  fields = top_metadata(document, "# 候选物品库 R2-D 审查状态")
  return false unless fields

  expected_fields = [
    "日期",
    "范围",
    "实现验证",
    "独立 subagent 首审",
    "独立 subagent 第二轮",
    "独立 subagent 第三轮",
    "最终状态",
    "运行时授权"
  ]
  return false unless fields.keys.sort == expected_fields.sort
  return false unless fields["实现验证"] == "`PASS`"
  return false unless fields["独立 subagent 第三轮"] == "`REVIEW_PASS`（`P0=0 / P1=0 / P2=0`）"
  return false unless fields["最终状态"] == "`R2D_REVIEW_PASS`"
  return false unless fields["运行时授权"] == "`NONE`"

  review_section_gate(document, "第三轮独立复审") == [%w[P0=0 P1=0 P2=0 REVIEW_PASS]]
end

def assert_review_gate_regressions(document)
  pass_status = "**最终状态：** `R2D_REVIEW_PASS`"
  pending = document.sub(pass_status, "**最终状态：** `R2D_REVIEW_PENDING`")
  duplicate = document.sub(pass_status, [pass_status, pass_status].join("\n"))
  fenced = document.sub(pass_status, "**当前状态：** `R2D_REVIEW_PENDING`").sub(
    /^## /,
    "```text\n#{pass_status}\n```\n\n## "
  )
  failed_gate = document.sub(
    "P0=0\nP1=0\nP2=0\nREVIEW_PASS",
    "P0=0\nP1=1\nP2=0\nREVIEW_FAIL"
  )
  raise "R2-D pending 状态绕过门禁" if r2d_review_pass?(pending)
  raise "R2-D 重复最终状态绕过门禁" if r2d_review_pass?(duplicate)
  raise "R2-D fenced 伪状态绕过门禁" if r2d_review_pass?(fenced)
  raise "R2-D 第三轮失败结论绕过门禁" if r2d_review_pass?(failed_gate)
end

def source_file_errors(source_files)
  source_files.each_with_object([]) do |(relative_path, expected_sha), errors|
    path = File.join(ROOT, relative_path)
    if !File.file?(path)
      errors << "R2-D 缺少来源文件 #{relative_path}"
    elsif Digest::SHA256.file(path).hexdigest != expected_sha
      errors << "R2-D 来源文件 SHA 漂移 #{relative_path}"
    end
  end
end

def build_id_types(payload)
  {
    "inventory_items" => payload.fetch("inventory_items"),
    "non_inventory_definitions" => payload.fetch("non_inventory_definitions"),
    "recipes" => payload.fetch("recipes"),
    "transitions" => payload.fetch("transitions")
  }.each_with_object({}) do |(group, rows), memo|
    rows.each { |row| memo[row.fetch("id")] = group }
  end
end

def supply_summary(rows)
  {
    "external_only_item_ids" => rows.select { |row| row.fetch("supply_mode") == "external_source" }
                                      .map { |row| row.fetch("id") }.sort,
    "producer_only_item_ids" => rows.select { |row| row.fetch("supply_mode") == "recommended_producer" }
                                      .map { |row| row.fetch("id") }.sort,
    "producer_or_external_item_ids" => rows.select { |row| row.fetch("supply_mode") == "recommended_producer_or_external" }
                                             .map { |row| row.fetch("id") }.sort,
    "incidental_co_production_item_ids" => rows.select { |row| !row.fetch("incidental_co_producer_recipe_ids").empty? }
                                                .map { |row| row.fetch("id") }.sort
  }
end

def build_manifest(pack, id_types)
  nodes = pack.dig("recommended_production_path", "nodes")
  explicit_ids = all_node_ids(nodes)
  excluded_nodes = pack.dig("audit_context_only", "nodes")
  excluded_ids = all_node_ids(excluded_nodes)
  supply_rows = pack.dig("recommended_production_path", "required_input_supply")
  risks = pack.dig("risk_binding", "recommended_production_path")
  errors = []

  errors << "根不属于显式选择面" unless (pack.fetch("roots") - explicit_ids).empty?
  overlap = explicit_ids & excluded_ids
  errors << "显式选择与默认排除面相交：#{overlap.join(", ")}" unless overlap.empty?
  unknown = explicit_ids.reject { |id| id_types.key?(id) }
  errors << "显式选择包含未知 ID：#{unknown.join(", ")}" unless unknown.empty?

  NODE_GROUPS.each do |group|
    wrong_type = nodes.fetch(group).reject { |id| id_types[id] == group }
    errors << "#{group} 包含错误类型：#{wrong_type.join(", ")}" unless wrong_type.empty?
  end

  selected_recipes = nodes.fetch("recipes")
  supply_rows.each do |row|
    errors << "#{row.fetch("id")} 供应状态为 unsatisfied" if row.fetch("supply_mode") == "unsatisfied"
    errors << "供应行引用非选择物品 #{row.fetch("id")}" unless nodes.fetch("inventory_items").include?(row.fetch("id"))
    producer_ids = row.fetch("designated_supply_producer_recipe_ids") + row.fetch("incidental_co_producer_recipe_ids")
    missing_recipes = producer_ids - selected_recipes
    errors << "#{row.fetch("id")} 供应工艺未进入选择面：#{missing_recipes.join(", ")}" unless missing_recipes.empty?
  end

  unless errors.empty?
    raise "#{pack.fetch("id")} 交接清单失败：#{errors.join("；")}"
  end

  manifest_core = {
    "id" => pack.fetch("id").sub("pack.r2d.", "handoff.r2e."),
    "name" => pack.fetch("name"),
    "source_pack_id" => pack.fetch("id"),
    "source_pack_sha256" => pack.fetch("pack_sha256"),
    "source_path_sha256" => pack.dig("recommended_production_path", "path_sha256"),
    "selection_mode" => "explicit_stable_id_allowlist",
    "roots" => pack.fetch("roots"),
    "explicit_selection" => nodes,
    "explicit_stable_ids" => explicit_ids,
    "default_excluded_audit_context" => {
      "policy" => "deny_unless_separately_selected_and_reaudited",
      "nodes" => excluded_nodes,
      "stable_ids" => excluded_ids,
      "source_context_sha256" => pack.dig("audit_context_only", "context_sha256")
    },
    "supply_interface" => {
      "required_input_supply" => supply_rows,
      "summary" => supply_summary(supply_rows)
    },
    "adoption_decision_queue" => {
      "numeric_patch_proposal_ids" => risks.fetch("r2c_numeric_patch_proposal_ids"),
      "accepted_outlier_ids" => risks.fetch("r2c_accepted_outlier_ids"),
      "mass_review_recipe_ids" => risks.fetch("r2c_mass_review_recipe_ids"),
      "r2b_value_outlier_recipe_ids" => risks.fetch("r2b_value_outlier_recipe_ids"),
      "r2b_contained_cycle_ids" => risks.fetch("r2b_contained_cycle_ids"),
      "r2b_cycle_touchpoint_ids" => risks.fetch("r2b_cycle_touchpoint_ids"),
      "r2b_shared_bottleneck_item_ids" => risks.fetch("r2b_shared_bottleneck_item_ids"),
      "semantic_warning_review" => pack.dig("readiness", "semantic_warning_review")
    },
    "consumer_decisions" => [],
    "handoff_preparation" => "complete",
    "adoption_state" => "not_adopted",
    "runtime_readiness" => "blocked",
    "unresolved_adoption_requirements" => REQUIRED_BLOCKERS,
    "runtime_payload" => false
  }
  manifest_core.merge("manifest_sha256" => canonical_sha(manifest_core))
end

def build_markdown(report)
  lines = []
  lines << "# 候选物品库 R2-E 主干消费交接清单"
  lines << ""
  lines << "**来源基线：** #{code(report.fetch("source_baseline_id"))}"
  lines << "**来源 R2-D 报告：** #{code(report.fetch("source_selection_report_sha256"))}"
  lines << "**内容状态：** #{code(report.fetch("status"))}"
  lines << "**交接状态：** #{code(report.fetch("handoff_status"))}"
  lines << "**采纳状态：** #{code(report.fetch("adoption_state"))}"
  lines << "**运行时授权：** #{code(report.fetch("runtime_authorization"))}"
  lines << "**报告 SHA-256：** #{code(report.fetch("report_sha256"))}"
  lines << ""
  lines << "## 1. 结论"
  lines << ""
  lines << "- #{code("CONSUMER_HANDOFF=PASS")}"
  lines << "- #{code("MANIFEST_COUNT=#{report.dig("counts", "manifests")}")}"
  lines << "- #{code("UNIQUE_EXPLICIT_ID_COUNT=#{report.dig("counts", "unique_explicit_ids")}")}"
  lines << "- #{code("RUNTIME_AUTHORIZATION=NONE")}"
  lines << ""
  lines << "这些 manifest 是未来主干的显式稳定 ID 评估入口，不是运行时导入包；所有采纳决定和证据槽仍为空或阻塞。"
  lines << ""
  lines << "## 2. Manifest 概览"
  lines << ""
  lines << "| Manifest | 根 | 显式 ID | 默认排除 | 外部来源 | 数值决定 | 人工复核 | 状态 |"
  lines << "|---|---:|---:|---:|---:|---:|---:|---|"
  report.fetch("manifests").each do |manifest|
    supply = manifest.dig("supply_interface", "summary")
    queue = manifest.fetch("adoption_decision_queue")
    review_count = queue.fetch("accepted_outlier_ids").length + queue.fetch("mass_review_recipe_ids").length
    lines << "| #{code(manifest.fetch("id"))} | #{manifest.fetch("roots").length} | #{manifest.fetch("explicit_stable_ids").length} | #{manifest.dig("default_excluded_audit_context", "stable_ids").length} | #{supply.fetch("external_only_item_ids").length} | #{queue.fetch("numeric_patch_proposal_ids").length} | #{review_count} | #{code(manifest.fetch("runtime_readiness"))} |"
  end
  lines << ""

  report.fetch("manifests").each_with_index do |manifest, index|
    lines << "## #{index + 3}. #{manifest.fetch("name")}（#{code(manifest.fetch("id"))}）"
    lines << ""
    lines << "- 来源包：#{code(manifest.fetch("source_pack_id"))}"
    lines << "- Manifest SHA-256：#{code(manifest.fetch("manifest_sha256"))}"
    lines << "- 显式选择：#{manifest.fetch("explicit_stable_ids").length} 个稳定 ID"
    lines << "- 默认排除：#{manifest.dig("default_excluded_audit_context", "stable_ids").length} 个审计上下文 ID"
    lines << "- 采纳状态：#{code(manifest.fetch("adoption_state"))}"
    lines << "- 运行时就绪：#{code(manifest.fetch("runtime_readiness"))}"
    lines << ""
    lines << "根稳定 ID："
    lines << ""
    manifest.fetch("roots").each { |id| lines << "- #{code(id)}" }
    lines << ""
    queue = manifest.fetch("adoption_decision_queue")
    lines << "待决策："
    lines << ""
    lines << "- R2-C 数值提案：#{queue.fetch("numeric_patch_proposal_ids").length}"
    lines << "- 暂时接受异常：#{queue.fetch("accepted_outlier_ids").length}"
    lines << "- 质量人工复核：#{queue.fetch("mass_review_recipe_ids").length}"
    lines << "- R2-B 循环触点：#{queue.fetch("r2b_cycle_touchpoint_ids").length}"
    lines << ""
  end

  lines << "## #{report.fetch("manifests").length + 3}. 消费边界"
  lines << ""
  lines << "- #{code("consumer_decisions")} 全部为空；"
  lines << "- #{code("adoption_state=not_adopted")}；"
  lines << "- #{code("runtime_readiness=blocked")}；"
  lines << "- 不允许整包运行时导入；"
  lines << "- 不改变 R1、R2-C、R2-D 或 Gate；"
  lines << "- 不替代真人试玩。"
  lines << ""
  lines << "## #{report.fetch("manifests").length + 4}. 重建命令"
  lines << ""
  lines << "    ruby scripts/build_item_library_consumer_handoff.rb --write"
  lines << "    ruby scripts/build_item_library_consumer_handoff.rb"
  lines << ""
  lines.join("\n")
end

options = parse_arguments(ARGV)
required_paths = [BUNDLE_PATH, SELECTION_REPORT_PATH, R2D_REVIEW_PATH, CONTRACT_PATH]
required_paths.each { |path| abort "CONSUMER_HANDOFF=FAIL\n- 缺少 #{path}" unless File.file?(path) }

bundle_sha_before = Digest::SHA256.file(BUNDLE_PATH).hexdigest
selection_sha_before = Digest::SHA256.file(SELECTION_REPORT_PATH).hexdigest
bundle = JSON.parse(File.read(BUNDLE_PATH))
selection_report = JSON.parse(File.read(SELECTION_REPORT_PATH))
r2d_review = File.read(R2D_REVIEW_PATH)
payload = bundle.fetch("payload")
errors = []

errors << "R1 baseline 身份错误" unless bundle["baseline_id"] == EXPECTED_BASELINE_ID
errors << "R1 Payload SHA 无法复算" unless canonical_sha(payload) == bundle["payload_sha256"]
errors << "R1 未保持 candidate_only / NONE" unless bundle["status"] == "candidate_only" && bundle["runtime_authorization"] == "NONE"
selection_policy = bundle.fetch("selection_policy")
unless selection_policy["default_runtime_import"] == "deny" &&
       selection_policy["whole_bundle_import_allowed"] == false &&
       selection_policy["requires_explicit_stable_id_selection"] == true &&
       selection_policy["requires_separate_runtime_schema_and_gate_authorization"] == true
  errors << "R1 选择策略不再拒绝整包运行时导入"
end

selection_core = selection_report.reject { |key, _value| key == "report_sha256" }
unless Digest::SHA256.hexdigest(JSON.generate(selection_core)) == selection_report["report_sha256"] &&
       selection_report["source_baseline_id"] == bundle["baseline_id"] &&
       selection_report["source_payload_sha256"] == bundle["payload_sha256"] &&
       selection_report["source_bundle_file_sha256"] == bundle_sha_before &&
       selection_report["status"] == "candidate_only" &&
       selection_report["selection_pack_status"] == "reference_only" &&
       selection_report["runtime_authorization"] == "NONE" &&
       selection_report["whole_bundle_runtime_import_allowed"] == false
  errors << "R2-D 报告与当前冻结基线不一致或无法复算"
end
errors.concat(source_file_errors(selection_report.fetch("source_files")))

selection_report.fetch("packs").each do |pack|
  pack_core = pack.reject { |key, _value| key == "pack_sha256" }
  errors << "#{pack.fetch("id")} pack SHA 无法复算" unless canonical_sha(pack_core) == pack["pack_sha256"]
  path = pack.fetch("recommended_production_path")
  path_core = path.reject { |key, _value| key == "path_sha256" }
  errors << "#{pack.fetch("id")} path SHA 无法复算" unless canonical_sha(path_core) == path["path_sha256"]
  context = pack.fetch("audit_context_only")
  errors << "#{pack.fetch("id")} context SHA 无法复算" unless canonical_sha(context.fetch("nodes")) == context["context_sha256"]
  errors << "#{pack.fetch("id")} R2-D readiness 不再阻塞" unless pack.dig("readiness", "runtime_readiness") == "blocked"
end

assert_review_gate_regressions(r2d_review)
errors << "R2-D 独立审查尚未通过" unless r2d_review_pass?(r2d_review)

unless errors.empty?
  warn "CONSUMER_HANDOFF=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

id_types = build_id_types(payload)
manifests = selection_report.fetch("packs").sort_by { |pack| pack.fetch("id") }.map do |pack|
  build_manifest(pack, id_types)
end

manifest_ids = manifests.map { |manifest| manifest.fetch("id") }
abort "CONSUMER_HANDOFF=FAIL\n- Manifest ID 不唯一" unless manifest_ids.uniq.length == manifest_ids.length
all_explicit_ids = manifests.flat_map { |manifest| manifest.fetch("explicit_stable_ids") }.uniq.sort
all_excluded_ids = manifests.flat_map { |manifest| manifest.dig("default_excluded_audit_context", "stable_ids") }.uniq.sort

report_core = {
  "schema_version" => "new-era-2.item-library.consumer-handoff.r2e.v0.1",
  "source_baseline_id" => bundle.fetch("baseline_id"),
  "source_payload_sha256" => bundle.fetch("payload_sha256"),
  "source_bundle_file_sha256" => bundle_sha_before,
  "source_selection_report_sha256" => selection_report.fetch("report_sha256"),
  "source_selection_report_file_sha256" => selection_sha_before,
  "source_r2d_review_file_sha256" => Digest::SHA256.file(R2D_REVIEW_PATH).hexdigest,
  "status" => "candidate_only",
  "handoff_status" => "reference_only",
  "adoption_state" => "not_adopted",
  "runtime_readiness" => "blocked",
  "runtime_authorization" => "NONE",
  "whole_bundle_runtime_import_allowed" => false,
  "consumer_adoption_record_generated" => false,
  "source_files" => {
    "data/item-library/item-library-r1-candidate-bundle.json" => bundle_sha_before,
    "data/item-library/selection-packs-r2d.json" => selection_sha_before,
    "docs/item-library/reviews/item-library-r2d-review-status-2026-07-31.md" => Digest::SHA256.file(R2D_REVIEW_PATH).hexdigest,
    "docs/item-library/item-library-consumer-handoff-contract-v0.1.md" => Digest::SHA256.file(CONTRACT_PATH).hexdigest,
    "scripts/build_item_library_consumer_handoff.rb" => Digest::SHA256.file(__FILE__).hexdigest
  },
  "counts" => {
    "manifests" => manifests.length,
    "unique_explicit_ids" => all_explicit_ids.length,
    "unique_default_excluded_ids" => all_excluded_ids.length
  },
  "manifests" => manifests,
  "acceptance_boundary" => {
    "r1_modified" => false,
    "r2c_proposals_adopted" => false,
    "r2d_selection_changed" => false,
    "runtime_schema_generated" => false,
    "runtime_authorized" => false,
    "gate_status_changed" => false,
    "human_playtest_completed" => false
  }
}
report_sha = Digest::SHA256.hexdigest(JSON.generate(report_core))
report = report_core.merge("report_sha256" => report_sha)
json_output = JSON.pretty_generate(report) + "\n"
markdown_output = build_markdown(report)

if options[:write]
  File.write(JSON_REPORT_PATH, json_output)
  File.write(MARKDOWN_REPORT_PATH, markdown_output)
  puts "CONSUMER_HANDOFF_JSON=WRITTEN #{JSON_REPORT_PATH}"
  puts "CONSUMER_HANDOFF_MARKDOWN=WRITTEN #{MARKDOWN_REPORT_PATH}"
else
  unless File.file?(JSON_REPORT_PATH) && File.read(JSON_REPORT_PATH) == json_output
    warn "CONSUMER_HANDOFF=FAIL"
    warn "- #{File.basename(JSON_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
  unless File.file?(MARKDOWN_REPORT_PATH) && File.read(MARKDOWN_REPORT_PATH) == markdown_output
    warn "CONSUMER_HANDOFF=FAIL"
    warn "- #{File.basename(MARKDOWN_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
end

unless Digest::SHA256.file(BUNDLE_PATH).hexdigest == bundle_sha_before &&
       Digest::SHA256.file(SELECTION_REPORT_PATH).hexdigest == selection_sha_before
  warn "CONSUMER_HANDOFF=FAIL"
  warn "- 上游输入在生成期间发生变化"
  exit 1
end

puts "CONSUMER_HANDOFF=PASS"
puts "MANIFEST_COUNT=#{manifests.length}"
puts "UNIQUE_EXPLICIT_ID_COUNT=#{all_explicit_ids.length}"
puts "UNIQUE_DEFAULT_EXCLUDED_ID_COUNT=#{all_excluded_ids.length}"
manifests.each do |manifest|
  puts "MANIFEST=#{manifest.fetch("id")} ROOTS=#{manifest.fetch("roots").length} EXPLICIT_IDS=#{manifest.fetch("explicit_stable_ids").length} DEFAULT_EXCLUDED_IDS=#{manifest.dig("default_excluded_audit_context", "stable_ids").length}"
end
puts "REPORT_SHA256=#{report_sha}"
puts "R1_BUNDLE_FILE_SHA256=#{bundle_sha_before}"
puts "R1_PAYLOAD_SHA256=#{bundle.fetch("payload_sha256")}"
puts "R2D_REPORT_SHA256=#{selection_report.fetch("report_sha256")}"
puts "ADOPTION_STATE=not_adopted"
puts "RUNTIME_AUTHORIZATION=NONE"
