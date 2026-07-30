#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "set"

ROOT = File.expand_path("..", __dir__)
BUNDLE_PATH = File.join(ROOT, "data/item-library/item-library-r1-candidate-bundle.json")
JSON_REPORT_PATH = File.join(ROOT, "data/item-library/semantic-audit-r2a.json")
MARKDOWN_REPORT_PATH = File.join(ROOT, "data/item-library/semantic-audit-r2a.md")
CONTRACT_PATH = File.join(ROOT, "docs/item-library/item-library-semantic-audit-contract-v0.1.md")

PASSIVE_ACTIONS = %w[reserve trade deliver store inspect].freeze
WARNING_ADJUDICATIONS = {
  "item.rare.offline_sensor_core" => {
    "disposition" => "defer_until_relevant_gate",
    "rationale" => "条目只保留未来离线诊断或预警升级潜力；当前添加结构化入口会越过对应玩法与运行时授权。"
  },
  "item.ammunition.training_blank_batch" => {
    "disposition" => "bind_platform_on_selection",
    "rationale" => "当前 ammo_family=blank 没有对应平台；未来选择时必须绑定兼容平台并细化口径，或拒绝导入。"
  }
}.freeze
PROFILE_INPUT_KEYS = %w[
  source_item
  ongoing_input_items
  care_input_items
  upkeep_items
  physical_evidence_item
].freeze
PROFILE_OUTPUT_KEYS = %w[harvest_output_items].freeze

def parse_arguments(argv)
  options = { write: false, select: nil }
  index = 0

  while index < argv.length
    case argv[index]
    when "--write"
      options[:write] = true
    when "--select"
      index += 1
      abort "SEMANTIC_AUDIT=FAIL\n- --select 缺少稳定 ID 列表" if index >= argv.length
      options[:select] = argv[index].split(",").map(&:strip).reject(&:empty?).uniq.sort
    else
      abort "SEMANTIC_AUDIT=FAIL\n- 未知参数 #{argv[index]}"
    end
    index += 1
  end

  abort "SEMANTIC_AUDIT=FAIL\n- --write 与 --select 不能同时使用" if options[:write] && options[:select]
  options
end

def present?(value)
  case value
  when String
    !value.strip.empty?
  when Array, Hash
    !value.empty?
  else
    !value.nil?
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

def item_references(value)
  case value
  when String
    value.start_with?("item.") ? [value] : []
  when Array
    value.flat_map { |entry| item_references(entry) }
  else
    []
  end
end

def profile_item_links(definition)
  inputs = []
  outputs = []

  definition.each do |key, value|
    next unless key.end_with?("_profile") && value.is_a?(Hash)

    PROFILE_INPUT_KEYS.each do |profile_key|
      inputs.concat(item_references(value[profile_key])) if value.key?(profile_key)
    end
    PROFILE_OUTPUT_KEYS.each do |profile_key|
      outputs.concat(item_references(value[profile_key])) if value.key?(profile_key)
    end
  end

  { inputs: inputs.uniq.sort, outputs: outputs.uniq.sort }
end

def recipe_item_ids(recipe, key)
  recipe.fetch(key, []).map { |entry| entry["item"] }.compact.uniq.sort
end

def recipe_target_item(recipe)
  recipe.dig("target", "item")
end

def recipe_substitute_item_ids(recipe)
  recipe
    .dig("substitution_policy", "rules")
    .to_a
    .flat_map { |rule| rule.fetch("alternatives", []).map { |alternative| alternative["item"] } }
    .compact
    .uniq
    .sort
end

def add_edge(edges, from, to, type)
  return unless present?(from) && present?(to)

  edges << { "from" => from, "to" => to, "type" => type }
end

def duplicate_groups(records, field)
  records
    .group_by { |record| record[field].to_s.strip }
    .select { |text, group| !text.empty? && group.length > 1 }
    .map { |text, group| { "text" => text, "ids" => group.map { |record| record["id"] }.sort } }
    .sort_by { |entry| entry["ids"] }
end

def connected_components(node_ids, edges)
  adjacency = node_ids.to_h { |id| [id, Set.new] }
  edges.each do |edge|
    adjacency[edge["from"]] << edge["to"]
    adjacency[edge["to"]] << edge["from"]
  end

  unseen = Set.new(node_ids)
  components = []

  until unseen.empty?
    root = unseen.min
    queue = [root]
    component = []
    unseen.delete(root)

    until queue.empty?
      node = queue.shift
      component << node
      adjacency.fetch(node).sort.each do |neighbor|
        next unless unseen.delete?(neighbor)

        queue << neighbor
      end
    end

    components << component.sort
  end

  components.sort_by { |component| [-component.length, component.first] }
end

def build_markdown(report)
  counts = report.fetch("counts")
  graph = report.fetch("graph")
  equipment = report.fetch("equipment_compatibility")
  audit = report.fetch("audit")
  classes = audit.fetch("inventory_classification_counts")
  warning_rows = audit.fetch("warnings")
  direct_use = audit.fetch("direct_use_only_items")

  lines = []
  lines << "# 候选物品库 R2-A 语义审计与依赖闭包报告"
  lines << ""
  lines << "**来源基线：** `#{report.fetch("source_baseline_id")}`"
  lines << "**来源 Payload SHA-256：** `#{report.fetch("source_payload_sha256")}`"
  lines << "**审计合同 SHA-256：** `#{report.fetch("source_files").fetch("docs/item-library/item-library-semantic-audit-contract-v0.1.md")}`"
  lines << "**审计工具 SHA-256：** `#{report.fetch("source_files").fetch("scripts/audit_item_library_semantics.rb")}`"
  lines << "**状态：** `#{report.fetch("status")}`"
  lines << "**运行时授权：** `#{report.fetch("runtime_authorization")}`"
  lines << "**审计 SHA-256：** `#{report.fetch("audit_sha256")}`"
  lines << ""
  lines << "## 1. 结论"
  lines << ""
  lines << "- `SEMANTIC_AUDIT=#{audit.fetch("errors").empty? ? "PASS" : "FAIL"}`"
  lines << "- `ERROR_COUNT=#{audit.fetch("errors").length}`"
  lines << "- `WARNING_COUNT=#{warning_rows.length}`"
  lines << "- `CATALOG_DEFINITION_COUNT=#{counts.fetch("catalog_definitions")}`"
  lines << "- `RECIPE_COUNT=#{counts.fetch("recipes")}`"
  lines << "- `TRANSITION_COUNT=#{counts.fetch("transitions")}`"
  lines << ""
  lines << "本报告验证候选内容语义与引用闭包，不构成运行时、正式数值、UI、存档迁移、Gate 或玩家测试授权。"
  lines << ""
  lines << "## 2. 库存物品逐项分类"
  lines << ""
  lines << "| 分类 | 数量 | 说明 |"
  lines << "|---|---:|---|"
  lines << "| `structured_linked` | #{classes.fetch("structured_linked", 0)} | 至少连接工艺、转换、成长、照护或权利记录 |"
  lines << "| `direct_use_only` | #{classes.fetch("direct_use_only", 0)} | 无结构化边，但具有明确直接动作 |"
  lines << "| `narrative_candidate` | #{classes.fetch("narrative_candidate", 0)} | 只有保管、流通或观察动作，等待后续玩法结构 |"
  lines << ""
  lines << "机器可读 JSON 的 `inventory_items` 为全部 #{counts.fetch("inventory_items")} 个库存物品保存逐项分类、动作、获得/损耗路径数量、结构化边和下游使用情境。"
  lines << ""
  lines << "## 3. 依赖图"
  lines << ""
  lines << "- 节点：#{graph.fetch("node_count")}"
  lines << "- 边：#{graph.fetch("edge_count")}"
  lines << "- 连通分量：#{graph.fetch("connected_component_count")}"
  lines << "- 最大连通分量：#{graph.fetch("largest_component_size")}"
  lines << ""
  lines << "| 边类型 | 数量 |"
  lines << "|---|---:|"
  graph.fetch("edge_type_counts").sort.each do |type, count|
    lines << "| `#{type}` | #{count} |"
  end
  lines << ""
  lines << "装备兼容审计覆盖 #{equipment.fetch("weapon_platform_count")} 个武器平台和 #{equipment.fetch("ammo_supply_count")} 个弹药或信号耗材。所有需要弹药的平台均有候选供给；未绑定平台的耗材进入警告清单。"
  lines << ""
  lines << "## 4. 直接用途候选"
  lines << ""
  if direct_use.empty?
    lines << "无。"
  else
    lines << "以下物品没有结构化工艺或转换边，但具有治疗、阅读、穿戴、展示、认证等明确直接动作，因此不视为孤儿："
    lines << ""
    direct_use.each do |entry|
      lines << "- `#{entry.fetch("id")}`：#{entry.fetch("meaningful_actions").join("、")}"
    end
  end
  lines << ""
  lines << "## 5. 警告与裁定"
  lines << ""
  if warning_rows.empty?
    lines << "无警告。"
  else
    warning_rows.each do |warning|
      lines << "- `#{warning.fetch("code")}` / `#{warning.fetch("id")}`：#{warning.fetch("message")}；裁定 `#{warning.fetch("disposition")}`——#{warning.fetch("rationale")}"
    end
  end
  lines << ""
  lines << "警告不改变候选状态。进入相关玩法 Gate 前，必须把叙事候选转换为明确互动、研究、开启、照护或权利规则，或明确拒绝导入。"
  lines << ""
  lines << "## 6. 重建命令"
  lines << ""
  lines << "```bash"
  lines << "ruby scripts/audit_item_library_semantics.rb --write"
  lines << "ruby scripts/audit_item_library_semantics.rb"
  lines << "ruby scripts/audit_item_library_semantics.rb --select item.agriculture.compound_fertilizer,item.furniture.field_bed"
  lines << "```"
  lines << ""
  lines << "## 7. 接受边界"
  lines << ""
  lines << "- 全部内容仍为 `candidate_only`；"
  lines << "- `runtime_authorization` 仍为 `NONE`；"
  lines << "- 不允许整包运行时导入；"
  lines << "- Gate 1A、Gate 1H 与 Gate 2 状态不因本报告改变。"
  lines << ""
  lines.join("\n")
end

def build_selection_closure(roots, indexes)
  all_ids = indexes.fetch(:all_ids)
  unknown = roots.reject { |id| all_ids.include?(id) }
  abort "SELECTION_CLOSURE=FAIL\n- 未知稳定 ID：#{unknown.join(", ")}" unless unknown.empty?

  items = indexes.fetch(:items)
  definitions = indexes.fetch(:definitions)
  recipes = indexes.fetch(:recipes)
  transitions = indexes.fetch(:transitions)
  producers = indexes.fetch(:producers)
  source_transitions = indexes.fetch(:source_transitions)
  compatible_equipment = indexes.fetch(:compatible_equipment)

  selected = Set.new
  queue = roots.dup

  until queue.empty?
    id = queue.shift
    next unless selected.add?(id)

    if items.key?(id)
      item = items.fetch(id)
      linked_recipe_ids = producers.fetch(id, []) +
                          item.dig("interfaces", "repair_recipes").to_a +
                          item.dig("interfaces", "dismantle_recipes").to_a
      queue.concat(linked_recipe_ids)
      queue.concat(source_transitions.fetch(id, []))
      queue.concat(compatible_equipment.fetch(id, []))
    elsif recipes.key?(id)
      recipe = recipes.fetch(id)
      queue.concat(recipe_item_ids(recipe, "inputs"))
      queue.concat(recipe_substitute_item_ids(recipe))
      queue.concat(recipe_item_ids(recipe, "outputs"))
      queue.concat(recipe_item_ids(recipe, "byproducts"))
      queue << recipe_target_item(recipe) if recipe_target_item(recipe)
    elsif transitions.key?(id)
      transition = transitions.fetch(id)
      queue << transition.dig("source", "item") if transition.dig("source", "item")
      queue.concat(recipe_item_ids(transition, "additional_inputs"))
      queue << transition.dig("target", "definition")
    elsif definitions.key?(id)
      definition = definitions.fetch(id)
      queue << definition["transition_id"]
      links = profile_item_links(definition)
      queue.concat(links.fetch(:inputs))
      queue.concat(links.fetch(:outputs))
    end
  end

  grouped = {
    "inventory_items" => selected.select { |id| items.key?(id) }.sort,
    "non_inventory_definitions" => selected.select { |id| definitions.key?(id) }.sort,
    "recipes" => selected.select { |id| recipes.key?(id) }.sort,
    "transitions" => selected.select { |id| transitions.key?(id) }.sort
  }
  downstream = grouped.fetch("inventory_items").to_h do |item_id|
    [item_id, items.fetch(item_id).dig("interfaces", "used_by").to_a.sort]
  end
  core = {
    "roots" => roots.sort,
    "nodes" => grouped,
    "downstream_contexts" => downstream
  }
  core
end

options = parse_arguments(ARGV)

abort "SEMANTIC_AUDIT=FAIL\n- 缺少 #{BUNDLE_PATH}" unless File.file?(BUNDLE_PATH)
abort "SEMANTIC_AUDIT=FAIL\n- 缺少 #{CONTRACT_PATH}" unless File.file?(CONTRACT_PATH)

bundle = JSON.parse(File.read(BUNDLE_PATH))
payload = bundle.fetch("payload")
inventory_items = payload.fetch("inventory_items")
definitions = payload.fetch("non_inventory_definitions")
recipes = payload.fetch("recipes")
transitions = payload.fetch("transitions")

items_by_id = inventory_items.to_h { |item| [item.fetch("id"), item] }
definitions_by_id = definitions.to_h { |definition| [definition.fetch("id"), definition] }
recipes_by_id = recipes.to_h { |recipe| [recipe.fetch("id"), recipe] }
transitions_by_id = transitions.to_h { |transition| [transition.fetch("id"), transition] }

errors = []
warnings = []
all_records = inventory_items + definitions + recipes + transitions
all_ids = all_records.map { |record| record["id"] }

all_ids.group_by(&:itself).each do |id, occurrences|
  errors << { "code" => "duplicate_id", "id" => id, "message" => "稳定 ID 出现 #{occurrences.length} 次" } if occurrences.length > 1
end

errors << { "code" => "status_mismatch", "id" => "bundle", "message" => "Bundle 顶层状态不是 candidate_only" } unless bundle["status"] == "candidate_only"
errors << { "code" => "runtime_authorized", "id" => "bundle", "message" => "Bundle 运行时授权不是 NONE" } unless bundle["runtime_authorization"] == "NONE"
calculated_payload_sha = Digest::SHA256.hexdigest(JSON.generate(canonicalize_json(payload)))
unless bundle["payload_sha256"] == calculated_payload_sha
  errors << { "code" => "payload_hash_mismatch", "id" => "bundle", "message" => "payload_sha256 与规范化 payload 不一致" }
end
expected_counts = {
  "inventory_items" => inventory_items.length,
  "non_inventory_definitions" => definitions.length,
  "catalog_definitions" => inventory_items.length + definitions.length,
  "recipes" => recipes.length,
  "transitions" => transitions.length
}
unless bundle["counts"] == expected_counts
  errors << { "code" => "bundle_counts_mismatch", "id" => "bundle", "message" => "counts 与实际 Payload 数量不一致" }
end
selection_policy = bundle["selection_policy"].to_h
unless selection_policy["default_runtime_import"] == "deny" &&
       selection_policy["whole_bundle_import_allowed"] == false &&
       selection_policy["requires_explicit_stable_id_selection"] == true &&
       selection_policy["requires_separate_runtime_schema_and_gate_authorization"] == true
  errors << { "code" => "selection_policy_unsafe", "id" => "bundle", "message" => "候选选择策略不再完整拒绝默认运行时导入" }
end

edges = []

recipes.each do |recipe|
  recipe_id = recipe.fetch("id")
  input_ids = recipe_item_ids(recipe, "inputs")
  substitute_input_ids = recipe_substitute_item_ids(recipe)
  output_ids = recipe_item_ids(recipe, "outputs")
  byproduct_ids = recipe_item_ids(recipe, "byproducts")
  target_item = recipe_target_item(recipe)

  required_fields = %w[resource_chains facilities tools qualification effective_time_hours logistics risks]
  required_fields.each do |field|
    next if present?(recipe[field])

    errors << { "code" => "recipe_semantic_field_missing", "id" => recipe_id, "message" => "#{field} 为空" }
  end
  substitution_rules = recipe.dig("substitution_policy", "rules").to_a
  if recipe.dig("substitution_policy", "allowed") == false && substitution_rules.any?
    errors << { "code" => "disabled_substitution_has_rules", "id" => recipe_id, "message" => "禁止替代但仍定义了替代规则" }
  end
  substitution_rules.each do |rule|
    unless input_ids.include?(rule["input"])
      errors << { "code" => "substitution_input_mismatch", "id" => recipe_id, "message" => "替代规则输入 #{rule["input"]} 不是直接输入" }
    end
    if rule.fetch("alternatives", []).empty?
      errors << { "code" => "substitution_alternatives_missing", "id" => recipe_id, "message" => "替代规则没有候选物品" }
    end
    rule.fetch("alternatives", []).each do |alternative|
      next if alternative["ratio"].is_a?(Numeric) && alternative["ratio"].positive?

      errors << { "code" => "substitution_ratio_invalid", "id" => recipe_id, "message" => "替代物品 #{alternative["item"]} 的 ratio 不是正数" }
    end
  end

  if target_item
    errors << { "code" => "unknown_recipe_target", "id" => recipe_id, "message" => "目标物品 #{target_item} 不存在" } unless items_by_id.key?(target_item)
    add_edge(edges, target_item, recipe_id, "recipe_target")
  elsif input_ids.empty? || output_ids.empty?
    errors << { "code" => "recipe_flow_incomplete", "id" => recipe_id, "message" => "普通工艺必须同时具有库存输入和主产出" }
  end

  input_ids.each do |item_id|
    errors << { "code" => "unknown_recipe_input", "id" => recipe_id, "message" => "输入物品 #{item_id} 不存在" } unless items_by_id.key?(item_id)
    add_edge(edges, item_id, recipe_id, "recipe_input")
  end
  substitute_input_ids.each do |item_id|
    errors << { "code" => "unknown_recipe_substitute_input", "id" => recipe_id, "message" => "替代输入物品 #{item_id} 不存在" } unless items_by_id.key?(item_id)
    add_edge(edges, item_id, recipe_id, "recipe_substitute_input")
  end
  output_ids.each do |item_id|
    errors << { "code" => "unknown_recipe_output", "id" => recipe_id, "message" => "产出物品 #{item_id} 不存在" } unless items_by_id.key?(item_id)
    add_edge(edges, recipe_id, item_id, "recipe_output")
  end
  byproduct_ids.each do |item_id|
    errors << { "code" => "unknown_recipe_byproduct", "id" => recipe_id, "message" => "副产物 #{item_id} 不存在" } unless items_by_id.key?(item_id)
    add_edge(edges, recipe_id, item_id, "recipe_byproduct")
  end

  (input_ids + substitute_input_ids).uniq.each do |item_id|
    next unless items_by_id.key?(item_id)
    next if items_by_id.fetch(item_id).dig("interfaces", "used_by").to_a.include?(recipe_id)

    errors << { "code" => "missing_used_by_backlink", "id" => item_id, "message" => "缺少对 #{recipe_id} 的 used_by 反向引用" }
  end
  (output_ids + byproduct_ids).uniq.each do |item_id|
    next unless items_by_id.key?(item_id)
    next if items_by_id.fetch(item_id).dig("interfaces", "produced_by").to_a.include?(recipe_id)

    errors << { "code" => "missing_produced_by_backlink", "id" => item_id, "message" => "缺少对 #{recipe_id} 的 produced_by 反向引用" }
  end

  next unless target_item && items_by_id.key?(target_item)

  interface_key = case recipe["kind"]
                  when "repair" then "repair_recipes"
                  when "dismantle" then "dismantle_recipes"
                  end
  if interface_key.nil?
    errors << { "code" => "unsupported_target_recipe_kind", "id" => recipe_id, "message" => "含目标实例的工艺种类 #{recipe["kind"]} 未定义接口" }
  elsif !items_by_id.fetch(target_item).dig("interfaces", interface_key).to_a.include?(recipe_id)
    errors << { "code" => "missing_target_backlink", "id" => target_item, "message" => "缺少对 #{recipe_id} 的 #{interface_key} 反向引用" }
  end
end

transitions.each do |transition|
  transition_id = transition.fetch("id")
  target_definition = transition.dig("target", "definition")
  source_item = transition.dig("source", "item")
  additional_items = recipe_item_ids(transition, "additional_inputs")

  %w[tools qualification effective_time_hours logistics rollback risks].each do |field|
    next if present?(transition[field])

    errors << { "code" => "transition_semantic_field_missing", "id" => transition_id, "message" => "#{field} 为空" }
  end

  if definitions_by_id.key?(target_definition)
    unless definitions_by_id.fetch(target_definition)["transition_id"] == transition_id
      errors << { "code" => "transition_definition_mismatch", "id" => transition_id, "message" => "#{target_definition} 未反向引用本转换" }
    end
  else
    errors << { "code" => "unknown_transition_target", "id" => transition_id, "message" => "目标定义 #{target_definition} 不存在" }
  end
  add_edge(edges, transition_id, target_definition, "transition_target")

  if source_item
    errors << { "code" => "unknown_transition_source", "id" => transition_id, "message" => "来源物品 #{source_item} 不存在" } unless items_by_id.key?(source_item)
    add_edge(edges, source_item, transition_id, "transition_source")
  end
  additional_items.each do |item_id|
    errors << { "code" => "unknown_transition_input", "id" => transition_id, "message" => "额外输入 #{item_id} 不存在" } unless items_by_id.key?(item_id)
    add_edge(edges, item_id, transition_id, "transition_additional_input")
  end
end

definitions.each do |definition|
  definition_id = definition.fetch("id")
  unless present?(definition["decision_role"])
    errors << { "code" => "definition_decision_role_missing", "id" => definition_id, "message" => "decision_role 为空" }
  end
  unless transitions_by_id.key?(definition["transition_id"])
    errors << { "code" => "unknown_definition_transition", "id" => definition_id, "message" => "转换 #{definition["transition_id"]} 不存在" }
  end

  links = profile_item_links(definition)
  links.fetch(:inputs).each do |item_id|
    errors << { "code" => "unknown_definition_profile_input", "id" => definition_id, "message" => "Profile 输入 #{item_id} 不存在" } unless items_by_id.key?(item_id)
    add_edge(edges, item_id, definition_id, "definition_profile_input")
  end
  links.fetch(:outputs).each do |item_id|
    errors << { "code" => "unknown_definition_profile_output", "id" => definition_id, "message" => "Profile 产出 #{item_id} 不存在" } unless items_by_id.key?(item_id)
    add_edge(edges, definition_id, item_id, "definition_profile_output")
  end
end

equipment_items = inventory_items.select { |item| item["equipment_profile"].is_a?(Hash) }
equipment_items.each do |item|
  %w[role ammo_family use_constraints].each do |field|
    next if present?(item.dig("equipment_profile", field))

    errors << { "code" => "equipment_profile_field_missing", "id" => item["id"], "message" => "equipment_profile.#{field} 为空" }
  end
end

inventory_items.select { |item| item["protection_profile"].is_a?(Hash) }.each do |item|
  %w[regions role tradeoff_note use_constraints].each do |field|
    next if present?(item.dig("protection_profile", field))

    errors << { "code" => "protection_profile_field_missing", "id" => item["id"], "message" => "protection_profile.#{field} 为空" }
  end
end

weapon_platforms = equipment_items.select { |item| item.dig("equipment_profile", "role") == "weapon_platform" }
ammo_supplies = equipment_items.select do |item|
  %w[ammunition signal_supply].include?(item.dig("equipment_profile", "role"))
end
platforms_by_family = weapon_platforms.group_by { |item| item.dig("equipment_profile", "ammo_family") }
supplies_by_family = ammo_supplies.group_by { |item| item.dig("equipment_profile", "ammo_family") }

weapon_platforms.each do |platform|
  family = platform.dig("equipment_profile", "ammo_family")
  next if family == "none"

  matching_supplies = supplies_by_family.fetch(family, [])
  if matching_supplies.empty?
    errors << { "code" => "weapon_ammo_family_unserved", "id" => platform["id"], "message" => "弹药族 #{family} 没有候选耗材" }
    next
  end
  matching_supplies.each { |supply| add_edge(edges, supply["id"], platform["id"], "ammo_compatibility") }
end

ammo_supplies.each do |supply|
  family = supply.dig("equipment_profile", "ammo_family")
  next if family == "none" || platforms_by_family.fetch(family, []).any?

  adjudication = WARNING_ADJUDICATIONS[supply["id"]]
  warnings << {
    "code" => "ammo_family_without_platform",
    "id" => supply["id"],
    "message" => "弹药族 #{family} 没有候选武器平台",
    "disposition" => adjudication && adjudication.fetch("disposition"),
    "rationale" => adjudication && adjudication.fetch("rationale")
  }
end

inventory_items.each do |item|
  item_id = item.fetch("id")
  {
    "decision_role" => item["decision_role"],
    "acquisition_paths" => item["acquisition_paths"],
    "consumption_loss_paths" => item["consumption_loss_paths"],
    "actions" => item["actions"],
    "resource_chains" => item["resource_chains"],
    "logistics_note" => item["logistics_note"]
  }.each do |field, value|
    next if present?(value)

    errors << { "code" => "item_semantic_field_missing", "id" => item_id, "message" => "#{field} 为空" }
  end

  interfaces = item["interfaces"]
  unless interfaces.is_a?(Hash)
    errors << { "code" => "item_interfaces_missing", "id" => item_id, "message" => "interfaces 不是对象" }
    next
  end

  %w[produced_by used_by repair_recipes dismantle_recipes].each do |key|
    unless interfaces[key].is_a?(Array)
      errors << { "code" => "item_interface_array_missing", "id" => item_id, "message" => "interfaces.#{key} 不是数组" }
      next
    end

    interfaces[key].each do |recipe_id|
      recipe = recipes_by_id[recipe_id]
      if recipe.nil?
        errors << { "code" => "unknown_item_recipe_interface", "id" => item_id, "message" => "#{key} 引用不存在的 #{recipe_id}" }
        next
      end

      valid = case key
              when "produced_by"
                (recipe_item_ids(recipe, "outputs") + recipe_item_ids(recipe, "byproducts")).include?(item_id)
              when "used_by"
                (recipe_item_ids(recipe, "inputs") + recipe_substitute_item_ids(recipe)).include?(item_id)
              when "repair_recipes"
                recipe["kind"] == "repair" && recipe_target_item(recipe) == item_id
              when "dismantle_recipes"
                recipe["kind"] == "dismantle" && recipe_target_item(recipe) == item_id
              end
      next if valid

      errors << { "code" => "item_recipe_interface_mismatch", "id" => item_id, "message" => "#{key} 与 #{recipe_id} 的内容不互证" }
    end
  end
end

node_ids = all_ids.uniq.sort
node_id_set = Set.new(node_ids)
edges = edges.uniq { |edge| [edge["from"], edge["to"], edge["type"]] }
             .select { |edge| node_id_set.include?(edge["from"]) && node_id_set.include?(edge["to"]) }
             .sort_by { |edge| [edge["type"], edge["from"], edge["to"]] }

inventory_audits = inventory_items.sort_by { |item| item.fetch("id") }.map do |item|
  item_id = item.fetch("id")
  meaningful_actions = item.fetch("actions", []) - PASSIVE_ACTIONS
  structured_edges = edges.select { |edge| edge["from"] == item_id || edge["to"] == item_id }
  classification = if structured_edges.any?
                     "structured_linked"
                   elsif meaningful_actions.any?
                     "direct_use_only"
                   else
                     "narrative_candidate"
                   end

  if classification == "narrative_candidate"
    adjudication = WARNING_ADJUDICATIONS[item_id]
    warnings << {
      "code" => "narrative_candidate",
      "id" => item_id,
      "message" => "只有保管、流通或观察动作，且没有结构化关系",
      "disposition" => adjudication && adjudication.fetch("disposition"),
      "rationale" => adjudication && adjudication.fetch("rationale")
    }
  end

  {
    "id" => item_id,
    "classification" => classification,
    "meaningful_actions" => meaningful_actions.sort,
    "acquisition_path_count" => item.fetch("acquisition_paths", []).length,
    "loss_path_count" => item.fetch("consumption_loss_paths", []).length,
    "resource_chains" => item.fetch("resource_chains", []).sort,
    "structured_links" => structured_edges,
    "downstream_contexts" => item.dig("interfaces", "used_by").to_a.sort
  }
end

duplicate_groups(all_records, "decision_role").each do |group|
  group.fetch("ids").each do |id|
    warnings << { "code" => "duplicate_decision_role", "id" => id, "message" => "与 #{(group.fetch("ids") - [id]).join(", ")} 的决策角色完全重复" }
  end
end
duplicate_groups(all_records, "description").each do |group|
  group.fetch("ids").each do |id|
    warnings << { "code" => "duplicate_description", "id" => id, "message" => "与 #{(group.fetch("ids") - [id]).join(", ")} 的说明完全重复" }
  end
end

warnings.each do |warning|
  next if present?(warning["disposition"]) && present?(warning["rationale"])

  errors << { "code" => "warning_unadjudicated", "id" => warning["id"], "message" => "#{warning["code"]} 尚未裁定" }
end

errors.sort_by! { |entry| [entry["code"], entry["id"], entry["message"]] }
warnings.sort_by! { |entry| [entry["code"], entry["id"], entry["message"]] }

indexes = {
  all_ids: Set.new(node_ids),
  items: items_by_id,
  definitions: definitions_by_id,
  recipes: recipes_by_id,
  transitions: transitions_by_id,
  producers: recipes.each_with_object(Hash.new { |hash, key| hash[key] = [] }) do |recipe, memo|
    (recipe_item_ids(recipe, "outputs") + recipe_item_ids(recipe, "byproducts")).each { |item_id| memo[item_id] << recipe["id"] }
  end.transform_values { |ids| ids.uniq.sort },
  source_transitions: transitions.each_with_object(Hash.new { |hash, key| hash[key] = [] }) do |transition, memo|
    source_item = transition.dig("source", "item")
    memo[source_item] << transition["id"] if source_item
  end.transform_values { |ids| ids.uniq.sort },
  compatible_equipment: edges.select { |edge| edge["type"] == "ammo_compatibility" }
                             .each_with_object(Hash.new { |hash, key| hash[key] = [] }) do |edge, memo|
    memo[edge["from"]] << edge["to"]
    memo[edge["to"]] << edge["from"]
  end.transform_values { |ids| ids.uniq.sort }
}

if options[:select]
  abort "SEMANTIC_AUDIT=FAIL\n#{errors.map { |entry| "- #{entry["code"]} #{entry["id"]}: #{entry["message"]}" }.join("\n")}" unless errors.empty?

  closure_core = {
    "schema_version" => "new-era-2.item-library.selection-closure.v0.1",
    "source_baseline_id" => bundle.fetch("baseline_id"),
    "source_payload_sha256" => bundle.fetch("payload_sha256"),
    "status" => bundle.fetch("status"),
    "runtime_authorization" => bundle.fetch("runtime_authorization")
  }.merge(build_selection_closure(options[:select], indexes))
  selected_ids = closure_core.fetch("nodes").values.flatten
  closure_core["applicable_warnings"] = warnings.select { |warning| selected_ids.include?(warning["id"]) }
  closure = closure_core.merge("closure_sha256" => Digest::SHA256.hexdigest(JSON.generate(closure_core)))
  puts JSON.pretty_generate(closure)
  exit 0
end

components = connected_components(node_ids, edges)
classification_counts = inventory_audits.group_by { |entry| entry.fetch("classification") }
                                        .transform_values(&:length)
                                        .sort.to_h
direct_use_only = inventory_audits.select { |entry| entry["classification"] == "direct_use_only" }
                                  .map { |entry| { "id" => entry["id"], "meaningful_actions" => entry["meaningful_actions"] } }

report_core = {
  "schema_version" => "new-era-2.item-library.semantic-audit.r2a.v0.1",
  "source_baseline_id" => bundle.fetch("baseline_id"),
  "source_payload_sha256" => bundle.fetch("payload_sha256"),
  "status" => bundle.fetch("status"),
  "runtime_authorization" => bundle.fetch("runtime_authorization"),
  "source_files" => {
    "data/item-library/item-library-r1-candidate-bundle.json" => Digest::SHA256.file(BUNDLE_PATH).hexdigest,
    "docs/item-library/item-library-semantic-audit-contract-v0.1.md" => Digest::SHA256.file(CONTRACT_PATH).hexdigest,
    "scripts/audit_item_library_semantics.rb" => Digest::SHA256.file(__FILE__).hexdigest
  },
  "counts" => {
    "inventory_items" => inventory_items.length,
    "non_inventory_definitions" => definitions.length,
    "catalog_definitions" => inventory_items.length + definitions.length,
    "recipes" => recipes.length,
    "transitions" => transitions.length
  },
  "audit" => {
    "errors" => errors,
    "warnings" => warnings,
    "inventory_classification_counts" => classification_counts,
    "direct_use_only_items" => direct_use_only,
    "duplicate_decision_role_groups" => duplicate_groups(all_records, "decision_role"),
    "duplicate_description_groups" => duplicate_groups(all_records, "description")
  },
  "graph" => {
    "node_count" => node_ids.length,
    "edge_count" => edges.length,
    "edge_type_counts" => edges.group_by { |edge| edge.fetch("type") }.transform_values(&:length).sort.to_h,
    "connected_component_count" => components.length,
    "largest_component_size" => components.first&.length.to_i,
    "components" => components,
    "edges" => edges
  },
  "equipment_compatibility" => {
    "weapon_platform_count" => weapon_platforms.length,
    "ammo_supply_count" => ammo_supplies.length,
    "platforms_by_ammo_family" => platforms_by_family.sort.to_h.transform_values { |items| items.map { |item| item["id"] }.sort },
    "supplies_by_ammo_family" => supplies_by_family.sort.to_h.transform_values { |items| items.map { |item| item["id"] }.sort }
  },
  "inventory_items" => inventory_audits
}
audit_sha = Digest::SHA256.hexdigest(JSON.generate(report_core))
report = report_core.merge("audit_sha256" => audit_sha)

json_output = JSON.pretty_generate(report) + "\n"
markdown_output = build_markdown(report)

unless errors.empty?
  warn "SEMANTIC_AUDIT=FAIL"
  errors.each { |entry| warn "- #{entry["code"]} #{entry["id"]}: #{entry["message"]}" }
  exit 1
end

if options[:write]
  File.write(JSON_REPORT_PATH, json_output)
  File.write(MARKDOWN_REPORT_PATH, markdown_output)
  puts "SEMANTIC_AUDIT_JSON=WRITTEN #{JSON_REPORT_PATH}"
  puts "SEMANTIC_AUDIT_MARKDOWN=WRITTEN #{MARKDOWN_REPORT_PATH}"
else
  unless File.file?(JSON_REPORT_PATH) && File.read(JSON_REPORT_PATH) == json_output
    warn "SEMANTIC_AUDIT=FAIL"
    warn "- #{File.basename(JSON_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
  unless File.file?(MARKDOWN_REPORT_PATH) && File.read(MARKDOWN_REPORT_PATH) == markdown_output
    warn "SEMANTIC_AUDIT=FAIL"
    warn "- #{File.basename(MARKDOWN_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
end

puts "SEMANTIC_AUDIT=PASS"
puts "ERROR_COUNT=#{errors.length}"
puts "WARNING_COUNT=#{warnings.length}"
puts "STRUCTURED_LINKED_ITEM_COUNT=#{classification_counts.fetch("structured_linked", 0)}"
puts "DIRECT_USE_ONLY_ITEM_COUNT=#{classification_counts.fetch("direct_use_only", 0)}"
puts "NARRATIVE_CANDIDATE_ITEM_COUNT=#{classification_counts.fetch("narrative_candidate", 0)}"
puts "GRAPH_NODE_COUNT=#{node_ids.length}"
puts "GRAPH_EDGE_COUNT=#{edges.length}"
puts "AUDIT_SHA256=#{audit_sha}"
puts "RUNTIME_AUTHORIZATION=#{bundle.fetch("runtime_authorization")}"
