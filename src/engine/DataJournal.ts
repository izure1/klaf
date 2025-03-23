import { parse, format } from 'path-browserify'
import { type DataEngine } from './DataEngine'
import { IntegerConverter } from '../utils/IntegerConverter'

/**
 * Represents a container for data journal operations.
 * It provides the interface for interacting with the data journal.
 */
export interface DataJournalContainer {
  /**
   * The `DataJournal` instance associated with this container.
   * It handles backup and restore operations for the database.
   */
  journal?: DataJournal
}

export enum DataJournalFormat {
  /**
   * The size of the root header in the journal file.
   */
  RootHeaderSize          = 100,
  /**
   * The offset for the working flag in the root header.
   */
  RootWorkingOffset       = 0,
  /**
   * The size of the working flag.
   */
  RootWorkingSize         = 1,
  /**
   * The offset for the maximum page index in the root header.
   */
  RootMaxPageIndexOffset  = DataJournalFormat.RootWorkingOffset + DataJournalFormat.RootWorkingSize,
  /**
   * The size of the maximum page index.
   */
  RootMaxPageIndexSize    = 4,
  /**
   * The offset for the database metadata in the journal file.
   */
  DBMetadataOffset        = DataJournalFormat.RootHeaderSize,
  /**
   * The size of the database metadata.
   */
  DBMetadataSize          = 200,
  /**
   * The offset for the database page in the journal file.
   */
  DBPageOffset            = DataJournalFormat.DBMetadataOffset + DataJournalFormat.DBMetadataSize,
  /**
   * The suffix used for journal files.
   */
  JournalSuffix           = '.journal',
}

export interface DataJournalInitialOption {
  working: number
  maximumPageIndex: number
}

type DataJournalMetadataFormatKey = keyof DataJournalInitialOption
type DataJournalMetadataFormatValue = [number, number]
type DataJournalMetadataFormatMap = Record<DataJournalMetadataFormatKey, DataJournalMetadataFormatValue>
interface DataJournalMetadataFormData {
  dirty: boolean
  numeric: number|bigint
  array: number[]
}
type DataJournalMetadataFormatState = Record<DataJournalMetadataFormatKey, DataJournalMetadataFormData>

class DataJournalInitialOptionManager {
  readonly engine: DataEngine
  readonly formatMap: DataJournalMetadataFormatMap
  readonly state: Partial<DataJournalMetadataFormatState>

  constructor(engine: DataEngine, formatMap: DataJournalMetadataFormatMap) {
    this.engine = engine
    this.formatMap = formatMap
    this.state = {}
  }

  private _read(data: DataJournalMetadataFormData, to: 'numeric'): number|bigint
  private _read(data: DataJournalMetadataFormData, to: 'array'): number[]
  private _read(data: DataJournalMetadataFormData, to: 'numeric'|'array'): number|bigint|number[] {
    if (to === 'numeric') return data.numeric
    if (to === 'array')   return data.array
    throw new Error(`Invalid 'to' parameter. Expected 'numeric' or 'array', but got '${to}'.`)
  }
  
  async read(key: DataJournalMetadataFormatKey, to: 'numeric'): Promise<number|bigint>
  async read(key: DataJournalMetadataFormatKey, to: 'array'): Promise<number[]>
  async read(key: DataJournalMetadataFormatKey, to: 'numeric'|'array'): Promise<number[]|number|bigint> {
    const k = key as DataJournalMetadataFormatKey
    if (k in this.state) {
      return this._read(this.state[k]!, to as any)
    }
    const [start, size] = this.formatMap[k]
    const value = await this.engine.read(start, size)
    this.state[k] = {
      dirty: true,
      numeric: IntegerConverter.FromAuto(value, size),
      array: value,
    }
    return this._read(this.state[k]!, to as any)
  }

  write(key: DataJournalMetadataFormatKey, value: number): void
  write(key: DataJournalMetadataFormatKey, value: number[]): void
  write(key: DataJournalMetadataFormatKey, value: number|number[]): void {
    const [_start, size] = this.formatMap[key]
    let numeric: number|bigint
    let array: number[]
    if (typeof value === 'number') {
      numeric = value
      array = IntegerConverter.ToAuto(value, size)
    }
    else {
      numeric = IntegerConverter.FromAuto(value, size)
      array = value
    }
    if (array.length !== size) {
      throw new Error(
        `The '${key}' size of the array must be ${size}. ` +
        `But got a ${array.length}.`
      )
    }
    const data = this.state[key]
    if (
      !data ||
      data.numeric !== numeric
    ) {
      this.state[key] = {
        dirty: true,
        numeric,
        array,
      }
    }
  }

  async commit(): Promise<void> {
    for (const key in this.state) {
      const k = key as DataJournalMetadataFormatKey
      const data = this.state[k]!
      if (data.dirty === false) {
        continue
      }
      const [start] = this.formatMap[k]
      await this.engine.update(start, data.array)
      data.dirty = false
    }
  }
}

/**
 * The `DataJournal` class manages a journal file for backing up and restoring a database.
 * It tracks changes made to the database and provides mechanisms for rolling back to a previous state
 * in case of errors or data corruption.
 */
export class DataJournal {
  /**
   * The initial data used when creating a new journal file.
   */
  protected static readonly InitialData = DataJournal.CreateIterable(
    DataJournalFormat.RootHeaderSize,
    0,
  )

  /**
   * Decorator class for `DataJournal` methods.
   * It provides decorators for common checks, like initialization and ownership.
   */
  static readonly Decorator = class DataJournalDecorator {
    /**
     * Verifies that the journal has been initialized.
     * @param target The target object.
     * @param property The property key.
     * @param descriptor The property descriptor.
     * @returns The modified property descriptor.
     * @throws {Error} If the journal is not initialized.
     */
    static VerifyInitialized(
      target: DataJournalContainer,
      property: PropertyKey,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor {
      const originalMethod = descriptor.value
      descriptor.value = function<T extends DataJournalContainer>(this: T, ...args: any[]) {
        if (!DataJournal.IsInstance(this.journal)) {
          throw DataJournal.ERR_REQUIRE_TOKEN()
        }
        if (!this.journal.isInitialized) {
          throw DataJournal.ERR_REQUIRE_INIT()
        }
        return originalMethod.apply(this, args)
      }
      return descriptor
    }

    /**
     * Requires the journal to be initialized before allowing the decorated method to execute.
     * If the journal is not initialized, the method will not be executed.
     * @param target The target object.
     * @param property The property key.
     * @param descriptor The property descriptor.
     * @returns The modified property descriptor.
     */
    static RequireInitialized(
      target: DataJournalContainer,
      property: PropertyKey,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor {
      const originalMethod = descriptor.value
      descriptor.value = function<T extends DataJournalContainer>(this: T, ...args: any[]) {
        if (!DataJournal.IsInstance(this.journal)) {
          return
        }
        if (!this.journal.isInitialized) {
          return
        }
        return originalMethod.apply(this, args)
      }
      return descriptor
    }

    /**
     * Requires the `DataJournalContainer` to have `DataJournal` instance before allowing the decorated method to execute.
     * If there is no `DataJournalToken` instance, the method will not be executed.
     * @param target The target object.
     * @param property The property key.
     * @param descriptor The property descriptor.
     * @returns The modified property descriptor.
     */
    static RequireInstance(
      target: DataJournalContainer,
      property: PropertyKey,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor {
      const originalMethod = descriptor.value
      descriptor.value = function<T extends DataJournalContainer>(this: T, ...args: any[]) {
        if (!DataJournal.IsInstance(this.journal)) {
          return
        }
        if (!this.journal.isInitialized) {
          return
        }
        return originalMethod.apply(this, args)
      }
      return descriptor
    }

    /**
     * Requires the `DataJournalContainer` to have `DataJournal` instance and handler before allowing the decorated method to execute.
     * If there is no `DataJournalToken` instance or handler, the method will not be executed.
     * @param target The target object.
     * @param property The property key.
     * @param descriptor The property descriptor.
     * @returns The modified property descriptor.
     */
    static RequireAccessibleHandler(
      target: DataJournalContainer,
      property: PropertyKey,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor {
      const originalMethod = descriptor.value
      descriptor.value = function(this: DataJournalContainer, handler: any, ...args: any[]) {
        if (this.journal?.handler !== handler) {
          return
        }
        return originalMethod.apply(this, args)
      }
      return descriptor
    }
  }

  /**
   * Creates an error for when the journal needs to be initialized.
   * @returns An error object.
   */
  protected static ERR_REQUIRE_INIT(): Error {
    return new Error('You have to initiate first.')
  }

  /**
   * Creates an error for when the journal requires a token.
   * @returns An error object.
   */
  protected static ERR_REQUIRE_TOKEN(): Error {
    return new Error('You must have a token to use this feature.')
  }

  /**
   * Creates an error for when the journal is already initialized.
   * @returns An error object.
   */
  protected static ERR_ALREADY_INIT(): Error {
    return new Error('This instance already initialed.')
  }

  /**
   * Creates an error for when the journal requires proper permissions.
   * @param handler The handler trying to access.
   * @param accessibleHandler The handler that has access.
   * @returns An error object.
   */
  protected static ERR_REQUIRE_PERM(
    handler: any,
    accessibleHandler: any
  ): Error {
    return new Error(
      'You do not have transfer permissions. ' + 
      'To transfer, you must be a handler. ' + 
      `Expected handler: '${accessibleHandler.name}', but received: '${handler.name}'.`
    )
  }

  /**
   * Creates an iterable of a specific length and filled with a specific value.
   * @param length The length of the iterable.
   * @param fill The value to fill the iterable with.
   * @returns A number array.
   */
  protected static CreateIterable(length: number, fill: number): number[] {
    return new Array(length).fill(fill)
  }

  /**
   * Checks if an object is an instance of `DataJournal`.
   * @param object The object to check.
   * @returns True if the object is a `DataJournal` instance, false otherwise.
   */
  static IsInstance(object: any): object is DataJournal {
    return object instanceof DataJournal
  }

  private readonly _indexes: Set<number>
  protected initialized: boolean
  protected transacting: boolean
  protected handler: any
  protected readonly initialOption: DataJournalInitialOptionManager
  readonly engine: DataEngine

  /**
   * Creates a new `DataJournal` instance.
   * @param engine The data engine to use for journal operations.
   */
  constructor(engine: DataEngine) {
    this._indexes = new Set()
    this.initialized = false
    this.transacting = false
    this.handler = null
    this.engine = engine
    this.initialOption = new DataJournalInitialOptionManager(this.engine, {
      working: [
        DataJournalFormat.RootWorkingOffset as number,
        DataJournalFormat.RootWorkingSize as number,
      ],
      maximumPageIndex: [
        DataJournalFormat.RootMaxPageIndexOffset as number,
        DataJournalFormat.RootMaxPageIndexSize as number,
      ],
    })
  }

  /**
   * Gets whether the journal is initialized.
   * @returns True if initialized, false otherwise.
   */
  get isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Gets whether a transaction is in progress.
   * @returns True if transacting, false otherwise.
   */
  get isTransacting(): boolean {
    return this.transacting
  }

  /**
   * Gets the journal file path for a given database path.
   * @param databasePath The path to the database file.
   * @returns The path to the journal file.
   */
  getJournalPath(databasePath: string): string {
    const parsed = parse(databasePath)
    return format({
      root: parsed.root,
      dir: parsed.dir,
      name: parsed.base,
      ext: DataJournalFormat.JournalSuffix as string,
    })
  }

  /**
   * Checks if the given handler has access to the journal.
   * @param handler The handler to check.
   * @returns True if the handler has access, false otherwise.
   */
  isAccessible(handler: any): boolean {
    return this.handler === handler
  }

  isAlreadyBackup(pageIndex: number): boolean {
    return this._indexes.has(pageIndex)
  }

  /**
   * Checks if a journal file exists for a given database path.
   * @param databasePath The path to the database file.
   * @returns True if the journal file exists, false otherwise.
   */
  async exists(databasePath: string): Promise<boolean> {
    const journalPath = this.getJournalPath(databasePath)
    await this.engine.boot(journalPath)
    return this.engine.exists(journalPath)
  }

  /**
   * Creates or updates a journal file with the given path and header data.
   * @param databasePath The path to the database file.
   * @param headerData The header data to write to the journal file.
   */
  async make(databasePath: string, headerData: number[]): Promise<void> {
    const journalPath = this.getJournalPath(databasePath)
    await this.engine.boot(journalPath)
    await this.engine.create(journalPath, [
      ...DataJournal.InitialData,
      ...headerData,
    ])
  }

  /**
   * Resets the journal with the given header data.
   * @param handler The handler performing the reset.
   * @param metadata The header data to use for the reset.
   * @throws {Error} If the journal is not initialized or the handler does not have permission.
   */
  async reset(handler: any, metadata: number[]): Promise<void> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    if (!this.isAccessible(handler)) {
      throw DataJournal.ERR_REQUIRE_PERM(handler, this.handler!)
    }
    if (metadata.length !== DataJournalFormat.DBMetadataSize) {
      throw new Error(
        `The journal backup metadata size must be ${DataJournalFormat.DBMetadataSize}. ` +
        `But got a ${metadata.length}.`
      )
    }

    await this.engine.truncate(0)
    await this.engine.append([
      ...DataJournal.InitialData,
      ...metadata,
    ])
    this.initialOption.write('working', 0)
    await this.initialOption.commit()

    this._indexes.clear()
  }
  
  /**
   * Starts a transaction in the journal.
   * @param handler The handler starting the transaction.
   * @throws {Error} If the journal is not initialized, the handler does not have permission, or a transaction is already in progress.
   */
  async startTransaction(handler: any, initialOption: Partial<DataJournalInitialOption>): Promise<void> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    if (!this.isAccessible(handler)) {
      throw DataJournal.ERR_REQUIRE_PERM(handler, this.handler!)
    }
    if (this.transacting) {
      throw new Error('The journal is already started.')
    }
    for (const key in initialOption) {
      const k = key as DataJournalMetadataFormatKey
      const value = initialOption[k]!
      this.initialOption.write(k, value)
    }
    await this.initialOption.commit()
    this.transacting = true
  }

  /**
   * Ends a transaction in the journal.
   * @param handler The handler ending the transaction.
   * @throws {Error} If the journal is not initialized, the handler does not have permission, or no transaction is in progress.
   */
  async endTransaction(handler: any, initialOption: Partial<DataJournalInitialOption>): Promise<void> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    if (!this.isAccessible(handler)) {
      throw DataJournal.ERR_REQUIRE_PERM(handler, this.handler!)
    }
    if (!this.transacting) {
      throw new Error('The journal has not started yet.')
    }
    for (const key in initialOption) {
      const k = key as DataJournalMetadataFormatKey
      const numeric = initialOption[k]!
      this.initialOption.write(k, numeric)
    }
    await this.initialOption.commit()
    this.transacting = false
  }

  async close(handler: any, databasePath: string): Promise<void> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    if (!this.isAccessible(handler)) {
      throw DataJournal.ERR_REQUIRE_PERM(handler, this.handler!)
    }
    if (this.transacting) {
      throw new Error(
        'The journal is currently in a transaction. ' +
        'You must end the transaction before dropping the backup.'
      )
    }
    const journalPath = this.getJournalPath(databasePath)
    await this.engine.close()
    await this.engine.unlink(journalPath)
    this.transacting = false
    this._indexes.clear()
  }

  /**
   * Restores the database state from the journal.
   * @param handler The handler performing the restoration.
   * @param option.pageSize The size of each page in the database.
   * @param option.getPageIndex A function to extract the page index from page data.
   * @param option.restoreMetadata A function to restore the database metadata.
   * @param option.restorePage A function to restore a specific page of the database.
   * @param option.truncate A function to truncate the database to a specific size.
   * @returns A promise that resolves when the restoration is complete.
   * @throws {Error} If the journal is not initialized or the handler does not have permission.
   */
  async restore(handler: any, {
    pageSize,
    getPageIndex,
    restoreMetadata,
    restorePage,
    truncate,
  }: {
    pageSize: number
    getPageIndex:     (pageData: number[]) => number
    restoreMetadata:  (metadata: number[]) => Promise<void>
    restorePage:      (pageIndex: number, pageData: number[]) => Promise<void>
    truncate:         (maximumPageIndex: number) => Promise<void>
  }): Promise<void> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    if (!this.isAccessible(handler)) {
      throw DataJournal.ERR_REQUIRE_PERM(handler, this.handler!)
    }
    const metadata = await this.getMetadataBackup()
    const working = await this.initialOption.read('working', 'numeric') as number
    if (!working) {
      await this.reset(handler, metadata)
      return
    }
    // truncate database file size
    const maximumPageIndex = await this.initialOption.read('maximumPageIndex', 'numeric') as number
    await truncate(maximumPageIndex)
    // restore database's metadata
    await restoreMetadata(metadata)
    // restore database's pages
    const restoredIndexes = new Set()
    const pages = this.getBackupPages(pageSize)
    for await (const page of pages) {
      const index = getPageIndex(page)
      if (restoredIndexes.has(index)) {
        continue
      }
      await restorePage(index, page)
      restoredIndexes.add(index)
    }
    await this.reset(handler, metadata)
  }

  /**
   * Backs up a page of the database to the journal.
   * @param pageIndex The index of the page to back up.
   * @param data The data of the page.
   */
  async backupPage(pageIndex: number, data: number[]): Promise<void> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    if (this._indexes.has(pageIndex)) {
      return
    }
    const maximumPageIndex = await this.initialOption.read('maximumPageIndex', 'numeric') as number
    if (pageIndex > maximumPageIndex) {
      return
    }
    await this.engine.append(data)
    this._indexes.add(pageIndex)
  }

  /**
   * Gets the backed-up metadata from the journal.
   * @returns The metadata.
   */
  async getMetadataBackup(): Promise<number[]> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    return this.engine.read(
      DataJournalFormat.DBMetadataOffset,
      DataJournalFormat.DBMetadataSize
    )
  }

  /**
   * Asynchronously yields backed-up pages from the journal.
   * @param pageSize The size of each page.
   * @returns An asynchronous generator that yields backed-up pages.
   */
  async *getBackupPages(pageSize: number): AsyncGenerator<number[]> {
    if (!this.initialized) {
      throw DataJournal.ERR_REQUIRE_INIT()
    }
    const size = await this.engine.size()
    const count = (size - DataJournalFormat.DBPageOffset) / pageSize
    for (let i = 0; i < count; i++) {
      const offset = DataJournalFormat.DBPageOffset + (i * pageSize)
      const data = await this.engine.read(offset, pageSize)
      yield data
    }
  }
}

/**
 * `AuthenticatedDataJournal` class
 * It is for providing authentication of `DataJournal` class.
 */
export class AuthenticatedDataJournal<T> extends DataJournal {
  /**
   * Checks if an object is an instance of `AuthenticatedDataJournal`.
   * @param object The object to check.
   * @returns True if the object is a `AuthenticatedDataJournal` instance, false otherwise.
   */
  static IsInstance<T = any>(object: any): object is AuthenticatedDataJournal<T> {
    return object instanceof AuthenticatedDataJournal
  }

  /**
   * Creates an `AuthenticatedDataJournal` instance from a `DataJournal` instance.
   * @param guessHandler The handler for authentication.
   * @param journal The `DataJournal` instance.
   * @returns An `AuthenticatedDataJournal` instance or `undefined` if the journal is not provided.
   */
  static From(guessHandler: any, journal: DataJournal|undefined): AuthenticatedDataJournal<any>|undefined {
    if (!DataJournal.IsInstance(journal)) {
      return undefined
    }
    if (AuthenticatedDataJournal.IsInstance(journal)) {
      return journal as AuthenticatedDataJournal<any>
    }
    const engine = (journal as DataJournal).engine
    return new AuthenticatedDataJournal(guessHandler, engine)
  }

  /**
   * Creates a new `AuthenticatedDataJournal` instance.
   * @param handler The handler for authentication.
   * @param engine The data engine to use for journal operations.
   */
  constructor(handler: T, engine: DataEngine) {
    super(engine)
    this.handler = handler
    this.initialized = true
  }
}
