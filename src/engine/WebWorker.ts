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
      exists = !!(await this.size())
    }
    return exists
  }

  async boot(file: string): Promise<void> {
    this.accessHandle = await this.fileHandle.createSyncAccessHandle()
  }
  
  async create(file: string, initialData: number[]): Promise<void> {
    this.append(initialData)
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

  async read(start: number, length?: number): Promise<number[]> {
    if (length === undefined) {
      length = (await this.size())-start
    }
    const size    = Math.min((await this.size())-start, length)
    const buffer  = new DataView(new ArrayBuffer(size))
    const chunk   = new Array(buffer.byteLength)

    this.accessHandle.read(buffer, { at: start })
    for (let i = 0; i < size; i++) {
      chunk[i] = buffer.getUint8(i)
    }
    return chunk
  }

  async update(start: number, data: number[]): Promise<number[]> {
    const size      = await this.size()
    const length    = Math.min(data.length, size-start)
    const chunk     = data.slice(0, length)
    const buf       = Uint8Array.from(chunk)

    this.accessHandle.write(buf, { at: start })
    this.accessHandle.flush()
    return chunk
  }

  async append(data: number[]): Promise<void> {
    const before = await this.size()
    this.accessHandle.truncate(before+data.length)
    this.accessHandle.flush()
    await this.update(before, data)
  }
}

class WritableStreamStrategy extends WebWorkerStrategy {
  protected fileData!: Uint8Array
  private readonly _debounce: Debounce

  constructor(
    directoryHandle: FileSystemDirectoryHandle,
    fileHandle: FileSystemFileHandle
  ) {
    super(directoryHandle, fileHandle)
    this._debounce = new Debounce(100)
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
      exists = !!(await this.size())
    }
    return exists
  }

  async boot(file: string): Promise<void> {
    const rawFile = await this.fileHandle.getFile()
    this.fileData = new Uint8Array(await rawFile.arrayBuffer())
  }
  
  async create(file: string, initialData: number[]): Promise<void> {
    this.append(initialData)
    this._commit()
  }
  
  async open(file: string): Promise<void> {
  }

  async close(): Promise<void> {
    await this._commit()
  }

  async size(): Promise<number> {
    return this.fileData.length
  }

  async read(start: number, length?: number): Promise<number[]> {
    if (length === undefined) {
      length = (await this.size())-start
    }
    const size    = Math.min((await this.size())-start, length)
    return Array.from(this.fileData.slice(start, start+size))
  }

  async update(start: number, data: number[]): Promise<number[]> {
    const size      = await this.size()
    const length    = Math.min(data.length, size-start)
    const chunk     = data.slice(0, length)
    this.fileData.set(chunk, start)
    this._commit()
    return chunk
  }

  async append(data: number[]): Promise<void> {
    this.fileData = new Uint8Array([...this.fileData, ...data])
    this._commit()
  }
}

export class WebWorkerEngine extends DataEngine {
  protected booting: boolean = false
  protected strategy!: WebWorkerStrategy
  
  constructor() {
    super()
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
    if (this.booting) {
      return
    }
    this.booting = true
    
    const [directoryHandle, fileHandle] = await this._getHandles(file)
    this.strategy = await this._getBestStrategy(directoryHandle, fileHandle)
    return this.strategy.boot(file)
  }
  
  async create(file: string, initialData: number[]): Promise<void> {
    return this.strategy.create(file, initialData)
  }
  
  async open(file: string): Promise<void> {
    return this.strategy.open(file)
  }

  async close(): Promise<void> {
    return this.strategy.close()
  }

  async size(): Promise<number> {
    return this.strategy.size()
  }

  async read(start: number, length?: number): Promise<number[]> {
    return this.strategy.read(start, length)
  }

  async update(start: number, data: number[]): Promise<number[]> {
    return this.strategy.update(start, data)
  }

  async append(data: number[]): Promise<void> {
    return this.strategy.append(data)
  }
}
