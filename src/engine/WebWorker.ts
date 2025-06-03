import { DataEngine } from './DataEngine'
import { Debounce } from '../utils/Debounce'

abstract class WebWorkerStrategy extends DataEngine {
  readonly directoryHandle: FileSystemDirectoryHandle
  readonly fileHandle: FileSystemFileHandle

  constructor(
    directoryHandle: FileSystemDirectoryHandle,
    fileHandle: FileSystemFileHandle
  ) {
    super()
    this.directoryHandle = directoryHandle
    this.fileHandle = fileHandle
  }
}

class FileSystemSyncAccessHandleStrategy extends WebWorkerStrategy {
  protected accessHandle!: FileSystemSyncAccessHandle

  constructor(
    directoryHandle: FileSystemDirectoryHandle,
    fileHandle: FileSystemFileHandle
  ) {
    super(directoryHandle, fileHandle)
  }

  get clone(): FileSystemSyncAccessHandleStrategy {
    return new FileSystemSyncAccessHandleStrategy(this.directoryHandle, this.fileHandle)
  }

  async exists(file: string): Promise<boolean> {
    if (!this.directoryHandle) {
      return false
    }
    let exists =  false
    for await (const key of this.directoryHandle.keys()) {
      if (key === file) {
        exists = true
        break
      }
    }
    if (exists) {
      const size = await this.size()
      exists = !!size
    }
    return exists
  }

  async boot(file: string): Promise<void> {
    this.accessHandle = await this.fileHandle.createSyncAccessHandle()
  }
  
  async create(file: string, initialData: Uint8Array): Promise<void> {
    await this.append(initialData)
  }
  
  async open(file: string): Promise<void> {
  }

  async close(): Promise<void> {
    this.accessHandle.flush()
    this.accessHandle.close()
  }

  async size(): Promise<number> {
    return this.accessHandle.getSize()
  }

  async read(start: number, length?: number): Promise<Uint8Array> {
    const s = await this.size()
    if (length === undefined) {
      length = s - start
    }
    const size    = Math.min(s - start, length)
    const buffer  = new DataView(new ArrayBuffer(size))
    const chunk   = new Uint8Array(buffer.byteLength)

    this.accessHandle.read(buffer, { at: start })
    for (let i = 0; i < size; i++) {
      chunk[i] = buffer.getUint8(i)
    }
    return chunk
  }

  async update(start: number, data: Uint8Array): Promise<Uint8Array> {
    const size      = await this.size()
    const length    = Math.min(data.length, size - start)
    const chunk     = data.subarray(0, length)
    const buf       = Uint8Array.from(chunk)

    this.accessHandle.write(buf, { at: start })
    this.accessHandle.flush()
    return chunk
  }

  async append(data: Uint8Array): Promise<void> {
    const before = await this.size()
    this.accessHandle.truncate(before + data.length)
    this.accessHandle.flush()
    await this.update(before, data)
  }

  async truncate(size: number): Promise<void> {
    this.accessHandle.truncate(size)
  }

  async unlink(file: string): Promise<void> {
    await this.directoryHandle.removeEntry(file)
  }

  async reset(file: string): Promise<void> {
    this.accessHandle = undefined as any 
  }
}

class WritableStreamStrategy extends WebWorkerStrategy {
  protected fileData!: Uint8Array
  private _debounce: Debounce

  constructor(
    directoryHandle: FileSystemDirectoryHandle,
    fileHandle: FileSystemFileHandle
  ) {
    super(directoryHandle, fileHandle)
    this._debounce = new Debounce(100)
  }

  get clone(): WritableStreamStrategy {
    return new WritableStreamStrategy(this.directoryHandle, this.fileHandle)
  }

  private async _commit(): Promise<void> {
    return this._debounce.execute('commit', async () => {
      const stream = await this.fileHandle.createWritable()
      await stream.write(this.fileData)
      await stream.close()
    })
  }

  async exists(file: string): Promise<boolean> {
    if (!this.directoryHandle) {
      return false
    }
    let exists =  false
    for await (const key of this.directoryHandle.keys()) {
      if (key === file) {
        exists = true
        break
      }
    }
    if (exists) {
      const size = await this.size()
      exists = !!size
    }
    return exists
  }

  async boot(file: string): Promise<void> {
    const rawFile = await this.fileHandle.getFile()
    this.fileData = new Uint8Array(await rawFile.arrayBuffer())
  }
  
  async create(file: string, initialData: Uint8Array): Promise<void> {
    await this.append(initialData)
    await this._commit()
  }
  
  async open(file: string): Promise<void> {
  }

  async close(): Promise<void> {
    await this._commit()
  }

  async size(): Promise<number> {
    return this.fileData.length
  }

  async read(start: number, length?: number): Promise<Uint8Array> {
    const s = await this.size()
    if (length === undefined) {
      length = s - start
    }
    const size    = Math.min(s - start, length)
    return this.fileData.subarray(start, start + size)
  }

  async update(start: number, data: Uint8Array): Promise<Uint8Array> {
    const size      = await this.size()
    const length    = Math.min(data.length, size - start)
    const chunk     = data.subarray(0, length)
    this.fileData.set(chunk, start)
    this._commit()
    return chunk
  }

  async append(data: Uint8Array): Promise<void> {
    this.fileData = new Uint8Array([...this.fileData, ...data])
    this._commit()
  }

  async truncate(size: number): Promise<void> {
    this.fileData = this.fileData.subarray(0, size)
    this._commit()
  }

  async unlink(file: string): Promise<void> {
    await this.directoryHandle.removeEntry(file)
  }

  async reset(file: string): Promise<void> {
    this.fileData = undefined as any
    this._debounce = new Debounce(100)
  }
}

export class WebWorkerEngine extends DataEngine {
  protected booting: boolean = false
  protected strategy!: WebWorkerStrategy
  
  constructor() {
    super()
  }

  get clone(): WebWorkerEngine {
    return new WebWorkerEngine()
  }

  get fileHandle(): FileSystemFileHandle|null {
    return this.strategy?.fileHandle ?? null
  }

  private async _getHandles(file: string): Promise<[
    FileSystemDirectoryHandle,
    FileSystemFileHandle
  ]> {
    const directoryHandle = await navigator.storage.getDirectory()
    const fileHandle = await directoryHandle.getFileHandle(file, { create: true })
    return [
      directoryHandle,
      fileHandle,
    ]
  }

  private async _getBestStrategy(
    directoryHandle: FileSystemDirectoryHandle,
    fileHandle: FileSystemFileHandle
  ): Promise<WebWorkerStrategy> {
    // main thread
    if (typeof (globalThis as any).window !== 'undefined') {
      return new WritableStreamStrategy(directoryHandle, fileHandle)
    }
    // service worker
    else if ('ServiceWorkerGlobalScope' in self && self instanceof ServiceWorkerGlobalScope) {
      return new WritableStreamStrategy(directoryHandle, fileHandle)
    }
    // shared worker
    else if ('SharedWorkerGlobalScope' in self && self instanceof SharedWorkerGlobalScope) {
      return new WritableStreamStrategy(directoryHandle, fileHandle)
    }
    // dedicated worker
    else if ('DedicatedWorkerGlobalScope' in self && self instanceof DedicatedWorkerGlobalScope) {
      return new FileSystemSyncAccessHandleStrategy(directoryHandle, fileHandle)
    }
    // Unknown environment
    else {
      throw new Error('Unknown environment.')
    }
  }

  async exists(file: string): Promise<boolean> {
    return this.strategy.exists(file)
  }

  async boot(file: string): Promise<void> {
    if (this.isBooting) {
      return
    }
    const [directoryHandle, fileHandle] = await this._getHandles(file)
    this.strategy = await this._getBestStrategy(directoryHandle, fileHandle)
    return this.strategy._boot(file)
  }
  
  async create(file: string, initialData: Uint8Array): Promise<void> {
    return this.strategy._create(file, initialData)
  }
  
  async open(file: string): Promise<void> {
    return this.strategy._open(file)
  }

  async close(): Promise<void> {
    return this.strategy._close()
  }

  async size(): Promise<number> {
    return this.strategy.size()
  }

  async read(start: number, length?: number): Promise<Uint8Array> {
    return this.strategy.read(start, length)
  }

  async update(start: number, data: Uint8Array): Promise<Uint8Array> {
    return this.strategy.update(start, data)
  }

  async append(data: Uint8Array): Promise<void> {
    return this.strategy.append(data)
  }

  async truncate(size: number): Promise<void> {
    return this.strategy.truncate(size)
  }

  async unlink(file: string): Promise<void> {
    await this.strategy._unlink(file)
  }

  async reset(file: string): Promise<void> {
    await this.strategy._reset(file)
  }
}
