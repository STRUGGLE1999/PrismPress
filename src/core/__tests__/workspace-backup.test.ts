import { expect, it } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { workspaceBackup } from '../../components/workspaceBackup'
it('备份仅当前稿配图，重写可迁移路径并保持原稿与代码示例', async () => {
  const file = new File(['actual-image'], 'cover.png', { type: 'image/png' })
  const asset = { name: 'images/cover.png', file, dataUrl: '', mime: 'image/png', bytes: file.size, mode: 'inline' as const }
  const source = '# 稿件\n\n![封面](images/cover.png)\n\n`![代码](images/cover.png)`\n\n![远图](https://example.com/a.png)'
  const archive = await workspaceBackup(source, { 'images/cover.png': asset, 'unrelated.png': { ...asset, name: 'unrelated.png' } }, [{ name: 'universal', blob: new Blob(['cover']) }])
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()))
  expect(strFromU8(files['原稿.md'])).toBe(source)
  expect(strFromU8(files['可迁移稿.md'])).toContain('![封面](assets/1-cover.png)')
  expect(strFromU8(files['可迁移稿.md'])).toContain('`![代码](images/cover.png)`')
  expect(strFromU8(files['assets/1-cover.png'])).toBe('actual-image')
  expect(strFromU8(files['covers/universal.png'])).toBe('cover')
  expect(Object.keys(files)).not.toContain('unrelated.png')
})

it('空格和括号图片名打包后仍能被重新导入和识别', async () => {
  const file = new File(['image'], '封面 (1).png', { type: 'image/png' })
  const source = '![图](<images/封面 (1).png>)'
  const asset = { name: 'images/封面 (1).png', file, dataUrl: '', mime: 'image/png', bytes: file.size, mode: 'inline' as const }
  const archive = await workspaceBackup(source, { [asset.name]: asset }, [])
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()))
  const portable = strFromU8(files['可迁移稿.md'])
  const { referencedImageNames } = await import('../../components/imageWorkspace')
  const selected = referencedImageNames(portable, Object.keys(files))
  expect(selected.size).toBe(1)
  expect(strFromU8(files[[...selected][0]])).toBe('image')
})
