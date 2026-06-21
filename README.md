# Skyline Legion

一款原创的竖屏 3D 倍增门射击网页游戏。驾驶悬浮炮艇、击穿能量门、扩张军团并摧毁天穹核心。

## 在线试玩

- 稳定试玩地址：<https://senya7542.github.io/SkylineLegion/>
- 如果刚推送后看到旧版本或黑屏缓存，可以强制刷新，或临时打开：<https://senya7542.github.io/SkylineLegion/?v=latest>

首次启用 Pages 或每次推送新版本后，GitHub Actions 通常需要几十秒到几分钟完成构建部署。

## 操作

- 鼠标或手指左右移动
- 键盘可使用 `A / D` 或左右方向键
- 对准能量门会自动充能并射击
- 支持暂停、静音、重新挑战和本地最高分

## 本地运行

```powershell
npm install
npm run dev
```

浏览器打开终端中显示的本地地址即可试玩。

## 项目结构

这个仓库现在就是 `SkylineLegion` 项目的根目录，代码、资源和配置都放在根目录下：

- `src/`：游戏逻辑、角色和场景代码
- `public/assets/`：背景图、参考图等静态资源
- `design-qa.md`：阶段记录、设计检查和优化备注
- `package.json`：本地运行与构建脚本

## 自动部署

推送到 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动运行：

1. 安装依赖
2. 执行 `npm run build`
3. 上传 `dist/`
4. 部署到 GitHub Pages

如果之后再次修改 GitHub 仓库名，Pages 地址会跟随仓库名变化，README 里的链接也需要同步改一下。
