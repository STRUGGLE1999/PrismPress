export interface CoverJobResult { blob: Blob; saved: boolean }

const jobs = new Map<string, Promise<CoverJobResult>>()

export function pendingCover(key: string) {
  return jobs.get(key)
}

export function startCover(key: string, generate: () => Promise<CoverJobResult>) {
  const pending = jobs.get(key)
  if (pending) return pending
  const task = generate()
  jobs.set(key, task)
  void task.finally(() => { jobs.delete(key) }).catch(() => {})
  return task
}
