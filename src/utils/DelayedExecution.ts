import { CacheBranchSync } from 'cachebranch'

type DelayedExecutionCallback = () => void

export class DelayedExecution {
  private readonly _executions: CacheBranchSync<{
    [key: string]: NodeJS.Timeout|number
  }>
  private readonly _defGetter: () => 0
  protected readonly delay: number

  constructor(delay = 0) {
    this._executions = new CacheBranchSync()
    this._defGetter = () => 0
    this.delay = delay
  }

  execute(id: string, callback: DelayedExecutionCallback): void {
    this.cancel(id)
    const wrapper = () => {
      callback()
      this._executions.delete(id)
    }
    this._executions.set(id, () => setTimeout(wrapper, this.delay))
  }

  cancel(id: string): void {
    clearTimeout(this._executions.ensure(id, this._defGetter).raw)
    this._executions.delete(id)
  }
}
