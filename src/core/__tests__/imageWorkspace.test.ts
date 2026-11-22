import { describe, expect, it } from 'vitest'
import { detachInlineImages, imageSources, imageChangeKey, referencedImageNames, importedImageAssets } from '../../components/imageWorkspace'
import { compileArticle } from '../platforms/compile'

describe('原稿与本地图片分离', () => {
  it('迁移旧内联草稿后，短路径可重新生成原图数据且保留代码示例', () => {
    const data = 'data:image/png;base64,aGVsbG8='
    const source = `# 标题\n\n![图片](${data} "标题")\n\n\`\`\`md\n![示例](${data})\n\`\`\``
    const recovered = detachInlineImages(source)
    expect(recovered.markdown).toContain('![图片](images/导入图片-1.png "标题")')
    expect(recovered.markdown).toContain(`![示例](${data})`)
    expect(imageSources(recovered.markdown, recovered.assets)['images/导入图片-1.png']).toBe(data)
    expect(recovered.markdown.split('\n')).toHaveLength(source.split('\n').length)
  })
  it('不修改干净原稿，公众号正文仍携带图片数据和对应行号', async () => {
    const recovered = detachInlineImages('# 标题\n\n![原图](data:image/png;base64,aGVsbG8=)\n\n后续段落。')
    const original = recovered.markdown
    const compiled = await compileArticle(original, 'wechat', { imageSources: imageSources(original, recovered.assets) })
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


describe('大文件夹配图筛选', () => {
  it('两千张无关图片不进入解码列表，只选中文章引用的图片', () => {
    const names = Array.from({ length: 2000 }, (_, index) => `文件夹/杂图/${index}.png`)
    names.push('文件夹/images/封面 (1).png')
    expect([...referencedImageNames('![封面](<images/封面 (1).png>)\n![远程](https://example.com/2.png)', names)])
      .toEqual(['文件夹/images/封面 (1).png'])
  })
  it('不猜测同名图片，目录明确时才选择', () => {
    const names = ['资料/a/图.png', '资料/b/图.png']
    expect(referencedImageNames('![图](图.png)', names).size).toBe(0)
    expect([...referencedImageNames('![图](a/图.png)', names)]).toEqual(['资料/a/图.png'])
  })
  it('识别 HTML 图片，忽略代码中的图片例子', () => {
    expect([...referencedImageNames('<img src="images/a.png">\n\n```md\n![示例](b.png)\n```', ['目录/images/a.png', '目录/b.png'])])
      .toEqual(['目录/images/a.png'])
  })
})


it('编译后图片数据不进入净化原稿，行号和预览图片仍正确', async () => {
  const source = '# 标题\n\n![图](images/a.png)\n\n正文'
  const data = 'data:image/png;base64,' + 'A'.repeat(100000)
  for (const platform of ['wechat', 'csdn'] as const) {
    const result = await compileArticle(source, platform, { imageSources: { 'images/a.png': data } })
    expect(result.sanitize.input).toBe(source)
    expect(result.sanitize.output).not.toContain('base64')
    expect(result.images.red).toBe(0)
    expect(platform === 'wechat' ? result.body : result.previewHtml).toContain(data)
  }
})

 it('新稿不沿用上一稿同路径素材，补配图才合并', () => {
  const old = detachInlineImages('![图](data:image/png;base64,b2xk)').assets
  expect(imageSources('![图](images/导入图片-1.png)', importedImageAssets(old, {}, true))).toEqual({})
  expect(importedImageAssets(old, {}, false)).toEqual(old)
})

it('uses retained image bytes for clipboard imports even after a public URL was saved', () => {
  const dataUrl = 'data:image/png;base64,aGVsbG8='
  const assets = { 'a.png': { name: 'a.png', file: new File(['hello'], 'a.png'), dataUrl, mime: 'image/png', bytes: 5, mode: 'remote' as const, remoteUrl: 'https://example.com/a.png' } }
  expect(imageSources('![图](a.png)', assets, true)['a.png']).toBe(dataUrl)
  expect(imageSources('![图](a.png)', assets)['a.png']).toBe('https://example.com/a.png')
})
