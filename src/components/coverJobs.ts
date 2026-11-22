export interface CoverJobResult { blob: Blob; saved: boolean }

const jobs = new Map<string, Promise<CoverJobResult>>()
const unsaved = new Map<string, CoverJobResult>()

export function unsavedCover(key: string) {
  return unsaved.get(key)
}

export function pendingCover(key: string) {
  return jobs.get(key)
}

export function startCover(key: string, generate: () => Promise<CoverJobResult>) {
  const pending = jobs.get(key)
  if (pending) return pending
  const task = generate()
  jobs.set(key, task)
  void task.then(result => { if (result.saved) unsaved.delete(key); else unsaved.set(key, result) }, () => {})
  void task.finally(() => { jobs.delete(key) }).catch(() => {})
  return task
}
