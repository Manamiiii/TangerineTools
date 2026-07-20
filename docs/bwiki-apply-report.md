# BWiki P4 显式覆盖检查报告

生成时间：2026-07-20T08:49:04.253Z

执行模式：**只读 dry-run，未覆盖 public presets**

## 覆盖摘要

| 预置 | 覆盖前 | 覆盖后 | 复用 id | 新增 id | 目标中不再包含的旧 id |
|---|---:|---:|---:|---:|---:|
| 精灵 | 496 | 592 | 467 | 125 | 29 |
| 技能 | 487 | 553 | 487 | 66 | 0 |

## 技能关系完整性

| 精灵 → 技能边数 | 技能 → 精灵边数 | 缺失 / 悬空引用 |
|---:|---:|---:|
| 29042 | 29042 | 0 |

## 旧 id 兼容审计

精灵目标中不再包含的旧 id：

- rock-creature-src-448
- rock-creature-src-017
- rock-creature-src-018
- rock-creature-src-019
- rock-creature-src-023
- rock-creature-src-024
- rock-creature-src-025
- rock-creature-src-029
- rock-creature-src-030
- rock-creature-src-031
- rock-creature-src-452
- rock-creature-src-455
- rock-creature-src-081
- rock-creature-src-082
- rock-creature-src-083
- rock-creature-src-151
- rock-creature-src-406
- rock-creature-src-407
- rock-creature-src-464
- rock-creature-src-217
- ……另有 9 条

技能目标中不再包含的旧 id：

- （无）

> 用户已确认精灵旧 id 对应新版数据，差异主要来自括号名称变化，可以接受。静态 preset 覆盖不会直接操作 IndexedDB；现有浏览器的 merge-by-id 迁移不会删除这些旧行或 owned / stock 引用。

## 旧模板审计

- NO.375 学院呱呱：冰封

> 无法在当前技能 staging 中确认的旧模板引用不会生成技能预置行。

## 实际覆盖前的运行时复核

- 新安装会直接读取覆盖后的完整预置。
- 已有浏览器的精灵迁移只插入新 id，并补齐已有行的空值 / 无效系别；不会删除上述 29 个旧 id，也不会覆盖用户非空自定义值。
- 当前技能迁移会对同 id 技能执行整行 `bulkPut`。在正式覆盖前，必须先把它调整为能区分“旧官方值”和“用户自定义值”的安全迁移，否则新版 BWiki 技能可能覆盖用户对已有技能行的自定义修改。

> 因此本报告确认的是静态预置覆盖命令与目标数据本身；当前仍不应执行正式覆盖。

## 输入指纹

| 文件 | SHA-256 |
|---|---|
| `scripts/data/bwiki/rockKingdomRows.preview.json` | `6f0d73c9ff8dfc21ef56432ba50e956cb4f0f8bbd0bb9be1f379595dc3680e41` |
| `scripts/data/bwiki/rockKingdomSkillRows.preview.json` | `46ec914f4f3718e6e89481ba70bd8ea3d6fd62e0a3626a6f495c2a378b48f2b4` |

## 安全边界

- dry-run 只写本报告，不修改 `public/presets/*`。
- 真正覆盖只能通过 `BWIKI_PRESET_OVERWRITE=CONFIRM_BWIKI_P4 npm run apply:bwiki:preset` 触发。
- 覆盖产物只保留 `id` / `values`，不会把 `previewMeta` 写入运行时预置。
- 命令不读取或写入 Dexie / IndexedDB，不删除 owned / stock 数据，也不改变 import/export 的 merge-by-id 语义。
