const STAT_THRESHOLDS = {
  hp: { p50: 91, p75: 110, p90: 126 },
  pdef: { p50: 82, p75: 102, p90: 121 },
  mdef: { p50: 82, p75: 101, p90: 120 },
  bulk: { p75: 301, p90: 338 },
}

export function deriveTraitTags(desc, stats = {}) {
  const tags = []
  const add = (tag) => {
    if (!tags.includes(tag) && tags.length < 4) tags.push(tag)
  }
  const hp = Number(stats.hp) || 0
  const patk = Number(stats.patk) || 0
  const matk = Number(stats.matk) || 0
  const pdef = Number(stats.pdef) || 0
  const mdef = Number(stats.mdef) || 0
  const spd = Number(stats.spd) || 0
  const bulk = hp + pdef + mdef
  const topAttack = Math.max(patk, matk)

  if (patk >= matk + 15 && patk >= 85) add('patkLean')
  if (matk >= patk + 15 && matk >= 85) add('matkLean')
  if (Math.abs(patk - matk) <= 15 && patk >= 85 && matk >= 85) add('attack')
  if (spd >= 95 || (spd >= 85 && spd >= topAttack - 5)) add('spdLean')
  const hasTopBulk = bulk >= STAT_THRESHOLDS.bulk.p90 || hp >= STAT_THRESHOLDS.hp.p90
  const hasBalancedBulk =
    (bulk >= STAT_THRESHOLDS.bulk.p75 && hp >= STAT_THRESHOLDS.hp.p50 &&
      (pdef >= STAT_THRESHOLDS.pdef.p75 || mdef >= STAT_THRESHOLDS.mdef.p75)) ||
    (hp >= STAT_THRESHOLDS.hp.p75 && (pdef >= STAT_THRESHOLDS.pdef.p50 || mdef >= STAT_THRESHOLDS.mdef.p50))
  if (hasTopBulk || hasBalancedBulk) add('defense')

  if (desc) {
    if (/回复|恢复|生命|治疗|回血|保留1点生命/.test(desc)) add('support')
    if (/能量|能耗|回复\d*能量|获得\d*能量/.test(desc)) add('energyCycle')
    if (/克制|抵触/.test(desc)) add('counterGain')
    if (/速度\+\d+|获得速度|速度提升/.test(desc)) add('conditionalSpeedBoost')
    if (/迅捷/.test(desc)) add('swiftSkill')
    if (/强化|永久\+|\+20%|\+70%|提升|增加/.test(desc)) add('growth')
    if (/护盾|减伤|防御|免疫|抵免/.test(desc)) add('shieldReduce')
    if (/冻结|中毒|灼烧|异常|恐惧|控制|污染|睡眠|麻醉/.test(desc)) add('control')
    if (/返场|换入|换下|替换|出战编队/.test(desc)) add('pivot')
    if (/亲密|同乘|采集|挖矿|捕捉|经验|家园|灵感|范围/.test(desc)) add('support')
    if (tags.length === 0 && /攻击|伤害|暴击|威力|致命/.test(desc)) add('attack')
  }

  return tags.length > 0 ? tags : ['special']
}

export function deriveSkillTags(skillTexts = []) {
  const tags = []
  const add = (tag) => {
    if (!tags.includes(tag)) tags.push(tag)
  }
  const skillJoined = skillTexts.join('\n')
  const physicalSkillCount = skillTexts.filter((text) => /物攻|物理|物伤/.test(text)).length
  const magicalSkillCount = skillTexts.filter((text) => /魔攻|魔法|魔伤/.test(text)).length
  if (physicalSkillCount > 0) add('physicalMoves')
  if (magicalSkillCount > 0) add('magicalMoves')
  if (physicalSkillCount >= 4 && magicalSkillCount >= 4) add('mixedMoves')
  if (physicalSkillCount >= magicalSkillCount + 3) add('physicalLean')
  if (magicalSkillCount >= physicalSkillCount + 3) add('magicalLean')
  if (/先手|迅捷|速度\+|速度-/.test(skillJoined)) add('speed')
  if (/后手|反击|受到攻击后|承受.*后/.test(skillJoined)) add('slowBenefit')
  if (/中毒|冻结|麻痹|眩晕|恐惧|睡眠|控制|驱散|打断/.test(skillJoined)) add('control')
  if (/回复|生命|治疗|吸血/.test(skillJoined)) add('support')
  if (/能量|能耗|迸发|传动/.test(skillJoined)) add('energyCycle')
  if (/防御|护盾|减伤|承伤/.test(skillJoined)) add('defense')
  return tags
}

export function deriveSkillEffectTags(skill = {}) {
  const tags = Array.isArray(skill.effectTags) ? [...skill.effectTags] : []
  const add = (tag) => {
    if (!tags.includes(tag)) tags.push(tag)
  }
  const text = [
    skill.nm, skill.name, skill.tp, skill.type, skill.category, skill.ef, skill.text,
    skill.effect, skill.description, skill.desc, skill.power, skill.cost, skill.priority,
  ]
    .filter(Boolean)
    .join(' ')

  if (/先手|优先|抢先|迅捷/.test(text)) add('priority')
  if (/迅捷/.test(text)) add('swift')
  if (/迅捷|速度[+-]|速度提升|速度降低|先手|高速/.test(text)) add('speed')
  if (/回复|恢复|治疗|吸血|生命/.test(text)) add('healing')
  if (/防御|护盾|减伤|承伤|抵抗|免疫/.test(text)) add('damageReduction')
  if (/回复\d*能量|获得\d*能量|能量回复|迸发/.test(text)) add('energyGain')
  if (/偷取.*能量|失去\d*能量|扣.*能量|能量减少/.test(text)) add('energyDrain')
  if (/能耗[+-]|费用[+-]|消耗[+-]|全技能能耗/.test(text)) add('costChange')
  if (/物攻\+|魔攻\+|双攻\+|物防\+|魔防\+|双防\+|威力\+|强化|提升|增加/.test(text)) add('statBoost')
  if (/继承.*增益|增益.*继承|传递.*增益|增益.*传递|下个入场.*继承|入场精灵继承|击鼓传花/.test(text)) add('boostTransfer')
  if (/物攻-|魔攻-|双攻-|物防-|魔防-|双防-|速度-|削弱|降低|减少/.test(text)) add('statDebuff')
  if (/中毒|剧毒|灼烧|烧伤|冻结|冰冻|睡眠|恐惧|麻痹|混乱|沉默|束缚|异常|控制/.test(text)) add('control')
  if (/应对攻击|反击|受到攻击后|承受.*后/.test(text)) add('counterAttack')
  if (/应对防御/.test(text)) add('counterDefense')
  if (/应对状态/.test(text)) add('counterStatus')
  if (/脱离|换入|换场|换下|返场|替换/.test(text)) add('pivot')
  if (/\d+\s*连击|连击/.test(text)) add('multiHit')
  if (/蓄力/.test(text)) add('charge')
  if (/天气|场地|雨|雪|沙暴|放晴/.test(text)) add('fieldEffect')
  if (/驱散|清除.*(?:增益|减益|状态)|解除.*(?:增益|减益|状态)/.test(text)) add('dispel')
  if (/印记|标记|萌化|寄生|蓄势|蓄电|奉献/.test(text)) add('mark')
  if (/选择|随机|巧变/.test(text)) add('choice')
  if (/己方队伍|全体|队友|下个入场/.test(text)) add('teamSupport')

  const category = String(skill.category || skill.tp || skill.type || '')
  const power = Number(skill.power)
  const isAttack = category === 'physical'
    || category === 'magical'
    || /物攻|物理|物伤|魔攻|魔法|魔伤/.test(category)
    || Number.isFinite(power) && power > 0
    || /造成.*(?:伤害|物伤|魔伤)|攻击敌方/.test(text)
  if (tags.length === 0 && isAttack) add('directDamage')
  if (tags.length === 0) add('specialMechanic')

  return tags
}
