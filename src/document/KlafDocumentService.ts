import { type SerializeStrategyHead } from 'serializable-bptree'
import { CacheEntanglementAsync } from 'cache-entanglement'
import { Ryoiki } from 'ryoiki'
import { KlafFormat, type KlafMetadata, KlafPageType, KlafService } from '../core/KlafService'
import { KlafComparator } from './KlafComparator'
import { KlafStrategy, type QueueNode } from './KlafStrategy'
import { ObjectHelper } from '../utils/ObjectHelper'
import { type DataEngine } from '../engine/DataEngine'
import { type VirtualDataEngine } from '../engine/VirtualDataEngine'
import { type DataJournal, type DataJournalContainer } from '../engine/DataJournal'
import { type KlafDocumentCreateOption } from './KlafDocument'
import { KlafRepositorySynchronizer } from './KlafRepositorySynchronizer'
import { KlafDocumentBTree } from './KlafDocumentBTree'
import { Catcher } from '../utils/Catcher'
import { TextConverter } from '../utils/TextConverter'

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
   * Includes if any of these values match the document's property value.
   */
  or?: T[K][]
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
  /**
   * Default value when inserting a document.
   */
  default: () => T,
  /**
   * Validation function when inserting or updating a document.
   * If the validation fails, an error is thrown.
   */
  validate?: (v: SupportedType) => boolean
  /**
   * If set to `true`, it will be indexed.
   * This allows for faster search, but may slow down insertion and updating.
   * It is recommended to index only fields that are frequently used in queries and have unique values across documents to maximize performance and avoid unnecessary overhead.
   * The default value is `false`.
   */
  index?: boolean
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
      await engine._boot(path)
      return engine.exists(path)
    }

    async existsJournal(databasePath: string, journal: DataJournal): Promise<boolean> {
      const journalPath = journal.getJournalPath(databasePath)
      await journal.engine._boot(journalPath)
      return journal.engine.exists(journalPath)
    }

    normalizeOption(option: KlafDocumentCreateOption<S, T>): Omit<Required<KlafDocumentCreateOption<S, T>>, 'journal'>&{
      journal?: boolean
    } {
      const {
        path,
        engine,
        journal,
        version,
        scheme,
        overwrite = false,
        payloadSize = 4096,
        commitDebounce = 0,
        commitDebounceMaximumSkip = 10,
        cacheLifespan = '3m',
      } = option
      return {
        ...option,
        path,
        engine,
        journal,
        version,
        scheme,
        overwrite,
        payloadSize,
        commitDebounce,
        commitDebounceMaximumSkip,
        cacheLifespan,
      }
    }

    async create(option: KlafDocumentCreateOption<S, T>): Promise<KlafDocumentCreateOption<S, T>&{ core?: KlafService }> {
      const normalizedOption = this.normalizeOption(option)
      const bootloader = new KlafService.Bootloader()

      const loaderOpenParameter = await bootloader.create(normalizedOption)
      const serviceParameter = await bootloader.open(loaderOpenParameter)
      const core = new KlafService(serviceParameter)

      await core.addEmptyPage({ type: KlafPageType.InternalType }, true)
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
      await core.engine.commit()

      return {
        ...normalizedOption,
        core,
      }
    }

    async open(option: KlafDocumentCreateOption<S, T>&{ core?: KlafService }): Promise<KlafDocumentServiceConstructorArguments<S>> {
      option = { ...option }
      const { path, engine } = option

      // Non-existing database. Need to create database first.
      await engine._boot(path)
      const existing = await engine.exists(path)
      if (!existing) {
        if (!option.payloadSize) {
          throw KlafDocumentService.ErrorBuilder.ERR_DB_NO_EXISTS(path)
        }
        option = await this.create(option)
      }

      // When database opened with KlafDocument.Open
      if (!option.core) {
        const bootloader = new KlafService.Bootloader()
        const serviceParameter = await bootloader.open(option)
        const core = new KlafService(serviceParameter)
        option.core = core
      }

      const normalizedOption = this.normalizeOption(option)
      const core = (normalizedOption as typeof option).core!
      const {
        scheme,
        version,
      } = normalizedOption
      
      const records = await core.getRecords(1)
      const record  = records[0]
      const rootId  = record.header.id
      const payload = this.parsePayload(record.payload)

      const isValid = this.isValidDatabase(payload)
      if (!isValid) {
        await core.close()
        throw KlafDocumentService.ErrorBuilder.ERR_DB_INVALID(path)
      }

      const root = payload as KlafDocumentRoot
      const {
        order,
        metadata,
        schemeVersion,
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
  readonly schemeVersion: number
  private _createdTrees: boolean
  private _closing: boolean
  private readonly _trees: Map<keyof KlafDocumentScheme<KlafDocumentShape<S>>, KlafDocumentBTree<string, SupportedType>>
  private readonly _record: ReturnType<KlafDocumentService<S>['_createRecordCache']>
  private readonly _document: ReturnType<KlafDocumentService<S>['_createDocumentCache']>
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
      deleteFn: async (id) => {
        await this.core.delete(id)
      },
      updateFn: async (id, node) => {
        await this.core.update(id, JSON.stringify(node))
      },
    })
    this.locker             = new Ryoiki()
    this.schemeVersion      = schemeVersion
    this.scheme             = scheme
    this._createdTrees      = false
    this._closing           = false
    this._root              = root
    this._trees             = new Map()
    this._treeTempNodes     = new Map()
    this._record            = this._createRecordCache()
    this._document          = this._createDocumentCache()

    const { autoIncrement, count } = metadata
    this._metadata = {
      autoIncrement,
      count,
    }
  }

  get documentProperties(): Set<keyof KlafDocumentScheme<KlafDocumentShape<S>>> {
    const defaultProperties: (keyof KlafDocumentBase)[] = [
      'documentIndex',
      'createdAt',
      'updatedAt',
    ]
    const indexProperties = Object.keys(this.scheme) as (keyof KlafDocumentScheme<S>)[]
    return new Set([
      ...indexProperties,
      ...defaultProperties,
    ])
  }

  get documentIndices(): Set<keyof KlafDocumentScheme<KlafDocumentShape<S>>> {
    const documentProperties = this.documentProperties
    for (const property of documentProperties) {
      // allow default property
      if (!Object.hasOwn(this.scheme, property)) {
        continue
      }
      if (!this.scheme[property].index) {
        documentProperties.delete(property)
      }
    }
    return documentProperties
  }

  async createBTrees(): Promise<void> {
    if (this._createdTrees) {
      return
    }
    this._createdTrees = true
    const schemeProperties = this.documentIndices
    for (const property of schemeProperties) {
      const tree = new KlafDocumentBTree<string, SupportedType>(
        new KlafStrategy({
          property: property as string,
          order: this.order,
          service: this.core,
          synchronizer: this.synchronizer,
          rootId: this.rootId,
          root: this._root,
          tempNodes: this._treeTempNodes,
        }),
        this.comparator,
        {
          lifespan: this.core.cacheLifespan
        }
      )
      await tree.init()
      this._trees.set(property, tree)
    }
  }

  clearBTrees(): void {
    this._createdTrees = false
    for (const tree of this._trees.values()) {
      tree.clear()
    }
    this._trees.clear()
  }

  async alterScheme(schemeVersion: number): Promise<boolean> {
    if (this._root.schemeVersion < schemeVersion) {
      console.log('Klaf.js: Normalizing scheme...')
      this._root.schemeVersion = schemeVersion
      const allRecordIds = await this.findAllRecordIds()
      const max = allRecordIds.size
      const step = 5
      let current = 0
      let last = 0
      await this.updateRoot(this._root)
      await this.internalUpdate(
        {},
        (document) => {
          current++
          const progress = current / max * 100
          if (progress > last + step) {
            console.log(`Klaf.js: Normalizing process... ${progress.toFixed(2)}% done.`)
            last += step
          }
          return this.normalizeRecord(document as any)
        },
        (document) => ({
          documentIndex: document.documentIndex,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        }) as any
      )
      console.log('Klaf.js: Scheme normalized.')
      return true
    }
    return false
  }

  private _createRecordCache() {
    return new CacheEntanglementAsync(async (key, state) => {
      const payload = await this.core.pickPayload(key)
      return payload
    }, {
      lifespan: this.core.cacheLifespan
    })
  }

  private _createDocumentCache() {
    return new CacheEntanglementAsync(async (key, state) => {
      const payload = state.record.raw
      const record = JSON.parse(TextConverter.FromArray(payload)) as KlafDocumentShape<S>
      return record
    }, {
      lifespan: this.core.cacheLifespan,
      dependencies: {
        record: this._record
      },
      beforeUpdateHook: async (key) => {
        await this._record.cache(key)
      }
    })
  }

  protected getBTree(property: keyof KlafDocumentShape<S>): KlafDocumentBTree<string, SupportedType>|null {
    return this._trees.get(property) ?? null
  }

  protected hasBTree(property: keyof KlafDocumentShape<S>): boolean {
    return this._trees.has(property)
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
    > = {
      ...def,
      ...option,
    }
    return merged
  }

  normalizeQuery(
    query: KlafDocumentQuery<KlafDocumentShape<S>>
  ): KlafDocumentQuery<KlafDocumentShape<S>> {
    const clone = { ...query }
    for (const property in clone) {
      const condition = clone[property]
      if (typeof condition !== 'object' || condition === null) {
        (clone as any)[property] = {
          equal: condition
        }
      }
    }
    return clone
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

  get engine(): VirtualDataEngine {
    return this.core.engine
  }

  async readLock<T>(work: () => Promise<T>): Promise<T> {
    let lockId: string
    return this.locker.readLock((_lockId) => {
      lockId = _lockId
      return work()
    }).finally(() => this.locker.readUnlock(lockId))
  }

  async writeLock<T>(work: () => Promise<T>): Promise<T> {
    let lockId: string
    return this.locker.writeLock((_lockId) => {
      lockId = _lockId
      return work()
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async transaction<T>(work: () => Promise<T>, lockType: 'read'|'write'): Promise<T> {
    const [err, res] = await Catcher.CatchError(this.core.transaction(work, lockType))
    if (err) {
      throw err
    }
    return res
  }

  async internalPut(
    document: Partial<S>,
    overwrite: Partial<S>
  ): Promise<KlafDocumentShape<S>> {
    const record = {
      ...this.normalizeRecord(document),
      ...overwrite,
    } as KlafDocumentShape<S>
    const stringify = JSON.stringify(record)
    const documentId = await this.core.put(stringify)
    for (const [property, tree] of this._trees) {
      if (!Object.hasOwn(record, property)) {
        continue
      }
      const value = record[property]
      await tree.insert(documentId, value)
    }
    await this._record.update(documentId)
    this._metadata.autoIncrement++
    this._metadata.count++
    return { ...record }
  }

  async put(document: Partial<S>): Promise<KlafDocumentShape<S>> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.writeLock(async () => {
      const now = Date.now()
      const overwrite = {
        documentIndex: Number(this._metadata.autoIncrement)+1,
        createdAt: now,
        updatedAt: now,
      } as KlafDocumentShape<S>
      const result = await this.internalPut(document, overwrite)
      await this.synchronizer.sync()
      return result
    })
  }

  async batch(documents: Partial<S>[]): Promise<KlafDocumentShape<S>[]> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.writeLock(async () => {
      const now = Date.now()
      const results: KlafDocumentShape<S>[] = []
      for (let i = 0, len = documents.length; i < len; i++) {
        const document = documents[i]
        const overwrite = {
          documentIndex: Number(this._metadata.autoIncrement)+1,
          createdAt: now,
          updatedAt: now,
        } as KlafDocumentShape<S>
        const result = await this.internalPut(document, overwrite)
        results.push(result)
      }
      await this.synchronizer.sync()
      return results
    })
  }

  async delete(query: KlafDocumentQuery<KlafDocumentShape<S>>): Promise<number> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.writeLock(async () => {
      const ids = await this.findRecordIds(query)
      for (let i = 0, len = ids.length; i < len; i++) {
        const id = ids[i]
        const cache = await this._document.cache(id)
        const document = cache.raw
        for (const property in document) {
          const tree = this.getBTree(property)
          if (!tree) {
            continue
          }
          const value = document[property]
          await tree.delete(id, value)
        }
        await this.core.delete(id)
        this._record.delete(id)
        this._document.delete(id)
      }
      this._metadata.count -= ids.length
      await this.synchronizer.sync()
      return ids.length
    })
  }

  async internalUpdate(
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
      const beforeDocument = await this._document.cache(id)
      const before = beforeDocument.raw
      const normalizedBefore = {
        ...this.normalizeRecord(before),
        documentIndex: before.documentIndex,
        createdAt: before.createdAt,
        updatedAt: before.updatedAt,
      } as KlafDocumentShape<S>
      const partial = typeof update === 'function' ? update(before) : update
      const overwrite = createOverwrite(before)
      const after = {
        ...normalizedBefore,
        ...partial,
        ...overwrite,
      } as unknown as KlafDocumentShape<S>
      for (const property in before) {
        const tree = this.getBTree(property)
        if (!tree) {
          continue
        }
        const value = before[property]
        await tree.delete(id, value)
      }
      for (const property in after) {
        const tree = this.getBTree(property)
        if (!tree) {
          continue
        }
        const value = after[property]
        await tree.insert(id, value)
      }
      const stringify = JSON.stringify(after)
      await this.core.update(id, stringify)
      await this._record.update(id)
    }
    await this.synchronizer.sync()
    return ids.length
  }

  async internalPutOrUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    document: Partial<S>
  ): Promise<KlafDocumentShape<S>|number> {
    const ids = await this.findRecordIds(query)
    if (!ids.length) {
      const now = Date.now()
      const overwrite = {
        documentIndex: Number(this._metadata.autoIncrement)+1,
        createdAt: now,
        updatedAt: now,
      } as KlafDocumentShape<S>
      return this.internalPut(document, overwrite)
    }
    return this.internalUpdate(query, document, () => ({
      updatedAt: Date.now()
    }) as any)
  }

  async putOrUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    document: Partial<S>
  ): Promise<KlafDocumentShape<S>|number> {
    return this.writeLock(async () => {
      const result = await this.internalPutOrUpdate(query, document)
      await this.synchronizer.sync()
      return result
    })
  }

  async partialUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    update: Partial<S>|((record: KlafDocumentShape<S>) => Partial<S>)
  ): Promise<number> {
    return this.writeLock(() => this.internalUpdate(query, update, () => ({
      updatedAt: Date.now()
    }) as any))
  }

  async fullUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    update: S|((record: KlafDocumentShape<S>) => S)
  ): Promise<number> {
    return this.writeLock(() => this.internalUpdate(query, update, () => ({
      updatedAt: Date.now()
    }) as any))
  }

  protected async findAllRecordIds(): Promise<Set<string>> {
    const primaryTree = this.getBTree('documentIndex')!
    const allRecordIds = await primaryTree.allRecordIds()
    return allRecordIds
  }

  private _findFromRaw(uint8arr: Uint8Array, key: string) {
    const len = uint8arr.length
    let i = 0
    if (uint8arr[i] !== 123) return undefined // '{'
    i++

    while (i < len) {
      while (uint8arr[i] === 32 || uint8arr[i] === 10 || uint8arr[i] === 44) i++ // space, newline, comma

      if (uint8arr[i] !== 34) break // '"'
      const keyStart = i + 1
      let keyEnd = keyStart
      while (keyEnd < len && uint8arr[keyEnd] !== 34) keyEnd++
      const currentKey = uint8arr.subarray(keyStart, keyEnd)
      i = keyEnd + 1

      while (uint8arr[i] === 32 || uint8arr[i] === 10) i++
      if (uint8arr[i] !== 58) break // ':'
      i++
      while (uint8arr[i] === 32 || uint8arr[i] === 10) i++

      const valueStart = i
      let valueEnd = i
      let valueRaw = null

      if (uint8arr[i] === 34) { // '"'
        i++
        while (i < len) {
          if (uint8arr[i] === 92) { // '\'
            i += 2
          } else if (uint8arr[i] === 34) {
            i++
            valueEnd = i
            break
          } else {
            i++
          }
        }
        valueRaw = TextConverter.FromArray(
          uint8arr.subarray(valueStart+1, valueEnd-1)
        )
      } else if (uint8arr[i] === 123 || uint8arr[i] === 91) { // '{' or '['
        const open = uint8arr[i]
        const close = open === 123 ? 125 : 93 // '}' or ']'
        let depth = 1
        i++
        while (i < len && depth > 0) {
          if (uint8arr[i] === open) depth++
          else if (uint8arr[i] === close) depth--
          else if (uint8arr[i] === 34) {
            i++
            while (i < len && uint8arr[i] !== 34) {
              if (uint8arr[i] === 92) i++
              i++
            }
          }
          i++
        }
        valueEnd = i
        valueRaw = TextConverter.FromArray(uint8arr.subarray(valueStart, valueEnd))
        valueRaw = JSON.parse(valueRaw)
      } else if (uint8arr[i] === 116) { // true
        i += 4
        valueRaw = true
      } else if (uint8arr[i] === 102) { // false
        i += 5
        valueRaw = false
      } else if (uint8arr[i] === 110) { // null
        i += 4
        valueRaw = null
      } else {
        const numStart = i
        while (i < len && /[0-9eE+\-.]/.test(String.fromCharCode(uint8arr[i]))) i++
        const numStr = TextConverter.FromArray(uint8arr.subarray(numStart, i))
        valueRaw = Number(numStr)
      }

      if (TextConverter.FromArray(currentKey) === key) {
        return valueRaw
      }

      while (i < len && uint8arr[i] !== 44) i++ // ','
      if (uint8arr[i] === 44) i++
    }

    return undefined
  }

  protected async fullScanRecordsInfo(
    property: keyof KlafDocumentShape<S>,
    condition: KlafDocumentQueryCondition<S>,
    filterKeys: Set<string>|undefined
  ): Promise<Set<string>> {
    if (!filterKeys) {
      filterKeys = await this.findAllRecordIds()
    }
    const primaryTree = this.getBTree('documentIndex')!
    for (const key of filterKeys) {
      const record = await this._record.cache(key)
      const jsonString = record.raw
      const insertedValue = this._findFromRaw(jsonString, property as any)
      for (const verifierKey in condition) {
        const sign = verifierKey as keyof KlafDocumentQueryCondition<S>
        const verify = primaryTree.getVerifier(sign)
        const guessValue = condition[sign]!
        if (!verify) {
          continue
        }
        const matched = verify(insertedValue, guessValue)
        if (!matched) {
          filterKeys.delete(key)
          break
        }
      }
    }
    return filterKeys
  }
  
  protected async findRecordIds(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    order: keyof KlafDocumentShape<S>&string = 'documentIndex',
    desc = false
  ): Promise<string[]> {
    const normalizedQuery = this.normalizeQuery(query)

    let filterKeys: Set<string>|undefined = undefined
    // search from b-tree firstly
    for (const property in normalizedQuery) {
      const tree = this.getBTree(property)
      if (!tree) {
        continue
      }
      const condition = normalizedQuery[property]! as KlafDocumentQueryCondition<S>
      filterKeys = await tree.keys(condition, filterKeys)
      delete normalizedQuery[property]
    }

    // search from fullScan fallback
    for (const property in normalizedQuery) {
      const condition = normalizedQuery[property]! as KlafDocumentQueryCondition<S>
      filterKeys = await this.fullScanRecordsInfo(property, condition, filterKeys)
    }

    // is select all query
    if (!filterKeys) {
      filterKeys = await this.findAllRecordIds()
    }

    const documents = []
    for (const key of filterKeys) {
      const cache = await this._document.cache(key)
      const document = cache.raw
      documents.push({ key, document })
    }

    documents.sort((a, b) => {
      const v1 = a.document[order] as PrimitiveType
      const v2 = b.document[order] as PrimitiveType
      return this.comparator.asc(v1, v2)
    })

    const keys = documents.map((document) => document.key)
    if (desc) {
      keys.reverse()
    }
    return keys
  }

  async pick(
    query: KlafDocumentQuery<KlafDocumentShape<S>>,
    option: KlafDocumentOption<KlafDocumentShape<S>> = {}
  ): Promise<KlafDocumentShape<S>[]> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.readLock(async () => {
      const { start, end, order, desc } = this._normalizeOption(option)
      const documents = []
      const ids = await this.findRecordIds(query, order, desc)
      const guessIds = ids.slice(start, end)
      const copy = (r: KlafDocumentShape<S>) => JSON.parse(JSON.stringify(r))
      for (let i = 0, len = guessIds.length; i < len; i++) {
        const id = guessIds[i]
        const record = await this._document.cache(id)
        const document = record.clone(copy)
        documents.push(document)
      }
      return documents
    })
  }

  async count(query: KlafDocumentQuery<KlafDocumentShape<S>>): Promise<number> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.readLock(async () => {
      const ids = await this.findRecordIds(query)
      return ids.length
    })
  }

  async close(): Promise<void> {
    if (this.closing) {
      throw KlafDocumentService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    this._closing = true
    return this.writeLock(async () => {
      await this.synchronizer.sync()
      await this.core.close()
      this.clearBTrees()
      this._record.clear()
      this._document.clear()
    })
  }
}
