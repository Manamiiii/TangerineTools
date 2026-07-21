# TangerineTools 文档索引

`docs/` 只保存需要长期维护的系统说明、专题规则和人工确认台账。脚本生成的校验产物进入 Git 忽略的 `artifacts/`。

## 目录结构

```text
docs/
├── README.md                    # 本索引
├── system-capabilities.md       # 当前能力和明确非目标
├── data-sync.md                 # IndexedDB、导入导出和预置迁移语义
├── data-sources/                # 数据来源、BWiki 管线和字段血缘
└── nature/                      # 性格规则、模板和人工确认台账
```

## 长期维护文档

| 文件 | 用途 | 维护方式 |
|---|---|---|
| `system-capabilities.md` | 当前能力与明确非目标 | 功能范围变化时人工更新 |
| `data-sync.md` | Dexie 数据模型、导入导出、播种与迁移约束 | 数据语义变化时人工更新 |
| `data-sources/README.md` | 正式数据来源和外部旁证边界入口 | 数据来源体系变化时更新 |
| `data-sources/bwiki-pipeline.md` | BWiki 页面、快照目录、刷新和发布流程 | 管线变化时更新 |
| `data-sources/bwiki-field-mapping.md` | staging 到正式字段的映射和验收门槛 | 字段来源或转换口径变化时更新 |
| `nature/README.md` | 性格专题文档入口和维护边界 | 性格工作流变化时更新 |

长期开发安全边界、必读范围和验证命令以根目录 `AGENTS.md` 为准，不在这里重复维护。

## 更新触发条件

| 改动类型 | 应同步检查 / 更新 |
|---|---|
| 新增或移除工具、路由、部署能力 | 根 `README.md`、`system-capabilities.md` |
| 修改 Dexie schema、导入导出、播种或迁移 | `data-sync.md` 和 `AGENTS.md` 数据边界 |
| 修改 BWiki 来源、解析或发布流程 | `data-sources/`，并运行 `npm run check:bwiki:preset` |
| 修改性格规则或解释口径 | `nature/rules.md`，运行 `npm run check:nature`、检查本地校验产物并回归确认台账 |
| 单只精灵核对 | 使用 `nature/single-creature-template.md`；问题记入迭代台账，用户确认后写入确认台账 |
