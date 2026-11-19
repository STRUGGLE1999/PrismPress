import { zipSync, strToU8 } from 'fflate'
import { rewriteImageUrls } from '../core/images/local'
import { imageSourceNames } from './imageWorkspace'
import type { LocalImageAsset } from './localImage'

export async function workspaceBackup(markdown: string, assets: Record<string, LocalImageAsset>, covers: { name: string; blob?: Blob }[]) {
  const entries: Record<string, Uint8Array> = { '原稿.md': strToU8(markdown) }
  const mapping: Record<string, string> = {}
  const selected = imageSourceNames(markdown, Object.keys(assets))
  let index = 0
  for (const [source, name] of Object.entries(selected)) {
    const target = `assets/${++index}-${name.split(/[\\/]/).pop()!.replace(/[^\p{L}\p{N}._-]/gu, '_')}`
    entries[target] = new Uint8Array(await assets[name].file.arrayBuffer())
    mapping[source] = target
  }
  entries['可迁移稿.md'] = strToU8(rewriteImageUrls(markdown, (source) => mapping[source]))
  for (const cover of covers) {
    if (cover.blob) entries[`covers/${cover.name}.png`] = new Uint8Array(await cover.blob.arrayBuffer())
  }
  entries['备份说明.txt'] = strToU8('原稿.md 保留原始内容；可迁移稿.md 已将本地配图路径改为 assets 目录。解压后可将可迁移稿与 assets 一起导入 PrismPress。远程图片链接保持原样，未下载远程素材；封面仅含当前标题和正文已缓存的生成结果。')
  return new Blob([zipSync(entries, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}
