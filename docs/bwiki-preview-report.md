# BWiki 预置 preview 报告

生成时间：2026-07-17T08:16:14.705Z

> 本报告由 `npm run preview:bwiki` 生成。脚本只读取 BWiki staging / detail staging 与当前 public preset JSON，然后只写入 preview / 审计产物。它**不会**覆盖 `public/presets/*`，**不会**触碰 Dexie / 浏览器用户数据，也**不会**修改 UI 代码。

## 输入与输出

| 类型 | 数量 / 路径 |
|---|---:|
| BWiki 精灵 staging 行数 | 592 |
| BWiki 技能 staging 行数 | 553 |
| BWiki 详情 staging 行数 | 48 |
| 已读取当前 public 精灵预置行数 | 496 |
| 已读取当前 public 技能预置行数 | 487 |
| 精灵 preview 输出 | `scripts/data/bwiki/rockKingdomRows.preview.json`（592 行） |
| 技能 preview 输出 | `scripts/data/bwiki/rockKingdomSkillRows.preview.json`（553 行） |

## ID 复用摘要

| 精灵 id 策略 | 数量 |
|---|---:|
| no+name | 467 |
| new | 125 |

| 技能 id 策略 | 数量 |
|---|---:|
| name | 487 |
| new | 66 |

### 重复 preview id

精灵 preview 重复 id：

- （无）

技能 preview 重复 id：

- （无）

## 名称匹配与新增行

### 精灵改名匹配

- （无）

### 新增精灵 id

- NO.001 圣光迪莫 → rock-creature-bwiki-160c55fe2dfd
- NO.001 圣草迪莫 → rock-creature-bwiki-c8eff43cd094
- NO.001 圣火迪莫 → rock-creature-bwiki-f4b757003dc1
- NO.001 圣水迪莫 → rock-creature-bwiki-37e9e6d81a33
- NO.004 武斗酷猫 → rock-creature-bwiki-59478c4122d1
- NO.011 鸭吉吉国王（蓬松的样子） → rock-creature-bwiki-aef4b3565565
- NO.011 鸭吉吉国王（紧实的样子） → rock-creature-bwiki-951142913acd
- NO.011 鸭吉吉国王（急急急鸭） → rock-creature-bwiki-63c96d833ebf
- NO.011 鸭吉吉国王（等一等鸭） → rock-creature-bwiki-daa8e62d5a34
- NO.011 鸭吉吉国王（燃了鸭） → rock-creature-bwiki-e7acdd3351cd
- NO.011 鸭吉吉国王（起来鸭） → rock-creature-bwiki-b7c1550c108b
- NO.012 板板壳 → rock-creature-bwiki-bf820721eb70
- NO.013 咔咔壳 → rock-creature-bwiki-b44ab058ef4a
- NO.014 水泡壳 → rock-creature-bwiki-bde230d40211
- NO.018 雪绒鸟 → rock-creature-bwiki-836ff913b5bd
- NO.019 冬羽雀 → rock-creature-bwiki-9ab657c3a5f5
- NO.020 岚鸟 → rock-creature-bwiki-879f28cfa0d4
- NO.020 霜翼领主（春天的样子） → rock-creature-bwiki-753d7726c827
- NO.020 霜翼领主（夏天的样子） → rock-creature-bwiki-a18f6ca488b1
- NO.020 霜翼领主（秋天的样子） → rock-creature-bwiki-05cbc6efcbd5
- NO.024 石肤蜥 → rock-creature-bwiki-c4d9725d943a
- NO.025 石刺蜥 → rock-creature-bwiki-35640a657332
- NO.026 石冠王蜥 → rock-creature-bwiki-9e205d79234f
- NO.031 恶魔男爵 → rock-creature-bwiki-a9ef6a58771b
- NO.040 钻石蜗（西瓜碧玺的样子） → rock-creature-bwiki-ad9d45c9053a
- NO.040 钻石蜗（莲花刚玉的样子） → rock-creature-bwiki-8d998c0a14d8
- NO.040 钻石蜗（星彩榴石的样子） → rock-creature-bwiki-5207332f075e
- NO.040 钻石蜗（火山琉璃的样子） → rock-creature-bwiki-f9344957b33b
- NO.040 钻石蜗（蓝锥矿的样子） → rock-creature-bwiki-351cd585b64c
- NO.040 钻石蜗（烧蓝黄金的样子） → rock-creature-bwiki-7694d8d4d365
- NO.065 蹦蹦果（海神球形态） → rock-creature-bwiki-412274db18b2
- NO.065 蹦蹦果（彩玉球形态） → rock-creature-bwiki-3fc21b40590c
- NO.065 蹦蹦果（短毛球形态） → rock-creature-bwiki-fb2471c4fa4c
- NO.065 蹦蹦果（象牙球形态） → rock-creature-bwiki-4fbab58b5631
- NO.076 海盔虫 → rock-creature-bwiki-aecb348a0459
- NO.077 刺盔虫 → rock-creature-bwiki-35ea1fc47290
- NO.078 千棘盔 → rock-creature-bwiki-73bc337cb100
- NO.078 千棘海针（磨损的样子） → rock-creature-bwiki-51dbef10cb70
- NO.107 深渊罗隐 → rock-creature-bwiki-438112eb1a66
- NO.120 暮风隐者（金黄的样子） → rock-creature-bwiki-726f75f93dfd
- ……另有 85 项

### 新增技能 id

- 吹散 → rock-skill-bwiki-0345b3b68430
- 急中生智 → rock-skill-bwiki-47c7c54ae97a
- 友谊满溢 → rock-skill-bwiki-0704b006b9c1
- 缓一缓 → rock-skill-bwiki-2e93b7c29db0
- 养分回流 → rock-skill-bwiki-da3e5bff9e06
- 甜蜜陷阱 → rock-skill-bwiki-8768427d315c
- 撒花 → rock-skill-bwiki-0e48cf4279ac
- 丰收 → rock-skill-bwiki-fd4ab606cd29
- 补觉 → rock-skill-bwiki-e320ed19c7f0
- 花火 → rock-skill-bwiki-0b8360d04a9f
- 暖气 → rock-skill-bwiki-0f96dd20bc8f
- 焚身 → rock-skill-bwiki-fd147e99ca2c
- 野火 → rock-skill-bwiki-7e022e83de9b
- 叠浪 → rock-skill-bwiki-5db041ca67ee
- 沉溺 → rock-skill-bwiki-7bcc2eab9787
- 点亮 → rock-skill-bwiki-dc2da24c57f8
- 透镜实验 → rock-skill-bwiki-c353d25c51d4
- 六自由度 → rock-skill-bwiki-d04ecc8c896d
- 蒸汽进行曲 → rock-skill-bwiki-d657df99c9ff
- 轮班 → rock-skill-bwiki-6f8bf37188c3
- 锁芯 → rock-skill-bwiki-793f6471cbe1
- 铁蒺藜 → rock-skill-bwiki-d1b6d43bb062
- 过山车 → rock-skill-bwiki-eb19cfa844ae
- 绞轮 → rock-skill-bwiki-633ac0919428
- 扬尘 → rock-skill-bwiki-adf36cdc8b49
- 沙石阵 → rock-skill-bwiki-cc88c528e0c3
- 冷凝 → rock-skill-bwiki-0f0429d168bf
- 寒潮 → rock-skill-bwiki-a5c7f5af8d0e
- 冰裂 → rock-skill-bwiki-2422bbab87a1
- 雪原狩猎 → rock-skill-bwiki-38e8de53e58f
- 打喷嚏 → rock-skill-bwiki-9b4f5c48ec70
- 龙守望 → rock-skill-bwiki-e82c5a179535
- 惊雷 → rock-skill-bwiki-61a6d7324355
- 通电 → rock-skill-bwiki-b30e3f20f396
- 毒誓 → rock-skill-bwiki-fa2af22163f9
- 溶解 → rock-skill-bwiki-854e15b9053e
- 过敏原 → rock-skill-bwiki-e7431641bc9a
- 重金属粉尘 → rock-skill-bwiki-859cb8577a28
- 毒肽 → rock-skill-bwiki-f27004754a13
- 振翅 → rock-skill-bwiki-3aa6912bf755
- ……另有 26 项

## 字段冲突与缺口

### 特性冲突：筛选页 vs 详情页 staging

- （无）

### 种族值冲突：当前 public 预置 vs BWiki staging

- NO.024 石肤蜥（球球尾巴的样子）：bst 343 → 369
- NO.024 石肤蜥（球球尾巴的样子）：patk 54 → 61
- NO.024 石肤蜥（球球尾巴的样子）：matk 53 → 60
- NO.024 石肤蜥（球球尾巴的样子）：pdef 64 → 70
- NO.024 石肤蜥（球球尾巴的样子）：mdef 44 → 50
- NO.025 石刺蜥（球球尾巴的样子）：bst 458 → 493
- NO.025 石刺蜥（球球尾巴的样子）：patk 72 → 82
- NO.025 石刺蜥（球球尾巴的样子）：matk 71 → 80
- NO.025 石刺蜥（球球尾巴的样子）：pdef 85 → 94
- NO.025 石刺蜥（球球尾巴的样子）：mdef 59 → 66
- NO.026 石冠王蜥（球球尾巴的样子）：bst 572 → 615
- NO.026 石冠王蜥（球球尾巴的样子）：patk 90 → 102
- NO.026 石冠王蜥（球球尾巴的样子）：matk 89 → 100
- NO.026 石冠王蜥（球球尾巴的样子）：pdef 106 → 117
- NO.026 石冠王蜥（球球尾巴的样子）：mdef 74 → 83
- NO.030 恶魔叮：bst 427 → 452
- NO.030 恶魔叮：hp 86 → 90
- NO.030 恶魔叮：patk 112 → 100
- NO.030 恶魔叮：matk 44 → 42
- NO.030 恶魔叮：pdef 58 → 80
- NO.030 恶魔叮：mdef 43 → 56
- NO.031 叮叮恶魔：bst 535 → 576
- NO.031 叮叮恶魔：hp 108 → 117
- NO.031 叮叮恶魔：patk 140 → 125
- NO.031 叮叮恶魔：matk 55 → 53
- NO.031 叮叮恶魔：pdef 73 → 103
- NO.031 叮叮恶魔：mdef 54 → 73
- NO.035 幻影荆棘：bst 603 → 576
- NO.035 幻影荆棘：hp 125 → 113
- NO.035 幻影荆棘：pdef 72 → 66
- NO.035 幻影荆棘：mdef 134 → 125
- NO.044 丢丢（火山附近的样子）：bst 0 → 263
- NO.044 丢丢（火山附近的样子）：hp 0 → 47
- NO.044 丢丢（火山附近的样子）：patk 0 → 52
- NO.044 丢丢（火山附近的样子）：matk 0 → 11
- NO.044 丢丢（火山附近的样子）：pdef 0 → 38
- NO.044 丢丢（火山附近的样子）：mdef 0 → 37
- NO.044 丢丢（火山附近的样子）：spd 0 → 78
- NO.045 卡卡虫（火山附近的样子）：bst 0 → 350
- NO.045 卡卡虫（火山附近的样子）：hp 0 → 62
- ……另有 382 项

### 系别冲突：当前 public 预置 vs BWiki staging

- NO.022 幻灵菇：ghost、grass → grass、ghost
- NO.023 幻影灵菇：ghost、grass → grass、ghost
- NO.030 恶魔叮：dark、flying → flying、dark
- NO.031 叮叮恶魔：dark、flying → flying、dark
- NO.035 幽影树：ghost、grass → grass、ghost
- NO.035 幻影荆棘：ghost、grass → grass、ghost
- NO.044 丢丢（火山附近的样子）：grass → grass、fire
- NO.044 丢丢（沙地附近的样子）：grass → grass、earth
- NO.044 丢丢（雪山附近的样子）：grass → grass、ice
- NO.045 卡卡虫（火山附近的样子）：grass → grass、fire
- NO.045 卡卡虫（沙地附近的样子）：grass → grass、earth
- NO.045 卡卡虫（雪山附近的样子）：grass → grass、ice
- NO.046 卡瓦重（火山附近的样子）：grass → grass、fire
- NO.046 卡瓦重（沙地附近的样子）：grass → grass、earth
- NO.046 卡瓦重（雪山附近的样子）：grass → grass、ice
- NO.057 梦游（穿星星睡衣的样子）：ghost → light、ghost
- NO.058 梦悠悠（穿星星睡衣的样子）：ghost → light、ghost
- NO.059 兽花蕾：light、grass → grass、light
- NO.080 小星光（月光能量的样子）：electric → light、electric
- NO.081 星光狮（月光能量的样子）：electric → light、electric
- NO.088 乖乖鹄：flying、water → water、flying
- NO.089 蓝珠天鹅：flying、water → water、flying
- NO.090 翠顶夫人：flying、water → water、flying
- NO.092 锤头鹳：flying、water → water、flying
- NO.096 咔咔羽毛：flying、normal → normal、flying
- NO.097 咔咔雀：flying、normal → normal、flying
- NO.098 咔咔鸟：flying、normal → normal、flying
- NO.099 小草虫：bug、grass → grass、bug
- NO.100 草衣虫：bug、grass → grass、bug
- NO.101 花衣蝶：bug、grass → grass、bug
- NO.102 绿翼鸟：cute、flying → flying、cute
- NO.103 魔翼鸟：cute、flying → flying、cute
- NO.104 魔眷鸟：cute、flying → flying、cute
- NO.123 忽幽狸：ghost、poison → poison、ghost
- NO.124 影狸：ghost、poison → poison、ghost
- NO.125 多多：poison、earth → earth、poison
- NO.126 多啦多：poison、earth → earth、poison
- NO.127 古啦多：poison、earth → earth、poison
- NO.137 呼呼猪：ice、earth → earth、ice
- NO.138 獠牙猪：ice、earth → earth、ice
- ……另有 58 项

### 未识别精灵系别

- （无）

### 未识别技能系别

- （无）

### 未识别技能类型

- （无）

## 技能关系覆盖率

| 详情技能卡总数 | 已匹配技能卡 | 覆盖率 | 未匹配技能名数量 |
|---:|---:|---:|---:|
| 2272 | 2272 | 100.00% | 0 |

- （无）

## 蛋组 / 繁育谱系

- Preview 会把 BWiki 筛选页的 `eggGroupLabel` 写入现有 `eggGroups` 字段，作为候选数组。
- 当匹配到当前 public 预置行时，preview 会保留现有 `speciesGroup`；本批不推断新的繁育谱系。

## 图片来源摘要

| 图片来源 | 数量 |
|---|---:|
| patchwiki | 532 |
| empty | 40 |
| existing-public-preset | 20 |

## 安全声明

- `public/presets/rockKingdomRows.json` 和 `public/presets/rockKingdomSkillRows.json` 只作为形状 / id 参考被读取。
- 未触碰 Dexie schema version、迁移逻辑、导入 / 导出行为、用户 `owned` 记录或用户 `stock` 记录。
- 本 preview 是审计产物。后续如需替换 public presets，必须另行审阅显式覆盖命令。
