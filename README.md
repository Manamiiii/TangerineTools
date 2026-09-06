# TangerineTools

TangerineTools 是一个本地优先的个人游戏管理工具。应用使用 Vite、React 19 与 Dexie.js 构建，不依赖后端；资料保存在浏览器 IndexedDB，通过 JSON 手动备份和迁移。

内置的「洛克王国世界」场景提供资料库、收集记录、统计视图、性格推荐、孵蛋推荐和精灵扫描。用户也可以创建其他游戏场景，使用通用的资料库、收集记录与统计视图。照片和设备管理由独立的 TangerinePhotoAssistant 负责，阅读功能由独立的 [TangerineReadingCompanion](https://github.com/Manamiiii/TangerineReadingCompanion) 负责。

## 开发

需要 Node.js `>=20.19.0`。

```bash
npm install
npm run dev
```

本地开发服务固定使用 `http://localhost:5188`；端口被占用时会直接报错，避免与其他工程混用。

常用检查：

| 命令 | 用途 |
|---|---|
| `npm run lint` | 静态检查 |
| `npm test` | 领域与回归测试 |
| `npm run build` | 生产构建 |
| `npm run check:nature` | 生成并检查性格推荐校准报告 |
| `npm run check:scanner:templates` | 检查扫描模板 |
| `npm run apply:scanner:templates` | 显式写入扫描模板 |
| `npm run sync:breeding` | 同步繁育资料 staging |
| `npm run check:official-announcements` | 检查官方版本 / 平衡公告并生成人工复核报告 |
| `npm run sync:bwiki:staging` | 同步 BWiki 基础 staging |
| `npm run sync:bwiki:details` | 同步 BWiki 详情 staging |
| `npm run preview:bwiki` | 构建 BWiki 发布预览 |
| `npm run check:bwiki:preset` | dry-run 检查正式预置差异 |
| `npm run apply:bwiki:preset` | 显式应用正式预置 |

## 数据边界

- 数据库名为 `tangerine-tools`，Dexie schema 保持 v1。
- 全量导入按稳定 id 合并：同 id 覆盖，文件未包含的本地记录保留。
- 洛克王国正式资料只通过版本化 BWiki staging、preview、apply 流程发布。
- 首页仅在检测到阅读数据时显示「迁移阅读数据」，生成可由 Tangerine Reading Companion 直接导入的专用 JSON。迁移导出不会清理 TangerineTools 中的任何记录。
- 模型连接地址与模型 ID 保存在 `localStorage`，API Key 仅保存在 `sessionStorage`，不进入 Dexie 或备份文件。

完整存储、导入和兼容语义见 [`docs/data-sync.md`](docs/data-sync.md)。

## 目录

```text
docs/                         当前能力、数据源与专项规则
public/presets/               洛克王国运行时正式预置
scripts/bwiki/                官方公告审计与 BWiki staging / preview / apply
scripts/nature/               性格推荐校准
scripts/rock-kingdom-scanner/ 扫描模板维护
scripts/tests/                自动化回归测试
src/components/               场景和通用工具界面
src/features/                 OCR、模型与洛克王国专项能力
src/hooks/                    异步操作状态与收集表初始化
src/db/                       Dexie、播种、导入导出与迁移
src/presets/                  场景结构定义
```

## 维护文档

- [`docs/system-capabilities.md`](docs/system-capabilities.md)：产品范围和已实现能力。
- [`docs/data-sync.md`](docs/data-sync.md)：Dexie、备份、导入与阅读迁移兼容。
- [`docs/data-sources/bwiki-pipeline.md`](docs/data-sources/bwiki-pipeline.md)：正式资料发布流程。
- [`docs/data-sources/bwiki-field-mapping.md`](docs/data-sources/bwiki-field-mapping.md)：字段转换、稳定 id 与校验门槛。
- [`docs/data-sources/research-sources.md`](docs/data-sources/research-sources.md)：玩家资料研究边界。
- [`docs/wuhui-huaxia/catalog.md`](docs/wuhui-huaxia/catalog.md)：无悔华夏名臣资料、个人收集模型与来源约束。
- [`docs/nature/rules.md`](docs/nature/rules.md)：性格推荐规则。
- [`docs/nature/single-creature-template.md`](docs/nature/single-creature-template.md)：单精灵审计模板。
- [`docs/nature/open-issues.md`](docs/nature/open-issues.md)：待确认规则问题。
- [`docs/nature/confirmed-results.md`](docs/nature/confirmed-results.md)：确认结论与回归基线。
- [`docs/rock-kingdom/scanner.md`](docs/rock-kingdom/scanner.md)：扫描器契约。
- [`docs/rock-kingdom/scanner-baseline.md`](docs/rock-kingdom/scanner-baseline.md)：扫描回归基线。
- [`docs/model-provider-setup.md`](docs/model-provider-setup.md)：洛克王国模型服务配置。

## 发布预置

正式资料写入需要显式确认：

```bash
# PowerShell
$env:BWIKI_PRESET_OVERWRITE='CONFIRM_BWIKI_PRESET'
npm run apply:bwiki:preset
```

不提供云同步、账号体系、战斗模拟、PVP 自动化或属性克制系统。
