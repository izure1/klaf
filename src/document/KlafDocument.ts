import { BPTreeAsync, SerializeStrategyHead } from 'serializable-bptree'
import { CacheEntanglementAsync } from 'cache-entanglement'
import { Ryoiki } from 'ryoiki'
import { IRootHeader, Klaf } from '../core/Klaf'
import { KlafMediator } from '../core/KlafMediator'
import { KlafComparator } from './KlafComparator'
import { KlafStrategy } from './KlafStrategy'
import { ErrorBuilder } from './ErrorBuilder'
import { ObjectHelper } from '../utils/ObjectHelper'
import { Throttling } from '../utils/Throttling'
import { DataEngine } from '../engine/DataEngine'

export type PrimitiveType = string|number|boolean|null
export type SupportedType = PrimitiveType|SupportedType[]|{ [key: string]: SupportedType }

export interface KlafDocumentRoot {
  verify: 'TissueRollDocument'
  schemeVersion: number
  reassignments: string[]
  head: Record<string, SerializeStrategyHead|null>
}

export interface KlafDocumentMetadata {
  autoIncrement: bigint
  count: number
  payloadSize: number
  timestamp: bigint
  schemeVersion: number
}

export type KlafDocumentQueryCondition<T, K extends keyof T = keyof T> = {
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

export interface KlafDocumentRecordShape {
  [key: string]: SupportedType
}

export interface KlafDocumentTimestampShape {
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

export type KlafDocumentRecord<
  T extends KlafDocumentRecordShape
> = T&KlafDocumentTimestampShape

export type KlafDocumentQuery<
  T extends KlafDocumentRecord<any>
> = {
  /**
   * The property of the document to be searched.
   */
  [K in keyof T]?: T[K]|KlafDocumentQueryCondition<T, K>
}

export interface KlafDocumentOption<T extends KlafDocumentRecord<KlafDocumentRecordShape>> {
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
  order?: keyof KlafDocumentRecord<T>&string
  /**
   * The property used for sorting the retrieved documents. If set to `true`, it sorts in descending order. The default value is `false`.
   */
  desc?: boolean
}

export interface KlafDocumentField {
  default: () => SupportedType,
  validate?: (v: SupportedType) => boolean
}

export interface KlafDocumentScheme {
  [key: string]: KlafDocumentField
}

export type KlafDocumentSchemeType<T extends KlafDocumentScheme> = {
  [K in keyof T]: ReturnType<T[K]['default']>
}

export interface KlafDocumentCreateOption<T extends KlafDocumentScheme> {
  /**
   * This is the path where the database file will be created.
   */
  path: string
  /**
   * The engine that determines how the database will function.
   * By default, it supports `FileSystem`, `InMemory`, and `WebWorker`. You can import engine modules from `klaf/engine/~` to use them.
   * If desired, you can extend the DataEngine class to implement your own custom engine.
   */
  engine: DataEngine
  /**
   * Scheme version.
   */
  version: number
  /**
   * The fields of the database scheme and their validation functions.
   * The property names become field names, and their values perform validation when inserting or updating values.
   * Please refer to the example below.
   * ```
   * const db = KlafDocument.Open({
   *   path: 'my-db-path/database.db',
   *   scheme: {
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
  scheme: T
  /**
   * This is the maximum data size a single page in the database can hold. The default is `1024`. If this value is too large or too small, it can affect performance.
   */
  payloadSize?: number
  /**
   * This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  overwrite?: boolean
}

export class KlafDocument<T extends KlafDocumentRecordShape> {
  protected static readonly DB_NAME = 'TissueRollDocument'

  private static Verify(file: string, payload: string): KlafDocumentRoot {
    const docRoot = ObjectHelper.Parse(payload, ErrorBuilder.ERR_INVALID_OBJECT(payload))
    // not object
    if (!ObjectHelper.IsObject(docRoot)) {
      throw ErrorBuilder.ERR_INVALID_OBJECT(payload)
    }
    // check verify
    if (
      !ObjectHelper.VerifyProperties(docRoot, {
        verify: (v) => v === KlafDocument.DB_NAME,
        head: (v) => ObjectHelper.IsObject(v)
      })
    ) {
      throw ErrorBuilder.ERR_DB_INVALID(file)
    }
    return docRoot as unknown as KlafDocumentRoot
  }

  private static OrderN(payloadSize: number, meanValueSize: number): number {
    const reserved = 150
    const keySize = 32
    let n = 0
    while (
      reserved +
      KlafMediator.HeaderSize +
      (
        KlafMediator.CellSize +
        KlafMediator.RecordHeaderSize +
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
  static async Create<
    T extends KlafDocumentScheme
  >(option: KlafDocumentCreateOption<T>): Promise<KlafDocument<KlafDocumentSchemeType<T>>> {
    const {
      path,
      engine,
      version,
      scheme,
      payloadSize = 1024,
      overwrite = false
    } = option
    const db = await Klaf.Create({ path, engine, payloadSize, overwrite })
    const docRoot: KlafDocumentRoot = {
      verify: KlafDocument.DB_NAME,
      schemeVersion: 0,
      reassignments: [],
      head: {},
    }
    const rootId = await KlafMediator.Put(
      db,
      new Array(db.metadata.payloadSize).fill(0),
      false
    )
    await db.update(rootId, JSON.stringify(docRoot))
    const metadata = db.metadata
    const order = Math.max(KlafDocument.OrderN(metadata.payloadSize, 40), 4)

    return new KlafDocument(
      db,
      rootId,
      docRoot,
      scheme,
      version,
      metadata,
      order
    )
  }

  /**
   * It opens or creates a database file at the specified path. 
   * @param option The database creation options.
   */
  static async Open<
    T extends KlafDocumentScheme
  >(option: KlafDocumentCreateOption<T>): Promise<KlafDocument<KlafDocumentSchemeType<T>>> {
    const {
      path,
      engine,
      version,
      scheme,
      payloadSize = 1024
    } = option
    
    await engine.boot(path)
    if (!(await engine.exists(path))) {
      if (!payloadSize) {
        throw ErrorBuilder.ERR_DB_NO_EXISTS(path)
      }
      return await KlafDocument.Create(option)
    }

    const db = await Klaf.Open({ path, engine, payloadSize })
    const record = (await db.getRecords(1))[0]
    const docRoot = KlafDocument.Verify(path, record.payload)
    const metadata = db.metadata
    const order = Math.max(KlafDocument.OrderN(metadata.payloadSize, 40), 4)

    const klafDB = new KlafDocument(
      db,
      record.header.id,
      docRoot,
      scheme,
      version,
      metadata,
      order
    ) as KlafDocument<KlafDocumentSchemeType<T>>
    await klafDB._alterScheme(version)
    return klafDB
  }
 
  protected readonly db: Klaf
  protected readonly rootId: string
  protected readonly order: number
  protected readonly comparator: KlafComparator
  protected readonly throttling: Throttling
  protected readonly scheme: KlafDocumentScheme
  protected readonly locker: Ryoiki
  protected readonly schemeVersion: number
  protected closing: boolean
  private readonly _trees: ReturnType<KlafDocument<T>['_createTreesCache']>
  private readonly _document: ReturnType<KlafDocument<T>['_createDocumentCache']>
  private _root: KlafDocumentRoot
  private _metadata: {
    autoIncrement: bigint
    count: number
  }

  protected constructor(
    db: Klaf,
    rootId: string,
    root: KlafDocumentRoot,
    scheme: KlafDocumentScheme,
    schemeVersion: number,
    metadata: IRootHeader,
    order: number
  ) {
    this.db = db
    this.rootId = rootId
    this.order = order
    this.comparator = new KlafComparator()
    this.throttling = new Throttling(0)
    this.locker = new Ryoiki()
    this.schemeVersion = schemeVersion
    this.scheme = scheme
    this.closing = false
    this._root = root
    this._trees = this._createTreesCache()
    this._document = this._createDocumentCache()

    const { autoIncrement, count } = metadata
    this._metadata = {
      autoIncrement,
      count,
    }
  }

  private async _alterScheme(schemeVersion: number): Promise<void> {
    if (this._root.schemeVersion < schemeVersion) {
      this._root.schemeVersion = schemeVersion
      await this.updateRoot(this._root)
      await this._callInternalUpdate(
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
    return new CacheEntanglementAsync(async (key) => {
      const tree = new BPTreeAsync<string, SupportedType>(
        new KlafStrategy(this.order, key, this.db, this.throttling, this.rootId, this._root),
        this.comparator
      )
      await tree.init()
      return tree
    })
  }

  private _createDocumentCache() {
    return new CacheEntanglementAsync((
      _key,
      _state,
      document: KlafDocumentRecord<T>
    ) => document)
  }

  protected async getTree(property: string): Promise<BPTreeAsync<string, SupportedType>> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return (await this._trees.cache(property)).raw
  }

  protected async updateRoot(root: KlafDocumentRoot): Promise<void> {
    this._root = root
    await this.db.update(this.rootId, JSON.stringify(root))
  }

  private _normalizeOption(
    option: Partial<KlafDocumentOption<KlafDocumentRecord<T>>>
  ): Required<KlafDocumentOption<KlafDocumentRecord<T>>> {
    const def: Required<KlafDocumentOption<KlafDocumentRecord<T>>> = {
      start: 0,
      end: Number.MAX_SAFE_INTEGER,
      order: 'documentIndex',
      desc: false
    }
    const merged: Required<
      KlafDocumentOption<KlafDocumentRecord<T>>
    > = Object.assign({}, def, option)
    return merged
  }

  private _normalizeFlatQuery(
    query: KlafDocumentQuery<KlafDocumentRecord<T>>
  ): KlafDocumentQuery<KlafDocumentRecord<T>> {
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
    query: KlafDocumentQuery<KlafDocumentRecord<T>>,
    properties: Set<keyof KlafDocumentRecord<T>>,
  ): KlafDocumentQuery<KlafDocumentRecord<T>> {
    const richQuery: KlafDocumentQuery<KlafDocumentRecord<T>> = {}
    for (const property of properties) {
      richQuery[property] = { gt: undefined }
    }
    return Object.assign(richQuery, this._normalizeFlatQuery(query))
  }

  private _normalizeRecord(
    record: Partial<T>
  ): T {
    const after: any = {}
    for (const field in this.scheme) {
      const { default: defaultValue, validate } = this.scheme[field]
      const v = Object.hasOwn(record, field) ? record[field]! : defaultValue()
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
  get metadata(): KlafDocumentMetadata {
    const { autoIncrement, count } = this._metadata
    const { payloadSize, timestamp } = this.db.metadata
    const { schemeVersion } = this
    return {
      autoIncrement,
      count,
      payloadSize,
      timestamp,
      schemeVersion
    }
  }

  get engine(): typeof this.db.engine {
    return this.db.engine
  }

  private async _callInternalPut(
    document: Partial<T>,
    ...overwrite: Partial<T>[]
  ): Promise<KlafDocumentRecord<T>> {
    const record = Object.assign(
      this._normalizeRecord(document),
      ...overwrite
    ) as KlafDocumentRecord<T>
    const stringify = JSON.stringify(record)
    const recordId = await this.db.put(stringify)
    for (const property in record) {
      const tree = await this.getTree(property)
      const value = record[property]
      await tree.insert(recordId, value)
    }
    await this._document.update(recordId, record)
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
  async put(document: Partial<T>): Promise<KlafDocumentRecord<T>> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock((_lockId) => {
      lockId = _lockId
      const now = Date.now()
      const overwrite = {
        documentIndex: Number(this._metadata.autoIncrement)+1,
        createdAt: now,
        updatedAt: now,
      } as KlafDocumentRecord<T>
      return this._callInternalPut(document, overwrite)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  /**
   * Deletes the document(s) inserted into the database. The data to be deleted can be specified using queries to define the scope.
   * @param query The scope of the documents to be deleted.
   * @returns The number of documents deleted.
   */
  async delete(query: KlafDocumentQuery<KlafDocumentRecord<T>>): Promise<number> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const ids = await this.findRecordIds(query)
      for (let i = 0, len = ids.length; i < len; i++) {
        const id = ids[i]
        const payload = (await this.db.pick(id)).record.payload
        const record = JSON.parse(payload)
        for (const property in record) {
          const tree = await this.getTree(property)
          const value = record[property]
          await tree.delete(id, value)
        }
        await this.db.delete(id)
        this._document.delete(id)
      }
      this._metadata.count -= ids.length
      return ids.length
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  private async _callInternalUpdate(
    query: KlafDocumentQuery<KlafDocumentRecord<T>>,
    update: Partial<T|KlafDocumentRecord<T>>|(
      (record: KlafDocumentRecord<T>) => Partial<T>
    ),
    createOverwrite: (
      before: KlafDocumentRecord<T>
    ) => Partial<KlafDocumentRecord<T>>
  ): Promise<number> {
    const ids = await this.findRecordIds(query)
    for (let i = 0, len = ids.length; i < len; i++) {
      const id = ids[i]
      const before = (await this._document
        .cache(id, JSON.parse((await this.db.pick(id)).record.payload)))
        .clone()
      const normalizedBefore = Object.assign(
        this._normalizeRecord(before),
        {
          documentIndex: before.documentIndex,
          createdAt: before.createdAt,
          updatedAt: before.updatedAt,
        }
      ) as KlafDocumentRecord<T>
      const partial = typeof update === 'function' ? update(before) : update
      const overwrite = createOverwrite(before)
      const after = Object.assign(
        normalizedBefore,
        partial,
        overwrite
      ) as unknown as KlafDocumentRecord<T>
      for (const property in before) {
        const tree = await this.getTree(property)
        const value = before[property]
        await tree.delete(id, value)
      }
      for (const property in after) {
        const tree = await this.getTree(property)
        const value = after[property]
        await tree.insert(id, value)
      }
      const stringify = JSON.stringify(after)
      await this.db.update(id, stringify)
      await this._document.update(id, after)
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
  async partialUpdate(
    query: KlafDocumentQuery<KlafDocumentRecord<T>>,
    update: Partial<T>|((record: KlafDocumentRecord<T>) => Partial<T>)
  ): Promise<number> {
    let lockId: string
    return this.locker.writeLock((_lockId) => {
      lockId = _lockId
      return this._callInternalUpdate(query, update, () => ({
        updatedAt: Date.now()
      }) as any)
    }).finally(() => this.locker.writeUnlock(lockId))
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
  async fullUpdate(
    query: KlafDocumentQuery<KlafDocumentRecord<T>>,
    update: T|((record: KlafDocumentRecord<T>) => T)
  ): Promise<number> {
    let lockId: string
    return this.locker.writeLock((_lockId) => {
      lockId = _lockId
      return this._callInternalUpdate(query, update, () => ({
        updatedAt: Date.now()
      }) as any)
    }).finally(() => this.locker.writeUnlock(lockId))
  }
  
  protected async findRecordIds(
    query: KlafDocumentQuery<KlafDocumentRecord<T>>,
    order: keyof KlafDocumentRecord<T>&string = 'documentIndex',
    desc = false
  ): Promise<string[]> {
    const mustHave: keyof KlafDocumentRecord<T> = 'documentIndex'
    const properties = new Set<keyof KlafDocumentRecord<T>>([order, mustHave])
    const normalizedQuery = this._normalizeQuery(query, properties)
    let filterKeys: Set<string>|undefined = undefined
    for (const property in normalizedQuery) {
      const tree = await this.getTree(property)
      const condition = normalizedQuery[property]! as KlafDocumentQueryCondition<T>
      filterKeys = await tree.keys(condition, filterKeys)
    }
    const result = Array.from(filterKeys ?? [])
    if (desc) {
      result.reverse()
    }
    return result
  }

  /**
   * Retrieve documents inserted into the database using a query to specify the range of documents to be queried.  
   * Additionally, you can use the `options` parameter to specify the starting and ending indices of the query results and perform sorting.
   * @param query The range of documents to be queried.
   * @param option Modify the results of the retrieved documents.
   */
  async pick(
    query: KlafDocumentQuery<KlafDocumentRecord<T>>,
    option: KlafDocumentOption<KlafDocumentRecord<T>> = {}
  ): Promise<KlafDocumentRecord<T>[]> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const { start, end, order, desc } = this._normalizeOption(option)
      const records = []
      const ids = await this.findRecordIds(query, order, desc)
      for (const id of ids) {
        const record = (await this._document
          .cache(id, JSON.parse((await this.db.pick(id)).record.payload)))
          .clone()
        records.push(record)
      }
      return records.slice(start, end)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  /**
   * It searches for and returns the number of documents that match the conditions.
   * Unlike the `pick` method, this method does not go through the parsing and sorting of documents, so it is much faster.
   * @param query The range of documents to be queried.
   * @returns The number of documents matched.
   */
  async count(query: KlafDocumentQuery<KlafDocumentRecord<T>>): Promise<number> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      return (await this.findRecordIds(query)).length
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  /**
   * Shut down the database to close file input and output.
   * The database does not close immediately due to delayed writing.
   * Therefore, this function operates asynchronously, and when the database is closed, the promise is resolved.
   * 
   * While the database is closing, you cannot perform read/write operations on the database.
   */
  async close(): Promise<void> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    this.closing = true
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      await new Promise<void>((resolve) => {
        this.throttling
          .execute('database-close', () => this.db.close())
          .then(resolve)
      })
    }).finally(() => this.locker.writeUnlock(lockId))
  }
}
