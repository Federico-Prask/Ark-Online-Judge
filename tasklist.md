# ArkOJ 任务清单（持续维护）

> 状态：✅ 完成 ｜ 🔄 进行中 ｜ ⬜ 待办
> 每轮开工先读此文件，完成即更新。

## 存储拆分
- ✅ 提交拆分：`submissions/[id]/Main.<ext>` + `result.json`
- ✅ 题面拆分：`data/[pid]/description.json`（背景/描述/格式/说明/样例，留空=无）
- ✅ 附件目录：`data/[pid]/additionals/`
- ✅ 测试点 zip 上传 + 解压（.in/.out/.ans + checker.cpp/testlib.h/interactor.cpp）
- ✅ 题目元数据移出 db.json → `data/[pid]/problem.json`（db.json 仅 users/tokens/subs/contests/discussions/settings/stats）
- ✅ 测试点命名识别两种：`N.in` 与 `S_N.in` → `tests.json` 分组；判题按分组计分
- ✅ 旧 db.problems 启动时自动迁移并清除

## 编辑器
- ✅ 样例左右排版（多组可增删）
- ✅ 测试点只走 zip 上传 + 解压后自动识别展示 subtask 结构
- ✅ 背景/说明字段（留空=无）
- ✅ 可见性选择（隐藏/公开/比赛）

## 判题
- ✅ 语言目录 C++11-23 / C99 / C11 / Py3 + O0-Ofast + -DONLINE_JUDGE
- ✅ 交互题管道判题（AC 验证）；通信题 ⬜（用户说先不管）
- ✅ checker.cpp 支持（exit 0 = AC）
- ✅ 按 tests.json 的 subtask 分组计分

## 真实数据（清除假数据）
- ✅ /api/stats 真实平台统计（游客侧数据带 + 平台状态卡）
- ✅ 继续挑战由真实提交推导；新用户空态"去挑第一道题"
- ✅ "关于 ArkOJ" 改为公告帖，主页卡片链接全文
- ✅ /api/admin/purge（仅 admin）清假用户/假提交；沙箱已执行
- ✅ 每日一题 AC 数真实化

## 动作后刷新
- ✅ 重测后轮询翻牌直至落定；取消后同步全部提交列表

## 权限 / 设置
- ✅ 可见性三态 + 赛后自动公开（赛时仅比赛页/题管可见）
- ✅ db 设置 new_access / inv_needed / inv_code + 用户管理页 UI + 注册强制
- ✅ 重测 / 取消成绩

## 页面
- ✅ 讨论区四分区（公告#C75C5C / 求助#CCAE56 / 题解#51D094 / 灌水#518BCF，按序排列）
- ✅ 公告 = 讨论区一部分；主页公告卡全部带链接；仅管理员可发公告
- ✅ 排行榜 / 题目管理（新建/编辑/zip 上传）
- ✅ 主页卡片实时化
- ⬜ 比赛管理页增强（建赛 UI 已有；补编辑/手动封榜查看）
