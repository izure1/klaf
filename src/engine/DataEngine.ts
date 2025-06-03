export abstract class DataEngine {
  static IsInstance(object: any): object is DataEngine {
    return object instanceof DataEngine
  }

  private _isBooting: boolean = false
  private _isOpened: boolean = false

  get isBooting(): boolean {
    return this._isBooting
  }

  get isOpened(): boolean {
    return this._isOpened
  }

  /**
   * 자신과 동일한 인스턴스를 복제하여 반환합니다.
   * 복제된 자신과 동일하지 않으며, 사용되지 않은, 완전히 초기화된 상태여야 합니다.
   */
  abstract get clone(): DataEngine

  /**
   * This method is an abstract hook. You must call this method at the very top of the `boot` method you implement.
   * Subsequently, in other implementations, call `engine._boot` instead of `engine.boot`.
   * @param file The location of the database. This can be a file path or a key used for storage.
   */
  async _boot(file: string): Promise<void> {
    await this.boot(file)
    this._isBooting = true
  }

  /**
   * This method is an abstract hook that calls `this.create(file, initialData)`.
   * You must implement the `create` method in your subclass.
   * Subsequently, in other implementations, call `engine._create` instead of `engine.create`.
   * @param file The location of the database. This can be a file path or a key used for storage.
   * @param initialData The initialization data.
   */
  async _create(file: string, initialData: Uint8Array): Promise<void> {
    await this.create(file, initialData)
  }

  /**
   * This method is an abstract hook that calls `this.open(file)` and manages the `_isOpened` state.
   * You must implement the `open` method in your subclass.
   * Subsequently, in other implementations, call `engine._open` instead of `engine.open`.
   * @param file The location of the database. This can be a file path or a key used for storage.
   */
  async _open(file: string): Promise<void> {
    if (this._isOpened) {
      return
    }
    await this.open(file)
    this._isOpened = true
  }

  /**
   * This method is an abstract hook that calls `this.close()` (if opened) and manages the `_isOpened` state.
   * You must implement the `close` method in your subclass.
   * Subsequently, in other implementations, call `engine._close` instead of `engine.close`.
   */
  async _close(): Promise<void> {
    if (this._isOpened) {
      await this.close()
    }
    this._isOpened = false
  }

  /**
   * This method is an abstract hook that calls `this.unlink(file)`.
   * You must implement the `unlink` method in your subclass.
   * Subsequently, in other implementations, call `engine._unlink` instead of `engine.unlink`.
   * @param file The location of the database. This can be a file path or a key used for storage.
   */
  async _unlink(file: string): Promise<void> {
    await this.unlink(file)
  }

  /**
   * This method is an abstract hook that manages `_isBooting` and `_isOpened` states, then calls `this.reset(file)`.
   * You must implement the `reset` method in your subclass.
   * Subsequently, in other implementations, call `engine._reset` instead of `engine.reset`.
   * @param file The location of the database. This can be a file path or a key used for storage.
   */
  async _reset(file: string): Promise<void> {
    this._isBooting = false
    if (this._isOpened) {
      await this._close()
      this._isOpened = false
    }
    await this.reset(file)
  }

  /**
   * Should return whether the database exists at the given location. This method is used internally within the database.
   * @param file The location of the database. This can be a file path or a key used for storage.
   */
  abstract exists(file: string): Promise<boolean>

  /**
   * This is the very first method called before the database instance is created.
   * It is invoked before the `exists`, `create`, `open`, `close`, `unlink`, `size`, `append`, and `truncate` methods within the lifecycle.
   * **This method can be called multiple times.** Therefore, to ensure it is called only once, additional exception handling is required.
   * @param file The location of the database. This can be a file path or a key used for storage.
   */
  abstract boot(file: string): Promise<void>
  
  /**
   * Called when the database is first created. This is used to initialize the database.
   * @param file The location of the database. This can be a file path or a key used for storage.
   * @param initialData The initialization data. This value should be inserted at the very beginning when the database is created.
   * @example
   * create(file, initialData) {
   *  this.dataArray.push(...initialData)
   * }
   */
  abstract create(file: string, initialData: Uint8Array): Promise<void>

  /**
   * Called when the database is opened.
   * @param file The location of the database. This can be a file path or a key used for storage.
   * @example
   * open(file) {
   *  const storedData = your.repository.readAll()
   *  this.dataArray.push(...storedData)
   * }
   */
  abstract open(file: string): Promise<void>

  /**
   * Called when the database is closed.
   * This method is called after the `open` method.
   * @example
   * close() {
   *  this.dataArray.length = 0
   * }
   */
  abstract close(): Promise<void>

  /**
   * This is the total size of the database where the data is kept.
   * If it's an array, it should return the array's length, and if it's a buffer, it should return the buffer's length.
   * This method is called after the `open` method.
   * @example
   * size() {
   *  return this.dataArray.length
   * }
   */
  abstract size(): Promise<number>

  /**
   * Reads content from the database where the data is kept. This method should return an array of integers.
   * This method is called after the `open` method.
   * @param start The starting offset in the database from where to read.
   * @param length The length to read. If the start offset + length exceeds the database size, the returned integer array may be smaller than this value.
   * @example
   * read(start, length) {
   *  return this.dataArray.slice(start, start+length)
   * }
   */
  abstract read(start: number, length?: number): Promise<Uint8Array>
  
  /**
   * Updates the content in the database where the data is kept. This method should return the updated array of integers.
   * This method is called after the `open` method.
   * @param start The starting offset in the database where the data will be written.
   * @param data The data to be stored. If the start offset + data length exceeds the database size, the excess data should be discarded and not saved.
   * @example
   * update(start, data) {
   *  const size      = this.size()
   *  const length    = Math.min(data.length, size-start)
   *  const chunk     = data.slice(0, length)
   *  // update
   *  this.dataArray.splice(start, chunk.length, chunk)
   *  return chunk
   * }
   */
  abstract update(start: number, data: Uint8Array): Promise<Uint8Array>

  /**
   * Appends data to the end of the database, increasing its size.
   * This method is called after the `open` method.
   * @param data The data to be appended. This value will be added to the end of the database.
   * @example
   * append(data) {
   *  this.dataArray.push(data)
   * }
   */
  abstract append(data: Uint8Array): Promise<void>

  /**
   * Truncates the database to the specified size.
   * This method is called after the `open` method.
   * @param size The size to truncate the database to.
   * @example
   * truncate(size) {
   *  this.dataArray.length = size
   * }
   */
  abstract truncate(size: number): Promise<void>

  /**
   *
   * Unlinks the database file.
   * This method is automatically called when the database needs to be deleted.
   * After this method is called, the `exists` method must be able to return `false`.
   * @param file The location of the database. This can be a file path or a key used for storage.
   * @example
   * unlink(file) {
   *  await fs.unlink(file)
   * }
   */
  abstract unlink(file: string): Promise<void>

  /**
   * When this method is called, the engine is closed and should be considered fully reset.
   * Therefore, any state or values established by the `boot` method must be reverted to their initial instance values.
   * @param file The location of the database. This can be a file path or a key used for storage.
   */
  abstract reset(file: string): Promise<void>
}
