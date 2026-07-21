# BWiki 数据生产线

本目录包含洛克王国世界正式预置的抓取、转换、审阅和发布实现。应用运行时不会执行这里的脚本，也不会联网读取 BWiki。

## 目录

```text
scripts/bwiki/
├── sync-staging.mjs       # 精灵、技能、蛋 / 果实页面 → staging
├── sync-details.mjs       # 精灵详情页 → detail staging
├── sync-breeding.mjs      # 孵蛋组别页 → breeding staging
├── build-preview.mjs      # staging + 当前正式预置 → preview
├── apply-preset.mjs       # dry-run 校验 / 显式写入正式预置
├── lib/                   # 仅供本管线使用的 Node 适配层
└── data/
    ├── staging/           # 版本化源快照
    └── preview/           # 版本化发布候选
```

## 标准流程

```bash
npm run sync:bwiki:staging
npm run sync:bwiki:details
npm run sync:breeding
npm run preview:bwiki
npm run check:bwiki:preset
```

用户确认审计结果后，才可运行：

```bash
BWIKI_PRESET_OVERWRITE=CONFIRM_BWIKI_PRESET npm run apply:bwiki:preset
```

Windows PowerShell 可先设置同名环境变量，再执行 npm 命令。

## 安全边界

- sync、preview 和 dry-run 不修改 `public/presets/*`。
- apply 只写精灵、技能和三方迁移清单，不访问或修改浏览器 IndexedDB。
- 正式预置继续位于 `public/presets/`，不复制到本目录。
- 稳定 id、用户非空自定义值、owned / stock 引用兼容性必须保持。
- 字段来源和映射规则见 [`../../docs/data-sources/`](../../docs/data-sources/)。
