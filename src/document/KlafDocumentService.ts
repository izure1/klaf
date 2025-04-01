import { BPTreeAsync, SerializeStrategyHead, StringComparator } from 'serializable-bptree'
import { CacheEntanglementAsync } from 'cache-entanglement'
import { Ryoiki } from 'ryoiki'
import { KlafFormat, KlafMetadata, KlafService } from '../core/KlafService'
import { KlafComparator } from './KlafComparator'
import { KlafStrategy, type QueueNode } from './KlafStrategy'
import { ObjectHelper } from '../utils/ObjectHelper'
import { Debounce } from '../utils/Debounce'
import { DataEngine } from '../engine/DataEngine'
import { AuthenticatedDataJournal, DataJournal, DataJournalContainer } from '../engine/DataJournal'
import { KlafDocument, KlafDocumentCreateOption } from './KlafDocument'
import { Klaf } from '../core'
import { KlafMediator } from '../core/KlafMediator'
import { KlafRepositorySynchronizer } from './KlafRepositorySynchronizer'

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

export interface KlafDocumentServiceConstructorArguments<S extends KlafDocumentable> {
  metadata: KlafMetadata
  core: KlafService
  root: KlafDocumentRoot
  rootId: string
  order: number
  scheme: KlafDocumentScheme<S>
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

export interface KlafDocumentable {
  [key: string]: SupportedType
}

export interface KlafDocumentBase {
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

export type KlafDocumentShape<
  T extends KlafDocumentable
> = T&KlafDocumentBase

export type KlafDocumentQuery<
  T extends KlafDocumentShape<any>
> = {
  /**
   * The property of the document to be searched.
   */
  [K in keyof T]?: T[K]|KlafDocumentQueryCondition<T, K>
}

export interface KlafDocumentOption<T extends KlafDocumentShape<KlafDocumentable>> {
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
  order?: keyof KlafDocumentShape<T>&string
  /**
   * The property used for sorting the retrieved documents. If set to `true`, it sorts in descending order. The default value is `false`.
   */
  desc?: boolean
}

export interface KlafDocumentField<T extends SupportedType> {
  default: () => T,
  validate?: (v: T) => boolean
}

export type KlafDocumentScheme<S extends KlafDocumentable> = {
  [K in keyof S]: KlafDocumentField<S[K]>
}

export type KlafDocumentSchemeType<S extends KlafDocumentable, T extends KlafDocumentScheme<S>> = {
  [K in keyof T]: ReturnType<T[K]['default']>
}

export class KlafDocumentService<S extends KlafDocumentable> implements DataJournalContainer {
  static readonly DB_NAME = 'TissueRollDocument'

  static readonly ErrorBuilder = class ErrorBuilder extends KlafService.ErrorBuilder {
    static ERR_INVALID_OBJECT(stringify: string) {
      return new Error(`The '${stringify}' string can't be parsed.`)
    }
  
    static ERR_DATABASE_CLOSING() {
      return new Error('The record cannot be changed because the database is closing.')
    }
  }

  static readonly Bootloader = class KlafDocumentServiceBootloader<S extends KlafDocumentable, T extends KlafDocumentScheme<S>> {
    createOption({
      version,
      core,
    }: {
      version: number
      core: KlafService
    }): {
      schemeVersion: number
      metadata: KlafMetadata
      order: number
    } {
      const schemeVersion = version
      const metadata = core.metadata
      const order = Math.max(KlafDocumentService.OrderN(metadata.payloadSize, 40), 4)

      return {
        schemeVersion,
        metadata,
        order,
      }
    }

    parsePayload(payload: string): object {
      return ObjectHelper.Parse(
        payload,
        KlafDocumentService.ErrorBuilder.ERR_INVALID_OBJECT(payload)
      )
    }

    isValidDatabase(object: object): boolean {
      // not object
      if (!ObjectHelper.IsObject(object)) {
        const text = JSON.stringify(object)
        throw KlafDocumentService.ErrorBuilder.ERR_INVALID_OBJECT(text)
      }
      // check verify
      return ObjectHelper.VerifyProperties(object, {
        verify: (v) => v === KlafDocumentService.DB_NAME,
        head: (v) => ObjectHelper.IsObject(v)
      })
    }

    async existsDatabase(path: string, engine: DataEngine): Promise<boolean> {
      await engine.boot(path)
      return engine.exists(path)
    }

    async existsJournal(databasePath: string, journal: DataJournal): Promise<boolean> {
      const journalPath = journal.getJournalPath(databasePath)
      await journal.engine.boot(journalPath)
      return journal.engine.exists(journalPath)
    }

    async create(option: KlafDocumentCreateOption<S, T>): Promise<KlafDocumentServiceConstructorArguments<S>> {
      const {
        path,
        engine,
        version,
        scheme,
        payloadSize = 1024,
        overwrite = false
      } = option
  
      const journal = AuthenticatedDataJournal.From(KlafDocument, option.journal)
      const db      = await Klaf.Create({ path, engine, journal, payloadSize, overwrite })
      const core    = KlafMediator.GetService(db)

      const root: KlafDocumentRoot = {
        verify: KlafDocumentService.DB_NAME,
        schemeVersion: 0,
        reassignments: [],
        head: {},
      }
      const rootId = await core.internalPut(
        core.createIterable(core.metadata.payloadSize, 0),
        false
      )
      await core.update(rootId, JSON.stringify(root))

      const {
        schemeVersion,
        metadata,
        order,
      } = this.createOption({ version, core })

      return {
        metadata,
        core,
        root,
        rootId,
        order,
        scheme,
        schemeVersion,
      }
    }

    async open(option: KlafDocumentCreateOption<S, T>): Promise<KlafDocumentServiceConstructorArguments<S>> {
      const {
        path,
        engine,
        version,
        scheme,
        payloadSize = 1024
      } = option
      
      let options: KlafDocumentServiceConstructorArguments<S>|undefined

      await engine.boot(path)
      const existing = await engine.exists(path)
      if (!existing) {
        if (!payloadSize) {
          throw KlafDocumentService.ErrorBuilder.ERR_DB_NO_EXISTS(path)
        }
        options = await this.create(option)
      }

      if (options) {
        return options
      }
  
      const journal = AuthenticatedDataJournal.From(KlafDocument, option.journal)
      const db      = await Klaf.Open({ path, engine, journal, payloadSize })
      const core    = KlafMediator.GetService(db)

      const records = await core.getRecords(1)
      const record  = records[0]
      const rootId  = record.header.id
      const payload = this.parsePayload(record.payload)

      const isValid = this.isValidDatabase(payload)
      if (!isValid) {
        await core.close(KlafDocument)
        throw KlafDocumentService.ErrorBuilder.ERR_DB_INVALID(path)
      }

      const root = payload as KlafDocumentRoot
      const {
        schemeVersion,
        metadata,
        order,
      } = this.createOption({ version, core })

      return {
        metadata,
        core,
        root,
        rootId,
        order,
        scheme,
        schemeVersion,
      }
    }
  }

  static OrderN(payloadSize: number, meanValueSize: number): number {
    const reserved = 150
    const keySize = 32
    let n = 0
    while (
      reserved +
      KlafFormat.PageHeaderSize +
      (
        KlafFormat.PageCellSize +
        KlafFormat.RecordHeaderSize +
        meanValueSize +
        keySize +
        3 // comma, quotation
      ) * n <= payloadSize
    ) {
      n++
    }
    return Math.ceil((n - 1) * 10)
  }
 
  readonly core: KlafService
  readonly journal?: DataJournal
  readonly rootId: string
  readonly order: number
  readonly comparator: KlafComparator
  readonly synchronizer: KlafRepositorySynchronizer<QueueNode>
  readonly scheme: KlafDocumentScheme<S>
  readonly locker: Ryoiki
  readonly debounce: Debounce
  readonly schemeVersion: number
  private _createdTrees: boolean
  private _closing: boolean
  private readonly _trees: Map<keyof KlafDocumentScheme<S>, BPTreeAsync<string, SupportedType>>
  private readonly _document: ReturnType<KlafDocumentService<S>['_createDocumentCache']>
  private readonly _treeDeleteQueue: Set<string>
  private readonly _treeUpdateQueue: Map<string, QueueNode>
  private readonly _treeTempNodes: Map<string, QueueNode>
  private _root: KlafDocumentRoot
  private _metadata: {
    autoIncrement: bigint
    count: number
  }

  constructor({
    metadata,
    core,
    root,
    rootId,
    order,
    scheme,
    schemeVersion,
  }: KlafDocumentServiceConstructorArguments<S>) {
    this.core               = core
    this.rootId             = rootId
    this.order              = order
    this.comparator         = new KlafComparator()
    this.synchronizer       = new KlafRepositorySynchronizer({
      deleteFn: (id) => this.core.delete(id),
      updateFn: async (id, node) => {
        await this.core.update(id, JSON.stringify(node))
      },
    })
    this.locker             = new Ryoiki()
    this.debounce           = new Debounce(10)
    this.schemeVersion      = schemeVersion
    this.scheme             = scheme
    this._createdTrees      = false
    this._closing           = false
    this._root              = root
    this._trees             = new Map()
    this._treeDeleteQueue   = new Set()
    this._treeUpdateQueue   = new Map()
    this._treeTempNodes     = new Map()
    this._document          = this._createDocumentCache()

    const { autoIncrement, count } = metadata
    this._metadata = {
      autoIncrement,
      count,
    }
  }

  async alterScheme(schemeVersion: number): Promise<void> {
    if (this._root.schemeVersion < schemeVersion) {
      this._root.schemeVersion = schemeVersion
      await this.updateRoot(this._root)
      await this.callInternalUpdate(
        {},
        (document) => this.normalizeRecord(document as any),
        (document) => ({
          documentIndex: document.documentIndex,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        }) as any
      )
    }
  }

  async createTrees(): Promise<void> {
    if (this._createdTrees) {
      return
    }
    this._createdTrees = true
    const defaultProperties: (keyof KlafDocumentBase)[] = [
      'documentIndex',
      'createdAt',
      'updatedAt',
    ]
    const schemeProperties = new Set<string>([
      ...Object.keys(this.scheme),
      ...defaultProperties,
    ])
    for (const property of schemeProperties) {
      const tree = new BPTreeAsync<string, SupportedType>(
        new KlafStrategy({
          property,
          order: this.order,
          service: this.core,
          synchronizer: this.synchronizer,
          rootId: this.rootId,
          root: this._root,
          updateQueue: this._treeUpdateQueue,
          deleteQueue: this._treeDeleteQueue,
          tempNodes: this._treeTempNodes,
        }),
        this.comparator
      )
      await tree.init()
      this._trees.set(property, tree)
    }
  }

  private _createDocumentCache() {
    return new CacheEntanglementAsync((
      _key,
      _state,
      document: KlafDocumentShape<S>
    ) => document)
  }

  protected getTree(property: string): BPTreeAsync<string, SupportedType>|null {
    return this._trees.get(property) ?? null
  }

  protected async updateRoot(root: KlafDocumentRoot): Promise<void> {
    this._root = root
    await this.core.update(this.rootId, JSON.stringify(root))
  }

  private _normalizeOption(
    option: Partial<KlafDocumentOption<KlafDocumentShape<S>>>
  ): Required<KlafDocumentOption<KlafDocumentShape<S>>> {
    const def: Required<KlafDocumentOption<KlafDocumentShape<S>>> = {
      start: 0,
      end: Number.MAX_SAFE_INTEGER,
      order: 'documentIndex',
      desc: false
    }
    const merged: Required<
      KlafDocumentOption<KlafDocumentShape<S>>
    > = Object.assign({}, def, option)
    return merged
  }

  normalizeFlatQuery(
    query: KlafDocumentQuery<KlafDocumentShape<S>>
  ): KlafDocumentQuery<KlafDocumentShape<S>> {
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

  normalizeQuery(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    properties: Set<keyof KlafDocumentShape<S>>,
  ): KlafDocumentQuery<KlafDocumentShape<S>> {
    const richQuery: KlafDocumentQuery<KlafDocumentShape<S>> = {}
    for (const property of properties) {
      richQuery[property] = { gt: undefined }
    }
    return Object.assign(richQuery, this.normalizeFlatQuery(query))
  }

  normalizeRecord(record: Partial<S>): S {
    const after: any = {}
    for (const field in this.scheme) {
      const { default: defaultValue, validate } = this.scheme[field]
      const v = Object.hasOwn(record, field) ? record[field]! : defaultValue()
      if (validate && !validate(v)) {
        throw new Error(`The value '${v}' did not pass the validation of field '${field}'.`)
      }
      after[field] = v
    }
    return after as S
  }

  get metadata(): KlafDocumentMetadata {
    const { autoIncrement, count } = this._metadata
    const { payloadSize, timestamp } = this.core.metadata
    const { schemeVersion } = this
    return {
      autoIncrement,
      count,
      payloadSize,
      timestamp,
      schemeVersion,
    }
  }

  get closing(): boolean {
    return this._closing
  }

  get engine(): DataEngine {
    return this.core.engine
  }

  async callInternalPut(
    document: Partial<S>,
    ...overwrite: Partial<S>[]
  ): Promise<KlafDocumentShape<S>> {
    const record = Object.assign(
      this.normalizeRecord(document),
      ...overwrite
    ) as KlafDocumentShape<S>
    const stringify = JSON.stringify(record)
    const documentId = await this.core.put(stringify)
    for (const property in record) {
      const tree = this.getTree(property)
      if (!tree) {
        continue
      }
      const value = record[property]
      await tree.insert(documentId, value)
    }
    await this._document.update(documentId, record)
    await this.synchronizer.sync()
    this._metadata.autoIncrement++
    this._metadata.count++
    return Object.assign({}, record)
  }

  async put(document: Partial<S>): Promise<KlafDocumentShape<S>> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const now = Date.now()
      const overwrite = {
        documentIndex: Number(this._metadata.autoIncrement)+1,
        createdAt: now,
        updatedAt: now,
      } as KlafDocumentShape<S>
      return this.callInternalPut(document, overwrite)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async delete(query: KlafDocumentQuery<KlafDocumentShape<S>>): Promise<number> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const ids = await this.findRecordIds(query)
      for (let i = 0, len = ids.length; i < len; i++) {
        const id = ids[i]
        const result = await this.core.pick(id)
        const payload = result.record.payload
        const document = JSON.parse(payload)
        for (const property in document) {
          const tree = this.getTree(property)
          if (!tree) {
            continue
          }
          const value = document[property]
          await tree.delete(id, value)
        }
        await this.core.delete(id)
        this._document.delete(id)
      }
      this._metadata.count -= ids.length
      await this.synchronizer.sync()
      return ids.length
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async callInternalUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    update: Partial<S|KlafDocumentShape<S>>|(
      (record: KlafDocumentShape<S>) => Partial<S>
    ),
    createOverwrite: (
      before: KlafDocumentShape<S>
    ) => Partial<KlafDocumentShape<S>>
  ): Promise<number> {
    const ids = await this.findRecordIds(query)
    for (let i = 0, len = ids.length; i < len; i++) {
      const id = ids[i]
      const result = await this.core.pick(id)
      const beforeDocument = await this._document.cache(
        id,
        JSON.parse(result.record.payload)
      )
      const before = beforeDocument.clone()
      const normalizedBefore = Object.assign(
        this.normalizeRecord(before),
        {
          documentIndex: before.documentIndex,
          createdAt: before.createdAt,
          updatedAt: before.updatedAt,
        }
      ) as KlafDocumentShape<S>
      const partial = typeof update === 'function' ? update(before) : update
      const overwrite = createOverwrite(before)
      const after = Object.assign(
        normalizedBefore,
        partial,
        overwrite
      ) as unknown as KlafDocumentShape<S>
      for (const property in before) {
        const tree = this.getTree(property)
        if (!tree) {
          continue
        }
        const value = before[property]
        await tree.delete(id, value)
      }
      for (const property in after) {
        const tree = this.getTree(property)
        if (!tree) {
          continue
        }
        const value = after[property]
        await tree.insert(id, value)
      }
      const stringify = JSON.stringify(after)
      await this.core.update(id, stringify)
      await this._document.update(id, after)
      await this.synchronizer.sync()
    }
    return ids.length
  }

  async partialUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    update: Partial<S>|((record: KlafDocumentShape<S>) => Partial<S>)
  ): Promise<number> {
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      return this.callInternalUpdate(query, update, () => ({
        updatedAt: Date.now()
      }) as any)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async fullUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    update: S|((record: KlafDocumentShape<S>) => S)
  ): Promise<number> {
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      return this.callInternalUpdate(query, update, () => ({
        updatedAt: Date.now()
      }) as any)
    }).finally(() => this.locker.writeUnlock(lockId))
  }
  
  protected async findRecordIds(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    order: keyof KlafDocumentShape<S>&string = 'documentIndex',
    desc = false
  ): Promise<string[]> {
    const mustHave: keyof KlafDocumentShape<S> = 'documentIndex'
    const properties = new Set<keyof KlafDocumentShape<S>>([order, mustHave])
    const normalizedQuery = this.normalizeQuery(query, properties)
    let filterKeys: Set<string>|undefined = undefined
    for (const property in normalizedQuery) {
      const tree = this.getTree(property)
      if (!tree) {
        continue
      }
      const condition = normalizedQuery[property]! as KlafDocumentQueryCondition<S>
      filterKeys = await tree.keys(condition, filterKeys)
    }
    const result = Array.from(filterKeys ?? [])
    if (desc) {
      result.reverse()
    }
    return result
  }

  async pick(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    option: KlafDocumentOption<KlafDocumentShape<S>> = {}
  ): Promise<KlafDocumentShape<S>[]> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.readLock(async (_lockId) => {
      lockId = _lockId
      const { start, end, order, desc } = this._normalizeOption(option)
      const documents = []
      const ids = await this.findRecordIds(query, order, desc)
      for (const id of ids) {
        const result = await this.core.pick(id)
        const record = await this._document.cache(
          id,
          JSON.parse(result.record.payload)
        )
        const document = record.clone()
        documents.push(document)
      }
      return documents.slice(start, end)
    }).finally(() => this.locker.readUnlock(lockId))
  }

  async count(query: KlafDocumentQuery<KlafDocumentShape<S>>): Promise<number> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.readLock(async (_lockId) => {
      lockId = _lockId
      const ids = await this.findRecordIds(query)
      return ids.length
    }).finally(() => this.locker.readUnlock(lockId))
  }

  async close(): Promise<void> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    this._closing = true
    let lockId: string
    await this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      await this.synchronizer.sync()
      await this.core.close(KlafDocument)
    }).finally(() => this.locker.writeUnlock(lockId))
  }
}
