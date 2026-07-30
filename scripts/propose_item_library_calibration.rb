#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"

ROOT = File.expand_path("..", __dir__)
BUNDLE_PATH = File.join(ROOT, "data/item-library/item-library-r1-candidate-bundle.json")
SEMANTIC_AUDIT_PATH = File.join(ROOT, "data/item-library/semantic-audit-r2a.json")
FLOW_AUDIT_PATH = File.join(ROOT, "data/item-library/flow-audit-r2b.json")
CONTRACT_PATH = File.join(ROOT, "docs/item-library/item-library-calibration-contract-v0.1.md")
JSON_REPORT_PATH = File.join(ROOT, "data/item-library/calibration-proposals-r2c.json")
MARKDOWN_REPORT_PATH = File.join(ROOT, "data/item-library/calibration-proposals-r2c.md")

EXPECTED_BASELINE_ID = "new-era-2.item-library.r1-c7-candidate"
MASS_REVIEW_RATIO = 1.05
MASS_SEVERE_RATIO = 1.25
MASS_LOW_RATIO = 0.25
VALUE_RATIO_LOW = 0.25
VALUE_RATIO_HIGH = 4.0

PROPOSAL_DEFINITIONS = [
  {
    "id" => "r2c.numeric.01_flour_unit_mass",
    "subject_recipe_id" => "recipe.c5_food.mill_flour",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "面粉以 bag 计量，但 10 kg/bag 会让 1 kg 原粮产出最多 9 kg 面粉，并使两张下游烘焙工艺把一袋面粉按 10 kg 计入。把候选袋质量改为 1 kg，可同时校正磨粉和下游画像。",
    "operations" => [
      { "type" => "replace_item_field", "item_id" => "item.food.grain_flour", "field" => "mass", "from" => 10.0, "to" => 1.0 }
    ]
  },
  {
    "id" => "r2c.numeric.02_watch_dismantle_yield",
    "subject_recipe_id" => "recipe.dismantle.mechanical_watch",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "0.1 kg 腕表的回收上限不应超过目标质量。按精密小件比例缩小机械备件和金属边角料区间。",
    "operations" => [
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.mechanical_watch", "item_id" => "item.component.mechanical_spares", "field" => "min", "from" => 0.05, "to" => 0.01 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.mechanical_watch", "item_id" => "item.component.mechanical_spares", "field" => "max", "from" => 0.15, "to" => 0.025 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.mechanical_watch", "item_id" => "item.waste.metal_offcuts", "field" => "min", "from" => 0.02, "to" => 0.005 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.mechanical_watch", "item_id" => "item.waste.metal_offcuts", "field" => "max", "from" => 0.08, "to" => 0.02 }
    ]
  },
  {
    "id" => "r2c.numeric.03_biomass_briquette_units",
    "subject_recipe_id" => "recipe.c4_wood.compress_briquette",
    "triggers" => ["mass_severe_amplification", "candidate_value_outlier"],
    "rationale" => "当前一袋 4 kg 木屑会产出最多 10.2 kg 压块。提高木屑批量并略收紧产出上限，使最大质量返回比低于 1，候选价值比回到筛查区间。",
    "operations" => [
      { "type" => "replace_recipe_input_amount", "recipe_id" => "recipe.c4_wood.compress_briquette", "item_id" => "item.waste.sawdust", "from" => 1.0, "to" => 2.5 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.c4_wood.compress_briquette", "item_id" => "item.material.biomass_briquette", "field" => "max", "from" => 0.85, "to" => 0.8 }
    ]
  },
  {
    "id" => "r2c.numeric.04_battery_module_casing",
    "subject_recipe_id" => "recipe.c4_battery.assemble_module",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "8 kg 电池模块的既有输入只有 3.5 kg，描述中缺少可审计的结构外壳。提案增加 0.25 bundle 回收金属板作为候选壳体材料。",
    "operations" => [
      { "type" => "add_recipe_input", "recipe_id" => "recipe.c4_battery.assemble_module", "from" => nil, "to" => { "item" => "item.material.reclaimed_steel_plate", "amount" => 0.25, "consumed" => true } }
    ]
  },
  {
    "id" => "r2c.numeric.05_archive_drive_recovery",
    "subject_recipe_id" => "recipe.dismantle.offline_archive_drive",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "0.6 kg 档案盘的电子件与铜线最大回收质量达到 1.29 kg。缩小两项回收区间，使最大库存回收质量为 0.51 kg。",
    "operations" => [
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.offline_archive_drive", "item_id" => "item.component.recovered_electronics", "field" => "min", "from" => 0.3, "to" => 0.2 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.offline_archive_drive", "item_id" => "item.component.recovered_electronics", "field" => "max", "from" => 0.7, "to" => 0.3 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.offline_archive_drive", "item_id" => "item.material.copper_wire", "field" => "min", "from" => 0.05, "to" => 0.03 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.offline_archive_drive", "item_id" => "item.material.copper_wire", "field" => "max", "from" => 0.15, "to" => 0.05 }
    ]
  },
  {
    "id" => "r2c.numeric.06_sterile_bandage_unit",
    "subject_recipe_id" => "recipe.medical.sterilize_bandage",
    "triggers" => ["mass_severe_amplification", "candidate_value_outlier"],
    "rationale" => "单包绷带的 0.3 kg 与 14 候选价值同时放大产出。改为 0.12 kg、4 候选价值后，最大质量返回比和候选价值比都回到筛查区间。",
    "operations" => [
      { "type" => "replace_item_field", "item_id" => "item.medical.sterile_bandage", "field" => "mass", "from" => 0.3, "to" => 0.12 },
      { "type" => "replace_item_field", "item_id" => "item.medical.sterile_bandage", "field" => "base_value", "from" => 14.0, "to" => 4.0 }
    ]
  },
  {
    "id" => "r2c.numeric.07_field_bed_frame",
    "subject_recipe_id" => "recipe.c2_assembly.field_bed",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "9 kg 野战床只有 5.1 kg 已消耗库存输入。把回收金属板从 0.15 提高到 0.35 bundle，为折叠框架补足候选结构质量。",
    "operations" => [
      { "type" => "replace_recipe_input_amount", "recipe_id" => "recipe.c2_assembly.field_bed", "item_id" => "item.material.reclaimed_steel_plate", "from" => 0.15, "to" => 0.35 }
    ]
  },
  {
    "id" => "r2c.numeric.08_fastener_batch",
    "subject_recipe_id" => "recipe.metal.form_fasteners",
    "triggers" => ["mass_severe_amplification", "candidate_value_outlier"],
    "rationale" => "紧固件工艺同时存在质量放大与高候选价值比。提高板材输入并收紧紧固件上限，先修正质量；剩余价值溢价单独作为暂时接受异常。",
    "operations" => [
      { "type" => "replace_recipe_input_amount", "recipe_id" => "recipe.metal.form_fasteners", "item_id" => "item.material.reclaimed_steel_plate", "from" => 0.25, "to" => 0.4 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.metal.form_fasteners", "item_id" => "item.component.fastener_set", "field" => "max", "from" => 8.0, "to" => 7.0 }
    ]
  },
  {
    "id" => "r2c.numeric.09_field_repair_kit_packaging",
    "subject_recipe_id" => "recipe.metal.assemble_field_repair_kit",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "5 kg 现场维修包的既有内容物只有 3.8 kg。增加 0.3 roll 通用织物，代表工具卷、隔层与封装材料。",
    "operations" => [
      { "type" => "add_recipe_input", "recipe_id" => "recipe.metal.assemble_field_repair_kit", "from" => nil, "to" => { "item" => "item.material.woven_cloth", "amount" => 0.3, "consumed" => true } }
    ]
  },
  {
    "id" => "r2c.numeric.10_wired_alarm_housing",
    "subject_recipe_id" => "recipe.electrical.assemble_wired_alarm_unit",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "6 kg 有线预警单元的既有电子与线束输入只有 4.6 kg。增加 0.08 bundle 回收金属板作为候选外壳和安装底板。",
    "operations" => [
      { "type" => "add_recipe_input", "recipe_id" => "recipe.electrical.assemble_wired_alarm_unit", "from" => nil, "to" => { "item" => "item.material.reclaimed_steel_plate", "amount" => 0.08, "consumed" => true } }
    ]
  },
  {
    "id" => "r2c.numeric.11_bolt_rifle_recovery",
    "subject_recipe_id" => "recipe.dismantle.bolt_rifle",
    "triggers" => ["mass_severe_amplification"],
    "rationale" => "4.2 kg 步枪的最大库存回收质量为 5.36 kg。收紧机械件、板材和边角料上限，使最大回收质量低于目标质量。",
    "operations" => [
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.bolt_rifle", "item_id" => "item.component.mechanical_spares", "field" => "max", "from" => 0.8, "to" => 0.6 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.bolt_rifle", "item_id" => "item.material.reclaimed_steel_plate", "field" => "max", "from" => 0.12, "to" => 0.08 },
      { "type" => "replace_recipe_output_field", "recipe_id" => "recipe.dismantle.bolt_rifle", "item_id" => "item.waste.metal_offcuts", "field" => "max", "from" => 1.2, "to" => 0.8 }
    ]
  },
  {
    "id" => "r2c.numeric.12_workshop_stool_lumber",
    "subject_recipe_id" => "recipe.c7_furniture.make_workshop_stool",
    "triggers" => ["candidate_value_outlier"],
    "rationale" => "工艺把 24 kg/bundle 的整形木板按七个 bundle 使用，明显混淆了 bundle 与单块木板。改为 0.30 bundle。",
    "operations" => [
      { "type" => "replace_recipe_input_amount", "recipe_id" => "recipe.c7_furniture.make_workshop_stool", "item_id" => "item.material.reclaimed_lumber", "from" => 7.0, "to" => 0.3 }
    ]
  },
  {
    "id" => "r2c.numeric.13_communal_bench_lumber",
    "subject_recipe_id" => "recipe.c7_furniture.make_communal_bench",
    "triggers" => ["candidate_value_outlier"],
    "rationale" => "公共长凳把 24 kg/bundle 的木板按 14 个 bundle 使用。改为 0.75 bundle，使质量与候选价值同时回到筛查区间。",
    "operations" => [
      { "type" => "replace_recipe_input_amount", "recipe_id" => "recipe.c7_furniture.make_communal_bench", "item_id" => "item.material.reclaimed_lumber", "from" => 14.0, "to" => 0.75 }
    ]
  },
  {
    "id" => "r2c.numeric.14_storage_shelf_lumber",
    "subject_recipe_id" => "recipe.c7_furniture.make_storage_shelf",
    "triggers" => ["candidate_value_outlier"],
    "rationale" => "储物架把 24 kg/bundle 的木板按 18 个 bundle 使用。改为 0.90 bundle，使质量与候选价值同时回到筛查区间。",
    "operations" => [
      { "type" => "replace_recipe_input_amount", "recipe_id" => "recipe.c7_furniture.make_storage_shelf", "item_id" => "item.material.reclaimed_lumber", "from" => 18.0, "to" => 0.9 }
    ]
  },
  {
    "id" => "r2c.numeric.15_reinforced_plate_offcuts",
    "subject_recipe_id" => "recipe.metal.assemble_reinforced_plate",
    "triggers" => ["candidate_value_outlier", "mass_review_band"],
    "rationale" => "粗制防护插板只轻微超重，先把金属边角料最大值从 1.5 kg 收紧到 1.2 kg，使最大库存输出质量等于输入质量；剩余候选价值溢价单独裁定。",
    "operations" => [
      { "type" => "replace_recipe_byproduct_field", "recipe_id" => "recipe.metal.assemble_reinforced_plate", "item_id" => "item.waste.metal_offcuts", "field" => "max", "from" => 1.5, "to" => 1.2 }
    ]
  }
].freeze

ACCEPTED_OUTLIER_DEFINITIONS = [
  {
    "id" => "r2c.accepted.01_fastener_value_premium",
    "recipe_id" => "recipe.metal.form_fasteners",
    "dimension" => "candidate_value",
    "rationale" => "质量修正后仍有标准化、精密加工与 3–5 小时人物时间溢价。当前 base_value 继续保留，以免在没有运行时维修需求数据时同时改写 24 张下游工艺的价值关系。",
    "reevaluation_requirement" => "任何包含紧固件的稳定 ID 子集进入运行时前，必须用实际维修消耗、人物时间与下游订单数据重新校准。",
    "status" => "provisional"
  },
  {
    "id" => "r2c.accepted.02_reinforced_plate_value_premium",
    "recipe_id" => "recipe.metal.assemble_reinforced_plate",
    "dimension" => "candidate_value",
    "rationale" => "质量修正后剩余候选价值溢价可暂由受控装配、品质检查、安全用途和 4–7 小时人物时间解释；没有足够证据直接降低防护件价值。",
    "reevaluation_requirement" => "选择防护插板进入运行时前，必须与伤害、防护、耐久和制造失败率一起校准。",
    "status" => "provisional"
  }
].freeze

def parse_arguments(argv)
  options = { write: false }
  argv.each do |argument|
    case argument
    when "--write"
      options[:write] = true
    else
      abort "CALIBRATION_PROPOSALS=FAIL\n- 未知参数 #{argument}"
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

def round_number(value)
  value.nil? ? nil : value.round(6)
end

def numeric_equal?(left, right)
  left == right
end

def item_entries(recipe)
  recipe.fetch("outputs", []) + recipe.fetch("byproducts", []).select { |entry| entry["item"] }
end

def metric_profile(recipe, items)
  kind = recipe.fetch("kind")
  input_mass = if kind == "dismantle"
                 items.fetch(recipe.dig("target", "item")).fetch("mass").to_f
               else
                 recipe.fetch("inputs", []).select { |entry| entry["consumed"] == true }.sum do |entry|
                   items.fetch(entry.fetch("item")).fetch("mass").to_f * entry.fetch("amount").to_f
                 end
               end
  input_value = if kind == "dismantle"
                  items.fetch(recipe.dig("target", "item")).fetch("base_value").to_f
                else
                  recipe.fetch("inputs", []).select { |entry| entry["consumed"] == true }.sum do |entry|
                    items.fetch(entry.fetch("item")).fetch("base_value").to_f * entry.fetch("amount").to_f
                  end
                end
  outputs = item_entries(recipe)
  output_mass_min = outputs.sum { |entry| items.fetch(entry.fetch("item")).fetch("mass").to_f * entry.fetch("min").to_f }
  output_mass_max = outputs.sum { |entry| items.fetch(entry.fetch("item")).fetch("mass").to_f * entry.fetch("max").to_f }
  output_value_min = outputs.sum { |entry| items.fetch(entry.fetch("item")).fetch("base_value").to_f * entry.fetch("min").to_f }
  output_value_max = outputs.sum { |entry| items.fetch(entry.fetch("item")).fetch("base_value").to_f * entry.fetch("max").to_f }
  mass_ratio_min = kind == "repair" || input_mass <= 0 ? nil : output_mass_min / input_mass
  mass_ratio_max = kind == "repair" || input_mass <= 0 ? nil : output_mass_max / input_mass
  value_ratio_min = kind == "repair" || input_value <= 0 ? nil : output_value_min / input_value
  value_ratio_max = kind == "repair" || input_value <= 0 ? nil : output_value_max / input_value

  {
    "input_mass" => input_mass,
    "output_mass_min" => output_mass_min,
    "output_mass_max" => output_mass_max,
    "mass_return_ratio_min" => mass_ratio_min,
    "mass_return_ratio_max" => mass_ratio_max,
    "input_candidate_value" => input_value,
    "output_candidate_value_min" => output_value_min,
    "output_candidate_value_max" => output_value_max,
    "candidate_value_return_ratio_min" => value_ratio_min,
    "candidate_value_return_ratio_max" => value_ratio_max
  }
end

def serialized_metrics(metrics)
  metrics.to_h do |key, value|
    [key, value.is_a?(Numeric) ? round_number(value) : value]
  end
end

def mass_classification(recipe, metrics)
  return "not_applicable" if recipe["kind"] == "repair"

  ratio = metrics["mass_return_ratio_max"]
  return "unscorable" unless ratio
  return "severe_amplification" if ratio > MASS_SEVERE_RATIO
  return "review_band" if ratio > MASS_REVIEW_RATIO
  return "low_ratio_report_only" if ratio < MASS_LOW_RATIO

  "within_screen"
end

def value_outlier?(recipe, metrics)
  return false if %w[dismantle repair].include?(recipe["kind"])

  ratio = metrics["candidate_value_return_ratio_max"]
  ratio && (ratio < VALUE_RATIO_LOW || ratio > VALUE_RATIO_HIGH)
end

def assert_strict_threshold_semantics!
  synthetic_recipe = { "kind" => "assembly" }
  mass_cases = [
    [1.2500004, "severe_amplification"],
    [1.0500004, "review_band"],
    [0.2499996, "low_ratio_report_only"]
  ]
  mass_cases.each do |ratio, expected|
    actual = mass_classification(synthetic_recipe, { "mass_return_ratio_max" => ratio })
    raise "质量阈值内部回归失败：#{ratio} => #{actual}，预期 #{expected}" unless actual == expected
  end

  [4.0000004, 0.2499996].each do |ratio|
    metrics = { "candidate_value_return_ratio_max" => ratio }
    raise "价值阈值内部回归失败：#{ratio} 未判为异常" unless value_outlier?(synthetic_recipe, metrics)
  end
end

def locate_unique(entries, item_id, context)
  matches = entries.select { |entry| entry["item"] == item_id }
  raise "#{context}: 预期唯一引用 #{item_id}，实际 #{matches.length}" unless matches.length == 1

  matches.first
end

def apply_operation!(payload, operation)
  items = payload.fetch("inventory_items").to_h { |item| [item.fetch("id"), item] }
  recipes = payload.fetch("recipes").to_h { |recipe| [recipe.fetch("id"), recipe] }
  case operation.fetch("type")
  when "replace_item_field"
    item = items.fetch(operation.fetch("item_id"))
    field = operation.fetch("field")
    actual = item.fetch(field)
    raise "#{operation["item_id"]}.#{field}: from 漂移" unless numeric_equal?(actual, operation.fetch("from"))

    item[field] = operation.fetch("to")
  when "replace_recipe_input_amount"
    recipe = recipes.fetch(operation.fetch("recipe_id"))
    entry = locate_unique(recipe.fetch("inputs"), operation.fetch("item_id"), operation.fetch("recipe_id"))
    raise "#{operation["recipe_id"]} input amount: from 漂移" unless numeric_equal?(entry.fetch("amount"), operation.fetch("from"))

    entry["amount"] = operation.fetch("to")
  when "replace_recipe_output_field"
    recipe = recipes.fetch(operation.fetch("recipe_id"))
    entry = locate_unique(recipe.fetch("outputs"), operation.fetch("item_id"), operation.fetch("recipe_id"))
    field = operation.fetch("field")
    raise "#{operation["recipe_id"]} output #{field}: from 漂移" unless numeric_equal?(entry.fetch(field), operation.fetch("from"))

    entry[field] = operation.fetch("to")
  when "replace_recipe_byproduct_field"
    recipe = recipes.fetch(operation.fetch("recipe_id"))
    entries = recipe.fetch("byproducts", []).select { |entry| entry["item"] }
    entry = locate_unique(entries, operation.fetch("item_id"), operation.fetch("recipe_id"))
    field = operation.fetch("field")
    raise "#{operation["recipe_id"]} byproduct #{field}: from 漂移" unless numeric_equal?(entry.fetch(field), operation.fetch("from"))

    entry[field] = operation.fetch("to")
  when "add_recipe_input"
    recipe = recipes.fetch(operation.fetch("recipe_id"))
    entry = operation.fetch("to")
    raise "#{operation["recipe_id"]}: 新增输入 from 必须为 null" unless operation["from"].nil?
    raise "#{operation["recipe_id"]}: 已存在待新增输入 #{entry["item"]}" if recipe.fetch("inputs").any? { |current| current["item"] == entry["item"] }
    raise "#{operation["recipe_id"]}: 新增输入引用未知物品 #{entry["item"]}" unless items.key?(entry["item"])

    recipe.fetch("inputs") << Marshal.load(Marshal.dump(entry))
  else
    raise "未知操作 #{operation["type"]}"
  end
end

def output_item_ids(recipe)
  item_entries(recipe).map { |entry| entry.fetch("item") }.uniq.sort
end

def build_markdown(report)
  counts = report.fetch("counts")
  lines = []
  lines << "# 候选物品库 R2-C 单位与候选价值校准提案"
  lines << ""
  lines << "**来源基线：** `#{report.fetch("source_baseline_id")}`"
  lines << "**来源 Payload SHA-256：** `#{report.fetch("source_payload_sha256")}`"
  lines << "**状态：** `#{report.fetch("status")}`"
  lines << "**运行时授权：** `#{report.fetch("runtime_authorization")}`"
  lines << "**提案模式：** `#{report.fetch("proposal_mode")}`"
  lines << "**Overlay SHA-256：** `#{report.fetch("overlay_sha256")}`"
  lines << "**报告 SHA-256：** `#{report.fetch("report_sha256")}`"
  lines << ""
  lines << "## 1. 结论"
  lines << ""
  lines << "- `CALIBRATION_PROPOSALS=PASS`"
  lines << "- `RECIPES_PROFILED=#{counts.fetch("recipes_profiled")}`"
  lines << "- `BASELINE_SEVERE_MASS_COUNT=#{counts.fetch("baseline_severe_mass")}`"
  lines << "- `BASELINE_MASS_REVIEW_COUNT=#{counts.fetch("baseline_mass_review")}`"
  lines << "- `BASELINE_VALUE_OUTLIER_COUNT=#{counts.fetch("baseline_value_outliers")}`"
  lines << "- `NUMERIC_PATCH_PROPOSAL_COUNT=#{counts.fetch("numeric_patch_proposals")}`"
  lines << "- `ACCEPTED_OUTLIER_COUNT=#{counts.fetch("accepted_outliers")}`"
  lines << "- `OVERLAY_UNADJUDICATED_SEVERE_MASS_COUNT=#{counts.fetch("overlay_unadjudicated_severe_mass")}`"
  lines << "- `OVERLAY_UNADJUDICATED_VALUE_OUTLIER_COUNT=#{counts.fetch("overlay_unadjudicated_value_outliers")}`"
  lines << ""
  lines << "全部修改只应用于内存 overlay；R1 Bundle、分片 YAML 和运行时数据均未修改。"
  lines << ""
  lines << "## 2. 数值提案"
  lines << ""
  lines << "| 提案 | 目标工艺 | 基线最大质量比 | Overlay 最大质量比 | 基线最大价值比 | Overlay 最大价值比 |"
  lines << "|---|---|---:|---:|---:|---:|"
  report.fetch("numeric_patch_proposals").each do |proposal|
    before = proposal.fetch("before_metrics")
    after = proposal.fetch("after_metrics")
    lines << "| `#{proposal.fetch("id")}` | `#{proposal.fetch("subject_recipe_id")}` | #{before["mass_return_ratio_max"] || "—"} | #{after["mass_return_ratio_max"] || "—"} | #{before["candidate_value_return_ratio_max"] || "—"} | #{after["candidate_value_return_ratio_max"] || "—"} |"
  end
  lines << ""
  report.fetch("numeric_patch_proposals").each do |proposal|
    lines << "### `#{proposal.fetch("id")}`"
    lines << ""
    lines << proposal.fetch("rationale")
    lines << ""
    proposal.fetch("operations").each do |operation|
      target = operation["item_id"] || operation.dig("to", "item")
      change = if operation["type"] == "add_recipe_input"
                 "新增输入 `#{target}`，amount=#{operation.dig("to", "amount")}"
               else
                 "#{operation["field"] || "amount"}：#{operation["from"]} → #{operation["to"]}"
               end
      lines << "- `#{operation.fetch("type")}` / `#{target}` / #{change}"
    end
    lines << "- 下游受影响工艺：#{proposal.fetch("downstream_recipe_ids").empty? ? "无" : proposal.fetch("downstream_recipe_ids").map { |id| "`#{id}`" }.join("、")}"
    lines << ""
  end
  lines << "## 3. 暂时接受的残余异常"
  lines << ""
  lines << "| 裁定 | 工艺 | Overlay 最大价值比 | 状态 |"
  lines << "|---|---|---:|---|"
  report.fetch("accepted_outliers").each do |row|
    lines << "| `#{row.fetch("id")}` | `#{row.fetch("recipe_id")}` | #{row.fetch("overlay_ratio")} | #{row.fetch("status")} |"
  end
  lines << ""
  report.fetch("accepted_outliers").each do |row|
    lines << "- `#{row.fetch("id")}`：#{row.fetch("rationale")} #{row.fetch("reevaluation_requirement")}"
  end
  lines << ""
  lines << "## 4. 质量人工复核队列"
  lines << ""
  lines << "| 工艺 | 基线最大质量比 | Overlay 最大质量比 | 复核提示 |"
  lines << "|---|---:|---:|---|"
  report.fetch("mass_review_queue").each do |row|
    lines << "| `#{row.fetch("id")}` | #{row.fetch("baseline_ratio")} | #{row.fetch("overlay_ratio")} | #{row.fetch("review_hint")} |"
  end
  lines << ""
  lines << "该队列不自动改数值；容器、含水率、燃料、外壳和回收区间必须结合未来 Gate 子集判断。"
  lines << ""
  lines << "## 5. 重建命令"
  lines << ""
  lines << "```bash"
  lines << "ruby scripts/propose_item_library_calibration.rb --write"
  lines << "ruby scripts/propose_item_library_calibration.rb"
  lines << "```"
  lines << ""
  lines << "## 6. 接受边界"
  lines << ""
  lines << "- 本文件是 `proposal_only`，不是 R1 修订版；"
  lines << "- 全部内容仍为 `candidate_only`；"
  lines << "- `runtime_authorization` 仍为 `NONE`；"
  lines << "- 不允许整包运行时导入；"
  lines << "- Gate 1A、Gate 1H 与 Gate 2 状态不因本提案改变。"
  lines << ""
  lines.join("\n")
end

options = parse_arguments(ARGV)
begin
  assert_strict_threshold_semantics!
rescue RuntimeError => e
  abort "CALIBRATION_PROPOSALS=FAIL\n- #{e.message}"
end
[BUNDLE_PATH, SEMANTIC_AUDIT_PATH, FLOW_AUDIT_PATH, CONTRACT_PATH].each do |path|
  abort "CALIBRATION_PROPOSALS=FAIL\n- 缺少 #{path}" unless File.file?(path)
end

bundle_bytes_before = File.binread(BUNDLE_PATH)
bundle_file_sha_before = Digest::SHA256.hexdigest(bundle_bytes_before)
bundle = JSON.parse(bundle_bytes_before.dup)
semantic_audit = JSON.parse(File.read(SEMANTIC_AUDIT_PATH))
flow_audit = JSON.parse(File.read(FLOW_AUDIT_PATH))
payload = bundle.fetch("payload")
errors = []

calculated_payload_sha = Digest::SHA256.hexdigest(JSON.generate(canonicalize_json(payload)))
errors << "Bundle payload_sha256 无法重算" unless bundle["payload_sha256"] == calculated_payload_sha
errors << "Bundle 基线身份错误" unless bundle["baseline_id"] == EXPECTED_BASELINE_ID
errors << "Bundle 未保持 candidate_only / NONE" unless bundle["status"] == "candidate_only" && bundle["runtime_authorization"] == "NONE"
selection_policy = bundle["selection_policy"].to_h
unless selection_policy["default_runtime_import"] == "deny" &&
       selection_policy["whole_bundle_import_allowed"] == false &&
       selection_policy["requires_explicit_stable_id_selection"] == true &&
       selection_policy["requires_separate_runtime_schema_and_gate_authorization"] == true
  errors << "Bundle 选择策略不再拒绝默认整包导入"
end

expected_counts = {
  "inventory_items" => payload.fetch("inventory_items").length,
  "non_inventory_definitions" => payload.fetch("non_inventory_definitions").length,
  "catalog_definitions" => payload.fetch("inventory_items").length + payload.fetch("non_inventory_definitions").length,
  "recipes" => payload.fetch("recipes").length,
  "transitions" => payload.fetch("transitions").length
}
errors << "Bundle counts 与 Payload 不一致" unless bundle["counts"] == expected_counts

semantic_core = semantic_audit.reject { |key, _value| key == "audit_sha256" }
semantic_sha = Digest::SHA256.hexdigest(JSON.generate(semantic_core))
unless semantic_audit["audit_sha256"] == semantic_sha &&
       semantic_audit["source_baseline_id"] == bundle["baseline_id"] &&
       semantic_audit["source_payload_sha256"] == bundle["payload_sha256"] &&
       semantic_audit["status"] == "candidate_only" &&
       semantic_audit["runtime_authorization"] == "NONE" &&
       semantic_audit.dig("audit", "errors").to_a.empty?
  errors << "R2-A 与当前冻结基线不一致或无法复算"
end

flow_core = flow_audit.reject { |key, _value| key == "audit_sha256" }
flow_sha = Digest::SHA256.hexdigest(JSON.generate(flow_core))
unless flow_audit["audit_sha256"] == flow_sha &&
       flow_audit["source_baseline_id"] == bundle["baseline_id"] &&
       flow_audit["source_payload_sha256"] == bundle["payload_sha256"] &&
       flow_audit["source_semantic_audit_sha256"] == semantic_audit["audit_sha256"] &&
       flow_audit["status"] == "candidate_only" &&
       flow_audit["runtime_authorization"] == "NONE" &&
       flow_audit.dig("audit", "errors").to_a.empty?
  errors << "R2-B 与当前冻结基线不一致或无法复算"
end

unless errors.empty?
  warn "CALIBRATION_PROPOSALS=FAIL"
  errors.each { |error| warn "- #{error}" }
  exit 1
end

overlay_payload = Marshal.load(Marshal.dump(payload))
begin
  PROPOSAL_DEFINITIONS.each do |proposal|
    proposal.fetch("operations").each { |operation| apply_operation!(overlay_payload, operation) }
  end
rescue KeyError, RuntimeError => e
  warn "CALIBRATION_PROPOSALS=FAIL"
  warn "- overlay 操作失败：#{e.message}"
  exit 1
end

baseline_items = payload.fetch("inventory_items").to_h { |item| [item.fetch("id"), item] }
overlay_items = overlay_payload.fetch("inventory_items").to_h { |item| [item.fetch("id"), item] }
baseline_recipes = payload.fetch("recipes").to_h { |recipe| [recipe.fetch("id"), recipe] }
overlay_recipes = overlay_payload.fetch("recipes").to_h { |recipe| [recipe.fetch("id"), recipe] }

recipe_profiles = baseline_recipes.keys.sort.map do |recipe_id|
  baseline_recipe = baseline_recipes.fetch(recipe_id)
  overlay_recipe = overlay_recipes.fetch(recipe_id)
  baseline_metrics = metric_profile(baseline_recipe, baseline_items)
  overlay_metrics = metric_profile(overlay_recipe, overlay_items)
  {
    "id" => recipe_id,
    "kind" => baseline_recipe.fetch("kind"),
    "baseline" => serialized_metrics(baseline_metrics).merge(
      "mass_classification" => mass_classification(baseline_recipe, baseline_metrics),
      "candidate_value_outlier" => value_outlier?(baseline_recipe, baseline_metrics)
    ),
    "proposed_overlay" => serialized_metrics(overlay_metrics).merge(
      "mass_classification" => mass_classification(overlay_recipe, overlay_metrics),
      "candidate_value_outlier" => value_outlier?(overlay_recipe, overlay_metrics)
    )
  }
end
profile_by_id = recipe_profiles.to_h { |row| [row.fetch("id"), row] }

numeric_proposals = PROPOSAL_DEFINITIONS.map do |definition|
  recipe_id = definition.fetch("subject_recipe_id")
  subject_recipe = baseline_recipes.fetch(recipe_id)
  touched_item_ids = definition.fetch("operations").map do |operation|
    operation["item_id"] || operation.dig("to", "item")
  end.compact.uniq.sort
  affected_output_ids = output_item_ids(subject_recipe)
  downstream_ids = baseline_recipes.values.select do |recipe|
    next false if recipe["id"] == recipe_id

    recipe.fetch("inputs", []).any? { |entry| affected_output_ids.include?(entry["item"]) } ||
      affected_output_ids.include?(recipe.dig("target", "item"))
  end.map { |recipe| recipe.fetch("id") }.sort
  isolated_payload = Marshal.load(Marshal.dump(payload))
  definition.fetch("operations").each { |operation| apply_operation!(isolated_payload, operation) }
  isolated_items = isolated_payload.fetch("inventory_items").to_h { |item| [item.fetch("id"), item] }
  isolated_recipes = isolated_payload.fetch("recipes").to_h { |recipe| [recipe.fetch("id"), recipe] }
  metric_affected_ids = baseline_recipes.keys.sort.select do |candidate_recipe_id|
    metric_profile(baseline_recipes.fetch(candidate_recipe_id), baseline_items) !=
      metric_profile(isolated_recipes.fetch(candidate_recipe_id), isolated_items)
  end
  profile = profile_by_id.fetch(recipe_id)
  {
    "id" => definition.fetch("id"),
    "disposition" => "numeric_patch_proposal",
    "subject_recipe_id" => recipe_id,
    "triggers" => definition.fetch("triggers"),
    "rationale" => definition.fetch("rationale"),
    "operations" => definition.fetch("operations"),
    "affected_item_ids" => touched_item_ids,
    "metric_affected_recipe_ids" => metric_affected_ids,
    "downstream_recipe_ids" => downstream_ids,
    "before_metrics" => profile.fetch("baseline"),
    "after_metrics" => profile.fetch("proposed_overlay"),
    "acceptance_boundary" => "仅供未来稳定 ID 选择时评估；不得直接写回 R1 或导入运行时。"
  }
end

accepted_outliers = ACCEPTED_OUTLIER_DEFINITIONS.map do |definition|
  profile = profile_by_id.fetch(definition.fetch("recipe_id"))
  definition.merge(
    "disposition" => "accepted_outlier",
    "overlay_ratio" => profile.dig("proposed_overlay", "candidate_value_return_ratio_max"),
    "acceptance_boundary" => "只接受 R2-C 提案层的残余异常，不冻结正式价值。"
  )
end
accepted_recipe_ids = accepted_outliers.map { |row| row.fetch("recipe_id") }

baseline_severe = recipe_profiles.select { |row| row.dig("baseline", "mass_classification") == "severe_amplification" }
overlay_severe = recipe_profiles.select { |row| row.dig("proposed_overlay", "mass_classification") == "severe_amplification" }
baseline_review = recipe_profiles.select { |row| row.dig("baseline", "mass_classification") == "review_band" }
baseline_value_outliers = recipe_profiles.select { |row| row.dig("baseline", "candidate_value_outlier") }
overlay_value_outliers = recipe_profiles.select { |row| row.dig("proposed_overlay", "candidate_value_outlier") }
proposal_recipe_ids = numeric_proposals.map { |row| row.fetch("subject_recipe_id") }

missing_severe_proposals = baseline_severe.reject { |row| proposal_recipe_ids.include?(row.fetch("id")) }
unadjudicated_overlay_severe = overlay_severe
missing_value_adjudications = baseline_value_outliers.reject do |row|
  proposal_recipe_ids.include?(row.fetch("id")) || accepted_recipe_ids.include?(row.fetch("id"))
end
unadjudicated_overlay_value = overlay_value_outliers.reject { |row| accepted_recipe_ids.include?(row.fetch("id")) }

r2b_value_ids = flow_audit.dig("candidate_value_calibration", "normal_ratio_outliers").to_a.map { |row| row.fetch("id") }.sort
calculated_value_ids = baseline_value_outliers.map { |row| row.fetch("id") }.sort
validation_errors = []
validation_errors << "不是全部 90 张工艺都具有画像" unless recipe_profiles.length == 90
validation_errors << "严重质量放大缺少提案：#{missing_severe_proposals.map { |row| row["id"] }.join(", ")}" unless missing_severe_proposals.empty?
validation_errors << "R2-B 价值异常与 R2-C 重算不一致" unless r2b_value_ids == calculated_value_ids
validation_errors << "基线价值异常缺少裁定：#{missing_value_adjudications.map { |row| row["id"] }.join(", ")}" unless missing_value_adjudications.empty?
validation_errors << "overlay 仍有未裁定严重质量放大：#{unadjudicated_overlay_severe.map { |row| row["id"] }.join(", ")}" unless unadjudicated_overlay_severe.empty?
validation_errors << "overlay 仍有未裁定价值异常：#{unadjudicated_overlay_value.map { |row| row["id"] }.join(", ")}" unless unadjudicated_overlay_value.empty?
validation_errors << "R1 Bundle 在生成期间发生变化" unless Digest::SHA256.file(BUNDLE_PATH).hexdigest == bundle_file_sha_before

unless validation_errors.empty?
  warn "CALIBRATION_PROPOSALS=FAIL"
  validation_errors.each { |error| warn "- #{error}" }
  exit 1
end

mass_review_queue = baseline_review.map do |row|
  kind = row.fetch("kind")
  hint = if %w[medical_processing chemical_processing].include?(kind)
           "复核容器、密度、含水率与区间取整。"
         elsif kind == "dismantle"
           "复核目标质量、回收单位和最大回收区间。"
         else
           "复核外壳、包装、装配辅料与成品单位。"
         end
  {
    "id" => row.fetch("id"),
    "baseline_ratio" => row.dig("baseline", "mass_return_ratio_max"),
    "overlay_ratio" => row.dig("proposed_overlay", "mass_return_ratio_max"),
    "disposition" => "manual_review_required",
    "review_hint" => hint
  }
end

overlay_operations = numeric_proposals.flat_map { |proposal| proposal.fetch("operations") }
overlay_sha = Digest::SHA256.hexdigest(JSON.generate(canonicalize_json(overlay_operations)))
report_core = {
  "schema_version" => "new-era-2.item-library.calibration-proposals.r2c.v0.1",
  "source_baseline_id" => bundle.fetch("baseline_id"),
  "source_payload_sha256" => bundle.fetch("payload_sha256"),
  "source_semantic_audit_sha256" => semantic_audit.fetch("audit_sha256"),
  "source_flow_audit_sha256" => flow_audit.fetch("audit_sha256"),
  "source_bundle_file_sha256" => bundle_file_sha_before,
  "status" => bundle.fetch("status"),
  "runtime_authorization" => bundle.fetch("runtime_authorization"),
  "proposal_mode" => "proposal_only",
  "candidate_overlay_only" => true,
  "whole_bundle_runtime_import_allowed" => false,
  "overlay_sha256" => overlay_sha,
  "source_files" => {
    "data/item-library/item-library-r1-candidate-bundle.json" => Digest::SHA256.file(BUNDLE_PATH).hexdigest,
    "data/item-library/semantic-audit-r2a.json" => Digest::SHA256.file(SEMANTIC_AUDIT_PATH).hexdigest,
    "data/item-library/flow-audit-r2b.json" => Digest::SHA256.file(FLOW_AUDIT_PATH).hexdigest,
    "docs/item-library/item-library-calibration-contract-v0.1.md" => Digest::SHA256.file(CONTRACT_PATH).hexdigest,
    "scripts/propose_item_library_calibration.rb" => Digest::SHA256.file(__FILE__).hexdigest
  },
  "thresholds" => {
    "mass_review_ratio_exclusive" => MASS_REVIEW_RATIO,
    "mass_severe_ratio_exclusive" => MASS_SEVERE_RATIO,
    "mass_low_ratio_exclusive" => MASS_LOW_RATIO,
    "candidate_value_ratio_low" => VALUE_RATIO_LOW,
    "candidate_value_ratio_high" => VALUE_RATIO_HIGH
  },
  "counts" => {
    "recipes_profiled" => recipe_profiles.length,
    "baseline_severe_mass" => baseline_severe.length,
    "baseline_mass_review" => baseline_review.length,
    "baseline_low_mass_report_only" => recipe_profiles.count { |row| row.dig("baseline", "mass_classification") == "low_ratio_report_only" },
    "baseline_value_outliers" => baseline_value_outliers.length,
    "numeric_patch_proposals" => numeric_proposals.length,
    "accepted_outliers" => accepted_outliers.length,
    "overlay_unadjudicated_severe_mass" => unadjudicated_overlay_severe.length,
    "overlay_unadjudicated_value_outliers" => unadjudicated_overlay_value.length
  },
  "numeric_patch_proposals" => numeric_proposals,
  "accepted_outliers" => accepted_outliers,
  "mass_review_queue" => mass_review_queue,
  "baseline_severe_mass_recipe_ids" => baseline_severe.map { |row| row.fetch("id") },
  "baseline_value_outlier_recipe_ids" => baseline_value_outliers.map { |row| row.fetch("id") },
  "recipe_profiles" => recipe_profiles,
  "acceptance_boundary" => {
    "r1_modified" => false,
    "runtime_authorized" => false,
    "gate_status_changed" => false,
    "future_adoption_requires" => [
      "explicit stable-ID selection",
      "separate runtime schema",
      "target Gate authorization",
      "runtime and player-test evidence"
    ]
  }
}
report_sha = Digest::SHA256.hexdigest(JSON.generate(report_core))
report = report_core.merge("report_sha256" => report_sha)
json_output = JSON.pretty_generate(report) + "\n"
markdown_output = build_markdown(report)

if options[:write]
  File.write(JSON_REPORT_PATH, json_output)
  File.write(MARKDOWN_REPORT_PATH, markdown_output)
  puts "CALIBRATION_JSON=WRITTEN #{JSON_REPORT_PATH}"
  puts "CALIBRATION_MARKDOWN=WRITTEN #{MARKDOWN_REPORT_PATH}"
else
  unless File.file?(JSON_REPORT_PATH) && File.read(JSON_REPORT_PATH) == json_output
    warn "CALIBRATION_PROPOSALS=FAIL"
    warn "- #{File.basename(JSON_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
  unless File.file?(MARKDOWN_REPORT_PATH) && File.read(MARKDOWN_REPORT_PATH) == markdown_output
    warn "CALIBRATION_PROPOSALS=FAIL"
    warn "- #{File.basename(MARKDOWN_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
end

unless Digest::SHA256.file(BUNDLE_PATH).hexdigest == bundle_file_sha_before
  warn "CALIBRATION_PROPOSALS=FAIL"
  warn "- R1 Bundle 在输出阶段发生变化"
  exit 1
end

puts "CALIBRATION_PROPOSALS=PASS"
puts "RECIPES_PROFILED=#{recipe_profiles.length}"
puts "BASELINE_SEVERE_MASS_COUNT=#{baseline_severe.length}"
puts "BASELINE_MASS_REVIEW_COUNT=#{baseline_review.length}"
puts "BASELINE_VALUE_OUTLIER_COUNT=#{baseline_value_outliers.length}"
puts "NUMERIC_PATCH_PROPOSAL_COUNT=#{numeric_proposals.length}"
puts "ACCEPTED_OUTLIER_COUNT=#{accepted_outliers.length}"
puts "OVERLAY_UNADJUDICATED_SEVERE_MASS_COUNT=#{unadjudicated_overlay_severe.length}"
puts "OVERLAY_UNADJUDICATED_VALUE_OUTLIER_COUNT=#{unadjudicated_overlay_value.length}"
puts "OVERLAY_SHA256=#{overlay_sha}"
puts "REPORT_SHA256=#{report_sha}"
puts "R1_BUNDLE_FILE_SHA256=#{bundle_file_sha_before}"
puts "R1_PAYLOAD_SHA256=#{bundle.fetch("payload_sha256")}"
puts "RUNTIME_AUTHORIZATION=#{bundle.fetch("runtime_authorization")}"
