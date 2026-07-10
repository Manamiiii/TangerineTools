# TangerineTools · 后续 Session 启动提示

这份文档用于新 session 快速接手当前分支，补充项目背景、代码地图和阶段性接手说明。长期有效的 Codex 开发边界、必读文件与测试命令已整理到仓库根目录 `AGENTS.md`。

## 项目现状

TangerineTools 是本地优先的个人资料管理 Web App（Vite + React 19 + Dexie.js），纯静态、无后端。当前默认演示场景为「洛克王国世界」，工作台包含四个工具：

- 资料库 `catalog`
- 收集记录 `owned`
- 统计视图 `stock`
- 性格推荐 `nature`

洛克王国预置资料已接入可信 `d.json`，并由 `scripts/sync-rock-kingdom-preset.mjs` 生成：

- `public/presets/rockKingdomRows.json`：496 条精灵 / 形态资料。
- `public/presets/rockKingdomSkillRows.json`：技能资料。
- `scripts/data/rockKingdom.d.json`：本地可信源文件，用于当前环境无法访问官方源时复现同步。

## 开发前先看

1. `AGENTS.md` —— 长期有效的 Codex 开发边界、数据安全约束、必读文件与测试命令。
2. `docs/system-capabilities.md` —— 当前功能范围与明确不做的事。
3. `docs/data-sync.md` —— Dexie schema、导出/导入合并语义、预置资料迁移。
4. `docs/nature-recommendation-redesign.md` —— 性格推荐规则原型与下一轮调参背景。
5. 当前 PR 描述、最近 commit、review comments。

## 当前阶段重点

- 性格推荐仍处于规则校准阶段，优先讨论规则口径与样例报告，不做单只精灵手工特判。
- 外部资料核对只关注洛克王国世界对精灵定位、机制和实战评价的描述；旧网页游戏洛克王国资料不作为新游定位依据。
- 全量本地审计台账可以生成，但外部定位核对建议分批推进：每批发现规则问题后先确认并修正，再继续下一批。
- 预置资料仍以官方 `d.json` / 本地可信 `scripts/data/rockKingdom.d.json` 为准。

## 代码地图

```text
src/
  main.jsx            # 入口，挂载 <App />，引入 styles.css
  App.jsx             # hash 路由（首页 ↔ 场景工作台）、全局导出/导入
  db.js               # Dexie schema + CRUD + 导出/导入 + 预置播种/迁移
  constants.js         # 场景/工具/字段类型、六维定义、分页选项等常量与标签函数
  utils.js             # id、字段归一化、排序/筛选/分页、选项合并等通用函数
  presets/
    rockKingdom.js      # 洛克王国场景、资料表、字段、选项定义
  domain/
    owned.js            # 收集记录字段、选项、搜索/统计纯函数
    stock.js            # 统计视图纯函数
    nature.js           # 性格推荐规则引擎、技能分析、资料行提取函数
    rockKingdom.js       # 同编号形态对比、适合方向、主要差异纯函数
  components/
    common.jsx          # Modal / ConfirmDialog / IconButton / Popover / Pagination / StatsChart 等
    scenes.jsx           # 首页场景列表 + 新建/编辑场景弹窗
    catalog.jsx          # 字段管理、DataGrid、筛选、CellView/FieldInput（含引用/多引用）
    dataTables.jsx       # 资料库顶层、表切换、行新增/编辑/详情弹窗
    owned.jsx            # 收集记录工具
    stock.jsx            # 统计视图工具
    nature.jsx           # 性格推荐工具 UI
public/
  presets/
    rockKingdomRows.json       # 精灵 / 形态预置行
    rockKingdomSkillRows.json  # 技能预置行
scripts/
  data/rockKingdom.d.json      # 可信 d.json 源文件
  sync-rock-kingdom-preset.mjs # 生成 rows / skillRows 的同步脚本
docs/
  README.md / system-capabilities.md / data-sync.md / nature-recommendation-redesign.md / session-start-prompt.md / rocom-position-audit-plan.md
```

## 关键约定 / 容易踩的坑

- **字段 `key` vs `id`**：行数据读取要用字段 `key`，不要和字段主键 `id` 混淆。
- **普通资料表 vs 工具表**：`catalogTables.kind` 为非索引属性；普通资料表是 `!table.kind`，收集记录表是 `kind === 'owned'`。
- **多引用字段**：`references` 字段用于一对多引用，值为 row id 数组；单引用仍用 `reference`。
- **技能关联**：精灵行使用 `skillRefs` 多引用指向技能表；技能行使用 `learnerRefs` 多引用反向指向精灵表。不要再把技能列表写成精灵长文本字段。
- **特性标签与技能标签分离**：`traitTags` 表示六维/特性倾向；`skillTags` 表示技能池倾向。性格推荐还会直接解析 `skillRefs` 对应的技能行。
- **`stats` 字段不可编辑**：它是由底层数值字段派生的视图字段，新增/编辑行表单里不出现。
- **隐藏字段仍需详情展示**：字段 `hidden` 只影响表格列，不应从详情弹窗过滤掉。
- **导入是合并不是替换**：同 id 覆盖，文件中缺失的本地数据保留。
- **CSS**：`src/styles.css` 是唯一样式来源，无 CSS 模块/框架。

## 本轮后建议的新 session Prompt

```text
请继续开发 GitHub 仓库 Manamiiii/TangerineTools 当前 PR / 功能分支。

开始前请阅读：
1. AGENTS.md
2. docs/session-start-prompt.md
3. docs/system-capabilities.md
4. docs/data-sync.md
5. docs/nature-recommendation-redesign.md
6. 当前 PR 描述、最近 commit、review comments

本轮目标建议：单独讨论并优化「性格推荐规则」。

背景：
- 性格推荐原型已实现全部 30 个合法性格候选展示。
- 精灵基础资料已通过 skillRefs 引用技能资料；技能资料已生成并可参与分析。
- traitTags 与 skillTags 已分离；推荐引擎会读取六维、traitTags、skillRefs 对应技能行。
- 最终速度公式入口已预留，但具体固定参数仍未确认。

本轮请优先做规则讨论和样例校准：
- 逐个精灵检查推荐 / 可保留 / 不推荐是否符合直觉。
- 调整速度、主攻、双攻、耐久、防御手、后手收益、技能质量等权重。
- 不要再扩展大型资料结构，除非先确认范围。
- 不要引入 Dexie schema 版本变更。
- 修改后按 AGENTS.md 运行相关检查；性格规则调整至少运行 npm run check:nature、npm run lint、npm run build、git diff --check。
```
