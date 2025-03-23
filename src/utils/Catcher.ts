type FulfilledResult<T> = [undefined, T]
type RejectedResult = [Error]
export type CatchResult<T> = FulfilledResult<T>|RejectedResult

export class Catcher {
  static async CatchError<T>(promise: Promise<T>): Promise<CatchResult<T>> {
    return promise
      .then((v) => [undefined, v] as FulfilledResult<T>)
      .catch((v) => [v])
  }
}
