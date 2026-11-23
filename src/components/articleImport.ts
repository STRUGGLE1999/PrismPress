export function articleFiles(files: File[]): File[] {
  return files.filter(file => /\.(md|markdown|txt)$/i.test(file.name) || file.type === 'text/markdown')
}

/** Resolve folder images relative to the chosen article, keeping other articles isolated. */
export function filesForArticle(files: File[], article: File): File[] {
  const path = article.webkitRelativePath
  if (!path) return [article, ...files.filter(file => !articleFiles([file]).length)]
  const directory = path.slice(0, path.lastIndexOf('/') + 1)
  return [article, ...files.filter(file => file.webkitRelativePath.startsWith(directory) && !articleFiles([file]).length)
    .map(file => new File([file], file.webkitRelativePath.slice(directory.length), { type: file.type, lastModified: file.lastModified }))]
}
