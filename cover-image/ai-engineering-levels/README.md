# AI 工程五级进阶 · 三尺寸封面

源文：`test-blog/AI工程项目五级进阶（CSDN发布版）.md`。原文主标题为“为什么很多 AI 工程项目无法帮助求职者拿到工作？”，封面使用副标题中的“五级进阶”作为主题。五个阶梯对应基础应用、知识增强、工具智能体、企业系统、自主改进。

设计使用 baoyu-cover-image 技能，栅格图通过内置 image_gen 工具生成。三种比例分别出图，完整提示词位于 `prompts/`。使用无水印、中文、概念架构数字插画的设计方向。项目偏好保存在 `.baoyu-skills/baoyu-cover-image/EXTEND.md`，已按用户确认开启快速模式。

| 文件 | 用途 | 下载验证尺寸 |
| --- | --- | --- |
| prismpress-cover-2.35x1.png | 公众号头条 | 900×383 |
| prismpress-cover-16x9.png | 技术社区通用 | 1280×720 |
| prismpress-cover-3x4.png | 小红书 / 抖音首图 | 1080×1440 |

网页使用的生成原图在 `public/covers/ai-engineering-*.png`。Canvas 仅将完整图缩放到导出尺寸，没有覆盖、重画或修补图片中的文字。上述三个文件由网页真实下载流程获得。

专属封面仅用于匹配本篇主标题的源稿；其他文章继续使用通用模板，避免把本篇标题错误套到其他文章上。这不是运行时 AI 生图功能。

## 真实图床对照

从用户提供的 CSDN 已发布文章 `https://blog.csdn.net/qq_45257495/article/details/163436107` 提取并按图片说明逐一核对了7个图床地址。地址映射见 `test-blog/AI工程项目五级进阶_图床地址对照.json`。对照版正文和原稿一致，只替换图片 URL。

2026-11-17 本地 Chrome 核验：Cloudflare 版 7 张全部加载；CSDN 图床版 7 张均未能加载。这只代表本次环境的加载结果，未据此确认 HTTP 状态或失败原因。网站图片雷达仍是域名风险分类，不是实时联网检测。

验证截图与记录：`output/playwright/real-article-*`、`output/playwright/csdn-image-comparison.*`。
