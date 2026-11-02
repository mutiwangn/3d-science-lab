# MUTIW · 3D 科学互动实验室

小学科学原创三维互动网页与实验教学数字工具。主页展示作品封面和简介，每件正式作品采用独立口令解锁。

- 展示地址（启用 Pages 后）：https://mutiwangn.github.io/3d-science-lab/
- 基础互动资源库：https://mutiwangn.github.io/AI-html/
- 作品发布与授权由仓库所有者统一管理，不开放用户投稿。

## 安全设计

本仓库是公开的 GitHub Pages 部署仓库。公开内容只有主页、封面、目录，以及通过 AES-256-GCM 加密的作品数据。口令不会保存在网页源码中。浏览器使用 PBKDF2-SHA256 在内存里解密，不会把密码上传到服务器或保存在本地存储中。

**不要把正式作品的未加密 HTML、GLB、纹理或真实口令提交到本仓库。** 即使后续删除，也不能保证从 Git 历史及他人下载的副本中消失。

- 正式作品目前应是**单体 HTML**，所需模型、纹理与脚本尽量内嵌。公开引用的外部模型地址不受本站加密保护。
- 建议每件作品使用至少 16 字符的随机口令，并妥善备份未加密源文件；短口令可能被离线猜测。
- 更换密码需要重新加密并发布；无法阻止已获授权者保存解密后的内容。这是保密机制，不是防复制 DRM。
- 浏览器必须支持 Web Crypto API。请通过 HTTPS 访问，并在希沃一体机、手机与平板上测试。

## 功能演示

“旋转立方体 · 解锁演示”仅用于验证密码、WebGL、拖动旋转、缩放和全屏，不包含真实原创作品。

**演示口令：3D-DEMO-2026**

演示源文件 tools/demo-source.html 故意公开，正式作品不能照此将明文上传。

## 站长网页上传入口（单体 HTML，最多 60 MiB）

- 上传工作台：https://mutiwangn.github.io/3d-science-lab/upload.html
- 直接从电脑选择 HTML，填写标题、封面和作品解锁密码，即可在浏览器**本地加密**后通过 GitHub 官方 API 上传；原始 HTML 不提交。
- 第一次使用需在 [GitHub 细粒度令牌页面](https://github.com/settings/personal-access-tokens/new) 创建专用令牌：资源所有者选 `mutiwangn`，只选 `3d-science-lab` 仓库，仓库权限仅开放 **Contents → Read and write**（Metadata 自动为读取），建议 30 天到期。每次打开工作台粘贴令牌，页面不会在持久化存储中保存。
- 网页虽公开可访问，但只有具有仓库写入权限的令牌才能发布。**不要分享令牌，也不要将其写进 HTML、README 或 Notion**；令牌泄漏请立即在 GitHub 撤销。
- 可以生成独立的随机口令；发布成功后用「复制 Notion 登记信息」按钮，手动登记到你的[私人密码台账](https://app.notion.com/p/9d44ca7a087c497abdd494c99abfc243)。暂不自动同步 Notion，正式口令不能仅保存于已关闭的上传页面。
- GitHub 网页原生上传单文件限制 25 MiB。本站上传器使用 GitHub Git 数据 API 来提交加密文件，最高 60 MiB 源 HTML；加密 JSON 会因 Base64 膨胀。GitHub Pages 已发布站点最大 1 GB，若陆续积累较多大作品，应迁移密文到 Cloudflare R2 等对象存储，避免长期把 GitHub 作为大文件仓库。
- 当前仅支持**单体 HTML**，不直接支持 ZIP/GLB 文件夹工程；本地模型/纹理/JS 必须先内嵌。若 HTML 引用了外部 HTTPS 资产，这些资产本身不会被此机制保护。

## 添加正式作品

在安装 Node.js 20+ 的电脑上，从此仓库目录运行：

    node tools/encrypt-work.mjs "/仓库外/原创作品.html" lunar-rover --title "月球小车" --grade "五年级" --description "观察车轮、动力与结构" --cover "./covers/lunar-rover.svg"

工具会隐藏口令输入并要求确认，生成：

1. encrypted/lunar-rover.json：加密数据。
2. catalog.json：作品目录更新。

将公开封面放进 covers/ 后，只提交加密数据、作品目录和封面。**原始 HTML 应保存在本仓库之外并单独备份。**

更新现有作品需添加 --replace 并重新输入密码。作品 ID 只使用小写英文字母、数字和连字符，公开标题可以是中文。

自动化环境可以临时通过 SCIENCE_LAB_PASSWORD 环境变量传递口令，但不要将密码写入脚本或提交记录。

## GitHub Pages

进入 Settings → Pages → Build and deployment：

- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

保存后等待 Pages 发布。

## 文件

- index.html：公开主页及浏览器解锁器
- catalog.json：公开展示目录，不含口令
- encrypted/：加密作品数据
- covers/：公开封面
- tools/encrypt-work.mjs：本地加密发布工具
- tools/demo-source.html：公开功能演示源文件

© MUTIW。原创内容保留所有权利；仓库未附开源许可不意味着允许自由复制或再发布。
