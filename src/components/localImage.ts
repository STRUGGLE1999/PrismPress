export interface LocalImageAsset {
  name: string
  file: File
  dataUrl: string
  mime: string
  bytes: number
  mode: 'inline' | 'remote'
  remoteUrl?: string
}
