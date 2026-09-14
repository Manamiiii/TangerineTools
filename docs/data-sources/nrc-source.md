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

静态详情的 0 可能只是动画占位。解析器读取页面实际属性，不运行页面脚本，不把缺失值猜成 0。技能 `level` / `machine` / `blood` 来源保留在详情 staging，正式引用口径需要审阅。进化节点的 `name` 优先取完整链接标题；无 href 的 `mw-selflink` 取当前已校验 sourceId 的图鉴名称，原展示文字保存在 `displayName`。不通过删除括号后缀猜测形态身份。进化分支保存在 `evolutionBranches`，preview 使用包含当前完整名称的首条分支；缺少可靠分支时保留 `evolutionReviewRequired`，分支解析成功不代表繁育谱系已完成审阅。仅雌性标记是审计信息，尚未接入孵蛋规则。

## 命令与缓存

```powershell
npm run sync:bwiki:nrc -- --version=S4-2026-09-10
npm run sync:bwiki:nrc -- --version=S4-2026-09-10 --limit=all --interval=60
npm run sync:bwiki:nrc -- --version=S4-2026-09-10 --offline
npm run audit:bwiki:nrc
npm run preview:bwiki:nrc
npm run check:bwiki:nrc
```

先处理三个聚合页，再顺序处理缺失详情。聚合数量不得低于已发布基线，否则先调查页面截断或移除记录。默认最多请求 24 个缺失详情，每次新请求前等待 30 秒，超时 25 秒。`--interval=秒数` 支持 30–3600 秒；例如 `--interval=60` 每次新请求前等待一分钟。缓存读取不等待、不请求网络。命令逐次输出等待的页面，成功快照立即落盘，重新运行只补缺失快照。首次网络失败停止后续请求，成功快照继续可读；不切换客户端或代理重试，不绕过验证码或访问限制。缺失/解析失败使同步返回非零状态，并生成候选缺口。

缓存默认在 Git 忽略的 `artifacts/bwiki/nrc-snapshots/<version>/`。各 JSON 包含原 HTML、来源 URL、版本、时间、采集方式与 SHA-256。版本、地址或指纹不匹配时拒绝复用。更新批次使用新 `--version`，不跨版本复用成功缓存。`--snapshots=目录` 可指定目录；失败请求记录在该目录的 `last-failure.json`。

普通浏览器或维护者提供的同版公开 HTML 可以离线接入：

```powershell
npm run import:bwiki:nrc -- --version=S4-2026-09-10 --key=skills --file=技能列表.html
npm run import:bwiki:nrc -- --version=S4-2026-09-10 --key=pet_000004 --file=迪莫.html
npm run sync:bwiki:nrc -- --version=S4-2026-09-10 --offline
```

聚合页键为 `creatures` / `skills` / `breeding`，详情键来自该版图鉴 sourceId。导入先解析校验再保存；普通 HTML 的时间表示本地导入时间，不伪称网站修订时间。已有相同 HTML 的快照直接复用，已有不同内容或损坏快照则拒绝覆盖；更新内容使用新批次。导入不直接更新 staging 或正式数据。

### 浏览器详情采集

`scripts/bwiki/lib/browser-capture.mjs` 提供交互式浏览器工具和本地采集器共用的无依赖校验函数 `captureBrowserDetail`，不自行启动浏览器、访问网络或读取登录信息。它接受 `expected`（同批次图鉴提供的 `version`、`sourceId`、`sourceUrl`）和三个回调：

- `readMetadata()`：通过浏览器工具只读 DOM，返回实际 `sourceUrl`、`sourceId`、`.roco-dex` 的 `rootCount`、`characters` 和布尔 `ready`。就绪依据为文档非 loading；内容完整性还需通过后续双遍比对和离线解析。`data-nrc-pets-ready` 属于交互增强标记，静态内容完整的页面也可能没有它，不作为取数前提。
- `readChunk(start, end)`：通过工具读取该根节点 `outerHTML.slice(start, end)`；下标和长度均为 JavaScript UTF-16 单元。
- `pause(ms)`：交互工具宿主中的等待，不操作页面。

调用前按实际图鉴链接进入目标，读取页面状态确认导航完成；图鉴初始化和布局稳定前不连续点击。新页面访问保持至少 30 秒间隔，可用 60 秒进一步放慢；这只是请求节奏，不保证网站不会限流。隐藏页签内的链接需先通过 UI 展开页签；链接选择器限定在图鉴卡片或进化链内，避免与隐藏菜单同名链接冲突。校验函数检查唯一根节点、精确 URL 和 sourceId，间隔两秒确认长度稳定，按每段最多 50,000 字符连续读两遍并逐字比较；截断标记、身份或 DOM 变化均拒绝产物。分段读取只访问已加载 DOM，不产生额外采集请求。

成功返回的记录按 `<sourceId>.capture.json` 逐页保存至 Git 忽略的独立批次目录，采用独占创建避免覆盖；停止后先导入和核对已成功文件，再补缺失页面。工具中断、页面未就绪或校验失败时停止批次并记录原因；先检查实际页面，不自动连续重试。遇到 567、验证码或访问限制时停止访问，不切换客户端、代理或模拟安全参数绕过。

```powershell
npm run import:bwiki:nrc -- --version=S4-2026-09-11-browser-validation --key=creatures --file=图鉴.html
npm run import:bwiki:nrc -- --version=S4-2026-09-11-browser-validation --key=pet_000004 --capture=pet_000004.capture.json
```

`--capture` 与 `--file` 互斥，只支持精灵详情。导入再次检查版本、来源、长度与精灵解析，并保留实际浏览器采集时间；快照方式为 `browser-dom-verified`，缓存继续使用 SHA-256 检查。记录是本地流程证据，不是网站签名或修订版本证明。聚合图鉴也必须来自该批次，禁止用旧批次图鉴替代；浏览器采样不得伪装为全量同步，样本数量不代表全目录稳定性。

## 产物与发布

### 本地浏览器点击命令

```powershell
npm run collect:bwiki:browser -- --version=S4-2026-09-11-browser-full --limit=1
npm run collect:bwiki:browser -- --version=S4-2026-09-11-browser-full --limit=all --interval=60
```

命令使用开发依赖 `playwright-core` 和本机 Chrome，打开独立可见窗口，不复用日常浏览器的用户目录、登录状态或扩展。图鉴和技能缓存必须预先存在；启动时读取当前图鉴并与同批次缓存逐项核对，变化时停止。它在同一标签中点击实际图鉴卡片链接进入详情，等待正文 DOM 与初始动画，再进行身份校验、双遍分段读取和离线解析。每页校验成功后保存至同版快照目录，返回图鉴后继续下一页；点击详情和返回图鉴前分别等待，默认各 60 秒，允许 30–3600 秒，默认每批 24 页。浏览器及本地解析不调用模型 API，不通过 Node fetch 采集详情。

命令只写 Git 忽略的快照和 `browser-captures/` 原始采集记录，不改 staging、preview 或正式数据。`browser-status.json` 记录进度，`browser-last-failure.json` 记录失败。首次导航错误、HTTP 错误、访问验证、身份不符或内容变化即停止，无自动重试、代理切换或安全参数模拟。退出时关闭专用窗口。不要与 HTTP 采集器同时写同一批次；`browser-collector.lock` 防止重复启动浏览器采集器。若进程被强制结束而遗留锁，先确认锁内 PID 已结束，再移除该锁后续跑，保留成功缓存。

点击卡片前若出现站点版权欢迎弹层，命令通过其中的“我知道了”按钮确认，并等待弹层关闭。只处理 `.nrc-site-welcome` 内的已知按钮；其他遮挡或访问验证仍使批次停止。

详情读取前先等待目标 `data-pet-id` 的正文出现，避免地址先变化时误读上一页；随后监听正文 DOM 变化，等待连续十秒无变化，最长等待六十秒；持续变化则停止。就绪后仍执行独立的身份检查、两秒稳定性检查和双遍逐字比对，不对采集内容删除动画属性或改写数值。

采集后运行 `sync:bwiki:nrc -- --version=同版 --offline`、`audit:bwiki:nrc`、`preview:bwiki:nrc` 和 `check:bwiki:nrc`；缺详情或未完成审阅仍阻止发布。

`npm run audit:bwiki:nrc` 只读取四份同版 staging 与正式精灵、技能 JSON，在 `artifacts/bwiki/nrc/diff-report.json` 和 `.md` 生成字段级差异。报告包含输入指纹、来源、具体旧值与新值、技能变化的正式技能池关联范围，以及详情和图片缺口；不访问网络，不改 staging、preview 或正式资料。缺详情时不使用旧预置或聚合页残留数值冒充已验证详情。

身份比较以唯一名称匹配；未匹配名称即使编号相同也只列作人工候选，不自动认定改名或复用 ID。技能“防御”沿用 preview 的 `status` 映射单列展示；效果文字差异不自动定性为平衡调整。报告成功表示比较已完成，不表示采集完整或允许发布，无法代替公告核对和发布检查。

- staging：`scripts/bwiki/data/nrc/staging/`，包含精灵、技能、蛋组及成功详情，与 rocom 独立。
- preview：`scripts/bwiki/data/nrc/preview/`。缺详情的旧行可能保留旧技能引用，新行未知数值为空，均是未完成候选。
- 报告：`artifacts/bwiki/nrc/source-report.json` 与 `artifacts/bwiki/nrc/preview-report.md`。
- preview 记录版本、输入指纹与发布阻塞；发布检查两份 preview 的版本一致、输入未变，且无发布阻塞。不能通过删除提示文字或设置覆盖口令绕过完整性审阅。
- 适配范围为聚合页及详情读取、预览和拦截；技能来源口径、改名/编号/异色冲突、完整进化与繁育字段须完成审阅。生成器为此保留发布阻塞，不提供自动批准入口。
- 正式数据仍经过版本化 staging → preview → 显式 apply。用户确认针对具体审阅结果，不继承其他版本的旧确认。

## 已确认事实

2026-09-10，用户在游戏中核对迪莫“超导”并确认 NRC 页面正确：威力 90、基础能耗 3、迸发减耗 2。仅确认数据事实，不批准广泛性格规则变更或跳过发布流程。

## 回归

`scripts/tests/fixtures/nrc/*.html` 是 2026-09-10 与 2026-09-11 上述来源页面的精简片段，删除样式、导航及不相关记录，验证真实嵌套、动画属性、身份校验和特殊形态自链接。适用署名许可按本文保留。运行 `node --test scripts/tests/nrc-pipeline.test.mjs scripts/tests/nrc-browser-capture.test.mjs` 或 `npm test`，覆盖分段截断、同长度内容变化、跨版本拒绝、断点复用和已有快照保护。parse5 仅用于开发期解析，不增加应用后端。
