#!/usr/bin/env ruby
# frozen_string_literal: true

require "yaml"
require "digest"
require "json"

ROOT = File.expand_path("..", __dir__)
DESIGN_PATH = File.join(ROOT, "docs/design-docs/item-and-manufacturing-system-v0.1.md")
VOCAB_PATH = File.join(ROOT, "data/item-library/controlled-vocabulary.yaml")
ITEMS_PATH = File.join(ROOT, "data/item-library/items.seed.yaml")
RECIPES_PATH = File.join(ROOT, "data/item-library/recipes.seed.yaml")
REPORT_PATH = File.join(ROOT, "data/item-library/coverage-report.md")
C2_VOCAB_PATH = File.join(ROOT, "data/item-library/controlled-vocabulary.c2.yaml")
C2_ITEMS_PATH = File.join(ROOT, "data/item-library/items.c2.yaml")
C2_RECIPES_PATH = File.join(ROOT, "data/item-library/recipes.c2.yaml")
C2_REPORT_PATH = File.join(ROOT, "data/item-library/coverage-report.c2.md")
C3_VOCAB_PATH = File.join(ROOT, "data/item-library/controlled-vocabulary.c3.yaml")
C3_CATALOG_PATH = File.join(ROOT, "data/item-library/catalog.c3.yaml")
C3_TRANSITIONS_PATH = File.join(ROOT, "data/item-library/transitions.c3.yaml")
C3_REPORT_PATH = File.join(ROOT, "data/item-library/coverage-report.c3.md")
C4_VOCAB_PATH = File.join(ROOT, "data/item-library/controlled-vocabulary.c4.yaml")
C4_ITEMS_PATH = File.join(ROOT, "data/item-library/items.c4.yaml")
C4_RECIPES_PATH = File.join(ROOT, "data/item-library/recipes.c4.yaml")
C4_REPORT_PATH = File.join(ROOT, "data/item-library/coverage-report.c4.md")
C5_VOCAB_PATH = File.join(ROOT, "data/item-library/controlled-vocabulary.c5.yaml")
C5_ITEMS_PATH = File.join(ROOT, "data/item-library/items.c5.yaml")
C5_RECIPES_PATH = File.join(ROOT, "data/item-library/recipes.c5.yaml")
C5_REPORT_PATH = File.join(ROOT, "data/item-library/coverage-report.c5.md")
C6_VOCAB_PATH = File.join(ROOT, "data/item-library/controlled-vocabulary.c6.yaml")
C6_ITEMS_PATH = File.join(ROOT, "data/item-library/items.c6.yaml")
C6_RECIPES_PATH = File.join(ROOT, "data/item-library/recipes.c6.yaml")
C6_REPORT_PATH = File.join(ROOT, "data/item-library/coverage-report.c6.md")
C7_VOCAB_PATH = File.join(ROOT, "data/item-library/controlled-vocabulary.c7.yaml")
C7_ITEMS_PATH = File.join(ROOT, "data/item-library/items.c7.yaml")
C7_RECIPES_PATH = File.join(ROOT, "data/item-library/recipes.c7.yaml")
C7_REPORT_PATH = File.join(ROOT, "data/item-library/coverage-report.c7.md")
CANDIDATE_BUNDLE_PATH = File.join(ROOT, "data/item-library/item-library-r1-candidate-bundle.json")
CANDIDATE_BUNDLE_SOURCE_RELATIVE_PATHS = %w[
  docs/design-docs/item-and-manufacturing-system-v0.1.md
  docs/design-docs/item-and-manufacturing-system-v0.1-freeze-decision-2026-07-26.md
  docs/item-library/item-library-content-quota-plan-v0.1.md
  docs/item-library/item-library-r1-candidate-baseline-contract-v0.1.md
  docs/item-library/item-library-authoring-contract-v0.1.md
  docs/item-library/item-library-authoring-contract-v0.2.md
  docs/item-library/item-library-authoring-contract-v0.3.md
  docs/item-library/item-library-authoring-contract-v0.4.md
  docs/item-library/item-library-authoring-contract-v0.5.md
  docs/item-library/item-library-authoring-contract-v0.6.md
  docs/item-library/item-library-authoring-contract-v0.7.md
  data/item-library/controlled-vocabulary.yaml
  data/item-library/controlled-vocabulary.c2.yaml
  data/item-library/controlled-vocabulary.c3.yaml
  data/item-library/controlled-vocabulary.c4.yaml
  data/item-library/controlled-vocabulary.c5.yaml
  data/item-library/controlled-vocabulary.c6.yaml
  data/item-library/controlled-vocabulary.c7.yaml
  data/item-library/items.seed.yaml
  data/item-library/items.c2.yaml
  data/item-library/catalog.c3.yaml
  data/item-library/items.c4.yaml
  data/item-library/items.c5.yaml
  data/item-library/items.c6.yaml
  data/item-library/items.c7.yaml
  data/item-library/recipes.seed.yaml
  data/item-library/recipes.c2.yaml
  data/item-library/transitions.c3.yaml
  data/item-library/recipes.c4.yaml
  data/item-library/recipes.c5.yaml
  data/item-library/recipes.c6.yaml
  data/item-library/recipes.c7.yaml
].freeze

profile_index = ARGV.index("--profile")
profile = profile_index ? ARGV[profile_index + 1] : "c1"
unless %w[c1 c2 c3 c4 c5 c6 c7].include?(profile)
  warn "ITEM_LIBRARY_VALIDATION=FAIL"
  warn "- --profile 只允许 c1、c2、c3、c4、c5、c6 或 c7"
  exit 1
end
include_c2 = %w[c2 c3 c4 c5 c6 c7].include?(profile)
include_c3 = %w[c3 c4 c5 c6 c7].include?(profile)
include_c4 = %w[c4 c5 c6 c7].include?(profile)
include_c5 = %w[c5 c6 c7].include?(profile)
include_c6 = %w[c6 c7].include?(profile)
include_c7 = profile == "c7"
write_report = ARGV.include?("--write-report")
write_bundle = ARGV.include?("--write-bundle")
if write_bundle && profile != "c7"
  warn "ITEM_LIBRARY_VALIDATION=FAIL"
  warn "- --write-bundle 只允许与 --profile c7 一起使用"
  exit 1
end
report_path = {
  "c1" => REPORT_PATH,
  "c2" => C2_REPORT_PATH,
  "c3" => C3_REPORT_PATH,
  "c4" => C4_REPORT_PATH,
  "c5" => C5_REPORT_PATH,
  "c6" => C6_REPORT_PATH,
  "c7" => C7_REPORT_PATH
}.fetch(profile)

errors = []

def load_yaml(path, errors)
  YAML.safe_load(File.read(path), [], [], false)
rescue StandardError => e
  errors << "#{path}: YAML 解析失败：#{e.message}"
  {}
end

def nonempty_string?(value)
  value.is_a?(String) && !value.strip.empty?
end

def positive_number?(value)
  value.is_a?(Numeric) && value.positive?
end

def nonnegative_number?(value)
  value.is_a?(Numeric) && value >= 0
end

def enum_keys(enums, key)
  value = enums[key]
  value.is_a?(Hash) ? value.keys : []
end

def require_keys(record, keys, path, errors)
  keys.each do |key|
    errors << "#{path}.#{key}: 缺少必需字段" unless record.key?(key)
  end
end

def check_enum(value, allowed, path, errors)
  errors << "#{path}: 非受控值 #{value.inspect}" unless allowed.include?(value)
end

def check_enum_array(value, allowed, path, errors, allow_empty: false)
  unless value.is_a?(Array)
    errors << "#{path}: 必须是数组"
    return
  end
  errors << "#{path}: 不得为空" if value.empty? && !allow_empty
  errors << "#{path}: 存在重复值" unless value.uniq.length == value.length
  value.each { |entry| check_enum(entry, allowed, path, errors) }
end

def check_nonempty_text(value, path, errors)
  errors << "#{path}: 必须是非空文本" unless nonempty_string?(value)
end

def check_range(record, path, errors)
  unless record.is_a?(Hash)
    errors << "#{path}: 必须是包含 min/max 的对象"
    return
  end
  require_keys(record, %w[min max], path, errors)
  return unless record.key?("min") && record.key?("max")

  errors << "#{path}.min: 必须是正数" unless positive_number?(record["min"])
  errors << "#{path}.max: 必须是正数" unless positive_number?(record["max"])
  if record["min"].is_a?(Numeric) && record["max"].is_a?(Numeric) && record["min"] > record["max"]
    errors << "#{path}: min 不得大于 max"
  end
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

def render_candidate_bundle(items, noninventory_definitions, recipes, transitions, enums, expected_sha)
  payload = {
    "enums" => enums,
    "inventory_items" => items,
    "non_inventory_definitions" => noninventory_definitions,
    "recipes" => recipes,
    "transitions" => transitions
  }
  payload_sha256 = Digest::SHA256.hexdigest(JSON.generate(canonicalize_json(payload)))
  source_files = CANDIDATE_BUNDLE_SOURCE_RELATIVE_PATHS.sort.map do |relative_path|
    {
      "path" => relative_path,
      "sha256" => Digest::SHA256.file(File.join(ROOT, relative_path)).hexdigest
    }
  end
  bundle = {
    "schema_version" => "1.0.0",
    "baseline_id" => "new-era-2.item-library.r1-c7-candidate",
    "status" => "candidate_only",
    "runtime_authorization" => "NONE",
    "authority" => {
      "design" => "docs/design-docs/item-and-manufacturing-system-v0.1.md",
      "design_sha256" => expected_sha,
      "freeze_decision" => "docs/design-docs/item-and-manufacturing-system-v0.1-freeze-decision-2026-07-26.md",
      "baseline_contract" => "docs/item-library/item-library-r1-candidate-baseline-contract-v0.1.md"
    },
    "counts" => {
      "inventory_items" => items.length,
      "non_inventory_definitions" => noninventory_definitions.length,
      "catalog_definitions" => items.length + noninventory_definitions.length,
      "recipes" => recipes.length,
      "transitions" => transitions.length
    },
    "selection_policy" => {
      "default_runtime_import" => "deny",
      "whole_bundle_import_allowed" => false,
      "requires_explicit_stable_id_selection" => true,
      "requires_separate_runtime_schema_and_gate_authorization" => true
    },
    "source_files" => source_files,
    "payload_sha256" => payload_sha256,
    "payload" => payload
  }
  JSON.pretty_generate(bundle) + "\n"
end

vocab_doc = load_yaml(VOCAB_PATH, errors)
items_doc = load_yaml(ITEMS_PATH, errors)
recipes_doc = load_yaml(RECIPES_PATH, errors)
c2_vocab_doc = include_c2 ? load_yaml(C2_VOCAB_PATH, errors) : {}
c2_items_doc = include_c2 ? load_yaml(C2_ITEMS_PATH, errors) : {}
c2_recipes_doc = include_c2 ? load_yaml(C2_RECIPES_PATH, errors) : {}
c3_vocab_doc = include_c3 ? load_yaml(C3_VOCAB_PATH, errors) : {}
c3_catalog_doc = include_c3 ? load_yaml(C3_CATALOG_PATH, errors) : {}
c3_transitions_doc = include_c3 ? load_yaml(C3_TRANSITIONS_PATH, errors) : {}
c4_vocab_doc = include_c4 ? load_yaml(C4_VOCAB_PATH, errors) : {}
c4_items_doc = include_c4 ? load_yaml(C4_ITEMS_PATH, errors) : {}
c4_recipes_doc = include_c4 ? load_yaml(C4_RECIPES_PATH, errors) : {}
c5_vocab_doc = include_c5 ? load_yaml(C5_VOCAB_PATH, errors) : {}
c5_items_doc = include_c5 ? load_yaml(C5_ITEMS_PATH, errors) : {}
c5_recipes_doc = include_c5 ? load_yaml(C5_RECIPES_PATH, errors) : {}
c6_vocab_doc = include_c6 ? load_yaml(C6_VOCAB_PATH, errors) : {}
c6_items_doc = include_c6 ? load_yaml(C6_ITEMS_PATH, errors) : {}
c6_recipes_doc = include_c6 ? load_yaml(C6_RECIPES_PATH, errors) : {}
c7_vocab_doc = include_c7 ? load_yaml(C7_VOCAB_PATH, errors) : {}
c7_items_doc = include_c7 ? load_yaml(C7_ITEMS_PATH, errors) : {}
c7_recipes_doc = include_c7 ? load_yaml(C7_RECIPES_PATH, errors) : {}

enums = vocab_doc["enums"]
unless enums.is_a?(Hash)
  errors << "controlled-vocabulary.yaml.enums: 必须是对象"
  enums = {}
end
enums = enums.transform_values { |values| values.is_a?(Hash) ? values.dup : values }

if include_c2
  extensions = c2_vocab_doc["enums"]
  unless extensions.is_a?(Hash)
    errors << "controlled-vocabulary.c2.yaml.enums: 必须是对象"
    extensions = {}
  end
  extensions.each do |key, additions|
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "controlled-vocabulary.c2.yaml.enums.#{key}: 必须是非空对象"
      next
    end
    enums[key] ||= {}
    unless enums[key].is_a?(Hash)
      errors << "controlled-vocabulary.c2.yaml.enums.#{key}: C1 对应值不是对象"
      next
    end
    overlap = enums[key].keys & additions.keys
    errors << "controlled-vocabulary.c2.yaml.enums.#{key}: 不得覆盖 C1 值 #{overlap.join(', ')}" unless overlap.empty?
    enums[key].merge!(additions)
  end
end

if include_c3
  extensions = c3_vocab_doc["enums"]
  unless extensions.is_a?(Hash)
    errors << "controlled-vocabulary.c3.yaml.enums: 必须是对象"
    extensions = {}
  end
  extensions.each do |key, additions|
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "controlled-vocabulary.c3.yaml.enums.#{key}: 必须是非空对象"
      next
    end
    enums[key] ||= {}
    unless enums[key].is_a?(Hash)
      errors << "controlled-vocabulary.c3.yaml.enums.#{key}: C1+C2 对应值不是对象"
      next
    end
    overlap = enums[key].keys & additions.keys
    errors << "controlled-vocabulary.c3.yaml.enums.#{key}: 不得覆盖 C1/C2 值 #{overlap.join(', ')}" unless overlap.empty?
    enums[key].merge!(additions)
  end
end

if include_c4
  extensions = c4_vocab_doc["enums"]
  unless extensions.is_a?(Hash)
    errors << "controlled-vocabulary.c4.yaml.enums: 必须是对象"
    extensions = {}
  end
  extensions.each do |key, additions|
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "controlled-vocabulary.c4.yaml.enums.#{key}: 必须是非空对象"
      next
    end
    enums[key] ||= {}
    unless enums[key].is_a?(Hash)
      errors << "controlled-vocabulary.c4.yaml.enums.#{key}: C1–C3 对应值不是对象"
      next
    end
    overlap = enums[key].keys & additions.keys
    errors << "controlled-vocabulary.c4.yaml.enums.#{key}: 不得覆盖 C1–C3 值 #{overlap.join(', ')}" unless overlap.empty?
    enums[key].merge!(additions)
  end
end

if include_c5
  extensions = c5_vocab_doc["enums"]
  unless extensions.is_a?(Hash)
    errors << "controlled-vocabulary.c5.yaml.enums: 必须是对象"
    extensions = {}
  end
  extensions.each do |key, additions|
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "controlled-vocabulary.c5.yaml.enums.#{key}: 必须是非空对象"
      next
    end
    enums[key] ||= {}
    unless enums[key].is_a?(Hash)
      errors << "controlled-vocabulary.c5.yaml.enums.#{key}: C1–C4 对应值不是对象"
      next
    end
    overlap = enums[key].keys & additions.keys
    errors << "controlled-vocabulary.c5.yaml.enums.#{key}: 不得覆盖 C1–C4 值 #{overlap.join(', ')}" unless overlap.empty?
    enums[key].merge!(additions)
  end
end

if include_c6
  extensions = c6_vocab_doc["enums"]
  unless extensions.is_a?(Hash)
    errors << "controlled-vocabulary.c6.yaml.enums: 必须是对象"
    extensions = {}
  end
  extensions.each do |key, additions|
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "controlled-vocabulary.c6.yaml.enums.#{key}: 必须是非空对象"
      next
    end
    enums[key] ||= {}
    unless enums[key].is_a?(Hash)
      errors << "controlled-vocabulary.c6.yaml.enums.#{key}: C1–C5 对应值不是对象"
      next
    end
    overlap = enums[key].keys & additions.keys
    errors << "controlled-vocabulary.c6.yaml.enums.#{key}: 不得覆盖 C1–C5 值 #{overlap.join(', ')}" unless overlap.empty?
    enums[key].merge!(additions)
  end
end

if include_c7
  extensions = c7_vocab_doc["enums"]
  unless extensions.is_a?(Hash)
    errors << "controlled-vocabulary.c7.yaml.enums: 必须是对象"
    extensions = {}
  end
  extensions.each do |key, additions|
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "controlled-vocabulary.c7.yaml.enums.#{key}: 必须是非空对象"
      next
    end
    enums[key] ||= {}
    unless enums[key].is_a?(Hash)
      errors << "controlled-vocabulary.c7.yaml.enums.#{key}: C1–C6 对应值不是对象"
      next
    end
    overlap = enums[key].keys & additions.keys
    errors << "controlled-vocabulary.c7.yaml.enums.#{key}: 不得覆盖 C1–C6 值 #{overlap.join(', ')}" unless overlap.empty?
    enums[key].merge!(additions)
  end
end

required_vocabularies = %w[
  categories forms resource_chains availability legal_profiles visibility
  traceability wealth_signal actions units storage_rules merge_keys
  acquisition_types loss_types recipe_kinds facilities tools roles skills
  specialties missing_effects substitution_consequences burdens risks tags
]
required_vocabularies.each do |key|
  errors << "controlled-vocabulary.yaml.enums.#{key}: 必须是非空对象" unless enums[key].is_a?(Hash) && !enums[key].empty?
end
if include_c2
  %w[
    wear_sources repairability dismantle_policies condition_states
    equipment_roles ammo_families knowledge_domains footprints
    uninstall_results ownership_profiles
  ].each do |key|
    errors << "C2 合并词表.#{key}: 必须是非空对象" unless enums[key].is_a?(Hash) && !enums[key].empty?
  end
end
if include_c3
  %w[
    transition_kinds transition_source_kinds live_intake_types
    source_dispositions rollback_results growth_stages animal_species
    animal_service_roles bearer_scopes issuer_classes validity_states
  ].each do |key|
    errors << "C3 合并词表.#{key}: 必须是非空对象" unless enums[key].is_a?(Hash) && !enums[key].empty?
  end
end
if include_c7
  %w[protection_roles body_regions].each do |key|
    errors << "C7 合并词表.#{key}: 必须是非空对象" unless enums[key].is_a?(Hash) && !enums[key].empty?
  end
end

expected_status = "candidate_only"
expected_sha = "24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb"
begin
  actual_design_sha = Digest::SHA256.file(DESIGN_PATH).hexdigest
  unless actual_design_sha == expected_sha
    errors << "item-and-manufacturing-system-v0.1.md: 实际 SHA-256 已漂移，当前为 #{actual_design_sha}"
  end
rescue StandardError => e
  errors << "item-and-manufacturing-system-v0.1.md: 无法计算实际 SHA-256：#{e.message}"
end
if include_c7
  CANDIDATE_BUNDLE_SOURCE_RELATIVE_PATHS.each do |relative_path|
    errors << "候选 bundle 源文件不存在：#{relative_path}" unless File.file?(File.join(ROOT, relative_path))
  end
end

document_contracts = [
  ["controlled-vocabulary.yaml", vocab_doc, "0.1.0", nil],
  ["items.seed.yaml", items_doc, "0.1.0", "docs/item-library/item-library-authoring-contract-v0.1.md"],
  ["recipes.seed.yaml", recipes_doc, "0.1.0", "docs/item-library/item-library-authoring-contract-v0.1.md"],
  *(
    include_c2 ? [
      ["controlled-vocabulary.c2.yaml", c2_vocab_doc, "0.2.0", "docs/item-library/item-library-authoring-contract-v0.2.md"],
      ["items.c2.yaml", c2_items_doc, "0.2.0", "docs/item-library/item-library-authoring-contract-v0.2.md"],
      ["recipes.c2.yaml", c2_recipes_doc, "0.2.0", "docs/item-library/item-library-authoring-contract-v0.2.md"]
    ] : []
  ),
  *(
    include_c3 ? [
      ["controlled-vocabulary.c3.yaml", c3_vocab_doc, "0.3.0", "docs/item-library/item-library-authoring-contract-v0.3.md"],
      ["catalog.c3.yaml", c3_catalog_doc, "0.3.0", "docs/item-library/item-library-authoring-contract-v0.3.md"],
      ["transitions.c3.yaml", c3_transitions_doc, "0.3.0", "docs/item-library/item-library-authoring-contract-v0.3.md"]
    ] : []
  ),
  *(
    include_c4 ? [
      ["controlled-vocabulary.c4.yaml", c4_vocab_doc, "0.4.0", "docs/item-library/item-library-authoring-contract-v0.4.md"],
      ["items.c4.yaml", c4_items_doc, "0.4.0", "docs/item-library/item-library-authoring-contract-v0.4.md"],
      ["recipes.c4.yaml", c4_recipes_doc, "0.4.0", "docs/item-library/item-library-authoring-contract-v0.4.md"]
    ] : []
  ),
  *(
    include_c5 ? [
      ["controlled-vocabulary.c5.yaml", c5_vocab_doc, "0.5.0", "docs/item-library/item-library-authoring-contract-v0.5.md"],
      ["items.c5.yaml", c5_items_doc, "0.5.0", "docs/item-library/item-library-authoring-contract-v0.5.md"],
      ["recipes.c5.yaml", c5_recipes_doc, "0.5.0", "docs/item-library/item-library-authoring-contract-v0.5.md"]
    ] : []
  ),
  *(
    include_c6 ? [
      ["controlled-vocabulary.c6.yaml", c6_vocab_doc, "0.6.0", "docs/item-library/item-library-authoring-contract-v0.6.md"],
      ["items.c6.yaml", c6_items_doc, "0.6.0", "docs/item-library/item-library-authoring-contract-v0.6.md"],
      ["recipes.c6.yaml", c6_recipes_doc, "0.6.0", "docs/item-library/item-library-authoring-contract-v0.6.md"]
    ] : []
  ),
  *(
    include_c7 ? [
      ["controlled-vocabulary.c7.yaml", c7_vocab_doc, "0.7.0", "docs/item-library/item-library-authoring-contract-v0.7.md"],
      ["items.c7.yaml", c7_items_doc, "0.7.0", "docs/item-library/item-library-authoring-contract-v0.7.md"],
      ["recipes.c7.yaml", c7_recipes_doc, "0.7.0", "docs/item-library/item-library-authoring-contract-v0.7.md"]
    ] : []
  )
]
document_contracts.each do |label, doc, schema_version, contract_path|
  errors << "#{label}.schema_version: 必须为 #{schema_version}" unless doc["schema_version"] == schema_version
  authority = doc["authority"]
  unless authority.is_a?(Hash)
    errors << "#{label}.authority: 必须是对象"
    next
  end
  if contract_path
    errors << "#{label}.authority.contract: 路径不匹配" unless authority["contract"] == contract_path
    unless authority["design"] == "docs/design-docs/item-and-manufacturing-system-v0.1.md"
      errors << "#{label}.authority.design: 路径不匹配"
    end
  else
    unless authority["document"] == "docs/design-docs/item-and-manufacturing-system-v0.1.md"
      errors << "#{label}.authority.document: 路径不匹配"
    end
  end
end

[
  ["controlled-vocabulary.yaml", vocab_doc, "status"],
  ["items.seed.yaml", items_doc, "library_status"],
  ["recipes.seed.yaml", recipes_doc, "library_status"],
  *(
    include_c2 ? [
      ["controlled-vocabulary.c2.yaml", c2_vocab_doc, "status"],
      ["items.c2.yaml", c2_items_doc, "library_status"],
      ["recipes.c2.yaml", c2_recipes_doc, "library_status"]
    ] : []
  ),
  *(
    include_c3 ? [
      ["controlled-vocabulary.c3.yaml", c3_vocab_doc, "status"],
      ["catalog.c3.yaml", c3_catalog_doc, "library_status"],
      ["transitions.c3.yaml", c3_transitions_doc, "library_status"]
    ] : []
  ),
  *(
    include_c4 ? [
      ["controlled-vocabulary.c4.yaml", c4_vocab_doc, "status"],
      ["items.c4.yaml", c4_items_doc, "library_status"],
      ["recipes.c4.yaml", c4_recipes_doc, "library_status"]
    ] : []
  ),
  *(
    include_c5 ? [
      ["controlled-vocabulary.c5.yaml", c5_vocab_doc, "status"],
      ["items.c5.yaml", c5_items_doc, "library_status"],
      ["recipes.c5.yaml", c5_recipes_doc, "library_status"]
    ] : []
  ),
  *(
    include_c6 ? [
      ["controlled-vocabulary.c6.yaml", c6_vocab_doc, "status"],
      ["items.c6.yaml", c6_items_doc, "library_status"],
      ["recipes.c6.yaml", c6_recipes_doc, "library_status"]
    ] : []
  ),
  *(
    include_c7 ? [
      ["controlled-vocabulary.c7.yaml", c7_vocab_doc, "status"],
      ["items.c7.yaml", c7_items_doc, "library_status"],
      ["recipes.c7.yaml", c7_recipes_doc, "library_status"]
    ] : []
  )
].each do |label, doc, field|
  errors << "#{label}.#{field}: 必须为 #{expected_status}" unless doc[field] == expected_status
end

[
  ["controlled-vocabulary.yaml", vocab_doc.dig("authority", "sha256")],
  ["items.seed.yaml", items_doc.dig("authority", "design_sha256")],
  ["recipes.seed.yaml", recipes_doc.dig("authority", "design_sha256")],
  *(
    include_c2 ? [
      ["controlled-vocabulary.c2.yaml", c2_vocab_doc.dig("authority", "design_sha256")],
      ["items.c2.yaml", c2_items_doc.dig("authority", "design_sha256")],
      ["recipes.c2.yaml", c2_recipes_doc.dig("authority", "design_sha256")]
    ] : []
  ),
  *(
    include_c3 ? [
      ["controlled-vocabulary.c3.yaml", c3_vocab_doc.dig("authority", "design_sha256")],
      ["catalog.c3.yaml", c3_catalog_doc.dig("authority", "design_sha256")],
      ["transitions.c3.yaml", c3_transitions_doc.dig("authority", "design_sha256")]
    ] : []
  ),
  *(
    include_c4 ? [
      ["controlled-vocabulary.c4.yaml", c4_vocab_doc.dig("authority", "design_sha256")],
      ["items.c4.yaml", c4_items_doc.dig("authority", "design_sha256")],
      ["recipes.c4.yaml", c4_recipes_doc.dig("authority", "design_sha256")]
    ] : []
  ),
  *(
    include_c5 ? [
      ["controlled-vocabulary.c5.yaml", c5_vocab_doc.dig("authority", "design_sha256")],
      ["items.c5.yaml", c5_items_doc.dig("authority", "design_sha256")],
      ["recipes.c5.yaml", c5_recipes_doc.dig("authority", "design_sha256")]
    ] : []
  ),
  *(
    include_c6 ? [
      ["controlled-vocabulary.c6.yaml", c6_vocab_doc.dig("authority", "design_sha256")],
      ["items.c6.yaml", c6_items_doc.dig("authority", "design_sha256")],
      ["recipes.c6.yaml", c6_recipes_doc.dig("authority", "design_sha256")]
    ] : []
  ),
  *(
    include_c7 ? [
      ["controlled-vocabulary.c7.yaml", c7_vocab_doc.dig("authority", "design_sha256")],
      ["items.c7.yaml", c7_items_doc.dig("authority", "design_sha256")],
      ["recipes.c7.yaml", c7_recipes_doc.dig("authority", "design_sha256")]
    ] : []
  )
].each do |label, sha|
  errors << "#{label}: 上位设计 SHA 不匹配" unless sha == expected_sha
end

base_items = items_doc["items"]
base_recipes = recipes_doc["recipes"]
unless base_items.is_a?(Array)
  errors << "items.seed.yaml.items: 必须是数组"
  base_items = []
end
unless base_recipes.is_a?(Array)
  errors << "recipes.seed.yaml.recipes: 必须是数组"
  base_recipes = []
end

errors << "items.seed.yaml.items: C1 必须恰好包含 30 项，当前为 #{base_items.length}" unless base_items.length == 30
unless base_recipes.length.between?(12, 15)
  errors << "recipes.seed.yaml.recipes: C1 必须包含 12–15 项，当前为 #{base_recipes.length}"
end

c2_items = include_c2 ? c2_items_doc["items"] : []
c2_recipes = include_c2 ? c2_recipes_doc["recipes"] : []
if include_c2
  unless c2_items.is_a?(Array)
    errors << "items.c2.yaml.items: 必须是数组"
    c2_items = []
  end
  unless c2_recipes.is_a?(Array)
    errors << "recipes.c2.yaml.recipes: 必须是数组"
    c2_recipes = []
  end
  errors << "items.c2.yaml.items: C2 必须恰好新增 30 项，当前为 #{c2_items.length}" unless c2_items.length == 30
  errors << "recipes.c2.yaml.recipes: C2 必须恰好新增 15 项，当前为 #{c2_recipes.length}" unless c2_recipes.length == 15
end

items = base_items + c2_items
recipes = base_recipes + c2_recipes
c2_item_ids = c2_items.filter { |item| item.is_a?(Hash) }.map { |item| item["id"] }
c2_recipe_ids = c2_recipes.filter { |recipe| recipe.is_a?(Hash) }.map { |recipe| recipe["id"] }

if include_c2
  errors << "C2 累计物品必须为 60 项，当前为 #{items.length}" unless items.length == 60
  errors << "C2 累计工艺必须为 30 项，当前为 #{recipes.length}" unless recipes.length == 30

  extensions = c2_items_doc["interface_extensions"]
  unless extensions.is_a?(Hash)
    errors << "items.c2.yaml.interface_extensions: 必须是对象"
    extensions = {}
  end
  base_item_by_id = base_items.filter { |item| item.is_a?(Hash) }.to_h { |item| [item["id"], item] }
  extensions.each do |item_id, additions|
    target = base_item_by_id[item_id]
    unless target
      errors << "items.c2.yaml.interface_extensions.#{item_id}: 只能扩展 C1 物品"
      next
    end
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "items.c2.yaml.interface_extensions.#{item_id}: 必须是非空对象"
      next
    end
    invalid_fields = additions.keys - %w[produced_by used_by repair_recipes dismantle_recipes]
    errors << "items.c2.yaml.interface_extensions.#{item_id}: 非法字段 #{invalid_fields.join(', ')}" unless invalid_fields.empty?
    additions.each do |field, recipe_refs|
      unless recipe_refs.is_a?(Array) && !recipe_refs.empty?
        errors << "items.c2.yaml.interface_extensions.#{item_id}.#{field}: 必须是非空数组"
        next
      end
      duplicate_refs = recipe_refs.group_by(&:itself).select { |_key, values| values.length > 1 }.keys
      errors << "items.c2.yaml.interface_extensions.#{item_id}.#{field}: 重复引用 #{duplicate_refs.join(', ')}" unless duplicate_refs.empty?
      recipe_refs.each do |recipe_id|
        errors << "items.c2.yaml.interface_extensions.#{item_id}.#{field}: 必须引用 C2 工艺 #{recipe_id}" unless c2_recipe_ids.include?(recipe_id)
      end
      target["interfaces"] ||= {}
      existing = Array(target["interfaces"][field])
      overlap = existing & recipe_refs
      errors << "items.c2.yaml.interface_extensions.#{item_id}.#{field}: 不得重复 C1 引用 #{overlap.join(', ')}" unless overlap.empty?
      target["interfaces"][field] = existing + recipe_refs
    end
  end
end

c3_definitions = []
c3_inventory_items = []
c3_noninventory_definitions = []
transitions = []
if include_c3
  c3_definitions = c3_catalog_doc["definitions"]
  unless c3_definitions.is_a?(Array)
    errors << "catalog.c3.yaml.definitions: 必须是数组"
    c3_definitions = []
  end
  transitions = c3_transitions_doc["transitions"]
  unless transitions.is_a?(Array)
    errors << "transitions.c3.yaml.transitions: 必须是数组"
    transitions = []
  end

  c3_inventory_items = c3_definitions.select do |definition|
    definition.is_a?(Hash) && %w[bulk_material independent_item].include?(definition["form"])
  end
  c3_noninventory_definitions = c3_definitions.select do |definition|
    definition.is_a?(Hash) && %w[placed_entity growing_entity character_entity rights_record].include?(definition["form"])
  end
  unclassified_c3_count = c3_definitions.length - c3_inventory_items.length - c3_noninventory_definitions.length

  errors << "catalog.c3.yaml.definitions: C3 必须恰好新增 30 项，当前为 #{c3_definitions.length}" unless c3_definitions.length == 30
  errors << "catalog.c3.yaml.definitions: C3 必须恰好包含 6 个库存物品，当前为 #{c3_inventory_items.length}" unless c3_inventory_items.length == 6
  unless c3_noninventory_definitions.length == 24
    errors << "catalog.c3.yaml.definitions: C3 必须恰好包含 24 个非库存定义，当前为 #{c3_noninventory_definitions.length}"
  end
  errors << "catalog.c3.yaml.definitions: 存在 #{unclassified_c3_count} 个无法按存在形态归类的定义" unless unclassified_c3_count.zero?
  errors << "transitions.c3.yaml.transitions: C3 必须恰好包含 24 个转换流程，当前为 #{transitions.length}" unless transitions.length == 24

  items += c3_inventory_items
  errors << "C3 基线累计库存物品必须为 66 项，当前为 #{items.length}" unless items.length == 66
  c3_baseline_catalog_count = items.length + c3_noninventory_definitions.length
  unless c3_baseline_catalog_count == 90
    errors << "C3 基线累计目录定义必须为 90 项，当前为 #{c3_baseline_catalog_count}"
  end
end

c4_items = []
c4_recipes = []
c4_item_ids = []
c4_recipe_ids = []
if include_c4
  c4_items = c4_items_doc["items"]
  c4_recipes = c4_recipes_doc["recipes"]
  unless c4_items.is_a?(Array)
    errors << "items.c4.yaml.items: 必须是数组"
    c4_items = []
  end
  unless c4_recipes.is_a?(Array)
    errors << "recipes.c4.yaml.recipes: 必须是数组"
    c4_recipes = []
  end
  errors << "items.c4.yaml.items: C4 必须恰好新增 30 项，当前为 #{c4_items.length}" unless c4_items.length == 30
  errors << "recipes.c4.yaml.recipes: C4 必须恰好新增 15 项，当前为 #{c4_recipes.length}" unless c4_recipes.length == 15

  c4_item_ids = c4_items.filter { |item| item.is_a?(Hash) }.map { |item| item["id"] }
  c4_recipe_ids = c4_recipes.filter { |recipe| recipe.is_a?(Hash) }.map { |recipe| recipe["id"] }

  expected_c4_category_counts = {
    "material" => 22,
    "byproduct_and_waste" => 3,
    "component" => 3,
    "tool" => 1,
    "electronic_device" => 1
  }
  actual_c4_categories = c4_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["category"] }.transform_values(&:length)
  unless actual_c4_categories == expected_c4_category_counts
    errors << "items.c4.yaml.items: C4 分类增量必须为 #{expected_c4_category_counts.inspect}，当前为 #{actual_c4_categories.inspect}"
  end
  expected_c4_form_counts = {"bulk_material" => 28, "independent_item" => 2}
  actual_c4_forms = c4_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["form"] }.transform_values(&:length)
  unless actual_c4_forms == expected_c4_form_counts
    errors << "items.c4.yaml.items: C4 形态增量必须为 #{expected_c4_form_counts.inspect}，当前为 #{actual_c4_forms.inspect}"
  end

  prior_item_by_id = items.filter { |item| item.is_a?(Hash) }.to_h { |item| [item["id"], item] }
  extensions = c4_items_doc["interface_extensions"]
  unless extensions.is_a?(Hash)
    errors << "items.c4.yaml.interface_extensions: 必须是对象"
    extensions = {}
  end
  extensions.each do |item_id, additions|
    target = prior_item_by_id[item_id]
    unless target
      errors << "items.c4.yaml.interface_extensions.#{item_id}: 只能扩展 C1–C3 库存物品"
      next
    end
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "items.c4.yaml.interface_extensions.#{item_id}: 必须是非空对象"
      next
    end
    invalid_fields = additions.keys - %w[produced_by used_by repair_recipes dismantle_recipes]
    errors << "items.c4.yaml.interface_extensions.#{item_id}: 非法字段 #{invalid_fields.join(', ')}" unless invalid_fields.empty?
    additions.each do |field, recipe_refs|
      unless recipe_refs.is_a?(Array) && !recipe_refs.empty?
        errors << "items.c4.yaml.interface_extensions.#{item_id}.#{field}: 必须是非空数组"
        next
      end
      duplicate_refs = recipe_refs.group_by(&:itself).select { |_key, values| values.length > 1 }.keys
      unless duplicate_refs.empty?
        errors << "items.c4.yaml.interface_extensions.#{item_id}.#{field}: 重复引用 #{duplicate_refs.join(', ')}"
      end
      recipe_refs.each do |recipe_id|
        errors << "items.c4.yaml.interface_extensions.#{item_id}.#{field}: 必须引用 C4 工艺 #{recipe_id}" unless c4_recipe_ids.include?(recipe_id)
      end
      target["interfaces"] ||= {}
      existing = Array(target["interfaces"][field])
      overlap = existing & recipe_refs
      unless overlap.empty?
        errors << "items.c4.yaml.interface_extensions.#{item_id}.#{field}: 不得重复前批引用 #{overlap.join(', ')}"
      end
      target["interfaces"][field] = existing + recipe_refs
    end
  end

  items += c4_items
  recipes += c4_recipes
  errors << "C4 累计库存物品必须为 96 项，当前为 #{items.length}" unless items.length == 96
  errors << "C4 累计工艺必须为 45 项，当前为 #{recipes.length}" unless recipes.length == 45
end

c5_items = []
c5_recipes = []
c5_item_ids = []
c5_recipe_ids = []
if include_c5
  c5_items = c5_items_doc["items"]
  c5_recipes = c5_recipes_doc["recipes"]
  unless c5_items.is_a?(Array)
    errors << "items.c5.yaml.items: 必须是数组"
    c5_items = []
  end
  unless c5_recipes.is_a?(Array)
    errors << "recipes.c5.yaml.recipes: 必须是数组"
    c5_recipes = []
  end
  errors << "items.c5.yaml.items: C5 必须恰好新增 30 项，当前为 #{c5_items.length}" unless c5_items.length == 30
  errors << "recipes.c5.yaml.recipes: C5 必须恰好新增 15 项，当前为 #{c5_recipes.length}" unless c5_recipes.length == 15

  c5_item_ids = c5_items.filter { |item| item.is_a?(Hash) }.map { |item| item["id"] }
  c5_recipe_ids = c5_recipes.filter { |recipe| recipe.is_a?(Hash) }.map { |recipe| recipe["id"] }

  expected_c5_category_counts = {
    "component" => 8,
    "tool" => 4,
    "electronic_device" => 4,
    "food_and_drink" => 8,
    "medicine_and_medical_supply" => 6
  }
  actual_c5_categories = c5_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["category"] }.transform_values(&:length)
  unless actual_c5_categories == expected_c5_category_counts
    errors << "items.c5.yaml.items: C5 分类增量必须为 #{expected_c5_category_counts.inspect}，当前为 #{actual_c5_categories.inspect}"
  end
  expected_c5_form_counts = {"bulk_material" => 22, "independent_item" => 8}
  actual_c5_forms = c5_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["form"] }.transform_values(&:length)
  unless actual_c5_forms == expected_c5_form_counts
    errors << "items.c5.yaml.items: C5 形态增量必须为 #{expected_c5_form_counts.inspect}，当前为 #{actual_c5_forms.inspect}"
  end

  prior_item_by_id = items.filter { |item| item.is_a?(Hash) }.to_h { |item| [item["id"], item] }
  extensions = c5_items_doc["interface_extensions"]
  unless extensions.is_a?(Hash)
    errors << "items.c5.yaml.interface_extensions: 必须是对象"
    extensions = {}
  end
  extensions.each do |item_id, additions|
    target = prior_item_by_id[item_id]
    unless target
      errors << "items.c5.yaml.interface_extensions.#{item_id}: 只能扩展 C1–C4 库存物品"
      next
    end
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "items.c5.yaml.interface_extensions.#{item_id}: 必须是非空对象"
      next
    end
    invalid_fields = additions.keys - %w[produced_by used_by repair_recipes dismantle_recipes]
    errors << "items.c5.yaml.interface_extensions.#{item_id}: 非法字段 #{invalid_fields.join(', ')}" unless invalid_fields.empty?
    additions.each do |field, recipe_refs|
      unless recipe_refs.is_a?(Array) && !recipe_refs.empty?
        errors << "items.c5.yaml.interface_extensions.#{item_id}.#{field}: 必须是非空数组"
        next
      end
      duplicate_refs = recipe_refs.group_by(&:itself).select { |_key, values| values.length > 1 }.keys
      unless duplicate_refs.empty?
        errors << "items.c5.yaml.interface_extensions.#{item_id}.#{field}: 重复引用 #{duplicate_refs.join(', ')}"
      end
      recipe_refs.each do |recipe_id|
        errors << "items.c5.yaml.interface_extensions.#{item_id}.#{field}: 必须引用 C5 工艺 #{recipe_id}" unless c5_recipe_ids.include?(recipe_id)
      end
      target["interfaces"] ||= {}
      existing = Array(target["interfaces"][field])
      overlap = existing & recipe_refs
      unless overlap.empty?
        errors << "items.c5.yaml.interface_extensions.#{item_id}.#{field}: 不得重复前批引用 #{overlap.join(', ')}"
      end
      target["interfaces"][field] = existing + recipe_refs
    end
  end

  items += c5_items
  recipes += c5_recipes
  errors << "C5 累计库存物品必须为 126 项，当前为 #{items.length}" unless items.length == 126
  errors << "C5 累计工艺必须为 60 项，当前为 #{recipes.length}" unless recipes.length == 60
end

c6_items = []
c6_recipes = []
c6_item_ids = []
c6_recipe_ids = []
if include_c6
  c6_items = c6_items_doc["items"]
  c6_recipes = c6_recipes_doc["recipes"]
  unless c6_items.is_a?(Array)
    errors << "items.c6.yaml.items: 必须是数组"
    c6_items = []
  end
  unless c6_recipes.is_a?(Array)
    errors << "recipes.c6.yaml.recipes: 必须是数组"
    c6_recipes = []
  end
  errors << "items.c6.yaml.items: C6 必须恰好新增 30 项，当前为 #{c6_items.length}" unless c6_items.length == 30
  errors << "recipes.c6.yaml.recipes: C6 必须恰好新增 15 项，当前为 #{c6_recipes.length}" unless c6_recipes.length == 15

  c6_item_ids = c6_items.filter { |item| item.is_a?(Hash) }.map { |item| item["id"] }
  c6_recipe_ids = c6_recipes.filter { |recipe| recipe.is_a?(Hash) }.map { |recipe| recipe["id"] }

  expected_c6_category_counts = {
    "food_and_drink" => 4,
    "medicine_and_medical_supply" => 4,
    "weapon_and_ammunition" => 16,
    "plant_and_seed" => 2,
    "book_and_data" => 2,
    "document_and_credential" => 2
  }
  actual_c6_categories = c6_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["category"] }.transform_values(&:length)
  unless actual_c6_categories == expected_c6_category_counts
    errors << "items.c6.yaml.items: C6 分类增量必须为 #{expected_c6_category_counts.inspect}，当前为 #{actual_c6_categories.inspect}"
  end
  expected_c6_form_counts = {"independent_item" => 13, "bulk_material" => 17}
  actual_c6_forms = c6_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["form"] }.transform_values(&:length)
  unless actual_c6_forms == expected_c6_form_counts
    errors << "items.c6.yaml.items: C6 形态增量必须为 #{expected_c6_form_counts.inspect}，当前为 #{actual_c6_forms.inspect}"
  end

  prior_item_by_id = items.filter { |item| item.is_a?(Hash) }.to_h { |item| [item["id"], item] }
  extensions = c6_items_doc["interface_extensions"]
  unless extensions.is_a?(Hash)
    errors << "items.c6.yaml.interface_extensions: 必须是对象"
    extensions = {}
  end
  extensions.each do |item_id, additions|
    target = prior_item_by_id[item_id]
    unless target
      errors << "items.c6.yaml.interface_extensions.#{item_id}: 只能扩展 C1–C5 库存物品"
      next
    end
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "items.c6.yaml.interface_extensions.#{item_id}: 必须是非空对象"
      next
    end
    invalid_fields = additions.keys - %w[produced_by used_by repair_recipes dismantle_recipes]
    errors << "items.c6.yaml.interface_extensions.#{item_id}: 非法字段 #{invalid_fields.join(', ')}" unless invalid_fields.empty?
    additions.each do |field, recipe_refs|
      unless recipe_refs.is_a?(Array) && !recipe_refs.empty?
        errors << "items.c6.yaml.interface_extensions.#{item_id}.#{field}: 必须是非空数组"
        next
      end
      duplicate_refs = recipe_refs.group_by(&:itself).select { |_key, values| values.length > 1 }.keys
      errors << "items.c6.yaml.interface_extensions.#{item_id}.#{field}: 重复引用 #{duplicate_refs.join(', ')}" unless duplicate_refs.empty?
      recipe_refs.each do |recipe_id|
        errors << "items.c6.yaml.interface_extensions.#{item_id}.#{field}: 必须引用 C6 工艺 #{recipe_id}" unless c6_recipe_ids.include?(recipe_id)
      end
      target["interfaces"] ||= {}
      existing = Array(target["interfaces"][field])
      overlap = existing & recipe_refs
      errors << "items.c6.yaml.interface_extensions.#{item_id}.#{field}: 不得重复前批引用 #{overlap.join(', ')}" unless overlap.empty?
      target["interfaces"][field] = existing + recipe_refs
    end
  end

  items += c6_items
  recipes += c6_recipes
  errors << "C6 累计库存物品必须为 156 项，当前为 #{items.length}" unless items.length == 156
  errors << "C6 累计工艺必须为 75 项，当前为 #{recipes.length}" unless recipes.length == 75
end

c7_items = []
c7_recipes = []
c7_item_ids = []
c7_recipe_ids = []
if include_c7
  c7_items = c7_items_doc["items"]
  c7_recipes = c7_recipes_doc["recipes"]
  unless c7_items.is_a?(Array)
    errors << "items.c7.yaml.items: 必须是数组"
    c7_items = []
  end
  unless c7_recipes.is_a?(Array)
    errors << "recipes.c7.yaml.recipes: 必须是数组"
    c7_recipes = []
  end
  errors << "items.c7.yaml.items: C7 必须恰好新增 40 项，当前为 #{c7_items.length}" unless c7_items.length == 40
  errors << "recipes.c7.yaml.recipes: C7 必须恰好新增 15 项，当前为 #{c7_recipes.length}" unless c7_recipes.length == 15

  c7_item_ids = c7_items.filter { |item| item.is_a?(Hash) }.map { |item| item["id"] }
  c7_recipe_ids = c7_recipes.filter { |recipe| recipe.is_a?(Hash) }.map { |recipe| recipe["id"] }

  expected_c7_category_counts = {
    "armor_and_clothing" => 21,
    "furniture" => 4,
    "daily_supply" => 4,
    "decoration_and_instrument" => 3,
    "jewelry_and_valuable" => 2,
    "rare_and_special" => 6
  }
  actual_c7_categories = c7_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["category"] }.transform_values(&:length)
  unless actual_c7_categories == expected_c7_category_counts
    errors << "items.c7.yaml.items: C7 分类增量必须为 #{expected_c7_category_counts.inspect}，当前为 #{actual_c7_categories.inspect}"
  end
  expected_c7_form_counts = {"independent_item" => 38, "bulk_material" => 2}
  actual_c7_forms = c7_items.filter { |item| item.is_a?(Hash) }.group_by { |item| item["form"] }.transform_values(&:length)
  unless actual_c7_forms == expected_c7_form_counts
    errors << "items.c7.yaml.items: C7 形态增量必须为 #{expected_c7_form_counts.inspect}，当前为 #{actual_c7_forms.inspect}"
  end

  prior_item_by_id = items.filter { |item| item.is_a?(Hash) }.to_h { |item| [item["id"], item] }
  extensions = c7_items_doc["interface_extensions"]
  unless extensions.is_a?(Hash)
    errors << "items.c7.yaml.interface_extensions: 必须是对象"
    extensions = {}
  end
  extensions.each do |item_id, additions|
    target = prior_item_by_id[item_id]
    unless target
      errors << "items.c7.yaml.interface_extensions.#{item_id}: 只能扩展 C1–C6 库存物品"
      next
    end
    unless additions.is_a?(Hash) && !additions.empty?
      errors << "items.c7.yaml.interface_extensions.#{item_id}: 必须是非空对象"
      next
    end
    invalid_fields = additions.keys - %w[produced_by used_by repair_recipes dismantle_recipes]
    errors << "items.c7.yaml.interface_extensions.#{item_id}: 非法字段 #{invalid_fields.join(', ')}" unless invalid_fields.empty?
    additions.each do |field, recipe_refs|
      unless recipe_refs.is_a?(Array) && !recipe_refs.empty?
        errors << "items.c7.yaml.interface_extensions.#{item_id}.#{field}: 必须是非空数组"
        next
      end
      duplicate_refs = recipe_refs.group_by(&:itself).select { |_key, values| values.length > 1 }.keys
      errors << "items.c7.yaml.interface_extensions.#{item_id}.#{field}: 重复引用 #{duplicate_refs.join(', ')}" unless duplicate_refs.empty?
      recipe_refs.each do |recipe_id|
        errors << "items.c7.yaml.interface_extensions.#{item_id}.#{field}: 必须引用 C7 工艺 #{recipe_id}" unless c7_recipe_ids.include?(recipe_id)
      end
      target["interfaces"] ||= {}
      existing = Array(target["interfaces"][field])
      overlap = existing & recipe_refs
      errors << "items.c7.yaml.interface_extensions.#{item_id}.#{field}: 不得重复前批引用 #{overlap.join(', ')}" unless overlap.empty?
      target["interfaces"][field] = existing + recipe_refs
    end
  end

  items += c7_items
  recipes += c7_recipes
  errors << "C7 累计库存物品必须为 196 项，当前为 #{items.length}" unless items.length == 196
  errors << "C7 累计工艺必须为 90 项，当前为 #{recipes.length}" unless recipes.length == 90
end

catalog_definitions = items + c3_noninventory_definitions
c3_item_ids = c3_inventory_items.filter { |item| item.is_a?(Hash) }.map { |item| item["id"] }
c3_noninventory_ids = c3_noninventory_definitions.filter { |definition| definition.is_a?(Hash) }.map { |definition| definition["id"] }

item_required = %w[
  id name description status category form tags resource_chains availability
  legal_profile exposure_profile actions unit mass volume stack_rule
  storage_rule base_value acquisition_paths consumption_loss_paths
  logistics_note interfaces decision_role
]
item_ids = []

items.each_with_index do |item, index|
  path = "items[#{index}]"
  unless item.is_a?(Hash)
    errors << "#{path}: 必须是对象"
    next
  end

  require_keys(item, item_required, path, errors)
  id = item["id"]
  item_ids << id if nonempty_string?(id)
  errors << "#{path}.id: 必须匹配 item.<domain>.<name>" unless id.is_a?(String) && id.match?(/\Aitem\.[a-z0-9_]+\.[a-z0-9_]+\z/)
  check_nonempty_text(item["name"], "#{path}.name", errors)
  check_nonempty_text(item["description"], "#{path}.description", errors)
  errors << "#{path}.status: 必须为 #{expected_status}" unless item["status"] == expected_status
  check_enum(item["category"], enum_keys(enums, "categories"), "#{path}.category", errors)
  check_enum(item["form"], enum_keys(enums, "forms"), "#{path}.form", errors)
  check_enum_array(item["tags"], enum_keys(enums, "tags"), "#{path}.tags", errors)
  check_enum_array(item["resource_chains"], enum_keys(enums, "resource_chains"), "#{path}.resource_chains", errors)
  check_enum(item["availability"], enum_keys(enums, "availability"), "#{path}.availability", errors)
  check_enum(item["legal_profile"], enum_keys(enums, "legal_profiles"), "#{path}.legal_profile", errors)
  check_enum_array(item["actions"], enum_keys(enums, "actions"), "#{path}.actions", errors)
  check_enum(item["unit"], enum_keys(enums, "units"), "#{path}.unit", errors)
  errors << "#{path}.mass: 必须是正数" unless positive_number?(item["mass"])
  errors << "#{path}.volume: 必须是正数" unless positive_number?(item["volume"])
  errors << "#{path}.base_value: 必须是非负数" unless nonnegative_number?(item["base_value"])
  check_enum_array(item["storage_rule"], enum_keys(enums, "storage_rules"), "#{path}.storage_rule", errors)
  check_nonempty_text(item["logistics_note"], "#{path}.logistics_note", errors)
  check_nonempty_text(item["decision_role"], "#{path}.decision_role", errors)

  exposure = item["exposure_profile"]
  if exposure.is_a?(Hash)
    require_keys(exposure, %w[visibility traceability wealth_signal], "#{path}.exposure_profile", errors)
    check_enum(exposure["visibility"], enum_keys(enums, "visibility"), "#{path}.exposure_profile.visibility", errors)
    check_enum(exposure["traceability"], enum_keys(enums, "traceability"), "#{path}.exposure_profile.traceability", errors)
    check_enum(exposure["wealth_signal"], enum_keys(enums, "wealth_signal"), "#{path}.exposure_profile.wealth_signal", errors)
  else
    errors << "#{path}.exposure_profile: 必须是对象"
  end

  stack_rule = item["stack_rule"]
  if stack_rule.is_a?(Hash)
    require_keys(stack_rule, %w[stackable merge_keys], "#{path}.stack_rule", errors)
    unless [true, false].include?(stack_rule["stackable"])
      errors << "#{path}.stack_rule.stackable: 必须是布尔值"
    end
    check_enum_array(stack_rule["merge_keys"], enum_keys(enums, "merge_keys"), "#{path}.stack_rule.merge_keys", errors, allow_empty: true)
    if item["form"] == "bulk_material" && stack_rule["stackable"] != true
      errors << "#{path}.stack_rule.stackable: bulk_material 必须可堆叠"
    end
    if item["form"] == "independent_item" && stack_rule["stackable"] != false
      errors << "#{path}.stack_rule.stackable: independent_item 不得堆叠"
    end
  else
    errors << "#{path}.stack_rule: 必须是对象"
  end

  {
    "acquisition_paths" => "acquisition_types",
    "consumption_loss_paths" => "loss_types"
  }.each do |field, vocabulary|
    paths = item[field]
    unless paths.is_a?(Array) && !paths.empty?
      errors << "#{path}.#{field}: 必须是非空数组"
      next
    end
    paths.each_with_index do |entry, entry_index|
      entry_path = "#{path}.#{field}[#{entry_index}]"
      unless entry.is_a?(Hash)
        errors << "#{entry_path}: 必须是对象"
        next
      end
      require_keys(entry, %w[type note], entry_path, errors)
      check_enum(entry["type"], enum_keys(enums, vocabulary), "#{entry_path}.type", errors)
      check_nonempty_text(entry["note"], "#{entry_path}.note", errors)
    end
  end

  acquisition_types = Array(item["acquisition_paths"]).filter { |entry| entry.is_a?(Hash) }.map { |entry| entry["type"] }
  tags = Array(item["tags"])
  if tags.include?("salvage_only") && acquisition_types.any? { |type| type != "salvage" }
    errors << "#{path}: salvage_only 物品的获得路径只能是 salvage"
  end

  traceable_expected = exposure.is_a?(Hash) && %w[regulated_batch networked].include?(exposure["traceability"])
  if tags.include?("traceable") != traceable_expected
    errors << "#{path}: traceable 标签必须与 regulated_batch/networked 追踪等级一致"
  end

  high_wealth_expected = exposure.is_a?(Hash) && exposure["wealth_signal"] == "high"
  if tags.include?("high_wealth_exposure") != high_wealth_expected
    errors << "#{path}: high_wealth_exposure 标签必须与 high 财富暴露一致"
  end

  interfaces = item["interfaces"]
  if interfaces.is_a?(Hash)
    %w[produced_by used_by repair_recipes dismantle_recipes].each do |field|
      value = interfaces[field]
      unless value.is_a?(Array)
        errors << "#{path}.interfaces.#{field}: 必须是数组"
        next
      end
      errors << "#{path}.interfaces.#{field}: 存在重复引用" unless value.uniq.length == value.length
      value.each do |recipe_id|
        errors << "#{path}.interfaces.#{field}: 非法工艺 ID #{recipe_id.inspect}" unless recipe_id.is_a?(String) && recipe_id.match?(/\Arecipe\.[a-z0-9_]+\.[a-z0-9_]+\z/)
      end
    end
  else
    errors << "#{path}.interfaces: 必须是对象"
  end

  lifecycle_contract_item_ids = c2_item_ids + c4_item_ids + c5_item_ids + c6_item_ids + c7_item_ids
  next unless include_c2 && lifecycle_contract_item_ids.include?(id)

  unless %w[bulk_material independent_item].include?(item["form"])
    errors << "#{path}.form: 增量库存物品只允许 bulk_material 或 independent_item"
  end

  if item["form"] == "independent_item"
    durability = item["durability_profile"]
    if durability.is_a?(Hash)
      require_keys(
        durability,
        %w[tracked repairability dismantle_policy wear_sources failure_consequence],
        "#{path}.durability_profile",
        errors
      )
      errors << "#{path}.durability_profile.tracked: 增量独立物品必须为 true" unless durability["tracked"] == true
      check_enum(durability["repairability"], enum_keys(enums, "repairability"), "#{path}.durability_profile.repairability", errors)
      check_enum(durability["dismantle_policy"], enum_keys(enums, "dismantle_policies"), "#{path}.durability_profile.dismantle_policy", errors)
      check_enum_array(durability["wear_sources"], enum_keys(enums, "wear_sources"), "#{path}.durability_profile.wear_sources", errors)
      check_nonempty_text(durability["failure_consequence"], "#{path}.durability_profile.failure_consequence", errors)

      repair_refs = item.dig("interfaces", "repair_recipes")
      dismantle_refs = item.dig("interfaces", "dismantle_recipes")
      if durability["repairability"] == "repairable" && Array(repair_refs).empty?
        errors << "#{path}: repairable 独立物品必须声明 repair_recipes"
      end
      if durability["repairability"] != "repairable" && !Array(repair_refs).empty?
        errors << "#{path}: 非 repairable 独立物品不得声明 repair_recipes"
      end
      if durability["dismantle_policy"] == "allowed" && Array(dismantle_refs).empty?
        errors << "#{path}: dismantle_policy=allowed 必须声明 dismantle_recipes"
      end
      if durability["dismantle_policy"] != "allowed" && !Array(dismantle_refs).empty?
        errors << "#{path}: 非 allowed 独立物品不得声明 dismantle_recipes"
      end
    else
      errors << "#{path}.durability_profile: 增量独立物品必须声明耐久合同"
    end
  elsif item.key?("durability_profile")
    errors << "#{path}.durability_profile: 增量批量物资不得伪造独立实例耐久"
  end

  if include_c7 && c7_item_ids.include?(id) && item["category"] == "armor_and_clothing"
    protection = item["protection_profile"]
    if protection.is_a?(Hash)
      require_keys(
        protection,
        %w[role regions use_constraints tradeoff_note],
        "#{path}.protection_profile",
        errors
      )
      check_enum(protection["role"], enum_keys(enums, "protection_roles"), "#{path}.protection_profile.role", errors)
      check_enum_array(protection["regions"], enum_keys(enums, "body_regions"), "#{path}.protection_profile.regions", errors)
      check_nonempty_text(protection["use_constraints"], "#{path}.protection_profile.use_constraints", errors)
      check_nonempty_text(protection["tradeoff_note"], "#{path}.protection_profile.tradeoff_note", errors)
    else
      errors << "#{path}.protection_profile: C7 防具与服饰必须声明防护职责"
    end
  end

  if item["category"] == "weapon_and_ammunition"
    equipment = item["equipment_profile"]
    if equipment.is_a?(Hash)
      require_keys(equipment, %w[role ammo_family use_constraints], "#{path}.equipment_profile", errors)
      check_enum(equipment["role"], enum_keys(enums, "equipment_roles"), "#{path}.equipment_profile.role", errors)
      check_enum(equipment["ammo_family"], enum_keys(enums, "ammo_families"), "#{path}.equipment_profile.ammo_family", errors)
      check_nonempty_text(equipment["use_constraints"], "#{path}.equipment_profile.use_constraints", errors)
    else
      errors << "#{path}.equipment_profile: 武器与弹药必须声明用途边界"
    end
  end

  if item["category"] == "book_and_data"
    knowledge = item["knowledge_profile"]
    if knowledge.is_a?(Hash)
      require_keys(knowledge, %w[domain requires_reader effect_note], "#{path}.knowledge_profile", errors)
      check_enum(knowledge["domain"], enum_keys(enums, "knowledge_domains"), "#{path}.knowledge_profile.domain", errors)
      errors << "#{path}.knowledge_profile.requires_reader: 必须是布尔值" unless [true, false].include?(knowledge["requires_reader"])
      check_nonempty_text(knowledge["effect_note"], "#{path}.knowledge_profile.effect_note", errors)
    else
      errors << "#{path}.knowledge_profile: 书籍与数据必须声明知识接口"
    end
  end

  if item["category"] == "furniture"
    deployment = item["deployment_profile"]
    if deployment.is_a?(Hash)
      require_keys(
        deployment,
        %w[converts_to_placed_entity installation_required footprint uninstall_result],
        "#{path}.deployment_profile",
        errors
      )
      unless deployment["converts_to_placed_entity"] == true
        errors << "#{path}.deployment_profile.converts_to_placed_entity: C2 家具入口必须为 true"
      end
      errors << "#{path}.deployment_profile.installation_required: 必须是布尔值" unless [true, false].include?(deployment["installation_required"])
      check_enum(deployment["footprint"], enum_keys(enums, "footprints"), "#{path}.deployment_profile.footprint", errors)
      check_enum(deployment["uninstall_result"], enum_keys(enums, "uninstall_results"), "#{path}.deployment_profile.uninstall_result", errors)
    else
      errors << "#{path}.deployment_profile: 家具必须声明放置入口"
    end
  end

  if item["category"] == "document_and_credential"
    transition = item["record_transition"]
    if transition.is_a?(Hash)
      require_keys(
        transition,
        %w[creates_rights_record authority_scope revocation_note],
        "#{path}.record_transition",
        errors
      )
      unless transition["creates_rights_record"] == true
        errors << "#{path}.record_transition.creates_rights_record: C2 凭证入口必须为 true"
      end
      check_nonempty_text(transition["authority_scope"], "#{path}.record_transition.authority_scope", errors)
      check_nonempty_text(transition["revocation_note"], "#{path}.record_transition.revocation_note", errors)
    else
      errors << "#{path}.record_transition: 文件与凭证必须声明权利记录转换"
    end
  end

  if %w[jewelry_and_valuable rare_and_special].include?(item["category"])
    provenance = item["provenance_profile"]
    if provenance.is_a?(Hash)
      require_keys(provenance, %w[ownership source significance], "#{path}.provenance_profile", errors)
      check_enum(provenance["ownership"], enum_keys(enums, "ownership_profiles"), "#{path}.provenance_profile.ownership", errors)
      check_nonempty_text(provenance["source"], "#{path}.provenance_profile.source", errors)
      check_nonempty_text(provenance["significance"], "#{path}.provenance_profile.significance", errors)
    else
      errors << "#{path}.provenance_profile: 贵重或稀有物品必须声明来源"
    end
  end
end

duplicate_item_ids = item_ids.group_by(&:itself).select { |_id, entries| entries.length > 1 }.keys
errors << "items.seed.yaml.items: 重复 ID #{duplicate_item_ids.join(', ')}" unless duplicate_item_ids.empty?
item_id_set = item_ids.to_h { |id| [id, true] }

if include_c3
  noninventory_required = %w[
    id name description status category form tags resource_chains availability
    legal_profile exposure_profile actions decision_role transition_id
  ]
  forbidden_noninventory_fields = %w[
    unit mass volume stack_rule storage_rule base_value acquisition_paths
    consumption_loss_paths logistics_note interfaces durability_profile
  ]
  noninventory_ids = []

  check_item_references = lambda do |value, path, allow_empty|
    unless value.is_a?(Array)
      errors << "#{path}: 必须是数组"
      next
    end
    errors << "#{path}: 不得为空" if value.empty? && !allow_empty
    errors << "#{path}: 存在重复引用" unless value.uniq.length == value.length
    value.each do |item_id|
      errors << "#{path}: 未定义的库存物品 #{item_id.inspect}" unless item_id_set[item_id]
    end
  end

  c3_noninventory_definitions.each_with_index do |definition, index|
    path = "catalog.c3.yaml.non_inventory[#{index}]"
    unless definition.is_a?(Hash)
      errors << "#{path}: 必须是对象"
      next
    end

    require_keys(definition, noninventory_required, path, errors)
    id = definition["id"]
    noninventory_ids << id if nonempty_string?(id)
    id_pattern_valid = case definition["form"]
                       when "placed_entity"
                         id.is_a?(String) && id.match?(/\Aentity\.placed\.[a-z0-9_]+\z/)
                       when "growing_entity"
                         id.is_a?(String) && id.match?(/\Aentity\.growing\.[a-z0-9_]+\z/)
                       when "character_entity"
                         id.is_a?(String) && id.match?(/\Aentity\.character\.[a-z0-9_]+\z/)
                       when "rights_record"
                         id.is_a?(String) && id.match?(/\Arecord\.right\.[a-z0-9_]+\z/)
                       else
                         false
                       end
    errors << "#{path}.id: ID 与非库存存在形态不匹配" unless id_pattern_valid
    check_nonempty_text(definition["name"], "#{path}.name", errors)
    check_nonempty_text(definition["description"], "#{path}.description", errors)
    errors << "#{path}.status: 必须为 #{expected_status}" unless definition["status"] == expected_status
    check_enum(definition["category"], enum_keys(enums, "categories"), "#{path}.category", errors)
    check_enum(definition["form"], %w[placed_entity growing_entity character_entity rights_record], "#{path}.form", errors)
    check_enum_array(definition["tags"], enum_keys(enums, "tags"), "#{path}.tags", errors)
    check_enum_array(definition["resource_chains"], enum_keys(enums, "resource_chains"), "#{path}.resource_chains", errors)
    check_enum(definition["availability"], enum_keys(enums, "availability"), "#{path}.availability", errors)
    check_enum(definition["legal_profile"], enum_keys(enums, "legal_profiles"), "#{path}.legal_profile", errors)
    check_enum_array(definition["actions"], enum_keys(enums, "actions"), "#{path}.actions", errors)
    check_nonempty_text(definition["decision_role"], "#{path}.decision_role", errors)
    transition_id = definition["transition_id"]
    unless transition_id.is_a?(String) && transition_id.match?(/\Atransition\.[a-z0-9_]+\.[a-z0-9_]+\z/)
      errors << "#{path}.transition_id: 必须匹配 transition.<domain>.<name>"
    end

    leaked_fields = definition.keys & forbidden_noninventory_fields
    errors << "#{path}: 非库存定义不得包含库存字段 #{leaked_fields.join(', ')}" unless leaked_fields.empty?
    shape_profile_fields = %w[placed_profile growing_profile character_profile rights_profile]
    expected_profile_field = {
      "placed_entity" => "placed_profile",
      "growing_entity" => "growing_profile",
      "character_entity" => "character_profile",
      "rights_record" => "rights_profile"
    }[definition["form"]]
    stray_profile_fields = (definition.keys & shape_profile_fields) - Array(expected_profile_field)
    unless stray_profile_fields.empty?
      errors << "#{path}: 存在不属于 #{definition["form"]} 的形态字段 #{stray_profile_fields.join(', ')}"
    end

    exposure = definition["exposure_profile"]
    if exposure.is_a?(Hash)
      require_keys(exposure, %w[visibility traceability wealth_signal], "#{path}.exposure_profile", errors)
      check_enum(exposure["visibility"], enum_keys(enums, "visibility"), "#{path}.exposure_profile.visibility", errors)
      check_enum(exposure["traceability"], enum_keys(enums, "traceability"), "#{path}.exposure_profile.traceability", errors)
      check_enum(exposure["wealth_signal"], enum_keys(enums, "wealth_signal"), "#{path}.exposure_profile.wealth_signal", errors)
      tags = Array(definition["tags"])
      traceable_expected = %w[regulated_batch networked].include?(exposure["traceability"])
      if tags.include?("traceable") != traceable_expected
        errors << "#{path}: traceable 标签必须与 regulated_batch/networked 追踪等级一致"
      end
      high_wealth_expected = exposure["wealth_signal"] == "high"
      if tags.include?("high_wealth_exposure") != high_wealth_expected
        errors << "#{path}: high_wealth_exposure 标签必须与 high 财富暴露一致"
      end
    else
      errors << "#{path}.exposure_profile: 必须是对象"
    end

    case definition["form"]
    when "placed_entity"
      profile_data = definition["placed_profile"]
      if profile_data.is_a?(Hash)
        require_keys(
          profile_data,
          %w[source_item capability ongoing_input_items uninstall_result effect_note],
          "#{path}.placed_profile",
          errors
        )
        source_item = profile_data["source_item"]
        errors << "#{path}.placed_profile.source_item: 未定义的库存物品 #{source_item.inspect}" unless item_id_set[source_item]
        check_nonempty_text(profile_data["capability"], "#{path}.placed_profile.capability", errors)
        check_item_references.call(profile_data["ongoing_input_items"], "#{path}.placed_profile.ongoing_input_items", true)
        check_enum(profile_data["uninstall_result"], enum_keys(enums, "uninstall_results"), "#{path}.placed_profile.uninstall_result", errors)
        check_nonempty_text(profile_data["effect_note"], "#{path}.placed_profile.effect_note", errors)
      else
        errors << "#{path}.placed_profile: placed_entity 必须声明放置职责"
      end
    when "growing_entity"
      profile_data = definition["growing_profile"]
      if profile_data.is_a?(Hash)
        require_keys(
          profile_data,
          %w[source_item growth_stages care_input_items harvest_output_items effect_note],
          "#{path}.growing_profile",
          errors
        )
        source_item = profile_data["source_item"]
        errors << "#{path}.growing_profile.source_item: 未定义的库存物品 #{source_item.inspect}" unless item_id_set[source_item]
        check_enum_array(profile_data["growth_stages"], enum_keys(enums, "growth_stages"), "#{path}.growing_profile.growth_stages", errors)
        unless Array(profile_data["growth_stages"]).sort == enum_keys(enums, "growth_stages").sort
          errors << "#{path}.growing_profile.growth_stages: 必须完整覆盖 C3 离散生长阶段"
        end
        check_item_references.call(profile_data["care_input_items"], "#{path}.growing_profile.care_input_items", false)
        check_item_references.call(profile_data["harvest_output_items"], "#{path}.growing_profile.harvest_output_items", false)
        check_nonempty_text(profile_data["effect_note"], "#{path}.growing_profile.effect_note", errors)
      else
        errors << "#{path}.growing_profile: growing_entity 必须声明生长职责"
      end
    when "character_entity"
      profile_data = definition["character_profile"]
      if profile_data.is_a?(Hash)
        require_keys(
          profile_data,
          %w[species service_roles upkeep_items autonomy_note loss_note],
          "#{path}.character_profile",
          errors
        )
        check_enum(profile_data["species"], enum_keys(enums, "animal_species"), "#{path}.character_profile.species", errors)
        check_enum_array(
          profile_data["service_roles"],
          enum_keys(enums, "animal_service_roles"),
          "#{path}.character_profile.service_roles",
          errors
        )
        check_item_references.call(profile_data["upkeep_items"], "#{path}.character_profile.upkeep_items", false)
        unless Array(profile_data["upkeep_items"]).include?("item.animal.feed_bundle")
          errors << "#{path}.character_profile.upkeep_items: C3 动物角色必须显式连接饲料"
        end
        check_nonempty_text(profile_data["autonomy_note"], "#{path}.character_profile.autonomy_note", errors)
        check_nonempty_text(profile_data["loss_note"], "#{path}.character_profile.loss_note", errors)
      else
        errors << "#{path}.character_profile: character_entity 必须声明角色职责"
      end
    when "rights_record"
      profile_data = definition["rights_profile"]
      if profile_data.is_a?(Hash)
        require_keys(
          profile_data,
          %w[bearer_scope issuer_class validity_states revocable physical_evidence_item effect_note],
          "#{path}.rights_profile",
          errors
        )
        check_enum(profile_data["bearer_scope"], enum_keys(enums, "bearer_scopes"), "#{path}.rights_profile.bearer_scope", errors)
        check_enum(profile_data["issuer_class"], enum_keys(enums, "issuer_classes"), "#{path}.rights_profile.issuer_class", errors)
        check_enum_array(
          profile_data["validity_states"],
          enum_keys(enums, "validity_states"),
          "#{path}.rights_profile.validity_states",
          errors
        )
        errors << "#{path}.rights_profile.revocable: 必须是布尔值" unless [true, false].include?(profile_data["revocable"])
        evidence_item = profile_data["physical_evidence_item"]
        errors << "#{path}.rights_profile.physical_evidence_item: 未定义的库存物品 #{evidence_item.inspect}" unless item_id_set[evidence_item]
        check_nonempty_text(profile_data["effect_note"], "#{path}.rights_profile.effect_note", errors)
      else
        errors << "#{path}.rights_profile: rights_record 必须声明权利职责"
      end
    end
  end

  duplicate_noninventory_ids = noninventory_ids.group_by(&:itself).select { |_id, entries| entries.length > 1 }.keys
  unless duplicate_noninventory_ids.empty?
    errors << "catalog.c3.yaml.definitions: 重复非库存 ID #{duplicate_noninventory_ids.join(', ')}"
  end
  catalog_ids = item_ids + noninventory_ids
  duplicate_catalog_ids = catalog_ids.group_by(&:itself).select { |_id, entries| entries.length > 1 }.keys
  errors << "累计目录: 重复 ID #{duplicate_catalog_ids.join(', ')}" unless duplicate_catalog_ids.empty?
  expected_inventory_count = if include_c7
                               196
                             elsif include_c6
                               156
                             elsif include_c5
                               126
                             elsif include_c4
                               96
                             else
                               66
                             end
  expected_catalog_count = if include_c7
                             220
                           elsif include_c6
                             180
                           elsif include_c5
                             150
                           elsif include_c4
                             120
                           else
                             90
                           end
  unless item_ids.length == expected_inventory_count
    errors << "#{profile.upcase} 累计库存物品必须为 #{expected_inventory_count} 项，当前为 #{item_ids.length}"
  end
  unless catalog_ids.length == expected_catalog_count
    errors << "#{profile.upcase} 累计目录定义必须为 #{expected_catalog_count} 项，当前为 #{catalog_ids.length}"
  end

  expected_c3_form_counts = {
    "bulk_material" => 6,
    "independent_item" => 0,
    "placed_entity" => 6,
    "growing_entity" => 4,
    "character_entity" => 8,
    "rights_record" => 6
  }
  expected_c3_form_counts.each do |form, expected_count|
    actual_count = c3_definitions.count { |definition| definition.is_a?(Hash) && definition["form"] == form }
    unless actual_count == expected_count
      errors << "catalog.c3.yaml.definitions: C3 #{form} 必须为 #{expected_count} 项，当前为 #{actual_count}"
    end
  end

  definition_by_id = c3_noninventory_definitions.to_h { |definition| [definition["id"], definition] }
  item_by_id = items.to_h { |item| [item["id"], item] }
  transition_ids = []
  transition_target_ids = []
  expected_transition_shape = {
    "deploy" => ["inventory_item", "installed", "placed_entity"],
    "cultivate" => ["inventory_item", "sown", "growing_entity"],
    "live_intake" => ["external_intake", "accepted_to_custody", "character_entity"],
    "right_activation" => ["inventory_item", "retained_and_linked", "rights_record"]
  }
  expected_rollback = {
    "deploy" => [true, %w[source_returned materials_returned]],
    "cultivate" => [false, %w[irreversible_after_sowing]],
    "live_intake" => [false, %w[custody_transfer_required]],
    "right_activation" => [true, %w[record_deactivated]]
  }
  transition_required = %w[
    id name description status kind source target additional_inputs facilities
    tools qualification effective_time_hours logistics rollback risks
  ]

  transitions.each_with_index do |transition, index|
    path = "transitions.c3.yaml.transitions[#{index}]"
    unless transition.is_a?(Hash)
      errors << "#{path}: 必须是对象"
      next
    end

    require_keys(transition, transition_required, path, errors)
    id = transition["id"]
    transition_ids << id if nonempty_string?(id)
    unless id.is_a?(String) && id.match?(/\Atransition\.[a-z0-9_]+\.[a-z0-9_]+\z/)
      errors << "#{path}.id: 必须匹配 transition.<domain>.<name>"
    end
    check_nonempty_text(transition["name"], "#{path}.name", errors)
    check_nonempty_text(transition["description"], "#{path}.description", errors)
    errors << "#{path}.status: 必须为 #{expected_status}" unless transition["status"] == expected_status
    kind = transition["kind"]
    check_enum(kind, enum_keys(enums, "transition_kinds"), "#{path}.kind", errors)

    target = transition["target"]
    target_id = nil
    if target.is_a?(Hash)
      require_keys(target, %w[definition], "#{path}.target", errors)
      target_id = target["definition"]
      transition_target_ids << target_id if nonempty_string?(target_id)
      errors << "#{path}.target.definition: 未定义的 C3 非库存目标 #{target_id.inspect}" unless definition_by_id[target_id]
    else
      errors << "#{path}.target: 必须是对象"
    end

    source = transition["source"]
    source_kind = nil
    disposition = nil
    if source.is_a?(Hash)
      require_keys(source, %w[kind disposition], "#{path}.source", errors)
      source_kind = source["kind"]
      disposition = source["disposition"]
      check_enum(source_kind, enum_keys(enums, "transition_source_kinds"), "#{path}.source.kind", errors)
      check_enum(disposition, enum_keys(enums, "source_dispositions"), "#{path}.source.disposition", errors)
      if source_kind == "inventory_item"
        require_keys(source, %w[item amount link_exclusive], "#{path}.source", errors)
        source_item = source["item"]
        errors << "#{path}.source.item: 未定义的库存物品 #{source_item.inspect}" unless item_id_set[source_item]
        errors << "#{path}.source.amount: 必须是正数" unless positive_number?(source["amount"])
        unless [true, false].include?(source["link_exclusive"])
          errors << "#{path}.source.link_exclusive: 必须是布尔值"
        end
        errors << "#{path}.source.intake_type: 库存来源不得声明活体交接类型" if source.key?("intake_type")
      elsif source_kind == "external_intake"
        require_keys(source, %w[intake_type], "#{path}.source", errors)
        check_enum(source["intake_type"], enum_keys(enums, "live_intake_types"), "#{path}.source.intake_type", errors)
        leaked_source_fields = source.keys & %w[item amount link_exclusive]
        unless leaked_source_fields.empty?
          errors << "#{path}.source: 外部活体交接不得伪造库存字段 #{leaked_source_fields.join(', ')}"
        end
      end
    else
      errors << "#{path}.source: 必须是对象"
    end

    expected_source_kind, expected_disposition, expected_target_form = expected_transition_shape[kind]
    if expected_source_kind
      errors << "#{path}.source.kind: #{kind} 必须为 #{expected_source_kind}" unless source_kind == expected_source_kind
      errors << "#{path}.source.disposition: #{kind} 必须为 #{expected_disposition}" unless disposition == expected_disposition
      target_form = definition_by_id.dig(target_id, "form")
      errors << "#{path}.target: #{kind} 必须指向 #{expected_target_form}" unless target_form == expected_target_form
    end

    if source.is_a?(Hash) && source_kind == "inventory_item"
      source_item = source["item"]
      source_form = item_by_id.dig(source_item, "form")
      expected_source_form = kind == "cultivate" ? "bulk_material" : "independent_item"
      unless source_form == expected_source_form
        errors << "#{path}.source.item: #{kind} 来源必须为 #{expected_source_form}"
      end
      expected_exclusive = kind != "cultivate"
      unless source["link_exclusive"] == expected_exclusive
        errors << "#{path}.source.link_exclusive: #{kind} 必须为 #{expected_exclusive}"
      end
    end

    additional_inputs = transition["additional_inputs"]
    if additional_inputs.is_a?(Array)
      additional_input_ids = []
      additional_inputs.each_with_index do |input, input_index|
        input_path = "#{path}.additional_inputs[#{input_index}]"
        unless input.is_a?(Hash)
          errors << "#{input_path}: 必须是对象"
          next
        end
        require_keys(input, %w[item amount consumed], input_path, errors)
        item_id = input["item"]
        additional_input_ids << item_id
        errors << "#{input_path}.item: 未定义的库存物品 #{item_id.inspect}" unless item_id_set[item_id]
        errors << "#{input_path}.amount: 必须是正数" unless positive_number?(input["amount"])
        errors << "#{input_path}.consumed: 必须是布尔值" unless [true, false].include?(input["consumed"])
      end
      unless additional_input_ids.uniq.length == additional_input_ids.length
        errors << "#{path}.additional_inputs: 同一库存物品不得重复列出"
      end
      if kind == "live_intake" && !additional_input_ids.include?("item.animal.feed_bundle")
        errors << "#{path}.additional_inputs: 活体接收必须显式连接饲料投入"
      end
    else
      errors << "#{path}.additional_inputs: 必须是数组"
    end

    check_enum_array(transition["facilities"], enum_keys(enums, "facilities"), "#{path}.facilities", errors)
    check_enum_array(transition["tools"], enum_keys(enums, "tools"), "#{path}.tools", errors)

    qualification = transition["qualification"]
    if qualification.is_a?(Hash)
      require_keys(qualification, %w[minimum_role skill specialty missing_effect], "#{path}.qualification", errors)
      check_enum(qualification["minimum_role"], enum_keys(enums, "roles"), "#{path}.qualification.minimum_role", errors)
      check_enum(qualification["skill"], enum_keys(enums, "skills"), "#{path}.qualification.skill", errors)
      check_enum(qualification["specialty"], enum_keys(enums, "specialties"), "#{path}.qualification.specialty", errors)
      check_enum(qualification["missing_effect"], enum_keys(enums, "missing_effects"), "#{path}.qualification.missing_effect", errors)
    else
      errors << "#{path}.qualification: 必须是对象"
    end

    check_range(transition["effective_time_hours"], "#{path}.effective_time_hours", errors)

    logistics = transition["logistics"]
    if logistics.is_a?(Hash)
      require_keys(logistics, %w[input_staging output_location], "#{path}.logistics", errors)
      check_nonempty_text(logistics["input_staging"], "#{path}.logistics.input_staging", errors)
      check_nonempty_text(logistics["output_location"], "#{path}.logistics.output_location", errors)
    else
      errors << "#{path}.logistics: 必须是对象"
    end

    rollback = transition["rollback"]
    if rollback.is_a?(Hash)
      require_keys(rollback, %w[allowed result note], "#{path}.rollback", errors)
      errors << "#{path}.rollback.allowed: 必须是布尔值" unless [true, false].include?(rollback["allowed"])
      check_enum(rollback["result"], enum_keys(enums, "rollback_results"), "#{path}.rollback.result", errors)
      check_nonempty_text(rollback["note"], "#{path}.rollback.note", errors)
      expected_allowed, allowed_results = expected_rollback[kind]
      if !expected_allowed.nil? && rollback["allowed"] != expected_allowed
        errors << "#{path}.rollback.allowed: #{kind} 必须为 #{expected_allowed}"
      end
      if allowed_results && !allowed_results.include?(rollback["result"])
        errors << "#{path}.rollback.result: #{kind} 不允许结果 #{rollback["result"].inspect}"
      end
    else
      errors << "#{path}.rollback: 必须是对象"
    end

    risks = transition["risks"]
    unless risks.is_a?(Array) && !risks.empty?
      errors << "#{path}.risks: 必须是非空数组"
      risks = []
    end
    risks.each_with_index do |risk, risk_index|
      risk_path = "#{path}.risks[#{risk_index}]"
      unless risk.is_a?(Hash)
        errors << "#{risk_path}: 必须是对象"
        next
      end
      require_keys(risk, %w[id condition effect], risk_path, errors)
      check_enum(risk["id"], enum_keys(enums, "risks"), "#{risk_path}.id", errors)
      check_nonempty_text(risk["condition"], "#{risk_path}.condition", errors)
      check_nonempty_text(risk["effect"], "#{risk_path}.effect", errors)
    end

    definition = definition_by_id[target_id]
    next unless definition && source.is_a?(Hash)

    expected_profile_source = case definition["form"]
                              when "placed_entity"
                                definition.dig("placed_profile", "source_item")
                              when "growing_entity"
                                definition.dig("growing_profile", "source_item")
                              when "rights_record"
                                definition.dig("rights_profile", "physical_evidence_item")
                              end
    if expected_profile_source && source["item"] != expected_profile_source
      errors << "#{path}.source.item: 必须与目标形态声明的来源 #{expected_profile_source} 一致"
    end
  end

  duplicate_transition_ids = transition_ids.group_by(&:itself).select { |_id, entries| entries.length > 1 }.keys
  unless duplicate_transition_ids.empty?
    errors << "transitions.c3.yaml.transitions: 重复 ID #{duplicate_transition_ids.join(', ')}"
  end
  duplicate_targets = transition_target_ids.group_by(&:itself).select { |_id, entries| entries.length > 1 }.keys
  unless duplicate_targets.empty?
    errors << "transitions.c3.yaml.transitions: 同一目标被多个入口创建 #{duplicate_targets.join(', ')}"
  end
  missing_targets = noninventory_ids - transition_target_ids
  extra_targets = transition_target_ids - noninventory_ids
  errors << "C3 转换闭合: 缺少目标入口 #{missing_targets.join(', ')}" unless missing_targets.empty?
  errors << "C3 转换闭合: 存在非目录目标 #{extra_targets.join(', ')}" unless extra_targets.empty?

  c3_noninventory_definitions.each_with_index do |definition, index|
    next unless definition.is_a?(Hash)

    transition_id = definition["transition_id"]
    target_transition = transitions.find { |transition| transition.is_a?(Hash) && transition["id"] == transition_id }
    unless target_transition
      errors << "catalog.c3.yaml.non_inventory[#{index}].transition_id: 未定义的转换流程 #{transition_id.inspect}"
      next
    end
    unless target_transition.dig("target", "definition") == definition["id"]
      errors << "catalog.c3.yaml.non_inventory[#{index}].transition_id: 转换目标没有反向指回本定义"
    end
  end

  expected_transition_counts = {
    "deploy" => 6,
    "cultivate" => 4,
    "live_intake" => 8,
    "right_activation" => 6
  }
  expected_transition_counts.each do |kind, expected_count|
    actual_count = transitions.count { |transition| transition.is_a?(Hash) && transition["kind"] == kind }
    unless actual_count == expected_count
      errors << "transitions.c3.yaml.transitions: #{kind} 必须为 #{expected_count} 项，当前为 #{actual_count}"
    end
  end
end

recipe_required = %w[
  id name description status kind resource_chains inputs substitution_policy
  facilities tools qualification effective_time_hours logistics outputs
  byproducts risks
]
recipe_ids = []
expected_produced_by = Hash.new { |hash, key| hash[key] = [] }
expected_used_by = Hash.new { |hash, key| hash[key] = [] }
expected_repair_recipes = Hash.new { |hash, key| hash[key] = [] }
expected_dismantle_recipes = Hash.new { |hash, key| hash[key] = [] }

recipes.each_with_index do |recipe, index|
  path = "recipes[#{index}]"
  unless recipe.is_a?(Hash)
    errors << "#{path}: 必须是对象"
    next
  end

  require_keys(recipe, recipe_required, path, errors)
  id = recipe["id"]
  recipe_ids << id if nonempty_string?(id)
  errors << "#{path}.id: 必须匹配 recipe.<domain>.<name>" unless id.is_a?(String) && id.match?(/\Arecipe\.[a-z0-9_]+\.[a-z0-9_]+\z/)
  check_nonempty_text(recipe["name"], "#{path}.name", errors)
  check_nonempty_text(recipe["description"], "#{path}.description", errors)
  errors << "#{path}.status: 必须为 #{expected_status}" unless recipe["status"] == expected_status
  check_enum(recipe["kind"], enum_keys(enums, "recipe_kinds"), "#{path}.kind", errors)
  check_enum_array(recipe["resource_chains"], enum_keys(enums, "resource_chains"), "#{path}.resource_chains", errors)
  check_enum_array(recipe["facilities"], enum_keys(enums, "facilities"), "#{path}.facilities", errors)
  check_enum_array(recipe["tools"], enum_keys(enums, "tools"), "#{path}.tools", errors)

  lifecycle_kind = %w[repair dismantle].include?(recipe["kind"])
  if lifecycle_kind
    target = recipe["target"]
    if target.is_a?(Hash)
      require_keys(target, %w[item allowed_from result_state target_consumed], "#{path}.target", errors)
      target_id = target["item"]
      errors << "#{path}.target.item: 未定义的物品 #{target_id.inspect}" unless item_id_set[target_id]
      unless c2_item_ids.include?(target_id)
        errors << "#{path}.target.item: C2 生命周期工艺只能指向 C2 物品"
      end
      check_enum_array(target["allowed_from"], enum_keys(enums, "condition_states"), "#{path}.target.allowed_from", errors)
      check_enum(target["result_state"], enum_keys(enums, "condition_states"), "#{path}.target.result_state", errors)
      errors << "#{path}.target.target_consumed: 必须是布尔值" unless [true, false].include?(target["target_consumed"])

      if recipe["kind"] == "repair"
        errors << "#{path}.target.result_state: 维修结果必须为 serviceable" unless target["result_state"] == "serviceable"
        errors << "#{path}.target.target_consumed: 维修不得消耗原实例" unless target["target_consumed"] == false
        expected_repair_recipes[target_id] << id if item_id_set[target_id] && nonempty_string?(id)
      else
        errors << "#{path}.target.result_state: 拆解结果必须为 dismantled" unless target["result_state"] == "dismantled"
        errors << "#{path}.target.target_consumed: 拆解必须消耗原实例" unless target["target_consumed"] == true
        expected_dismantle_recipes[target_id] << id if item_id_set[target_id] && nonempty_string?(id)
      end
    else
      errors << "#{path}.target: repair/dismantle 工艺必须声明目标"
    end
  elsif recipe.key?("target")
    errors << "#{path}.target: 非生命周期工艺不得声明目标"
  end

  inputs = recipe["inputs"]
  if inputs.is_a?(Array) && !inputs.empty?
    input_ids = []
    inputs.each_with_index do |input, input_index|
      input_path = "#{path}.inputs[#{input_index}]"
      unless input.is_a?(Hash)
        errors << "#{input_path}: 必须是对象"
        next
      end
      require_keys(input, %w[item amount consumed], input_path, errors)
      item_id = input["item"]
      input_ids << item_id
      errors << "#{input_path}.item: 未定义的物品 #{item_id.inspect}" unless item_id_set[item_id]
      errors << "#{input_path}.amount: 必须是正数" unless positive_number?(input["amount"])
      errors << "#{input_path}.consumed: 必须是布尔值" unless [true, false].include?(input["consumed"])
      expected_used_by[item_id] << id if item_id_set[item_id] && nonempty_string?(id)
    end
    errors << "#{path}.inputs: 同一物品不得重复列为直接输入" unless input_ids.uniq.length == input_ids.length
  elsif recipe["kind"] == "dismantle" && inputs.is_a?(Array)
    inputs = []
  else
    errors << "#{path}.inputs: 必须是非空数组"
    inputs = []
  end

  substitution = recipe["substitution_policy"]
  if substitution.is_a?(Hash)
    require_keys(substitution, %w[allowed rules], "#{path}.substitution_policy", errors)
    allowed = substitution["allowed"]
    rules = substitution["rules"]
    errors << "#{path}.substitution_policy.allowed: 必须是布尔值" unless [true, false].include?(allowed)
    unless rules.is_a?(Array)
      errors << "#{path}.substitution_policy.rules: 必须是数组"
      rules = []
    end
    errors << "#{path}.substitution_policy.rules: 禁止替代时必须为空" if allowed == false && !rules.empty?
    errors << "#{path}.substitution_policy.rules: 允许替代时不得为空" if allowed == true && rules.empty?

    direct_input_ids = inputs.map { |entry| entry.is_a?(Hash) ? entry["item"] : nil }.compact
    rules.each_with_index do |rule, rule_index|
      rule_path = "#{path}.substitution_policy.rules[#{rule_index}]"
      unless rule.is_a?(Hash)
        errors << "#{rule_path}: 必须是对象"
        next
      end
      require_keys(rule, %w[input alternatives consequence note], rule_path, errors)
      errors << "#{rule_path}.input: 必须引用直接输入" unless direct_input_ids.include?(rule["input"])
      check_enum(rule["consequence"], enum_keys(enums, "substitution_consequences"), "#{rule_path}.consequence", errors)
      check_nonempty_text(rule["note"], "#{rule_path}.note", errors)
      alternatives = rule["alternatives"]
      unless alternatives.is_a?(Array) && !alternatives.empty?
        errors << "#{rule_path}.alternatives: 必须是非空数组"
        next
      end
      alternatives.each_with_index do |alternative, alternative_index|
        alternative_path = "#{rule_path}.alternatives[#{alternative_index}]"
        unless alternative.is_a?(Hash)
          errors << "#{alternative_path}: 必须是对象"
          next
        end
        require_keys(alternative, %w[item ratio], alternative_path, errors)
        alternative_id = alternative["item"]
        errors << "#{alternative_path}.item: 未定义的物品 #{alternative_id.inspect}" unless item_id_set[alternative_id]
        errors << "#{alternative_path}.ratio: 必须是正数" unless positive_number?(alternative["ratio"])
        expected_used_by[alternative_id] << id if item_id_set[alternative_id] && nonempty_string?(id)
      end
    end
  else
    errors << "#{path}.substitution_policy: 必须是对象"
  end

  qualification = recipe["qualification"]
  if qualification.is_a?(Hash)
    require_keys(qualification, %w[minimum_role skill specialty missing_effect], "#{path}.qualification", errors)
    check_enum(qualification["minimum_role"], enum_keys(enums, "roles"), "#{path}.qualification.minimum_role", errors)
    check_enum(qualification["skill"], enum_keys(enums, "skills"), "#{path}.qualification.skill", errors)
    check_enum(qualification["specialty"], enum_keys(enums, "specialties"), "#{path}.qualification.specialty", errors)
    check_enum(qualification["missing_effect"], enum_keys(enums, "missing_effects"), "#{path}.qualification.missing_effect", errors)
  else
    errors << "#{path}.qualification: 必须是对象"
  end

  check_range(recipe["effective_time_hours"], "#{path}.effective_time_hours", errors)

  logistics = recipe["logistics"]
  if logistics.is_a?(Hash)
    require_keys(logistics, %w[input_staging output_storage], "#{path}.logistics", errors)
    check_nonempty_text(logistics["input_staging"], "#{path}.logistics.input_staging", errors)
    check_nonempty_text(logistics["output_storage"], "#{path}.logistics.output_storage", errors)
  else
    errors << "#{path}.logistics: 必须是对象"
  end

  outputs = recipe["outputs"]
  if outputs.is_a?(Array) && !outputs.empty?
    outputs.each_with_index do |output, output_index|
      output_path = "#{path}.outputs[#{output_index}]"
      unless output.is_a?(Hash)
        errors << "#{output_path}: 必须是对象"
        next
      end
      require_keys(output, %w[item min max], output_path, errors)
      item_id = output["item"]
      errors << "#{output_path}.item: 未定义的物品 #{item_id.inspect}" unless item_id_set[item_id]
      check_range(output, output_path, errors)
      expected_produced_by[item_id] << id if item_id_set[item_id] && nonempty_string?(id)
    end
  elsif recipe["kind"] == "repair" && outputs.is_a?(Array)
    # 维修保留原实例，只改变状态，因此不得生成新的物品实例。
  else
    errors << "#{path}.outputs: 必须是非空数组"
  end
  if recipe["kind"] == "repair" && outputs.is_a?(Array) && !outputs.empty?
    errors << "#{path}.outputs: 维修工艺必须为空，原实例通过 target 保留"
  end

  byproducts = recipe["byproducts"]
  unless byproducts.is_a?(Array)
    errors << "#{path}.byproducts: 必须是数组"
    byproducts = []
  end
  byproducts.each_with_index do |byproduct, byproduct_index|
    byproduct_path = "#{path}.byproducts[#{byproduct_index}]"
    unless byproduct.is_a?(Hash)
      errors << "#{byproduct_path}: 必须是对象"
      next
    end
    check_enum(byproduct["type"], %w[item burden], "#{byproduct_path}.type", errors)
    check_range(byproduct, byproduct_path, errors)
    if byproduct["type"] == "item"
      item_id = byproduct["item"]
      errors << "#{byproduct_path}.item: 未定义的物品 #{item_id.inspect}" unless item_id_set[item_id]
      expected_produced_by[item_id] << id if item_id_set[item_id] && nonempty_string?(id)
    elsif byproduct["type"] == "burden"
      check_enum(byproduct["burden"], enum_keys(enums, "burdens"), "#{byproduct_path}.burden", errors)
    end
  end

  risks = recipe["risks"]
  unless risks.is_a?(Array) && !risks.empty?
    errors << "#{path}.risks: 必须是非空数组"
    risks = []
  end
  risks.each_with_index do |risk, risk_index|
    risk_path = "#{path}.risks[#{risk_index}]"
    unless risk.is_a?(Hash)
      errors << "#{risk_path}: 必须是对象"
      next
    end
    require_keys(risk, %w[id condition effect], risk_path, errors)
    check_enum(risk["id"], enum_keys(enums, "risks"), "#{risk_path}.id", errors)
    check_nonempty_text(risk["condition"], "#{risk_path}.condition", errors)
    check_nonempty_text(risk["effect"], "#{risk_path}.effect", errors)
  end
end

duplicate_recipe_ids = recipe_ids.group_by(&:itself).select { |_id, entries| entries.length > 1 }.keys
errors << "recipes.seed.yaml.recipes: 重复 ID #{duplicate_recipe_ids.join(', ')}" unless duplicate_recipe_ids.empty?
recipe_id_set = recipe_ids.to_h { |id| [id, true] }

items.each_with_index do |item, index|
  next unless item.is_a?(Hash) && item["interfaces"].is_a?(Hash)

  path = "items[#{index}].interfaces"
  %w[produced_by used_by repair_recipes dismantle_recipes].each do |field|
    Array(item["interfaces"][field]).each do |recipe_id|
      errors << "#{path}.#{field}: 未定义的工艺 #{recipe_id}" unless recipe_id_set[recipe_id]
    end
  end

  item_id = item["id"]
  actual_produced = Array(item["interfaces"]["produced_by"]).sort
  actual_used = Array(item["interfaces"]["used_by"]).sort
  actual_repairs = Array(item["interfaces"]["repair_recipes"]).sort
  actual_dismantles = Array(item["interfaces"]["dismantle_recipes"]).sort
  expected_produced = expected_produced_by[item_id].uniq.sort
  expected_used = expected_used_by[item_id].uniq.sort
  expected_repairs = expected_repair_recipes[item_id].uniq.sort
  expected_dismantles = expected_dismantle_recipes[item_id].uniq.sort
  unless actual_produced == expected_produced
    errors << "#{path}.produced_by: 应为 #{expected_produced.inspect}，当前为 #{actual_produced.inspect}"
  end
  unless actual_used == expected_used
    errors << "#{path}.used_by: 应为 #{expected_used.inspect}，当前为 #{actual_used.inspect}"
  end
  unless actual_repairs == expected_repairs
    errors << "#{path}.repair_recipes: 应为 #{expected_repairs.inspect}，当前为 #{actual_repairs.inspect}"
  end
  unless actual_dismantles == expected_dismantles
    errors << "#{path}.dismantle_recipes: 应为 #{expected_dismantles.inspect}，当前为 #{actual_dismantles.inspect}"
  end
end

coverage_definitions = include_c3 ? catalog_definitions : items
enum_keys(enums, "resource_chains").each do |chain|
  count = coverage_definitions.count do |definition|
    definition.is_a?(Hash) && Array(definition["resource_chains"]).include?(chain)
  end
  errors << "覆盖约束: 资源主链 #{chain} 没有任何物品" if count.zero?
end
if profile == "c2"
  covered_categories = enum_keys(enums, "categories").count do |category|
    items.any? { |item| item.is_a?(Hash) && item["category"] == category }
  end
  errors << "覆盖约束: C2 一级分类至少覆盖 17/18，当前为 #{covered_categories}/18" if covered_categories < 17
elsif include_c3
  covered_categories = enum_keys(enums, "categories").count do |category|
    catalog_definitions.any? { |definition| definition.is_a?(Hash) && definition["category"] == category }
  end
  covered_forms = enum_keys(enums, "forms").count do |form|
    catalog_definitions.any? { |definition| definition.is_a?(Hash) && definition["form"] == form }
  end
  errors << "覆盖约束: #{profile.upcase} 一级分类必须覆盖 18/18，当前为 #{covered_categories}/18" unless covered_categories == 18
  errors << "覆盖约束: #{profile.upcase} 存在形态必须覆盖 6/6，当前为 #{covered_forms}/6" unless covered_forms == 6
  if profile == "c4"
    category_counts = enum_keys(enums, "categories").to_h do |category|
      [category, catalog_definitions.count { |definition| definition["category"] == category }]
    end
    material_energy_byproduct_count = category_counts["material"] + category_counts["byproduct_and_waste"]
    component_tool_electronic_count = (
      category_counts["component"] + category_counts["tool"] + category_counts["electronic_device"]
    )
    unless material_energy_byproduct_count == 36
      errors << "C4 R1 配额: 材料、能源与副产物必须为 36，当前为 #{material_energy_byproduct_count}"
    end
    unless component_tool_electronic_count == 12
      errors << "C4 R1 配额: 零部件、工具与电子用具必须为 12，当前为 #{component_tool_electronic_count}"
    end
  elsif profile == "c5"
    category_counts = enum_keys(enums, "categories").to_h do |category|
      [category, catalog_definitions.count { |definition| definition["category"] == category }]
    end
    material_energy_byproduct_count = category_counts["material"] + category_counts["byproduct_and_waste"]
    component_tool_electronic_count = (
      category_counts["component"] + category_counts["tool"] + category_counts["electronic_device"]
    )
    food_medical_count = category_counts["food_and_drink"] + category_counts["medicine_and_medical_supply"]
    unless material_energy_byproduct_count == 36
      errors << "C5 R1 配额: 材料、能源与副产物必须保持 36，当前为 #{material_energy_byproduct_count}"
    end
    unless component_tool_electronic_count == 28
      errors << "C5 R1 配额: 零部件、工具与电子用具必须为 28，当前为 #{component_tool_electronic_count}"
    end
    unless food_medical_count == 20
      errors << "C5 R1 配额: 食品、饮料、药品与医疗用品必须为 20，当前为 #{food_medical_count}"
    end
  elsif profile == "c6"
    category_counts = enum_keys(enums, "categories").to_h do |category|
      [category, catalog_definitions.count { |definition| definition["category"] == category }]
    end
    food_medical_count = category_counts["food_and_drink"] + category_counts["medicine_and_medical_supply"]
    book_document_count = category_counts["book_and_data"] + category_counts["document_and_credential"]
    errors << "C6 R1 配额: 食品医疗必须为 28，当前为 #{food_medical_count}" unless food_medical_count == 28
    errors << "C6 R1 配额: 武器弹药必须为 24，当前为 #{category_counts['weapon_and_ammunition']}" unless category_counts["weapon_and_ammunition"] == 24
    errors << "C6 R1 配额: 植物种源必须为 12，当前为 #{category_counts['plant_and_seed']}" unless category_counts["plant_and_seed"] == 12
    errors << "C6 R1 配额: 书籍文件必须为 16，当前为 #{book_document_count}" unless book_document_count == 16
  elsif profile == "c7"
    category_counts = enum_keys(enums, "categories").to_h do |category|
      [category, catalog_definitions.count { |definition| definition["category"] == category }]
    end
    final_quota_groups = {
      "材料、能源与副产物" => [36, category_counts["material"] + category_counts["byproduct_and_waste"]],
      "零部件、工具与电子用具" => [28, category_counts["component"] + category_counts["tool"] + category_counts["electronic_device"]],
      "食品、饮料、药品与医疗用品" => [28, category_counts["food_and_drink"] + category_counts["medicine_and_medical_supply"]],
      "武器与弹药" => [24, category_counts["weapon_and_ammunition"]],
      "防具与服饰" => [24, category_counts["armor_and_clothing"]],
      "书籍、数据载体、文件与凭证" => [16, category_counts["book_and_data"] + category_counts["document_and_credential"]],
      "家具、日用品、装饰与珠宝" => [32, category_counts["furniture"] + category_counts["daily_supply"] + category_counts["decoration_and_instrument"] + category_counts["jewelry_and_valuable"]],
      "植物与种源" => [12, category_counts["plant_and_seed"]],
      "伙伴与役用动物" => [8, category_counts["companion_and_work_animal"]],
      "稀有与特殊物品" => [12, category_counts["rare_and_special"]]
    }
    final_quota_groups.each do |label, values|
      target, current = values
      errors << "C7 R1 配额: #{label} 必须为 #{target}，当前为 #{current}" unless current == target
    end
  end
end

def render_report(items, recipes, catalog_definitions, transitions, enums, expected_sha, profile)
  has_noninventory = %w[c3 c4 c5 c6 c7].include?(profile)
  coverage_definitions = has_noninventory ? catalog_definitions : items
  category_counts = enum_keys(enums, "categories").to_h do |category|
    [category, coverage_definitions.count { |definition| definition["category"] == category }]
  end
  form_counts = enum_keys(enums, "forms").to_h do |form|
    [form, coverage_definitions.count { |definition| definition["form"] == form }]
  end
  chain_counts = enum_keys(enums, "resource_chains").to_h do |chain|
    [chain, coverage_definitions.count { |definition| Array(definition["resource_chains"]).include?(chain) }]
  end
  recipe_kind_counts = enum_keys(enums, "recipe_kinds").to_h do |kind|
    [kind, recipes.count { |recipe| recipe["kind"] == kind }]
  end
  transition_kind_counts = enum_keys(enums, "transition_kinds").to_h do |kind|
    [kind, transitions.count { |transition| transition["kind"] == kind }]
  end

  groups = {
    "农业与食品" => %w[recipe.agriculture. recipe.food.],
    "金属回收与维修/防护" => %w[recipe.metal.],
    "纺织与医疗/服饰" => %w[recipe.textile.],
    "基础化学与卫生/医疗" => %w[recipe.hygiene. recipe.chemistry. recipe.medical.],
    "电气与通信" => %w[recipe.electrical.]
  }
  if %w[c2 c3 c4 c5 c6 c7].include?(profile)
    groups["C2 装备与家具装配"] = %w[recipe.c2_assembly.]
    groups["C2 维修"] = %w[recipe.repair.]
    groups["C2 拆解与回收"] = %w[recipe.dismantle.]
  end
  if %w[c4 c5 c6 c7].include?(profile)
    groups["C4 木材与固体燃料"] = %w[recipe.c4_wood.]
    groups["C4 液体燃料"] = %w[recipe.c4_energy.]
    groups["C4 有色金属"] = %w[recipe.c4_nonferrous.]
    groups["C4 玻璃"] = %w[recipe.c4_glass.]
    groups["C4 砖灰砂浆"] = %w[recipe.c4_masonry.]
    groups["C4 橡胶"] = %w[recipe.c4_rubber.]
    groups["C4 过滤"] = %w[recipe.c4_filter.]
    groups["C4 电池"] = %w[recipe.c4_battery.]
  end
  if %w[c5 c6 c7].include?(profile)
    groups["C5 电气与机械组件"] = %w[recipe.c5_component.]
    groups["C5 工具装配"] = %w[recipe.c5_tool.]
    groups["C5 电子设备装配"] = %w[recipe.c5_electronic.]
    groups["C5 食品加工"] = %w[recipe.c5_food.]
    groups["C5 医疗加工"] = %w[recipe.c5_medical.]
  end
  if %w[c6 c7].include?(profile)
    groups["C6 食品加工"] = %w[recipe.c6_food.]
    groups["C6 医疗加工"] = %w[recipe.c6_medical.]
    groups["C6 低技术武器"] = %w[recipe.c6_weapon.]
    groups["C6 箭矢与训练耗材"] = %w[recipe.c6_ammo.]
  end
  if profile == "c7"
    groups["C7 服饰与防护"] = %w[recipe.c7_clothing.]
    groups["C7 家具"] = %w[recipe.c7_furniture.]
    groups["C7 日用品"] = %w[recipe.c7_daily.]
    groups["C7 装饰"] = %w[recipe.c7_decoration.]
  end

  multi_chain_count = coverage_definitions.count { |definition| Array(definition["resource_chains"]).length > 1 }
  intermediate_count = items.count do |item|
    interfaces = item["interfaces"] || {}
    !Array(interfaces["produced_by"]).empty? && !Array(interfaces["used_by"]).empty?
  end
  substitution_count = recipes.count { |recipe| recipe.dig("substitution_policy", "allowed") == true }
  inventory_byproduct_edges = recipes.sum do |recipe|
    Array(recipe["byproducts"]).count { |byproduct| byproduct["type"] == "item" }
  end
  repair_count = recipes.count { |recipe| recipe["kind"] == "repair" }
  dismantle_count = recipes.count { |recipe| recipe["kind"] == "dismantle" }

  lines = []
  title = case profile
          when "c2" then "# 候选物品库 C2 累计覆盖报告"
          when "c3" then "# 候选物品库 C3 累计覆盖报告"
          when "c4" then "# 候选物品库 C4 累计覆盖报告"
          when "c5" then "# 候选物品库 C5 累计覆盖报告"
          when "c6" then "# 候选物品库 C6 累计覆盖报告"
          when "c7" then "# 候选物品库 C7 累计覆盖报告"
          else "# 候选物品库覆盖报告"
          end
  lines << title
  lines << ""
  lines << "**生成来源：** `scripts/validate_item_library.rb`"
  lines << "**校验档位：** `#{profile}`"
  lines << "**数据状态：** `candidate_only`"
  lines << "**运行时授权：** 无"
  lines << "**上位设计 SHA-256：** `#{expected_sha}`"
  lines << ""
  lines << "> 本报告只证明候选数据通过结构、词表、引用与覆盖校验；不代表数值平衡、运行时实现、Gate 或真人测试通过。"
  lines << ""
  lines << "## 汇总"
  lines << ""
  lines << "| 指标 | 结果 |"
  lines << "|---|---:|"
  if has_noninventory
    noninventory_count = catalog_definitions.count do |definition|
      %w[placed_entity growing_entity character_entity rights_record].include?(definition["form"])
    end
    lines << "| 可库存物品 | #{items.length} |"
    lines << "| 非库存实体/记录 | #{noninventory_count} |"
    lines << "| 累计目录定义 | #{catalog_definitions.length} |"
    lines << "| 制造/维修/拆解工艺 | #{recipes.length} |"
    lines << "| 形态转换流程 | #{transitions.length} |"
  else
    lines << "| 候选物品 | #{items.length} |"
    lines << "| 代表工艺 | #{recipes.length} |"
  end
  lines << "| 已覆盖一级分类 | #{category_counts.values.count(&:positive?)} / #{category_counts.length} |"
  lines << "| 已覆盖存在形态 | #{form_counts.values.count(&:positive?)} / #{form_counts.length} |"
  lines << (has_noninventory ? "| 跨多条资源主链目录定义 | #{multi_chain_count} |" : "| 跨多条资源主链物品 | #{multi_chain_count} |")
  lines << "| 同时作为工艺产出与输入的中间品 | #{intermediate_count} |"
  lines << "| 显式允许替代的工艺 | #{substitution_count} |"
  lines << "| 库存型副产物引用 | #{inventory_byproduct_edges} |"
  lines << "| 维修工艺 | #{repair_count} |"
  lines << "| 拆解工艺 | #{dismantle_count} |"
  lines << ""
  content_chain_heading = if profile == "c1"
                            "## 五条首批交叉链"
                          elsif profile == "c3"
                            "## C1+C2 制造内容链"
                          elsif profile == "c4"
                            "## C1–C4 制造内容链"
                          elsif profile == "c5"
                            "## C1–C5 制造内容链"
                          elsif profile == "c6"
                            "## C1–C6 制造内容链"
                          elsif profile == "c7"
                            "## C1–C7 制造内容链"
                          else
                            "## C1+C2 内容链"
                          end
  lines << content_chain_heading
  lines << ""
  lines << "| 交叉链 | 代表工艺数 |"
  lines << "|---|---:|"
  groups.each do |label, prefixes|
    count = recipes.count { |recipe| prefixes.any? { |prefix| recipe["id"].start_with?(prefix) } }
    lines << "| #{label} | #{count} |"
  end
  lines << ""
  if profile == "c2"
    lines << "八组内容链共计覆盖全部 #{recipes.length} 个代表工艺。C2 通过同一批金属、织物、清洁、电气材料和人物有效时间，把新装备、家具与 C1 生产网络相连；这仍不构成完整科技树。"
  elsif profile == "c3"
    lines << "八组内容链继续覆盖全部 #{recipes.length} 个制造、维修与拆解工艺。C3 的 24 个转换流程单独计数，不伪装成新增制造工艺。"
  elsif profile == "c4"
    lines << "十六组内容链覆盖全部 #{recipes.length} 个制造、维修与拆解工艺。C4 新工艺连接木材、燃料、金属、玻璃、砌筑、橡胶、过滤和电池，24 个形态转换流程继续单独计数。"
  elsif profile == "c5"
    lines << "二十一组内容链覆盖全部 #{recipes.length} 个制造、维修与拆解工艺。C5 新工艺连接组件、工具、离线电子、食品保存和基础医疗，24 个形态转换流程继续单独计数。"
  elsif profile == "c6"
    lines << "二十五组内容链覆盖全部 #{recipes.length} 个制造、维修与拆解工艺。C6 只为食品医疗和低技术武器训练耗材新增工艺，受控枪械与弹药保持外部来源，24 个形态转换流程继续单独计数。"
  elsif profile == "c7"
    lines << "二十九组内容链覆盖全部 #{recipes.length} 个制造、维修与拆解工艺。C7 只新增基础服饰、防护、家具、日用品与装饰候选工艺，受控防护和稀有物品保持外部来源，24 个形态转换流程继续单独计数。"
  else
    lines << "五条交叉链共计覆盖全部 #{recipes.length} 个代表工艺。它们通过洁净水、金属板、紧固件、织物、工业酒精和人物有效时间等共享瓶颈连接，不构成完整科技树。"
  end
  lines << ""
  lines << "## 四条资源主链"
  lines << ""
  lines << (has_noninventory ? "| 主链 ID | 名称 | 目录定义数 |" : "| 主链 ID | 名称 | 物品数 |")
  lines << "|---|---|---:|"
  chain_counts.each do |chain, count|
    lines << "| `#{chain}` | #{enums["resource_chains"][chain]} | #{count} |"
  end
  lines << ""
  if has_noninventory
    lines << "同一目录定义映射到多条主链表示潜在用途；非库存实体不产生第二份库存，同一库存来源也不得重复承诺。"
  else
    lines << "同一物品映射到多条主链表示潜在用途，不允许重复计算库存。"
  end
  lines << ""
  lines << "## 一级分类覆盖"
  lines << ""
  lines << (has_noninventory ? "| 分类 ID | 名称 | 目录定义数 | 状态 |" : "| 分类 ID | 名称 | 物品数 | 状态 |")
  lines << "|---|---|---:|---|"
  category_counts.each do |category, count|
    status = count.positive? ? (%w[c2 c3 c4 c5 c6 c7].include?(profile) ? "累计已覆盖" : "首批已覆盖") : "本轮暂未覆盖"
    lines << "| `#{category}` | #{enums["categories"][category]} | #{count} | #{status} |"
  end
  lines << ""
  missing_categories = category_counts.select { |_category, count| count.zero? }.keys
  missing_labels = missing_categories.map { |category| enums["categories"][category] }
  if missing_labels.empty?
    lines << "当前一级分类均已有候选样本；这不表示任何整组内容获得运行时导入授权。"
  else
    lines << "暂未覆盖不表示分类被删除。当前未覆盖：#{missing_labels.join('、')}。这些内容留待相应玩法临近验证阶段再编写，避免制造虚假完整度。"
  end
  lines << ""
  if %w[c4 c5 c6 c7].include?(profile)
    quota_groups = {
      "材料、能源与副产物" => [36, category_counts["material"] + category_counts["byproduct_and_waste"]],
      "零部件、工具与电子用具" => [28, category_counts["component"] + category_counts["tool"] + category_counts["electronic_device"]],
      "食品、饮料、药品与医疗用品" => [28, category_counts["food_and_drink"] + category_counts["medicine_and_medical_supply"]],
      "武器与弹药" => [24, category_counts["weapon_and_ammunition"]],
      "防具与服饰" => [24, category_counts["armor_and_clothing"]],
      "书籍、数据载体、文件与凭证" => [16, category_counts["book_and_data"] + category_counts["document_and_credential"]],
      "家具、日用品、装饰与珠宝" => [32, category_counts["furniture"] + category_counts["daily_supply"] + category_counts["decoration_and_instrument"] + category_counts["jewelry_and_valuable"]],
      "植物与种源" => [12, category_counts["plant_and_seed"]],
      "伙伴与役用动物" => [8, category_counts["companion_and_work_animal"]],
      "稀有与特殊物品" => [12, category_counts["rare_and_special"]]
    }
    lines << "## R1 内容组配额"
    lines << ""
    lines << "| 内容组 | 目标 | 当前 | 剩余 |"
    lines << "|---|---:|---:|---:|"
    quota_groups.each do |label, values|
      target, current = values
      lines << "| #{label} | #{target} | #{current} | #{target - current} |"
    end
    lines << ""
    if profile == "c4"
      lines << "C4 已补足“材料、能源与副产物”36/36；其他剩余配额继续按 220 项内容计划进入 C5–C7。"
    elsif profile == "c5"
      lines << "C5 已补足“零部件、工具与电子用具”28/28，并把“食品、饮料、药品与医疗用品”推进到 20/28；剩余配额继续按 220 项内容计划进入 C6–C7。"
    elsif profile == "c6"
      lines << "C6 已补足食品医疗 28/28、武器弹药 24/24、植物种源 12/12和书籍文件 16/16；剩余配额全部进入 C7。"
    else
      lines << "C7 已补足防具服饰 24/24、家具日用装饰珠宝 32/32和稀有特殊 12/12；十个 R1 内容组剩余均为 0。"
    end
    lines << ""
  end
  lines << "## 存在形态覆盖"
  lines << ""
  lines << (has_noninventory ? "| 形态 ID | 名称 | 目录定义数 | 状态 |" : "| 形态 ID | 名称 | 物品数 | 状态 |")
  lines << "|---|---|---:|---|"
  form_counts.each do |form, count|
    status = count.positive? ? (%w[c2 c3 c4 c5 c6 c7].include?(profile) ? "累计已覆盖" : "首批已覆盖") : "需先升级形态专用合同"
    lines << "| `#{form}` | #{enums["forms"][form]} | #{count} | #{status} |"
  end
  lines << ""
  if has_noninventory
    lines << "C3 已为四种非库存形态建立专用字段和一一对应的入口流程。形态覆盖只证明静态边界闭合，不表示地图、作物、动物或权利运行时已经实现。"
  else
    lines << "当前仍只验证可库存的批量物资与独立物品。家具与凭证只声明向放置实体或权利记录的转换入口；放置、生长、角色和权利记录本体不得在没有专用字段与校验规则时直接追加。"
  end
  lines << ""
  lines << "## 工艺类型覆盖"
  lines << ""
  lines << "| 类型 ID | 名称 | 工艺数 |"
  lines << "|---|---|---:|"
  recipe_kind_counts.each do |kind, count|
    lines << "| `#{kind}` | #{enums["recipe_kinds"][kind]} | #{count} |"
  end
  lines << ""
  if has_noninventory
    lines << "## 形态转换流程"
    lines << ""
    lines << "| 类型 ID | 名称 | 流程数 |"
    lines << "|---|---|---:|"
    transition_kind_counts.each do |kind, count|
      lines << "| `#{kind}` | #{enums["transition_kinds"][kind]} | #{count} |"
    end
    lines << ""
    lines << "部署、栽培、活体接收与权利激活分别连接库存或外部交接、人物有效时间、设施、工具、物流、回滚和风险；它们不计入制造配方。"
    lines << ""
  end
  lines << "## 明确未完成"
  lines << ""
  lines << "- 约 220 项完整候选内容库尚未编写；" unless has_noninventory
  if profile == "c2"
    lines << "- 当前只有 6 个维修与 6 个拆解代表工艺，不是完整维护网络；"
    lines << "- 伙伴动物仍无候选样本，放置、生长、角色和权利记录本体仍未定义；"
  elsif profile == "c3"
    lines << "- 当前只有 90 个累计目录定义，距离约 220 项目标仍有 130 项；"
    lines << "- 24 个非库存定义只有静态职责与入口流程，没有运行时对象、UI 或存档；"
    lines << "- 动物需求、训练、繁殖、战斗参与和复杂关系系统未冻结；"
    lines << "- 作物季节、精确产量、品质与完整生长模拟未冻结；"
    lines << "- 权利法域、自动执行、争议裁决和正式声望公式未冻结；"
  elsif profile == "c4"
    lines << "- 当前有 120 个累计目录定义，距离 220 项目标仍有 100 项；"
    lines << "- 手摇泵、万用表、滤芯和电池模块只有候选接口，没有运行时能力数值；"
    lines << "- 发电、燃料调度、管网、电网、过滤容量和环境模拟未冻结；"
    lines << "- C3 的植物、动物、放置实体和权利记录仍没有运行时对象；"
  elsif profile == "c5"
    lines << "- 当前有 150 个累计目录定义，距离 220 项目标仍有 70 项；"
    lines << "- 食品营养、精确保质期、自动配餐和自动补货未冻结；"
    lines << "- 药物剂量、治疗概率、伤病模型和自动诊疗未冻结；"
    lines << "- 工具效率、通信距离、灯具亮度、终端容量和设备部署效果未冻结；"
    lines << "- C3 的植物、动物、放置实体和权利记录仍没有运行时对象；"
  elsif profile == "c6"
    lines << "- 当前有 180 个累计目录定义，距离 220 项目标仍有 40 项；"
    lines << "- 枪械、受控弹药和烟雾标记只有外部来源，不定义制造工艺；"
    lines << "- 伤害、命中、射程、装药、战斗和弹药制造模拟未冻结；"
    lines << "- 新种源没有生长实体，书籍没有学习系统，文件没有新增权利记录；"
    lines << "- C3 的植物、动物、放置实体和权利记录仍没有运行时对象；"
  elsif profile == "c7"
    lines << "- 220 项候选目录只达到静态内容覆盖，不代表整组运行时可用；"
    lines << "- 防护角色和覆盖部位不包含护甲值、伤害减免、装备槽或环境数值；"
    lines << "- 稀有设备没有自动解锁复制、联网、诊断、工艺或战斗能力；"
    lines << "- 新家具没有新增放置实体，装饰、珠宝和个人物品没有心情或关系公式；"
    lines << "- C3 的植物、动物、放置实体和权利记录仍没有运行时对象；"
  else
    lines << "- 维修、拆解、维护、自动补货、武器弹药、伙伴动物和权利记录工艺尚未定义；"
  end
  lines << "- 品质曲线、正式货币、设施数值、战斗与护甲数值尚未冻结；"
  lines << "- 数据尚未接入任何运行时导入器；"
  lines << "- Gate 1A、Gate 1H 与 Gate 2 状态不因本报告改变。"
  lines << ""
  lines.join("\n")
end

if errors.any?
  warn "ITEM_LIBRARY_VALIDATION=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

report = render_report(items, recipes, catalog_definitions, transitions, enums, expected_sha, profile)
bundle = if profile == "c7"
           render_candidate_bundle(items, c3_noninventory_definitions, recipes, transitions, enums, expected_sha)
         end

if write_report
  File.write(report_path, report)
  puts "COVERAGE_REPORT=WRITTEN #{report_path}"
else
  unless File.exist?(report_path)
    warn "ITEM_LIBRARY_VALIDATION=FAIL"
    warn "- #{File.basename(report_path)} 不存在；先使用对应 profile 运行 --write-report"
    exit 1
  end
  unless File.read(report_path) == report
    warn "ITEM_LIBRARY_VALIDATION=FAIL"
    warn "- #{File.basename(report_path)} 已过期；使用对应 profile 运行 --write-report"
    exit 1
  end
end

if profile == "c7"
  if write_bundle
    File.write(CANDIDATE_BUNDLE_PATH, bundle)
    puts "CANDIDATE_BUNDLE=WRITTEN #{CANDIDATE_BUNDLE_PATH}"
  else
    unless File.exist?(CANDIDATE_BUNDLE_PATH)
      warn "ITEM_LIBRARY_VALIDATION=FAIL"
      warn "- #{File.basename(CANDIDATE_BUNDLE_PATH)} 不存在；使用 --profile c7 --write-bundle 生成"
      exit 1
    end
    unless File.read(CANDIDATE_BUNDLE_PATH) == bundle
      warn "ITEM_LIBRARY_VALIDATION=FAIL"
      warn "- #{File.basename(CANDIDATE_BUNDLE_PATH)} 已过期；使用 --profile c7 --write-bundle 刷新"
      exit 1
    end
  end
end

puts "ITEM_LIBRARY_VALIDATION=PASS"
puts "PROFILE=#{profile}"
puts "ITEM_COUNT=#{items.length}"
puts "RECIPE_COUNT=#{recipes.length}"
if %w[c3 c4 c5 c6 c7].include?(profile)
  puts "NON_INVENTORY_DEFINITION_COUNT=#{c3_noninventory_definitions.length}"
  puts "CATALOG_DEFINITION_COUNT=#{catalog_definitions.length}"
  puts "TRANSITION_COUNT=#{transitions.length}"
end
puts "RUNTIME_AUTHORIZATION=NONE"
