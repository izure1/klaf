type EventsListener<L> = {
  [K in keyof L]: (...args: any) => any
}

type DefaultListener = {
  [key: string]: (...args: any) => any
}

export class EventEmitter<L extends EventsListener<L> = DefaultListener> {
  private readonly __events: Map<keyof L, L[keyof L][]>

  protected constructor() {
    this.__events = new Map()
  }

  private __ensure(key: keyof L): L[keyof L][] {
    if (!this.__events.has(key)) {
      this.__events.set(key, [])
    }
    return this.__events.get(key)!
  }

  protected on<K extends keyof L>(key: K, callback: L[K]): this {
    this.__ensure(key).push(callback)
    return this
  }

  protected emit<K extends keyof L>(key: K, ...args: Parameters<L[K]>[]): this {
    const callbacks = this.__ensure(key)
    for (const callback of callbacks) {
      callback(...args)
    }
    return this
  }
}
