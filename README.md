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
