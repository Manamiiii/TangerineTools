# TangerineTools · 后续 Session 启动提示

本文件只保存当前分支的轻量交接信息。长期开发边界、必读文档和安全规则见仓库根目录 `AGENTS.md`。

## 当前状态

TangerineTools 是 Vite + React 19 + Dexie.js 构建的本地优先个人资料管理 Web App，无后端。默认场景为「洛克王国世界」，包含：

- 资料库 `catalog`
- 收集记录 `owned`
- 统计视图 `stock`
- 性格推荐 `nature`
- 孵蛋推荐 `breeding`

洛克王国世界正式数据只采用版本化的 BWiki staging / preview 发布链路：

- `public/presets/rockKingdomRows.json`：592 条精灵或形态资料
- `public/presets/rockKingdomSkillRows.json`：553 条技能资料
- `public/presets/rockKingdomPresetMigration.json`：已有浏览器安全升级所需的旧官方值指纹

退役的 gamecenter `d.json`、旧同步器和阶段性发布报告已删除。脚本生成的检查报告进入被 Git 忽略的 `artifacts/`，不再作为长期文档维护。

## 当前代码地图

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
    naturePve.js              # PVE 培养层级、角色与性格摘要纯逻辑
    natureRowAdapter.js       # Dexie 资料行到推荐输入的适配
    stock.js                  # 统计分组与阈值聚合纯逻辑
    rockKingdom.js            # 形态排序、显示与首领关联规则
    rockKingdomPresentation.js# 洛克王国展示适配
    rockKingdomTags.js        # 浏览器与同步脚本共享的标签规则唯一实现
  components/
    catalog.jsx               # 通用资料表格与字段输入
    dataTables.jsx            # 资料库工具
    owned.jsx                 # 收集记录
    stock.jsx                 # 统计视图
    nature.jsx                # 性格推荐 UI
    breeding.jsx              # 孵蛋推荐 UI
    ErrorBoundary.jsx         # 工具级渲染错误恢复
public/presets/               # 当前正式运行时预置及迁移清单
scripts/data/bwiki/           # 当前 BWiki staging 与 preview 输入
scripts/tests/                # 纯逻辑测试和 fake-indexeddb 集成测试
artifacts/                    # 可重新生成的本地检查报告（Git 忽略）
```

## 本分支已完成

- BWiki 已成为唯一正式预置来源，旧 `d.json` 数据源与同步脚本已移除。
- Dexie schema 仍为 v1；导入仍按 id 合并，不会清空文件中缺失的本地记录。
- 数据库入口已拆为 core、导入导出、仓储和预置迁移模块；`src/db.js` 保留稳定导出。
- 预置迁移已有 fake-indexeddb 集成覆盖：首次播种、版本跳过、导入后重跑、保留用户自定义值和失败重试。
- 共享标签规则已移入 `src/domain/rockKingdomTags.js`，Node 脚本只做转发，前端不再依赖 `scripts/`。
- 应用启动失败和懒加载工具渲染失败均有可见错误与重试入口。
- 统计聚合已从 React 组件抽离并覆盖多选分组、空值和阈值测试；仓储级联删除与收集表幂等行为已有 IndexedDB 集成测试。
- 性格推荐的特性标签输入不再依赖整套资料库组件，打开推荐工具时无需额外加载 `catalog.jsx`。
- 资料表格的引用字段按目标资料表批量订阅，详情弹窗和编辑表单仍保留独立引用加载兼容。
- PVE 展示判定已从 React 组件抽到 `src/domain/naturePve.js`，并有独立回归测试。

## 继续开发前

1. 阅读 `AGENTS.md` 以及当前任务要求对应的必读文档。
2. 查看 `git status`、最新 commit 和当前分支远端状态。
3. Node 版本须满足 `>=20.19.0`。
4. 修改后至少运行 `npm run lint`、`npm test`、`npm run build`、`git diff --check`；工具入口或 Hook 变动还要逐个切换五个工具做浏览器冒烟验证。

## 当前建议的下一步

- 在另一台电脑验证已有 IndexedDB 的预置升级、形态排序、性格选择器过滤和首领联合分析。
- 后续 UI 工作继续处理分页、标签换行、固定操作列、详情技能标签以及收集记录图标与搜索。
- 性格规则调整仍按单只精灵核对流程进行，并同步相应校准与确认文档。
