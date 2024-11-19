import type { Emitter } from 'mitt'
import mitt from 'mitt'

type ThrottlingCallback = () => Promise<void>

type ThrottlingEvents = {
  [key: string]: Error|undefined
}

interface ThrottlingExecution {
  id: string
  handleId: NodeJS.Timeout|number
  callback: () => Promise<void>
}

export class Throttling {
  private readonly _executions: Map<string, ThrottlingExecution>
  private readonly _emitter: Emitter<ThrottlingEvents>
  private readonly _delay: number

  protected static async CatchError<T>(promise: Promise<T>): Promise<[undefined, T]|[Error]> {
    return await promise
      .then((v) => [undefined, v] as [undefined, T])
      .catch((err) => [err])
  }

  constructor(delay: number = 0) {
    this._executions = new Map()
    this._emitter = mitt()
    this._delay = delay
  }

  private _stopExecution(id: string) {
    const execution = this._executions.get(id)
    if (!execution) {
      return
    }
    clearTimeout(execution.handleId)
  }

  execute(id: string, callback: ThrottlingCallback): Promise<void> {
    return new Promise((resolve, reject) => {
      this._stopExecution(id)
      const handleId = setTimeout(async () => {
        this._executions.delete(id)
        const [err] = await Throttling.CatchError(callback())
        this._emitter.emit(id, err)
      }, this._delay)
      this._executions.set(id, {
        id,
        handleId,
        callback,
      })
      const onFinally = (err?: Error|undefined) => {
        this._executions.delete(id)
        this._emitter.off(id, onFinally)
        if (err instanceof Error) {
          reject(err)
        }
        else {
          resolve()
        }
      }
      this._emitter.on(id, onFinally)
    })
  }

  cancel(id: string): void {
    const execution = this._executions.get(id)
    if (!execution) {
      return
    }
    this._stopExecution(id)
    this._emitter.emit(id, new Error('Canceled'))
  }
}
