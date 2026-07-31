# 洛克王国世界精灵扫描回归基线

## 用途

本文件用于核对固定手机视频的智能抽帧、字段识别和性能变化。表内“当前识别”是扫描器的实测输出，不等同于正确答案；只有用户明确确认或纠正后，才能写入“用户确认”并作为后续回归期望值。

固定样本：

- 视频：3200 × 1440、24 fps、HEVC MP4，时长约 1 分 36 秒；
- Git LFS 对象：`b2b8542b6cecdf35bbde131e41f6adb1e1caeb157c0db1a7ea5174bb5e75f814`；
- 视频不作为当前工作树测试资产保存，逐帧复核图保存在 `docs/assets/rock-kingdom-scanner/baseline-3200x1440/`；
- 复核图为精确时间点对应的 1600 × 720 WebP，保留完整游戏画面。

## 当前性能记录

- 智能抽帧：检查 318 个时间点，步长约 0.30 秒，保留 56 张，耗时 84.2 秒；
- 批量识别：56 张，总耗时 64.7 秒；
- 单帧识别累计：64.6 秒；
- 单帧平均：1.2 秒；
- 单帧中位数：1.2 秒；
- 自动关联精灵：45 张；
- 完全未匹配：2 张；
- 同名形态待选择：9 张。

性能比较必须区分首次加载 OCR 模型的冷启动与模型已经加载的热运行。本表记录的是热运行；单帧状态中的时间只计算该帧识别，不包含智能抽帧、人工复核和模型纠错。

## 逐帧结果

“未选择”表示扫描器没有得到可采用的结果。“无”可能是明确识别为无，也可能是字段默认值；用户确认时应以截图为准。

| # | 时间 | 截图 | 当前图鉴名 | 性格 | 血脉 | 外观 | 特长 | 伙伴标记 | 性别 | 状态 / 耗时 | 用户确认或纠正 |
|---:|:---:|:---:|---|---|---|---|---|---|---|---|---|
| 1 | 0:00.9 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-01-000900ms.webp) | 小独角兽 | 莽撞 | 首领 | 无 | 同乘 | 生命 | 公 | 待复核 / 0.5 秒 | 待确认 |
| 2 | 0:03.0 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-02-003000ms.webp) | 机械方方 | 懒散 | 机械系 | 异色 | 疾行 | 生命 | 公 | 待复核 / 0.5 秒 | 待确认 |
| 3 | 0:05.1 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-03-005100ms.webp) | 板板壳 | 胆小 | 未选择 | 无 | 无 | 生命 | 公 | 待复核 / 1.2 秒 | 待确认 |
| 4 | 0:07.2 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-04-007200ms.webp) | 地鼠（枯水期的样子） | 勇敢 | 未选择 | 无 | 无畏 | 生命 | 公 | 待复核 / 1.1 秒 | 待确认 |
| 5 | 0:08.4 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-05-008400ms.webp) | 未识别 | 胆小 | 未选择 | 无 | 无 | 生命 | 母 | 未匹配精灵 / 2.0 秒 | 待确认 |
| 6 | 0:11.7 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-06-011700ms.webp) | 鸭吉吉（燃了鸭） | 平和 | 普通系 | 无 | 无畏 | 无 | 公 | 待复核 / 1.4 秒 | 待确认 |
| 7 | 0:12.9 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-07-012900ms.webp) | 学院呱呱 | 固执 | 未选择 | 无 | 亲密 | 生命 | 公 | 待复核 / 1.5 秒 | 待确认 |
| 8 | 0:14.7 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-08-014700ms.webp) | 魔力猫 | 踏实 | 首领 | 无 | 亲密 | 生命 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 9 | 0:16.5 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-09-016500ms.webp) | 琉璃水母 | 勇敢 | 未选择 | 黑白炫彩 | 无 | 果实 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 10 | 0:18.0 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-10-018000ms.webp) | 小独角兽 | 沉默 | 未选择 | 无 | 同乘 | 生命 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 11 | 0:19.2 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-11-019200ms.webp) | 小独角兽 | 悠闲 | 未选择 | 无 | 无 | 生命 | 母 | 待复核 / 0.5 秒 | 待确认 |
| 12 | 0:21.0 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-12-021000ms.webp) | 鸭吉吉（燃了鸭） | 聪明 | 普通系 | 无 | 无 | 房屋 | 公 | 待复核 / 1.1 秒 | 待确认 |
| 13 | 0:22.5 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-13-022500ms.webp) | 鸭吉吉（燃了鸭） | 沉默 | 普通系 | 无 | 亲密 | 房屋 | 公 | 待复核 / 1.3 秒 | 待确认 |
| 14 | 0:24.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-14-024300ms.webp) | 鸭吉吉（燃了鸭） | 胆小 | 普通系 | 无 | 无畏 | 房屋 | 公 | 待复核 / 1.2 秒 | 待确认 |
| 15 | 0:26.1 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-15-026100ms.webp) | 小独角兽 | 害羞 | 未选择 | 炫彩 | 无 | 生命 | 母 | 待复核 / 0.5 秒 | 待确认 |
| 16 | 0:27.6 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-16-027600ms.webp) | 奇丽草 | 偏执 | 首领 | 无 | 灵巧 | 生命 | 母 | 待复核 / 0.4 秒 | 待确认 |
| 17 | 0:29.4 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-17-029400ms.webp) | 乖乖鹄 | 天真 | 未选择 | 无 | 奇袭 | 生命 | 母 | 待复核 / 1.2 秒 | 待确认 |
| 18 | 0:30.6 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-18-030600ms.webp) | 未识别 | 慎重 | 机械系 | 无 | 无 | 生命 | 公 | 同名形态待选择 / 1.2 秒 | 待确认 |
| 19 | 0:32.1 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-19-032100ms.webp) | 阿米亚特 | 固执 | 未选择 | 无 | 同乘 | 生命 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 20 | 0:33.9 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-20-033900ms.webp) | 迪莫 | 莽撞 | 首领 | 无 | 无畏 | 生命 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 21 | 0:35.4 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-21-035400ms.webp) | 白金独角兽 | 胆小 | 首领 | 异色炫彩 | 无 | 闪电 | 母 | 待复核 / 0.3 秒 | 待确认 |
| 22 | 0:36.6 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-22-036600ms.webp) | 炽心勇狮 | 聪明 | 未选择 | 无 | 亲密 | 生命 | 公 | 待复核 / 1.4 秒 | 待确认 |
| 23 | 0:38.4 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-23-038400ms.webp) | 未识别 | 害羞 | 未选择 | 异色炫彩 | 无 | 闪电 | 母 | 未匹配精灵 / 1.6 秒 | 待确认 |
| 24 | 0:39.9 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-24-039900ms.webp) | 罗隐 | 固执 | 首领 | S1 炫彩 | 同乘 | 闪电 | 未选择 | 待复核 / 1.3 秒 | 待确认 |
| 25 | 0:41.4 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-25-041400ms.webp) | 帕帕斯卡 | 固执 | 机械系 | 炫彩 | 同乘 | 闪电 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 26 | 0:45.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-26-045300ms.webp) | 帕帕斯卡 | 固执 | 机械系 | 炫彩 | 同乘 | 闪电 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 27 | 0:47.1 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-27-047100ms.webp) | 喵喵 | 平和 | 未选择 | 无 | 无 | 果实 | 母 | 待复核 / 1.2 秒 | 待确认 |
| 28 | 0:48.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-28-048300ms.webp) | 喵喵 | 冷静 | 光系 | 无 | 疾行 | 果实 | 母 | 待复核 / 1.5 秒 | 待确认 |
| 29 | 0:50.7 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-29-050700ms.webp) | 喵喵 | 聪明 | 未选择 | 无 | 疾行 | 果实 | 母 | 待复核 / 1.3 秒 | 待确认 |
| 30 | 0:52.5 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-30-052500ms.webp) | 未识别 | 开朗 | 未选择 | 无 | 同乘 | 果实 | 公 | 同名形态待选择 / 1.5 秒 | 待确认 |
| 31 | 0:53.7 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-31-053700ms.webp) | 魔力猫 | 沉默 | 未选择 | 无 | 同乘 | 果实 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 32 | 0:55.8 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-32-055800ms.webp) | 魔力猫 | 固执 | 未选择 | 无 | 无畏 | 闪电 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 33 | 0:58.2 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-33-058200ms.webp) | 魔力猫 | 勇敢 | 未选择 | 无 | 无 | 果实 | 公 | 待复核 / 0.4 秒 | 待确认 |
| 34 | 1:00.0 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-34-060000ms.webp) | 火花 | 平和 | 未选择 | 无 | 无畏 | 果实 | 公 | 待复核 / 1.4 秒 | 待确认 |
| 35 | 1:01.8 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-35-061800ms.webp) | 火神 | 固执 | 未选择 | 无 | 无 | 闪电 | 母 | 待复核 / 1.7 秒 | 待确认 |
| 36 | 1:03.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-36-063300ms.webp) | 火神 | 开朗 | 未选择 | 无 | 同乘 | 果实 | 公 | 待复核 / 2.3 秒 | 待确认 |
| 37 | 1:04.8 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-37-064800ms.webp) | 火神 | 警惕 | 未选择 | 无 | 爱分享 | 房屋 | 公 | 待复核 / 2.3 秒 | 待确认 |
| 38 | 1:06.9 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-38-066900ms.webp) | 水蓝蓝 | 胆小 | 奇异 | 无 | 无 | 果实 | 母 | 待复核 / 0.5 秒 | 待确认 |
| 39 | 1:08.4 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-39-068400ms.webp) | 水蓝蓝 | 沉默 | 未选择 | 无 | 亲密 | 果实 | 母 | 待复核 / 0.4 秒 | 待确认 |
| 40 | 1:10.2 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-40-070200ms.webp) | 水灵 | 聪明 | 首领 | 无 | 无 | 闪电 | 母 | 待复核 / 1.7 秒 | 待确认 |
| 41 | 1:11.7 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-41-071700ms.webp) | 水灵 | 偏执 | 水系 | 无 | 同乘 | 房屋 | 母 | 待复核 / 0.5 秒 | 待确认 |
| 42 | 1:13.5 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-42-073500ms.webp) | 鸭吉吉（蓬松的样子） | 调皮 | 首领 | 炫彩 | 无 | 闪电 | 母 | 待复核 / 2.0 秒 | 待确认 |
| 43 | 1:15.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-43-075300ms.webp) | 鸭吉吉（燃了鸭） | 开朗 | 普通系 | S2 炫彩 | 无 | 果实 | 公 | 待复核 / 1.6 秒 | 待确认 |
| 44 | 1:16.5 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-44-076500ms.webp) | 未识别 | 平和 | 普通系 | 无 | 无畏 | 果实 | 母 | 同名形态待选择 / 1.7 秒 | 待确认 |
| 45 | 1:18.0 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-45-078000ms.webp) | 鸭吉吉（燃了鸭） | 平和 | 光系 | 无 | 亲密 | 果实 | 母 | 待复核 / 1.7 秒 | 待确认 |
| 46 | 1:19.5 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-46-079500ms.webp) | 鸭吉吉（紧实的样子） | 调皮 | 普通系 | 无 | 无 | 房屋 | 母 | 待复核 / 1.9 秒 | 待确认 |
| 47 | 1:21.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-47-081300ms.webp) | 鸭吉吉（蓬松的样子） | 固执 | 普通系 | 无 | 无 | 果实 | 公 | 待复核 / 1.8 秒 | 待确认 |
| 48 | 1:22.8 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-48-082800ms.webp) | 未识别 | 聪明 | 普通系 | 无 | 无畏 | 果实 | 公 | 同名形态待选择 / 1.1 秒 | 待确认 |
| 49 | 1:24.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-49-084300ms.webp) | 鸭吉吉（起来鸭） | 沉默 | 普通系 | 无 | 无 | 果实 | 母 | 待复核 / 1.5 秒 | 待确认 |
| 50 | 1:25.8 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-50-085800ms.webp) | 未识别 | 天真 | 普通系 | 无 | 无 | 房屋 | 母 | 同名形态待选择 / 1.3 秒 | 待确认 |
| 51 | 1:27.3 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-51-087300ms.webp) | 鸭吉吉（蓬松的样子） | 开朗 | 普通系 | 无 | 疾行 | 果实 | 公 | 待复核 / 1.4 秒 | 待确认 |
| 52 | 1:28.8 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-52-088800ms.webp) | 鸭吉吉（燃了鸭） | 固执 | 普通系 | 无 | 疾行 | 果实 | 母 | 待复核 / 1.1 秒 | 待确认 |
| 53 | 1:31.2 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-53-091200ms.webp) | 未识别 | 沉默 | 普通系 | 无 | 无 | 果实 | 母 | 同名形态待选择 / 1.1 秒 | 待确认 |
| 54 | 1:32.7 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-54-092700ms.webp) | 未识别 | 胆小 | 普通系 | 无 | 灵巧 | 果实 | 公 | 同名形态待选择 / 2.3 秒 | 待确认 |
| 55 | 1:33.9 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-55-093900ms.webp) | 未识别 | 理性 | 普通系 | S1 炫彩 | 无 | 房屋 | 母 | 同名形态待选择 / 1.6 秒 | 待确认 |
| 56 | 1:35.1 | [打开](assets/rock-kingdom-scanner/baseline-3200x1440/frame-56-095100ms.webp) | 未识别 | 害羞 | 普通系 | 炫彩 | 奇袭 | 房屋 | 公 | 同名形态待选择 / 1.9 秒 | 待确认 |

## 后续回归口径

用户确认完本表后，后续扫描器变更至少比较：

1. 是否仍保留 56 张，以及精确时间点是否发生非预期漂移；
2. 图鉴名、性格、血脉、外观、特长、伙伴标记和性别与用户确认值的差异；
3. 完全未匹配、同名形态待选择和错误自动匹配的数量；
4. 智能抽帧总耗时、批量识别总耗时、单帧平均和中位数；
5. 出现差异时直接使用对应版本化截图定位，不能用低置信 OCR 覆盖用户确认结果。
