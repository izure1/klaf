import { CacheStore } from './CacheStore'

type DelayedExecutionCallback = () => void

export class DelayedExecution {
  private readonly _executions: CacheStore<NodeJS.Timeout|number>
  private readonly _defGetter: () => 0
  protected readonly delay: number

  constructor(delay = 0) {
    this._executions = new CacheStore()
    this._defGetter = () => 0
    this.delay = delay
  }

  execute(id: string, callback: DelayedExecutionCallback): void {
    this.cancel(id)
    const wrapper = () => {
      callback()
      this._executions.delete(id)
    }
    this._executions.set(id, setTimeout(wrapper, this.delay))
  }

  cancel(id: string): boolean {
    const has = this._executions.has(id)
    if (has) {
      clearTimeout(this._executions.get(id, this._defGetter))
      this._executions.delete(id)
    }
    return has
  }

  has(id: string): boolean {
    return this._executions.has(id)
  }
}
