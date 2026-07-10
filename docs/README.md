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


## 文档更新触发条件

| 改动类型 | 应同步检查 / 更新 |
|---|---|
| 新增或移除工作台工具、路由、部署能力 | `README.md`、`system-capabilities.md`、`session-start-prompt.md` |
| 修改 Dexie schema、导入/导出、预置播种或迁移语义 | `data-sync.md`、`AGENTS.md` 中的数据安全边界 |
| 修改洛克王国预置同步脚本或预置 JSON 产物 | 运行 `npm run sync:rock scripts/data/rockKingdom.d.json`，并检查 `data-sync.md` 与根 `README.md` 的脚本说明 |
| 修改性格推荐规则或解释口径 | `nature-recommendation-redesign.md`，并运行 `npm run check:nature` 重新生成校准报告 |
| 修改外部定位核对流程或批次生成逻辑 | `rocom-position-audit-plan.md`，必要时运行 `npm run audit:rocom` |
| 只做生成报告刷新 | 不手改报告正文；优先记录生成命令、时间和输入来源 |

## 生成报告

| 文件 | 生成命令 | 说明 |
|---|---|---|
| `nature-calibration-report.md` | `npm run check:nature` | 性格推荐校准报告，读取官方同步出的预置精灵/技能资料，供人工检查规则原因。 |

## 已清理内容

历史的 `rocom-data-analysis.md` 已删除。它记录的是早期对第三方 `rocom-data` 项目的学习笔记，和当前“只使用洛克王国世界资料、不用旧游资料、不直接搬外部数据”的审计流程容易混淆；其中仍有效的边界已经沉淀到 `AGENTS.md`、`system-capabilities.md`、`nature-recommendation-redesign.md` 和 `rocom-position-audit-plan.md`。
