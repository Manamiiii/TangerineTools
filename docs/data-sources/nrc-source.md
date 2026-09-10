# NRC BWiki 来源与候选采集

## 来源与署名

新版来源为玩家独立维护的 [洛克王国：世界 Wiki（NRC BWIKI）](https://wiki.biligame.com/nrc/首页)，维护者 sizau。其内容不代表游戏官方立场。

根据 [站点声明](https://wiki.biligame.com/nrc/洛克王国世界:站点声明)，除另有标注外，原创文字及有权授权的资料整理成果适用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans)。使用时保留站点、原页面、适用作者信息、许可链接和修改说明；受许可约束的改编成果以相同许可共享。各页面作者与贡献者按原页面历史保留，维护者身份不代替全部作者身份。

游戏角色、立绘、图标、截图、音视频、标识等素材权利归魔方工作室、腾讯游戏及相应权利人；其他第三方内容归各自权利人。这些素材不适用上述 CC 许可。资料许可不被扩展声明为游戏素材、项目代码或个人收集记录的许可。

运行时清单 `src/presets/rockKingdomSources.json` 按实际发布数据逐行记录来源、页面链接与原名称，并绑定正式内容指纹。应用底部“数据来源与版权”和资料详情来源链接读取该清单。当前正式预置对应 rocom 来源；NRC 候选署名保存在独立 staging。发布同时更新来源清单，不提前将旧数据标为 NRC 数据。

`npm run check:bwiki:sources` 校验清单；`-- --write` 可依据与正式值完全一致的 preview 重建来源元数据。NRC 发布后使用 `-- --source=nrc`。来源批次表示 preview 版本或生成时间，实际页面采集时间见 staging provenance。

## 入口与字段

| 页面 | 内容 | 解析依据 |
|---|---|---|
| [精灵图鉴](https://wiki.biligame.com/nrc/精灵图鉴) | 名称、编号、系别、首领分类、异色与实际图片 | `npc-card`；`data-form` 包含 `lord` 表示首领 |
| [技能列表](https://wiki.biligame.com/nrc/技能列表) | 图片、名称、系别、分类、能耗、威力、效果 | `nrc-skill-table-row` 七列 |
| [孵蛋组别查询](https://wiki.biligame.com/nrc/孵蛋组别查询) | 蛋组与仅雌性标记 | `nrc-egg-card`；候选中“未发现”映射为“无法孵蛋” |
| 图鉴实际详情链接 | 六维、特性、技能来源与进化分支 | `data-pet-id` 必须匹配；六维读取 `data-val` 并检查总和 |

静态详情的 0 可能只是动画占位。解析器读取页面实际属性，不运行页面脚本，不把缺失值猜成 0。技能 `level` / `machine` / `blood` 来源保留在详情 staging，正式引用口径需要审阅。进化分支保存在 `evolutionBranches`，preview 使用包含当前名称的首条分支；缺少可靠分支时不宣称繁育谱系已验证。仅雌性标记是审计信息，尚未接入孵蛋规则。

## 命令与缓存

```powershell
npm run sync:bwiki:nrc -- --version=S4-2026-09-10
npm run sync:bwiki:nrc -- --version=S4-2026-09-10 --limit=all
npm run sync:bwiki:nrc -- --version=S4-2026-09-10 --offline
npm run preview:bwiki:nrc
npm run check:bwiki:nrc
```

先处理三个聚合页，再顺序处理缺失详情。聚合数量不得低于已发布基线，否则先调查页面截断或移除记录。默认最多请求 24 个缺失详情，新请求间隔至少 2 秒，超时 25 秒。首次网络失败停止后续请求，成功快照继续可读；不切换客户端或代理重试，不绕过验证码或访问限制。缺失/解析失败使同步返回非零状态，并生成候选缺口。

缓存默认在 Git 忽略的 `artifacts/bwiki/nrc-snapshots/<version>/`。各 JSON 包含原 HTML、来源 URL、版本、时间、采集方式与 SHA-256。版本、地址或指纹不匹配时拒绝复用。更新批次使用新 `--version`，不跨版本复用成功缓存。`--snapshots=目录` 可指定目录；失败请求记录在该目录的 `last-failure.json`。

普通浏览器或维护者提供的同版公开 HTML 可以离线接入：

```powershell
npm run import:bwiki:nrc -- --version=S4-2026-09-10 --key=skills --file=技能列表.html
npm run import:bwiki:nrc -- --version=S4-2026-09-10 --key=pet_000004 --file=迪莫.html
npm run sync:bwiki:nrc -- --version=S4-2026-09-10 --offline
```

聚合页键为 `creatures` / `skills` / `breeding`，详情键来自该版图鉴 sourceId。导入先解析校验再保存；时间表示本地导入时间，不伪称网站修订时间。导入不直接更新 staging 或正式数据。

## 产物与发布

- staging：`scripts/bwiki/data/nrc/staging/`，包含精灵、技能、蛋组及成功详情，与 rocom 独立。
- preview：`scripts/bwiki/data/nrc/preview/`。缺详情的旧行可能保留旧技能引用，新行未知数值为空，均是未完成候选。
- 报告：`artifacts/bwiki/nrc/source-report.json` 与 `artifacts/bwiki/nrc/preview-report.md`。
- preview 记录版本、输入指纹与发布阻塞；发布检查两份 preview 的版本一致、输入未变，且无发布阻塞。不能通过删除提示文字或设置覆盖口令绕过完整性审阅。
- 适配范围为聚合页及详情读取、预览和拦截；技能来源口径、改名/编号/异色冲突、完整进化与繁育字段须完成审阅。生成器为此保留发布阻塞，不提供自动批准入口。
- 正式数据仍经过版本化 staging → preview → 显式 apply。用户确认针对具体审阅结果，不继承其他版本的旧确认。

## 已确认事实

2026-09-10，用户在游戏中核对迪莫“超导”并确认 NRC 页面正确：威力 90、基础能耗 3、迸发减耗 2。仅确认数据事实，不批准广泛性格规则变更或跳过发布流程。

## 回归

`scripts/tests/fixtures/nrc/*.html` 是 2026-09-10 上述来源页面的精简片段，删除样式、导航及不相关记录，验证真实嵌套、动画属性和身份校验。适用署名许可按本文保留。运行 `node --test scripts/tests/nrc-pipeline.test.mjs` 或 `npm test`。parse5 仅用于开发期解析，不增加应用后端。
