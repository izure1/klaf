import { type StringValue, CacheEntanglementAsync } from 'cache-entanglement'
import { Ryoiki } from 'ryoiki'
import { DataEngine } from './DataEngine'
import { IterableView } from '../utils/IterableView'
import { Debounce } from '../utils/Debounce'

interface VirtualDataEngineConstructorArguments {
  engine: DataEngine
  chunkSize: number
  commitDebounce: number
  commitDebounceMaximumSkip: number
  cacheLifespan: StringValue|number
  startBackup: () => Promise<void>
  endBackup: (commitError?: Error) => Promise<void>
  backup: (journalPageIndex: number, data: Uint8Array) => Promise<void>
}

export class VirtualDataEngine extends DataEngine {
  readonly engine: DataEngine
  readonly chunkSize: number
  readonly commitDebounce: number
  readonly commitDebounceMaximumSkip: number
  readonly cacheLifespan: StringValue|number
  protected readonly virtualChunks: ReturnType<VirtualDataEngine['_createVirtualChunkCache']>
  protected readonly updatedChunks: Map<string, Uint8Array>
  private readonly _view: IterableView
  private readonly _locker: Ryoiki
  private readonly _debounce: Debounce
  private readonly _startBackup: VirtualDataEngineConstructorArguments['startBackup']
  private readonly _endBackup: VirtualDataEngineConstructorArguments['endBackup']
  private readonly _backup: VirtualDataEngineConstructorArguments['backup']
  private _size: number|null
  private _commitDebounceCount: number

  constructor(args: VirtualDataEngineConstructorArguments) {
    super()
    const {
      engine,
      chunkSize,
      commitDebounce,
      commitDebounceMaximumSkip,
      cacheLifespan,
      startBackup,
      endBackup,
      backup,
    } = args
    this.engine = engine
    this.chunkSize = chunkSize
    this.commitDebounce = commitDebounce
    this.commitDebounceMaximumSkip = commitDebounceMaximumSkip
    this.cacheLifespan = cacheLifespan
    this.virtualChunks = this._createVirtualChunkCache()
    this.updatedChunks = new Map()
    this._view = new IterableView()
    this._locker = new Ryoiki()
    this._debounce = new Debounce(commitDebounce)
    this._startBackup = startBackup
    this._endBackup = endBackup
    this._backup = backup
    this._size = null
    this._commitDebounceCount = 0
  }

  get clone(): VirtualDataEngine {
    return new VirtualDataEngine({
      engine: this.engine.clone,
      chunkSize: this.chunkSize,
      commitDebounce: this.commitDebounce,
      commitDebounceMaximumSkip: this.commitDebounceMaximumSkip,
      cacheLifespan: this.cacheLifespan,
      startBackup: this._startBackup,
      endBackup: this._endBackup,
      backup: this._backup,
    })
  }

  private _createVirtualChunkCache() {
    return new CacheEntanglementAsync(async (key, state, index: number, fallback?: Uint8Array) => {
      if (fallback) {
        return fallback
      }
      const start = this.getChunkStartPosition(index)
      const chunk = await this.engine.read(start, this.chunkSize)
      return chunk
    }, {
      lifespan: this.cacheLifespan
    })
  }

  protected getChunkIndex(position: number): number {
    return Math.floor(position / this.chunkSize)
  }

  protected getChunkStartPosition(index: number): number {
    return index * this.chunkSize
  }

  protected getChunkIndexes(start: number, length: number): number[] {
    const indexes = []
    const end = start + length
    let offset = this.chunkSize - (start % this.chunkSize)
    let current = start
    while (current < end) {
      const index = this.getChunkIndex(current)
      indexes.push(index)
      current += offset
      offset = this.chunkSize
    }
    return indexes
  }

  async exists(file: string): Promise<boolean> {
    return this.engine.exists(file)
  }

  async boot(file: string): Promise<void> {
    return this.engine._boot(file)
  }

  async create(file: string, initialData: Uint8Array): Promise<void> {
    return this.engine._create(file, initialData)
  }

  async open(file: string): Promise<void> {
    return this.engine._open(file)
  }

  async close(): Promise<void> {
    await this.commitWithDebounce()
    await this._debounce.done('commit')
    await this.engine._close()
    this.updatedChunks.clear()
    this.virtualChunks.clear()
    this._size = null
  }

  async size(): Promise<number> {
    if (this._size === null) {
      this._size = await this.engine.size()
    }
    return this._size
  }

  protected async getChunk(index: number): Promise<Uint8Array> {
    const key = index.toString()
    if (this.updatedChunks.has(key)) {
      return this.updatedChunks.get(key)!
    }
    const cache = await this.virtualChunks.cache(key, index)
    return cache.raw
  }

  protected async ensureLength(start: number, length?: number): Promise<number> {
    const size = await this.size()
    const remain = size - start
    let read = length ?? remain
    if (start + read >= size) {
      read = remain
    }
    return read
  }

  protected async lookup(start: number, length?: number): Promise<{
    indexes: number[]
    chunks: Uint8Array[]
    total: Uint8Array
    read: number
  }> {
    const read = await this.ensureLength(start, length)
    const indexes = this.getChunkIndexes(start, read)
    const chunks = []
    const total = new Uint8Array(indexes.length * this.chunkSize)
    for (let i = 0, j = 0, len = indexes.length; i < len; i++) {
      const index = indexes[i]
      const chunk = await this.getChunk(index)
      chunks.push(chunk)
      total.set(chunk, j)
      j += this.chunkSize
    }
    return {
      indexes,
      chunks,
      read,
      total,
    }
  }

  async waitCommit(): Promise<void> {
    await this._debounce.done('commit')
  }

  async commitWithDebounce(): Promise<void> {
    this._commitDebounceCount++
    if (this._debounce.isExecuting('commit')) {
      await this._debounce.done('commit')
    }
    if (this.commitDebounce <= 0) {
      return this.commit()
    }
    if (this._commitDebounceCount >= this.commitDebounceMaximumSkip) {
      return this._debounce.execute('commit', () => this.commit())
    }
    this._debounce.execute('commit', () => this.commit())
  }

  async commit(): Promise<void> {
    let lockId: string
    let commitError: Error|undefined = undefined
    try {
      await this._startBackup()
      await this._locker.writeLock(async (_lockId) => {
        lockId = _lockId
        const updatedChunks = Array.from(this.updatedChunks).sort((a, b) => Number(a[0]) - Number(b[0]))
        const min = await this.engine.size()
        const max = await this.size()
        const increment = max - min
        await this.engine.append(new Uint8Array(increment).fill(0))
        for (let i = 0, len = updatedChunks.length; i < len; i++) {
          const [key, chunk] = updatedChunks[i]
          const index = Number(key)
          const position = this.getChunkStartPosition(index)
          const isExistingInFile = position < min
          if (isExistingInFile) {
            const isLastChunk = position + chunk.length > min
            let realChunkSize = chunk.length
            if (isLastChunk) {
              realChunkSize = min - position
            }
            const beforeCache = await this.virtualChunks.cache(key, index)
            const beforePage = beforeCache.raw
            await this._backup(index, beforePage.subarray(0, realChunkSize))
          }
          this.updatedChunks.delete(key)
          await this.engine.update(position, chunk)
          await this.virtualChunks.update(key, index)
        }
        this._commitDebounceCount = 0
      }).finally(() => this._locker.writeUnlock(lockId))
    } catch (err) {
      commitError = new Error(err instanceof Error ? err.message : String(err))
    }
    await this._endBackup(commitError)
  }

  async read(start: number, length?: number): Promise<Uint8Array> {
    let lockId: string
    return this._locker.readLock(async (_lockId) => {
      lockId = _lockId
      const { total, read } = await this.lookup(start, length)
      const offset = start % this.chunkSize
      const data = this._view.read(total, offset, read)
      return data
    }).finally(() => this._locker.readUnlock(lockId))
  }

  async update(start: number, data: Uint8Array): Promise<Uint8Array> {
    if (data.length === 0) {
      return new Uint8Array()
    }
    let lockId: string
    return this._locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const { indexes, chunks, read } = await this.lookup(start, data.length)
      let chunkOffset = start % this.chunkSize
      let dataSize = this.chunkSize - chunkOffset
      let dataOffset = 0
      for (let i = 0, len = indexes.length; i < len; i++) {
        const index = indexes[i]
        const chunk = chunks[i]
        const key = index.toString()
        const newChunkData = this._view.read(data, dataOffset, dataSize)
        this._view.update(chunk, chunkOffset, newChunkData)
        this.updatedChunks.set(key, chunk)
        chunkOffset = 0
        dataSize = this.chunkSize
        dataOffset += newChunkData.length
      }
      return this._view.read(data, 0, read)
    }).finally(() => this._locker.writeUnlock(lockId))
  }

  async append(data: Uint8Array): Promise<void> {
    // 데이터 추가 시, 먼저 맨 마지막 위치의 청크를 캐시해야 함.
    let lockId: string
    return this._locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const size = await this.size()
      const lastChunkIndex = this.getChunkIndex(size)
      const lastChunkLen = size % this.chunkSize
      let lastChunk = await this.getChunk(lastChunkIndex)
  
      let dataRemain = data.length
      let dataOffset = 0
      
      // 마지막 청크 업데이트
      let lastChunkRemain = this.chunkSize - lastChunkLen
      let lastChunkOffset = lastChunkLen
      let lastChunkUpdated = false
      while (lastChunkRemain > 0) {
        const newChunkData = this._view.read(data, dataOffset, lastChunkRemain)
        const newChunkSize = lastChunkLen + newChunkData.length
        if (newChunkData.length === 0) {
          break
        }
        lastChunk = this._view.fix(lastChunk, newChunkSize, 0)
        this._view.update(lastChunk, lastChunkOffset, newChunkData)

        this.updatedChunks.set(lastChunkIndex.toString(), lastChunk)
        await this.virtualChunks.update(lastChunkIndex.toString(), lastChunkIndex, lastChunk)

        dataOffset += newChunkData.length
        dataRemain -= newChunkData.length
        lastChunkRemain -= newChunkData.length
        lastChunkOffset += newChunkData.length
        lastChunkUpdated = true
      }
      if (lastChunkUpdated) {
        const lastChunkKey = lastChunkIndex.toString()
        this.updatedChunks.set(lastChunkKey, lastChunk)
      }
  
      // 더 삽입할 데이터가 남아있다면 새로운 청크를 생성
      let appended = 0
      while (dataRemain > 0) {
        appended++
        const newChunkData = this._view.read(data, dataOffset, this.chunkSize)
        const newChunkIndex = lastChunkIndex + appended
        const newChunkKey = newChunkIndex.toString()
        if (newChunkData.length === 0) {
          break
        }
        const newChunk = new Uint8Array(newChunkData)
        this.updatedChunks.set(newChunkKey, newChunk)
        dataOffset += newChunkData.length
        dataRemain -= newChunkData.length
      }
  
      this._size! += data.length
    }).finally(() => this._locker.writeUnlock(lockId))
  }

  async truncate(size: number): Promise<void> {
    let lockId: string
    return this._locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const max = this.getChunkIndex(size)
      for (const key of this.virtualChunks.keys()) {
        const index = Number(key)
        if (index < max) {
          continue
        }
        else if (index === max) {
          const cache = await this.virtualChunks.cache(key, index)
          const offset = size % this.chunkSize
          let chunk = cache.raw
          chunk = this._view.fix(chunk, offset, 0)
          this.virtualChunks.delete(key)
          this.updatedChunks.set(key, chunk)
          continue
        }
        else {
          this.virtualChunks.delete(key)
          this.updatedChunks.delete(key)
        }
      }
      await this.engine.truncate(size)
      this._size = size
    }).finally(() => this._locker.writeUnlock(lockId))
  }

  async unlink(file: string): Promise<void> {
    return this.engine._unlink(file)
  }

  async reset(file: string): Promise<void> {
    this.updatedChunks.clear()
    this.virtualChunks.clear()
    this._size = null
    this._commitDebounceCount = 0
    await this.engine._reset(file)
  }
}
