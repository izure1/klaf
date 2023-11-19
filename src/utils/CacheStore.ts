type CacheData<T> = {
  [key: string]: T
}

export class CacheStore<T> {
  private _cache: CacheData<T>

  constructor(cache: CacheData<T> = {}) {
    this._cache = cache
  }

  set(key: string, value: T): void {
    this._cache[key] = value
  }

  get(key: string, generator: () => T): T {
    if (!this.has(key)) {
      this._cache[key] = generator()
    }
    return this._cache[key];
  }

  delete(key: string): void {
    delete this._cache[key];
  }

  clear(): void {
    this._cache = {};
  }

  has(key: string): boolean {
    return key in this._cache;
  }

  size(): number {
    return Object.keys(this._cache).length;
  }
}