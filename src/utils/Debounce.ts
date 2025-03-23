import { Catcher } from './Catcher'

export class Debounce {
  readonly delay: number
  private _executing: Set<string>
  private _timers: Map<string, NodeJS.Timeout>
  private _promises: Map<string, { resolve: Function, reject: Function }[]>
  private _pendingExecutions: Map<string, () => Promise<any>>
  private _currentExecutions: Map<string, Promise<any>>

  constructor(delay: number) {
    this.delay = delay
    this._executing = new Set()
    this._timers = new Map()
    this._promises = new Map()
    this._pendingExecutions = new Map()
    this._currentExecutions = new Map()
  }

  /**
   * Executes a function after debouncing any previous calls with the same ID.
   * @param id The identifier for this execution group
   * @param execute The function to execute
   * @returns A promise that resolves with the result of the executed function
   */
  execute<T = any>(id: string, execute: () => Promise<T>): Promise<T> {
    // Store the execution function to be called after delay
    this._pendingExecutions.set(id, execute)

    // Clear any existing timer for this ID
    if (this._timers.has(id)) {
      clearTimeout(this._timers.get(id)!)
    }

    // Create a new promise for this execution
    const promise = new Promise<T>((resolve, reject) => {
      // Add the promise handlers to the array of promises for this ID
      if (!this._promises.has(id)) {
        this._promises.set(id, [])
      }
      this._promises.get(id)!.push({ resolve, reject })
    })

    // Set a new timer for this ID
    this._timers.set(id, setTimeout(async () => {
      // Get the function to execute (the latest one set)
      const fn = this._pendingExecutions.get(id)!
      
      // Clear the debounce timer
      this._timers.delete(id)
      this._pendingExecutions.delete(id)
      
      // Mark as executing
      this._executing.add(id)
      
      // Execute the function and store the promise
      const executionPromise = fn()
      this._currentExecutions.set(id, executionPromise)
      
      // Wait for the result
      const [err, result] = await Catcher.CatchError(executionPromise)

      // Mark as no longer executing and clean up
      this._executing.delete(id)
      this._currentExecutions.delete(id)

      const promises = this._promises.get(id) || []

      if (err) {
        // Reject all promises with the error
        promises.forEach(p => p.reject(err))
        this._promises.delete(id)
      }
      else {
        // Resolve all promises with the result
        promises.forEach(p => p.resolve(result))
        this._promises.delete(id)
        
        return result
      }
    }, this.delay))

    return promise
  }

  /**
   * Cancels any pending execution with the given ID.
   * @param id The identifier for the execution group to cancel
   */
  cancel(id: string): void {
    const cancellationError = new Error(`Execution with ID ${id} was cancelled`)
    
    // Clear the timer if it exists
    if (this._timers.has(id)) {
      clearTimeout(this._timers.get(id)!)
      this._timers.delete(id)
    }
    
    // Reject all pending promises
    if (this._promises.has(id)) {
      const promises = this._promises.get(id)!
      promises.forEach(p => p.reject(cancellationError))
      this._promises.delete(id)
    }
    
    // Clean up
    this._pendingExecutions.delete(id)
    this._executing.delete(id)
    this._currentExecutions.delete(id)
  }

  /**
   * Checks if an execution with the given ID is currently running.
   * @param id The identifier to check
   * @returns True if the execution is running, false otherwise
   */
  isExecuting(id: string): boolean {
    return this._executing.has(id)
  }

  /**
   * Checks if an execution with the given ID is currently being debounced.
   * @param id The identifier to check
   * @returns True if the execution is being debounced, false otherwise
   */
  isDebouncing(id: string): boolean {
    return this._timers.has(id)
  }

  /**
   * Waits for any pending or executing function with the given ID to complete.
   * @param id The identifier to wait for
   * @returns A promise that resolves with the result of the executed function
   */
  async done<T = any>(id: string): Promise<T | undefined> {
    // If nothing is happening with this ID, return undefined
    if (!this.isDebouncing(id) && !this.isExecuting(id)) {
      return undefined
    }

    // If the execution is already running, we can wait for its promise directly
    if (this.isExecuting(id) && this._currentExecutions.has(id)) {
      return this._currentExecutions.get(id) as Promise<T>
    }

    // Otherwise, we need to wait for the debounce to complete and execute
    return new Promise<T | undefined>((resolve, reject) => {
      if (!this._promises.has(id)) {
        this._promises.set(id, [])
      }
      this._promises.get(id)!.push({ resolve, reject })
    })
  }
}
