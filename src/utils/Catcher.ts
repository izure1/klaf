type FulfilledResult<T> = [undefined, T]
type RejectedResult = [Error]

export class Catcher {
  static CatchError<T>(promise: Promise<T>): Promise<FulfilledResult<T>|RejectedResult> {
    return promise
      .then((v) => [undefined, v] as FulfilledResult<T>)
      .catch((v) => [v])
  }
}
