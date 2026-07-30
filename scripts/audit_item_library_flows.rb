#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "set"
require "tsort"

ROOT = File.expand_path("..", __dir__)
BUNDLE_PATH = File.join(ROOT, "data/item-library/item-library-r1-candidate-bundle.json")
SEMANTIC_AUDIT_PATH = File.join(ROOT, "data/item-library/semantic-audit-r2a.json")
CONTRACT_PATH = File.join(ROOT, "docs/item-library/item-library-flow-audit-contract-v0.1.md")
JSON_REPORT_PATH = File.join(ROOT, "data/item-library/flow-audit-r2b.json")
MARKDOWN_REPORT_PATH = File.join(ROOT, "data/item-library/flow-audit-r2b.md")

EXPECTED_BASELINE_ID = "new-era-2.item-library.r1-c7-candidate"
PASSIVE_ACTIONS = %w[reserve trade deliver store inspect].freeze
NORMAL_VALUE_RATIO_LOW = 0.25
NORMAL_VALUE_RATIO_HIGH = 4.0
DISMANTLE_WARNING_RATIO = 0.75
REPAIR_WARNING_RATIO = 0.75

def parse_arguments(argv)
  options = { write: false }
  argv.each do |argument|
    case argument
    when "--write"
      options[:write] = true
    else
      abort "FLOW_AUDIT=FAIL\n- 未知参数 #{argument}"
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

def counts_for(values)
  values.each_with_object(Hash.new(0)) { |value, counts| counts[value] += 1 }
end

def recipe_item_ids(recipe, key)
  recipe.fetch(key, []).map { |entry| entry["item"] }.compact.uniq.sort
end

def substitute_item_ids(recipe)
  recipe
    .dig("substitution_policy", "rules")
    .to_a
    .flat_map { |rule| rule.fetch("alternatives", []).map { |alternative| alternative["item"] } }
    .compact
    .uniq
    .sort
end

def recipe_requirement_groups(recipe)
  rules_by_input = recipe.dig("substitution_policy", "rules")
                         .to_a
                         .group_by { |rule| rule["input"] }
  groups = recipe.fetch("inputs", []).map do |input|
    alternatives = rules_by_input.fetch(input["item"], [])
                                 .flat_map { |rule| rule.fetch("alternatives", []).map { |entry| entry["item"] } }
                                 .compact
    ([input.fetch("item")] + alternatives).uniq.sort
  end
  target_item = recipe.dig("target", "item")
  groups.unshift([target_item]) if target_item
  groups
end

def minimum_positive_consumption_by_item(recipe)
  rules_by_input = recipe.dig("substitution_policy", "rules")
                         .to_a
                         .group_by { |rule| rule["input"] }
  slots = recipe.fetch("inputs", []).select { |input| input["consumed"] == true }.map do |input|
    options = [{ "item" => input.fetch("item"), "amount" => input.fetch("amount").to_f }]
    rules_by_input.fetch(input["item"], []).each do |rule|
      rule.fetch("alternatives", []).each do |alternative|
        options << {
          "item" => alternative.fetch("item"),
          "amount" => input.fetch("amount").to_f * alternative.fetch("ratio").to_f
        }
      end
    end
    options
  end

  slots.flat_map { |slot| slot.map { |option| option.fetch("item") } }.uniq.sort.to_h do |item_id|
    mandatory_amount = 0.0
    optional_amounts = []
    slots.each do |slot|
      matching_amounts = slot.select { |option| option["item"] == item_id }
                             .map { |option| option.fetch("amount") }
      next if matching_amounts.empty?

      minimum_amount = matching_amounts.min
      if slot.all? { |option| option["item"] == item_id }
        mandatory_amount += minimum_amount
      else
        optional_amounts << minimum_amount
      end
    end
    minimum_positive = mandatory_amount.positive? ? mandatory_amount : optional_amounts.min
    [item_id, minimum_positive]
  end
end

def round_number(value)
  value.nil? ? nil : value.round(6)
end

def item_value(items, item_id)
  item = items.fetch(item_id)
  value = item["base_value"]
  return value.to_f if value.is_a?(Numeric) && value.positive?

  nil
end

def quantity_value(entries, quantity_key, items)
  entries.sum do |entry|
    next 0.0 unless entry["item"]

    value = item_value(items, entry.fetch("item"))
    next 0.0 if value.nil?

    entry.fetch(quantity_key).to_f * value
  end
end

def build_recipe_ledger(recipes, items, errors, warnings)
  recipes.sort_by { |recipe| recipe.fetch("id") }.map do |recipe|
    recipe_id = recipe.fetch("id")
    kind = recipe.fetch("kind")
    time_min = recipe.dig("effective_time_hours", "min")
    time_max = recipe.dig("effective_time_hours", "max")

    unless time_min.is_a?(Numeric) && time_max.is_a?(Numeric) &&
           time_min.positive? && time_max.positive? && time_min <= time_max
      errors << {
        "code" => "invalid_effective_time",
        "id" => recipe_id,
        "message" => "有效人物时间必须为正数且 min <= max"
      }
    end

    direct_inputs = recipe.fetch("inputs", [])
    consumed_inputs = direct_inputs.select { |entry| entry["consumed"] == true }
    non_consumed_inputs = direct_inputs.reject { |entry| entry["consumed"] == true }
    inventory_byproducts = recipe.fetch("byproducts", []).select { |entry| entry["item"] }
    value_entries = consumed_inputs + recipe.fetch("outputs", []) + inventory_byproducts
    value_entries.each do |entry|
      next if item_value(items, entry.fetch("item"))

      errors << {
        "code" => "unscorable_item_value",
        "id" => entry.fetch("item"),
        "message" => "#{recipe_id} 引用的库存物品缺少正候选价值"
      }
    end

    consumed_input_value = consumed_inputs.sum do |entry|
      value = item_value(items, entry.fetch("item"))
      value ? entry.fetch("amount").to_f * value : 0.0
    end
    output_min_value = quantity_value(recipe.fetch("outputs", []), "min", items) +
                       quantity_value(inventory_byproducts, "min", items)
    output_max_value = quantity_value(recipe.fetch("outputs", []), "max", items) +
                       quantity_value(inventory_byproducts, "max", items)
    target_item_id = recipe.dig("target", "item")
    target_value = target_item_id && item_value(items, target_item_id)

    normal_ratio_min = nil
    normal_ratio_max = nil
    dismantle_ratio_min = nil
    dismantle_ratio_max = nil
    repair_material_ratio = nil

    if kind == "dismantle"
      unless recipe.dig("target", "target_consumed") == true
        errors << {
          "code" => "dismantle_target_not_consumed",
          "id" => recipe_id,
          "message" => "拆解目标必须声明 target_consumed=true"
        }
      end
      if target_value.nil? || target_value <= 0
        errors << {
          "code" => "dismantle_target_unscorable",
          "id" => recipe_id,
          "message" => "拆解目标缺少正候选价值"
        }
      else
        dismantle_ratio_min = output_min_value / target_value
        dismantle_ratio_max = output_max_value / target_value
        if dismantle_ratio_max >= 1.0
          errors << {
            "code" => "lossless_dismantle",
            "id" => recipe_id,
            "message" => "最大候选回收比 #{round_number(dismantle_ratio_max)} 不小于 1"
          }
        elsif dismantle_ratio_max >= DISMANTLE_WARNING_RATIO
          warnings << {
            "code" => "high_dismantle_recovery",
            "id" => recipe_id,
            "message" => "最大候选回收比 #{round_number(dismantle_ratio_max)} 达到校准阈值",
            "disposition" => "calibrate_before_runtime_selection",
            "rationale" => "候选价值不含人物时间、设施折旧、品质和风险；进入运行时前必须用目标 Gate 场景复核。"
          }
        end
      end
    elsif kind == "repair"
      unless recipe.dig("target", "target_consumed") == false
        errors << {
          "code" => "repair_target_consumed",
          "id" => recipe_id,
          "message" => "维修目标必须声明 target_consumed=false"
        }
      end
      if target_value.nil? || target_value <= 0
        errors << {
          "code" => "repair_target_unscorable",
          "id" => recipe_id,
          "message" => "维修目标缺少正候选价值"
        }
      else
        repair_material_ratio = consumed_input_value / target_value
        if repair_material_ratio >= REPAIR_WARNING_RATIO
          warnings << {
            "code" => "high_repair_material_ratio",
            "id" => recipe_id,
            "message" => "维修候选材料比 #{round_number(repair_material_ratio)} 达到校准阈值",
            "disposition" => "calibrate_before_runtime_selection",
            "rationale" => "维修恢复幅度、目标完整度和人物时间尚未冻结；进入运行时前必须结合损坏状态复核。"
          }
        end
      end
    else
      if consumed_input_value <= 0
        errors << {
          "code" => "normal_recipe_without_valued_input",
          "id" => recipe_id,
          "message" => "普通工艺没有可计候选价值的已消耗输入"
        }
      elsif output_max_value <= 0
        errors << {
          "code" => "normal_recipe_without_valued_output",
          "id" => recipe_id,
          "message" => "普通工艺没有可计候选价值的库存产出"
        }
      else
        normal_ratio_min = output_min_value / consumed_input_value
        normal_ratio_max = output_max_value / consumed_input_value
        if normal_ratio_max < NORMAL_VALUE_RATIO_LOW || normal_ratio_max > NORMAL_VALUE_RATIO_HIGH
          warnings << {
            "code" => "candidate_value_ratio_outlier",
            "id" => recipe_id,
            "message" => "最大候选价值返回比 #{round_number(normal_ratio_max)} 超出 #{NORMAL_VALUE_RATIO_LOW}–#{NORMAL_VALUE_RATIO_HIGH} 筛查区间",
            "disposition" => "calibrate_before_runtime_selection",
            "rationale" => "该比值只用于发现单位、数量或候选价值极端项，不代表利润；选择进入运行时前逐项校准。"
          }
        end
      end
    end

    returned_amounts = (recipe.fetch("outputs", []) + inventory_byproducts)
                       .each_with_object(Hash.new(0.0)) do |output, memo|
      memo[output.fetch("item")] += output.fetch("max").to_f
    end
    minimum_positive_consumption_by_item(recipe).each do |item_id, consumed_amount|
      returned_amount = returned_amounts.fetch(item_id, 0.0)
      next if returned_amount < consumed_amount

      errors << {
        "code" => "direct_self_amplification",
        "id" => recipe_id,
        "message" => "#{item_id} 的最大返还量 #{round_number(returned_amount)} 不小于任一合法输入组合的最小正消耗量 #{round_number(consumed_amount)}"
      }
    end

    {
      "id" => recipe_id,
      "kind" => kind,
      "resource_chains" => recipe.fetch("resource_chains").sort,
      "consumed_input_items" => consumed_inputs.map { |entry| entry.fetch("item") }.uniq.sort,
      "non_consumed_input_items" => non_consumed_inputs.map { |entry| entry.fetch("item") }.uniq.sort,
      "substitute_input_items" => substitute_item_ids(recipe),
      "output_items" => recipe_item_ids(recipe, "outputs"),
      "inventory_byproduct_items" => inventory_byproducts.map { |entry| entry.fetch("item") }.uniq.sort,
      "target_item" => target_item_id,
      "candidate_consumed_input_value" => round_number(consumed_input_value),
      "candidate_output_value_min" => round_number(output_min_value),
      "candidate_output_value_max" => round_number(output_max_value),
      "candidate_target_value" => round_number(target_value),
      "candidate_value_ratio_min" => round_number(normal_ratio_min),
      "candidate_value_ratio_max" => round_number(normal_ratio_max),
      "dismantle_recovery_ratio_min" => round_number(dismantle_ratio_min),
      "dismantle_recovery_ratio_max" => round_number(dismantle_ratio_max),
      "repair_material_ratio" => round_number(repair_material_ratio),
      "effective_time_hours" => {
        "min" => time_min,
        "max" => time_max
      },
      "facilities" => recipe.fetch("facilities").sort,
      "tools" => recipe.fetch("tools").sort,
      "minimum_role" => recipe.dig("qualification", "minimum_role")
    }
  end
end

def build_transformation_graph(recipes, items)
  edges = []
  recipes.each do |recipe|
    next if recipe["kind"] == "repair"

    sources = if recipe["kind"] == "dismantle"
                [recipe.dig("target", "item")]
              else
                recipe.fetch("inputs", [])
                      .select { |entry| entry["consumed"] == true }
                      .map { |entry| entry["item"] } + substitute_item_ids(recipe)
              end
    targets = recipe_item_ids(recipe, "outputs") +
              recipe.fetch("byproducts", []).map { |entry| entry["item"] }.compact

    sources.compact.uniq.product(targets.uniq).each do |source, target|
      edges << {
        "from" => source,
        "to" => target,
        "recipe" => recipe.fetch("id")
      }
    end
  end

  edges = edges.uniq { |edge| [edge["from"], edge["to"], edge["recipe"]] }
               .sort_by { |edge| [edge["from"], edge["to"], edge["recipe"]] }

  adjacency = items.keys.sort.to_h { |id| [id, []] }
  edges.each { |edge| adjacency.fetch(edge["from"]) << edge["to"] }
  adjacency.each_value { |targets| targets.replace(targets.uniq.sort) }
  adjacency.extend(TSort)
  adjacency.define_singleton_method(:tsort_each_node) { |&block| each_key(&block) }
  adjacency.define_singleton_method(:tsort_each_child) { |node, &block| fetch(node).each(&block) }

  components = adjacency.strongly_connected_components
                        .select { |component| component.length > 1 || adjacency.fetch(component.first).include?(component.first) }
                        .map(&:sort)
                        .sort_by { |component| [-component.length, component.first] }

  [edges, components]
end

def build_cycle_rows(components, edges, recipe_ledger, errors)
  ledger_by_id = recipe_ledger.to_h { |row| [row.fetch("id"), row] }

  components.map do |items|
    recipe_ids = edges.select { |edge| items.include?(edge["from"]) && items.include?(edge["to"]) }
                      .map { |edge| edge.fetch("recipe") }
                      .uniq
                      .sort
    rows = recipe_ids.map { |id| ledger_by_id.fetch(id) }
    dismantle_rows = rows.select { |row| row["kind"] == "dismantle" }
    recovery_max = dismantle_rows.map { |row| row["dismantle_recovery_ratio_max"] }.compact.max
    loss_control = dismantle_rows.any? && recovery_max && recovery_max < 1.0

    unless loss_control
      errors << {
        "code" => "cycle_without_loss_control",
        "id" => items.first,
        "message" => "转化循环没有最大回收比小于 1 的拆解边界"
      }
    end

    {
      "items" => items,
      "recipes" => recipe_ids,
      "minimum_effective_time_hours" => rows.map { |row| row.dig("effective_time_hours", "min") }.min,
      "dismantle_recovery_ratio_max" => round_number(recovery_max),
      "loss_control" => !!loss_control
    }
  end
end

def build_source_sink_audit(items, recipes, errors)
  producer_ids = recipes.each_with_object(Hash.new { |hash, key| hash[key] = [] }) do |recipe, memo|
    outputs = recipe_item_ids(recipe, "outputs") +
              recipe.fetch("byproducts", []).map { |entry| entry["item"] }.compact
    outputs.each { |item_id| memo[item_id] << recipe.fetch("id") }
  end

  external_sources = []
  missing_sources = []
  terminal_outputs = []
  missing_sinks = []

  items.values.sort_by { |item| item.fetch("id") }.each do |item|
    item_id = item.fetch("id")
    producers = producer_ids.fetch(item_id, []).uniq.sort
    acquisition_types = item.fetch("acquisition_paths", []).map { |path| path["type"] }.compact.uniq.sort
    external_types = acquisition_types - ["manufacture"]

    if producers.empty? && external_types.empty?
      missing_sources << item_id
      errors << {
        "code" => "missing_upstream_source",
        "id" => item_id,
        "message" => "没有工艺生产者或外部获得路径"
      }
    elsif producers.empty?
      external_sources << {
        "id" => item_id,
        "acquisition_types" => external_types
      }
    end

    next if producers.empty?

    used_by = item.dig("interfaces", "used_by").to_a
    meaningful_actions = item.fetch("actions", []) - PASSIVE_ACTIONS
    loss_types = item.fetch("consumption_loss_paths", []).map { |path| path["type"] }.compact.uniq.sort
    next unless used_by.empty?

    terminal = {
      "id" => item_id,
      "producer_recipes" => producers,
      "meaningful_actions" => meaningful_actions.sort,
      "loss_types" => loss_types
    }
    terminal_outputs << terminal
    next if meaningful_actions.any? || loss_types.any?

    missing_sinks << item_id
    errors << {
      "code" => "missing_terminal_sink",
      "id" => item_id,
      "message" => "制造产出既无后续工艺，也无实际动作或流失路径"
    }
  end

  origin_ids = items.values.select do |item|
    item.fetch("acquisition_paths", []).any? { |path| path["type"] != "manufacture" }
  end.map { |item| item.fetch("id") }.to_set
  reachable_ids = origin_ids.dup
  reachable_recipe_ids = Set.new
  loop do
    added = false
    recipes.sort_by { |recipe| recipe.fetch("id") }.each do |recipe|
      groups = recipe_requirement_groups(recipe)
      next unless groups.all? { |group| group.any? { |item_id| reachable_ids.include?(item_id) } }

      unless reachable_recipe_ids.include?(recipe.fetch("id"))
        reachable_recipe_ids << recipe.fetch("id")
        added = true
      end
      next if recipe["kind"] == "repair"

      outputs = recipe_item_ids(recipe, "outputs") +
                recipe.fetch("byproducts", []).map { |entry| entry["item"] }.compact
      outputs.each do |item_id|
        next if reachable_ids.include?(item_id)

        reachable_ids << item_id
        added = true
      end
    end
    break unless added
  end

  unreachable_recipes = recipes.sort_by { |recipe| recipe.fetch("id") }.reject do |recipe|
    reachable_recipe_ids.include?(recipe.fetch("id"))
  end.map do |recipe|
    unsatisfied_groups = recipe_requirement_groups(recipe).reject do |group|
      group.any? { |item_id| reachable_ids.include?(item_id) }
    end
    {
      "id" => recipe.fetch("id"),
      "unsatisfied_requirement_groups" => unsatisfied_groups
    }
  end
  unreachable_recipes.each do |row|
    errors << {
      "code" => "unreachable_recipe_requirements",
      "id" => row.fetch("id"),
      "message" => "至少一个必需输入位或目标实例无法从非 manufacture 获得路径抵达"
    }
  end

  {
    "origin_item_count" => origin_ids.length,
    "reachable_item_count" => reachable_ids.length,
    "reachable_recipe_count" => reachable_recipe_ids.length,
    "unreachable_recipe_count" => unreachable_recipes.length,
    "unreachable_recipes" => unreachable_recipes,
    "external_source_count" => external_sources.length,
    "external_sources" => external_sources,
    "missing_source_count" => missing_sources.length,
    "missing_sources" => missing_sources,
    "terminal_output_count" => terminal_outputs.length,
    "terminal_outputs" => terminal_outputs,
    "missing_sink_count" => missing_sinks.length,
    "missing_sinks" => missing_sinks
  }
end

def build_shared_bottlenecks(items, recipes)
  demand = Hash.new { |hash, key| hash[key] = Set.new }
  chains = Hash.new { |hash, key| hash[key] = Set.new }

  recipes.each do |recipe|
    direct = recipe.fetch("inputs", [])
                   .select { |entry| entry["consumed"] == true }
                   .map { |entry| entry["item"] }
    (direct + substitute_item_ids(recipe)).uniq.each do |item_id|
      demand[item_id] << recipe.fetch("id")
      recipe.fetch("resource_chains").each { |chain| chains[item_id] << chain }
    end
  end

  demand.keys.map do |item_id|
    {
      "id" => item_id,
      "recipe_count" => demand.fetch(item_id).length,
      "resource_chains" => chains.fetch(item_id).to_a.sort,
      "candidate_base_value" => items.fetch(item_id).fetch("base_value")
    }
  end.select { |row| row["recipe_count"] >= 2 && row["resource_chains"].length >= 2 }
     .sort_by { |row| [-row["recipe_count"], -row["resource_chains"].length, row["id"]] }
end

def sorted_count_rows(values, key)
  counts_for(values).map { |id, count| { key => id, "recipe_count" => count } }
                    .sort_by { |row| [-row["recipe_count"], row[key]] }
end

def build_markdown(report)
  audit = report.fetch("audit")
  source_sink = report.fetch("source_sink")
  graph = report.fetch("transformation_graph")
  calibration = report.fetch("candidate_value_calibration")
  capacity = report.fetch("capacity_concentration")

  lines = []
  lines << "# 候选物品库 R2-B 制造流、循环与候选经济审计"
  lines << ""
  lines << "**来源基线：** `#{report.fetch("source_baseline_id")}`"
  lines << "**来源 Payload SHA-256：** `#{report.fetch("source_payload_sha256")}`"
  lines << "**状态：** `#{report.fetch("status")}`"
  lines << "**运行时授权：** `#{report.fetch("runtime_authorization")}`"
  lines << "**审计 SHA-256：** `#{report.fetch("audit_sha256")}`"
  lines << ""
  lines << "## 1. 结论"
  lines << ""
  lines << "- `FLOW_AUDIT=#{audit.fetch("errors").empty? ? "PASS" : "FAIL"}`"
  lines << "- `ERROR_COUNT=#{audit.fetch("errors").length}`"
  lines << "- `WARNING_COUNT=#{audit.fetch("warnings").length}`"
  lines << "- `RECIPE_COUNT=#{report.dig("counts", "recipes")}`"
  lines << "- `TRANSFORMATION_CYCLE_COUNT=#{graph.fetch("cycle_count")}`"
  lines << "- `SHARED_BOTTLENECK_COUNT=#{report.fetch("shared_bottlenecks").length}`"
  lines << ""
  lines << "本报告使用候选数值筛查制造流风险，不构成正式价格、产能、市场或运行时平衡。"
  lines << ""
  lines << "## 2. 来源与终端去向"
  lines << ""
  lines << "| 指标 | 数量 |"
  lines << "|---|---:|"
  lines << "| 非制造起点物品 | #{source_sink.fetch("origin_item_count")} |"
  lines << "| 可从起点抵达的物品 | #{source_sink.fetch("reachable_item_count")} |"
  lines << "| 可执行工艺 | #{source_sink.fetch("reachable_recipe_count")} |"
  lines << "| 存在不可达必需输入位的工艺 | #{source_sink.fetch("unreachable_recipe_count")} |"
  lines << "| 外部来源物品 | #{source_sink.fetch("external_source_count")} |"
  lines << "| 断裂来源 | #{source_sink.fetch("missing_source_count")} |"
  lines << "| 制造终端产出 | #{source_sink.fetch("terminal_output_count")} |"
  lines << "| 缺少终端去向 | #{source_sink.fetch("missing_sink_count")} |"
  lines << ""
  lines << "制造终端产出可以通过食用、治疗、装备、安装、交付、损坏或拆解结束链条，不要求继续成为另一工艺的输入。"
  lines << ""
  lines << "## 3. 转化循环"
  lines << ""
  lines << "| 循环物品 | 工艺 | 最小人物时间 | 最大拆解回收比 | 有损边界 |"
  lines << "|---|---|---:|---:|---|"
  graph.fetch("cycles").each do |cycle|
    lines << "| #{cycle.fetch("items").map { |id| "`#{id}`" }.join("<br>")} | #{cycle.fetch("recipes").map { |id| "`#{id}`" }.join("<br>")} | #{cycle.fetch("minimum_effective_time_hours")} | #{cycle.fetch("dismantle_recovery_ratio_max")} | #{cycle.fetch("loss_control") ? "是" : "否"} |"
  end
  lines << ""
  lines << "## 4. 候选价值校准警告"
  lines << ""
  lines << "| 工艺 | 最大返回比 | 候选输入值 | 候选最大产出值 | 裁定 |"
  lines << "|---|---:|---:|---:|---|"
  calibration.fetch("normal_ratio_outliers").each do |row|
    lines << "| `#{row.fetch("id")}` | #{row.fetch("candidate_value_ratio_max")} | #{row.fetch("candidate_consumed_input_value")} | #{row.fetch("candidate_output_value_max")} | 进入运行时前校准 |"
  end
  lines << ""
  lines << "极端比值只提示单位、数量或 `base_value` 可能需要复核；人物时间、设施、风险与品质尚未折价。"
  lines << ""
  lines << "### 4.1 拆解"
  lines << ""
  lines << "| 工艺 | 目标候选值 | 最大回收值 | 最大回收比 |"
  lines << "|---|---:|---:|---:|"
  calibration.fetch("dismantle_rows").each do |row|
    lines << "| `#{row.fetch("id")}` | #{row.fetch("candidate_target_value")} | #{row.fetch("candidate_output_value_max")} | #{row.fetch("dismantle_recovery_ratio_max")} |"
  end
  lines << ""
  lines << "### 4.2 维修"
  lines << ""
  lines << "| 工艺 | 目标候选值 | 材料候选值 | 材料比 |"
  lines << "|---|---:|---:|---:|"
  calibration.fetch("repair_rows").each do |row|
    lines << "| `#{row.fetch("id")}` | #{row.fetch("candidate_target_value")} | #{row.fetch("candidate_consumed_input_value")} | #{row.fetch("repair_material_ratio")} |"
  end
  lines << ""
  lines << "## 5. 共享瓶颈候选"
  lines << ""
  lines << "| 物品 | 使用工艺数 | 覆盖主链 | 候选基础价值 |"
  lines << "|---|---:|---|---:|"
  report.fetch("shared_bottlenecks").first(15).each do |row|
    lines << "| `#{row.fetch("id")}` | #{row.fetch("recipe_count")} | #{row.fetch("resource_chains").join("、")} | #{row.fetch("candidate_base_value")} |"
  end
  lines << ""
  lines << "这些物品是未来选择主题—军备共享瓶颈的候选，不表示 Gate 2 已解锁。"
  lines << ""
  lines << "## 6. 产能集中度"
  lines << ""
  lines << "### 设施"
  lines << ""
  capacity.fetch("facilities").first(10).each { |row| lines << "- `#{row.fetch("facility")}`：#{row.fetch("recipe_count")} 张工艺" }
  lines << ""
  lines << "### 工具"
  lines << ""
  capacity.fetch("tools").first(10).each { |row| lines << "- `#{row.fetch("tool")}`：#{row.fetch("recipe_count")} 张工艺" }
  lines << ""
  lines << "### 最低岗位"
  lines << ""
  capacity.fetch("minimum_roles").each { |row| lines << "- `#{row.fetch("minimum_role")}`：#{row.fetch("recipe_count")} 张工艺" }
  lines << ""
  lines << "## 7. 重建命令"
  lines << ""
  lines << "```bash"
  lines << "ruby scripts/audit_item_library_flows.rb --write"
  lines << "ruby scripts/audit_item_library_flows.rb"
  lines << "```"
  lines << ""
  lines << "## 8. 接受边界"
  lines << ""
  lines << "- R1 物品、工艺、转换和候选数值未修改；"
  lines << "- 全部内容仍为 `candidate_only`；"
  lines << "- `runtime_authorization` 仍为 `NONE`；"
  lines << "- 不允许整包运行时导入；"
  lines << "- Gate 1A、Gate 1H 与 Gate 2 状态不因本报告改变。"
  lines << ""
  lines.join("\n")
end

options = parse_arguments(ARGV)

[BUNDLE_PATH, SEMANTIC_AUDIT_PATH, CONTRACT_PATH].each do |path|
  abort "FLOW_AUDIT=FAIL\n- 缺少 #{path}" unless File.file?(path)
end

bundle = JSON.parse(File.read(BUNDLE_PATH))
semantic_audit = JSON.parse(File.read(SEMANTIC_AUDIT_PATH))
payload = bundle.fetch("payload")
items = payload.fetch("inventory_items").to_h { |item| [item.fetch("id"), item] }
recipes = payload.fetch("recipes")
errors = []
warnings = []

calculated_payload_sha = Digest::SHA256.hexdigest(JSON.generate(canonicalize_json(payload)))
unless bundle["payload_sha256"] == calculated_payload_sha
  errors << {
    "code" => "payload_hash_mismatch",
    "id" => "bundle",
    "message" => "Bundle payload_sha256 与规范化 Payload 不一致"
  }
end
unless bundle["status"] == "candidate_only" && bundle["runtime_authorization"] == "NONE"
  errors << {
    "code" => "unsafe_bundle_status",
    "id" => "bundle",
    "message" => "Bundle 不再保持 candidate_only / NONE"
  }
end
unless bundle["baseline_id"] == EXPECTED_BASELINE_ID &&
       semantic_audit["source_baseline_id"] == bundle["baseline_id"]
  errors << {
    "code" => "baseline_identity_mismatch",
    "id" => "bundle",
    "message" => "Bundle 与 R2-A 没有共同指向冻结的 R1-C7 基线"
  }
end
unless semantic_audit["source_payload_sha256"] == bundle["payload_sha256"] &&
       semantic_audit["status"] == "candidate_only" &&
       semantic_audit["runtime_authorization"] == "NONE" &&
       semantic_audit.dig("audit", "errors").to_a.empty?
  errors << {
    "code" => "semantic_audit_not_usable",
    "id" => "semantic-audit-r2a",
    "message" => "R2-A 与当前 Payload、状态或无错误结论不一致"
  }
end
semantic_core = semantic_audit.reject { |key, _value| key == "audit_sha256" }
unless semantic_audit["audit_sha256"] == Digest::SHA256.hexdigest(JSON.generate(semantic_core))
  errors << {
    "code" => "semantic_audit_hash_mismatch",
    "id" => "semantic-audit-r2a",
    "message" => "R2-A audit_sha256 无法重算"
  }
end
expected_counts = {
  "inventory_items" => payload.fetch("inventory_items").length,
  "non_inventory_definitions" => payload.fetch("non_inventory_definitions").length,
  "catalog_definitions" => payload.fetch("inventory_items").length + payload.fetch("non_inventory_definitions").length,
  "recipes" => recipes.length,
  "transitions" => payload.fetch("transitions").length
}
unless bundle["counts"] == expected_counts
  errors << {
    "code" => "bundle_counts_mismatch",
    "id" => "bundle",
    "message" => "Bundle counts 与当前 Payload 不一致"
  }
end
selection_policy = bundle["selection_policy"].to_h
unless selection_policy["default_runtime_import"] == "deny" &&
       selection_policy["whole_bundle_import_allowed"] == false &&
       selection_policy["requires_explicit_stable_id_selection"] == true &&
       selection_policy["requires_separate_runtime_schema_and_gate_authorization"] == true
  errors << {
    "code" => "selection_policy_unsafe",
    "id" => "bundle",
    "message" => "候选选择策略不再完整拒绝默认运行时导入"
  }
end

recipe_ledger = build_recipe_ledger(recipes, items, errors, warnings)
transformation_edges, cycle_components = build_transformation_graph(recipes, items)
cycle_rows = build_cycle_rows(cycle_components, transformation_edges, recipe_ledger, errors)
source_sink = build_source_sink_audit(items, recipes, errors)
shared_bottlenecks = build_shared_bottlenecks(items, recipes)

warnings.each do |warning|
  next if warning["disposition"] && warning["rationale"]

  errors << {
    "code" => "warning_unadjudicated",
    "id" => warning["id"],
    "message" => "#{warning["code"]} 尚未裁定"
  }
end

errors.sort_by! { |entry| [entry["code"], entry["id"], entry["message"]] }
warnings.sort_by! { |entry| [entry["code"], entry["id"], entry["message"]] }

facility_rows = sorted_count_rows(recipes.flat_map { |recipe| recipe.fetch("facilities") }, "facility")
tool_rows = sorted_count_rows(recipes.flat_map { |recipe| recipe.fetch("tools") }, "tool")
role_rows = sorted_count_rows(recipes.map { |recipe| recipe.dig("qualification", "minimum_role") }, "minimum_role")

report_core = {
  "schema_version" => "new-era-2.item-library.flow-audit.r2b.v0.1",
  "source_baseline_id" => bundle.fetch("baseline_id"),
  "source_payload_sha256" => bundle.fetch("payload_sha256"),
  "source_semantic_audit_sha256" => semantic_audit.fetch("audit_sha256"),
  "status" => bundle.fetch("status"),
  "runtime_authorization" => bundle.fetch("runtime_authorization"),
  "source_files" => {
    "data/item-library/item-library-r1-candidate-bundle.json" => Digest::SHA256.file(BUNDLE_PATH).hexdigest,
    "data/item-library/semantic-audit-r2a.json" => Digest::SHA256.file(SEMANTIC_AUDIT_PATH).hexdigest,
    "docs/item-library/item-library-flow-audit-contract-v0.1.md" => Digest::SHA256.file(CONTRACT_PATH).hexdigest,
    "scripts/audit_item_library_flows.rb" => Digest::SHA256.file(__FILE__).hexdigest
  },
  "counts" => {
    "inventory_items" => items.length,
    "recipes" => recipes.length,
    "consumed_recipe_inputs" => recipes.flat_map { |recipe| recipe.fetch("inputs", []) }.count { |entry| entry["consumed"] == true },
    "non_consumed_recipe_inputs" => recipes.flat_map { |recipe| recipe.fetch("inputs", []) }.count { |entry| entry["consumed"] != true }
  },
  "thresholds" => {
    "normal_value_ratio_low" => NORMAL_VALUE_RATIO_LOW,
    "normal_value_ratio_high" => NORMAL_VALUE_RATIO_HIGH,
    "dismantle_warning_ratio" => DISMANTLE_WARNING_RATIO,
    "dismantle_error_ratio" => 1.0,
    "repair_warning_ratio" => REPAIR_WARNING_RATIO
  },
  "audit" => {
    "errors" => errors,
    "warnings" => warnings
  },
  "source_sink" => source_sink,
  "transformation_graph" => {
    "node_count" => items.length,
    "edge_count" => transformation_edges.length,
    "edges" => transformation_edges,
    "cycle_count" => cycle_rows.length,
    "cycles" => cycle_rows
  },
  "recipe_ledger" => recipe_ledger,
  "candidate_value_calibration" => {
    "normal_ratio_outliers" => recipe_ledger.select do |row|
      ratio = row["candidate_value_ratio_max"]
      ratio && (ratio < NORMAL_VALUE_RATIO_LOW || ratio > NORMAL_VALUE_RATIO_HIGH)
    end,
    "dismantle_rows" => recipe_ledger.select { |row| row["kind"] == "dismantle" },
    "repair_rows" => recipe_ledger.select { |row| row["kind"] == "repair" }
  },
  "shared_bottlenecks" => shared_bottlenecks,
  "capacity_concentration" => {
    "facilities" => facility_rows,
    "tools" => tool_rows,
    "minimum_roles" => role_rows
  }
}

audit_sha = Digest::SHA256.hexdigest(JSON.generate(report_core))
report = report_core.merge("audit_sha256" => audit_sha)
json_output = JSON.pretty_generate(report) + "\n"
markdown_output = build_markdown(report)

unless errors.empty?
  warn "FLOW_AUDIT=FAIL"
  errors.each { |entry| warn "- #{entry["code"]} #{entry["id"]}: #{entry["message"]}" }
  exit 1
end

if options[:write]
  File.write(JSON_REPORT_PATH, json_output)
  File.write(MARKDOWN_REPORT_PATH, markdown_output)
  puts "FLOW_AUDIT_JSON=WRITTEN #{JSON_REPORT_PATH}"
  puts "FLOW_AUDIT_MARKDOWN=WRITTEN #{MARKDOWN_REPORT_PATH}"
else
  unless File.file?(JSON_REPORT_PATH) && File.read(JSON_REPORT_PATH) == json_output
    warn "FLOW_AUDIT=FAIL"
    warn "- #{File.basename(JSON_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
  unless File.file?(MARKDOWN_REPORT_PATH) && File.read(MARKDOWN_REPORT_PATH) == markdown_output
    warn "FLOW_AUDIT=FAIL"
    warn "- #{File.basename(MARKDOWN_REPORT_PATH)} 缺失或已过期；使用 --write 刷新"
    exit 1
  end
end

puts "FLOW_AUDIT=PASS"
puts "ERROR_COUNT=#{errors.length}"
puts "WARNING_COUNT=#{warnings.length}"
puts "EXTERNAL_SOURCE_ITEM_COUNT=#{source_sink.fetch("external_source_count")}"
puts "TERMINAL_OUTPUT_ITEM_COUNT=#{source_sink.fetch("terminal_output_count")}"
puts "TRANSFORMATION_CYCLE_COUNT=#{cycle_rows.length}"
puts "SHARED_BOTTLENECK_COUNT=#{shared_bottlenecks.length}"
puts "VALUE_RATIO_OUTLIER_COUNT=#{report.dig("candidate_value_calibration", "normal_ratio_outliers").length}"
puts "AUDIT_SHA256=#{audit_sha}"
puts "RUNTIME_AUTHORIZATION=#{bundle.fetch("runtime_authorization")}"
