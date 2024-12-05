import { Catcher } from './Catcher'

export class Debounce {
  readonly delay: number
  private _timeouts: Map<string, NodeJS.Timeout>
  private _activePromises: Map<string, { resolve: Function; reject: Function }[]>
  private _activeExecution: Map<string, Promise<any>>

  constructor(delay: number) {
    this.delay = delay
    this._timeouts = new Map()
    this._activePromises = new Map()
    this._activeExecution = new Map()
  }

  async execute<T = any>(id: string, callback: () => Promise<T>): Promise<T> {
    if (this._timeouts.has(id)) {
      clearTimeout(this._timeouts.get(id)!)
    }

    return new Promise<T>((resolve, reject) => {
      if (!this._activePromises.has(id)) {
        this._activePromises.set(id, [])
      }
      this._activePromises.get(id)!.push({ resolve, reject })

      const timeout = setTimeout(async () => {
        this._timeouts.delete(id)

        const promises = this._activePromises.get(id) || []
        this._activePromises.delete(id)

        const execute = async () => {
          const result = await callback()
          for (const { resolve } of promises) resolve(result)
          return result
        }
        const execution = execute()
        const [err] = await Catcher.CatchError(execution)
        if (err instanceof Error) {
          for (const { reject } of promises) reject(err)
        }
        else {
          this._activeExecution.set(id, execution)
          await execution.finally(() => this._activeExecution.delete(id))
        }
      }, this.delay)

      this._timeouts.set(id, timeout)
    })
  }

  cancel(id: string): void {
    if (this._timeouts.has(id)) {
      clearTimeout(this._timeouts.get(id)!)
      this._timeouts.delete(id)
    }

    const promises = this._activePromises.get(id) || []
    this._activePromises.delete(id)

    const error = new Error(`Execution with id "${id}" was canceled.`)
    for (const { reject } of promises) reject(error)
  }

  async done<T = any>(id: string): Promise<T|undefined> {
    if (!this._timeouts.has(id) && !this._activePromises.has(id)) {
      return Promise.resolve(undefined)
    }

    if (this._activeExecution.has(id)) {
      return this._activeExecution.get(id)!
    }

    return new Promise<T>((resolve, reject) => {
      if (!this._activePromises.has(id)) {
        this._activePromises.set(id, [])
      }
      this._activePromises.get(id)!.push({ resolve, reject })
    })
  }
}
