# TangerineTools 文档索引

本文档用于说明 `docs/` 下文件的用途，避免后续 session 不知道该读哪一份、哪些是生成物、哪些是长期维护文档。

## 必读 / 长期维护

| 文件 | 用途 | 维护方式 |
|---|---|---|
| `session-start-prompt.md` | 新 session 的项目接手说明、代码地图和阶段重点。 | 人工维护；长期规则应放到仓库根目录 `AGENTS.md`。 |
| `system-capabilities.md` | 当前已实现能力与明确非目标。 | 功能范围变化时人工更新。 |
| `data-sync.md` | Dexie 数据模型、导入/导出语义、预置资料播种/迁移。 | 涉及数据结构或同步逻辑时人工更新。 |
| `nature-recommendation-redesign.md` | 性格推荐的设计草案、输入输出模型和规则讨论背景。 | 性格推荐规则大方向变化时人工更新。 |
| `rocom-position-audit-plan.md` | 洛克王国世界外部定位核对计划、批次、状态台账和协作流程。 | 由 `npm run audit:rocom` 生成基础表；外部核对结论可人工补充。 |

## 生成报告

| 文件 | 生成命令 | 说明 |
|---|---|---|
| `nature-calibration-report.md` | `npm run check:nature` | 性格推荐校准报告，读取官方同步出的预置精灵/技能资料，供人工检查规则原因。 |

## 已清理内容

历史的 `rocom-data-analysis.md` 已删除。它记录的是早期对第三方 `rocom-data` 项目的学习笔记，和当前“只使用洛克王国世界资料、不用旧游资料、不直接搬外部数据”的审计流程容易混淆；其中仍有效的边界已经沉淀到 `AGENTS.md`、`system-capabilities.md`、`nature-recommendation-redesign.md` 和 `rocom-position-audit-plan.md`。
