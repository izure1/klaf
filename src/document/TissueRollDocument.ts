import { existsSync } from 'node:fs'
import { open } from 'node:fs/promises'

import { BPTreeSync, SerializeStrategyHead } from 'serializable-bptree'
import { CacheEntanglementSync } from 'cache-entanglement'
import { h64 } from 'xxhashjs'
import { TissueRoll } from '../core/TissueRoll'
import { TissueRollMediator } from '../core/TissueRollMediator'
import { TissueRollComparator } from './TissueRollComparator'
import { TissueRollStrategy } from './TissueRollStrategy'
import { ErrorBuilder } from './ErrorBuilder'
import { ObjectHelper } from '../utils/ObjectHelper'
import { DelayedExecution } from '../utils/DelayedExecution'

export type PrimitiveType = string|number|boolean|null
export type SupportedType = PrimitiveType|SupportedType[]|{ [key: string]: SupportedType }

export interface TissueRollDocumentRoot {
  verify: 'TissueRollDocument'
  tableVersion: number
  reassignments: string[]
  head: Record<string, SerializeStrategyHead|null>
}

type TissueRollDocumentQueryCondition<T, K extends keyof T = keyof T> = {
  /**
   * Includes if this value matches the document's property value.
   */
  equal?: T[K]
  /**
   * Includes if this value does not match the document's property value.
   */
  notEqual?: T[K]
  /** 
   * Includes if this value is greater than the document's property value.
   */
  gt?: T[K]
  /** 
   * Includes if this value is greater than or equal to the document's property value.
   */
  gte?: T[K]
  /**
   * Includes if this value is less than the document's property value.
   */
  lt?: T[K]
  /**
   * Includes if this value is less than or equal to the document's property value.
   */
  lte?: T[K]
  /**
   * Searches for documents matching the given pattern. '%' matches zero or more characters, and '_' matches exactly one character.
   */
  like?: string
}

interface TissueRollDocumentRecordShape {
  [key: string]: SupportedType
}

interface TissueRollDocumentTimestampShape {
  /**
   * The index when the document was inserted. This value is automatically added when inserted into the database.
   */
  documentIndex: number
  /**
   * The timestamp when the document was created. This value is automatically added when inserted into the database.
   */
  createdAt: number
  /**
   * The timestamp when the document was last updated. This value is automatically updated when the document is modified in the database.
   */
  updatedAt: number
}

type TissueRollDocumentRecord<
  T extends TissueRollDocumentRecordShape
> = T&TissueRollDocumentTimestampShape

type TissueRollDocumentQuery<
  T extends TissueRollDocumentRecord<any>
> = {
  /**
   * The property of the document to be searched.
   */
  [K in keyof T]?: T[K]|TissueRollDocumentQueryCondition<T, K>
}

interface TissueRollDocumentOption<T extends TissueRollDocumentRecord<TissueRollDocumentRecordShape>> {
  /**
   * Used when retrieving a portion of the searched documents. Specifies the starting offset, with a default value of `0`.
   */
  start?: number
  /**
   * Used when retrieving a portion of the searched documents. Specifies the ending offset, with a default value of `Number.MAX_SAFE_INTEGER`.
   */
  end?: number
  /**
   * The property used for sorting the retrieved documents. Results are sorted based on this value, with the default being `documentIndex`.
   */
  order?: keyof T
  /**
   * The property used for sorting the retrieved documents. If set to `true`, it sorts in descending order. The default value is `false`.
   */
  desc?: boolean
}

interface TissueRollDocumentField {
  default: () => SupportedType,
  validate?: (v: SupportedType) => boolean
}

interface TissueRollDocumentTable {
  [key: string]: TissueRollDocumentField
}

type TissueRollDocumentTableType<T extends TissueRollDocumentTable> = {
  [K in keyof T]: ReturnType<T[K]['default']>
}

interface TissueRollDocumentCreateOption<T extends TissueRollDocumentTable> {
  /**
   * This is the path where the database file will be created.
   */
  path: string
  /**
   * Scheme version.
   */
  version: number
  /**
   * The fields of the database table and their validation functions.
   * The property names become field names, and their values perform validation when inserting or updating values.
   * Please refer to the example below.
   * ```
   * const db = TissueRollDocument.Open({
   *   path: 'my-db-path/database.db',
   *   table: {
   *     id: {
   *       default: () => uuid(),
   *       validate: (v) => isUUID(v)
   *     },
   *     email: {
   *       default: () => createDefaultEmail(),
   *       validate: (v) => isEmail(v)
   *     }
   *   }
   * })
   * ```
   * If you use the [validator.js](https://github.com/validatorjs/validator.js) library,
   * you can easily implement these validation checks.
   * Please refer to it for assistance.
   */
  table: T
  /**
   * This is the maximum data size a single page in the database can hold. The default is `1024`. If this value is too large or too small, it can affect performance.
   */
  payloadSize?: number
  /**
   * This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  overwrite?: boolean
}

export class TissueRollDocument<T extends TissueRollDocumentRecordShape> {
  protected static readonly DB_NAME = 'TissueRollDocument'

  private static Verify(file: string, payload: string): TissueRollDocumentRoot {
    const docRoot = ObjectHelper.Parse(payload, ErrorBuilder.ERR_INVALID_OBJECT(payload))
    // not object
    if (!ObjectHelper.IsObject(docRoot)) {
      throw ErrorBuilder.ERR_INVALID_OBJECT(payload)
    }
    // check verify
    if (
      !ObjectHelper.VerifyProperties(docRoot, {
        verify: (v) => v === TissueRollDocument.DB_NAME,
        head: (v) => ObjectHelper.IsObject(v)
      })
    ) {
      throw ErrorBuilder.ERR_DB_INVALID(file)
    }
    return docRoot as unknown as TissueRollDocumentRoot
  }

  private static OrderN(payloadSize: number, meanValueSize: number): number {
    const reserved = 150
    const keySize = 32
    let n = 0
    while (
      reserved +
      TissueRollMediator.HeaderSize +
      (
        TissueRollMediator.CellSize +
        TissueRollMediator.RecordHeaderSize +
        meanValueSize +
        keySize +
        3 // comma, quotation
      ) * n <= payloadSize
    ) {
      n++
    }
    return Math.ceil((n - 1) * 10)
  }

  /**
   * It creates a new database file.
   * @param option The database creation options.
   */
  static Create<
    T extends TissueRollDocumentTable
  >(option: TissueRollDocumentCreateOption<T>): TissueRollDocument<TissueRollDocumentTableType<T>> {
    const {
      path,
      version,
      table,
      payloadSize = 1024,
      overwrite = false
    } = option
    const db = TissueRoll.Create(path, payloadSize, overwrite)
    const docRoot: TissueRollDocumentRoot = {
      verify: TissueRollDocument.DB_NAME,
      tableVersion: 0,
      reassignments: [],
      head: {},
    }
    const rootId = TissueRollMediator.Put(
      db,
      new Array(db.metadata.payloadSize).fill(0),
      false
    )
    db.update(rootId, JSON.stringify(docRoot))

    return new TissueRollDocument(db, rootId, docRoot, table, version, 0)
  }

  /**
   * It opens or creates a database file at the specified path. 
   * @param option The database creation options.
   */
  static Open<
    T extends TissueRollDocumentTable
  >(option: TissueRollDocumentCreateOption<T>): TissueRollDocument<TissueRollDocumentTableType<T>> {
    const {
      path,
      version,
      table,
      payloadSize = 1024
    } = option
    // 파일이 존재하지 않을 경우
    if (!existsSync(path)) {
      if (!payloadSize) {
        throw ErrorBuilder.ERR_DB_NO_EXISTS(path)
      }
      // 옵션이 지정되었을 경우 새롭게 생성합니다
      return TissueRollDocument.Create(option)
    }

    const db = TissueRoll.Open(path, payloadSize)
    const record = db.getRecords(1)[0]
    const docRoot = TissueRollDocument.Verify(path, record.payload)

    return new TissueRollDocument(db, record.header.id, docRoot, table, version, 0)
  }
 
  protected readonly db: TissueRoll
  protected readonly rootId: string
  protected readonly order: number
  protected readonly comparator: TissueRollComparator
  protected readonly locker: DelayedExecution
  protected readonly table: TissueRollDocumentTable
  protected readonly tableVersion: number
  protected lock: boolean
  private readonly _trees: ReturnType<TissueRollDocument<T>['_createTreesCache']>
  private readonly _document: ReturnType<TissueRollDocument<T>['_createDocumentCache']>
  private _root: TissueRollDocumentRoot
  private _metadata: {
    autoIncrement: bigint
    count: number
  }

  protected constructor(
    db: TissueRoll,
    rootId: string,
    root: TissueRollDocumentRoot,
    table: TissueRollDocumentTable,
    tableVersion: number,
    writeBack: number
  ) {
    this.db = db
    this.rootId = rootId
    this.order = Math.max(TissueRollDocument.OrderN(db.metadata.payloadSize, 40), 4)
    this.comparator = new TissueRollComparator()
    this.locker = new DelayedExecution(writeBack)
    this.tableVersion = tableVersion
    this.table = table
    this.lock = false
    this._root = root
    this._trees = this._createTreesCache()
    this._document = this._createDocumentCache()

    const { autoIncrement, count } = db.metadata
    this._metadata = {
      autoIncrement,
      count,
    }

    // Needed to alter table
    if (this._root.tableVersion < tableVersion) {
      this._root.tableVersion = tableVersion
      this.updateRoot(this._root)
      this._callInternalUpdate(
        {},
        (document) => this._normalizeRecord(document as any),
        (document) => ({
          documentIndex: document.documentIndex,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        }) as any
      )
    }
  }

  private _createTreesCache() {
    return new CacheEntanglementSync((key) => {
      const tree = new BPTreeSync<string, SupportedType>(
        new TissueRollStrategy(this.order, key, this.db, this.locker, this.rootId, this._root),
        this.comparator
      )
      tree.init()
      return tree
    })
  }

  private _createDocumentCache() {
    return new CacheEntanglementSync((key, state, document: TissueRollDocumentRecord<T>) => {
      return document
    })
  }

  protected getTree(property: string): BPTreeSync<string, SupportedType> {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    return this._trees.cache(property).raw
  }

  protected updateRoot(root: TissueRollDocumentRoot): void {
    this._root = root
    this.db.update(this.rootId, JSON.stringify(root))
  }

  private _normalizeOption(
    option: Partial<TissueRollDocumentOption<TissueRollDocumentRecord<T>>>
  ): Required<TissueRollDocumentOption<TissueRollDocumentRecord<T>>> {
    const def: Required<TissueRollDocumentOption<TissueRollDocumentRecord<T>>> = {
      start: 0,
      end: Number.MAX_SAFE_INTEGER,
      order: 'documentIndex',
      desc: false
    }
    const merged: Required<
      TissueRollDocumentOption<TissueRollDocumentRecord<T>>
    > = Object.assign({}, def, option)
    return merged
  }

  private _normalizeFlatQuery(
    query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>
  ): TissueRollDocumentQuery<TissueRollDocumentRecord<T>> {
    query = Object.assign({}, query)
    for (const property in query) {
      const condition = query[property]
      if (typeof condition !== 'object' || condition === null) {
        (query as any)[property] = {
          equal: condition
        }
      }
    }
    return query
  }

  private _normalizeQuery(
    query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>
  ): TissueRollDocumentQuery<TissueRollDocumentRecord<T>> {
    return Object.assign({
      'documentIndex': {
        gt: 0
      }
    }, this._normalizeFlatQuery(query))
  }

  private _normalizeRecord(
    record: Partial<T>
  ): T {
    const after: any = {}
    for (const field in this.table) {
      const { default: def, validate } = this.table[field]
      const v = record[field] ?? def()
      if (validate && !validate(v)) {
        throw new Error(`The value '${v}' did not pass the validation of field '${field}'.`)
      }
      after[field] = v
    }
    return after as T
  }

  /**
   * Returns the metadata of the database.
   * This value is a state variable and any modifications will not be reflected in the database.
   * 
   * This metadata contains brief information about the database.
   * For example, the `metadata.autoIncrement` property indicates how many documents have been inserted into the database so far.
   */
  get metadata() {
    const { autoIncrement, count } = this._metadata
    const { payloadSize, timestamp } = this.db.metadata
    const { tableVersion } = this
    return {
      autoIncrement,
      count,
      payloadSize,
      timestamp,
      tableVersion
    }
  }

  private _callInternalPut(
    document: Partial<T>,
    ...overwrite: Partial<T>[]
  ): TissueRollDocumentRecord<T> {
    const record = Object.assign(
      this._normalizeRecord(document),
      ...overwrite
    ) as TissueRollDocumentRecord<T>
    const stringify = JSON.stringify(record)
    const recordId = this.db.put(stringify)
    for (const property in record) {
      const tree = this.getTree(property)
      const value = record[property]
      tree.insert(recordId, value)
    }
    this._document.update(recordId, record)
    this._metadata.autoIncrement++
    this._metadata.count++
    return Object.assign({}, record)
  }

  /**
   * Insert values into the database. These values must follow the JSON format and are referred to as documents.
   * 
   * A document consists of key-value pairs, for example, `{ name: 'john' }`. While documents can be nested, nested structures are not searchable.
   * For instance, you can insert a document like `{ information: { name: 'john' } }`, but you cannot search based on `information.name`.
   * 
   * If search functionality is required, store the relevant property separately as a top-level property.
   * @param document The document to be inserted.
   */
  put(document: Partial<T>): TissueRollDocumentRecord<T> {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    const now = Date.now()
    const overwrite = {
      documentIndex: Number(this._metadata.autoIncrement)+1,
      createdAt: now,
      updatedAt: now,
    } as TissueRollDocumentRecord<T>
    return this._callInternalPut(document, overwrite)
  }

  /**
   * Deletes the document(s) inserted into the database. The data to be deleted can be specified using queries to define the scope.
   * @param query The scope of the documents to be deleted.
   * @returns The number of documents deleted.
   */
  delete(query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>): number {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    const ids = this.findRecordIds(query)
    for (const id of ids) {
      const payload = this.db.pick(id).record.payload
      const hashKey = h64(payload, 0).toString(16)
      const record = this._document.cache(hashKey, JSON.parse(payload)).raw
      for (const property in record) {
        const tree = this.getTree(property)
        const value = record[property]
        tree.delete(id, value)
      }
      this.db.delete(id)
      this._document.delete(id)
    }
    this._metadata.count -= ids.length
    return ids.length
  }

  private _callInternalUpdate(
    query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>,
    update: Partial<T|TissueRollDocumentRecord<T>>|(
      (record: TissueRollDocumentRecord<T>) => Partial<T>
    ),
    createOverwrite: (
      before: TissueRollDocumentRecord<T>
    ) => Partial<TissueRollDocumentRecord<T>>
  ): number {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    const ids = this.findRecordIds(query)
    for (const id of ids) {
      const before = this._document
        .cache(id, JSON.parse(this.db.pick(id).record.payload))
        .clone()
      const normalizedBefore = Object.assign(
        this._normalizeRecord(before),
        {
          documentIndex: before.documentIndex,
          createdAt: before.createdAt,
          updatedAt: before.updatedAt,
        }
      ) as TissueRollDocumentRecord<T>
      const partial = typeof update === 'function' ? update(before) : update
      const overwrite = createOverwrite(before)
      const after = Object.assign(
        normalizedBefore,
        partial,
        overwrite
      ) as unknown as TissueRollDocumentRecord<T>
      for (const property in before) {
        const tree = this.getTree(property)
        const value = before[property]
        tree.delete(id, value)
      }
      for (const property in after) {
        const tree = this.getTree(property)
        const value = after[property]
        tree.insert(id, value)
      }
      const stringify = JSON.stringify(after)
      this.db.update(id, stringify)
      this._document.update(id, after)
    }
    return ids.length
  }

  /**
   * Updates a portion of the document(s) inserted into the database. You can specify the scope of the document to be updated using queries.
   * This method modifies only the specified properties without changing the entire document.  
   * 
   * For example, if there is a document `{ name: 'john', age: 20 }`, and you provide `{ age: 21 }` for updating, the document will become `{ name: 'john', age: 21 }`.
   * 
   * If it is a non-existing property, it will be inserted.  
   * For instance, with `{ student: true }`, the document will become `{ name: 'john', age: 20, student: true }`.
   * @param query The scope of the documents to be updated.
   * @param update The properties of the documents to be updated.
   * @returns The number of documents updated.
   */
  partialUpdate(
    query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>,
    update: Partial<T>|((record: TissueRollDocumentRecord<T>) => Partial<T>)
  ): number {
    return this._callInternalUpdate(query, update, () => ({
      updatedAt: Date.now()
    }) as any)
  }

  /**
   * Updates the entire document(s) inserted into the database. You can specify the scope of the document to be updated using queries.
   * This method completely updates the inserted document.
   * 
   * For example, if there is a document `{ name: 'john', age: 20 }`, and you provide `{ name: 'park' }` for updating, the document will become `{ name: 'park' }`.
   * @param query The scope of the documents to be updated.
   * @param update The properties of the documents to be updated.
   * @returns The number of documents updated.
   */
  fullUpdate(
    query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>,
    update: T|((record: TissueRollDocumentRecord<T>) => T)
  ): number {
    return this._callInternalUpdate(query, update, () => ({
      updatedAt: Date.now()
    }) as any)
  }
  
  protected findRecordIds(
    query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>
  ): string[] {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    query = this._normalizeQuery(query)
    let result: Set<string>|undefined
    for (const property in query) {
      const tree = this.getTree(property)
      result = tree.keys(
        query[property]! as TissueRollDocumentQueryCondition<T>,
        result
      )
    }
    return Array.from(result ?? [])
  }

  /**
   * Retrieve documents inserted into the database using a query to specify the range of documents to be queried.  
   * Additionally, you can use the `options` parameter to specify the starting and ending indices of the query results and perform sorting.
   * @param query The range of documents to be queried.
   * @param option Modify the results of the retrieved documents.
   */
  pick(
    query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>,
    option: TissueRollDocumentOption<TissueRollDocumentRecord<T>> = {}
  ): TissueRollDocumentRecord<T>[] {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    const { start, end, order, desc } = this._normalizeOption(option)
    const records = this.findRecordIds(query).map((id) => (
      this._document
        .cache(id, JSON.parse(this.db.pick(id).record.payload))
        .clone()
    ))
    if (desc) {
      records.sort((a, b) => this.comparator.asc(
        b[order] as PrimitiveType,
        a[order] as PrimitiveType
      ))
    }
    else {
      records.sort((a, b) => this.comparator.asc(
        a[order] as PrimitiveType,
        b[order] as PrimitiveType
      ))
    }
    return records.slice(start, end)
  }

  /**
   * It searches for and returns the number of documents that match the conditions.
   * Unlike the `pick` method, this method does not go through the parsing and sorting of documents, so it is much faster.
   * @param query The range of documents to be queried.
   * @returns The number of documents matched.
   */
  count(query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>): number {
    return this.findRecordIds(query).length
  }

  /**
   * Exports data from all documents inserted into the current database to a file.
   * Each document is separated by a newline character.
   * The exported file can then be used with the `importData` method to insert data into another database.
   * This method is useful for database migration purposes.
   * 
   * This method may take longer depending on the amount of inserted documents. Therefore, it's advisable to avoid executing it during runtime.
   * @param dataDist Location where the data will be stored in the file.
   * @param silent Determines whether the progress will be printed to the console.
   * If this value is set to `true`, it will not be printed to the console. The default value is `false`.
   */
  async exportData(dataDist: string, silent = false): Promise<void> {
    const handle = await open(dataDist, 'a')
    const documents = this.pick({})
    const max = documents.length
    let count = 0
    for (const document of documents) {
      await handle.write(JSON.stringify(document)+'\n', null, 'utf8')
      if (!silent) {
        count++
        const per = count / max * 100
        console.log(`Exporting data: ${per.toFixed(2)}%`)
      }
    }
    await handle.close()
    if (!silent) {
      console.log('Data exporting done.')
    }
  }

  /**
   * Reads documents from a file where all document data is stored and inserts them into the current database.
   * Each document should be separated by a newline character.
   * Such a file containing all document data can be created using the `exportData` method.
   * This method is useful for database migration purposes.
   * 
   * This method may take longer depending on the amount of inserted documents. Therefore, it's advisable to avoid executing it during runtime.
   * @param dataSrc Location of the file where the data is stored.
   * @param silent Determines whether the progress will be printed to the console.
   * If this value is set to `true`, it will not be printed to the console. The default value is `false`.
   */
  async importData(dataSrc: string, silent = false): Promise<void> {
    const fd = await open(dataSrc, 'r')
    let count = 0
    for await (const line of fd.readLines()) {
      const document = JSON.parse(line) as TissueRollDocumentRecord<T>
      this._callInternalPut(document)
      count++
      if (!silent) {
        console.log(`Importing document ${count.toLocaleString()} done.`)
      }
    }
  }

  /**
   * Shut down the database to close file input and output.
   * The database does not close immediately due to delayed writing.
   * Therefore, this function operates asynchronously, and when the database is closed, the promise is resolved.
   * 
   * While the database is closing, it is locked, and during this period, you cannot perform read/write operations on the database.
   */
  close(): Promise<void> {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    this.lock = true
    return new Promise((resolve) => {
      this.locker.execute('database-close', () => {
        this.db.close()
        resolve()
      })
    })
  }
}
