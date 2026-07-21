# TangerineTools · Session 交接

本文件保存当前代码地图和活跃待办。长期开发边界、必读范围和安全规则见根目录 `AGENTS.md`。

## 当前系统

TangerineTools 是 Vite + React 19 + Dexie.js 构建的本地优先个人资料管理 Web App，无后端。默认场景为「洛克王国世界」，包含：

- 资料库 `catalog`
- 收集记录 `owned`
- 统计视图 `stock`
- 性格推荐 `nature`
- 孵蛋推荐 `breeding`

洛克王国世界正式数据采用版本化 BWiki staging / preview / apply 链路：

- `public/presets/rockKingdomRows.json`：592 条精灵或形态资料
- `public/presets/rockKingdomSkillRows.json`：553 条技能资料
- `public/presets/rockKingdomPresetMigration.json`：浏览器安全升级使用的正式值指纹

性格与定位报告位于 `docs/generated/`；BWiki 临时检查报告位于 Git 忽略的 `artifacts/`。

## 代码地图

```text
src/
  App.jsx                     # 路由、懒加载、启动错误恢复、全局导入导出
  db.js                       # 数据访问兼容门面
  db/
    core.js                   # Dexie v1 schema
    importExport.js           # JSON 导出、校验和 merge-by-id 导入
    repository.js             # 场景、资料表、字段、行和收集记录 CRUD
    rockKingdomSeed.js        # 洛克王国预置播种与三方迁移
  domain/
    nature.js                 # 性格推荐规则引擎
    naturePve.js              # PVE 培养层级、角色与性格摘要
    natureRowAdapter.js       # Dexie 资料行到推荐输入的适配
    stock.js                  # 统计分组与阈值聚合
    rockKingdom.js            # 形态排序、显示与首领关联规则
    rockKingdomPresentation.js# 洛克王国展示适配
    rockKingdomTags.js        # 浏览器与同步脚本共享的标签规则
  components/
    catalog.jsx               # 通用资料表格与字段输入
    dataTables.jsx            # 资料库工具
    owned.jsx                 # 收集记录
    stock.jsx                 # 统计视图
    nature.jsx                # 性格推荐 UI
    breeding.jsx              # 孵蛋推荐 UI
    ErrorBoundary.jsx         # 工具级错误恢复
public/presets/               # 正式运行时预置及迁移清单
scripts/bwiki/                # BWiki 同步、staging、preview 和发布
scripts/data/                 # 报告生成器的人工结构化输入
scripts/tests/                # 纯逻辑与 fake-indexeddb 集成测试
docs/data-sources/            # 数据来源与字段血缘
docs/nature/                  # 性格规则、模板、确认基线和未决问题
docs/generated/               # 版本化生成报告
artifacts/                    # 本地临时检查报告（Git 忽略）
```

## 当前约束

- Dexie schema 为 v1；导入按 id 合并，不清空文件中缺失的本地记录。
- 正式精灵和技能数据只通过 BWiki 版本化管线发布。
- 稳定 id、用户非空自定义值、收集记录和统计配置必须保持兼容。
- 性格推荐通过 `skillRefs` 读取技能资料，并把关联首领形态纳入最终形态分析。
- 文档描述当前状态；实现历史通过 Git 查询，不写入维护文档。

## 开发前检查

1. 阅读 `AGENTS.md` 和任务范围对应的必读文档。
2. 查看 `git status`、最新提交和当前分支远端状态。
3. 确认 Node 版本满足 `>=20.19.0`。
4. 修改后运行与范围匹配的生成、测试、lint、build 和 `git diff --check`。

## 活跃待办

- 验证已有 IndexedDB 的预置升级、形态排序、性格选择器过滤和首领联合分析。
- 优化分页、标签换行、固定操作列、详情技能标签、收集记录图标和搜索体验。
- 性格规则按单只精灵核对流程校准，并同步确认基线与未决问题。
