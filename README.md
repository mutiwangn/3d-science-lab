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

## 推荐：GitHub Desktop 本地发布（无需令牌，最多 60 MiB）

这条通道不通过浏览器调用 GitHub API，可避免网页端的 403、422、网络/代理连接失败。**加密仍在本地进行，明文不提交到 GitHub。**

1. 安装 [GitHub Desktop](https://desktop.github.com/)，登录拥有该仓库的 GitHub 账号。
2. 在 GitHub Desktop 的 **File → Clone repository** 中选择 `mutiwangn/3d-science-lab`，克隆到电脑。以后每次发布前先 **Fetch origin / Pull**，确保本地仓库是最新版。
3. 用电脑上的 **Chrome 或 Edge** 打开 [作品发布工作台](https://mutiwangn.github.io/3d-science-lab/upload.html)。选择**保存在克隆仓库之外**的原始单体 HTML，填写分类、作品编号、独立解锁密码等。GitHub 令牌可以留空。
4. 点击 **「在本机生成发布文件（无需令牌）」**，浏览器会请求你选择本机文件夹。选中 GitHub Desktop 克隆出的 `3d-science-lab` **仓库根目录**，授权读写。程序会核对仓库标识、读取当地作品目录，在本机将密文拆成多个 3 MiB 加密分片写入 `encrypted/`，最后更新 `catalog.json`；不会把原始 HTML 发给 GitHub API。
5. 看到**「本机准备完成 · 尚未发布」**后，切换回 GitHub Desktop，核对变更只包含 `encrypted/`、`catalog.json`、可选 `covers/`，确认没有原始 HTML、GLB 或其他私人文件后，**Commit to main → Push origin**。这一步才会上传密文并触发 GitHub Pages 部署。
6. 访问首页验证新口令，**关闭上传工作台前**点击「复制 Notion 登记信息」，保存到私人密码台账；完成推送和解锁测试后将台账状态改为「已发布」。

文件夹选择功能只在支持 File System Access API 的安全浏览器中可用。其他浏览器可以使用下文 `tools/encrypt-work.mjs` Node.js 命令行工具（也支持 60 MiB 自动分片），再通过 GitHub Desktop 推送。**若本地生成未完成，不要提交未完成的文件。**

## 可选：站长网页 API 在线直传（单体 HTML，最多 60 MiB）

- 上传工作台：https://mutiwangn.github.io/3d-science-lab/upload.html
- 直接从电脑选择 HTML，填写标题、封面和作品解锁密码，在浏览器**本地加密**后经 GitHub 官方 API 分片上传。此通道需要令牌；若 API 连接失败，请改用上面的 GitHub Desktop 发布。
- **仅在线直传时**，第一次使用需在 [GitHub 细粒度令牌页面](https://github.com/settings/personal-access-tokens/new) 创建专用令牌：资源所有者选 `mutiwangn`，只选 `3d-science-lab` 仓库，仓库权限仅开放 **Contents → Read and write**（Metadata 自动为读取），建议 30 天到期。每次打开工作台粘贴令牌，页面不会在持久化存储中保存。
- 网页虽公开可访问，但只有具备仓库写入权限的令牌才能通过在线直传模式发布；本地模式仅写入你主动授权的电脑文件夹，由 GitHub Desktop 账号确认推送。**不要分享令牌，也不要将其写进 HTML、README 或 Notion**；令牌泄漏请立即在 GitHub 撤销。
- 可以生成独立的随机口令；发布成功后用「复制 Notion 登记信息」按钮，手动登记到你的[私人密码台账](https://app.notion.com/p/9d44ca7a087c497abdd494c99abfc243)。暂不自动同步 Notion，正式口令不能仅保存于已关闭的上传页面。
- GitHub 网页原生上传单文件限制 25 MiB。本站上传器先在浏览器本地把源 HTML 进行 AES-256-GCM 加密。小文件按旧版 v1 格式上传；大文件自动拆成每片约 3 MiB 的加密二进制数据，并分别转换成约 4 MiB 的 Base64 文本文件，最后一次性提交 v2 清单、分片、公开封面及目录。这样可以规避 GitHub Git 数据 API 拒绝超大单次请求的 422 错误。GitHub Pages 已发布站点最大 1 GB。单个 57.9 MiB 作品加密并 Base64 编码后约占 77.2 MiB；若陆续积累十余个类似大作品，应该迁移密文到 Cloudflare R2 等对象存储，避免长期把 GitHub 作为大文件仓库。
- 当前仅支持**单体 HTML**，不直接支持 ZIP/GLB 文件夹工程；本地模型/纹理/JS 必须先内嵌。若 HTML 引用了外部 HTTPS 资产，这些资产本身不会被此机制保护。

## 添加正式作品

在安装 Node.js 20+ 的电脑上，从此仓库目录运行：

    node tools/encrypt-work.mjs "/仓库外/原创作品.html" lunar-rover --title "月球小车" --grade "五年级" --description "观察车轮、动力与结构" --cover "./covers/lunar-rover.svg"

工具会隐藏口令输入并要求确认。小文件生成 v1 加密清单，大文件生成 v2 加密清单和每份 3 MiB 的 Base64 密文分片（与网页发布器兼容）。更新：

1. `encrypted/lunar-rover.json`：加密清单。
2. `encrypted/lunar-rover/part-###.b64`：较大文件的密文分片。
3. `catalog.json`：作品目录。

将公开封面放进 covers/ 后，只提交加密数据、作品目录和封面。**原始 HTML 应保存在本仓库之外并单独备份。**

工具接受 `--type "3D教师演示"`（或 `3D学生操作`、`数字工具`）。更新现有作品需添加 `--replace` 并重新输入密码。作品 ID 只使用小写英文字母、数字和连字符，公开标题可以是中文。

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
- encrypted/：加密作品数据（v1 单文件或 v2 加密清单及分片，旧作品继续可解锁）
- covers/：公开封面
- tools/encrypt-work.mjs：本地加密发布工具
- tools/demo-source.html：公开功能演示源文件

© MUTIW。原创内容保留所有权利；仓库未附开源许可不意味着允许自由复制或再发布。
