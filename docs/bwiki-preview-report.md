# BWiki 预置 preview 报告

生成时间：2026-07-21T03:24:04.543Z

> 本报告由 `npm run preview:bwiki` 生成。脚本只读取 BWiki staging / detail staging 与当前 public preset JSON，然后只写入 preview / 审计产物。它**不会**覆盖 `public/presets/*`，**不会**触碰 Dexie / 浏览器用户数据，也**不会**修改 UI 代码。

## 输入与输出

| 类型 | 数量 / 路径 |
|---|---:|
| BWiki 精灵 staging 行数 | 592 |
| BWiki 技能 staging 行数 | 553 |
| BWiki 详情 staging 行数 | 592 |
| 已读取当前 public 精灵预置行数 | 592 |
| 已读取当前 public 技能预置行数 | 553 |
| 已读取孵蛋补充快照行数 | 592 |
| 精灵 preview 输出 | `scripts/data/bwiki/rockKingdomRows.preview.json`（592 行） |
| 技能 preview 输出 | `scripts/data/bwiki/rockKingdomSkillRows.preview.json`（553 行） |

## ID 复用摘要

| 精灵 id 策略 | 数量 |
|---|---:|
| no+name | 592 |

| 技能 id 策略 | 数量 |
|---|---:|
| name | 553 |

### 重复 preview id

精灵 preview 重复 id：

- （无）

技能 preview 重复 id：

- （无）

## 名称匹配与新增行

### 精灵改名匹配

- （无）

### 新增精灵 id

- （无）

### 新增技能 id

- （无）

### 当前稳定精灵 id 未进入 preview

- （无）

> 用户已确认这些旧行均能在新版数据中找到对应精灵，差异主要来自“（本来的样子）”等括号文本消失。它们不再阻塞 P4；现有浏览器仍按 merge-by-id 保留旧行和 owned 引用，覆盖命令不得主动删除或重写用户引用。

## 字段变化摘要

### 精灵字段

| 字段 | 变化行数 |
|---|---:|
| image | 0 |
| element | 0 |
| form | 0 |
| bst | 0 |
| hp | 0 |
| patk | 0 |
| matk | 0 |
| pdef | 0 |
| mdef | 0 |
| spd | 0 |
| shiny | 0 |
| traitName | 0 |
| traitIcon | 0 |
| traitDesc | 0 |
| skillRefs | 0 |
| eggGroups | 125 |
| speciesGroup | 125 |
| evolutionLine | 0 |
| eggImage | 0 |
| fruitImage | 0 |

### 技能字段

| 字段 | 变化行数 |
|---|---:|
| image | 0 |
| element | 0 |
| category | 0 |
| power | 0 |
| cost | 0 |
| priority | 0 |
| effect | 0 |
| learnerRefs | 0 |

## 字段冲突与缺口

### 特性冲突：筛选页 vs 详情页 staging

- （无）

### 种族值冲突：当前 public 预置 vs BWiki staging

- （无）

### 系别顺序变化：当前 public 预置 vs BWiki staging

- （无）

### 系别实质变化：当前 public 预置 vs BWiki staging

- （无）

> 用户已确认 BWiki 系别变化符合预期；技能与精灵系别继续以 BWiki staging 为新版本主来源。

### 空值 / 非数字种族值

- （无）

### 未识别精灵系别

- （无）

### 未识别技能系别

- （无）

### 未识别技能类型

- （无）

## 技能关系覆盖率

| 详情技能卡总数 | 已匹配技能卡 | 覆盖率 | 未匹配技能名数量 |
|---:|---:|---:|---:|
| 29063 | 29063 | 100.00% | 0 |

- （无）

### 旧模板未确认引用

- NO.375 学院呱呱：冰封

> 这些名称来自旧模板源码，但不在当前 BWiki 技能 staging 中；preview 不生成虚构技能行，也不把它们计入详情技能卡匹配率。

### Preview 全量双向一致性

| 有技能引用的精灵 | 精灵 → 技能边数 | 技能 → 精灵边数 | 缺反向关系 | 缺正向关系 | 悬空技能引用 | 悬空精灵引用 |
|---:|---:|---:|---:|---:|---:|---:|
| 592 / 592 | 29042 | 29042 | 0 | 0 | 0 | 0 |

> 详情技能卡覆盖率只衡量已抓取详情样本中的技能名能否匹配；全量双向一致性用于检查最终 preview 中的 `skillRefs` / `learnerRefs` 是否互相对应。

## 蛋组 / 繁育谱系

- BWiki 精灵筛选页的 `data-param8` 是归属赛季，preview 只把它保留在 `previewMeta.seasonLabel` 供审计，不写入蛋组。
- 已匹配精灵保留当前 public 预置中的 `eggGroups` / `speciesGroup`；空值或新增精灵只从版本化的孵蛋补充快照按“编号 + 名称”或唯一名称安全补齐。

## 图片来源摘要

| 图片来源 | 数量 |
|---|---:|
| patchwiki | 592 |

缺少精灵图片的行：

- （无）

## P4 准入判断

当前 preview 未发现自动阻塞项，可以进入 P4 显式覆盖命令设计；正式覆盖仍需用户明确授权。

## 安全声明

- `public/presets/rockKingdomRows.json` 和 `public/presets/rockKingdomSkillRows.json` 只作为形状 / id 参考被读取。
- 未触碰 Dexie schema version、迁移逻辑、导入 / 导出行为、用户 `owned` 记录或用户 `stock` 记录。
- 本 preview 是审计产物。后续如需替换 public presets，必须另行审阅显式覆盖命令。
