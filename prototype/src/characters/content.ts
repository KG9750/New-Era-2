import type { AttributeKey, SkillKey } from './model'

export const FAMILY_NAMES = [
  '陈', '林', '周', '苏', '乔', '沈', '陆', '叶', '顾', '许',
  '唐', '韩', '魏', '杜', '罗', '程', '宋', '梁', '高', '夏',
  '方', '邵', '孟', '陶', '蒋', '秦', '余', '钟', '白', '温',
] as const

export const GIVEN_NAMES = [
  '砚宁', '照野', '清和', '望舒', '知遥', '维舟', '景行', '怀谷', '雨衡', '南星',
  '闻溪', '屿川', '予安', '承澜', '若岑', '云策', '星禾', '明隽', '青岚', '叙白',
  '谨言', '映秋', '思齐', '启川', '知微', '书衡', '庭望', '令仪', '远帆', '向榆',
  '子衿', '临溪', '今越', '昭宁', '行简', '怀瑾', '静川', '亦航', '澄意', '念初',
  '柏舟', '时雨', '言蹊', '照临', '清晏', '安澜', '穗宁', '予川', '简兮', '和光',
] as const

export const ORIGINS = [
  '北岭梯田聚居带',
  '东岬旧港维修区',
  '河湾联合农场',
  '区域医院附属居住区',
  '三号水坝工人镇',
  '旧大学档案区',
  '西线车队中转站',
  '盐泽风机聚落',
  '南部丘陵林场',
  '环城配额居住区',
  '高原气象观测站',
  '沿河市场自治街区',
] as const

interface GrowthTemplate {
  id: string
  context: string
  evidence: string
  positive: AttributeKey
  negative: AttributeKey
  skill: SkillKey
  trait: string
}

export const GROWTH_TEMPLATES: readonly GrowthTemplate[] = [
  {
    id: 'growth-terrace-farm',
    context: '北岭梯田聚居带',
    evidence: '在季节短促的梯田聚居带长大，常随家人轮换灌溉、搬运和守夜。',
    positive: '体能',
    negative: '沟通',
    skill: '生产',
    trait: '习惯先把能落地的活做完',
  },
  {
    id: 'growth-port-workshop',
    context: '东岬旧港维修区',
    evidence: '童年在旧港维修棚与零件市场之间度过，学会从声音和震动判断设备状态。',
    positive: '感知',
    negative: '健康',
    skill: '工程',
    trait: '遇到异常会追查到底',
  },
  {
    id: 'growth-clinic-block',
    context: '区域医院附属居住区',
    evidence: '在诊疗站家属区长大，早早习惯照顾病人并遵守隔离和清洁流程。',
    positive: '意志',
    negative: '体能',
    skill: '医疗',
    trait: '面对伤病时不轻易慌乱',
  },
  {
    id: 'growth-caravan-stop',
    context: '西线车队中转站',
    evidence: '成长于车队中转站，能从货单、天气和人情往来中判断一趟路是否可靠。',
    positive: '沟通',
    negative: '协调',
    skill: '后勤',
    trait: '习惯给承诺留出兑现余量',
  },
  {
    id: 'growth-forest-edge',
    context: '南部丘陵林场',
    evidence: '在林场边缘长大，长期参与边界巡看、失火预警和迷路者搜寻。',
    positive: '感知',
    negative: '思维',
    skill: '侦察',
    trait: '进入陌生地方会先找退路',
  },
  {
    id: 'growth-watch-quarter',
    context: '环城配额居住区',
    evidence: '居住区常有物资争执和夜间警戒，少年时期便参加轮值和人群疏散。',
    positive: '体能',
    negative: '感知',
    skill: '防卫',
    trait: '冲突升级前会先清出无关人员',
  },
  {
    id: 'growth-market-street',
    context: '沿河市场自治街区',
    evidence: '在多家共用摊位与仓房的街区长大，经常替长辈传话、记账和调停小纠纷。',
    positive: '沟通',
    negative: '意志',
    skill: '交涉',
    trait: '会先确认每个人究竟在争什么',
  },
  {
    id: 'growth-observation-station',
    context: '高原气象观测站',
    evidence: '在偏远观测站长大，习惯独自记录、复核读数并从长期变化中寻找模式。',
    positive: '思维',
    negative: '沟通',
    skill: '研究',
    trait: '不愿在证据不足时下结论',
  },
] as const

interface EducationTemplate {
  id: string
  evidence: string
  attribute: AttributeKey
  primary: SkillKey
  secondary: SkillKey
  qualificationId: string
  qualificationEvidence: string
}

export const EDUCATION_TEMPLATES: readonly EducationTemplate[] = [
  {
    id: 'education-soil-apprentice',
    evidence: '完成土壤、种植轮作和基础加工学徒训练，并在监督下独立照看过一季作物。',
    attribute: '感知',
    primary: '生产',
    secondary: '研究',
    qualificationId: 'qual_crop_rotation_basic',
    qualificationEvidence: '具备轮作记录与基础土壤判断训练',
  },
  {
    id: 'education-mechanical-apprentice',
    evidence: '接受通用机械学徒训练，能够按检修表拆装泵组、传动件和简易工装。',
    attribute: '协调',
    primary: '工程',
    secondary: '后勤',
    qualificationId: 'qual_mechanical_service_basic',
    qualificationEvidence: '完成基础机械拆装与安全检修训练',
  },
  {
    id: 'education-community-nursing',
    evidence: '完成社区护理训练，学习伤口处理、感染观察和病人转运。',
    attribute: '意志',
    primary: '医疗',
    secondary: '研究',
    qualificationId: 'qual_community_nursing',
    qualificationEvidence: '完成基础护理及感染控制训练',
  },
  {
    id: 'education-warehouse-ledger',
    evidence: '在联合仓房学习货位、损耗、路线和交接账，能独立完成常规盘点。',
    attribute: '思维',
    primary: '后勤',
    secondary: '生产',
    qualificationId: 'qual_inventory_ledger',
    qualificationEvidence: '完成仓储盘点和交接账训练',
  },
  {
    id: 'education-field-survey',
    evidence: '接受野外测绘、天气识别和低风险路线勘察训练。',
    attribute: '感知',
    primary: '侦察',
    secondary: '研究',
    qualificationId: 'qual_field_survey',
    qualificationEvidence: '完成基础路线测绘和风险标注训练',
  },
  {
    id: 'education-civil-defense',
    evidence: '参加聚落防卫与撤离训练，重点学习警戒、掩护和非战斗人员转移。',
    attribute: '体能',
    primary: '防卫',
    secondary: '侦察',
    qualificationId: 'qual_settlement_watch',
    qualificationEvidence: '完成聚落警戒与掩护撤离训练',
  },
  {
    id: 'education-mediation',
    evidence: '随街区议事员学习会议主持、争议记录和分歧调解。',
    attribute: '沟通',
    primary: '交涉',
    secondary: '研究',
    qualificationId: 'qual_mediation_basic',
    qualificationEvidence: '完成议事主持和基础调解训练',
  },
  {
    id: 'education-archive',
    evidence: '在旧大学档案区接受分类、版本追踪和证据核验训练。',
    attribute: '思维',
    primary: '研究',
    secondary: '后勤',
    qualificationId: 'qual_archive_records',
    qualificationEvidence: '掌握档案分类、版本和来源核验流程',
  },
  {
    id: 'education-food-processing',
    evidence: '学习食材保存、配给加工和公共灶卫生，并完成一次冬储轮值。',
    attribute: '健康',
    primary: '生产',
    secondary: '医疗',
    qualificationId: 'qual_food_sanitation',
    qualificationEvidence: '完成公共灶卫生和食物保存训练',
  },
  {
    id: 'education-electrical-maintenance',
    evidence: '学习低压电路、风机控制和断电检修，能在监督下排查常见故障。',
    attribute: '思维',
    primary: '工程',
    secondary: '研究',
    qualificationId: 'qual_low_voltage_service',
    qualificationEvidence: '完成低压设备断电检修训练',
  },
  {
    id: 'education-long-haul-driving',
    evidence: '接受长途车辆、货物固定和恶劣天气行驶训练。',
    attribute: '协调',
    primary: '后勤',
    secondary: '侦察',
    qualificationId: 'qual_long_haul_vehicle',
    qualificationEvidence: '完成长途车辆和货物固定训练',
  },
  {
    id: 'education-community-teaching',
    evidence: '在社区学习站接受教学组织训练，长期协助成人识字和基础技能课。',
    attribute: '沟通',
    primary: '交涉',
    secondary: '生产',
    qualificationId: 'qual_basic_instruction',
    qualificationEvidence: '完成小组教学和学习反馈训练',
  },
] as const

interface WorkTemplate {
  id: string
  evidence: string
  positive: AttributeKey
  negative: AttributeKey
  primary: SkillKey
  secondary: SkillKey
  trait: string
  relationship: string
  experienceTitle: string
}

export const WORK_TEMPLATES: readonly WorkTemplate[] = [
  {
    id: 'work-seed-cooperative',
    evidence: '在种子合作社连续负责育苗、轮作记录和歉收后的补种安排。',
    positive: '意志', negative: '协调', primary: '生产', secondary: '研究',
    trait: '习惯给计划准备第二套种植方案',
    relationship: '仍欠一位合作社育种员一次种源交换',
    experienceTitle: '育苗负责人',
  },
  {
    id: 'work-public-kitchen',
    evidence: '多年负责公共灶配给、保存和轮班，在物资紧张时也坚持公开份额。',
    positive: '健康', negative: '感知', primary: '生产', secondary: '后勤',
    trait: '分配资源时会把账目说清楚',
    relationship: '与一名曾共同守住冬储的炊事搭档保持联系',
    experienceTitle: '公共灶管理员',
  },
  {
    id: 'work-pump-crew',
    evidence: '在水泵检修组承担主要故障排查，带过新人完成多次停机维护。',
    positive: '协调', negative: '健康', primary: '工程', secondary: '生产',
    trait: '设备带病运行时会过度投入',
    relationship: '与旧检修组长对一次延迟停机仍有分歧',
    experienceTitle: '水泵检修员',
  },
  {
    id: 'work-wind-service',
    evidence: '负责盐泽风机巡检、备件改制和恶劣天气后的快速复位。',
    positive: '感知', negative: '沟通', primary: '工程', secondary: '侦察',
    trait: '愿意为可靠性牺牲短期速度',
    relationship: '曾救下的一名高空检修搭档仍把安全绳托付给此人保管',
    experienceTitle: '风机维护员',
  },
  {
    id: 'work-mobile-clinic',
    evidence: '随流动诊疗队多年处理外伤、慢性病和跨聚落转诊。',
    positive: '意志', negative: '体能', primary: '医疗', secondary: '后勤',
    trait: '临危时会先建立处置顺序',
    relationship: '一位留在外部诊疗队的旧同事仍定期交换病例记录',
    experienceTitle: '流动诊疗队员',
  },
  {
    id: 'work-rehab-ward',
    evidence: '长期参与伤后康复、照护排班和家属沟通，能指导基础护理。',
    positive: '沟通', negative: '协调', primary: '医疗', secondary: '交涉',
    trait: '对缓慢恢复比对戏剧性抢救更有耐心',
    relationship: '一名康复者把重新学会行走视为欠下的人情',
    experienceTitle: '康复照护员',
  },
  {
    id: 'work-convoy-quartermaster',
    evidence: '在长途车队负责货载、燃料、路线接力和损耗核算。',
    positive: '思维', negative: '健康', primary: '后勤', secondary: '侦察',
    trait: '答应事情前会先核算余量',
    relationship: '与一名车队领航员共同掌握一条尚未公开的安全路线',
    experienceTitle: '车队物资员',
  },
  {
    id: 'work-relief-depot',
    evidence: '在救济仓站负责入库、紧急配给和争议物资的证据留存。',
    positive: '沟通', negative: '体能', primary: '后勤', secondary: '交涉',
    trait: '不接受没有交接人的口头征用',
    relationship: '一户被误扣配给的家庭仍等待此人完成申诉',
    experienceTitle: '救济仓站记录员',
  },
  {
    id: 'work-ridge-scout',
    evidence: '多年为山地聚落勘察水源、火险和冬季通路。',
    positive: '感知', negative: '沟通', primary: '侦察', secondary: '生产',
    trait: '习惯亲自确认地图上的空白',
    relationship: '曾与一位向导因是否冒险穿越雪线分道扬镳',
    experienceTitle: '山地勘察员',
  },
  {
    id: 'work-weather-observer',
    evidence: '在气象站负责观测、外场维护和灾害预警记录。',
    positive: '思维', negative: '体能', primary: '侦察', secondary: '研究',
    trait: '会把不确定性和结论分开表达',
    relationship: '一名下游农场主始终记得其提前发出的洪水预警',
    experienceTitle: '气象观察员',
  },
  {
    id: 'work-settlement-watch',
    evidence: '长期承担夜间警戒、纠纷隔离和非战斗人员撤离。',
    positive: '意志', negative: '思维', primary: '防卫', secondary: '交涉',
    trait: '冲突中优先保护没有准备的人',
    relationship: '曾与一位强硬队长因俘虏待遇公开争执',
    experienceTitle: '聚落警戒员',
  },
  {
    id: 'work-convoy-escort',
    evidence: '为车队提供警戒、掩护撤离和路线风险判断，从未独自决定交火。',
    positive: '体能', negative: '沟通', primary: '防卫', secondary: '侦察',
    trait: '危险出现时会主动站到队伍外侧',
    relationship: '与一名曾被其掩护撤出的司机形成牢固互惠',
    experienceTitle: '车队护卫',
  },
  {
    id: 'work-council-facilitator',
    evidence: '主持过配给、用水和公共劳动议事，负责让反对意见进入记录。',
    positive: '沟通', negative: '协调', primary: '交涉', secondary: '研究',
    trait: '会给沉默者留下发言位置',
    relationship: '一位旧议事员认为此人过分重视程序',
    experienceTitle: '议事主持人',
  },
  {
    id: 'work-trade-negotiator',
    evidence: '代表小型聚落参与跨区交换，熟悉价格、声誉和延期履约的代价。',
    positive: '感知', negative: '健康', primary: '交涉', secondary: '后勤',
    trait: '不把一次让步误当成长久友谊',
    relationship: '与一个经常迟交货物的商队仍保持谨慎合作',
    experienceTitle: '交换代表',
  },
  {
    id: 'work-quota-auditor',
    evidence: '长期核对配额记录、设备产出和异常损耗，曾追查一条被反复改写的账目。',
    positive: '思维', negative: '沟通', primary: '研究', secondary: '后勤',
    trait: '重要结论一定保留来源',
    relationship: '一名被其报告保护的基层记录员至今不愿公开身份',
    experienceTitle: '配额审计员',
  },
  {
    id: 'work-community-lab',
    evidence: '在社区实验室整理土壤、水质和药材记录，并把结果转成可执行建议。',
    positive: '协调', negative: '体能', primary: '研究', secondary: '医疗',
    trait: '喜欢把方法教给会继续使用的人',
    relationship: '与一名坚持经验判断的老农保持长期争论和合作',
    experienceTitle: '社区实验员',
  },
] as const

interface TurningTemplate {
  id: string
  evidence: string
  positive: AttributeKey
  negative: AttributeKey
  values: readonly [string, string]
  redline: {
    summary: string
    trigger: readonly string[]
    forbidden: readonly string[]
    alternatives: readonly string[]
    threshold: string
    scope: 'daily' | 'medical' | 'defense' | 'diplomacy' | 'logistics'
  }
  hook: string
}

export const TURNING_TEMPLATES: readonly TurningTemplate[] = [
  {
    id: 'turn-refused-unsafe-start',
    evidence: '一次被要求让带病设备继续运行时选择停机，随后失去原岗位。',
    positive: '意志', negative: '沟通',
    values: ['可以承受停机，但不能隐瞒已知风险', '技术判断必须留下责任人'],
    redline: {
      summary: '拒绝操作已确认存在致命故障且没有隔离措施的设备',
      trigger: ['operate_unsafe_equipment'], forbidden: ['continue_critical_fault'],
      alternatives: ['shutdown_and_repair', 'isolate_equipment'],
      threshold: 'critical_fault_confirmed=true and isolation=false', scope: 'daily',
    },
    hook: '想查清当年被替换的故障零件最终流向',
  },
  {
    id: 'turn-triage-dispute',
    evidence: '在配额诊疗中拒绝按身份放弃一名仍可救治的伤员，离开合规岗位。',
    positive: '意志', negative: '健康',
    values: ['医疗按紧迫程度排序', '人的身份不决定是否值得救治'],
    redline: {
      summary: '拒绝仅因身份或配额等级放弃仍可救治者',
      trigger: ['medical_triage'], forbidden: ['deny_treatment_by_status'],
      alternatives: ['triage_by_urgency', 'stabilize_then_transfer'],
      threshold: 'patient_treatable=true and denial_reason=status', scope: 'medical',
    },
    hook: '仍保存一份能证明旧诊所违规分诊的记录',
  },
  {
    id: 'turn-civilian-crossfire',
    evidence: '一次护送中亲眼看见无关居民被当作火力诱饵，从此离开原护卫队。',
    positive: '感知', negative: '意志',
    values: ['防卫的目的首先是让共同体活下来', '非战斗人员不能被当作消耗品'],
    redline: {
      summary: '拒绝以未同意的平民作为诱饵或掩体',
      trigger: ['defense_plan'], forbidden: ['use_civilians_as_bait'],
      alternatives: ['cover_retreat', 'evacuate_civilians'],
      threshold: 'civilian_consent=false', scope: 'defense',
    },
    hook: '希望找到那次护送中失散的一户人家',
  },
  {
    id: 'turn-ledger-falsification',
    evidence: '拒绝改写一次公共物资短缺记录，导致与上级彻底决裂。',
    positive: '思维', negative: '沟通',
    values: ['公共账目必须可核验', '短缺不能通过删除记录消失'],
    redline: {
      summary: '拒绝删除或伪造公共资源的权威记录',
      trigger: ['record_change'], forbidden: ['falsify_public_ledger'],
      alternatives: ['append_correction', 'record_dispute'],
      threshold: 'record_scope=public and provenance_missing=true', scope: 'logistics',
    },
    hook: '有一名旧同事可能持有相同账目的另一份副本',
  },
  {
    id: 'turn-forced-raid',
    evidence: '所在队伍决定劫掠一个没有防卫能力的村落，此人拒绝参与并独自离队。',
    positive: '意志', negative: '体能',
    values: ['生存压力不能自动正当化掠夺弱者', '交易失败也不等于可以动武'],
    redline: {
      summary: '拒绝主动劫掠未构成威胁的聚落',
      trigger: ['diplomatic_action'], forbidden: ['raid_non_hostile_settlement'],
      alternatives: ['renegotiate_trade', 'withdraw'],
      threshold: 'target_hostile=false and immediate_survival_threat=false', scope: 'diplomacy',
    },
    hook: '担心旧队伍会把离队解释成背叛并追来',
  },
  {
    id: 'turn-abandoned-apprentice',
    evidence: '一次撤离中导师优先带走设备而留下学徒，此人回去把人救了出来。',
    positive: '体能', negative: '健康',
    values: ['教学包含对学徒安全的责任', '设备可以重造，人不能被排在清单之外'],
    redline: {
      summary: '拒绝在可撤离条件下抛下受自己指导的人',
      trigger: ['evacuation_order'], forbidden: ['abandon_assigned_apprentice'],
      alternatives: ['paired_evacuation', 'return_with_escort'],
      threshold: 'apprentice_assigned=true and rescue_feasible=true', scope: 'daily',
    },
    hook: '获救的旧学徒如今在另一个聚落独立工作',
  },
  {
    id: 'turn-quarantine-breach',
    evidence: '亲人因管理者隐瞒感染而病逝，此人随后推动公开隔离记录。',
    positive: '感知', negative: '沟通',
    values: ['感染信息必须及时公开', '隔离措施也要保障基本照护'],
    redline: {
      summary: '拒绝隐瞒已确认的传染风险',
      trigger: ['medical_reporting'], forbidden: ['hide_confirmed_contagion'],
      alternatives: ['disclose_and_isolate', 'protected_care'],
      threshold: 'contagion_confirmed=true', scope: 'medical',
    },
    hook: '一直想确认当年最初感染源是否仍在活动',
  },
  {
    id: 'turn-debt-collection',
    evidence: '替一户无力偿债的家庭承担了公共劳动，因此失去自己的迁移名额。',
    positive: '沟通', negative: '健康',
    values: ['债务必须结清但不能无限继承', '共同体不能靠羞辱维持秩序'],
    redline: {
      summary: '拒绝把监护人的债务自动转给未成年家庭成员',
      trigger: ['debt_enforcement'], forbidden: ['inherit_guardian_debt'],
      alternatives: ['community_work_plan', 'renegotiate_debt'],
      threshold: 'debtor_is_minor=true', scope: 'diplomacy',
    },
    hook: '那户家庭仍欠此人一封说明真相的公开信',
  },
  {
    id: 'turn-false-alarm',
    evidence: '一次误报导致整个聚落仓促撤离，此人承担责任并重建了双人复核流程。',
    positive: '思维', negative: '意志',
    values: ['预警必须快，也必须注明置信度', '犯错后应修复流程而不是掩盖'],
    redline: {
      summary: '拒绝把未经复核的低置信度信号表述为确定灾害',
      trigger: ['hazard_broadcast'], forbidden: ['broadcast_uncertain_as_certain'],
      alternatives: ['broadcast_with_confidence', 'request_second_check'],
      threshold: 'confidence=low and second_check=false', scope: 'daily',
    },
    hook: '希望获得一次重新建立公众信任的机会',
  },
  {
    id: 'turn-prisoner-order',
    evidence: '在一次冲突后拒绝处决已经放下武器的人，因此被撤出警戒队。',
    positive: '意志', negative: '沟通',
    values: ['防卫不是报复', '失去战斗能力的人应被看管而非处决'],
    redline: {
      summary: '拒绝攻击已经投降且失去即时威胁的人',
      trigger: ['defense_action'], forbidden: ['execute_surrendered_person'],
      alternatives: ['guard_prisoner', 'disarm_and_release'],
      threshold: 'target_surrendered=true and immediate_threat=false', scope: 'defense',
    },
    hook: '被释放的人后来去了何处仍无人知道',
  },
  {
    id: 'turn-water-priority',
    evidence: '干旱时管理者优先保证私人温室，此人公开了真实用水账并离开。',
    positive: '思维', negative: '体能',
    values: ['基本饮水优先于奢侈生产', '稀缺资源的排序必须公开'],
    redline: {
      summary: '拒绝在居民饮水不足时向非必要项目秘密供水',
      trigger: ['water_allocation'], forbidden: ['secret_nonessential_water'],
      alternatives: ['publish_water_priority', 'ration_nonessential_use'],
      threshold: 'drinking_water_shortage=true', scope: 'logistics',
    },
    hook: '仍掌握一条可能恢复旧水渠的测绘线索',
  },
  {
    id: 'turn-broken-promise',
    evidence: '一次延期交货让友好聚落在寒潮中断粮，此人此后主动记录承诺余量。',
    positive: '沟通', negative: '意志',
    values: ['承诺应包含风险和余量', '无法履约时必须尽早通知'],
    redline: {
      summary: '拒绝在明知无力履约时继续隐瞒交付风险',
      trigger: ['trade_commitment'], forbidden: ['conceal_delivery_failure'],
      alternatives: ['renegotiate_early', 'partial_delivery_notice'],
      threshold: 'delivery_failure_known=true', scope: 'diplomacy',
    },
    hook: '想补偿当年受影响聚落的一名仓管员',
  },
] as const

interface MotivationTemplate {
  id: string
  motivation: string
  goal: string
  hook: string
}

export const MOTIVATION_TEMPLATES: readonly MotivationTemplate[] = [
  {
    id: 'motivation-stable-teaching',
    motivation: '寻找愿意固定安排教学时间、让技能可以交接的聚落',
    goal: '培养一名能独立承担自己主要技能日常工作的学员',
    hook: '会请求每周保留一个不被临时征用的教学块',
  },
  {
    id: 'motivation-open-ledger',
    motivation: '希望加入一个公开记录配给与公共劳动的共同体',
    goal: '建立任何成员都能复核的物资交接账',
    hook: '会请求追查一次来源不明的库存差额',
  },
  {
    id: 'motivation-repair-culture',
    motivation: '寻找允许预防性停机、而不是只在故障后追责的聚落',
    goal: '完成关键设备的维护周期表并训练轮值搭档',
    hook: '会请求为一台尚能运行的设备安排预防检修',
  },
  {
    id: 'motivation-family-trace',
    motivation: '利用稳定落脚点寻找一名迁移中失联的家人',
    goal: '确认失联者的真实去向并决定是否接回',
    hook: '会请求派人核对一条代价不低的外部线索',
  },
  {
    id: 'motivation-route-map',
    motivation: '希望把零散路线经验整理成共享地图，而不是个人筹码',
    goal: '完成周边三条路线的季节风险记录',
    hook: '会请求一次低收益但能补全地图的勘察',
  },
  {
    id: 'motivation-clinic-system',
    motivation: '寻找能建立稳定诊疗、隔离和轮值制度的聚落',
    goal: '让聚落在自己缺席时仍能完成基础伤病处置',
    hook: '会请求固定医疗训练和清洁物资额度',
  },
  {
    id: 'motivation-debt-repayment',
    motivation: '需要一个可靠据点兑现对外部帮助者欠下的具体债务',
    goal: '在不牺牲聚落基本供给的前提下偿还旧债',
    hook: '会请求保留一批物资用于一次有争议的外部交付',
  },
  {
    id: 'motivation-quiet-work',
    motivation: '希望在少一些公开争斗的地方完成长期工作',
    goal: '整理一套能让后来者继续使用的操作记录',
    hook: '会请求连续的独处工作时段而不是频繁会议',
  },
  {
    id: 'motivation-public-council',
    motivation: '寻找愿意让反对意见进入正式记录的聚落',
    goal: '建立小型议事和异议追踪流程',
    hook: '会请求为一次资源决策举行有记录的公开讨论',
  },
  {
    id: 'motivation-rebuild-trust',
    motivation: '希望通过长期可靠的工作修复一次旧错误造成的声誉',
    goal: '完成一项能由别人独立复核的长期改进',
    hook: '会请求让另一名成员复核自己的关键判断',
  },
  {
    id: 'motivation-safe-shelter',
    motivation: '想建立一个不会轻易抛下伤员、学徒或老人的安全落脚点',
    goal: '制定并演练一套分阶段撤离方案',
    hook: '会请求一次看似不紧迫的撤离演练',
  },
  {
    id: 'motivation-seasonal-study',
    motivation: '希望在承担日常工作的同时继续补足一项长期短板',
    goal: '在半年内把一项非主要技能提升到可独立承担日常工作',
    hook: '会请求每两周保留一个学习块并接受明确产出代价',
  },
  {
    id: 'motivation-water-restoration',
    motivation: '相信附近一套废弃供水设施仍有恢复价值',
    goal: '验证旧水渠和泵站是否值得投入修复',
    hook: '会请求先做勘察，而不是立即承诺全部维修资源',
  },
  {
    id: 'motivation-community-kitchen',
    motivation: '希望用公开配给和共同烹饪减少资源紧张时的猜疑',
    goal: '建立可预测的冬储与公共灶轮值',
    hook: '会请求在丰收时提前投入看似过量的保存工作',
  },
  {
    id: 'motivation-external-contact',
    motivation: '需要一个稳定聚落作为与多个外部关系继续往来的锚点',
    goal: '把一段私人互惠转成双方共同体都能理解的正式关系',
    hook: '会请求接待一名与自己有旧关系但聚落并不熟悉的访客',
  },
  {
    id: 'motivation-finish-record',
    motivation: '希望完成一份曾因政治压力中断的调查或档案',
    goal: '找到至少两份独立来源并公开最终结论',
    hook: '会请求保存可能令人不快、但仍未核实的证据',
  },
] as const

export const STRESS_RESPONSES = [
  '先列出不可逆风险，再处理最紧急的一项',
  '暂时减少发言，用书面记录整理冲突',
  '主动寻找搭档复核，避免独自承担全部判断',
  '先确认现场事实，再决定是否改变原计划',
  '把大问题拆成短时段任务，并明确下一次复盘点',
  '优先照看受影响的人，再讨论责任归属',
  '通过重复性的日常工作恢复稳定感',
  '要求把争议公开说清，不愿在含糊承诺上继续',
] as const

export const AFFILIATION_CANDIDATES = [
  '玩家聚落',
  '河湾农务联合体',
  '东岬维修公社',
  '高原观察站联盟',
  '西线流动车队',
] as const
