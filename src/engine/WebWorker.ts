import { DataEngine } from './DataEngine'

export class WebWorkerEngine extends DataEngine {
  protected booting: boolean = false
  protected root!: FileSystemDirectoryHandle
  protected draftHandle!: FileSystemFileHandle
  protected accessHandle!: FileSystemSyncAccessHandle

  get fileHandle(): FileSystemFileHandle {
    return this.draftHandle
  }

  async exists(file: string): Promise<boolean> {
    if (!this.root) {
      return false
    }
    let exists =  false
    for await (const key of this.root.keys()) {
      if (key === file) {
        exists = true
        break
      }
    }
    if (exists) {
      exists = !!this.size()
    }
    return exists
  }

  async boot(file: string): Promise<void> {
    if (this.booting) {
      return
    }
    this.booting = true
    this.root = await navigator.storage.getDirectory()
    this.draftHandle = await this.root.getFileHandle(file, { create: true })
    this.accessHandle = await this.draftHandle.createSyncAccessHandle()
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

  size(): number {
    return this.accessHandle.getSize()
  }

  read(start: number, length: number): number[] {
    const size    = Math.min(this.size()-start, length)
    const buffer  = new DataView(new ArrayBuffer(size))
    const chunk   = new Array(buffer.byteLength)

    this.accessHandle.read(buffer, { at: start })
    for (let i = 0; i < size; i++) {
      chunk[i] = buffer.getUint8(i)
    }
    return chunk
  }

  update(start: number, data: number[]): number[] {
    const size      = this.size()
    const length    = Math.min(data.length, size-start)
    const chunk     = data.slice(0, length)
    const buf       = Uint8Array.from(chunk)

    this.accessHandle.write(buf, { at: start })
    this.accessHandle.flush()
    return chunk
  }

  append(data: number[]): void {
    const before = this.size()
    this.accessHandle.truncate(before+data.length)
    this.accessHandle.flush()
    this.update(before, data)
  }
}
