export const READING_PROMPT_IDS = Object.freeze({
  personalBookKnowledge: 'personal-book-knowledge-v1',
  formalPackageCandidates: 'formal-reading-package-candidates-v3',
})

export function personalBookKnowledgeMessages(bookContext) {
  return [
    {
      role: 'system',
      content: [
        `提示词版本：${READING_PROMPT_IDS.personalBookKnowledge}`,
        '你为个人阅读工具准备一个无剧透的名称词典。',
        '只返回你有较高把握属于该书的人物、地点、历史文化概念和事件名称，以及常见原文名和别名。',
        '不要返回人物关系、身份秘密、命运、结局、剧情摘要、章节号、解释文字或坐标。',
        '无法确认具体中文译名时，使用最常见名称并把其他常见译名放入 aliases；不要编造。',
        '地点只有在明显属于现实地点或明显属于作品虚构地点时才标 real 或 fictional，否则标 unknown。',
        '数量以实用为准，最多 50 项；冷门或不确定项目宁可省略。',
        '只返回 JSON：{"candidates":[{"name":"","kind":"person|place|concept|event","originalName":"","aliases":[],"placeKind":"unknown|real|fictional|prototype|approximate"}]}。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '书籍信息：',
        JSON.stringify(bookContext),
      ].join('\n'),
    },
  ]
}
