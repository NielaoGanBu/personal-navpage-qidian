# 起点 · 个人导航

一个 Apple 风格的个人起始页，把搜索和常用网站放在触手可及的位置。

使用 HTML、CSS 和原生 JavaScript，直接托管静态文件即可运行，无需构建、npm、数据库或后台进程。

## 页面预览

| 浅色主题 | 深色主题 |
| --- | --- |
| ![银白浅色主页](docs/screenshots/light.png) | ![深灰夜间主页](docs/screenshots/dark.png) |

![管理设置面板](docs/screenshots/settings.png)

## 功能

- **搜索**：内置 Bing、Google、百度、DuckDuckGo，可添加自定义引擎。结果在新标签页打开，导航页继续保留。
- **滑块切换**：点击引擎时，选中底板滑动并轻微拉伸、回弹；快速连续切换从当前可见位置接续。切换立即生效，无需等待动画结束。
- **常用网站**：默认 12 个入口，名称、网址、图标、备用文字、描述和顺序均可编辑。
- **响应式布局**：桌面六列、平板三列、手机两列；浮动磨砂工具栏与 Spotlight 式搜索框使用统一的中性色和青绿点缀。
- **主题与背景**：首次跟随系统日夜偏好，手动切换后记住选择；可自定义两套背景色，或上传 JPG、PNG、WebP 图片。
- **文字定制**：可编辑导航名称、顶部小字、主标题和副标题，三行介绍分别留空即可隐藏；搜索引擎标签也可关闭。
- **本机设置与同步**：编辑、保存、导入和导出配置。已有本机配置及旧版服务器配置继续兼容。
- **键盘与动态偏好**：按钮可用键盘操作，设置标签支持方向键；键盘选择引擎及减少动态模式直接定位滑块。减少透明度模式使用实色工具栏。

## 快速开始

获取当前代码：

```bash
git clone https://github.com/NielaoGanBu/personal-navpage-qidian.git
cd personal-navpage-qidian
python3 -m http.server 8789 --bind 127.0.0.1
```

Windows 可将最后一行的 `python3` 换成 `python`。浏览器访问 [http://127.0.0.1:8789/](http://127.0.0.1:8789/)。

也可在 GitHub 选择 **Code → Download ZIP** 下载当前分支，解压后运行同一条预览命令。建议通过 HTTP 打开，避免 `file://` 下的浏览器存储差异。

## 自定义

点击右上角「管理设置」：

| 设置页 | 可以修改 |
| --- | --- |
| 导航网站 | 网站名称、地址、图标链接、备用文字、描述；添加、删除和调整顺序 |
| 搜索引擎 | 引擎名称、搜索地址、默认引擎，以及主页标签的显示 |
| 外观背景 | 导航名称、三行介绍文字、日夜背景色和上传图片 |

搜索地址必须包含 `{q}`，例如：

```text
https://www.bing.com/search?q={q}
```

搜索时会将 `{q}` 替换成编码后的关键词。上传背景图片会缩小至最长边不超过 1920 像素，并压缩为 WebP 后保存。

### 保存和跨设备同步

「保存设置」只在当前浏览器生效。管理面板没有服务器管理员登录或服务端写入接口，其他访客的修改也只影响自己的浏览器。

如需把配置发布给其他设备：

1. 编辑后点击「导出配置」，下载 `config.js`；背景图片已包含在文件中。
2. 备份服务器原来的 `config.js`，通过 SFTP 或网站面板上传新文件并覆盖。
3. 在其他设备刷新页面。已保存本机设置的浏览器，刷新后再点击「使用服务器配置」，清除本机覆盖并加载服务器设置。

本机设置优先于服务器配置。「使用服务器配置」使用当前页面已经加载的数据，因此上传新文件后应先刷新。清除站点数据会清除本机配置；域名、协议或端口变化也会使用独立的存储。

「导入配置」支持本站导出的 `.js` 或同结构 JSON，导入后还需点击「保存设置」。取消面板会放弃未保存的编辑；导出配置会包含当前编辑内容。

### 网站图标

`icons/` 预存 23 个网站的品牌图标。默认入口及 GitHub、Google、YouTube、ChatGPT、Gmail、Notion 等使用本地资源，服务器不需要在运行时联网下载它们。部分图标使用高清 PNG 或 SVG，避免大尺寸图标模糊。

新增网站时，图标地址留空会优先按域名匹配本地图标，再尝试该网站的 `/favicon.ico`。支持子域名，以及 `twitter.com`、`discord.gg`、`t.me` 等别名。手动填写的图标链接优先；图片都加载失败时使用备用文字。外部 favicon 由访客浏览器读取。

图标来源见 [icons/sources.json](icons/sources.json)，许可范围见 [第三方资源说明](THIRD_PARTY_NOTICES.md)。

## 部署

将以下文件上传到静态网站根目录，保持相对路径：

```text
index.html
styles.css
app.js
config.js
icons/
```

整份 `icons/` 都应上传。使用现有网站面板、Nginx 或其他静态文件服务即可，无需执行构建命令。

更新已经部署的站点时，**保留自定义的 `config.js` 和用户资源**，更新 `index.html`、`styles.css`、`app.js` 与 `icons/`。已有本机设置继续保留，旧版默认背景颜色不会被自动改写。

[Releases](https://github.com/NielaoGanBu/personal-navpage-qidian/releases) 可下载已发布部署包；要使用本次改版，请确认发布包包含这些更新，或直接使用当前 `main` 分支源码。

### Debian / Nginx 示例

已有 Nginx 或网站面板时优先沿用现有环境。以下步骤用于新增独立站点，执行前将示例域名换成自己的域名，完成 DNS 解析并允许 TCP 80：

```bash
sudo apt update
sudo apt install nginx
sudo mkdir -p /var/www/personal-nav
# 通过 SFTP 上传四个入口文件和整个 icons/ 目录
sudo find /var/www/personal-nav -type d -exec chmod 755 {} \;
sudo find /var/www/personal-nav -type f -exec chmod 644 {} \;
sudo cp nginx.conf /etc/nginx/sites-available/personal-nav
sudo nano /etc/nginx/sites-available/personal-nav
# 将 server_name 修改为自己的域名
sudo ln -s /etc/nginx/sites-available/personal-nav /etc/nginx/sites-enabled/personal-nav
sudo nginx -t
# 仅在配置检查通过后执行
sudo systemctl reload nginx
```

`nginx.conf` 是仓库中的示例，执行复制命令前应先将它上传到服务器工作目录；若站点链接已存在，无需重复创建。HTTPS 可沿用现有面板或反向代理的证书配置。示例配置为静态资源设置 `Cache-Control: no-cache`，让上传后的配置重新验证缓存。

用自己的域名核对首页和配置：

```bash
curl -I http://nav.example.com/
curl -I http://nav.example.com/config.js
```

两者应返回 `200`，再用浏览器实际完成搜索、网站跳转、设置保存和刷新。状态码单独不能证明完整功能正常。

修改已有站点前备份文件、站点配置与入口。回退时恢复备份，`nginx -t` 通过后再 reload；首次新增独立站点时只停用自己新增的站点链接，保留其他网站。

使用 DeepSeek Harness 部署时，可填写并使用 [配套部署提示词](docs/deploy-harness.md)。

## 验证范围

2026-10-14 在本地 HTTP 服务中使用 Edge / Chromium 验证：

- 页面改版完成 15 项检查，包括桌面、平板和手机布局，真实 Bing 中文搜索与 GitHub 新标签跳转，主题与设置刷新保存，配置导入导出，隐藏内容的实际几何，空导航状态，键盘操作及旧配置、自定义背景兼容。
- 引擎动画另完成 8 项检查，包括 280 毫秒的形变、快速反向切换的起点连续性、终点对齐、不同宽度与多行引擎、手机布局、键盘和减少动态模式，以及新选择立即用于真实搜索。
- 未出现页面脚本异常；手机管理面板保留标题、关闭和保存按钮，正文独立滚动。
- 主页与管理面板主要文字的对比度抽查最低为浅色 **5.09:1**、深色 **5.68:1**。选中滑块的描边对相邻轨道为浅色 **3.39:1**、深色 **3.44:1**。自定义背景使用不透明内容面板保留可读性。

真实 iPhone / Safari 硬件和 Debian 线上部署未验证。示例网站在不同网络中的可达性取决于访客的网络环境。

## 许可证

代码及原创文档使用 [MIT License](LICENSE)。第三方平台的品牌图标仅用于标识对应网站，项目与这些平台没有隶属或背书关系，图标权利与许可不自动适用 MIT；详见 [第三方资源说明](THIRD_PARTY_NOTICES.md)。
