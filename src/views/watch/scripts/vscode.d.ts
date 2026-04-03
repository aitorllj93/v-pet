interface VSCodeApi {
  postMessage<T>(message: T): void
  setState<T>(state: T): void
  getState<T>(): T | undefined
}

declare function acquireVsCodeApi(): VSCodeApi;