import { describe, expect, it } from 'vitest'
import { detachInlineImages, materializeImages, imageChangeKey } from '../../components/imageWorkspace'
import { compileArticle } from '../platforms/compile'

describe('原稿与本地图片分离', () => {
  it('迁移旧内联草稿后，短路径可重新生成原图数据且保留代码示例', () => {
    const data = 'data:image/png;base64,aGVsbG8='
    const source = `# 标题\n\n![图片](${data} "标题")\n\n\`\`\`md\n![示例](${data})\n\`\`\``
    const recovered = detachInlineImages(source)
    expect(recovered.markdown).toContain('![图片](images/导入图片-1.png "标题")')
    expect(recovered.markdown).toContain(`![示例](${data})`)
    expect(materializeImages(recovered.markdown, recovered.assets)).toBe(source)
    expect(recovered.markdown.split('\n')).toHaveLength(source.split('\n').length)
  })
  it('不修改干净原稿，公众号正文仍携带图片数据和对应行号', async () => {
    const recovered = detachInlineImages('# 标题\n\n![原图](data:image/png;base64,aGVsbG8=)\n\n后续段落。')
    const original = recovered.markdown
    const compiled = await compileArticle(materializeImages(original, recovered.assets), 'wechat')
    expect(recovered.markdown).toBe(original)
    expect(original).not.toContain('base64')
    expect(compiled.body).toContain('src="data:image/png;base64,aGVsbG8="')
    expect(compiled.body).toContain('data-source-line="5"')
    expect(compiled.plainText).not.toContain('base64')
  })
  it('更换同一路径图片会使复制记录失效，记录不包含图片数据', () => {
    expect(imageChangeKey('article:image-a')).not.toBe(imageChangeKey('article:image-b'))
    expect(imageChangeKey('data:image/png;base64,aGVsbG8=')).not.toContain('base64')
  })
})
