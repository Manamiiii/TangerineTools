# 阅读伴侣模型提示词契约

本文定义个人书籍运行时初始化和内置书正式预制使用的提示词边界。两条路线共享名称类型、无剧透原则和“不确定则省略”原则，但输出权限不同，不能互换。

## 提示词目录

| 标识 | 使用位置 | 输入 | 允许输出 | 落库方式 |
|---|---|---|---|---|
| `personal-book-knowledge-v1` | 用户在工具中创建或补充个人书籍 | 书名、作者、译者、出版社、出版时间、ISBN、原作语言 | 最多 50 个名称、原文名、别名、类型和保守地点分类 | 自动合并到个人书籍隐藏 `onDemandEntities` |
| `formal-reading-package-candidates-v1` | Codex 或其他维护模型预制内置书 | 版本信息、已核验公开来源摘录、可用的指定版本章节证据 | 带来源和阻塞项的实体、事实候选 | 只能写入 staging；经过 preview 和显式 apply 才能发布 |

运行时提示词的可执行源位于 `src/features/reading-companion/model/promptCatalog.js`。修改其标识、消息或输出契约时必须同步更新本文和领域测试。缓存键包含提示词标识，升级标识会自然避开旧页面缓存。

供应商连接、HTTPS / localhost 校验、45 秒超时、JSON 解析和页面内临时缓存位于 `src/features/model/`，可由其他场景的受限模型任务复用。阅读提示词、输出权限和资料落库契约仍只属于阅读伴侣，不能被其他场景任务替换或放宽。

## 个人书籍运行时初始化

这条路线服务于“用户尚未读过本书”的场景。用户不需要审查模型列出的整本书知识：

- 结果不在初始化时完整展示，只作为隐藏精确匹配词典。
- 不生成关系、身份、命运、剧情、章节位置、解释、地图坐标或正式事实。
- 名称确实出现在当前阅读输入后才显示，由读者在眼前上下文中记录或忽略。
- 模型失败不影响书籍创建；重复执行只补充未存在的名称。

该输出是个人辅助资料，不是公开来源、指定版本证据或客观首次出现章节。

## 内置书正式预制

当用户要求“预制某本书”时，维护者使用 `formal-reading-package-candidates-v1`。用户只需尽可能提供版本信息；用户没有读过该书时，不要求其判断人物关系、剧情事实或首次出现章节。无法由来源和指定版本证据确定的内容保留为候选和阻塞项。

正式预制分为两步：

1. 维护者检索并核验可合法引用的书目、作者机构、图书馆、博物馆、政府地理和地图资料，把实际访问过的来源与必要摘录组成输入。
2. 模型把输入整理成 staging 候选。模型不能把自己的训练记忆声明为来源，也不能直接批准或发布候选。

### 标准系统提示词

```text
提示词版本：formal-reading-package-candidates-v1

你为 TangerineTools 阅读伴侣准备内置书资料包的研究候选。
只使用输入中列出的书籍版本、来源和证据；训练记忆只能帮助发现歧义，不能作为 sourceIds 或发布依据。
输出必须区分 sourceCandidates、entityCandidates 和 factCandidates，并适配版本化 staging。

规则：
1. 不复制大段受版权保护的原文，不补写缺失章节内容。
2. 每个实体或事实候选必须引用输入中真实存在的 sourceIds。
3. 没有指定译本章节证据时 revealAt 必须为 null，并加入 missing_edition_chapter_evidence。
4. 中文译名或别名未由指定版本确认时，加入 edition_aliases_not_audited。
5. 人物关系、身份、命运、剧情结果和与剧情相关的历史说明不得标为 safe。
6. 现实地点坐标必须来自输入中的地图或权威地理来源，并说明是点、范围、路径还是现代代表位置。
7. 虚构地点不得包含精确坐标；原型或模糊地点只能形成带置信度的候选区域。
8. 无法确认作品是否直接出现某名称时，加入 book_relevance_requires_confirmation。
9. status 只能是 candidate 或 rejected；模型不得输出 approved。
10. candidate 必须至少包含一个 blockers 项；宁可保留阻塞，也不要猜测。
11. 不要把候选内容放入正式 entities、facts 或 onDemandEntities。
12. 只返回 JSON，不返回解释性正文。
```

### 标准用户输入

```json
{
  "book": {
    "title": "书名",
    "author": "作者",
    "originalLanguage": "原作语言"
  },
  "edition": {
    "translators": [],
    "publisher": "出版社",
    "publishedAt": "出版时间",
    "isbn": "ISBN",
    "chapterLabels": []
  },
  "verifiedSources": [
    {
      "id": "source-stable-id",
      "label": "实际来源名称",
      "url": "实际访问地址",
      "organization": "发布机构",
      "accessedAt": "YYYY-MM-DD",
      "useFor": [],
      "evidence": "维护者提供的必要事实摘要或短摘录"
    }
  ],
  "editionEvidence": [
    {
      "chapterId": "chapter-stable-id",
      "evidence": "由用户提供或合法取得的最小必要章节证据"
    }
  ]
}
```

### 标准输出

```json
{
  "promptVersion": "formal-reading-package-candidates-v1",
  "sourceCandidates": [
    {
      "id": "source-stable-id",
      "status": "candidate",
      "kind": "book-metadata|edition-evidence|public-research|modern-geography|historical-map",
      "label": "实际来源名称",
      "organization": "发布机构",
      "url": "实际访问地址",
      "accessedAt": "YYYY-MM-DD",
      "useFor": [],
      "rightsStatus": "待维护者确认",
      "notes": "输入证据能支持什么，以及不能推出什么"
    }
  ],
  "entityCandidates": [
    {
      "status": "candidate",
      "entity": {
        "id": "stable-id",
        "name": "名称",
        "kind": "person|place|concept|event",
        "aliases": [],
        "revealAt": null
      },
      "sourceIds": ["source-stable-id"],
      "blockers": ["missing_edition_chapter_evidence"],
      "notes": "当前证据支持什么，以及不能推出什么"
    }
  ],
  "factCandidates": [
    {
      "status": "candidate",
      "fact": {
        "id": "stable-id",
        "kind": "spatial|character|plot|history|concept",
        "content": "候选事实",
        "entityIds": [],
        "revealAt": null,
        "riskLevel": "safe|potential|high",
        "riskCategories": [],
        "confidence": 0
      },
      "sourceIds": ["source-stable-id"],
      "blockers": ["missing_edition_chapter_evidence"],
      "notes": "当前证据支持什么，以及不能推出什么"
    }
  ]
}
```

模型输出还要经过 `scripts/reading-companion/lib/package-pipeline.mjs` 的结构校验。公开来源能支持名称或现代地理信息时，可以先形成隐藏按需匹配候选；公开来源不能代替指定译本的 `revealAt` 证据。
