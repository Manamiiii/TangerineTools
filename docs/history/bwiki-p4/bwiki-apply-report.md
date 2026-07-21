# BWiki P4 显式覆盖检查报告

生成时间：2026-07-21T06:40:51.229Z

执行模式：**已显式覆盖**

## 覆盖摘要

| 预置 | 覆盖前 | 覆盖后 | 复用 id | 新增 id | 目标中不再包含的旧 id |
|---|---:|---:|---:|---:|---:|
| 精灵 | 592 | 592 | 592 | 0 | 0 |
| 技能 | 553 | 553 | 553 | 0 | 0 |

## 技能关系完整性

| 精灵 → 技能边数 | 技能 → 精灵边数 | 缺失 / 悬空引用 |
|---:|---:|---:|
| 29042 | 29042 | 0 |

## 旧 id 兼容审计

精灵目标中不再包含的旧 id：

- （无）

技能目标中不再包含的旧 id：

- （无）

> 静态 preset 覆盖不会直接操作 IndexedDB。历史上未进入新版预置的 29 个旧 id 仍保留在已有浏览器中，以兼容 owned / stock 引用；资料库、引用选择、性格推荐和统计视图会在对应新版行存在时隐藏这些旧概括行。

## 旧模板审计

- NO.375 学院呱呱：冰封

> 无法在当前技能 staging 中确认的旧模板引用不会生成技能预置行。

## 实际覆盖前的运行时复核

- 新安装会直接读取覆盖后的完整预置。
- 已有浏览器会读取版本化迁移清单；字段为空、值无效，或当前值的 SHA-256 与旧官方值匹配时才更新为新版预置值。
- 当前值不匹配任何旧官方指纹时视为用户自定义，精灵和技能字段都保持不变。
- 迁移不会删除历史旧 id、用户新增行或 owned / stock 引用；重复显示由只读归并视图处理。

| 迁移清单 | 涉及行数 | 涉及字段数 |
|---|---:|---:|
| 精灵 | 592 | 3065 |
| 技能 | 487 | 1615 |

迁移清单 preview：`scripts/data/bwiki/rockKingdomPresetMigration.preview.json`

## 输入指纹

| 文件 | SHA-256 |
|---|---|
| `scripts/data/bwiki/rockKingdomRows.preview.json` | `317c72d4041aa287ecb6c77a20a3ded7823d663939eaac3323337307f1127efa` |
| `scripts/data/bwiki/rockKingdomSkillRows.preview.json` | `cfee170dc127bade7acd046bfe3de25e0825a22be726db49483a4e63373fe18d` |

## 安全边界

- dry-run 只写本报告，不修改 `public/presets/*`。
- 真正覆盖只能通过 `BWIKI_PRESET_OVERWRITE=CONFIRM_BWIKI_P4 npm run apply:bwiki:preset` 触发。
- 覆盖产物只保留 `id` / `values`，不会把 `previewMeta` 写入运行时预置。
- 正式覆盖会同时发布 `public/presets/rockKingdomPresetMigration.json`，使已有浏览器能三方合并旧官方值、新官方值和用户当前值。
- 命令不读取或写入 Dexie / IndexedDB，不删除 owned / stock 数据，也不改变 import/export 的 merge-by-id 语义。
