import { parse, format } from 'path-browserify'
import { type DataEngine } from './DataEngine'
import { IterableView } from '../utils/IterableView'
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

export enum DataJournalPageFormat {
  HeaderOffset        = 0,
  HeaderSize          = 100,

  HeaderIndexOffset   = 0,
  HeaderIndexSize     = 4,

  payloadOffset       = DataJournalPageFormat.HeaderOffset + DataJournalPageFormat.HeaderSize,
}

export interface DataJournalPage {
  header: {
    index: number
  }
  payload: Uint8Array
}

export enum DataJournalFormat {
  /**
   * The size of the root header in the journal file.
   */
  RootHeaderSize            = 100,
  /**
   * The offset for the working flag in the root header.
   */
  RootWorkingOffset         = 0,
  /**
   * The size of the working flag.
   */
  RootWorkingSize           = 1,
  /**
   * The offset for the maximum page index in the root header.
   */
  RootMaxPageIndexOffset    = DataJournalFormat.RootWorkingOffset + DataJournalFormat.RootWorkingSize,
  /**
   * The size of the maximum page index.
   */
  RootMaxPageIndexSize      = 4,
  /**
   * The offset for the journal version in the root header.
   */
  RootJournalVersionOffset  = DataJournalFormat.RootMaxPageIndexOffset + DataJournalFormat.RootMaxPageIndexSize,
  /**
   * The size of the journal version.
   */
  RootJournalVersionSize    = 2,
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
  journalVersion: number
}

type DataJournalMetadataFormatKey = keyof DataJournalInitialOption
type DataJournalMetadataFormatValue = [number, number]
type DataJournalMetadataFormatMap = Record<DataJournalMetadataFormatKey, DataJournalMetadataFormatValue>
interface DataJournalMetadataFormData {
  dirty: boolean
  numeric: number|bigint
  array: Uint8Array
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
  private _read(data: DataJournalMetadataFormData, to: 'array'): Uint8Array
  private _read(data: DataJournalMetadataFormData, to: 'numeric'|'array'): number|bigint|Uint8Array {
    if (to === 'numeric') return data.numeric
    if (to === 'array')   return data.array
    throw new Error(`Invalid 'to' parameter. Expected 'numeric' or 'array', but got '${to}'.`)
  }
  
  async read(key: DataJournalMetadataFormatKey, to: 'numeric'): Promise<number|bigint>
  async read(key: DataJournalMetadataFormatKey, to: 'array'): Promise<Uint8Array>
  async read(key: DataJournalMetadataFormatKey, to: 'numeric'|'array'): Promise<Uint8Array|number|bigint> {
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
  write(key: DataJournalMetadataFormatKey, value: Uint8Array): void
  write(key: DataJournalMetadataFormatKey, value: number|Uint8Array): void {
    const [_start, size] = this.formatMap[key]
    let numeric: number|bigint
    let array: Uint8Array
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
  protected static readonly JournalVersion = 1
  /**
   * The initial data used when creating a new journal file.
   */
  protected static readonly InitialData = (() => {
    const data = DataJournal.CreateIterable(
      DataJournalFormat.RootHeaderSize,
      0,
    )

    IterableView.Update(
      data,
      DataJournalFormat.RootJournalVersionOffset,
      IntegerConverter.ToArray16(DataJournal.JournalVersion)
    )

    return data
  })()

  /**
   * Decorator class for `DataJournal` methods.
   * It provides decorators for common checks, like initialization and ownership.
   */
  static readonly Decorator = class DataJournalDecorator {
    /**
     * Requires the `DataJournalContainer` to have `DataJournal` instance before allowing the decorated method to execute.
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
          return Promise.resolve()
        }
        return originalMethod.apply(this, args)
      }
      return descriptor
    }
  }

  /**
   * Creates an error for when the journal requires a token.
   * @returns An error object.
   */
  protected static ERR_REQUIRE_TOKEN(): Error {
    return new Error('You must have a token to use this feature.')
  }

  /**
   * Creates an iterable of a specific length and filled with a specific value.
   * @param length The length of the iterable.
   * @param fill The value to fill the iterable with.
   * @returns A number array.
   */
  protected static CreateIterable(length: number, fill: number): Uint8Array {
    return new Uint8Array(length).fill(fill)
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
  private readonly _view: IterableView
  protected transacting: boolean
  protected readonly initialOption: DataJournalInitialOptionManager
  readonly engine: DataEngine

  /**
   * Creates a new `DataJournal` instance.
   * @param engine The data engine to use for journal operations.
   */
  constructor(engine: DataEngine) {
    this._indexes = new Set()
    this._view = new IterableView()
    this.transacting = false
    this.engine = engine
    this.initialOption = new DataJournalInitialOptionManager(engine, {
      working: [
        DataJournalFormat.RootWorkingOffset as number,
        DataJournalFormat.RootWorkingSize as number,
      ],
      maximumPageIndex: [
        DataJournalFormat.RootMaxPageIndexOffset as number,
        DataJournalFormat.RootMaxPageIndexSize as number,
      ],
      journalVersion: [
        DataJournalFormat.RootJournalVersionOffset as number,
        DataJournalFormat.RootJournalVersionSize as number
      ],
    })
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

  isAlreadyBackup(pageIndex: number): boolean {
    return this._indexes.has(pageIndex)
  }

  getJournalPageSize(dataSize: number): number {
    return dataSize + DataJournalPageFormat.HeaderSize
  }

  /**
   * Checks if a journal file exists for a given database path.
   * @param databasePath The path to the database file.
   * @returns True if the journal file exists, false otherwise.
   */
  async exists(databasePath: string): Promise<boolean> {
    const journalPath = this.getJournalPath(databasePath)
    await this.engine._boot(journalPath)
    return this.engine.exists(journalPath)
  }

  /**
   * Creates or updates a journal file with the given path and header data.
   * @param databasePath The path to the database file.
   * @param headerData The header data to write to the journal file.
   */
  async make(databasePath: string, headerData: Uint8Array): Promise<void> {
    const journalPath = this.getJournalPath(databasePath)
    await this.engine._boot(journalPath)
    await this.engine._create(journalPath, new Uint8Array([
      ...DataJournal.InitialData,
      ...headerData,
    ]))
  }

  /**
   * Resets the journal with the given header data.
   * @param metadata The header data to use for the reset.
   */
  async reset(metadata: Uint8Array): Promise<void> {
    if (metadata.length !== DataJournalFormat.DBMetadataSize) {
      throw new Error(
        `The journal backup metadata size must be ${DataJournalFormat.DBMetadataSize}. ` +
        `But got a ${metadata.length}.`
      )
    }

    await this.engine.truncate(0)
    await this.engine.append(new Uint8Array([
      ...DataJournal.InitialData,
      ...metadata,
    ]))
    this.initialOption.write('working', 0)
    await this.initialOption.commit()

    this._indexes.clear()
  }
  
  /**
   * Starts a transaction in the journal.
   * @throws {Error} If transaction is already in progress.
   */
  async startTransaction(initialOption: Partial<DataJournalInitialOption>): Promise<void> {
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
   * @throws {Error} If no transaction is in progress.
   */
  async endTransaction(initialOption: Partial<DataJournalInitialOption>): Promise<void> {
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

  async close(databasePath: string): Promise<void> {
    if (this.transacting) {
      throw new Error(
        'The journal is currently in a transaction. ' +
        'You must end the transaction before dropping the backup.'
      )
    }
    const journalPath = this.getJournalPath(databasePath)
    await this.engine._unlink(journalPath)
    this.transacting = false
    this._indexes.clear()
  }

  protected parsePage(page: Uint8Array): DataJournalPage {
    const {
      HeaderOffset,
      HeaderSize,
      HeaderIndexOffset,
      HeaderIndexSize,
      payloadOffset,
    } = DataJournalPageFormat
    const rawHeader = this._view.read(page, HeaderOffset, HeaderSize)
    const rawPayload = this._view.read(page, payloadOffset)
    const rawHeaderIndex = this._view.read(rawHeader, HeaderIndexOffset, HeaderIndexSize)
    const headerIndex = IntegerConverter.FromArray32(rawHeaderIndex)
    return {
      header: {
        index: headerIndex,
      },
      payload: rawPayload,
    }
  }

  /**
   * Logs the restoration of the database from the journal.
   * @param maximumPageIndex The maximum page index in the database.
   * @param pageSize The size of each page in the database.
   */
  logJournalRestore(data: any): void {
    const restoredDate = new Date()
    console.log(`Klaf.js: The database restored from journal file at ${restoredDate.toLocaleString()}`)
    console.table(data)
  }

  /**
   * Restores the database state from the journal.
   * @param option.pageSize The size of each page in the database.
   * @param option.getPageIndex A function to extract the page index from page data.
   * @param option.restoreMetadata A function to restore the database metadata.
   * @param option.restorePage A function to restore a specific page of the database.
   * @param option.truncate A function to truncate the database to a specific size.
   * @returns A promise that resolves when the restoration is complete.
   */
  async restore({
    pageSize,
    restoreMetadata,
    restoreData,
    truncate,
    done,
  }: {
    pageSize: number
    restoreMetadata:  (metadata: Uint8Array) => Promise<void>
    restoreData:      (journalPageIndex: number, data: Uint8Array) => Promise<void>
    truncate:         (maximumPageIndex: number) => Promise<void>
    done:             (metadata: Uint8Array) => Promise<void>
  }): Promise<boolean> {
    const journalPageSize = this.getJournalPageSize(pageSize)
    const metadata = await this.getMetadataBackup()
    const working = await this.initialOption.read('working', 'numeric') as number
    const journalVersion = await this.initialOption.read('journalVersion', 'numeric') as number
    if (!working) {
      await this.reset(metadata)
      return false
    }
    if (journalVersion < DataJournal.JournalVersion) {
      console.log(`Klaf.js: The journal version is lower than the current version. The journal will be ignored.`)
      await this.reset(metadata)
      return false
    }
    // truncate database file size
    const maximumPageIndex = await this.initialOption.read('maximumPageIndex', 'numeric') as number
    await truncate(maximumPageIndex)
    // restore database's metadata
    await restoreMetadata(metadata)
    // restore database's pages
    const pages = this.getBackupPages(journalPageSize)
    for await (const page of pages) {
      const { header, payload } = this.parsePage(page)
      await restoreData(header.index, payload)
    }
    await this.reset(metadata)
    await done(metadata)
    this.logJournalRestore({ maximumPageIndex, pageSize })
    return true
  }

  /**
   * Backs up a page of the database to the journal.
   * @param pageIndex The index of the page to back up.
   * @param data The data of the page.
   */
  async backupPage(pageIndex: number, data: Uint8Array): Promise<void> {
    if (this._indexes.has(pageIndex)) {
      return
    }

    const header = DataJournal.CreateIterable(DataJournalPageFormat.HeaderSize, 0)
    const headerIndex = IntegerConverter.ToArray32(pageIndex)
    IterableView.Update(header, DataJournalPageFormat.HeaderIndexOffset, headerIndex)

    const page = new Uint8Array([
      ...header,
      ...data,
    ])
    await this.engine.append(page)
    this._indexes.add(pageIndex)
  }

  /**
   * Gets the backed-up metadata from the journal.
   * @returns The metadata.
   */
  async getMetadataBackup(): Promise<Uint8Array> {
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
  async *getBackupPages(pageSize: number): AsyncGenerator<Uint8Array> {
    const { DBPageOffset } = DataJournalFormat
    const size = await this.engine.size()
    const allPagesSize = size - DBPageOffset
    const count = allPagesSize / pageSize
    for (let i = 0; i < count; i++) {
      const offset = DBPageOffset + (i * pageSize)
      const data = await this.engine.read(offset, pageSize)
      yield data
    }
  }
}
