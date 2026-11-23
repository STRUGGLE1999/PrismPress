import engineeringCsdn from '../../test-blog/AI工程项目五级进阶（CSDN图床对照版）.md?raw'
import engineeringLevels from '../../test-blog/AI工程项目五级进阶（CSDN发布版）.md?raw'
import agentConcepts from '../../test-blog/30个智能体工程核心概念（CSDN Cloudflare版）.md?raw'
import type { ThemePreset } from '@/core'

export interface SampleArticle {
  id: string
  name: string
  subtitle: string
  tag: string
  accent: string
  themeId: ThemePreset
  markdown: string
}

const AI_ARTICLE = `# 从 RAG 到 Agent：一次真实的企业知识库改造复盘

> 这不是一篇概念科普，而是一次踩满坑的工程复盘。文中的所有公式、表格和代码，都可以直接粘到七个平台做交叉验证。

##一、为什么要重做知识库

我们团队的知识库最初只有 300 篇文档，检索准确率却长期卡在 62%。用户最常问的一句话是：“答案到底在哪一页？”

${'\u200b'}更麻烦的是，同一份 Markdown 发到不同平台后，标题会变成 \`##一、背景\`，公式会变成赤裸裸的源码。

## **核心结论**

> 真正拖垮体验的不是模型能力，而是**文档切分粒度**与**召回后的重排序**。

### 1.1 切分策略决定上限

我们对比了三种切分方式：

| 切分方式 | 平均块长 | 召回率 | 幻觉率 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| 固定窗口 512 | 512 | 68% | 21% | 快速验证 |
| 语义段落切分 | 280 | 81% | 12% | 通用知识库 |
| 父子块 + 摘要 | 180 | 89% | 6% | 高精度问答 |

#### 1.1.1 父子块的关键细节

父块负责保留上下文，子块负责精准召回。相似度计算可以写成：

$ sim(q, d) = \\frac{q \\cdot d}{\\|q\\| \\|d\\|} $

排序阶段我们使用了下面的加权公式$$ score = \\alpha \\cdot sim + \\beta \\cdot recency $$其中 $\\alpha + \\beta = 1$，用来平衡相关性与新鲜度。

$$
\\mathcal{L}(\\theta) = -\\sum_{i=1}^{n} y_i \\log p_i
$$

## 二、Agent 编排的工程实现

我们把检索、工具调用和答案校验串成一条可观测链路。

\`\`\`ts
// 注意：代码块里的 ## 不应被 Auto-Sanitizer 修改
const plan = await planner.invoke({ question, context: "## 原始标题" })
const answer = await executor.run(plan)
\`\`\`

### 2.1 三类常见失败

1. 检索到了正确文档，但重排把答案排到第 9 位；
2. 工具调用超时后没有降级策略；
3. 答案校验只检查格式，不检查事实。

- [x] 接入重排序模型
- [ ] 为工具调用增加熔断
- [ ] 建立答案事实校验集

## 三、图片与链接的跨端体检

架构图如下：

![系统架构](./assets/architecture.png)

这张图是从 CSDN 直接复制的，跨平台大概率 403：

![CSDN 截图](https://img-blog.csdnimg.cn/20240101120000.png)

这张图放在 Cloudflare R2 上，七端畅通：

![R2 架构图](https://pub-xxxx.r2.dev/prismpress/architecture.png)

参考资料：[RAG 原始论文](https://arxiv.org/abs/2005.11401) 与 [LangChain 文档](https://python.langchain.com/docs/)。

价格测试：一杯咖啡 $ 5 美元，不应该被当成公式。

## 四、复盘清单

| 指标 | 改造前 | 改造后 | 提升 |
| --- | --- | --- | --- |
| 召回率 | 62% | 89% | +27pt |
| 幻觉率 | 24% | 6% | -18pt |

\`\`\`
没有语言标识的代码块，CSDN 会补成 text
\`\`\`

---

*本文由 PrismPress 棱镜发布台编译验证。*
`

export const LEGACY_DEMO_MARKDOWN = AI_ARTICLE

export const SAMPLE_ARTICLES: SampleArticle[] = [
  {
    id: 'real-engineering-levels',
    name: 'AI 工程五级进阶',
    subtitle: '真实博客原稿 · 7 张 Cloudflare 配图 · 五级框架对比表',
    tag: '真实博客',
    accent: '#7C5CFF',
    themeId: 'native',
    markdown: engineeringLevels,
  },
  {
    id: 'real-agent-concepts',
    name: '智能体核心概念',
    subtitle: '真实博客原稿 · 完整正文与 Cloudflare 配图',
    tag: '真实博客',
    accent: '#5BA3A8',
    themeId: 'native',
    markdown: agentConcepts,
  },
]

export const DEFAULT_SAMPLE = SAMPLE_ARTICLES[0]

export const CSDN_COMPARISON_SAMPLE: SampleArticle = {
    id: 'real-engineering-csdn',
    name: 'AI 工程 · CSDN 图床',
    subtitle: '同篇正文 · 7 张真实 CSDN 图床图片 · 与 Cloudflare 版对照',
    tag: '图床对照',
    accent: '#FC5531',
    themeId: 'native',
    markdown: engineeringCsdn,
  }
