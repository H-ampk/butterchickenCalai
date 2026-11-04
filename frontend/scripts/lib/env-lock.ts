type EnvQueueState = {
  apiSourceEnvQueue?: Promise<void>
}

const state = globalThis as EnvQueueState

/** テスト間で process.env の書き換えが重ならないように直列化する。 */
export function runWithEnvLock<T>(run: () => Promise<T>): Promise<T> {
  const previous = state.apiSourceEnvQueue ?? Promise.resolve()
  const result = previous.then(run, run)
  state.apiSourceEnvQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
