import { deriveSeedV1 } from './seed'
import {
  MBTI_TYPES,
  SKILL_KEYS,
  type CharacterLibrary,
  type GeneratedCharacter,
  type MbtiType,
  type SkillKey,
} from './model'

export const CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION =
  'character-sample-library-v0.1-draft' as const
export const CHARACTER_SAMPLE_SCHEMA_VERSION =
  'character-sample-v0.1-draft' as const

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
  decline_choice: string
  decline_consequence: string
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
  predicate: string
  evidence: string
  result: 'passed' | 'blocked'
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
      decline_choice: '维持满负荷运行和原康复排班。',
      decline_consequence: '短期产能不变；若次日故障，陶穗宁会要求追查谁忽略了预警。',
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
      decline_choice: '封闭外出，把人员列为失联。',
      decline_consequence: '保住眼前劳力；杜映秋拒绝下一次单人带教，训练效率长期下降。',
    },
    review_questions: [
      '玩家能否从她的说法理解“低置信度预警”而不是认为她胆小？',
      '玩家是否记得她的学徒责任，而不只记得侦察数值？',
      '与陶穗宁相比，她是否表现出不同的秩序来源？',
    ],
  },
  {
    source_character_id: 'char_f68c794618e1f705',
    pair_id: 'pair-intj',
    counterpart_source_character_id: 'char_08e063fd6a1c1f15',
    revised_biography:
      '白清和在林场边缘学会从火险与失踪记录中看长期模式，后来进入档案区训练来源核验。她做配额审计时追过一条被反复改写的损耗记录，却因替一个无力偿债的家庭承担劳动而失去迁移名额。她来到新聚落不是为了继续做“审计员”，而是想让医疗、隔离和轮值在任何负责人缺席时仍能按证据运行。',
    first_impression: '先问记录来自哪里，再问结论会伤害谁。',
    ordinary_behavior: '为关键账目保留来源、版本和无法解释的差额，不用口头保证覆盖缺口。',
    stress_behavior: '先保护直接受影响的人，再把争议拆成可核验的记录链。',
    voice_line: '我不反对处分，我反对先处分再补证据。',
    identity_without_mbti:
      '她仍是保护证据来源、反对债务无限继承、想建立可替代制度的档案核验者。',
    same_type_contrast:
      '同为 INTJ，白清和把长期模式用于制度和证据链；顾远帆把长期模式用于警戒、撤离与最低伤害。',
    decision_scene: {
      title: '救济仓的重复损耗',
      setup: '账面显示同一批药品连续三次“自然损耗”，匿名记录员指向管理者。',
      accept_choice: '保留药品并启动双人复核，暂缓公开指控。',
      accept_consequence: '短期占用人力且管理者不满，但证据链和匿名来源得到保护。',
      decline_choice: '立即按现有账目核销并关闭调查。',
      decline_consequence: '省下审计时间；白清和将拒绝为后续配额报告背书。',
    },
    review_questions: [
      '玩家是否理解她保护匿名来源的理由？',
      '不展示 MBTI 时，她与普通“研究高”角色是否仍可区分？',
      '与顾远帆相比，玩家能否区分制度风险与现场防卫风险？',
    ],
  },
  {
    source_character_id: 'char_08e063fd6a1c1f15',
    pair_id: 'pair-intj',
    counterpart_source_character_id: 'char_f68c794618e1f705',
    revised_biography:
      '顾远帆在高原观测站长大，长期变化比单次喧闹更能说服他。防卫训练让他负责警戒、纠纷隔离和非战斗人员撤离；拒绝处决投降者后，他失去原岗位，却没有放弃防卫本身。他欠外部帮助者一笔具体物资债，加入聚落后会在安全、供给和承诺之间坚持写出可执行的边界。',
    first_impression: '站位总在出口和人群之间，发言前先确认威胁是否仍然存在。',
    ordinary_behavior: '把警戒触发条件、撤离路线和停止使用武力的条件写在同一张表上。',
    stress_behavior: '减少争辩，用书面命令隔离冲突并保护没有准备的人。',
    voice_line: '投降以后是看管问题，不是泄愤问题。',
    identity_without_mbti:
      '此人仍由非报复性防卫、俘虏红线和有争议的外部债务构成。',
    same_type_contrast:
      '同为 INTJ，顾远帆的核心冲突是武力何时停止；白清和的核心冲突是证据何时足以启动制度处置。',
    decision_scene: {
      title: '粮仓旁的投降者',
      setup: '一次夜袭后，一名袭击者放下武器；聚落食物只够多养一人五天。',
      accept_choice: '按顾远帆方案解除武装、轮班看管并联系交换。',
      accept_consequence: '消耗粮食和警戒工时，但获得口供与谈判筹码。',
      decline_choice: '以节省资源为由处决投降者。',
      decline_consequence: '立即省下资源；顾远帆触发红线并退出当前防卫排班。',
    },
    review_questions: [
      '玩家是否把他的红线理解为防卫规则，而非软弱？',
      '玩家能否记住外部债务对物资决策的影响？',
      '与白清和相比，他是否呈现不同的“先规划再行动”？',
    ],
  },
  {
    source_character_id: 'char_8a45ce039608f518',
    pair_id: 'pair-isfp',
    counterpart_source_character_id: 'char_057bc1474ee05fb4',
    revised_biography:
      '蒋书衡在旧港维修棚与零件市场之间长大，却把长期工作落在种子合作社：育苗、轮作和歉收后的补种。替一户家庭承担债务劳动让他失去迁移名额，也让他拒绝把成年人的欠账自动压到孩子身上。来到新聚落后，他想建立有记录的异议流程，因为对他而言，照料土地和允许反对意见都是给失败保留第二条路。',
    first_impression: '先摸土、看苗，再问这项决定有没有给失败留退路。',
    ordinary_behavior: '为种植计划准备补种方案，也会把反对意见写进资源会议记录。',
    stress_behavior: '先照看受影响的人，随后追查异常究竟从哪一步开始。',
    voice_line: '种子还能再育一批，孩子不该继承一张永远还不完的账。',
    identity_without_mbti:
      '他仍是会准备补种、反对未成年人继承债务、要求异议留痕的种植者。',
    same_type_contrast:
      '同为 ISFP，蒋书衡通过照料作物和议事程序保护弱者；乔书衡通过路线判断和拒绝牺牲平民保护弱者。',
    decision_scene: {
      title: '欠债家庭的种子份额',
      setup: '旧债权人要求扣下一个未成年家庭的春播种子作为利息。',
      accept_choice: '采用社区劳动计划，保留种子并公开记录异议。',
      accept_consequence: '聚落承担短期劳动缺口，但保住来年生产和家庭关系。',
      decline_choice: '按旧债合同扣走种子。',
      decline_consequence: '眼前账目结清；蒋书衡触发红线并停止合作社补种工作。',
    },
    review_questions: [
      '玩家是否能同时记住他的生产能力和议事诉求？',
      '他的关怀是否被误读为没有成本的善良？',
      '与乔书衡相比，同类型的价值表达是否足够不同？',
    ],
  },
  {
    source_character_id: 'char_057bc1474ee05fb4',
    pair_id: 'pair-isfp',
    counterpart_source_character_id: 'char_8a45ce039608f518',
    revised_biography:
      '乔书衡在车队中转站学会从货单、天气和人情判断一条路是否真的可走，后来多年勘察山地水源、火险和冬季通路。护送任务中有人把未同意的居民当作诱饵，他因此离队。现在他需要可靠据点偿还外部帮助者，却不会用聚落的基本供给或无关者的安全换取“最快路线”。',
    first_impression: '不抢着下判断，会先独自走到地图空白处确认一次。',
    ordinary_behavior: '给路线承诺留余量，对未知地段亲自复核，不把侥幸写成通行条件。',
    stress_behavior: '暂时少说话，把分歧、天气和撤退点写到同一张路线纸上。',
    voice_line: '近路不是问题，把不知道风险的人推到前面才是问题。',
    identity_without_mbti:
      '此人仍由路线勘察、平民安全红线和有条件的外部偿债构成。',
    same_type_contrast:
      '同为 ISFP，乔书衡的选择围绕路线与现场同意；蒋书衡的选择围绕生产恢复与制度性债务。',
    decision_scene: {
      title: '峡谷近路',
      setup: '外部交付即将逾期，近路经过不稳定峡谷，有居民车队愿意先行探路但不了解风险。',
      accept_choice: '绕行并提前通知延期，保留基本供给。',
      accept_consequence: '声誉短期下降，外部债务延后，但无人被当作诱饵。',
      decline_choice: '让居民车队先走近路确认安全。',
      decline_consequence: '可能按期交付；乔书衡触发红线并拒绝担任路线负责人。',
    },
    review_questions: [
      '玩家能否理解他拒绝近路的具体条件，而非认为他厌恶风险？',
      '外部债务是否形成真实诱惑而不是背景装饰？',
      '与蒋书衡相比，他的现场型判断是否清晰？',
    ],
  },
  {
    source_character_id: 'char_5479143a1a164b19',
    pair_id: 'pair-enfp',
    counterpart_source_character_id: 'char_90deb66520a08696',
    revised_biography:
      '秦远帆在林场边缘参与巡看和失火预警，进入联合仓房后把直觉变成货位、损耗与交接账。一次隐瞒延期让友好聚落在寒潮中断粮，她从此坚持承诺必须写明余量和失败通知。她希望补足非主要技能，但学习时间不是免费成长：每两个星期占用的训练块都必须让玩家看到产出代价。',
    first_impression: '会主动交谈，但答应交付前先问备用路线和最晚通知时间。',
    ordinary_behavior: '把口头征用转成交接人、截止时间和可撤销条件。',
    stress_behavior: '减少即兴承诺，改用书面清单说明哪些交付正在失去余量。',
    voice_line: '做不到不是最坏的，明知道做不到还让对方等才是。',
    identity_without_mbti:
      '她仍是会提前暴露交付风险、拒绝无交接征用、愿意承担学习代价的仓储负责人。',
    same_type_contrast:
      '同为 ENFP，秦远帆把可能性用于重排承诺和学习路径；沈知遥把可能性用于提出工程替代方案。',
    decision_scene: {
      title: '寒潮前的短缺通知',
      setup: '聚落发现无法按时交付燃料，立即通知会失去一项交换优惠。',
      accept_choice: '提前说明缺口并提出分批交付。',
      accept_consequence: '交换条件变差，但对方有时间寻找替代燃料，长期信任保留。',
      decline_choice: '等最后两天再决定是否能赶上。',
      decline_consequence: '保留短期议价空间；失败后秦远帆触发红线并公开交接记录。',
    },
    review_questions: [
      '玩家是否能看到她的开放表达与谨慎承诺同时成立？',
      '学习请求是否被理解为有产能成本的选择？',
      '与沈知遥相比，她是否不像“同一种外向理想主义者”？',
    ],
  },
  {
    source_character_id: 'char_90deb66520a08696',
    pair_id: 'pair-enfp',
    counterpart_source_character_id: 'char_5479143a1a164b19',
    revised_biography:
      '沈知遥在高原观测站学会复核读数，后来负责盐泽风机巡检和恶劣天气后的快速复位。他愿意谈很多备选方案，却不会为了“大胆”牺牲可靠性；一次护送中看见居民被当作火力诱饵后，他离开原队伍。废弃供水设施对他既是工程机会，也是一次证明修复可以不靠冒险牺牲他人的试验。',
    first_impression: '一边说出三种修法，一边把最危险的那一种先划掉。',
    ordinary_behavior: '喜欢把工程问题拆成可逆试验，先勘察再争取完整资源。',
    stress_behavior: '把大故障拆成短时任务，并约定下一次停机复盘点。',
    voice_line: '先花一天确认水渠，不等于放弃修复，是避免拿人去赌。',
    identity_without_mbti:
      '此人仍由风机检修、平民安全红线和废弃供水修复目标构成。',
    same_type_contrast:
      '同为 ENFP，沈知遥用想象力探索工程路径；秦远帆用想象力调整承诺、交接和学习安排。',
    decision_scene: {
      title: '废水渠的第一天',
      setup: '聚落只能选择立即派满员维修，或先用一日勘察不稳定渠段。',
      accept_choice: '先勘察并做小范围压力测试。',
      accept_consequence: '供水恢复推迟一天，但发现一处会危及维修队的塌方。',
      decline_choice: '按旧图纸直接开始全线维修。',
      decline_consequence: '可能提前恢复供水；沈知遥会拒绝让未知情居民承担探路风险。',
    },
    review_questions: [
      '玩家会把他记成提出可逆试验的人，还是只记成工程最高？',
      '他的乐观是否仍有可靠性边界？',
      '与秦远帆相比，玩家能否指出两人的行动对象不同？',
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
      title: '冬路与空仓',
      setup: '储粮不足，最近的非敌对村落拒绝低价交易，另一条山路尚未勘察。',
      accept_choice: '安排教学组勘察新路并重新谈判。',
      accept_consequence: '短期减少采集人手，但获得新路线和第二名可用向导。',
      decline_choice: '趁对方防卫薄弱夺取粮食。',
      decline_consequence: '可能立刻补粮；方怀瑾触发红线并退出勘察与教学。',
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
      decline_choice: '把异常直接宣布为确定污染并全面停水。',
      decline_consequence: '最大化短期安全；高柏舟拒绝为未复核措辞背书，居民信任可能下降。',
    },
    review_questions: [
      '玩家能否区分“快速预警”和“夸大置信度”？',
      '他是否不只是一个高交涉角色？',
      '与方怀瑾相比，同类型的人际关注是否落在不同机制上？',
    ],
  },
  {
    source_character_id: 'char_0aa950ae5d079b4d',
    pair_id: 'pair-entp',
    counterpart_source_character_id: 'char_69d38c37b2e8915c',
    revised_biography:
      '乔澄意从观测站的长期读数走进水泵检修组，擅长在停机前找出几种解释，也容易对带病设备投入过度。亲人因管理者隐瞒感染去世后，他坚持确诊风险必须公开，同时隔离者也应得到基本照护。旧关系来访时，这条原则会直接考验他：连接外部网络不能建立在隐瞒聚落风险之上。',
    first_impression: '边讨论边拆解故障假设，但一旦证实风险就要求公开。',
    ordinary_behavior: '先列多个故障原因，用最小停机试验排除，不把私人关系写进技术结论。',
    stress_behavior: '把争议公开摊开；若设备仍运行，会忘记自己已经超时工作。',
    voice_line: '访客是我请来的，风险也该由我先说清，不该让别人替我猜。',
    identity_without_mbti:
      '此人仍由水泵故障排查、感染公开红线和旧关系正式化的目标构成。',
    same_type_contrast:
      '同为 ENTP，乔澄意围绕技术假设和外部关系尝试方案；周照临围绕路线、配给和运输余量调整方案。',
    decision_scene: {
      title: '旧访客的确诊结果',
      setup: '乔澄意邀请的旧同伴抵达，同日筛查确认其携带传染风险。',
      accept_choice: '立即公开并提供有基本照护的隔离。',
      accept_consequence: '外部关系短期受损，占用医疗物资，但聚落获得清晰防护。',
      decline_choice: '以复检为由暂缓公开，让访客先进入维修区。',
      decline_consequence: '保住会面机会；乔澄意触发自身红线并要求封闭维修区追责。',
    },
    review_questions: [
      '玩家是否看到他的好奇心受到确诊边界约束？',
      '旧关系是否让公开风险成为有代价的选择？',
      '与周照临相比，他的方案探索是否更偏技术与关系？',
    ],
  },
  {
    source_character_id: 'char_69d38c37b2e8915c',
    pair_id: 'pair-entp',
    counterpart_source_character_id: 'char_0aa950ae5d079b4d',
    revised_biography:
      '周照临在林场边缘参加巡看与失火预警，后来随长途车队核算货载、燃料、路线接力和损耗。干旱时管理者把公共水转给私人温室，他公开真实账目后离开。现在他想用公开配给和共同烹饪减少猜疑；他乐于重排路线和装载，却不会接受把基本饮水藏在“灵活调度”里。',
    first_impression: '会迅速提出替代路线，但每条路线都附带燃料和损耗余量。',
    ordinary_behavior: '把运输、冬储和公共灶看成一张可重排的网络，主动解释谁承担代价。',
    stress_behavior: '先找退路和备用交接点，再把被隐藏的资源流向摊开。',
    voice_line: '可以改路线，不能改账；水去了哪里，所有人都该看得见。',
    identity_without_mbti:
      '此人仍由长途后勤、公开用水账和可预测公共灶轮值构成。',
    same_type_contrast:
      '同为 ENTP，周照临用备选路线重组资源网络；乔澄意用故障假设重组技术判断与外部关系。',
    decision_scene: {
      title: '私人温室的暗管',
      setup: '干旱周发现一条未登记支管向高收益温室供水，停掉会损失珍稀作物。',
      accept_choice: '公开支管并优先保障居民饮水，再重排运输补水。',
      accept_consequence: '珍稀作物减产，但公共灶和饮水稳定，资源信任上升。',
      decline_choice: '暂时隐瞒支管，等待下一批水车。',
      decline_consequence: '保住高价值作物；周照临触发红线并公开真实水账。',
    },
    review_questions: [
      '玩家是否能复述他为何把配给和路线放在一起考虑？',
      '他的灵活性是否仍有公开账目这一硬边界？',
      '与乔澄意相比，玩家能否指出两人的探索对象不同？',
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
  'decline_choice',
  'decline_consequence',
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

function asBase(subject: unknown): CharacterSampleLibraryBase | null {
  if (!isRecord(subject)) {
    return null
  }
  const { validation: _validation, ...base } = subject
  return base as unknown as CharacterSampleLibraryBase
}

function computeContentFindings(
  base: CharacterSampleLibraryBase | null,
  sourceLibrary: CharacterLibrary,
): SampleValidationFinding[] {
  if (base === null || !Array.isArray(base.samples)) {
    return [
      finding('S01-SCHEMA', '样板库使用闭合 schema 且固定 12 人', false, '根对象或 samples 非法'),
      finding('S02-SOURCE-BINDING', '每个样板绑定唯一候选人物', false, '无法读取样板'),
      finding('S03-SAME-TYPE-PAIRS', '六个 MBTI 对照组各含两人', false, '无法读取样板'),
      finding('S04-MBTI-DIMENSION-BALANCE', '四个 MBTI 维度均为 6:6', false, '无法读取样板'),
      finding('S05-SKILL-COVERAGE', '八项技能均由至少一名样板主要覆盖', false, '无法读取样板'),
      finding('S06-CONTENT-COMPLETENESS', '每名样板具备完整可测试内容', false, '无法读取样板'),
      finding('S07-GATE-HONESTY', '人工门禁保持 NOT_RUN 且 A1 未提前通过', false, '无法读取样板'),
      finding('S08-DISTINCTION', '样板与同类型对照均可区分', false, '无法读取样板'),
    ]
  }

  const samples = base.samples
  const sampleRecords = samples.filter(isRecord)
  const schemaPassed =
    hasExactKeys(base as unknown as Record<string, unknown>, BASE_KEYS) &&
    base.schema_version === CHARACTER_SAMPLE_LIBRARY_SCHEMA_VERSION &&
    base.status === 'DRAFT_BEFORE_A1' &&
    base.development_stage === 'A1_INPUT_PREPARATION_ONLY' &&
    samples.length === 12 &&
    sampleRecords.length === 12 &&
    sampleRecords.every((sample) => hasExactKeys(sample, SAMPLE_KEYS)) &&
    hasExactKeys(
      base.gate_dependency as unknown as Record<string, unknown>,
      GATE_DEPENDENCY_KEYS,
    ) &&
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
  const sourceIds = samples.map((sample) => sample.source_character_id)
  const sourceBindingPassed =
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
      decline_choice: sample.decision_scene.decline_choice,
      decline_consequence: sample.decision_scene.decline_consequence,
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
  ]
}

export function createCharacterSampleLibrary(
  sourceLibrary: CharacterLibrary,
): CharacterSampleLibrary {
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
  const base: CharacterSampleLibraryBase = {
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
      note: '本包只准备 A1 输入；Gate 1H 人物记忆度证据、E01–E06 与 MBTI 玩家验证均未执行。',
    },
    samples,
  }
  const findings = computeContentFindings(base, sourceLibrary)
  return {
    ...base,
    validation: {
      scope: 'DRAFT_SAMPLE_STRUCTURE_ONLY',
      machine_structure_passed: findings.every(
        (item) => item.result === 'passed',
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
  sourceLibrary: CharacterLibrary,
): SampleValidationFinding[] {
  const base = asBase(subject)
  const contentFindings = computeContentFindings(base, sourceLibrary)
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
      contentFindings.every((item) => item.result === 'passed') &&
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
