import { describe, expect, it } from 'vitest'
import { articleFiles, filesForArticle } from '@/components/articleImport'

function file(path: string, text = 'content') {
  const value = new File([text], path.split('/').pop()!)
  Object.defineProperty(value, 'webkitRelativePath', { value: path })
  return value
}

describe('文章文件夹导入', () => {
  it('识别多个正文供用户选择，不将图片或PDF当正文', () => {
    const files = [file('root/a.md'), file('root/b.MARKDOWN'), file('root/c.txt'), file('root/a.pdf'), file('root/a.png')]
    expect(articleFiles(files)).toEqual(files.slice(0, 3))
  })
  it('选择一篇后只取其目录配图，并保留子目录相对路径与字节', async () => {
    const article = file('root/one/article.md')
    const files = [article, file('root/one/assets/cover.png', 'first'), file('root/two/cover.png', 'other'), file('root/two/other.md')]
    const chosen = filesForArticle(files, article)
    expect(chosen.map(f => f.name)).toEqual(['article.md', 'assets/cover.png'])
    expect(await chosen[1].text()).toBe('first')
    expect(files[1].webkitRelativePath).toBe('root/one/assets/cover.png')
  })
  it('普通文件选择支持纯文字和同时选择图片，不混入另一篇正文', () => {
    const article = new File(['text'], 'a.md')
    const image = new File(['bytes'], 'cover.png')
    expect(filesForArticle([article], article)).toEqual([article])
    expect(filesForArticle([article, image, new File(['other'], 'b.md')], article)).toEqual([article, image])
  })
})
