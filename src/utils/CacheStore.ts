type CacheKey = string|number|symbol
type CacheData<T> = {
  [key: CacheKey]: T
}

export class CacheStore<T> extends Map<CacheKey, T> {
  set(key: CacheKey, value: T): this {
    return super.set(key, value)
  }

  ensure(key: CacheKey, generator: () => T): T {
    if (!this.has(key)) {
      super.set(key, generator())
    }
    return super.get(key)!
  }

  delete(key: CacheKey): boolean {
    return super.delete(key)
  }

  has(key: CacheKey): boolean {
    return super.has(key)
  }
}
