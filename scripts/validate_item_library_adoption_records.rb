#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"

ROOT = File.expand_path("..", __dir__)
HANDOFF_PATH = File.join(ROOT, "data/item-library/consumer-handoff-r2e.json")
R2E_REVIEW_PATH = File.join(ROOT, "docs/item-library/reviews/item-library-r2e-review-status-2026-07-31.md")
CONTRACT_PATH = File.join(ROOT, "docs/item-library/item-library-adoption-record-contract-v0.1.md")
SCHEMA_PATH = File.join(ROOT, "data/item-library/adoption-record-schema-r2f.json")
TEMPLATES_PATH = File.join(ROOT, "data/item-library/adoption-record-templates-r2f.json")
MARKDOWN_PATH = File.join(ROOT, "data/item-library/adoption-record-templates-r2f.md")

DECISION_KEYS = %w[id decision rationale].freeze
EVIDENCE_KEYS = %w[
  runtime_schema_version
  target_gate_authorization
  external_supply_policy
  save_migration_assessment
  runtime_validation_evidence
  human_playtest_evidence
].freeze
RECORD_KEYS = %w[
  schema_version
  template_id
  record_origin
  record_status
  consumer_id
  target_branch
  source_manifest_id
  source_manifest_sha256
  source_handoff_report_sha256
  candidate_stable_ids
  stable_id_decisions
  calibration_decisions
  accepted_outlier_decisions
  mass_review_decisions
  evidence
  selected_stable_ids
  rejected_or_deferred_stable_ids
  submission_ready
  adoption_state
  runtime_authorization
  record_sha256
].freeze

def parse_arguments(argv)
  options = { write: false, record: nil }
  index = 0
  while index < argv.length
    case argv[index]
    when "--write"
      options[:write] = true
      index += 1
    when "--record"
      abort "ADOPTION_RECORDS=FAIL\n- --record 缺少路径" if index + 1 >= argv.length
      options[:record] = argv[index + 1]
      index += 2
    else
      abort "ADOPTION_RECORDS=FAIL\n- 未知参数 #{argv[index]}"
    end
  end
  abort "ADOPTION_RECORDS=FAIL\n- --write 与 --record 不可同时使用" if options[:write] && options[:record]
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

def top_metadata(document, expected_h1)
  preamble = document.split(/^## /, 2).first
  lines = preamble.lines.map(&:strip).reject(&:empty?)
  return nil unless lines.shift == expected_h1

  lines.each_with_object({}) do |line, fields|
    match = line.match(/\A\*\*(.+?)：\*\* (.+)\z/)
    return nil unless match
    return nil if fields.key?(match[1])

    fields[match[1]] = match[2]
  end
end

def section_blocks(document, title)
  pattern = /^## \d+\. #{Regexp.escape(title)}\s*\n(.*?)(?=^## |\z)/m
  sections = document.scan(pattern)
  return [] unless sections.length == 1

  sections.first.first.scan(/```text\s*\n(.*?)\n```/m).map do |match|
    match.first.lines.map(&:strip).reject(&:empty?)
  end
end

def key_value_fields(lines)
  lines.each_with_object({}) do |line, fields|
    match = line.match(/\A([A-Z0-9_]+)=(.+)\z/)
    return nil unless match
    return nil if fields.key?(match[1])

    fields[match[1]] = match[2]
  end
end

def r2e_review_pass?(document, expected_results)
  fields = top_metadata(document, "# 候选物品库 R2-E 审查状态")
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
  return false unless fields["最终状态"] == "`R2E_REVIEW_PASS`"
  return false unless fields["运行时授权"] == "`NONE`"

  result_blocks = section_blocks(document, "本地实现结果")
  return false unless result_blocks.length == 1
  return false unless key_value_fields(result_blocks.first) == expected_results

  section_blocks(document, "第三轮独立复审") == [%w[P0=0 P1=0 P2=0 REVIEW_PASS]]
end

def assert_review_gate_regressions(document, expected_results)
  pass_status = "**最终状态：** `R2E_REVIEW_PASS`"
  pending = document.sub(pass_status, "**最终状态：** `R2E_REVIEW_PENDING`")
  duplicate = document.sub(pass_status, [pass_status, pass_status].join("\n"))
  stale_report = document.sub(
    "REPORT_SHA256=#{expected_results.fetch("REPORT_SHA256")}",
    "REPORT_SHA256=#{"0" * 64}"
  )
  failed_gate = document.sub(
    "P0=0\nP1=0\nP2=0\nREVIEW_PASS",
    "P0=0\nP1=1\nP2=0\nREVIEW_FAIL"
  )
  raise "R2-E pending 状态绕过门禁" if r2e_review_pass?(pending, expected_results)
  raise "R2-E 重复最终状态绕过门禁" if r2e_review_pass?(duplicate, expected_results)
  raise "R2-E 过期报告 SHA 绕过门禁" if r2e_review_pass?(stale_report, expected_results)
  raise "R2-E 第三轮失败结论绕过门禁" if r2e_review_pass?(failed_gate, expected_results)
end

def schema_document(handoff)
  decision_item = lambda do |decisions|
    {
      "type" => "object",
      "additionalProperties" => false,
      "required" => DECISION_KEYS,
      "properties" => {
        "id" => { "type" => "string", "minLength" => 1 },
        "decision" => { "type" => "string", "enum" => ["unresolved"] + decisions },
        "rationale" => { "type" => ["string", "null"] }
      }
    }
  end

  {
    "$schema" => "https://json-schema.org/draft/2020-12/schema",
    "$id" => "https://new-era-2.invalid/schemas/item-library-adoption-record-r2f-v0.1.json",
    "title" => "New Era 2 item-library adoption decision record R2-F",
    "description" => "Planning record only; schema validation grants no runtime or Gate authority.",
    "type" => "object",
    "additionalProperties" => false,
    "required" => RECORD_KEYS,
    "properties" => {
      "schema_version" => { "const" => "new-era-2.item-library.adoption-record.r2f.v0.1" },
      "template_id" => { "type" => "string", "pattern" => "^template\\.r2f\\." },
      "record_origin" => { "type" => "string", "enum" => %w[template consumer] },
      "record_status" => { "type" => "string", "enum" => %w[draft submitted] },
      "consumer_id" => { "type" => ["string", "null"] },
      "target_branch" => { "type" => ["string", "null"] },
      "source_manifest_id" => { "type" => "string" },
      "source_manifest_sha256" => { "type" => "string", "pattern" => "^[0-9a-f]{64}$" },
      "source_handoff_report_sha256" => { "const" => handoff.fetch("report_sha256") },
      "candidate_stable_ids" => { "type" => "array", "uniqueItems" => true, "items" => { "type" => "string" } },
      "stable_id_decisions" => { "type" => "array", "items" => decision_item.call(%w[adopt reject defer]) },
      "calibration_decisions" => { "type" => "array", "items" => decision_item.call(%w[adopt reject rework]) },
      "accepted_outlier_decisions" => { "type" => "array", "items" => decision_item.call(%w[confirm reject rework]) },
      "mass_review_decisions" => { "type" => "array", "items" => decision_item.call(%w[approve reject rework]) },
      "evidence" => {
        "type" => "object",
        "additionalProperties" => false,
        "required" => EVIDENCE_KEYS,
        "properties" => EVIDENCE_KEYS.to_h { |key| [key, { "type" => ["string", "null"] }] }
      },
      "selected_stable_ids" => { "type" => "array", "uniqueItems" => true, "items" => { "type" => "string" } },
      "rejected_or_deferred_stable_ids" => { "type" => "array", "uniqueItems" => true, "items" => { "type" => "string" } },
      "submission_ready" => { "type" => "boolean" },
      "adoption_state" => { "type" => "string", "enum" => %w[not_adopted pending_review] },
      "runtime_authorization" => { "const" => "NONE" },
      "record_sha256" => { "type" => "string", "pattern" => "^[0-9a-f]{64}$" }
    },
    "x-r2f-status" => "reference_only",
    "x-runtime-schema" => false,
    "x-runtime-authorization" => "NONE",
    "x-source-handoff-report-sha256" => handoff.fetch("report_sha256")
  }
end

def blank_decisions(ids)
  ids.sort.map { |id| { "id" => id, "decision" => "unresolved", "rationale" => nil } }
end

def build_template(manifest, handoff)
  queue = manifest.fetch("adoption_decision_queue")
  core = {
    "schema_version" => "new-era-2.item-library.adoption-record.r2f.v0.1",
    "template_id" => manifest.fetch("id").sub("handoff.r2e.", "template.r2f."),
    "record_origin" => "template",
    "record_status" => "draft",
    "consumer_id" => nil,
    "target_branch" => nil,
    "source_manifest_id" => manifest.fetch("id"),
    "source_manifest_sha256" => manifest.fetch("manifest_sha256"),
    "source_handoff_report_sha256" => handoff.fetch("report_sha256"),
    "candidate_stable_ids" => manifest.fetch("explicit_stable_ids"),
    "stable_id_decisions" => blank_decisions(manifest.fetch("explicit_stable_ids")),
    "calibration_decisions" => blank_decisions(queue.fetch("numeric_patch_proposal_ids")),
    "accepted_outlier_decisions" => blank_decisions(queue.fetch("accepted_outlier_ids")),
    "mass_review_decisions" => blank_decisions(queue.fetch("mass_review_recipe_ids")),
    "evidence" => EVIDENCE_KEYS.to_h { |key| [key, nil] },
    "selected_stable_ids" => [],
    "rejected_or_deferred_stable_ids" => [],
    "submission_ready" => false,
    "adoption_state" => "not_adopted",
    "runtime_authorization" => "NONE"
  }
  core.merge("record_sha256" => canonical_sha(core))
end

def nonempty_string?(value)
  value.is_a?(String) && !value.strip.empty?
end

def decision_errors(rows, expected_ids, allowed_resolved, label)
  return ["#{label} 必须是数组"] unless rows.is_a?(Array)

  errors = []
  ids = []
  rows.each_with_index do |row, index|
    unless row.is_a?(Hash) && row.keys.sort == DECISION_KEYS.sort
      errors << "#{label}[#{index}] 字段错误"
      next
    end
    if nonempty_string?(row["id"])
      ids << row["id"]
    else
      errors << "#{label}[#{index}] id 必须是非空字符串"
    end
    allowed = ["unresolved"] + allowed_resolved
    errors << "#{label}[#{index}] decision 非法" unless allowed.include?(row["decision"])
    if row["decision"] == "unresolved"
      errors << "#{label}[#{index}] unresolved 不得预填 rationale" unless row["rationale"].nil?
    else
      errors << "#{label}[#{index}] 已决定但缺少 rationale" unless nonempty_string?(row["rationale"])
    end
  end
  errors << "#{label} ID 不完整或顺序漂移" unless ids == expected_ids.sort
  errors << "#{label} ID 重复" unless ids.uniq.length == ids.length
  errors
end

def validate_record(record, manifests)
  errors = []
  return ["记录必须是对象"] unless record.is_a?(Hash)
  errors << "顶层字段不完整或包含额外字段" unless record.keys.sort == RECORD_KEYS.sort
  return errors unless errors.empty?

  manifest = manifests[record["source_manifest_id"]]
  return ["未知 source_manifest_id"] unless manifest

  errors << "schema_version 错误" unless record["schema_version"] == "new-era-2.item-library.adoption-record.r2f.v0.1"
  errors << "template_id 与 manifest 不匹配" unless record["template_id"] == manifest.fetch("id").sub("handoff.r2e.", "template.r2f.")
  errors << "record_origin 非法" unless %w[template consumer].include?(record["record_origin"])
  errors << "record_status 非法" unless %w[draft submitted].include?(record["record_status"])
  errors << "consumer_id 必须是字符串或 null" unless record["consumer_id"].nil? || record["consumer_id"].is_a?(String)
  errors << "target_branch 必须是字符串或 null" unless record["target_branch"].nil? || record["target_branch"].is_a?(String)
  errors << "source_manifest_sha256 漂移" unless record["source_manifest_sha256"] == manifest["manifest_sha256"]
  errors << "source_handoff_report_sha256 漂移" unless record["source_handoff_report_sha256"] == manifest.fetch("source_handoff_report_sha256")
  if record["candidate_stable_ids"].is_a?(Array)
    errors << "candidate_stable_ids 不完整或顺序漂移" unless record["candidate_stable_ids"] == manifest["explicit_stable_ids"]
    errors << "candidate_stable_ids 重复" unless record["candidate_stable_ids"].uniq.length == record["candidate_stable_ids"].length
  else
    errors << "candidate_stable_ids 必须是数组"
  end

  queue = manifest.fetch("adoption_decision_queue")
  errors.concat(decision_errors(record["stable_id_decisions"], manifest["explicit_stable_ids"], %w[adopt reject defer], "stable_id_decisions"))
  errors.concat(decision_errors(record["calibration_decisions"], queue["numeric_patch_proposal_ids"], %w[adopt reject rework], "calibration_decisions"))
  errors.concat(decision_errors(record["accepted_outlier_decisions"], queue["accepted_outlier_ids"], %w[confirm reject rework], "accepted_outlier_decisions"))
  errors.concat(decision_errors(record["mass_review_decisions"], queue["mass_review_recipe_ids"], %w[approve reject rework], "mass_review_decisions"))

  unless record["evidence"].is_a?(Hash) && record["evidence"].keys.sort == EVIDENCE_KEYS.sort
    errors << "evidence 字段不完整或包含额外字段"
  else
    record["evidence"].each do |key, value|
      errors << "evidence.#{key} 必须是字符串或 null" unless value.nil? || value.is_a?(String)
    end
  end
  errors << "runtime_authorization 必须保持 NONE" unless record["runtime_authorization"] == "NONE"

  stable_rows = record["stable_id_decisions"].is_a?(Array) ? record["stable_id_decisions"] : []
  selected = stable_rows.select do |row|
    row.is_a?(Hash) && row["id"].is_a?(String) && row["decision"] == "adopt"
  end.map { |row| row["id"] }.sort
  rejected = stable_rows.select do |row|
    row.is_a?(Hash) && row["id"].is_a?(String) && %w[reject defer].include?(row["decision"])
  end.map { |row| row["id"] }.sort
  errors << "selected_stable_ids 与决定不一致" unless record["selected_stable_ids"] == selected
  errors << "rejected_or_deferred_stable_ids 与决定不一致" unless record["rejected_or_deferred_stable_ids"] == rejected

  decision_groups = %w[stable_id_decisions calibration_decisions accepted_outlier_decisions mass_review_decisions]
  all_rows = decision_groups.flat_map { |key| record[key].is_a?(Array) ? record[key] : [] }
  unresolved = all_rows.any? { |row| row.is_a?(Hash) && row["decision"] == "unresolved" }

  if record["record_status"] == "draft"
    errors << "draft 不得 submission_ready" unless record["submission_ready"] == false
    errors << "draft adoption_state 必须 not_adopted" unless record["adoption_state"] == "not_adopted"
    if record["record_origin"] == "template"
      errors << "模板 consumer_id 必须为 null" unless record["consumer_id"].nil?
      errors << "模板 target_branch 必须为 null" unless record["target_branch"].nil?
      errors << "模板必须全部 unresolved" unless all_rows.all? { |row| row.is_a?(Hash) && row["decision"] == "unresolved" }
      errors << "模板 evidence 必须全部为 null" unless record["evidence"].is_a?(Hash) && record["evidence"].values.all?(&:nil?)
    end
  else
    errors << "submitted 必须来自 consumer" unless record["record_origin"] == "consumer"
    errors << "submitted 缺少 consumer_id" unless nonempty_string?(record["consumer_id"])
    errors << "submitted 缺少 target_branch" unless nonempty_string?(record["target_branch"])
    errors << "submitted 仍有 unresolved" if unresolved
    if record["evidence"].is_a?(Hash)
      EVIDENCE_KEYS.each { |key| errors << "submitted 缺少 #{key}" unless nonempty_string?(record["evidence"][key]) }
    end
    errors << "submitted 必须 submission_ready" unless record["submission_ready"] == true
    errors << "submitted adoption_state 必须 pending_review" unless record["adoption_state"] == "pending_review"
  end

  core = record.reject { |key, _value| key == "record_sha256" }
  errors << "record_sha256 无法复算" unless record["record_sha256"] == canonical_sha(core)
  errors
end

def build_markdown(report)
  lines = []
  lines << "# 候选物品库 R2-F 采纳决策记录模板"
  lines << ""
  lines << "**来源 R2-E 报告：** #{code(report.fetch("source_handoff_report_sha256"))}"
  lines << "**Schema 状态：** #{code(report.fetch("schema_status"))}"
  lines << "**记录状态：** #{code(report.fetch("record_status"))}"
  lines << "**提交就绪：** #{code(report.fetch("submission_ready"))}"
  lines << "**运行时授权：** #{code(report.fetch("runtime_authorization"))}"
  lines << "**报告 SHA-256：** #{code(report.fetch("report_sha256"))}"
  lines << ""
  lines << "## 1. 结论"
  lines << ""
  lines << "- #{code("ADOPTION_RECORDS=PASS")}"
  lines << "- #{code("TEMPLATE_COUNT=#{report.dig("counts", "templates")}")}"
  lines << "- #{code("STABLE_ID_DECISION_SLOT_COUNT=#{report.dig("counts", "stable_id_decision_slots")}")}"
  lines << "- #{code("UNRESOLVED_DECISION_SLOT_COUNT=#{report.dig("counts", "unresolved_decision_slots")}")}"
  lines << ""
  lines << "四份模板均为未填写 draft。结构校验通过不代表主干采纳、运行时授权或 Gate 通过。"
  lines << ""
  lines << "## 2. 模板概览"
  lines << ""
  lines << "| 模板 | 候选 ID | 校准决定 | 异常确认 | 质量复核 | 未解决 | 提交就绪 |"
  lines << "|---|---:|---:|---:|---:|---:|---|"
  report.fetch("templates").each do |template|
    unresolved = %w[stable_id_decisions calibration_decisions accepted_outlier_decisions mass_review_decisions]
                 .sum { |key| template.fetch(key).count { |row| row.fetch("decision") == "unresolved" } }
    lines << "| #{code(template.fetch("template_id"))} | #{template.fetch("candidate_stable_ids").length} | #{template.fetch("calibration_decisions").length} | #{template.fetch("accepted_outlier_decisions").length} | #{template.fetch("mass_review_decisions").length} | #{unresolved} | #{code(template.fetch("submission_ready"))} |"
  end
  lines << ""
  lines << "## 3. 固定边界"
  lines << ""
  lines << "- 所有决定均为 #{code("unresolved")}；"
  lines << "- 所有 evidence 均为 #{code("null")}；"
  lines << "- #{code("record_origin=template")}；"
  lines << "- #{code("record_status=draft")}；"
  lines << "- #{code("adoption_state=not_adopted")}；"
  lines << "- #{code("runtime_authorization=NONE")}；"
  lines << "- 本轮没有 submitted 记录。"
  lines << ""
  lines << "## 4. 验证命令"
  lines << ""
  lines << "    ruby scripts/validate_item_library_adoption_records.rb --write"
  lines << "    ruby scripts/validate_item_library_adoption_records.rb"
  lines << "    ruby scripts/validate_item_library_adoption_records.rb --record path/to/record.json"
  lines << ""
  lines.join("\n")
end

options = parse_arguments(ARGV)
[HANDOFF_PATH, R2E_REVIEW_PATH, CONTRACT_PATH].each do |path|
  abort "ADOPTION_RECORDS=FAIL\n- 缺少 #{path}" unless File.file?(path)
end

handoff_file_sha_before = Digest::SHA256.file(HANDOFF_PATH).hexdigest
handoff = JSON.parse(File.read(HANDOFF_PATH))
r2e_review = File.read(R2E_REVIEW_PATH)
errors = []

handoff_core = handoff.reject { |key, _value| key == "report_sha256" }
unless Digest::SHA256.hexdigest(JSON.generate(handoff_core)) == handoff["report_sha256"] &&
       handoff["status"] == "candidate_only" &&
       handoff["handoff_status"] == "reference_only" &&
       handoff["adoption_state"] == "not_adopted" &&
       handoff["runtime_readiness"] == "blocked" &&
       handoff["runtime_authorization"] == "NONE" &&
       handoff["whole_bundle_runtime_import_allowed"] == false &&
       handoff["consumer_adoption_record_generated"] == false
  errors << "R2-E 报告身份、边界或 SHA 无法复算"
end
handoff.fetch("source_files").each do |relative_path, expected_sha|
  path = File.join(ROOT, relative_path)
  errors << "R2-E 来源文件漂移 #{relative_path}" unless File.file?(path) && Digest::SHA256.file(path).hexdigest == expected_sha
end
handoff.fetch("manifests").each do |manifest|
  core = manifest.reject { |key, _value| key == "manifest_sha256" }
  errors << "#{manifest.fetch("id")} SHA 无法复算" unless canonical_sha(core) == manifest["manifest_sha256"]
  errors << "#{manifest.fetch("id")} 不再 blocked" unless manifest["runtime_readiness"] == "blocked"
  errors << "#{manifest.fetch("id")} 已出现 consumer decision" unless manifest["consumer_decisions"] == []
end

expected_review_results = {
  "CONSUMER_HANDOFF" => "PASS",
  "MANIFEST_COUNT" => handoff.dig("counts", "manifests").to_s,
  "UNIQUE_EXPLICIT_ID_COUNT" => handoff.dig("counts", "unique_explicit_ids").to_s,
  "UNIQUE_DEFAULT_EXCLUDED_ID_COUNT" => handoff.dig("counts", "unique_default_excluded_ids").to_s,
  "REPORT_SHA256" => handoff.fetch("report_sha256"),
  "R1_BUNDLE_FILE_SHA256" => handoff.fetch("source_bundle_file_sha256"),
  "R1_PAYLOAD_SHA256" => handoff.fetch("source_payload_sha256"),
  "R2D_REPORT_SHA256" => handoff.fetch("source_selection_report_sha256"),
  "ADOPTION_STATE" => "not_adopted",
  "RUNTIME_AUTHORIZATION" => "NONE"
}
if r2e_review_pass?(r2e_review, expected_review_results)
  assert_review_gate_regressions(r2e_review, expected_review_results)
else
  errors << "R2-E 独立审查尚未通过或未绑定当前报告"
end

unless errors.empty?
  warn "ADOPTION_RECORDS=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

manifests = handoff.fetch("manifests").to_h do |manifest|
  enriched = manifest.merge("source_handoff_report_sha256" => handoff.fetch("report_sha256"))
  [manifest.fetch("id"), enriched]
end

if options[:record]
  path = File.expand_path(options[:record])
  abort "ADOPTION_RECORD_VALIDATION=FAIL\n- 记录文件不存在 #{path}" unless File.file?(path)
  begin
    record = JSON.parse(File.read(path))
  rescue JSON::ParserError => e
    abort "ADOPTION_RECORD_VALIDATION=FAIL\n- JSON 无效：#{e.message}"
  end
  record_errors = validate_record(record, manifests)
  unless record_errors.empty?
    warn "ADOPTION_RECORD_VALIDATION=FAIL"
    record_errors.each { |error| warn "- #{error}" }
    exit 1
  end
  puts "ADOPTION_RECORD_VALIDATION=PASS"
  puts "RECORD_STATUS=#{record.fetch("record_status")}"
  puts "SUBMISSION_READY=#{record.fetch("submission_ready")}"
  puts "RUNTIME_AUTHORIZATION=#{record.fetch("runtime_authorization")}"
  puts "AUTHORIZATION_GRANTED=false"
  exit 0
end

schema = schema_document(handoff)
schema_output = JSON.pretty_generate(schema) + "\n"
schema_file_sha = Digest::SHA256.hexdigest(schema_output)
templates = handoff.fetch("manifests").sort_by { |manifest| manifest.fetch("id") }.map do |manifest|
  build_template(manifest, handoff)
end

template_errors = templates.flat_map do |template|
  validate_record(template, manifests).map { |error| "#{template.fetch("template_id")}: #{error}" }
end
unless template_errors.empty?
  warn "ADOPTION_RECORDS=FAIL"
  template_errors.each { |error| warn "- #{error}" }
  exit 1
end

decision_slot_count = templates.sum do |template|
  %w[stable_id_decisions calibration_decisions accepted_outlier_decisions mass_review_decisions]
    .sum { |key| template.fetch(key).length }
end
unresolved_count = templates.sum do |template|
  %w[stable_id_decisions calibration_decisions accepted_outlier_decisions mass_review_decisions]
    .sum { |key| template.fetch(key).count { |row| row.fetch("decision") == "unresolved" } }
end

report_core = {
  "schema_version" => "new-era-2.item-library.adoption-templates.r2f.v0.1",
  "source_handoff_report_sha256" => handoff.fetch("report_sha256"),
  "source_handoff_file_sha256" => handoff_file_sha_before,
  "source_r2e_review_file_sha256" => Digest::SHA256.file(R2E_REVIEW_PATH).hexdigest,
  "schema_file_sha256" => schema_file_sha,
  "schema_status" => "reference_only",
  "record_status" => "template_only",
  "submission_ready" => false,
  "adoption_state" => "not_adopted",
  "runtime_authorization" => "NONE",
  "submitted_record_count" => 0,
  "source_files" => {
    "data/item-library/consumer-handoff-r2e.json" => handoff_file_sha_before,
    "docs/item-library/reviews/item-library-r2e-review-status-2026-07-31.md" => Digest::SHA256.file(R2E_REVIEW_PATH).hexdigest,
    "docs/item-library/item-library-adoption-record-contract-v0.1.md" => Digest::SHA256.file(CONTRACT_PATH).hexdigest,
    "scripts/validate_item_library_adoption_records.rb" => Digest::SHA256.file(__FILE__).hexdigest
  },
  "counts" => {
    "templates" => templates.length,
    "stable_id_decision_slots" => templates.sum { |template| template.fetch("stable_id_decisions").length },
    "calibration_decision_slots" => templates.sum { |template| template.fetch("calibration_decisions").length },
    "accepted_outlier_decision_slots" => templates.sum { |template| template.fetch("accepted_outlier_decisions").length },
    "mass_review_decision_slots" => templates.sum { |template| template.fetch("mass_review_decisions").length },
    "all_decision_slots" => decision_slot_count,
    "unresolved_decision_slots" => unresolved_count
  },
  "templates" => templates,
  "acceptance_boundary" => {
    "consumer_decisions_made" => false,
    "submitted_record_generated" => false,
    "mainline_adoption_approved" => false,
    "runtime_schema_generated" => false,
    "runtime_authorized" => false,
    "gate_status_changed" => false,
    "human_playtest_completed" => false
  }
}
report_sha = Digest::SHA256.hexdigest(JSON.generate(report_core))
report = report_core.merge("report_sha256" => report_sha)
templates_output = JSON.pretty_generate(report) + "\n"
markdown_output = build_markdown(report)

if options[:write]
  File.write(SCHEMA_PATH, schema_output)
  File.write(TEMPLATES_PATH, templates_output)
  File.write(MARKDOWN_PATH, markdown_output)
  puts "ADOPTION_RECORD_SCHEMA=WRITTEN #{SCHEMA_PATH}"
  puts "ADOPTION_RECORD_TEMPLATES=WRITTEN #{TEMPLATES_PATH}"
  puts "ADOPTION_RECORD_MARKDOWN=WRITTEN #{MARKDOWN_PATH}"
else
  {
    SCHEMA_PATH => schema_output,
    TEMPLATES_PATH => templates_output,
    MARKDOWN_PATH => markdown_output
  }.each do |path, expected|
    unless File.file?(path) && File.read(path) == expected
      warn "ADOPTION_RECORDS=FAIL"
      warn "- #{File.basename(path)} 缺失或已过期；使用 --write 刷新"
      exit 1
    end
  end
end

unless Digest::SHA256.file(HANDOFF_PATH).hexdigest == handoff_file_sha_before
  abort "ADOPTION_RECORDS=FAIL\n- R2-E 输入在生成期间发生变化"
end

puts "ADOPTION_RECORDS=PASS"
puts "TEMPLATE_COUNT=#{templates.length}"
puts "STABLE_ID_DECISION_SLOT_COUNT=#{report.dig("counts", "stable_id_decision_slots")}"
puts "ALL_DECISION_SLOT_COUNT=#{decision_slot_count}"
puts "UNRESOLVED_DECISION_SLOT_COUNT=#{unresolved_count}"
puts "SUBMITTED_RECORD_COUNT=0"
puts "SCHEMA_FILE_SHA256=#{schema_file_sha}"
puts "REPORT_SHA256=#{report_sha}"
puts "SOURCE_R2E_REPORT_SHA256=#{handoff.fetch("report_sha256")}"
puts "SUBMISSION_READY=false"
puts "RUNTIME_AUTHORIZATION=NONE"
