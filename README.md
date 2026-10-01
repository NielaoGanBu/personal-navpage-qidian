# 起点 · 个人导航

纯静态个人起始页。HTML、CSS、原生 JavaScript，无 npm 依赖、数据库或常驻应用进程。服务器只需提供静态文件；搜索和网站跳转由浏览器直接完成。

项目仓库：[NielaoGanBu/personal-navpage-qidian](https://github.com/NielaoGanBu/personal-navpage-qidian)。

## 预览

![浅色主页](docs/screenshots/light.png)

![深色主页](docs/screenshots/dark.png)

![文字自定义设置](docs/screenshots/settings.png)

## 快速开始

1. 从 [Releases](https://github.com/NielaoGanBu/personal-navpage-qidian/releases) 下载部署包并解压。
2. 将 `index.html`、`styles.css`、`app.js`、`config.js` 和整个 `icons/` 上传到静态网站根目录。
3. 用浏览器打开网站，进入右上角「管理设置」编辑。

下文提供 Debian / Nginx 部署步骤；使用 DeepSeek Harness 时，可复制 [配套部署提示词](docs/deploy-harness.md)，填写部署包路径和访问地址。

## 许可证

本项目代码及原创文档使用 [MIT License](LICENSE)。第三方网站品牌图标的权利和许可范围单独列于 [第三方资源说明](THIRD_PARTY_NOTICES.md)，不自动适用本项目 MIT 许可证。

## 功能

- 自定义搜索引擎、默认引擎；搜索地址中的 `{q}` 会替换为编码后的关键词，结果在新标签页打开，保留导航页。搜索引擎设置中可隐藏主页「搜索引擎」标签。
- 导航磁贴：名称、地址、图标地址、备用文字、描述、顺序均可编辑。默认网站使用随站点保存的品牌 favicon；新增网站自动尝试其 `/favicon.ico`，也可填写页面声明的图标链接。图片都无法加载时使用备用文字。
- 全局日间/夜间模式，首次跟随系统，之后记住手动选择。
- 两套纯色背景或上传背景图片。图片最长边缩小至 1920 像素并压缩为 WebP。
- 外观背景设置可编辑左上角名称及主页中间三行文字：顶部小字、主标题、副标题；三行文字留空可隐藏相应行。
- 管理设置面板、本机保存、配置导入/导出。
- 桌面四列、平板三列、手机两列；支持键盘导航。

## 保存与同步

### 预存图标

`icons/` 已包含 23 个网站的图标。Google、GitHub、YouTube、ChatGPT、Gmail、Notion 以及 X、Reddit、Discord、Telegram、维基百科、Stack Overflow、Spotify、Twitch、LinkedIn、Dropbox、Netflix 均可使用本地文件，另含默认国内网站图标。部署时上传整个 `icons` 文件夹即可，服务器运行时不需要联网获取这些图标。

添加网站后按域名自动匹配，也支持子域名（例如 `open.spotify.com`、`en.wikipedia.org`）及 `twitter.com`、`discord.gg`、`t.me`。图标地址留空即可优先使用预存图标；如果手动填写了外部图标地址，则优先使用你填写的地址。没有预存图标的网站由访客浏览器尝试读取该网站的 favicon，不由服务器拉取。

图标来源记录在部署包内的 `icons/sources.json`；品牌图标仅用于标识对应网站。

### 编辑与发布

点击右上角「管理设置」编辑，点击「保存设置」在当前浏览器生效。

这是本机编辑面板，没有服务器管理员登录，也没有服务端写入接口。其他访客打开编辑面板，只能修改自己的浏览器配置。

跨设备更新流程：

1. 编辑后点击「导出配置」，下载 `config.js`。背景图片已包含在文件内，无需单独上传。
2. 用 SFTP 或服务器面板上传，覆盖站点目录的 `config.js`。建议先备份原文件。
3. 新设备刷新即可加载。曾经保存过本机设置的设备，打开管理设置，点击「使用服务器配置」清除本机覆盖，再刷新。

「使用服务器配置」采用当前页面加载的配置；上传新文件后应先刷新页面再点击。本机设置优先于服务器设置。浏览器清除站点数据会清除本机配置；更换域名、HTTP/HTTPS 或端口也会使用独立的本机存储。

「导入配置」支持本站导出的 `.js` 或相同结构的 JSON，仅解析配置数据，随后需点击「保存设置」。设置面板中取消会放弃未保存编辑；导出会包含当前尚未保存的编辑。

旧版配置和已有本机设置继续兼容：缺少新字段时使用原来的三行文字，并显示搜索引擎标签。升级已部署站点时，保留自定义 `config.js`，更新 `index.html`、`styles.css`、`app.js` 和 `icons/` 即可。

## 部署到 Debian

### 已有网站面板或 Nginx

将下面四个文件与 `icons` 文件夹一起上传到网站根目录，保持如下结构：

```text
index.html
styles.css
app.js
config.js
icons/
```

不需要构建。已有网站请先备份对应目录及配置，使用独立域名或子域名部署。

### 新服务器：Nginx 示例

以下命令针对新站点。将 `nav.example.com` 换成自己的域名并解析到服务器，安全组允许 TCP 80。上传这四个文件和 `icons` 文件夹到 `/var/www/personal-nav`。命令不会删除已有默认网站。

```bash
sudo apt update
sudo apt install nginx
sudo mkdir -p /var/www/personal-nav
# 使用 SFTP 上传 index.html、styles.css、app.js、config.js 和 icons 文件夹到该目录
sudo find /var/www/personal-nav -type d -exec chmod 755 {} \;
sudo find /var/www/personal-nav -type f -exec chmod 644 {} \;
sudo cp nginx.conf /etc/nginx/sites-available/personal-nav
sudo nano /etc/nginx/sites-available/personal-nav
# 把 server_name 改成你的域名，保存退出
sudo ln -s /etc/nginx/sites-available/personal-nav /etc/nginx/sites-enabled/personal-nav
sudo nginx -t
# 仅在检查通过后执行：
sudo systemctl reload nginx
```

`nginx.conf` 是部署包中的示例配置，请先将它上传到服务器的工作目录，再执行 `cp`。若链接已经存在，无需重复执行 `ln -s`。

域名测试（替换为自己的域名）：

```bash
curl -I http://nav.example.com/
curl -I http://nav.example.com/config.js
```

两者应返回 `200`；再用浏览器实际完成一次搜索、磁贴跳转、设置保存和刷新。HTTPS 可沿用现有面板或反向代理的证书配置。若只使用 IP，请在无其他默认站点的新服务器上把 `server_name` 改为服务器 IP。

示例 Nginx 配置让 `config.js` 每次重新验证，避免上传后继续使用旧配置；HTML、CSS、JavaScript 也会重新验证，不设置长时间缓存。

### 回退

修改已有站点时，恢复修改前备份的文件和 Nginx 配置，`sudo nginx -t` 通过后再 reload。首次新增独立站点时，只移除自己新增的 `/etc/nginx/sites-enabled/personal-nav` 符号链接，检查通过后 reload，其他网站仍保持原配置。

## 本地预览

进入文件所在目录，运行：

```bash
python3 -m http.server 8789 --bind 127.0.0.1
```

浏览器访问 `http://127.0.0.1:8789/`。建议通过 HTTP 预览，浏览器对 `file://` 的存储行为可能不同。

## 本次验证范围

在本地 HTTP 服务中使用 Edge/Chromium 验证：默认磁贴、网站编辑排序及刷新保存、主题保存、自定义搜索 URL 与中文编码、上传图片压缩及刷新保存、含图片配置导出与重新导入、恢复服务器配置、390px 手机布局、空导航状态。浏览器未出现脚本异常。

本次更新在本地预览中实际验证了：搜索在新标签页打开 Bing 结果，原导航页保留；标签关闭后不占空间；三行自定义文字保存并刷新后保留；390px 手机布局无横向溢出。旧版配置补全新增字段后，原有 12 个网站和 4 个引擎保持不变。

示例网站在你所在网络的可达性及 Debian 上的真实部署尚未验证。

默认主题文字配色对比度最低：浅色 4.66:1，深色 6.26:1；图形和按钮亦通过阈值。自定义背景使用不透明的内容面板保留文字对比度。

本次调整的「搜索引擎」标签根据浏览器实际配色计算，对比度为浅色 11.99:1、深色 15.23:1。
