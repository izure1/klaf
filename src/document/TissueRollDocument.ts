import fs from 'node:fs'

import { BPTree, SerializeStrategyHead } from 'serializable-bptree'

import { TissueRoll } from '../core/TissueRoll'
import { TissueRollMediator } from '../core/TissueRollMediator'
import { TissueRollComparator } from './TissueRollComparator'
import { TissueRollStrategy } from './TissueRollStrategy'
import { ErrorBuilder } from './ErrorBuilder'
import { ObjectHelper } from '../utils/ObjectHelper'
import { IterableSet } from '../utils/IterableSet'
import { CacheStore } from '../utils/CacheStore'
import { TextConverter } from '../utils/TextConverter'
import { DelayedExecution } from '../utils/DelayedExecution'

export type PrimitiveType = string|number|boolean|null
export type SupportedType = PrimitiveType|SupportedType[]|{ [key: string]: SupportedType }

export interface TissueRollDocumentRoot {
  verify: 'TissueRollDocument'
  head: Record<string, SerializeStrategyHead|null>
}

type TissueRollDocumentQueryCondition<T, K extends keyof T = keyof T> = {
  /**
   * Includes if this value matches the document's property value.
   */
  equal: T[K]
}|{
  /**
   * Includes if this value does not match the document's property value.
   */
  notEqual: T[K]
}|{
  /** 
   * Includes if this value is greater than the document's property value.
   */
  gt?: T[K]
  /**
   * Includes if this value is less than the document's property value.
   */
  lt?: T[K]
}

type TissueRollDocumentQuery<T extends Record<string, SupportedType>> = {
  /**
   * The property of the document to be searched.
   */
  [K in keyof T]?: T[K]|TissueRollDocumentQueryCondition<T, K>
}

type TissueRollDocumentRecord<T extends Record<string, SupportedType>> = T&{
  /**
   * The timestamp when the document was created. This value is automatically added when inserted into the database.
   */
  createdAt: number
  /**
   * The timestamp when the document was last updated. This value is automatically updated when the document is modified in the database.
   */
  updatedAt: number
}

type TissueRollDocumentOption<T extends Record<string, SupportedType>> = {
  /**
   * Used when retrieving a portion of the searched documents. Specifies the starting offset, with a default value of `0`.
   */
  start?: number
  /**
   * Used when retrieving a portion of the searched documents. Specifies the ending offset, with a default value of `Number.MAX_SAFE_INTEGER`.
   */
  end?: number
  /**
   * The property used for sorting the retrieved documents. Results are sorted based on this value, with the default being `createdAt`.
   */
  order?: keyof T
  /**
   * The property used for sorting the retrieved documents. If set to `true`, it sorts in descending order. The default value is `false`.
   */
  desc?: boolean
}

export class TissueRollDocument<T extends Record<string, SupportedType>> {
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

  /**
   * It creates a new database file.
   * @param file This is the path where the database file will be created.
   * @param payloadSize This is the maximum data size a single page in the database can hold. The default is `8192`. If this value is too large or too small, it can affect performance.
   * @param overwrite This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  static Create<T extends Record<string, SupportedType>>(file: string, payloadSize = 8192, overwrite = false): TissueRollDocument<T> {
    const db = TissueRoll.Create(file, payloadSize, overwrite)

    const docRoot: TissueRollDocumentRoot = {
      verify: TissueRollDocument.DB_NAME,
      head: {},
    }
    const reserved = '\x00'.repeat(db.root.payloadSize)
    const rootId = TissueRollMediator.Put(
      db,
      TextConverter.ToArray(reserved),
      false
    )
    const stringify = JSON.stringify(docRoot)
    db.update(rootId, stringify)

    return new TissueRollDocument(db, rootId, docRoot, 0)
  }

  /**
   * It opens or creates a database file at the specified path. 
   * If `payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `8192`.
   * @param file This is the path where the database file is located.
   * @param payloadSize If this value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `8192`.
   */
  static Open<T extends Record<string, SupportedType>>(file: string, payloadSize = 8192): TissueRollDocument<T> {
    // 파일이 존재하지 않을 경우
    if (!fs.existsSync(file)) {
      if (!payloadSize) {
        throw ErrorBuilder.ERR_DB_NO_EXISTS(file)
      }
      // 옵션이 지정되었을 경우 새롭게 생성합니다
      return TissueRollDocument.Create(file, payloadSize)
    }

    const db = TissueRoll.Open(file, payloadSize)
    const record = db.getRecords(1).pop()!
    const docRoot = TissueRollDocument.Verify(file, record.payload)

    return new TissueRollDocument(db, record.header.id, docRoot, 0)
  }

  protected readonly db: TissueRoll
  protected readonly rootId: string
  protected readonly order: number
  protected readonly comparator: TissueRollComparator
  protected readonly locker: DelayedExecution
  protected lock: boolean
  private readonly _root: TissueRollDocumentRoot
  private readonly _trees: CacheStore<BPTree<string, SupportedType>>
  private _metadata: {
    autoIncrement: bigint
    count: number
  }

  protected constructor(db: TissueRoll, rootId: string, root: TissueRollDocumentRoot, writeBack: number) {
    this.db = db
    this.rootId = rootId
    this.order = Math.max(Math.ceil(db.root.payloadSize/50), 4)
    this.comparator = new TissueRollComparator()
    this.locker = new DelayedExecution(writeBack)
    this.lock = false
    this._root = root
    this._trees = new CacheStore()

    const { autoIncrement, count } = db.root
    this._metadata = {
      autoIncrement,
      count,
    }
  }

  protected getTree(property: string): BPTree<string, SupportedType> {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    return this._trees.get(property, () => {
      return new BPTree<string, SupportedType>(
        new TissueRollStrategy(this.order, property, this.db, this.locker, this.rootId, this._root),
        this.comparator
      )
    })
  }

  private _normalizeOption(
    option: Partial<TissueRollDocumentOption<TissueRollDocumentRecord<T>>>
  ): Required<TissueRollDocumentOption<TissueRollDocumentRecord<T>>> {
    const def: Required<TissueRollDocumentOption<T>> = {
      start: 0,
      end: Number.MAX_SAFE_INTEGER,
      order: 'createdAt',
      desc: false
    }
    const merged: Required<TissueRollDocumentOption<T>> = Object.assign({}, def, option)
    return merged
  }

  private _normalizeFlatQuery<U extends T>(query: TissueRollDocumentQuery<U>): TissueRollDocumentQuery<U> {
    query = Object.assign({}, query)
    for (const property in query) {
      const condition = query[property]
      if (typeof condition !== 'object' || condition === null) {
        query[property] = {
          equal: condition
        } as any
      }
    }
    return query
  }

  private _normalizeQuery<U extends T>(query: TissueRollDocumentQuery<U>): TissueRollDocumentQuery<U> {
    return Object.assign({}, {
      createdAt: {
        gt: 0
      }
    }, this._normalizeFlatQuery(query))
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
    return {
      autoIncrement,
      count,
    }
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
  put(document: T): TissueRollDocumentRecord<T> {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    const now = Date.now()
    const record = Object.assign({}, document, {
      createdAt: now,
      updatedAt: now,
    })
    const stringify = JSON.stringify(record)
    const recordId = this.db.put(stringify)
    for (const property in record) {
      const tree = this.getTree(property)
      const value = record[property]
      tree.insert(recordId, value)
    }
    this._metadata.autoIncrement++
    this._metadata.count++
    return record
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
      const record = JSON.parse(payload) as TissueRollDocumentRecord<T>
      for (const property in record) {
        const tree = this.getTree(property)
        const value = record[property]
        tree.delete(id, value)
      }
      this.db.delete(id)
    }
    this._metadata.count -= ids.length
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
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    const ids = this.findRecordIds(query)
    for (const id of ids) {
      const payload = this.db.pick(id).record.payload
      const record = JSON.parse(payload)
      const updater = typeof update === 'function' ? update(record) : update
      for (const property in updater) {
        const tree = this.getTree(property)
        if (ObjectHelper.HasProperty(record, property)) {
          const before = record[property]
          tree.delete(id, before)
        }
        const after = updater[property] as T[keyof T]
        tree.insert(id, after)
        record[property] = after
      }
      record.updatedAt = Date.now()
      const stringify = JSON.stringify(record)
      this.db.update(id, stringify)
    }
    return ids.length
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
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    const ids = this.findRecordIds(query)
    for (const id of ids) {
      const payload = this.db.pick(id).record.payload
      const beforeRecord = JSON.parse(payload) as TissueRollDocumentRecord<T>
      let recordUpdate = update
      if (typeof recordUpdate === 'function') {
        recordUpdate = recordUpdate(beforeRecord)
      }
      for (const property in beforeRecord) {
        const tree = this.getTree(property)
        const before = beforeRecord[property]
        tree.delete(id, before)
      }
      const afterRecord: TissueRollDocumentRecord<T> = Object.assign({}, recordUpdate, {
        createdAt: beforeRecord.createdAt,
        updatedAt: Date.now()
      })
      for (const property in afterRecord) {
        const tree = this.getTree(property)
        const after = afterRecord[property]
        tree.insert(id, after)
      }
      const stringify = JSON.stringify(afterRecord)
      this.db.update(id, stringify)
    }
    return ids.length
  }
  
  protected findRecordIds(query: TissueRollDocumentQuery<TissueRollDocumentRecord<T>>): string[] {
    if (this.lock) {
      throw ErrorBuilder.ERR_DATABASE_LOCKED()
    }
    query = this._normalizeQuery(query)
    const found: Set<string>[] = []
    for (const property in query) {
      const tree = this.getTree(property)
      const keys = tree.keys(query[property]! as TissueRollDocumentQueryCondition<T>)
      found.push(keys)
    }
    return IterableSet.Intersections(found)
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
    const records = this.findRecordIds(query).map((id) => {
      const payload = this.db.pick(id).record.payload
      return JSON.parse(payload)
    })
    if (desc) {
      records.sort((a, b) => this.comparator.asc(b[order], a[order]))
    }
    else {
      records.sort((a, b) => this.comparator.asc(a[order], b[order]))
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
