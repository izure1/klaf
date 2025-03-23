export abstract class DataEngine {
  static IsInstance(object: any): object is DataEngine {
    return object instanceof DataEngine
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
  abstract create(file: string, initialData: number[]): Promise<void>

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
  abstract read(start: number, length?: number): Promise<number[]>
  
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
  abstract update(start: number, data: number[]): Promise<number[]>

  /**
   * Appends data to the end of the database, increasing its size.
   * This method is called after the `open` method.
   * @param data The data to be appended. This value will be added to the end of the database.
   * @example
   * append(data) {
   *  this.dataArray.push(data)
   * }
   */
  abstract append(data: number[]): Promise<void>

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
}
