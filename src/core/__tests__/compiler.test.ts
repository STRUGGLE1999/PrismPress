import { describe, expect, it } from 'vitest'
import { compileArticle as compileRaw } from '../platforms/compile'
const compileArticle: typeof compileRaw = (source, platform, options = {}) => compileRaw(source, platform, { publicationMode: 'deck', ...options })
import { scanImages, classifyImage } from '../images/radar'
import { replaceImageReference } from '../images/local'
import { RICH_THEMES } from '../platforms/rich/theme'

describe('三色图片体检雷达', () => {
  it('区分公开外链、防盗链与本地路径', () => {
    expect(classifyImage('https://pub-xxx.r2.dev/a.png').health).toBe('green')
    expect(classifyImage('https://cdn.jsdelivr.net/gh/a/b.png').health).toBe('green')
    expect(classifyImage('https://img-blog.csdnimg.cn/a.png').health).toBe('yellow')
    expect(classifyImage('https://pic1.zhimg.com/a.png').health).toBe('yellow')
    expect(classifyImage('https://mmbiz.qpic.cn/a.png').health).toBe('yellow')
    expect(classifyImage('./assets/a.png').health).toBe('red')
    expect(classifyImage('/images/a.png').health).toBe('red')
    expect(classifyImage('data:image/png;base64,AAAA').health).toBe('green')
  })

  it('按文件名替换 Markdown 与 HTML 图片引用', () => {
    const markdown = '![图](./assets/architecture.png)\n<img src="assets/architecture.png" alt="x" />'
    const next = replaceImageReference(markdown, 'architecture.png', 'https://pub-x.r2.dev/a.png')
    expect(next).toContain('![图](https://pub-x.r2.dev/a.png)')
    expect(next).toContain('src="https://pub-x.r2.dev/a.png"')
    expect(next).not.toContain('./assets/architecture.png')
  })

  it('汇总全文图片并统计三色数量', () => {
    const report = scanImages(
      [
        { url: './a.png', alt: 'local', line: 1 },
        { url: 'https://pic1.zhimg.com/b.png', alt: 'zhihu', line: 2 },
        { url: 'https://pub-x.r2.dev/c.png', alt: 'r2', line: 3 },
      ],
      '正文\n<img src="https://img-blog.csdnimg.cn/d.png" alt="html" />',
    )
    expect(report.total).toBe(4)
    expect(report.green).toBe(1)
    expect(report.yellow).toBe(2)
    expect(report.red).toBe(1)
    expect(report.healthy).toBe(false)
  })
})

describe('富文本阵营：知乎 / B站标题降维', () => {
  it('renders Chinese quoted bold phrases without literal Markdown markers', async () => {
    const result = await compileArticle('在我职业生涯的大部分时间里，最艰难的决定永远是**“什么时候该停下来止损”**。', 'zhihu')
    expect(result.body).not.toContain('**')
    expect(result.body).toMatch(/“<strong[^>]*>什么时候该停下来止损<\/strong>”/)
  })
  it('H3/H4 编译为 ▎ 与 ◆ 高亮块，正文不出现 ### 符号', async () => {
    const result = await compileArticle(
      '# 标题\n\n## 一级小节\n\n正文\n\n### 三级小节\n\n#### 四级小节',
      'zhihu',
    )
    expect(result.body).toContain('▎')
    expect(result.body).toContain('◆')
    expect(result.body).toContain('三级小节')
    expect(result.body).not.toContain('###')
    expect(result.body).not.toContain('####')
    expect(result.diagnostics.some((item) => item.code === 'HEADING_DEMOTED')).toBe(true)
  })
})

describe('富文本阵营：微信公众号', () => {
  it('外链转文末参考资料角标', async () => {
    const result = await compileArticle(
      '# 标题\n\n参考 [RAG 论文](https://arxiv.org/abs/2005.11401) 与 [LangChain](https://python.langchain.com/docs/)。',
      'wechat',
    )
    expect(result.body).toContain('[1]')
    expect(result.body).toContain('[2]')
    expect(result.body).toContain('参考资料')
    expect(result.body).toContain('https://arxiv.org/abs/2005.11401')
    expect(result.body).not.toContain('<a href="https://arxiv.org')
    expect(result.externalLinks).toHaveLength(2)
  })

  it('宽表格注入横向滑动护盾，代码块锁定深色背景', async () => {
    const markdown = [
      '# 标题',
      '',
      '| A | B | C | D | E |',
      '| --- | --- | --- | --- | --- |',
      '| 1 | 2 | 3 | 4 | 5 |',
      '',
      '```ts',
      'const a = 1',
      '```',
    ].join('\n')
    const result = await compileArticle(markdown, 'wechat')
    expect(result.body).toContain('overflow-x:auto')
    expect(result.body).toContain('min-width:700px')
    expect(result.body).toContain('background:#1E1E2E')
    expect(result.diagnostics.some((item) => item.code === 'TABLE_SHIELD_APPLIED')).toBe(true)
  })

  it('公式编译为内联 SVG', async () => {
    const result = await compileArticle('行内公式 $ E = mc^2 $ 与块级公式：\n\n$$\\sum_{i=1}^{n} x_i$$', 'wechat')
    expect(result.body).toContain('<svg')
    expect(result.body).toContain('pp-math-')
    expect(result.diagnostics.some((item) => item.code === 'FORMULA_FALLBACK')).toBe(false)
  }, 30_000)
})

describe('Markdown 阵营', () => {
  it('CSDN 顶部注入 TOC 并为空代码块补 text', async () => {
    const result = await compileArticle('# 标题\n\n##章节\n\n```\nplain\n```', 'csdn', { injectToc: true })
    expect(result.format).toBe('markdown')
    expect(result.body).toContain('@[TOC](文章目录)')
    expect(result.body).toContain('```text')
    expect(result.body).toContain('## 章节')
  })

})

describe('微信公众号主题', () => {
  it('每套主题输出各自的内联色彩与结构', async () => {
    const markdown = '# 标题\n\n## 核心结论\n\n**重点内容** $ x^2 $\n\n```ts\nconst a = 1\n```'
    const results = await Promise.all(
      RICH_THEMES.map((theme) => compileArticle(markdown, 'wechat', { themeId: theme.id })),
    )

    const native = results[0]
    const parchment = results[1]
    const morandi = results[2]
    const warm = results[3]
    const terminal = results[4]
    expect(native.body).toContain('background:#FFFFFF')
    expect(native.body).toContain('font-size:17px;line-height:1.6;')

    expect(parchment.body).toContain('#FAF7F0')
    expect(parchment.body).toContain('border-bottom:3px double')
    expect(morandi.body).toContain('border-radius:999px')
    expect(warm.body).toContain('#EAF3E4')
    expect(warm.body).toContain('#F9D976')
    expect(terminal.body).toContain('#0B1220')
    expect(terminal.body).toContain('#28C840')
    expect(terminal.body).toContain('background:#1E1E2E')
  })
})

describe('公式边界与源码行映射', () => {
  it('公众号块级公式输出 SVG 视觉卡片，不残留 $$ 源码', async () => {
    const markdown = [
      '# 公式测试',
      '',
      '行内公式 $ \\frac{a}{b} $ 与行内 $ E=mc^2 $。',
      '',
      '$$',
      '\\begin{aligned}',
      'a &= b + c \\\\',
      'd &= e - f',
      '\\end{aligned}',
      '$$',
    ].join('\n')
    const result = await compileArticle(markdown, 'wechat')
    expect(result.body).toContain('FORMULA · SVG')
    expect(result.body).toContain('<svg')
    expect(result.body).not.toContain('$$')
    expect(result.body).not.toContain('\\begin{aligned}')
    expect(result.diagnostics.some((item) => item.code === 'FORMULA_FALLBACK')).toBe(false)
  }, 30_000)

  it('知乎公式块带「LaTeX 已净化」高亮标识', async () => {
    const result = await compileArticle('正文 $ x^2 $\n\n$$\na = b\n$$', 'zhihu')
    expect(result.body).toContain('LaTeX 已净化')
    expect(result.body).toContain('<svg')
    expect(result.body).not.toContain('$$')
  }, 30_000)

  it('富文本块级元素带可回查的源码行号', async () => {
    const markdown = '# 标题\n\n段落内容\n\n### 三级标题\n\n```ts\nconst a = 1\n```'
    const result = await compileArticle(markdown, 'wechat')
    expect(result.body).not.toContain('data-source-line="1"') // 标题由预览及目标平台的独立标题栏显示
    expect(result.body).toContain('data-source-line="3"')
    expect(result.body).toContain('data-source-line="5"')
    expect(result.body).toContain('data-source-line="7"')
  })

  it('块级公式净水插入空行后，后续标题仍映射回原始行号', async () => {
    const result = await compileArticle('正文\n$$\na = b\n$$\n## 标题', 'wechat')
    expect(result.body).toContain('data-source-line="1"')
    expect(result.body).toContain('data-source-line="5"')
  })

  it('作者已手写章节编号时，不再叠加主题自动编号', async () => {
    const result = await compileArticle('## 一、背景\n\n## 二、方案', 'wechat', { themeId: 'terminal' })
    expect(result.body).toContain('一、背景')
    expect(result.body).not.toContain('[01]')
    expect(result.body).not.toContain('[02]')
  })
})

describe('视觉图集阵营：小红书 / 抖音 3:4 滑动知识图集', () => {
  it('小红书将 Markdown 长文拆解为 3:4 卡片流并生成 ≤20 字标题与 #话题文案', async () => {
    const markdown = [
      '# 从 RAG 到 Agent：企业知识库改造的完整复盘指南',
      '',
      '> 真正决定问答上限的是文档切分与重排序。',
      '',
      '## 一、为什么要重做知识库',
      '检索准确率长期卡在 62%，答案找不到。',
      '',
      '## 二、父子块切分法',
      '- 父块保留完整上下文',
      '- 子块负责高精度向量召回',
    ].join('\n')

    const result = await compileArticle(markdown, 'xiaohongshu', { deckMode: 'summary' })
    expect(result.format).toBe('deck')
    expect(result.slides).toBeDefined()
    expect(result.slides!.length).toBeGreaterThanOrEqual(2)
    expect(result.slides!.length).toBeLessThanOrEqual(8)
    expect(result.slides![0].kind).toBe('section')
    expect(result.slides![result.slides!.length - 1].kind).toBe('section')
    expect(result.body).not.toMatch(/【20字内|非全文|核心图集 · 共/)
    expect(result.body).toContain('#')
    expect(result.diagnostics.some((d) => d.code === 'DECK_GENERATED')).toBe(false)
  })

  it('抖音图文生成图集与中性章节摘要文案', async () => {
    const result = await compileArticle('# 标题\n\n## 一、核心方案\n\n内容段落说明。', 'douyin', { deckMode: 'summary' })
    expect(result.format).toBe('deck')
    expect(result.slides).toBeDefined()
    expect(result.body).toContain('核心方案')
    expect(result.body).not.toMatch(/核心图集|20字内|非全文/)
  })
})

describe('章节摘要图集的内容边界', () => {
  it('保留超过六个有效章节，包括原文最后一个章节', async () => {
    const markdown = '# 八节文章\n\n' + Array.from({ length: 8 }, (_, index) =>
      `## 第${index + 1}节\n\n这是第${index + 1}节的原文内容。`,
    ).join('\n\n')
    const result = await compileArticle(markdown, 'xiaohongshu', { deckMode: 'full' })
    const sections = result.slides!.filter((slide) => slide.kind === 'section')
    expect(sections).toHaveLength(8)
    expect(sections[7].title).toBe('第8节')
    expect(sections[7].bullets.join('')).toContain('第8节的原文内容')
  })

  it('配套文案不编造作者经历，也不添加预设人设', async () => {
    const markdown = '# 文档评估\n\n## 核心方法\n\n- 使用固定样例核对回答。'
    const results = await Promise.all(['xiaohongshu', 'douyin'].map((id) =>
      compileArticle(markdown, id as 'xiaohongshu' | 'douyin', { deckMode: 'summary' }),
    ))
    for (const result of results) {
      expect(result.body).not.toMatch(/花了整整一周|姐妹们|家人们|搞钱必看|提升前 3 张图划阅率/)
      expect(result.body).not.toMatch(/核心图集|20字内|非全文/)
      expect(result.body).toContain('使用固定样例核对回答')
    }
  })

  it('同一章节保留用于预览和导出的表格与公式', async () => {
    const result = await compileArticle('# 数学笔记\n\n## 计算示例\n\n| 输入 | 输出 |\n| --- | --- |\n| 2 | 4 |\n\n$$x^2$$', 'xiaohongshu', { deckMode: 'summary' })
    const section = result.slides!.find((slide) => slide.kind === 'section')!
    expect(section.tableRows).toEqual([['输入', '输出'], ['2', '4']])
    expect(section.formulaSvg).toContain('<svg')
  })
})

describe('公众号正文排版', () => {
  it.each(RICH_THEMES.map((theme) => theme.id))('%s 的字体列表不会截断 HTML 样式属性', async (themeId) => {
    const result = await compileArticle('# 标题\n\n中文与 English 混排正文。\n\n```js\nconst count = 1\n```', 'wechat', { themeId })
    const containerStyle = result.body.match(/^<section style="([^"]*)"/)?.[1]
    expect(containerStyle).toContain('Microsoft YaHei')
    expect(containerStyle).toContain(themeId === 'native' ? 'font-size:17px;line-height:1.6;' : 'font-size:16px;line-height:1.75;')
    expect(result.body).toContain('letter-spacing:normal;')
    expect(result.body).not.toMatch(/font-family:"/)
  })
})

describe('本地配图匹配', () => {
  it('支持中文、空格、括号和编码路径，保留标题', () => {
    const markdown = '![图](<images/截图 (1).png> "配图标题")\n![图二](images/截图%20%281%29.png)'
    const result = replaceImageReference(markdown, '文章/images/截图 (1).png', 'data:image/png;base64,AAAA')
    expect(result.match(/data:image\/png;base64,AAAA/g)).toHaveLength(2)
    expect(result).toContain('"配图标题"')
  })
  it('不会改写代码示例或同名远程图片', () => {
    const markdown = '```md\n![示例](images/a.png)\n```\n\n![远程](https://example.com/a.png)\n\n![本地](images/a.png)'
    const result = replaceImageReference(markdown, 'a.png', 'data:image/png;base64,AAAA')
    expect(result).toContain('![示例](images/a.png)')
    expect(result).toContain('https://example.com/a.png')
    expect(result.match(/data:image\/png;base64,AAAA/g)).toHaveLength(1)
  })
  it('同名文件有歧义时按目录匹配，不猜测裸文件名', () => {
    const markdown = '![A](a/图.png)\n![B](b/图.png)\n![未知](图.png)'
    const result = replaceImageReference(markdown, '文章/a/图.png', 'data:image/png;base64,AAAA', false)
    expect(result).toContain('![A](data:image/png;base64,AAAA)')
    expect(result).toContain('![B](b/图.png)')
    expect(result).toContain('![未知](图.png)')
  })
})

it('公式链接过滤危险协议，保留正常公式和HTTPS链接', async () => {
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,test', 'java\tscript:alert(1)', 'java\nscript:alert(1)', '&#106;avascript:alert(1)', 'java&#x73;cript:alert(1)']) {
    const result = await compileArticle(`$\\href{${url}}{x}$`, 'zhihu')
    expect(result.body).not.toMatch(/<a\b[^>]*\bhref=/i)
  }
  const normal = await compileArticle('$x^2 + y^2$\n\n$\\href{https://example.com}{x}$', 'zhihu')
  expect(normal.body).toContain('<svg')
  expect(normal.body).toContain('href="https://example.com"')
})

it('四反引号中的三反引号示例与连续空行原样保留', async () => {
  const code = '````md\n```js\nconst a = 1\n```\n##不应改写\n\n\n\n结尾\n````'
  const result = await compileArticle('# 示例\n\n' + code, 'csdn')
  expect(result.sanitize.output).toContain('##不应改写')
  expect(result.body).toContain(code)
})

it('图集实际正文与首图使用已提炼的标题和标签', async () => {
  const result = await compileArticle('# 原标题\n\n## 背景\n\n具体内容。', 'xiaohongshu', {
    passport: { title: '新主标题', shortTitle20: '新短标题', tags: ['新话题'] },
  })
  expect(result.body).toContain('新短标题')
  expect(result.body).toContain('#新话题')
  expect(result.slides?.[0].title).toBe('新主标题')
})

it('keeps a real opening H2 in the copied rich body', async () => {
  const result = await compileArticle('## 第一节\n\n正文', 'zhihu')
  expect(result.body).toContain('第一节')
  expect(result.body).toContain('data-source-line="1"')
})

it('renders bold next to Chinese quote and bracket boundaries', async () => {
 const result = await compileArticle('这是**“由你自己决定”的习惯**，也是**工程判断力（Judgment）**活下来。', 'zhihu')
 expect(result.body).not.toContain('**')
 expect(result.body).toContain('<strong')
})

it('copies Markdown body without a duplicate title or an unpreviewed generated TOC', async () => {
 for (const id of ['juejin', 'csdn'] as const) {
  const result = await compileArticle('# 文章标题\n\n## 章节\n\n正文', id)
  expect(result.body).not.toContain('# 文章标题')
  expect(result.body).not.toContain('@[TOC]')
  expect(result.body).toContain('## 章节')
  expect(result.previewHtml).toContain('章节')
 }
})

it('keeps Douyin links as visible text instead of unsupported pasted anchors', async () => {
 const result = await compileArticle('# 标题\n\n[来源](https://example.com) 与 [章节](#section)', 'douyin', { publicationMode: 'article' })
 expect(result.body).not.toContain('<a ')
 expect(result.body).toContain('来源（https://example.com）')
 expect(result.body).toContain('章节')
})
