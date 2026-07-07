# 临时 Prompt · 补完洛克王国官方 d.json 预置资料

> 适用场景：当前容器无法访问 `static.gamecenter.qq.com`，因此上一轮只完成了同步脚本、迁移逻辑、文档和 GitHub Pages workflow，**尚未真正替换** `public/presets/rockKingdomRows.json`。当你在另一台能访问源站的桌面版 Codex / 本地环境继续处理时，请把这份 prompt 作为开场说明。

## 开场 Prompt

```text
请继续开发 GitHub 仓库 Manamiiii/TangerineTools 当前 PR 分支，目标是补完上一轮未完成的“洛克王国官方 d.json 预置资料”任务。

开始前请先阅读：

1. docs/session-start-prompt.md
2. docs/data-sync.md
3. docs/system-capabilities.md
4. docs/pending-rock-kingdom-official-data-prompt.md

当前背景：

- 已新增 scripts/sync-rock-kingdom-preset.mjs。
- 已新增 package.json 脚本：npm run sync:rock。
- 已补 migration：官方 rock-creature-src-* 行应用时，会删除默认资料表里明确可识别的旧 row-rock-* / data:image/svg+xml 占位行，但不会删除用户新增非占位行、owned 收集记录或 stock 统计视图。
- 已新增 GitHub Pages workflow：.github/workflows/pages.yml。
- 但是上一执行环境无法访问：
  https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/d.json
  所以 public/presets/rockKingdomRows.json 仍未替换为官方真实资料。

本轮必须完成：

1. 从官方公开静态源获取 d.json：
   https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/d.json
2. 如果当前环境能直接访问，运行：
   npm run sync:rock
3. 如果当前环境不能直接访问，但用户提供了本地下载的 d.json / txt / 改名 jpg 文件，请不要当图片处理；按文本 JSON 使用：
   node scripts/sync-rock-kingdom-preset.mjs <本地文件路径>
4. 生成并提交 public/presets/rockKingdomRows.json。
5. 禁止生成 mock / 占位 / 程序化假数据；如果无法访问官方源且没有真实 d.json 文件，请停止并说明原因。

验收要求：

- public/presets/rockKingdomRows.json 行数为 496。
- baseCount = 375，formCount = 121，rowCount = 496；如官方源变化，输出实际统计并不要硬塞。
- image 为 http(s) URL 的行数为 496。
- 不存在 data:image/svg+xml 精灵图。
- element 实际覆盖 18 类：
  normal, grass, fire, water, light, earth, ice, dragon, electric, poison, bug, fighting, flying, cute, ghost, dark, mech, illusion
- 首行迪莫应符合官方源：
  no = NO.001
  name = 迪莫
  element = [light]
  form = 最终形态
  bst = 582
  hp/patk/matk/pdef/mdef/spd = 120/80/80/105/105/92
  traitName = 最好的伙伴
  traitDesc 包含“造成克制伤害后”
  image 与 traitIcon 均为 https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/ 下的公开静态 URL
- 迁移逻辑不引入 Dexie schema 版本变更。
- 不删除 owned / stock 用户数据。

建议运行：

npm ci
npm run sync:rock
npm run build
npm run lint
npm run dev -- --port 5173 --strictPort

如果可用，也请通过 GitHub Pages workflow 远程部署当前分支做浏览器验收。

完成后请提交 commit，并创建 PR / 更新 PR 描述，列出：

- 原始数据源 fetch 状态。
- baseCount / formCount / rowCount。
- image URL count。
- traitIcon URL count。
- element value 集合。
- 首行迪莫 preview。
- build / lint / 页面验证结果。
```

## 注意事项

- 文件即使被用户改名成 `.jpg` 上传，只要内容仍是 JSON 文本，就应按 JSON 文本读取；不要进行 OCR，不要根据截图还原。
- 不要把技能、进化链、克制关系塞进当前资料库字段；本轮只处理基础资料、六维、特性、图片、系别、形态。
- 如果 `d.json` 数量发生变化，不要为了满足 496 硬造数据；应让脚本失败并报告实际 `baseCount + formCount`。
- 当前 `docs/session-start-prompt.md` 里可能描述的是目标完成态；真正完成标志是 `public/presets/rockKingdomRows.json` 已经由官方源生成并通过上述统计验证。
