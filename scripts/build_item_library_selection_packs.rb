#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "open3"
require "rbconfig"
require "set"

ROOT = File.expand_path("..", __dir__)
BUNDLE_PATH = File.join(ROOT, "data/item-library/item-library-r1-candidate-bundle.json")
SEMANTIC_AUDIT_PATH = File.join(ROOT, "data/item-library/semantic-audit-r2a.json")
FLOW_AUDIT_PATH = File.join(ROOT, "data/item-library/flow-audit-r2b.json")
CALIBRATION_PATH = File.join(ROOT, "data/item-library/calibration-proposals-r2c.json")
R2C_REVIEW_PATH = File.join(ROOT, "docs/item-library/reviews/item-library-r2c-review-status-2026-07-30.md")
SEMANTIC_SCRIPT_PATH = File.join(ROOT, "scripts/audit_item_library_semantics.rb")
CONTRACT_PATH = File.join(ROOT, "docs/item-library/item-library-selection-pack-contract-v0.1.md")
JSON_REPORT_PATH = File.join(ROOT, "data/item-library/selection-packs-r2d.json")
MARKDOWN_REPORT_PATH = File.join(ROOT, "data/item-library/selection-packs-r2d.md")

EXPECTED_BASELINE_ID = "new-era-2.item-library.r1-c7-candidate"
PROFILE_INPUT_KEYS = %w[
  source_item
  ongoing_input_items
  care_input_items
  upkeep_items
  physical_evidence_item
].freeze
PROFILE_OUTPUT_KEYS = %w[harvest_output_items].freeze
PREFERRED_BYPRODUCT_PRODUCERS = {
  "item.waste.metal_offcuts" => "recipe.metal.reclaim_steel_plate",
  "item.waste.sawdust" => "recipe.c4_wood.saw_lumber"
}.freeze

PACK_DEFINITIONS = [
  {
    "id" => "pack.r2d.survival_medical",
    "name" => "生存、医疗与基础安置",
    "resource_focus" => %w[survival security],
    "purpose" => "提供行粮、基础伤口护理、保温衣物和可部署床位的候选生产路径。",
    "roots" => %w[
      item.clothing.insulated_coat
      item.food.travel_biscuit
      item.furniture.field_bed
      item.medical.field_wound_care_pack
      item.medical.wound_irrigation_saline
    ],
    "explicit_exclusions" => [
      { "id" => "item.weapon.bolt_rifle", "reason" => "只可能作为回收钢板的替代拆解来源进入审计上下文，不属于生存包推荐路径。" },
      { "id" => "item.weapon.pump_shotgun", "reason" => "只可能作为回收材料上下文出现；枪械运行时与战斗平衡未授权。" },
      { "id" => "item.rare.sterile_surgical_instrument_chest", "reason" => "稀有外科器械没有当前候选制造路径，需要独立医疗 Gate。" }
    ]
  },
  {
    "id" => "pack.r2d.industry_maintenance",
    "name" => "工业维修与离线电气",
    "resource_focus" => %w[industry survival security],
    "purpose" => "提供机械维修、现场备件、可充电照明和有线通信的候选生产路径。",
    "roots" => %w[
      item.electronic.rechargeable_task_lantern
      item.electronic.wired_field_telephone
      item.tool.field_repair_kit
      item.tool.mechanic_hand_tool_set
    ],
    "explicit_exclusions" => [
      { "id" => "item.rare.offline_machine_controller", "reason" => "稀有机床控制器缺少目标设施和运行时维护 Gate。" },
      { "id" => "item.rare.high_density_battery_sample", "reason" => "样品不等于可制造电池模块，不能替代 R2-C 电池外壳提案。" },
      { "id" => "item.rare.offline_sensor_core", "reason" => "R2-A 已裁定延后到离线诊断或预警升级 Gate。" }
    ]
  },
  {
    "id" => "pack.r2d.security_low_tech",
    "name" => "低技术安防与预警",
    "resource_focus" => %w[security industry survival],
    "purpose" => "提供可制造弓弩、配套弹药、软硬防护和有线预警的候选生产路径。",
    "roots" => %w[
      item.ammunition.crossbow_bolt_bundle
      item.ammunition.hunting_arrow_bundle
      item.armor.padded_vest
      item.armor.reinforced_plate
      item.electronic.wired_alarm_unit
      item.weapon.hunting_bow
      item.weapon.light_crossbow
    ],
    "explicit_exclusions" => [
      { "id" => "item.weapon.bolt_rifle", "reason" => "枪械无候选制造路径，可能只作为拆解来源进入审计上下文。" },
      { "id" => "item.weapon.pump_shotgun", "reason" => "枪械运行时、弹药经济和战斗平衡尚未授权。" },
      { "id" => "item.armor.ballistic_vest", "reason" => "受控弹道防具没有候选制造路径，必须结合正式伤害与耐久系统。" },
      { "id" => "item.armor.riot_shield", "reason" => "防暴装备属于更高阶秩序与战斗 Gate，不纳入低技术包。" }
    ]
  },
  {
    "id" => "pack.r2d.civic_domestic",
    "name" => "公共生活、家居与权利记录",
    "resource_focus" => %w[politics survival industry],
    "purpose" => "提供公共家具、修补、装饰和两类可审计权利记录的候选路径。",
    "roots" => %w[
      item.daily.sewing_mending_kit
      item.decoration.carved_wooden_figure
      item.decoration.cloth_toy
      item.furniture.communal_bench
      item.furniture.modular_storage_shelf
      record.right.ration_entitlement
      record.right.workshop_position_qualification
    ],
    "explicit_exclusions" => [
      { "id" => "item.weapon.bolt_rifle", "reason" => "只可能因公共材料的拆解来源进入审计上下文，不属于公共生活推荐路径。" },
      { "id" => "item.weapon.pump_shotgun", "reason" => "枪械不属于家居与权利记录的推荐采纳面。" },
      { "id" => "item.rare.disputed_ceremonial_sword", "reason" => "争议礼仪物需要独立产权、仪式和安全裁定。" }
    ]
  }
].freeze

def parse_arguments(argv)
  options = { write: false }
  argv.each do |argument|
    case argument
    when "--write"
      options[:write] = true
    else
      abort "SELECTION_PACKS=FAIL\n- 未知参数 #{argument}"
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

    PROFILE_INPUT_KEYS.each { |profile_key| inputs.concat(item_references(value[profile_key])) if value.key?(profile_key) }
    PROFILE_OUTPUT_KEYS.each { |profile_key| outputs.concat(item_references(value[profile_key])) if value.key?(profile_key) }
  end
  { inputs: inputs.uniq.sort, outputs: outputs.uniq.sort }
end

def recipe_item_ids(recipe, key)
  recipe.fetch(key, []).map { |entry| entry["item"] }.compact.uniq.sort
end

def recipe_substitute_item_ids(recipe)
  recipe.dig("substitution_policy", "rules")
        .to_a
        .flat_map { |rule| rule.fetch("alternatives", []).map { |alternative| alternative["item"] } }
        .compact
        .uniq
        .sort
end

def grouped_ids(selected, indexes)
  {
    "inventory_items" => selected.select { |id| indexes.fetch(:items).key?(id) }.sort,
    "non_inventory_definitions" => selected.select { |id| indexes.fetch(:definitions).key?(id) }.sort,
    "recipes" => selected.select { |id| indexes.fetch(:recipes).key?(id) }.sort,
    "transitions" => selected.select { |id| indexes.fetch(:transitions).key?(id) }.sort
  }
end

def all_grouped_ids(nodes)
  nodes.values.flatten.uniq.sort
end

def invoke_semantic_closure(roots)
  stdout, stderr, status = Open3.capture3(
    RbConfig.ruby,
    SEMANTIC_SCRIPT_PATH,
    "--select",
    roots.sort.join(",")
  )
  raise "R2-A 选择闭包失败：#{stderr.strip}" unless status.success?

  JSON.parse(stdout)
rescue JSON::ParserError => e
  raise "R2-A 选择闭包不是合法 JSON：#{e.message}"
end

def recommended_producer_ids(item_id, indexes)
  rows = indexes.fetch(:producers).fetch(item_id, [])
  normal_rows = rows.reject do |row|
    %w[repair dismantle].include?(indexes.fetch(:recipes).fetch(row.fetch("id")).fetch("kind"))
  end
  main_output_ids = normal_rows.select { |row| row.fetch("role") == "main_output" }
                               .map { |row| row.fetch("id") }
                               .uniq
                               .sort
  return main_output_ids unless main_output_ids.empty?

  override_id = PREFERRED_BYPRODUCT_PRODUCERS[item_id]
  return [] unless override_id

  valid = normal_rows.any? { |row| row.fetch("id") == override_id && row.fetch("role") == "byproduct" }
  raise "#{item_id} 的首选副产来源 #{override_id} 与冻结基线不一致" unless valid

  [override_id]
end

def build_recommended_path(roots, indexes)
  selected = Set.new
  producer_expanded = Set.new
  substitution_context = Set.new
  required_input_ids = Set.new
  queue = roots.sort.map { |id| { id: id, expand_producers: true } }

  until queue.empty?
    entry = queue.shift
    id = entry.fetch(:id)

    if indexes.fetch(:items).key?(id)
      selected.add(id)
      next unless entry.fetch(:expand_producers) && producer_expanded.add?(id)

      preferred = recommended_producer_ids(id, indexes)
      queue.concat(preferred.map { |recipe_id| { id: recipe_id, expand_producers: false } })
      next
    end

    next unless selected.add?(id)

    if indexes.fetch(:recipes).key?(id)
      recipe = indexes.fetch(:recipes).fetch(id)
      direct_inputs = recipe_item_ids(recipe, "inputs")
      direct_inputs.each { |item_id| required_input_ids.add(item_id) }
      queue.concat(direct_inputs.map { |item_id| { id: item_id, expand_producers: true } })
      outputs = recipe_item_ids(recipe, "outputs") + recipe_item_ids(recipe, "byproducts")
      queue.concat(outputs.uniq.map { |item_id| { id: item_id, expand_producers: false } })
      recipe_substitute_item_ids(recipe).each { |item_id| substitution_context.add(item_id) }
    elsif indexes.fetch(:transitions).key?(id)
      transition = indexes.fetch(:transitions).fetch(id)
      source_item = transition.dig("source", "item")
      if source_item
        required_input_ids.add(source_item)
        queue << { id: source_item, expand_producers: true }
      end
      recipe_item_ids(transition, "additional_inputs").each do |item_id|
        required_input_ids.add(item_id)
        queue << { id: item_id, expand_producers: true }
      end
      queue << { id: transition.dig("target", "definition"), expand_producers: false }
    elsif indexes.fetch(:definitions).key?(id)
      definition = indexes.fetch(:definitions).fetch(id)
      queue << { id: definition.fetch("transition_id"), expand_producers: false }
      links = profile_item_links(definition)
      links.fetch(:inputs).each do |item_id|
        required_input_ids.add(item_id)
        queue << { id: item_id, expand_producers: true }
      end
      queue.concat(links.fetch(:outputs).map { |item_id| { id: item_id, expand_producers: false } })
    end
  end

  nodes = grouped_ids(selected, indexes)
  selected_recipe_ids = nodes.fetch("recipes").to_set
  supply_rows = required_input_ids.to_a.sort.map do |item_id|
    item = indexes.fetch(:items).fetch(item_id)
    all_selected_producers = indexes.fetch(:producers).fetch(item_id, [])
                                    .map { |row| row.fetch("id") }
                                    .uniq
                                    .select { |recipe_id| selected_recipe_ids.include?(recipe_id) }
                                    .sort
    designated_producers = recommended_producer_ids(item_id, indexes)
                             .select { |recipe_id| selected_recipe_ids.include?(recipe_id) }
                             .sort
    co_producers = all_selected_producers - designated_producers
    external_types = item.fetch("acquisition_paths", []).map { |path| path["type"] }.compact.uniq.sort - ["manufacture"]
    mode = if designated_producers.any? && external_types.any?
             "recommended_producer_or_external"
           elsif designated_producers.any?
             "recommended_producer"
           elsif external_types.any?
             "external_source"
           else
             "unsatisfied"
           end
    {
      "id" => item_id,
      "supply_mode" => mode,
      "designated_supply_producer_recipe_ids" => designated_producers,
      "incidental_co_producer_recipe_ids" => co_producers,
      "external_acquisition_types" => external_types
    }
  end

  core = {
    "nodes" => nodes,
    "required_input_supply" => supply_rows,
    "substitution_context_item_ids" => substitution_context.to_a.sort
  }
  core.merge("path_sha256" => canonical_sha(core))
end

def path_reference_errors(path, indexes)
  nodes = path.fetch("nodes")
  selected_items = nodes.fetch("inventory_items").to_set
  selected_definitions = nodes.fetch("non_inventory_definitions").to_set
  selected_transitions = nodes.fetch("transitions").to_set
  substitution_context = path.fetch("substitution_context_item_ids").to_set
  errors = []

  nodes.fetch("recipes").each do |recipe_id|
    recipe = indexes.fetch(:recipes).fetch(recipe_id)
    direct_refs = recipe_item_ids(recipe, "inputs") +
                  recipe_item_ids(recipe, "outputs") +
                  recipe_item_ids(recipe, "byproducts")
    missing = direct_refs.uniq.reject { |item_id| selected_items.include?(item_id) }
    errors << "#{recipe_id} 缺少直接库存引用 #{missing.join(", ")}" unless missing.empty?
    missing_substitutes = recipe_substitute_item_ids(recipe).reject { |item_id| substitution_context.include?(item_id) }
    errors << "#{recipe_id} 缺少替代输入上下文 #{missing_substitutes.join(", ")}" unless missing_substitutes.empty?
  end

  nodes.fetch("transitions").each do |transition_id|
    transition = indexes.fetch(:transitions).fetch(transition_id)
    item_refs = [transition.dig("source", "item")] + recipe_item_ids(transition, "additional_inputs")
    missing_items = item_refs.compact.uniq.reject { |item_id| selected_items.include?(item_id) }
    errors << "#{transition_id} 缺少库存引用 #{missing_items.join(", ")}" unless missing_items.empty?
    target_id = transition.dig("target", "definition")
    errors << "#{transition_id} 缺少目标定义 #{target_id}" unless selected_definitions.include?(target_id)
  end

  nodes.fetch("non_inventory_definitions").each do |definition_id|
    definition = indexes.fetch(:definitions).fetch(definition_id)
    transition_id = definition.fetch("transition_id")
    errors << "#{definition_id} 缺少转换 #{transition_id}" unless selected_transitions.include?(transition_id)
    links = profile_item_links(definition)
    missing_items = (links.fetch(:inputs) + links.fetch(:outputs)).uniq.reject { |item_id| selected_items.include?(item_id) }
    errors << "#{definition_id} 缺少 profile 库存引用 #{missing_items.join(", ")}" unless missing_items.empty?
  end
  errors
end

def difference_nodes(full_nodes, subset_nodes)
  full_nodes.keys.sort.to_h do |key|
    [key, (full_nodes.fetch(key) - subset_nodes.fetch(key)).sort]
  end
end

def cycle_rows(flow_audit)
  flow_audit.dig("transformation_graph", "cycles").to_a.map do |row|
    core = {
      "items" => row.fetch("items"),
      "recipes" => row.fetch("recipes"),
      "minimum_effective_time_hours" => row.fetch("minimum_effective_time_hours"),
      "dismantle_recovery_ratio_max" => row.fetch("dismantle_recovery_ratio_max"),
      "loss_control" => row.fetch("loss_control")
    }
    core.merge("id" => "cycle.#{canonical_sha(core)[0, 16]}")
  end.sort_by { |row| row.fetch("id") }
end

def risk_binding(nodes, flow_audit, calibration, cycles)
  recipe_ids = nodes.fetch("recipes")
  item_ids = nodes.fetch("inventory_items")
  numeric_proposals = calibration.fetch("numeric_patch_proposals").select do |proposal|
    recipe_ids.include?(proposal.fetch("subject_recipe_id")) ||
      !(proposal.fetch("metric_affected_recipe_ids") & recipe_ids).empty?
  end.map { |proposal| proposal.fetch("id") }.sort

  contained_cycles = cycles.select do |cycle|
    (cycle.fetch("recipes") - recipe_ids).empty? && (cycle.fetch("items") - item_ids).empty?
  end
  touched_cycles = cycles.select do |cycle|
    !(cycle.fetch("recipes") & recipe_ids).empty? || !(cycle.fetch("items") & item_ids).empty?
  end
  {
    "r2b_value_outlier_recipe_ids" => flow_audit.dig("candidate_value_calibration", "normal_ratio_outliers").to_a
                                                   .map { |row| row.fetch("id") }
                                                   .select { |id| recipe_ids.include?(id) }
                                                   .sort,
    "r2b_contained_cycle_ids" => contained_cycles.map { |cycle| cycle.fetch("id") }.sort,
    "r2b_cycle_touchpoint_ids" => (touched_cycles - contained_cycles).map { |cycle| cycle.fetch("id") }.sort,
    "r2b_shared_bottleneck_item_ids" => flow_audit.fetch("shared_bottlenecks")
                                                       .map { |row| row.fetch("id") }
                                                       .select { |id| item_ids.include?(id) }
                                                       .sort,
    "r2c_numeric_patch_proposal_ids" => numeric_proposals,
    "r2c_accepted_outlier_ids" => calibration.fetch("accepted_outliers")
                                               .select { |row| recipe_ids.include?(row.fetch("recipe_id")) }
                                               .map { |row| row.fetch("id") }
                                               .sort,
    "r2c_mass_review_recipe_ids" => calibration.fetch("mass_review_queue")
                                                  .map { |row| row.fetch("id") }
                                                  .select { |id| recipe_ids.include?(id) }
                                                  .sort
  }
end

def risk_difference(full, subset)
  full.keys.sort.to_h { |key| [key, (full.fetch(key) - subset.fetch(key)).sort] }
end

def overlap_rows(packs)
  packs.combination(2).map do |left, right|
    left_path = all_grouped_ids(left.dig("recommended_production_path", "nodes"))
    right_path = all_grouped_ids(right.dig("recommended_production_path", "nodes"))
    left_context = all_grouped_ids(left.dig("semantic_audit_context", "nodes"))
    right_context = all_grouped_ids(right.dig("semantic_audit_context", "nodes"))
    {
      "left_pack_id" => left.fetch("id"),
      "right_pack_id" => right.fetch("id"),
      "shared_root_ids" => (left.fetch("roots") & right.fetch("roots")).sort,
      "recommended_path_shared_ids" => (left_path & right_path).sort,
      "semantic_context_shared_ids" => (left_context & right_context).sort
    }
  end.sort_by { |row| [row.fetch("left_pack_id"), row.fetch("right_pack_id")] }
end

def build_markdown(report)
  lines = []
  lines << "# 候选物品库 R2-D 主题选择包"
  lines << ""
  lines << "**来源基线：** #{code(report.fetch("source_baseline_id"))}"
  lines << "**来源 Payload SHA-256：** #{code(report.fetch("source_payload_sha256"))}"
  lines << "**内容状态：** #{code(report.fetch("status"))}"
  lines << "**选择包状态：** #{code(report.fetch("selection_pack_status"))}"
  lines << "**运行时授权：** #{code(report.fetch("runtime_authorization"))}"
  lines << "**报告 SHA-256：** #{code(report.fetch("report_sha256"))}"
  lines << ""
  lines << "## 1. 结论"
  lines << ""
  lines << "- #{code("SELECTION_PACKS=PASS")}"
  lines << "- #{code("PACK_COUNT=#{report.dig("counts", "packs")}")}"
  lines << "- #{code("UNIQUE_ROOT_COUNT=#{report.dig("counts", "unique_roots")}")}"
  lines << "- #{code("RECOMMENDED_UNION_NODE_COUNT=#{report.dig("coverage", "recommended_union_node_count")}")}"
  lines << "- #{code("SEMANTIC_CONTEXT_UNION_NODE_COUNT=#{report.dig("coverage", "semantic_context_union_node_count")}")}"
  lines << ""
  lines << "推荐生产路径是未来采纳候选；完整语义闭包只用于审计。上下文节点不会自动进入推荐导入面。"
  lines << ""
  lines << "## 2. 主题包概览"
  lines << ""
  lines << "| 主题包 | 根 | 推荐物品 | 推荐工艺 | 审计上下文节点 | 数值提案 | 暂时接受异常 | 人工复核 |"
  lines << "|---|---:|---:|---:|---:|---:|---:|---:|"
  report.fetch("packs").each do |pack|
    path = pack.dig("recommended_production_path", "nodes")
    risks = pack.dig("risk_binding", "recommended_production_path")
    lines << "| #{code(pack.fetch("id"))} | #{pack.fetch("roots").length} | #{path.fetch("inventory_items").length} | #{path.fetch("recipes").length} | #{all_grouped_ids(pack.dig("audit_context_only", "nodes")).length} | #{risks.fetch("r2c_numeric_patch_proposal_ids").length} | #{risks.fetch("r2c_accepted_outlier_ids").length} | #{risks.fetch("r2c_mass_review_recipe_ids").length} |"
  end
  lines << ""

  report.fetch("packs").each_with_index do |pack, index|
    lines << "## #{index + 3}. #{pack.fetch("name")}（#{code(pack.fetch("id"))}）"
    lines << ""
    lines << pack.fetch("purpose")
    lines << ""
    lines << "### 根稳定 ID"
    lines << ""
    pack.fetch("roots").each { |id| lines << "- #{code(id)}" }
    lines << ""
    path = pack.fetch("recommended_production_path")
    lines << "### 推荐生产路径"
    lines << ""
    lines << "- 库存物品：#{path.dig("nodes", "inventory_items").length}"
    lines << "- 工艺：#{path.dig("nodes", "recipes").length}"
    lines << "- 转换：#{path.dig("nodes", "transitions").length}"
    lines << "- 非库存定义：#{path.dig("nodes", "non_inventory_definitions").length}"
    lines << "- Path SHA-256：#{code(path.fetch("path_sha256"))}"
    lines << ""
    lines << "推荐工艺："
    lines << ""
    path.dig("nodes", "recipes").each { |id| lines << "- #{code(id)}" }
    lines << ""
    risks = pack.dig("risk_binding", "recommended_production_path")
    lines << "### 校准与复核"
    lines << ""
    lines << "- 数值提案：#{risks.fetch("r2c_numeric_patch_proposal_ids").empty? ? "无" : risks.fetch("r2c_numeric_patch_proposal_ids").map { |id| code(id) }.join("、")}"
    lines << "- 暂时接受异常：#{risks.fetch("r2c_accepted_outlier_ids").empty? ? "无" : risks.fetch("r2c_accepted_outlier_ids").map { |id| code(id) }.join("、")}"
    lines << "- 质量人工复核：#{risks.fetch("r2c_mass_review_recipe_ids").empty? ? "无" : risks.fetch("r2c_mass_review_recipe_ids").map { |id| code(id) }.join("、")}"
    lines << ""
    lines << "### 审计上下文与排除"
    lines << ""
    lines << "完整语义闭包包含 #{all_grouped_ids(pack.dig("semantic_audit_context", "nodes")).length} 个节点，其中 #{all_grouped_ids(pack.dig("audit_context_only", "nodes")).length} 个只用于审计上下文。"
    lines << ""
    pack.fetch("explicit_exclusions").each { |row| lines << "- #{code(row.fetch("id"))}：#{row.fetch("reason")}" }
    lines << ""
  end

  lines << "## #{report.fetch("packs").length + 3}. 包间重叠"
  lines << ""
  lines << "| 左包 | 右包 | 共享根 | 推荐路径共享节点 | 语义上下文共享节点 |"
  lines << "|---|---|---:|---:|---:|"
  report.fetch("overlaps").each do |row|
    lines << "| #{code(row.fetch("left_pack_id"))} | #{code(row.fetch("right_pack_id"))} | #{row.fetch("shared_root_ids").length} | #{row.fetch("recommended_path_shared_ids").length} | #{row.fetch("semantic_context_shared_ids").length} |"
  end
  lines << ""
  lines << "## #{report.fetch("packs").length + 4}. 重建命令"
  lines << ""
  lines << "    ruby scripts/build_item_library_selection_packs.rb --write"
  lines << "    ruby scripts/build_item_library_selection_packs.rb"
  lines << ""
  lines << "## #{report.fetch("packs").length + 5}. 接受边界"
  lines << ""
  lines << "- 四个包均为 #{code("reference_only")}；"
  lines << "- R1 与 R2-C 数值均未修改或采纳；"
  lines << "- #{code("runtime_authorization")} 仍为 #{code("NONE")}；"
  lines << "- 不允许整包运行时导入；"
  lines << "- Gate 1A、Gate 1H 与 Gate 2 状态不变；"
  lines << "- 不替代真人试玩。"
  lines << ""
  lines.join("\n")
end

options = parse_arguments(ARGV)
required_paths = [
  BUNDLE_PATH,
  SEMANTIC_AUDIT_PATH,
  FLOW_AUDIT_PATH,
  CALIBRATION_PATH,
  R2C_REVIEW_PATH,
  SEMANTIC_SCRIPT_PATH,
  CONTRACT_PATH
]
required_paths.each { |path| abort "SELECTION_PACKS=FAIL\n- 缺少 #{path}" unless File.file?(path) }

bundle_file_sha_before = Digest::SHA256.file(BUNDLE_PATH).hexdigest
bundle = JSON.parse(File.read(BUNDLE_PATH))
semantic_audit = JSON.parse(File.read(SEMANTIC_AUDIT_PATH))
flow_audit = JSON.parse(File.read(FLOW_AUDIT_PATH))
calibration = JSON.parse(File.read(CALIBRATION_PATH))
r2c_review = File.read(R2C_REVIEW_PATH)
payload = bundle.fetch("payload")
errors = []

payload_sha = canonical_sha(payload)
errors << "Bundle Payload SHA-256 无法重算" unless payload_sha == bundle["payload_sha256"]
errors << "Bundle 基线身份错误" unless bundle["baseline_id"] == EXPECTED_BASELINE_ID
errors << "Bundle 未保持 candidate_only / NONE" unless bundle["status"] == "candidate_only" && bundle["runtime_authorization"] == "NONE"
selection_policy = bundle["selection_policy"].to_h
unless selection_policy["default_runtime_import"] == "deny" &&
       selection_policy["whole_bundle_import_allowed"] == false &&
       selection_policy["requires_explicit_stable_id_selection"] == true &&
       selection_policy["requires_separate_runtime_schema_and_gate_authorization"] == true
  errors << "Bundle 选择策略不再拒绝默认整包导入"
end

semantic_core = semantic_audit.reject { |key, _value| key == "audit_sha256" }
unless Digest::SHA256.hexdigest(JSON.generate(semantic_core)) == semantic_audit["audit_sha256"] &&
       semantic_audit["source_baseline_id"] == bundle["baseline_id"] &&
       semantic_audit["source_payload_sha256"] == bundle["payload_sha256"] &&
       semantic_audit["status"] == "candidate_only" &&
       semantic_audit["runtime_authorization"] == "NONE" &&
       semantic_audit.dig("audit", "errors").to_a.empty?
  errors << "R2-A 与当前冻结基线不一致或无法复算"
end

flow_core = flow_audit.reject { |key, _value| key == "audit_sha256" }
unless Digest::SHA256.hexdigest(JSON.generate(flow_core)) == flow_audit["audit_sha256"] &&
       flow_audit["source_baseline_id"] == bundle["baseline_id"] &&
       flow_audit["source_payload_sha256"] == bundle["payload_sha256"] &&
       flow_audit["source_semantic_audit_sha256"] == semantic_audit["audit_sha256"] &&
       flow_audit["status"] == "candidate_only" &&
       flow_audit["runtime_authorization"] == "NONE" &&
       flow_audit.dig("audit", "errors").to_a.empty?
  errors << "R2-B 与当前冻结基线不一致或无法复算"
end

calibration_core = calibration.reject { |key, _value| key == "report_sha256" }
calibration_operations = calibration.fetch("numeric_patch_proposals").flat_map { |proposal| proposal.fetch("operations") }
unless Digest::SHA256.hexdigest(JSON.generate(calibration_core)) == calibration["report_sha256"] &&
       canonical_sha(calibration_operations) == calibration["overlay_sha256"] &&
       calibration["source_baseline_id"] == bundle["baseline_id"] &&
       calibration["source_payload_sha256"] == bundle["payload_sha256"] &&
       calibration["source_semantic_audit_sha256"] == semantic_audit["audit_sha256"] &&
       calibration["source_flow_audit_sha256"] == flow_audit["audit_sha256"] &&
       calibration["proposal_mode"] == "proposal_only" &&
       calibration["status"] == "candidate_only" &&
       calibration["runtime_authorization"] == "NONE"
  errors << "R2-C 与当前冻结基线不一致或无法复算"
end
unless r2c_review.include?("R2C_REVIEW_PASS") &&
       r2c_review.include?("P0=0") &&
       r2c_review.include?("P1=0") &&
       r2c_review.include?("P2=0")
  errors << "R2-C 独立审查尚未通过"
end

unless errors.empty?
  warn "SELECTION_PACKS=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

items = payload.fetch("inventory_items").to_h { |item| [item.fetch("id"), item] }
definitions = payload.fetch("non_inventory_definitions").to_h { |definition| [definition.fetch("id"), definition] }
recipes = payload.fetch("recipes").to_h { |recipe| [recipe.fetch("id"), recipe] }
transitions = payload.fetch("transitions").to_h { |transition| [transition.fetch("id"), transition] }
all_ids = Set.new(items.keys + definitions.keys + recipes.keys + transitions.keys)
producers = recipes.values.each_with_object(Hash.new { |hash, key| hash[key] = [] }) do |recipe, memo|
  recipe_item_ids(recipe, "outputs").each do |item_id|
    memo[item_id] << { "id" => recipe.fetch("id"), "role" => "main_output" }
  end
  recipe_item_ids(recipe, "byproducts").each do |item_id|
    memo[item_id] << { "id" => recipe.fetch("id"), "role" => "byproduct" }
  end
end.transform_values { |rows| rows.uniq.sort_by { |row| [row.fetch("id"), row.fetch("role")] } }
indexes = {
  items: items,
  definitions: definitions,
  recipes: recipes,
  transitions: transitions,
  producers: producers
}
cycles = cycle_rows(flow_audit)
pack_errors = []

pack_ids = PACK_DEFINITIONS.map { |definition| definition.fetch("id") }
pack_errors << "主题包 ID 不唯一" unless pack_ids.uniq.length == pack_ids.length
all_roots = PACK_DEFINITIONS.flat_map { |definition| definition.fetch("roots") }
pack_errors << "同一稳定 ID 被重复声明为不同包的根" unless all_roots.uniq.length == all_roots.length

packs = PACK_DEFINITIONS.sort_by { |definition| definition.fetch("id") }.map do |definition|
  roots = definition.fetch("roots").uniq.sort
  unknown_roots = roots.reject { |id| all_ids.include?(id) }
  pack_errors << "#{definition.fetch("id")} 包含未知根：#{unknown_roots.join(", ")}" unless unknown_roots.empty?

  closure = invoke_semantic_closure(roots)
  path = build_recommended_path(roots, indexes)
  closure_nodes = closure.fetch("nodes")
  path_nodes = path.fetch("nodes")
  path_all_ids = all_grouped_ids(path_nodes)
  closure_all_ids = all_grouped_ids(closure_nodes)
  missing_from_closure = path_all_ids - closure_all_ids
  pack_errors << "#{definition.fetch("id")} 推荐路径不是 R2-A 闭包子集：#{missing_from_closure.join(", ")}" unless missing_from_closure.empty?
  closure_core = closure.reject { |key, _value| key == "closure_sha256" }
  unless Digest::SHA256.hexdigest(JSON.generate(closure_core)) == closure.fetch("closure_sha256") &&
         closure.fetch("source_baseline_id") == bundle.fetch("baseline_id") &&
         closure.fetch("source_payload_sha256") == bundle.fetch("payload_sha256") &&
         closure.fetch("status") == "candidate_only" &&
         closure.fetch("runtime_authorization") == "NONE"
    pack_errors << "#{definition.fetch("id")} R2-A 闭包身份或 SHA-256 不一致"
  end

  invalid_recipe_ids = path_nodes.fetch("recipes").select { |id| %w[repair dismantle].include?(recipes.fetch(id).fetch("kind")) }
  pack_errors << "#{definition.fetch("id")} 推荐路径包含维修或拆解：#{invalid_recipe_ids.join(", ")}" unless invalid_recipe_ids.empty?
  unsatisfied = path.fetch("required_input_supply").select { |row| row.fetch("supply_mode") == "unsatisfied" }
  pack_errors << "#{definition.fetch("id")} 推荐路径存在无来源输入：#{unsatisfied.map { |row| row.fetch("id") }.join(", ")}" unless unsatisfied.empty?
  path_reference_errors(path, indexes).each do |error|
    pack_errors << "#{definition.fetch("id")} #{error}"
  end

  excluded_ids = definition.fetch("explicit_exclusions").map { |row| row.fetch("id") }
  unknown_exclusions = excluded_ids.reject { |id| all_ids.include?(id) }
  pack_errors << "#{definition.fetch("id")} 包含未知排除项：#{unknown_exclusions.join(", ")}" unless unknown_exclusions.empty?
  leaked_exclusions = excluded_ids & (roots + path_all_ids)
  pack_errors << "#{definition.fetch("id")} 排除项进入根或推荐路径：#{leaked_exclusions.join(", ")}" unless leaked_exclusions.empty?

  recommended_risks = risk_binding(path_nodes, flow_audit, calibration, cycles)
  context_risks = risk_binding(closure_nodes, flow_audit, calibration, cycles)
  context_only_risks = risk_difference(context_risks, recommended_risks)
  context_only = { "nodes" => difference_nodes(closure_nodes, path_nodes) }
  context_only["context_sha256"] = canonical_sha(context_only.fetch("nodes"))
  readiness = {
    "selection_planning" => "complete",
    "calibration_decision" => recommended_risks.fetch("r2c_numeric_patch_proposal_ids").empty? ? "not_required" : "required",
    "manual_review" => (recommended_risks.fetch("r2c_accepted_outlier_ids") + recommended_risks.fetch("r2c_mass_review_recipe_ids")).empty? ? "not_required" : "required",
    "semantic_warning_review" => closure.fetch("applicable_warnings").empty? ? "not_required" : "required",
    "runtime_readiness" => "blocked",
    "runtime_blockers" => [
      "no runtime schema",
      "R2-C proposals not adopted",
      "no target Gate authorization",
      "no runtime or human playtest evidence"
    ]
  }

  pack_core = {
    "id" => definition.fetch("id"),
    "name" => definition.fetch("name"),
    "resource_focus" => definition.fetch("resource_focus").sort,
    "purpose" => definition.fetch("purpose"),
    "roots" => roots,
    "explicit_exclusions" => definition.fetch("explicit_exclusions").sort_by { |row| row.fetch("id") },
    "recommended_production_path" => path,
    "semantic_audit_context" => closure,
    "audit_context_only" => context_only,
    "risk_binding" => {
      "recommended_production_path" => recommended_risks,
      "semantic_audit_context" => context_risks,
      "audit_context_only" => context_only_risks
    },
    "readiness" => readiness
  }
  pack_core.merge("pack_sha256" => canonical_sha(pack_core))
rescue RuntimeError => e
  pack_errors << "#{definition.fetch("id")} 生成失败：#{e.message}"
  nil
end.compact

unless pack_errors.empty?
  warn "SELECTION_PACKS=FAIL"
  pack_errors.sort.each { |error| warn "- #{error}" }
  exit 1
end

overlaps = overlap_rows(packs)
recommended_union = packs.flat_map { |pack| all_grouped_ids(pack.dig("recommended_production_path", "nodes")) }.uniq.sort
context_union = packs.flat_map { |pack| all_grouped_ids(pack.dig("semantic_audit_context", "nodes")) }.uniq.sort
all_catalog_ids = all_ids.to_a.sort
coverage = {
  "recommended_union_node_count" => recommended_union.length,
  "recommended_union_ids" => recommended_union,
  "semantic_context_union_node_count" => context_union.length,
  "semantic_context_union_ids" => context_union,
  "catalog_node_count" => all_catalog_ids.length,
  "catalog_ids_not_in_recommended_union" => all_catalog_ids - recommended_union,
  "catalog_ids_not_in_semantic_context_union" => all_catalog_ids - context_union
}

report_core = {
  "schema_version" => "new-era-2.item-library.selection-packs.r2d.v0.1",
  "source_baseline_id" => bundle.fetch("baseline_id"),
  "source_payload_sha256" => bundle.fetch("payload_sha256"),
  "source_semantic_audit_sha256" => semantic_audit.fetch("audit_sha256"),
  "source_flow_audit_sha256" => flow_audit.fetch("audit_sha256"),
  "source_calibration_report_sha256" => calibration.fetch("report_sha256"),
  "source_calibration_overlay_sha256" => calibration.fetch("overlay_sha256"),
  "source_bundle_file_sha256" => bundle_file_sha_before,
  "status" => bundle.fetch("status"),
  "selection_pack_status" => "reference_only",
  "runtime_authorization" => bundle.fetch("runtime_authorization"),
  "whole_bundle_runtime_import_allowed" => false,
  "source_files" => {
    "data/item-library/item-library-r1-candidate-bundle.json" => Digest::SHA256.file(BUNDLE_PATH).hexdigest,
    "data/item-library/semantic-audit-r2a.json" => Digest::SHA256.file(SEMANTIC_AUDIT_PATH).hexdigest,
    "data/item-library/flow-audit-r2b.json" => Digest::SHA256.file(FLOW_AUDIT_PATH).hexdigest,
    "data/item-library/calibration-proposals-r2c.json" => Digest::SHA256.file(CALIBRATION_PATH).hexdigest,
    "docs/item-library/reviews/item-library-r2c-review-status-2026-07-30.md" => Digest::SHA256.file(R2C_REVIEW_PATH).hexdigest,
    "scripts/audit_item_library_semantics.rb" => Digest::SHA256.file(SEMANTIC_SCRIPT_PATH).hexdigest,
    "docs/item-library/item-library-selection-pack-contract-v0.1.md" => Digest::SHA256.file(CONTRACT_PATH).hexdigest,
    "scripts/build_item_library_selection_packs.rb" => Digest::SHA256.file(__FILE__).hexdigest
  },
  "counts" => {
    "packs" => packs.length,
    "unique_roots" => all_roots.uniq.length,
    "catalog_nodes" => all_ids.length,
    "inventory_items" => items.length,
    "recipes" => recipes.length,
    "transitions" => transitions.length,
    "non_inventory_definitions" => definitions.length
  },
  "cycle_catalog" => cycles,
  "packs" => packs,
  "overlaps" => overlaps,
  "coverage" => coverage,
  "acceptance_boundary" => {
    "r1_modified" => false,
    "r2c_proposals_adopted" => false,
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
  puts "SELECTION_PACKS_JSON=WRITTEN #{JSON_REPORT_PATH}"
  puts "SELECTION_PACKS_MARKDOWN=WRITTEN #{MARKDOWN_REPORT_PATH}"
else
  unless File.file?(JSON_REPORT_PATH) && File.read(JSON_REPORT_PATH) == json_output
    warn "SELECTION_PACKS=FAIL"
    warn "- #{File.basename(JSON_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
  unless File.file?(MARKDOWN_REPORT_PATH) && File.read(MARKDOWN_REPORT_PATH) == markdown_output
    warn "SELECTION_PACKS=FAIL"
    warn "- #{File.basename(MARKDOWN_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
end

unless Digest::SHA256.file(BUNDLE_PATH).hexdigest == bundle_file_sha_before
  warn "SELECTION_PACKS=FAIL"
  warn "- R1 Bundle 在生成期间发生变化"
  exit 1
end

puts "SELECTION_PACKS=PASS"
puts "PACK_COUNT=#{packs.length}"
puts "UNIQUE_ROOT_COUNT=#{all_roots.uniq.length}"
puts "RECOMMENDED_UNION_NODE_COUNT=#{recommended_union.length}"
puts "SEMANTIC_CONTEXT_UNION_NODE_COUNT=#{context_union.length}"
packs.each do |pack|
  puts "PACK=#{pack.fetch("id")} ROOTS=#{pack.fetch("roots").length} RECOMMENDED_NODES=#{all_grouped_ids(pack.dig("recommended_production_path", "nodes")).length} CONTEXT_ONLY_NODES=#{all_grouped_ids(pack.dig("audit_context_only", "nodes")).length}"
end
puts "REPORT_SHA256=#{report_sha}"
puts "R1_BUNDLE_FILE_SHA256=#{bundle_file_sha_before}"
puts "R1_PAYLOAD_SHA256=#{bundle.fetch("payload_sha256")}"
puts "RUNTIME_AUTHORIZATION=#{bundle.fetch("runtime_authorization")}"
