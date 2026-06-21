# Skyline Legion 项目交接说明

这份文档给新的 Codex 会话或未来维护者快速接手用。新会话开始时，建议先读完本文，再读 `README.md` 和 `design-qa.md`。

## 项目定位

`Skyline Legion` 是一款原创竖屏 3D 倍增门射击网页小游戏，参考 TopWar 买量视频里“我方军团射击倍增门、扩张队伍、推进打 Boss”的爽感。

当前方向：

- 9:16 竖版优先，桌面浏览器只是调试载体。
- 核心体验是“战机/炮艇带队推进 + 小兵群射击 + 倍增门增长 + 敌群压迫 + Boss 对抗”。
- 美术基调是明亮高饱和的天空未来城：蓝天、浮空岛、玻璃赛道、发光能量弹、低多边形科幻士兵。
- 用户很重视“反馈带感”：命中爆点、闪白/闪黄、击飞、Q 弹扩张、音效、道路和背景统一。

## 本地路径与仓库

- 本地项目路径：`F:\Users\Yoru17\Documents\Git项目\SkylineLegion`
- GitHub 仓库：`https://github.com/Senya7542/SkylineLegion`
- 默认分支：`main`
- 远程：`origin/main`

注意：`F:\Users\Yoru17\Documents\Git项目` 只是本机的项目容器目录；真正的 Git 仓库根目录是 `SkylineLegion`。

## 常用命令

在项目根目录执行：

```powershell
npm install
npm run dev
npm run build
npm run preview
npm run build:single
```

说明：

- `npm run dev`：本地开发服务器。
- `npm run build`：正式网页构建，输出到 `dist/`。
- `npm run preview`：预览 `dist/`。
- `npm run build:single`：生成临时单文件试玩包，输出到 `output/SkylineLegion.html`。

`dist/`、`output/`、`node_modules/`、`.npm-cache/` 都不进 Git。

## 目录结构重点

- `src/App.jsx`：当前主游戏逻辑、场景、UI 和渲染大多在这里。文件已经偏大，后续大改时建议逐步拆分。
- `src/gameConfig.js`：关卡、门、波次、常量配置。
- `src/gameSystems.js`：小兵/敌人等逻辑系统。
- `src/entityVisuals.js`：实体视觉参数。
- `src/styles.css`：页面、HUD、加载页等样式。
- `public/assets/`：运行时静态资源。
- `src/assets/`：Vite 处理的前端资源。
- `scripts/build-single.mjs`：单 HTML 构建工具。
- `.github/workflows/deploy-pages.yml`：GitHub Pages 自动部署。
- `docs/reference/`：历史/参考资源。
- `design-qa.md`：阶段记录、设计检查和优化备注。

## 已部署渠道

### GitHub Pages

稳定试玩地址：

```text
https://senya7542.github.io/SkylineLegion/
```

GitHub Pages 由 `.github/workflows/deploy-pages.yml` 自动构建部署。推送到 `main` 后会触发 GitHub Actions。

曾踩过的坑：

- Vite 的 `base` 在 GitHub Pages 下必须是 `/SkylineLegion/`。
- 项目里直接写 `/assets/...` 会导致 Pages 黑屏。
- 当前 `vite.config.mjs` 已按环境处理：
  - GitHub Actions 下：`base = /SkylineLegion/`
  - EdgeOne/本地普通构建：`base = /`
  - 单 HTML 构建：`base = ./`

### EdgeOne Pages / Makers

用户已经创建并测试过国内可用区项目，GitHub 同步已打通。

当前有效链路：

```text
本地开发 → git commit → git push origin main → EdgeOne 自动构建 → 国内预览链接可玩
```

EdgeOne Git 配置应保持：

```text
仓库：Senya7542/SkylineLegion
生产分支：main
框架预设：Vite
根目录：./
安装命令：npm ci
构建命令：npm run build
输出目录：dist
加速区域：中国大陆可用区
```

注意：

- EdgeOne 的默认访问域名/站点域名可能返回 `401: UNAUTHORIZED`。
- 国内可用区通常需要从控制台点“预览”拿带 `eo_token` 的链接。
- 用户已经验证过新建的国内项目预览链接可正常游玩。
- 长期公开固定链接可能需要绑定自定义域名，可能涉及备案；当前先用预览链接展示即可。

### 单 HTML 临时包

命令：

```powershell
npm run build:single
```

输出：

```text
output/SkylineLegion.html
```

用途：

- 给打不开 GitHub/EdgeOne 的朋友临时发送文件。
- 手机上建议“用浏览器打开”，不要用微信/QQ 内置预览。

曾踩过的坑：

- 初版单 HTML 能打开但手机卡在“正在唤醒天穹航道”。
- 根因是 `@react-three/drei/Text` 的字体/字形异步链路在手机本地文件环境下可能不 resolve。
- 当前解决：单 HTML 构建时使用 `CanvasText` 贴图文字，正常网页版本继续用 Drei Text。
- 初版 Canvas 字体过小过瘦，已改成固定纹理内等比放大，并单独放大倍增门主数字。

单 HTML 只是临时展示方案，不要把它作为长期主线继续投入太多。

## 用户偏好与沟通方式

用户是第一次系统使用 Git/GitHub，但学习很快，喜欢边做边理解原理。沟通偏好：

- 用中文。
- 先讲结论，再讲原因。
- 做代码改动时要及时说明“现在在干什么”。
- 完成后最好按这个格式汇报：
  1. 本轮改动了哪些文件
  2. 实际验证了什么
  3. 当前还剩什么问题
  4. 下一步建议做什么
  5. 是否需要我确认后再继续
- 如果涉及 Git 提交/推送，要明确说明 commit hash、是否已 push。
- 不要擅自做大范围玩法方向调整；可以先给方案，用户认可后再做。

用户对游戏体验的重点要求：

- 移动必须顺滑，接近 60 FPS 手感。
- 子弹要明显，颜色/爆点/冲击环统一、发光。
- 命中倍增门要有闪烁、Q 弹缩放、数值增长反馈。
- 命中敌人/Boss 要有爆点、闪白、击飞、死亡变灰。
- 我方小兵新增时要像 TopWar 那样从中心缩放出现，并把原队伍 Q 弹挤开。
- 小兵群不要僵硬方形排列，要有物理小球碰撞感和自然团簇。
- 战机/炮艇要保留存在感，不要被小兵穿模或完全挡住炮口。
- 背景要利用好天空城图，9:16 画面优先。
- 道路、消失点、背景透视要协调，玻璃路面方向是认可的。

## 当前已知技术债

- `src/App.jsx` 文件很大，游戏逻辑、渲染、UI 仍混在一起。后续功能变多时建议拆：
  - `components/`
  - `systems/`
  - `effects/`
  - `ui/`
  - `config/`
- 士兵和 Boss 目前是程序化低多边形模型，展示可用，但不是最终商业美术。
- Boss 交互已经有基础，但仍可继续增强攻击模式、预警、压迫感。
- 音效是 Web Audio 合成音，后续可替换为短音频资源。
- EdgeOne 当前主要使用预览链接，不是永久公开自定义域名。
- GitHub Pages 和 EdgeOne 都可用；若某次 EdgeOne 自动构建失败，优先检查构建日志里的 `npm ci` / `npm run build`。

## 已经解决的重要问题

- Git 仓库根目录从原来的 `game/` 调整为 `SkylineLegion` 项目根目录。
- GitHub Pages 黑屏：修复 Vite base 和资源路径。
- 首屏加载突兀：加入 booting/menu/intro 流程，避免 Canvas 重建。
- 包体积：图片压 WebP，vendor 分包。
- 背景：从天空球改到更适合固定视角的背景图/玻璃路面方向。
- 单 HTML：已可本地文件打开，兼容手机字体加载限制。
- EdgeOne：国内可用区 Git 同步已成功跑通。

## 推荐的新会话开场提示

新开 Codex 会话时可以直接发：

```text
请先阅读 F:\Users\Yoru17\Documents\Git项目\SkylineLegion\docs\handoff.md，然后继续开发 Skyline Legion。当前仓库在 F:\Users\Yoru17\Documents\Git项目\SkylineLegion，先检查 git 状态和最近提交，再给我下一步优化方案。
```

如果要继续玩法/美术优化，可以补一句：

```text
优先沿着 TopWar 买量视频那种倍增门射击爽感继续优化：反馈、团簇、敌人压迫、Boss 对抗、美术统一度。
```

## 交接时的安全提醒

- 开始任何代码改动前先跑 `git status --short`。
- 不要覆盖用户未提交改动。
- 不要把 `dist/`、`output/`、`node_modules/` 提交进 Git。
- 推送前至少跑 `npm run build`。
- 如果改了单 HTML 相关逻辑，再跑 `npm run build:single`。
- 用户明确说“推送”时再 push；只说“提交”通常先理解为本地 commit。
