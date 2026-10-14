// 从管理设置导出的 config.js 可直接覆盖本文件。
window.NAV_CONFIG = {
  "version": 1,
  "name": "起点",
  "defaultEngine": "bing",
  "showEngineLabel": true,
  "intro": {"eyebrow":"YOUR PERSONAL START PAGE","title":"从这里出发。","subtitle":"搜你所想，去你常去。"},
  "engines": [
    {"id":"bing","name":"Bing","url":"https://www.bing.com/search?q={q}"},
    {"id":"google","name":"Google","url":"https://www.google.com/search?q={q}"},
    {"id":"baidu","name":"百度","url":"https://www.baidu.com/s?wd={q}"},
    {"id":"duckduckgo","name":"DuckDuckGo","url":"https://duckduckgo.com/?q={q}"}
  ],
  "sites": [
    {"name":"Google","url":"https://www.google.com/","badge":"G","description":"探索整个互联网"},
    {"name":"GitHub","url":"https://github.com/","badge":"GH","description":"代码与灵感的交汇处"},
    {"name":"哔哩哔哩","url":"https://www.bilibili.com/","badge":"哔","description":"发现有趣的每一天"},
    {"name":"知乎","url":"https://www.zhihu.com/","badge":"知","description":"在这里，找到答案"},
    {"name":"YouTube","url":"https://www.youtube.com/","badge":"YT","description":"看见更大的世界"},
    {"name":"ChatGPT","url":"https://chatgpt.com/","badge":"AI","description":"一起想，一起创造"},
    {"name":"Gmail","url":"https://mail.google.com/","badge":"M","description":"你的邮件与日常"},
    {"name":"Notion","url":"https://www.notion.so/","badge":"N","description":"整理想法与生活"},
    {"name":"豆瓣","url":"https://www.douban.com/","badge":"豆","description":"书影音里的好时光"},
    {"name":"少数派","url":"https://sspai.com/","badge":"π","description":"找到更好的生活方式"},
    {"name":"V2EX","url":"https://www.v2ex.com/","badge":"V2","description":"创意与技术的社区"},
    {"name":"淘宝","url":"https://www.taobao.com/","badge":"淘","description":"挑选生活中的小美好"}
  ],
  "appearance": {"type":"solid","light":"#f5f5f7","dark":"#1c1c1e","image":""}
};
