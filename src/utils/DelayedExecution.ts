type DelayedExecutionCallback = () => void

export class DelayedExecution {
  private readonly _executions: Map<string, NodeJS.Timeout|number>
  protected readonly delay: number

  constructor(delay = 0) {
    this._executions = new Map()
    this.delay = delay
  }

  execute(id: string, callback: DelayedExecutionCallback): void {
    this.cancel(id)
    const wrapper = () => {
      callback()
      this._executions.delete(id)
    }
    const executionId = setTimeout(wrapper, this.delay)
    this._executions.set(id, executionId)
  }

  cancel(id: string): void {
    if (this._executions.has(id)) {
      const executionId = this._executions.get(id)
      clearTimeout(executionId)
    }
    this._executions.delete(id)
  }
}
