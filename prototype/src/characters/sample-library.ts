import { deriveSeedV1 } from './seed'
import {
  MBTI_TYPES,
  SKILL_KEYS,
  type AddressRule,
  type CharacterLibrary,
  type CoreValue,
  type GeneratedCharacter,
  type MbtiType,
  type SkillKey,
} from './model'
import { validateCharacterLibrary } from './validator'

export const CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION =
  'character-sample-library-v0.1-draft' as const
export const CHARACTER_SAMPLE_SCHEMA_VERSION =
  'character-sample-v0.1-draft' as const
const SAMPLE_GATE_NOTE =
  '本包只准备 A1 输入；Gate 1H 人物记忆度证据、E01–E06 与 MBTI 玩家验证均未执行。'
const CRITICAL_CROSS_SKILLS = [
  '工程',
  '交涉',
  '医疗',
  '研究',
  '防卫',
] as const satisfies readonly SkillKey[]

type SamplePairId =
  | 'pair-istj'
  | 'pair-intj'
  | 'pair-isfp'
  | 'pair-enfp'
  | 'pair-esfj'
  | 'pair-entp'

type ManualReviewStatus = 'not_run'

interface DecisionScene {
  title: string
  setup: string
  accept_choice: string
  accept_consequence: string
  accept_immediate_cost: string
  accept_long_term_risk: string
  decline_choice: string
  decline_consequence: string
  decline_immediate_cost: string
  decline_long_term_risk: string
}

interface SampleDraft {
  source_character_id: string
  pair_id: SamplePairId
  counterpart_source_character_id: string
  revised_biography: string
  first_impression: string
  ordinary_behavior: string
  stress_behavior: string
  voice_line: string
  identity_without_mbti: string
  same_type_contrast: string
  decision_scene: DecisionScene
  review_questions: readonly [string, string, string]
}

export interface CharacterSample {
  schema_version: typeof CHARACTER_SAMPLE_SCHEMA_VERSION
  sample_id: string
  source_character_id: string
  source_distinction_fingerprint: string
  pair_id: SamplePairId
  counterpart_source_character_id: string
  formal_name: string
  age: number
  gender: GeneratedCharacter['gender']
  origin: string
  internal_mbti_type: MbtiType
  mbti_display_policy: 'HIDDEN_IN_PLAYER_CARD_UNTIL_VALIDATED'
  primary_skills: readonly SkillKey[]
  qualifications: GeneratedCharacter['qualifications']
  address_rules: GeneratedCharacter['address_rules']
  source_biography_summary: string
  revised_biography: string
  first_impression: string
  ordinary_behavior: string
  stress_behavior: string
  voice_line: string
  core_values: GeneratedCharacter['core_values']
  redline_preview: string
  current_motivation: string
  relationship_hook: string
  long_term_goal: string
  visible_request: string
  identity_without_mbti: string
  same_type_contrast: string
  decision_scene: DecisionScene
  review_questions: readonly [string, string, string]
  manual_review_status: {
    E01_naming: ManualReviewStatus
    E02_extreme_stats_and_experience: ManualReviewStatus
    E03_causal_bridge: ManualReviewStatus
    E04_stereotype_risk: ManualReviewStatus
    E05_decision_impact: ManualReviewStatus
    E06_distinction: ManualReviewStatus
    mbti_player_validation: ManualReviewStatus
  }
}

export interface SampleValidationFinding {
  validation_id:
    | 'S01-SCHEMA'
    | 'S02-SOURCE-BINDING'
    | 'S03-SAME-TYPE-PAIRS'
    | 'S04-MBTI-DIMENSION-BALANCE'
    | 'S05-SKILL-COVERAGE'
    | 'S06-CONTENT-COMPLETENESS'
    | 'S07-GATE-HONESTY'
    | 'S08-DISTINCTION'
    | 'S09-EI-SKILL-CONTINGENCY'
    | 'S10-CONTENT-REPETITION'
  predicate: string
  evidence: string
  result: 'passed' | 'warned' | 'blocked'
}

interface CharacterSampleLibraryBase {
  schema_version: typeof CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION
  sample_library_id: string
  status: 'DRAFT_BEFORE_A1'
  development_stage: 'A1_INPUT_PREPARATION_ONLY'
  source_library_id: string
  source_library_schema_version: CharacterLibrary['schema_version']
  source_library_status: CharacterLibrary['status']
  culture_pack_version: CharacterLibrary['culture_pack_version']
  purpose: 'SAME_MBTI_DIFFERENT_LIFE_PATH_VALIDATION'
  gate_dependency: {
    formal_a1_status: 'NOT_STARTED'
    waiting_for: 'GATE_1H_CHARACTER_MEMORY_EVIDENCE'
    note: string
  }
  samples: readonly CharacterSample[]
}

export interface CharacterSampleLibrary extends CharacterSampleLibraryBase {
  validation: {
    scope: 'DRAFT_SAMPLE_STRUCTURE_ONLY'
    machine_structure_passed: boolean
    findings: readonly SampleValidationFinding[]
    manual_reviews: {
      E01: ManualReviewStatus
      E02: ManualReviewStatus
      E03: ManualReviewStatus
      E04: ManualReviewStatus
      E05: ManualReviewStatus
      E06: ManualReviewStatus
      mbti_player_validation: ManualReviewStatus
    }
  }
}

const SAMPLE_DRAFTS = [
  {
    source_character_id: 'char_b032f4309fc7025b',
    pair_id: 'pair-istj',
    counterpart_source_character_id: 'char_82d66105b40cbaf9',
    revised_biography:
      '陶穗宁在夜间警戒频繁的居住区长大，先学会把无关人员移出危险区，后来才接受社区护理训练。她在康复病区多年负责缓慢、重复却不能出错的照护排班；替未成年人承担债务劳动后，她开始警惕把制度代价推给最弱者。现在她想把“提前维护”同时用在病人和设备上，但这会与眼前产能发生冲突。',
    first_impression: '说话不急，先确认伤员、旁观者和撤离路线各在哪里。',
    ordinary_behavior: '把康复、清洁和设备检查拆成固定轮值，宁愿每天推进一点。',
    stress_behavior: '先清空危险区域，再找一名搭档复核处置顺序。',
    voice_line: '今天不停机，可能只是把停机推到最缺人的那天。',
    identity_without_mbti:
      '她仍是坚持慢恢复、反对债务伤害未成年人、会为预防性维护争取时间的康复照护者。',
    same_type_contrast:
      '同为 ISTJ，陶穗宁围绕照护节律和预防维护行动；杜映秋围绕现场证据、风险标注和撤离责任行动。',
    decision_scene: {
      title: '康复班与水泵轴承',
      setup: '水泵出现异响，但当天也是三名伤员第一次完整康复训练。',
      accept_choice: '接受陶穗宁的请求，抽调一人停泵检查。',
      accept_consequence: '当日产能下降，伤员训练缩短，但避免故障扩大并积累维护记录。',
      accept_immediate_cost: '停泵检查会削减当日供水，并压缩三名伤员的康复训练。',
      accept_long_term_risk: '若检查未发现严重问题，聚落可能白白失去一次关键康复进度。',
      decline_choice: '维持满负荷运行和原康复排班。',
      decline_consequence: '短期产能不变；若次日故障，陶穗宁会要求追查谁忽略了预警。',
      decline_immediate_cost: '值班者必须在满负荷生产中持续监听异响，无法投入其他维护。',
      decline_long_term_risk: '轴承若继续恶化，之后可能在缺人日停机并拉长伤员恢复周期。',
    },
    review_questions: [
      '不显示 MBTI 时，玩家能否复述她为何重视预防维护？',
      '玩家是否把她记成“医疗最高的人”，而不是康复节律与债务红线？',
      '与杜映秋同场时，玩家能否说出两人处理风险的不同顺序？',
    ],
  },
  {
    source_character_id: 'char_82d66105b40cbaf9',
    pair_id: 'pair-istj',
    counterpart_source_character_id: 'char_b032f4309fc7025b',
    revised_biography:
      '杜映秋从诊疗站家属区带走了隔离与清洁习惯，又在野外测绘训练中学会把“看见异常”改写成可复核的风险标注。气象站撤离时，导师选择设备而放弃学徒，她返回把人带出，此后任何清单都必须写明最后一人的去向。她想建立公开交接账，因为在她看来，含糊记录往往先伤害不在场的人。',
    first_impression: '给出的每个结论都带范围、置信度和下一次复核时间。',
    ordinary_behavior: '出发前核对路线、天气、人员清单和交接人，回来后补齐空白。',
    stress_behavior: '列出不可逆风险，先处理人员失联，再处理设备损失。',
    voice_line: '设备编号都在，学徒的名字为什么不在撤离表上？',
    identity_without_mbti:
      '此人仍由洪水预警、学徒撤离责任和公开交接账构成，不依赖四字母类型。',
    same_type_contrast:
      '同为 ISTJ，杜映秋通过证据边界和人员清单管理风险；陶穗宁通过持续照护和预防节律管理风险。',
    decision_scene: {
      title: '未回报的测绘学徒',
      setup: '暴雨将至，测绘组只带回设备，学徒在旧路标附近失联。',
      accept_choice: '同意杜映秋带护送者按最后坐标返回。',
      accept_consequence: '抢收少一组人，但学徒获救并补全一条危险路线。',
      accept_immediate_cost: '抢收少一组人，搜救者也要在暴雨前承担一次外出风险。',
      accept_long_term_risk: '最后坐标若已失效，搜救可能无果并让两名熟练成员同时受困。',
      decline_choice: '封闭外出，把人员列为失联。',
      decline_consequence: '保住眼前劳力；杜映秋拒绝下一次单人带教，训练效率长期下降。',
      decline_immediate_cost: '学徒失去最后一次及时搜救机会，相关成员的信任立即受损。',
      decline_long_term_risk: '未来带教和外勤招募会更困难，危险路线也继续缺少可靠记录。',
    },
    review_questions: [
      '玩家能否从她的说法理解“低置信度预警”而不是认为她胆小？',
      '玩家是否记得她的学徒责任，而不只记得侦察数值？',
      '与陶穗宁相比，她是否表现出不同的秩序来源？',
    ],
  },
  {
    source_character_id: 'char_24e05d30f6e650e6',
    pair_id: 'pair-intj',
    counterpart_source_character_id: 'char_08e063fd6a1c1f15',
    revised_biography:
      '高令仪在旧港维修棚里学会听设备的异响，随后接受低压电路与断电检修训练，在水泵组长期负责故障定位和带教。旧队伍打算用劫掠弥补维修物资时，她选择离开。她现在想把三条季节路线做成共享地图，却必须承认：每次外出记录，都会挤占聚落里只有她能完成的检修时间。',
    first_impression: '先听设备运转一轮，再在纸上画出故障链和最晚停机点。',
    ordinary_behavior: '把临时修补、正式停机和路线勘察分别排进日历，不让任何一项假装没有代价。',
    stress_behavior: '先照看受影响的人，再封存故障现场，避免在争执中反复试机。',
    voice_line: '泵可以今天拆，山口的融雪线却只出现这两天。',
    identity_without_mbti:
      '她仍是会追查设备异响、拒绝用劫掠补缺、在检修与共享路线之间分配时间的维修者。',
    same_type_contrast:
      '同为 INTJ，高令仪围绕设备寿命和季节窗口规划；顾远帆围绕警戒边界和停止使用武力的条件规划。',
    decision_scene: {
      title: '融雪线与临时轴封',
      setup: '北坡路线只有两天能记录融雪风险，水泵轴封也已靠临时件运行。',
      accept_choice: '让高令仪带一名护送者完成低收益路线勘察。',
      accept_consequence: '获得整季都能复用的风险记录，但水泵两天内只能降载运行，并承担临时件失效风险。',
      accept_immediate_cost: '供水必须降载两天，护送者也无法参加本轮采集。',
      accept_long_term_risk: '若路线价值很低且临时轴封失效，聚落会同时损失勘察与供水。',
      decline_choice: '取消本次勘察，让她立即完成水泵正式检修。',
      decline_consequence: '供水可靠性恢复，但路线记录要再等一年，冬季运输继续依赖旧经验。',
      decline_immediate_cost: '取消已准备的外出会浪费护送排班与本季唯一的融雪观察窗口。',
      decline_long_term_risk: '冬季运输继续依赖旧经验，下一次封路时仍可能没有替代路径。',
    },
    review_questions: [
      '玩家能否复述她为什么把季节窗口与检修窗口放在一起计算？',
      '玩家会把她记成工程最高的人，还是会记住共享地图的机会成本？',
      '与顾远帆相比，玩家能否区分设备规划和防卫规划？',
    ],
  },
  {
    source_character_id: 'char_08e063fd6a1c1f15',
    pair_id: 'pair-intj',
    counterpart_source_character_id: 'char_24e05d30f6e650e6',
    revised_biography:
      '顾远帆在高原观测站长大，长期变化比单次喧闹更能说服他。防卫训练让他负责警戒、纠纷隔离和非战斗人员撤离；拒绝处决投降者后，他失去原岗位，却没有放弃防卫本身。他欠外部帮助者一笔具体物资债，加入聚落后会在安全、供给和承诺之间坚持写出可执行的边界。',
    first_impression: '站位总在出口和人群之间，发言前先确认威胁是否仍然存在。',
    ordinary_behavior: '把警戒触发条件、撤离路线和停止使用武力的条件写在同一张表上。',
    stress_behavior: '减少争辩，用书面命令隔离冲突并保护没有准备的人。',
    voice_line: '投降以后是看管问题，不是泄愤问题。',
    identity_without_mbti:
      '此人仍由非报复性防卫、俘虏红线和有争议的外部债务构成。',
    same_type_contrast:
      '同为 INTJ，顾远帆的核心冲突是武力何时停止；高令仪的核心冲突是检修窗口与长期路线记录如何排序。',
    decision_scene: {
      title: '粮仓旁的投降者',
      setup: '一次夜袭后，一名袭击者放下武器；聚落食物只够多养一人五天。',
      accept_choice: '按顾远帆方案解除武装、轮班看管并联系交换。',
      accept_consequence: '消耗粮食和警戒工时，但获得口供与谈判筹码。',
      accept_immediate_cost: '看管会消耗五天口粮，并让夜间巡逻少一名熟练成员。',
      accept_long_term_risk: '交换若失败，长期羁押会继续消耗资源，也可能鼓励对方今后绑人换物。',
      decline_choice: '没收武器和补给后释放对方，并立即调整警戒路线。',
      decline_consequence: '省下看管资源，但失去口供与交换机会，也无法确认对方是否会回到袭击队伍。',
      decline_immediate_cost: '聚落立刻失去一项情报来源和潜在交换筹码。',
      decline_long_term_risk: '被释放者可能带回聚落布防信息，促成下一次更有准备的袭击。',
    },
    review_questions: [
      '玩家是否把他的红线理解为防卫规则，而非软弱？',
      '玩家能否记住外部债务对物资决策的影响？',
      '与高令仪相比，他是否呈现不同的“先规划再行动”？',
    ],
  },
  {
    source_character_id: 'char_8a45ce039608f518',
    pair_id: 'pair-isfp',
    counterpart_source_character_id: 'char_262a287dc44df773',
    revised_biography:
      '蒋书衡在旧港维修棚与零件市场之间长大，却把长期工作落在种子合作社：育苗、轮作和歉收后的补种。替一户家庭承担债务劳动让他失去迁移名额，也让他拒绝把成年人的欠账自动压到孩子身上。来到新聚落后，他想建立有记录的异议流程，因为对他而言，照料土地和允许反对意见都是给失败保留第二条路。',
    first_impression: '先摸土、看苗，再问这项决定有没有给失败留退路。',
    ordinary_behavior: '为种植计划准备补种方案，也会把反对意见写进资源会议记录。',
    stress_behavior: '先照看受影响的人，随后追查异常究竟从哪一步开始。',
    voice_line: '种子还能再育一批，孩子不该继承一张永远还不完的账。',
    identity_without_mbti:
      '他仍是会准备补种、反对未成年人继承债务、要求异议留痕的种植者。',
    same_type_contrast:
      '同为 ISFP，蒋书衡通过照料作物和补种方案保留退路；周子衿通过议事记录和训练轮值保留退路。',
    decision_scene: {
      title: '春播份额与公共工时',
      setup: '一个欠债家庭缺少两周成人劳力；聚落可代补工时，也可缩小其播种份额并延期还款。',
      accept_choice: '采用社区补工计划，维持该家庭原定播种份额。',
      accept_consequence: '其他成员多承担两周劳动，但春播规模和家庭恢复机会得以保留。',
      accept_immediate_cost: '公共工程与其他农田必须让出一部分工时，引发公平性质疑。',
      accept_long_term_risk: '若没有清晰偿还安排，补工计划可能被视为可以反复获得的特殊待遇。',
      decline_choice: '缩小该家庭本季地块，并把余债延期到收获后。',
      decline_consequence: '其他成员无需补工，但该家庭本季收入减少，偿债周期被拉长。',
      decline_immediate_cost: '合作社需要重排种苗，家庭也会立刻失去一部分可用收成。',
      decline_long_term_risk: '若本季再次歉收，延期债务可能继续累积并损害合作关系。',
    },
    review_questions: [
      '玩家是否能同时记住他的生产能力和议事诉求？',
      '他的关怀是否被误读为没有成本的善良？',
      '与周子衿相比，同类型的价值表达是否足够不同？',
    ],
  },
  {
    source_character_id: 'char_262a287dc44df773',
    pair_id: 'pair-isfp',
    counterpart_source_character_id: 'char_8a45ce039608f518',
    revised_biography:
      '周子衿在梯田轮换灌溉和守夜中长大，后来学习会议主持与争议记录，长期负责配给、用水和公共劳动议事。替一户家庭承担公共劳动后，她失去迁移名额，也更在意程序是否给弱者留下声音。她希望建立不依赖自己的基础诊疗轮值，但每个训练块都会让她缺席一次正在发生的资源争议。',
    first_impression: '先把沉默者的意见写进记录，再提出自己倾向的方案。',
    ordinary_behavior: '把议事结论拆成责任人和复核日，也固定留出清洁与基础处置训练。',
    stress_behavior: '列出不可逆损失，先处理最紧急的一项，再回头补齐异议。',
    voice_line: '我可以主持今天的分水会，也可以训练下一位值班员，但这两个小时只有一次。',
    identity_without_mbti:
      '她仍是会保留异议、反对债务无限继承、想让基础诊疗不依赖单一成员的议事主持人。',
    same_type_contrast:
      '同为 ISFP，周子衿通过议事记录和轮值训练分散依赖；蒋书衡通过补种和生产恢复分散风险。',
    decision_scene: {
      title: '分水会与清洁训练',
      setup: '一次关键分水会与首次基础诊疗训练撞期，两边都要求周子衿亲自主持。',
      accept_choice: '保留训练，让另一名成员按既有议程主持分水会。',
      accept_consequence: '诊疗轮值开始形成，但用水争议可能因代理主持经验不足而延长。',
      accept_immediate_cost: '代理主持需要额外准备，分水决定也可能推迟到当日晚间。',
      accept_long_term_risk: '若代理处理失当，用水冲突会削弱大家对轮换主持的信任。',
      decline_choice: '由她主持分水会，把训练顺延到下周。',
      decline_consequence: '当日资源冲突更容易收束，但聚落继续多一周依赖少数会处置伤病的人。',
      decline_immediate_cost: '已经安排的清洁物资和学员时段被打乱，下一次训练要重新协调。',
      decline_long_term_risk: '反复顺延会让基础诊疗继续依赖少数成员，缺席时更容易中断。',
    },
    review_questions: [
      '玩家能否理解她不是单纯偏爱会议或训练，而是在分配不可替代时间？',
      '她的医疗请求是否与现有交涉经历形成可理解的跨度？',
      '与蒋书衡相比，她保留退路的方式是否足够不同？',
    ],
  },
  {
    source_character_id: 'char_ad5877a2c458f8cf',
    pair_id: 'pair-enfp',
    counterpart_source_character_id: 'char_90deb66520a08696',
    revised_biography:
      '程向榆在诊疗站家属区熟悉隔离和照护，又在档案区与社区实验室学习把土壤、水质和药材记录转成行动建议。旧队伍决定劫掠无防卫村落时，她独自离开。现在她希望用公开配给、保存试验和公共灶减少冬季猜疑，但提前保存会直接减少眼前可分配的鲜食。',
    first_impression: '会把老人、病人和种植者叫到同一张桌前，边听边改保存方案。',
    ordinary_behavior: '用小批量试验比较保存方法，并把失败批次也留在记录里。',
    stress_behavior: '先照看受影响的人，再公开哪些推断仍缺证据。',
    voice_line: '多留一坛不是悲观，是花今天的一点满足换冬天的一次选择。',
    identity_without_mbti:
      '她仍是把实验记录、基础照护和公共灶连在一起，并拒绝用掠夺解决短缺的社区实验员。',
    same_type_contrast:
      '同为 ENFP，程向榆用小批量试验调整保存和照护；沈知遥用可逆试验调整工程路径。',
    decision_scene: {
      title: '鲜食周与冬储试验',
      setup: '本周收获刚够改善全员饮食，也恰好是验证一种新保存法的最后批次。',
      accept_choice: '按程向榆方案留出一成收获做有记录的保存试验。',
      accept_consequence: '本周公共灶份量减少，换来冬季多一种可靠储存方案的可能。',
      accept_immediate_cost: '本周每人的鲜食份量下降，实验还额外占用清洁容器和工时。',
      accept_long_term_risk: '新方法若失败，这批食物会损耗，且可能让成员不再支持后续试验。',
      decline_choice: '全部用于本周鲜食，等下次丰收再试。',
      decline_consequence: '立即改善营养和士气，但错过季节窗口，冬储继续依赖单一方法。',
      decline_immediate_cost: '已经准备的实验工序作废，保存团队本周没有可验证的新记录。',
      decline_long_term_risk: '冬季若现有保存方法失效，聚落将缺少经过验证的替代方案。',
    },
    review_questions: [
      '玩家能否复述保存试验的即时成本和长期收益？',
      '她是否不只是研究或医疗数值较高的人？',
      '与沈知遥相比，两人的可逆试验是否作用于不同生活领域？',
    ],
  },
  {
    source_character_id: 'char_90deb66520a08696',
    pair_id: 'pair-enfp',
    counterpart_source_character_id: 'char_ad5877a2c458f8cf',
    revised_biography:
      '沈知遥在高原观测站学会复核读数，后来负责盐泽风机巡检和恶劣天气后的快速复位。他愿意谈很多备选方案，却不会为了“大胆”牺牲可靠性；一次护送中看见居民被当作火力诱饵后，他离开原队伍。废弃供水设施对他既是工程机会，也是一次证明修复可以不靠冒险牺牲他人的试验。',
    first_impression: '一边说出三种修法，一边把最危险的那一种先划掉。',
    ordinary_behavior: '喜欢把工程问题拆成可逆试验，先勘察再争取完整资源。',
    stress_behavior: '把大故障拆成短时任务，并约定下一次停机复盘点。',
    voice_line: '先花一天确认水渠，不等于放弃修复，是避免拿人去赌。',
    identity_without_mbti:
      '此人仍由风机检修、平民安全红线和废弃供水修复目标构成。',
    same_type_contrast:
      '同为 ENFP，沈知遥用可逆试验探索工程路径；程向榆用小批量试验调整保存、照护和公共灶。',
    decision_scene: {
      title: '废水渠的第一天',
      setup: '聚落只能选择立即派满员维修，或先用一日勘察不稳定渠段。',
      accept_choice: '先勘察并做小范围压力测试。',
      accept_consequence: '供水恢复推迟一天，但发现一处会危及维修队的塌方。',
      accept_immediate_cost: '供水恢复至少推迟一天，勘察队也占用一组防护装备。',
      accept_long_term_risk: '若旱情提前到来，一天延误可能让后续修复失去足够蓄水时间。',
      decline_choice: '先修复已确认安全的外段，把不稳定渠段隔离到下一轮。',
      decline_consequence: '部分供水可能更早恢复，但完整流量仍未知，已投入材料也可能无法复用。',
      decline_immediate_cost: '材料和工时先压在局部工程上，其他维修项目必须延期。',
      decline_long_term_risk: '若塌方段最终无法修复，局部投入会形成沉没成本并拖慢替代方案。',
    },
    review_questions: [
      '玩家会把他记成提出可逆试验的人，还是只记成工程最高？',
      '他的乐观是否仍有可靠性边界？',
      '与程向榆相比，玩家能否指出两人的行动对象不同？',
    ],
  },
  {
    source_character_id: 'char_f54f717de8bb94d2',
    pair_id: 'pair-esfj',
    counterpart_source_character_id: 'char_ebeb5990ef78e161',
    revised_biography:
      '方怀瑾从旧港维修区走向山地勘察，多年确认水源、火险和冬季通路。他习惯把地图空白变成可以教给下一人的方法，而不是个人筹码。原队伍准备劫掠一个无威胁村落时，他独自离队；如今他要求固定教学时间，因为一个聚落若只能依赖唯一向导，就仍然没有安全路线。',
    first_impression: '会先叫上相关的人一起看现场，再亲自确认地图上缺的那一段。',
    ordinary_behavior: '把路线经验变成公开标注和教学块，主动询问新人是否真正理解。',
    stress_behavior: '要求把争议说清楚，并把“缺资源”与“可以伤害谁”分开。',
    voice_line: '交易没谈成，就换路、换货，不能把没武器的人当补给点。',
    identity_without_mbti:
      '此人仍是拒绝劫掠、重视现场确认并坚持培养接班人的山地向导。',
    same_type_contrast:
      '同为 ESFJ，方怀瑾通过共同踏勘与教学建立关系；高柏舟通过议事程序与发言秩序建立关系。',
    decision_scene: {
      title: '冬路与高价粮',
      setup: '储粮不足，邻村愿意高价出售一批粮食；另一条山路可能通向新交易点，但尚未勘察。',
      accept_choice: '安排教学组勘察新路并重新谈判。',
      accept_consequence: '短期减少采集人手，但获得新路线和第二名可用向导。',
      accept_immediate_cost: '勘察会减少本周采集人手，粮仓必须执行更严格的临时配给。',
      accept_long_term_risk: '新路若不可用，聚落既错过当前报价，也消耗了关键食物余量。',
      decline_choice: '接受邻村高价，用一批维修工具换取现粮。',
      decline_consequence: '立即填补粮食缺口，但来季维修能力下降，并形成对单一交易方的依赖。',
      decline_immediate_cost: '聚落失去一批稀缺维修工具，近期设备维护必须延后。',
      decline_long_term_risk: '持续高价采购会削弱议价能力，也可能让邻村掌握聚落的短缺周期。',
    },
    review_questions: [
      '玩家是否理解固定教学块与单点失效的关系？',
      '他的外向表达是否被误作无条件服从群体？',
      '与高柏舟相比，玩家能否区分现场协作和会议协作？',
    ],
  },
  {
    source_character_id: 'char_ebeb5990ef78e161',
    pair_id: 'pair-esfj',
    counterpart_source_character_id: 'char_f54f717de8bb94d2',
    revised_biography:
      '高柏舟在沿河市场街区替人传话、记账和调停，后来主持配给、用水与公共劳动议事。一次低置信度误报引发全聚落撤离，他没有掩盖错误，而是重建双人复核流程。现在他想完成一份被政治压力中断的档案；他会保护沉默者发言，也会阻止任何人把未经复核的猜测包装成确定灾害。',
    first_impression: '先问没说话的人怎么看，再确认每句警报是谁复核的。',
    ordinary_behavior: '为议题列出异议、证据等级和下一次复核，不用多数表决抹去少数记录。',
    stress_behavior: '主动找搭档复核，避免自己再次成为唯一的信息出口。',
    voice_line: '可以先警戒，但请把“可能”写成“可能”。',
    identity_without_mbti:
      '此人仍由误报责任、双人复核、沉默者发言权和未完成档案构成。',
    same_type_contrast:
      '同为 ESFJ，高柏舟关注谁被听见以及消息如何定级；方怀瑾关注谁能共同确认路线并接过技能。',
    decision_scene: {
      title: '低置信度污染警报',
      setup: '单一水样出现异常，全面停水会损失两天生产，但继续使用可能扩大风险。',
      accept_choice: '发布临时警戒，限制用途并安排第二次独立采样。',
      accept_consequence: '产能下降但信息诚实，第二份结果将决定是否全面停水。',
      accept_immediate_cost: '居民需要排队领取安全用水，清洗和生产项目也必须削减。',
      accept_long_term_risk: '若污染扩散快于复检，有限用途政策可能仍让少量成员暴露。',
      decline_choice: '以预防原则全面停水两天，同时明确标注结论仍待复核。',
      decline_consequence: '暴露风险降到最低，但储水会快速消耗，两天生产全部中断。',
      decline_immediate_cost: '公共灶、清洁和生产立即停摆，备用水运输必须加班启动。',
      decline_long_term_risk: '若最终是误报，频繁全面停水会降低居民对下一次警报的响应意愿。',
    },
    review_questions: [
      '玩家能否区分“快速预警”和“夸大置信度”？',
      '他是否不只是一个高交涉角色？',
      '与方怀瑾相比，同类型的人际关注是否落在不同机制上？',
    ],
  },
  {
    source_character_id: 'char_35ac81725e5b62cf',
    pair_id: 'pair-entp',
    counterpart_source_character_id: 'char_69d38c37b2e8915c',
    revised_biography:
      '孟明隽从旧港维修棚进入聚落防卫训练，长期承担夜间警戒、纠纷隔离和非战斗人员撤离。一次误报导致全员仓促撤离后，他承担责任并建立双人复核。附近废弃供水设施让他重新面对同一难题：信息不足时，应该先争取机会，还是先守住有限警戒力量。',
    first_impression: '会一口气提出几种警戒布置，再主动标出其中证据最薄的一种。',
    ordinary_behavior: '轮换观察点并记录误报来源，把撤离路线与停止警报的条件一起演练。',
    stress_behavior: '暂时减少发言，用书面记录拆开威胁、猜测和必须立即做的事。',
    voice_line: '可以去看水渠，但别把“可能有价值”写成“已经安全”。',
    identity_without_mbti:
      '此人仍由夜间警戒、误报责任、双人复核和废弃供水设施勘察构成。',
    same_type_contrast:
      '同为 ENTP，孟明隽围绕威胁证据和警戒力量调整方案；周照临围绕路线、配给和运输余量调整方案。',
    decision_scene: {
      title: '水渠勘察与夜间警戒',
      setup: '旧水渠只能在明日低水位时进入，但近期外围脚印让夜间警戒需要完整轮班。',
      accept_choice: '抽调孟明隽和一名搭档进行限时勘察。',
      accept_consequence: '获得修复价值的直接证据，但当夜外围警戒少一组，其他成员需要延长值守。',
      accept_immediate_cost: '其他警戒员必须延长值守，勘察组也承担一次狭窄空间风险。',
      accept_long_term_risk: '若渠内没有修复价值，疲劳警戒与勘察风险都不会换来可用收益。',
      decline_choice: '保留完整警戒，只在高处继续远距观察水渠。',
      decline_consequence: '夜间安全余量不变，但关键内部结构仍未知，修复决定至少延后一个月。',
      decline_immediate_cost: '已经集结的勘察装备和低水位窗口无法利用，准备工时被浪费。',
      decline_long_term_risk: '拖延一个月可能错过修复季节，使聚落继续依赖现有脆弱水源。',
    },
    review_questions: [
      '玩家能否看见勘察机会和警戒缺口都是真实风险？',
      '误报经历是否改变了他表达不确定性的方式？',
      '与周照临相比，他的方案探索是否更偏威胁判断？',
    ],
  },
  {
    source_character_id: 'char_69d38c37b2e8915c',
    pair_id: 'pair-entp',
    counterpart_source_character_id: 'char_35ac81725e5b62cf',
    revised_biography:
      '周照临在林场边缘参加巡看与失火预警，后来随长途车队核算货载、燃料、路线接力和损耗。干旱时管理者把公共水转给私人温室，他公开真实账目后离开。现在他想用公开配给和共同烹饪减少猜疑；他乐于重排路线和装载，却不会接受把基本饮水藏在“灵活调度”里。',
    first_impression: '会迅速提出替代路线，但每条路线都附带燃料和损耗余量。',
    ordinary_behavior: '把运输、冬储和公共灶看成一张可重排的网络，主动解释谁承担代价。',
    stress_behavior: '先找退路和备用交接点，再把被隐藏的资源流向摊开。',
    voice_line: '可以改路线，不能改账；水去了哪里，所有人都该看得见。',
    identity_without_mbti:
      '此人仍由长途后勤、公开用水账和可预测公共灶轮值构成。',
    same_type_contrast:
      '同为 ENTP，周照临用备选路线重组资源网络；孟明隽用威胁假设重组警戒和勘察力量。',
    decision_scene: {
      title: '温室保种与居民配水',
      setup: '公开水账显示现有余量可满足居民全部用水，或在透明限额下同时保住一批珍稀母株。',
      accept_choice: '暂停温室供水，居民用水不设额外限额。',
      accept_consequence: '生活和公共灶保持稳定，但母株可能死亡，来季失去高价值种源。',
      accept_immediate_cost: '温室团队必须停止当前工作，并处理一批无法成熟的作物。',
      accept_long_term_risk: '母株损失会降低来季交易收入，也减少聚落应对病害的品种选择。',
      decline_choice: '公开实施居民限额，并维持温室最低保种供水。',
      decline_consequence: '母株更可能存活，但居民需要额外运水和排队，干旱负担分摊更复杂。',
      decline_immediate_cost: '所有家庭立即承担用水限额，运输队还要增加一次补水任务。',
      decline_long_term_risk: '若干旱延长，保种决定可能被视为偏袒高价值生产并损害资源信任。',
    },
    review_questions: [
      '玩家是否能复述他为何把配给和路线放在一起考虑？',
      '他的灵活性是否仍有公开账目这一硬边界？',
      '与孟明隽相比，玩家能否指出两人的探索对象不同？',
    ],
  },
] as const satisfies readonly SampleDraft[]

const BASE_KEYS = [
  'schema_version',
  'sample_library_id',
  'status',
  'development_stage',
  'source_library_id',
  'source_library_schema_version',
  'source_library_status',
  'culture_pack_version',
  'purpose',
  'gate_dependency',
  'samples',
] as const

const FINAL_KEYS = [...BASE_KEYS, 'validation'] as const

const SAMPLE_KEYS = [
  'schema_version',
  'sample_id',
  'source_character_id',
  'source_distinction_fingerprint',
  'pair_id',
  'counterpart_source_character_id',
  'formal_name',
  'age',
  'gender',
  'origin',
  'internal_mbti_type',
  'mbti_display_policy',
  'primary_skills',
  'qualifications',
  'address_rules',
  'source_biography_summary',
  'revised_biography',
  'first_impression',
  'ordinary_behavior',
  'stress_behavior',
  'voice_line',
  'core_values',
  'redline_preview',
  'current_motivation',
  'relationship_hook',
  'long_term_goal',
  'visible_request',
  'identity_without_mbti',
  'same_type_contrast',
  'decision_scene',
  'review_questions',
  'manual_review_status',
] as const

const GATE_DEPENDENCY_KEYS = [
  'formal_a1_status',
  'waiting_for',
  'note',
] as const

const DECISION_SCENE_KEYS = [
  'title',
  'setup',
  'accept_choice',
  'accept_consequence',
  'accept_immediate_cost',
  'accept_long_term_risk',
  'decline_choice',
  'decline_consequence',
  'decline_immediate_cost',
  'decline_long_term_risk',
] as const

const SAMPLE_MANUAL_REVIEW_KEYS = [
  'E01_naming',
  'E02_extreme_stats_and_experience',
  'E03_causal_bridge',
  'E04_stereotype_risk',
  'E05_decision_impact',
  'E06_distinction',
  'mbti_player_validation',
] as const

const VALIDATION_KEYS = [
  'scope',
  'machine_structure_passed',
  'findings',
  'manual_reviews',
] as const

const LIBRARY_MANUAL_REVIEW_KEYS = [
  'E01',
  'E02',
  'E03',
  'E04',
  'E05',
  'E06',
  'mbti_player_validation',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index])
  )
}

function containsForbiddenIdentityKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenIdentityKey)
  }
  if (!isRecord(value)) {
    return false
  }
  return Object.entries(value).some(
    ([key, child]) =>
      ['nickname', 'alias', 'callsign', 'old_code'].includes(key) ||
      containsForbiddenIdentityKey(child),
  )
}

function finding(
  validationId: SampleValidationFinding['validation_id'],
  predicate: string,
  passed: boolean,
  evidence: string,
): SampleValidationFinding {
  return {
    validation_id: validationId,
    predicate,
    evidence,
    result: passed ? 'passed' : 'blocked',
  }
}

function warningFinding(
  validationId: SampleValidationFinding['validation_id'],
  predicate: string,
  warned: boolean,
  evidence: string,
): SampleValidationFinding {
  return {
    validation_id: validationId,
    predicate,
    evidence,
    result: warned ? 'warned' : 'passed',
  }
}

function blockedFindings(evidence: string): SampleValidationFinding[] {
  return [
    finding('S01-SCHEMA', '样板库使用闭合 schema 且固定 12 人', false, evidence),
    finding('S02-SOURCE-BINDING', '每个样板绑定唯一候选人物', false, evidence),
    finding('S03-SAME-TYPE-PAIRS', '六个 MBTI 对照组各含两人', false, evidence),
    finding('S04-MBTI-DIMENSION-BALANCE', '四个 MBTI 维度均为 6:6', false, evidence),
    finding('S05-SKILL-COVERAGE', '八项技能均由至少一名样板主要覆盖', false, evidence),
    finding('S06-CONTENT-COMPLETENESS', '每名样板具备完整可测试内容', false, evidence),
    finding('S07-GATE-HONESTY', '人工门禁保持 NOT_RUN 且 A1 未提前通过', false, evidence),
    finding('S08-DISTINCTION', '样板与同类型对照均可区分', false, evidence),
    finding(
      'S09-EI-SKILL-CONTINGENCY',
      '工程、交涉、医疗、研究和防卫均跨 E/I 出现',
      false,
      evidence,
    ),
    finding(
      'S10-CONTENT-REPETITION',
      '价值、红线、请求和聚落称呼重复率不超过 20%',
      false,
      evidence,
    ),
  ]
}

function maximumFrequency(values: readonly string[]): number {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Math.max(0, ...counts.values())
}

function asBase(subject: unknown): CharacterSampleLibraryBase | null {
  if (!isRecord(subject)) {
    return null
  }
  const { validation: _validation, ...base } = subject
  return base as unknown as CharacterSampleLibraryBase
}

function hasRuntimeSampleShape(base: CharacterSampleLibraryBase): boolean {
  if (
    typeof base.schema_version !== 'string' ||
    typeof base.sample_library_id !== 'string' ||
    typeof base.status !== 'string' ||
    typeof base.development_stage !== 'string' ||
    typeof base.source_library_id !== 'string' ||
    typeof base.source_library_schema_version !== 'string' ||
    typeof base.source_library_status !== 'string' ||
    typeof base.culture_pack_version !== 'string' ||
    typeof base.purpose !== 'string' ||
    !isRecord(base.gate_dependency) ||
    !hasExactKeys(base.gate_dependency, GATE_DEPENDENCY_KEYS) ||
    !Object.values(base.gate_dependency).every(
      (value) => typeof value === 'string',
    ) ||
    !Array.isArray(base.samples)
  ) {
    return false
  }

  return base.samples.every((sample) => {
    if (!isRecord(sample) || !hasExactKeys(sample, SAMPLE_KEYS)) {
      return false
    }
    const stringFields = [
      'schema_version',
      'sample_id',
      'source_character_id',
      'source_distinction_fingerprint',
      'pair_id',
      'counterpart_source_character_id',
      'formal_name',
      'gender',
      'origin',
      'internal_mbti_type',
      'mbti_display_policy',
      'source_biography_summary',
      'revised_biography',
      'first_impression',
      'ordinary_behavior',
      'stress_behavior',
      'voice_line',
      'redline_preview',
      'current_motivation',
      'relationship_hook',
      'long_term_goal',
      'visible_request',
      'identity_without_mbti',
      'same_type_contrast',
    ] as const
    if (
      !stringFields.every((field) => typeof sample[field] === 'string') ||
      typeof sample.age !== 'number' ||
      !Number.isInteger(sample.age) ||
      !Array.isArray(sample.primary_skills) ||
      !sample.primary_skills.every((skill) => typeof skill === 'string') ||
      !Array.isArray(sample.qualifications) ||
      !Array.isArray(sample.address_rules) ||
      !Array.isArray(sample.core_values) ||
      !Array.isArray(sample.review_questions) ||
      sample.review_questions.length !== 3 ||
      !sample.review_questions.every(
        (question) => typeof question === 'string',
      ) ||
      !isRecord(sample.decision_scene) ||
      !hasExactKeys(sample.decision_scene, DECISION_SCENE_KEYS) ||
      !Object.values(sample.decision_scene).every(
        (value) => typeof value === 'string',
      ) ||
      !isRecord(sample.manual_review_status) ||
      !hasExactKeys(
        sample.manual_review_status,
        SAMPLE_MANUAL_REVIEW_KEYS,
      ) ||
      !Object.values(sample.manual_review_status).every(
        (value) => typeof value === 'string',
      )
    ) {
      return false
    }
    return true
  })
}

function createCharacterSampleBase(
  sourceLibrary: CharacterLibrary,
): CharacterSampleLibraryBase {
  const sourceById = new Map(
    sourceLibrary.characters.map((character) => [
      character.character_id,
      character,
    ]),
  )
  const samples = SAMPLE_DRAFTS.map((draft, index): CharacterSample => {
    const source = sourceById.get(draft.source_character_id)
    if (source === undefined) {
      throw new Error(`Missing source character ${draft.source_character_id}`)
    }
    return {
      schema_version: CHARACTER_SAMPLE_SCHEMA_VERSION,
      sample_id: `sample_${String(index + 1).padStart(2, '0')}`,
      source_character_id: source.character_id,
      source_distinction_fingerprint: source.distinction_fingerprint,
      pair_id: draft.pair_id,
      counterpart_source_character_id: draft.counterpart_source_character_id,
      formal_name: source.formal_name,
      age: source.age,
      gender: source.gender,
      origin: source.origin,
      internal_mbti_type: source.mbti.type,
      mbti_display_policy: 'HIDDEN_IN_PLAYER_CARD_UNTIL_VALIDATED',
      primary_skills: source.primary_skills,
      qualifications: source.qualifications,
      address_rules: source.address_rules,
      source_biography_summary: source.biography_summary,
      revised_biography: draft.revised_biography,
      first_impression: draft.first_impression,
      ordinary_behavior: draft.ordinary_behavior,
      stress_behavior: draft.stress_behavior,
      voice_line: draft.voice_line,
      core_values: source.core_values,
      redline_preview: source.redlines[0].summary,
      current_motivation: source.current_motivation,
      relationship_hook: source.relationship_hooks[0],
      long_term_goal: source.long_term_goal,
      visible_request: source.request_seed,
      identity_without_mbti: draft.identity_without_mbti,
      same_type_contrast: draft.same_type_contrast,
      decision_scene: draft.decision_scene,
      review_questions: draft.review_questions,
      manual_review_status: {
        E01_naming: 'not_run',
        E02_extreme_stats_and_experience: 'not_run',
        E03_causal_bridge: 'not_run',
        E04_stereotype_risk: 'not_run',
        E05_decision_impact: 'not_run',
        E06_distinction: 'not_run',
        mbti_player_validation: 'not_run',
      },
    }
  })
  const sampleLibraryId = `character-samples-${deriveSeedV1(
    'character-sample-library',
    [
      CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION,
      sourceLibrary.library_id,
      samples.map((sample) => sample.source_character_id),
    ],
  ).slice(0, 16)}`
  return {
    schema_version: CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION,
    sample_library_id: sampleLibraryId,
    status: 'DRAFT_BEFORE_A1',
    development_stage: 'A1_INPUT_PREPARATION_ONLY',
    source_library_id: sourceLibrary.library_id,
    source_library_schema_version: sourceLibrary.schema_version,
    source_library_status: sourceLibrary.status,
    culture_pack_version: sourceLibrary.culture_pack_version,
    purpose: 'SAME_MBTI_DIFFERENT_LIFE_PATH_VALIDATION',
    gate_dependency: {
      formal_a1_status: 'NOT_STARTED',
      waiting_for: 'GATE_1H_CHARACTER_MEMORY_EVIDENCE',
      note: SAMPLE_GATE_NOTE,
    },
    samples,
  }
}

function computeContentFindings(
  base: CharacterSampleLibraryBase | null,
  sourceLibrary: CharacterLibrary,
): SampleValidationFinding[] {
  if (base === null || !Array.isArray(base.samples)) {
    return blockedFindings('根对象或 samples 非法')
  }
  if (!hasRuntimeSampleShape(base)) {
    return blockedFindings('样板字段类型或嵌套结构非法')
  }

  const samples = base.samples
  const sampleRecords = samples.filter(isRecord)
  const canonicalBase = createCharacterSampleBase(sourceLibrary)
  const expectedSampleLibraryId = `character-samples-${deriveSeedV1(
    'character-sample-library',
    [
      CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION,
      sourceLibrary.library_id,
      SAMPLE_DRAFTS.map((draft) => draft.source_character_id),
    ],
  ).slice(0, 16)}`
  const schemaPassed =
    hasExactKeys(base as unknown as Record<string, unknown>, BASE_KEYS) &&
    JSON.stringify(base) === JSON.stringify(canonicalBase) &&
    base.schema_version === CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION &&
    base.sample_library_id === expectedSampleLibraryId &&
    base.status === 'DRAFT_BEFORE_A1' &&
    base.development_stage === 'A1_INPUT_PREPARATION_ONLY' &&
    base.culture_pack_version === sourceLibrary.culture_pack_version &&
    base.purpose === 'SAME_MBTI_DIFFERENT_LIFE_PATH_VALIDATION' &&
    samples.length === 12 &&
    sampleRecords.length === 12 &&
    sampleRecords.every(
      (sample, index) =>
        hasExactKeys(sample, SAMPLE_KEYS) &&
        sample.schema_version === CHARACTER_SAMPLE_SCHEMA_VERSION &&
        sample.sample_id ===
          `sample_${String(index + 1).padStart(2, '0')}` &&
        sample.source_character_id ===
          SAMPLE_DRAFTS[index].source_character_id &&
        sample.pair_id === SAMPLE_DRAFTS[index].pair_id &&
        sample.counterpart_source_character_id ===
          SAMPLE_DRAFTS[index].counterpart_source_character_id &&
        sample.mbti_display_policy ===
          'HIDDEN_IN_PLAYER_CARD_UNTIL_VALIDATED',
    ) &&
    hasExactKeys(
      base.gate_dependency as unknown as Record<string, unknown>,
      GATE_DEPENDENCY_KEYS,
    ) &&
    base.gate_dependency.note === SAMPLE_GATE_NOTE &&
    samples.every(
      (sample) =>
        hasExactKeys(
          sample.decision_scene as unknown as Record<string, unknown>,
          DECISION_SCENE_KEYS,
        ) &&
        hasExactKeys(
          sample.manual_review_status as unknown as Record<string, unknown>,
          SAMPLE_MANUAL_REVIEW_KEYS,
        ) &&
        sample.review_questions.length === 3,
    )

  const sourceById = new Map(
    sourceLibrary.characters.map((character) => [
      character.character_id,
      character,
    ]),
  )
  const sourceLibraryValid = !validateCharacterLibrary(sourceLibrary).some(
    (sourceFinding) => sourceFinding.result === 'blocked',
  )
  const sourceIds = samples.map((sample) => sample.source_character_id)
  const sourceBindingPassed =
    sourceLibraryValid &&
    base.source_library_id === sourceLibrary.library_id &&
    base.source_library_schema_version === sourceLibrary.schema_version &&
    base.source_library_status === sourceLibrary.status &&
    new Set(sourceIds).size === 12 &&
    samples.every((sample) => {
      const source = sourceById.get(sample.source_character_id)
      return (
        source !== undefined &&
        sample.formal_name === source.formal_name &&
        sample.source_distinction_fingerprint ===
          source.distinction_fingerprint &&
        sample.internal_mbti_type === source.mbti.type &&
        sample.age === source.age &&
        sample.gender === source.gender &&
        sample.origin === source.origin &&
        JSON.stringify(sample.primary_skills) ===
          JSON.stringify(source.primary_skills) &&
        JSON.stringify(sample.qualifications) ===
          JSON.stringify(source.qualifications) &&
        JSON.stringify(sample.address_rules) ===
          JSON.stringify(source.address_rules) &&
        sample.source_biography_summary === source.biography_summary &&
        JSON.stringify(sample.core_values) ===
          JSON.stringify(source.core_values) &&
        sample.redline_preview === source.redlines[0].summary &&
        sample.current_motivation === source.current_motivation &&
        sample.relationship_hook === source.relationship_hooks[0] &&
        sample.long_term_goal === source.long_term_goal &&
        sample.visible_request === source.request_seed
      )
    })

  const pairCounts = new Map<string, number>()
  for (const sample of samples) {
    pairCounts.set(sample.pair_id, (pairCounts.get(sample.pair_id) ?? 0) + 1)
  }
  const pairPassed =
    pairCounts.size === 6 &&
    [...pairCounts.values()].every((count) => count === 2) &&
    samples.every((sample) => {
      const counterpart = samples.find(
        (candidate) =>
          candidate.source_character_id ===
          sample.counterpart_source_character_id,
      )
      return (
        counterpart !== undefined &&
        counterpart.source_character_id !== sample.source_character_id &&
        counterpart.counterpart_source_character_id ===
          sample.source_character_id &&
        counterpart.pair_id === sample.pair_id &&
        counterpart.internal_mbti_type === sample.internal_mbti_type
      )
    })

  const dimensionCounts = {
    I: 0,
    E: 0,
    S: 0,
    N: 0,
    T: 0,
    F: 0,
    J: 0,
    P: 0,
  }
  for (const sample of samples) {
    if (!MBTI_TYPES.includes(sample.internal_mbti_type)) {
      continue
    }
    for (const pole of sample.internal_mbti_type) {
      dimensionCounts[pole as keyof typeof dimensionCounts] += 1
    }
  }
  const dimensionBalancePassed = Object.values(dimensionCounts).every(
    (count) => count === 6,
  )

  const coveredSkills = new Set(samples.flatMap((sample) => sample.primary_skills))
  const skillCoveragePassed = SKILL_KEYS.every((skill) => coveredSkills.has(skill))
  const skillContingency = Object.fromEntries(
    SKILL_KEYS.map((skill) => [
      skill,
      {
        E: samples.filter(
          (sample) =>
            sample.internal_mbti_type.startsWith('E') &&
            sample.primary_skills.includes(skill),
        ).length,
        I: samples.filter(
          (sample) =>
            sample.internal_mbti_type.startsWith('I') &&
            sample.primary_skills.includes(skill),
        ).length,
      },
    ]),
  ) as Record<SkillKey, { E: number; I: number }>
  const criticalSkillContingencyPassed = CRITICAL_CROSS_SKILLS.every(
    (skill) =>
      skillContingency[skill].E > 0 && skillContingency[skill].I > 0,
  )

  const incompleteSamples = samples.flatMap((sample) => {
    const narrativeFields = {
      revised_biography: sample.revised_biography,
      first_impression: sample.first_impression,
      ordinary_behavior: sample.ordinary_behavior,
      stress_behavior: sample.stress_behavior,
      voice_line: sample.voice_line,
      redline_preview: sample.redline_preview,
      current_motivation: sample.current_motivation,
      relationship_hook: sample.relationship_hook,
      long_term_goal: sample.long_term_goal,
      visible_request: sample.visible_request,
      identity_without_mbti: sample.identity_without_mbti,
      same_type_contrast: sample.same_type_contrast,
      decision_title: sample.decision_scene.title,
      decision_setup: sample.decision_scene.setup,
      accept_choice: sample.decision_scene.accept_choice,
      accept_consequence: sample.decision_scene.accept_consequence,
      accept_immediate_cost: sample.decision_scene.accept_immediate_cost,
      accept_long_term_risk: sample.decision_scene.accept_long_term_risk,
      decline_choice: sample.decision_scene.decline_choice,
      decline_consequence: sample.decision_scene.decline_consequence,
      decline_immediate_cost: sample.decision_scene.decline_immediate_cost,
      decline_long_term_risk: sample.decision_scene.decline_long_term_risk,
      review_question_1: sample.review_questions[0],
      review_question_2: sample.review_questions[1],
      review_question_3: sample.review_questions[2],
    }
    const shortFields = Object.entries(narrativeFields)
      .filter(
        ([field, value]) =>
          value.trim().length < (field === 'decision_title' ? 4 : 8),
      )
      .map(([field]) => field)
    if (sample.address_rules.length === 0) {
      shortFields.push('address_rules')
    }
    if (sample.core_values.length !== 2) {
      shortFields.push('core_values')
    }
    return shortFields.map((field) => `${sample.sample_id}:${field}`)
  })
  const forbiddenIdentityKey = containsForbiddenIdentityKey(base)
  const contentCompletenessPassed =
    !forbiddenIdentityKey && incompleteSamples.length === 0

  const gateHonestyPassed =
    base.gate_dependency.formal_a1_status === 'NOT_STARTED' &&
    base.gate_dependency.waiting_for ===
      'GATE_1H_CHARACTER_MEMORY_EVIDENCE' &&
    samples.every((sample) =>
      Object.values(sample.manual_review_status).every(
        (status) => status === 'not_run',
      ),
    )

  const distinctionPassed =
    new Set(samples.map((sample) => sample.source_distinction_fingerprint))
      .size === 12 &&
    new Set(samples.map((sample) => sample.revised_biography)).size === 12 &&
    new Set(samples.map((sample) => sample.decision_scene.title)).size === 12 &&
    samples.every(
      (sample) =>
        sample.identity_without_mbti.includes('MBTI') === false &&
        sample.same_type_contrast.includes(sample.internal_mbti_type),
    )
  const valueSignatureMax = maximumFrequency(
    samples.map((sample) =>
      sample.core_values.map((value: CoreValue) => value.summary).join('|'),
    ),
  )
  const redlineMax = maximumFrequency(
    samples.map((sample) => sample.redline_preview),
  )
  const requestMax = maximumFrequency(
    samples.map((sample) => sample.visible_request),
  )
  const addressFormMax = maximumFrequency(
    samples.flatMap((sample) =>
      sample.address_rules.map((rule: AddressRule) => rule.form),
    ),
  )
  const repetitionWarned = [
    valueSignatureMax,
    redlineMax,
    requestMax,
    addressFormMax,
  ].some((count) => count / samples.length > 0.2)

  return [
    finding(
      'S01-SCHEMA',
      '样板库使用闭合 schema 且固定 12 人',
      schemaPassed,
      `samples=${samples.length}`,
    ),
    finding(
      'S02-SOURCE-BINDING',
      '每个样板绑定唯一候选人物',
      sourceBindingPassed,
      `unique_sources=${new Set(sourceIds).size}`,
    ),
    finding(
      'S03-SAME-TYPE-PAIRS',
      '六个 MBTI 对照组各含两人',
      pairPassed,
      [...pairCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([pairId, count]) => `${pairId}=${count}`)
        .join(','),
    ),
    finding(
      'S04-MBTI-DIMENSION-BALANCE',
      '四个 MBTI 维度均为 6:6',
      dimensionBalancePassed,
      Object.entries(dimensionCounts)
        .map(([pole, count]) => `${pole}=${count}`)
        .join(','),
    ),
    finding(
      'S05-SKILL-COVERAGE',
      '八项技能均由至少一名样板主要覆盖',
      skillCoveragePassed,
      SKILL_KEYS.map((skill) => `${skill}=${coveredSkills.has(skill)}`).join(','),
    ),
    finding(
      'S06-CONTENT-COMPLETENESS',
      '每名样板具备完整可测试内容',
      contentCompletenessPassed,
      forbiddenIdentityKey
        ? '包含 nickname/alias/callsign/old_code 字段'
        : incompleteSamples.length > 0
          ? `不完整字段=${incompleteSamples.join(',')}`
          : '履历、第一印象、日常与压力行为、语音、决策场景、去 MBTI 身份均非空',
    ),
    finding(
      'S07-GATE-HONESTY',
      '人工门禁保持 NOT_RUN 且 A1 未提前通过',
      gateHonestyPassed,
      `${base.gate_dependency.formal_a1_status}/${base.gate_dependency.waiting_for}`,
    ),
    finding(
      'S08-DISTINCTION',
      '样板与同类型对照均可区分',
      distinctionPassed,
      `fingerprints=${new Set(samples.map((sample) => sample.source_distinction_fingerprint)).size},scenes=${new Set(samples.map((sample) => sample.decision_scene.title)).size}`,
    ),
    finding(
      'S09-EI-SKILL-CONTINGENCY',
      '工程、交涉、医疗、研究和防卫均跨 E/I 出现',
      criticalSkillContingencyPassed,
      SKILL_KEYS.map(
        (skill) =>
          `${skill}=E${skillContingency[skill].E}/I${skillContingency[skill].I}`,
      ).join(','),
    ),
    warningFinding(
      'S10-CONTENT-REPETITION',
      '价值、红线、请求和聚落称呼重复率不超过 20%',
      repetitionWarned,
      `values_max=${valueSignatureMax}/${samples.length},redline_max=${redlineMax}/${samples.length},request_max=${requestMax}/${samples.length},address_form_max=${addressFormMax}/${samples.length}`,
    ),
  ]
}

export function createCharacterSampleLibrary(
  sourceLibrary: CharacterLibrary,
): CharacterSampleLibrary {
  const base = createCharacterSampleBase(sourceLibrary)
  const findings = computeContentFindings(base, sourceLibrary)
  return {
    ...base,
    validation: {
      scope: 'DRAFT_SAMPLE_STRUCTURE_ONLY',
      machine_structure_passed: !findings.some(
        (item) => item.result === 'blocked',
      ),
      findings,
      manual_reviews: {
        E01: 'not_run',
        E02: 'not_run',
        E03: 'not_run',
        E04: 'not_run',
        E05: 'not_run',
        E06: 'not_run',
        mbti_player_validation: 'not_run',
      },
    },
  }
}

export function validateCharacterSampleLibrary(
  subject: unknown,
  sourceLibrary: unknown,
): SampleValidationFinding[] {
  if (
    validateCharacterLibrary(sourceLibrary).some(
      (sourceFinding) => sourceFinding.result === 'blocked',
    )
  ) {
    return blockedFindings('来源候选库未通过自身机器合同')
  }
  const validSourceLibrary = sourceLibrary as CharacterLibrary
  const availableSourceIds = new Set(
    validSourceLibrary.characters.map((character) => character.character_id),
  )
  if (
    SAMPLE_DRAFTS.some(
      (draft) => !availableSourceIds.has(draft.source_character_id),
    )
  ) {
    return blockedFindings('来源候选库不包含固定样板绑定的 12 名人物')
  }
  const base = asBase(subject)
  const contentFindings = computeContentFindings(base, validSourceLibrary)
  if (!isRecord(subject)) {
    return contentFindings
  }
  const rootClosed = hasExactKeys(subject, FINAL_KEYS)
  const validation = subject.validation
  const envelopePassed =
    rootClosed &&
    isRecord(validation) &&
    hasExactKeys(validation, VALIDATION_KEYS) &&
    validation.scope === 'DRAFT_SAMPLE_STRUCTURE_ONLY' &&
    validation.machine_structure_passed ===
      !contentFindings.some((item) => item.result === 'blocked') &&
    JSON.stringify(validation.findings) === JSON.stringify(contentFindings) &&
    isRecord(validation.manual_reviews) &&
    hasExactKeys(validation.manual_reviews, LIBRARY_MANUAL_REVIEW_KEYS) &&
    Object.values(validation.manual_reviews).every(
      (status) => status === 'not_run',
    )

  if (!envelopePassed) {
    return contentFindings.map((item) =>
      item.validation_id === 'S01-SCHEMA'
        ? {
            ...item,
            result: 'blocked',
            evidence: `${item.evidence}; validation envelope mismatch`,
          }
        : item,
    )
  }
  return contentFindings
}
