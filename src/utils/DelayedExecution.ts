import { CacheStore } from './CacheStore'

type DelayedExecutionCallback = () => void

export class DelayedExecution {
  private readonly _executions: CacheStore<NodeJS.Timeout|number>
  protected readonly delay: number

  constructor(delay = 0) {
    this._executions = new CacheStore()
    this.delay = delay
  }

  execute(id: string, callback: DelayedExecutionCallback): void {
    this.cancel(id)
    const timer = setTimeout(callback, this.delay)
    this._executions.set(id, timer)
  }

  cancel(id: string): boolean {
    const has = this._executions.has(id)
    if (has) {
      clearTimeout(this._executions.get(id, () => 0))
      this._executions.delete(id)
    }
    return has
  }

  has(id: string): boolean {
    return this._executions.has(id)
  }
}
