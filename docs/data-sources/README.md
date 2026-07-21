# 数据来源索引

本目录集中维护 TangerineTools 的外部数据来源、生产链路和字段血缘。系统级 IndexedDB、导入导出与预置迁移语义仍由 [`../data-sync.md`](../data-sync.md) 维护。

## 当前来源分级

1. 用户 IndexedDB / 导入 JSON：用户资料和手工修正，预置迁移不得覆盖非空自定义值。
2. `public/presets/*.json`：浏览器运行时读取的正式版本化预置。
3. `scripts/bwiki/data/staging/*.json`：从 BWiki 页面解析并提交版本控制的源快照。
4. `scripts/bwiki/data/preview/*.json`：对齐运行时结构、供发布前审阅的候选产物。
5. 外部攻略 / 社区资料：只用于性格定位和机制核对，不覆盖正式资料字段。

## 当前正式来源

洛克王国世界的正式生产线是 BWiki 页面快照，不得引入其他预置来源或把抓取逻辑放入浏览器运行时。

- [`bwiki-pipeline.md`](bwiki-pipeline.md)：页面清单、目录、刷新与显式发布流程。
- [`bwiki-field-mapping.md`](bwiki-field-mapping.md)：字段来源、转换、稳定 id 和验收门槛。
- [`../../scripts/bwiki/README.md`](../../scripts/bwiki/README.md)：脚本入口、目录职责和安全边界。

新增正式数据来源时，应新增独立子目录或管线文档，不要把抓取逻辑并入浏览器运行时代码。
