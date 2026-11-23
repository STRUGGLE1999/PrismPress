/** Stop waiting without letting a late result mark the UI as successful. */
export function waitForTask<T>(task: Promise<T>, signal: AbortSignal, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason?.name === 'TimeoutError' ? new Error(message) : signal.reason)
    if (signal.aborted) { task.catch(() => {}); abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
