# TangerineTools · 后续 Session 启动提示

这份文档用于新 session 快速接手当前分支，补充项目背景、代码地图和阶段性接手说明。长期有效的 Codex 开发边界、必读文件与测试命令已整理到仓库根目录 `AGENTS.md`，因此未来启动新任务时通常只需要引用本文件并写清本轮目标，不需要重复粘贴完整背景。

## 项目现状

TangerineTools 是本地优先的个人资料管理 Web App（Vite + React 19 + Dexie.js），纯静态、无后端。当前默认演示场景为「洛克王国世界」，工作台包含五个工具：

- 资料库 `catalog`
- 收集记录 `owned`
- 统计视图 `stock`
- 性格推荐 `nature`
- 孵蛋推荐 `breeding`

洛克王国正式预置已从版本化 BWiki staging / preview 显式发布：

- `public/presets/rockKingdomRows.json`：592 条精灵 / 形态资料。
- `public/presets/rockKingdomSkillRows.json`：553 条技能资料。
- `public/presets/rockKingdomPresetMigration.json`：已有浏览器安全升级所需的旧官方值 SHA-256，不含用户数据。
- `scripts/data/rockKingdom.d.json`：旧版可信源文件，只用于 `sync:legacy-rock` 隔离对照预览。

## 开发前先看

1. `AGENTS.md` —— 长期有效的 Codex 开发边界、数据安全约束、必读文件与测试命令。
2. `docs/system-capabilities.md` —— 当前功能范围与明确不做的事。
3. `docs/data-sync.md` —— Dexie schema、导出/导入合并语义、预置资料迁移。
4. `docs/nature-recommendation-redesign.md` —— 性格推荐规则原型与下一轮调参背景。
5. `docs/nature-single-creature-template.md` —— 单只精灵性格核对输出模板。
6. `docs/nature-rule-iteration-log.md` —— 已发现的通用规则问题与处理状态。
7. `docs/nature-confirmed-results.md` —— 用户确认过、规则调整后需要回归的单只结论。
8. 当前 PR 描述、最近 commit、review comments。

## 当前阶段重点

- 性格推荐仍处于规则校准阶段；日常核对改为随捕捉进度从图鉴前部开始“一只精灵一轮”分析，先给出当下捕捉性格取舍，再判断是否需要沉淀为通用规则。
- 外部资料核对只关注洛克王国世界对精灵定位、机制和实战评价的描述；旧网页游戏洛克王国资料不作为新游定位依据。
- 全量本地审计台账保留为索引和专题回归工具；当多只精灵暴露同类问题时，再按低生命高单防、速度线、双攻路线等专题批次统一修规则。
- 单只精灵核对请严格沿用 `docs/nature-single-creature-template.md`。日常默认改为“分歧优先”：用户已在工具里看到的推荐 / 可保留 / 不推荐完整分档不再重复输出，只补充工具不易表达的本地资料与外部定位核对、模型能力分析、PVE 投入判断、工具结果差异和待确认点；只有用户明确要求全量核对时，才参考 `docs/nature-calibration-report.md` 展开全部 30 个候选。推荐性格只表示捕捉保留方向正确，不自动等于值得投入 PVE 资源；若用户讨论异色/炫彩培养，需明确 PVP 属性自动平衡、不作为培养依据，并单独判断 PVE 投入优先级。发现规则偏差先登记 `docs/nature-rule-iteration-log.md`，用户确认最终分档后再写入 `docs/nature-confirmed-results.md`，后续规则调整必须回归这些已确认结论。
- BWiki P4 已正式覆盖 `public/presets`，发布 592 条精灵、553 条技能及三方迁移清单。繁育字段已合入正式精灵行，独立快照只保留在 staging，不再参与运行时；完整启动迁移按正式预置版本执行，导入后自动失效并重新安全合并。旧 `d.json` 命令已隔离为 preview，不能覆盖正式预置。工具组件按需加载，Dexie core、导入导出和洛克王国展示适配已拆出独立模块；统一测试与 GitHub Pages CI 会依次运行 lint、test、build。

## 代码地图

```text
src/
  main.jsx            # 入口，挂载 <App />，引入 styles.css
  App.jsx             # hash 路由（首页 ↔ 场景工作台）、全局导出/导入
  db.js               # CRUD + 预置播种/迁移的兼容门面
  db/core.js          # Dexie schema（保持 v1）
  db/importExport.js  # JSON 导出、校验与合并导入
  constants.js         # 场景/工具/字段类型、六维定义、分页选项等常量与标签函数
  utils.js             # id、字段归一化、排序/筛选/分页、选项合并等通用函数
  presets/
    rockKingdom.js      # 洛克王国场景、资料表、字段、选项定义
  domain/
    owned.js            # 收集记录字段、选项、搜索/统计纯函数
    nature.js           # 性格推荐规则引擎、技能分析、资料行提取函数
    rockKingdom.js       # 同编号形态对比、适合方向、主要差异纯函数
    rockKingdomPresentation.js # 洛克王国引用排序、标签与状态展示适配
    rockKingdomTags.js   # 浏览器与同步脚本共享标签规则入口
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
    rockKingdomPresetMigration.json # 版本化三方迁移指纹
scripts/
  data/rockKingdom.d.json      # 可信 d.json 源文件
  sync-rock-kingdom-preset.mjs # 旧 d.json 隔离 preview 脚本，不覆盖正式预置
docs/
  README.md / system-capabilities.md / data-sync.md / nature-recommendation-redesign.md / session-start-prompt.md
  nature-single-creature-template.md / nature-confirmed-results.md / nature-rule-iteration-log.md
  rocom-position-audit-plan.md
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

本轮目标建议：按捕捉进度做「单只精灵性格取舍核对」。

背景：
- 性格推荐原型已实现全部 30 个合法性格候选展示。
- 精灵基础资料已通过 skillRefs 引用技能资料；技能资料已生成并可参与分析。
- traitTags 与 skillTags 已分离；推荐引擎会读取六维、traitTags、skillRefs 对应技能行。
- 最终速度公式入口已预留，但具体固定参数仍未确认。
- 外部资料只用于理解洛克王国世界里的定位、机制和玩家评价，不直接照抄外部推荐性格。

本轮请按一只精灵闭环：
1. 我会给出编号/名称/形态，以及捕捉时遇到的候选性格。
2. 先读取本地六维、特性、技能摘要、综合定位和当前推荐/可保留/不推荐结果。
3. 再搜索洛克王国世界资料，提炼外部对该精灵定位、机制、强弱评价的描述，排除旧网页游戏洛克王国资料。
4. 输出本轮捕捉建议：哪些性格推荐、哪些可保留、哪些不建议保留；说明本地依据、外部依据和风险。
5. 如果发现规则偏差，先问我确认玩法口径；确认是通用问题后再改规则并重跑 check:nature / audit:rocom / lint / build / git diff --check。

边界：不引入 Dexie schema 版本变更；不做战斗模拟、阵容系统或属性克制；不做硬编码单只精灵特判。
```
