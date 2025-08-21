import {
  type StringValue,
  CacheEntanglementAsync,
  CacheEntanglementSync
} from 'cache-entanglement'
import { Ryoiki } from 'ryoiki'
import { CryptoHelper } from '../utils/CryptoHelper'
import { IntegerConverter } from '../utils/IntegerConverter'
import { IterableView } from '../utils/IterableView'
import { TextConverter } from '../utils/TextConverter'
import { DataJournal, type DataJournalContainer } from '../engine/DataJournal'
import { DataEngine } from '../engine/DataEngine'
import { type KlafCreateOption } from './Klaf'
import { KlafTransactionManager } from './KlafTransactionManager'
import { VirtualDataEngine } from '../engine/VirtualDataEngine'
import { Catcher } from '../utils/Catcher'

export interface KlafMetadata {
  majorVersion: number
  minorVersion: number
  patchVersion: number
  payloadSize: number
  timestamp: bigint
  secretKey: bigint
  autoIncrement: bigint
  count: number
  index: number
  lastInternalIndex: number
}

export enum KlafFormat {
  DB_VERSION                        = '8.0.0',
  DB_NAME                           = 'TissueRoll',
  MetadataValidStringOffset         = 0,
  MetadataValidStringSize           = KlafFormat.DB_NAME.length,
  MetadataMajorVersionOffset        = KlafFormat.MetadataValidStringOffset + KlafFormat.MetadataValidStringSize,
  MetadataMajorVersionSize          = 1,
  MetadataMinorVersionOffset        = KlafFormat.MetadataMajorVersionOffset + KlafFormat.MetadataMajorVersionSize,
  MetadataMinorVersionSize          = 1,
  MetadataPatchVersionOffset        = KlafFormat.MetadataMinorVersionOffset + KlafFormat.MetadataMinorVersionSize,
  MetadataPatchVersionSize          = 1,
  MetadataIndexOffset               = KlafFormat.MetadataPatchVersionOffset + KlafFormat.MetadataPatchVersionSize,
  MetadataIndexSize                 = 4,
  MetadataPayloadSizeOffset         = KlafFormat.MetadataIndexOffset + KlafFormat.MetadataIndexSize,
  MetadataPayloadSizeSize           = 4,
  MetadataTimestampOffset           = KlafFormat.MetadataPayloadSizeOffset + KlafFormat.MetadataPayloadSizeSize,
  MetadataTimestampSize             = 8,
  MetadataSecretKeyOffset           = KlafFormat.MetadataTimestampOffset + KlafFormat.MetadataTimestampSize,
  MetadataSecretKeySize             = 16,
  MetadataAutoIncrementOffset       = KlafFormat.MetadataSecretKeyOffset + KlafFormat.MetadataSecretKeySize,
  MetadataAutoIncrementSize         = 8,
  MetadataCountOffset               = KlafFormat.MetadataAutoIncrementOffset + KlafFormat.MetadataAutoIncrementSize,
  MetadataCountSize                 = 4,
  MetadataLastInternalIndexOffset   = KlafFormat.MetadataCountOffset + KlafFormat.MetadataCountSize,
  MetadataLastInternalIndexSize     = 4,

  MetadataSize                      = 200,
  PageHeaderSize                    = 100,
  PageCellSize                      = 4,

  PageTypeOffset                    = 0,
  PageTypeSize                      = 4,
  PageIndexOffset                   = KlafFormat.PageTypeOffset + KlafFormat.PageTypeSize,
  PageIndexSize                     = 4,
  PageNextOffset                    = KlafFormat.PageIndexOffset + KlafFormat.PageIndexSize,
  PageNextSize                      = 4,
  PageCountOffset                   = KlafFormat.PageNextOffset + KlafFormat.PageNextSize,
  PageCountSize                     = 4,
  PageFreeOffset                    = KlafFormat.PageCountOffset + KlafFormat.PageCountSize,
  PageFreeSize                      = 4,

  RecordHeaderSize                  = 40,
  RecordHeaderIndexOffset           = 0,
  RecordHeaderIndexSize             = 4,
  RecordHeaderOrderOffset           = KlafFormat.RecordHeaderIndexOffset + KlafFormat.RecordHeaderIndexSize,
  RecordHeaderOrderSize             = 4,
  RecordHeaderLengthOffset          = KlafFormat.RecordHeaderOrderOffset + KlafFormat.RecordHeaderOrderSize,
  RecordHeaderLengthSize            = 4,
  RecordHeaderMaxLengthOffset       = KlafFormat.RecordHeaderLengthOffset + KlafFormat.RecordHeaderLengthSize,
  RecordHeaderMaxLengthSize         = 4,
  RecordHeaderDeletedOffset         = KlafFormat.RecordHeaderMaxLengthOffset + KlafFormat.RecordHeaderMaxLengthSize,
  RecordHeaderDeletedSize           = 1,
  RecordHeaderAliasIndexOffset      = KlafFormat.RecordHeaderDeletedOffset + KlafFormat.RecordHeaderDeletedSize,
  RecordHeaderAliasIndexSize        = 4,
  RecordHeaderAliasOrderOffset      = KlafFormat.RecordHeaderAliasIndexOffset + KlafFormat.RecordHeaderAliasIndexSize,
  RecordHeaderAliasOrderSize        = 4,
}

export interface KlafServiceConstructorArguments {
  path: string
  secretKey: Uint8Array
  metadata: KlafMetadata
  engine: DataEngine
  journal?: DataJournal
  commitDebounce: number
  commitDebounceMaximumSkip: number
  cacheLifespan: StringValue|number
}

export enum KlafPageType {
  UnknownType                       = 0,
  InternalType                      = 1,
  OverflowType                      = 2,
  SystemReservedType                = 3,
}

export interface KlafPageHeader {
  type: KlafPageType
  index: number
  next: number
  count: number
  free: number
}

export interface KlafRecord {
  header: {
    id: string
    aliasId: string
    index: number
    order: number
    aliasIndex: number
    aliasOrder: number
    length: number
    maxLength: number
    deleted: number
  }
  payload: string
  rawRecord: Uint8Array
  rawHeader: Uint8Array
  rawPayload: Uint8Array
}

export interface KlafPickResult {
  page: KlafPageHeader
  record: KlafRecord
  order: number
}

export class KlafService implements DataJournalContainer {
  static readonly ErrorBuilder = class ErrorBuilder {
    static ERR_DB_ALREADY_EXISTS(file: string) {
      return new Error(`The path '${file}' database file is already existing. If you want overwrite, pass a 'overwrite' parameter with 'true'.`)
    }
    
    static ERR_DB_INVALID(file: string) {
      return new Error(`The path '${file}' database file seems to be invalid. Maybe broken or incorrect format.`)
    }
  
    static ERR_DB_NO_EXISTS(file: string) {
      return new Error(`The database file not exists in '${file}'.`)
    }
  
    static ERR_ALREADY_DELETED(recordId: string) {
      return new Error(`The record '${recordId}' is already deleted.`)
    }
  
    static ERR_INVALID_RECORD(recordId: string) {
      return new Error(`The record '${recordId}' is invalid. Maybe incorrect id.`)
    }
  
    static ERR_UNSUPPORTED_ENGINE() {
      return new Error(`This feature is not supported by the current database engine.`)
    }
  
    static ERR_DATABASE_CLOSING() {
      return new Error('The record cannot be changed because the database is closing.')
    }
  }

  static readonly Bootloader = class KlafServiceBootloader {
    async isValidDatabase(engine: DataEngine): Promise<boolean> {
      const chunk = await engine.read(
        KlafFormat.MetadataValidStringOffset,
        KlafFormat.MetadataValidStringSize
      )
      const text = TextConverter.FromArray(chunk)
      return text === KlafFormat.DB_NAME
    }

    async existsDatabase(path: string, engine: DataEngine): Promise<boolean> {
      await engine._boot(path)
      return engine.exists(path)
    }

    async existsJournal(databasePath: string, journal?: DataJournal): Promise<boolean> {
      if (!journal) {
        return false
      }
      return await journal.exists(databasePath)
    }

    parseMetadata(metadata: Uint8Array): KlafMetadata {
      const {
        MetadataMajorVersionOffset,
        MetadataMajorVersionSize,
        MetadataMinorVersionOffset,
        MetadataMinorVersionSize,
        MetadataPatchVersionOffset,
        MetadataPatchVersionSize,
        MetadataIndexOffset,
        MetadataIndexSize,
        MetadataPayloadSizeOffset,
        MetadataPayloadSizeSize,
        MetadataTimestampOffset,
        MetadataTimestampSize,
        MetadataSecretKeyOffset,
        MetadataSecretKeySize,
        MetadataAutoIncrementOffset,
        MetadataAutoIncrementSize,
        MetadataCountOffset,
        MetadataCountSize,
        MetadataLastInternalIndexOffset,
        MetadataLastInternalIndexSize,
      } = KlafFormat
      const majorVersion  = IntegerConverter.FromArray8(
        IterableView.Read(metadata, MetadataMajorVersionOffset, MetadataMajorVersionSize)
      )
      const minorVersion  = IntegerConverter.FromArray8(
        IterableView.Read(metadata, MetadataMinorVersionOffset, MetadataMinorVersionSize)
      )
      const patchVersion  = IntegerConverter.FromArray8(
        IterableView.Read(metadata, MetadataPatchVersionOffset, MetadataPatchVersionSize)
      )
      const index         = IntegerConverter.FromArray32(
        IterableView.Read(metadata, MetadataIndexOffset, MetadataIndexSize)
      )
      const payloadSize   = IntegerConverter.FromArray32(
        IterableView.Read(metadata, MetadataPayloadSizeOffset, MetadataPayloadSizeSize)
      )
      const timestamp     = IntegerConverter.FromArray64(
        IterableView.Read(metadata, MetadataTimestampOffset, MetadataTimestampSize)
      )
      const secretKey     = IntegerConverter.FromArray128(
        IterableView.Read(metadata, MetadataSecretKeyOffset, MetadataSecretKeySize)
      )
      const autoIncrement = IntegerConverter.FromArray64(
        IterableView.Read(metadata, MetadataAutoIncrementOffset, MetadataAutoIncrementSize)
      )
      const count = IntegerConverter.FromArray32(
        IterableView.Read(metadata, MetadataCountOffset, MetadataCountSize)
      )
      const lastInternalIndex = IntegerConverter.FromArray32(
        IterableView.Read(metadata, MetadataLastInternalIndexOffset, MetadataLastInternalIndexSize)
      )
      return {
        majorVersion,
        minorVersion,
        patchVersion,
        payloadSize,
        timestamp,
        secretKey,
        autoIncrement,
        count,
        index,
        lastInternalIndex,
      }
    }

    normalizeOption(option: KlafCreateOption): Required<KlafCreateOption> {
      const {
        path,
        engine,
        journal = true,
        overwrite = false,
        payloadSize = 4096,
        commitDebounce = 0,
        commitDebounceMaximumSkip = 10,
        cacheLifespan = '3m',
      } = option
      return {
        path,
        engine,
        journal,
        overwrite,
        payloadSize,
        commitDebounce,
        commitDebounceMaximumSkip,
        cacheLifespan,
      }
    }

    async create(option: KlafCreateOption): Promise<KlafCreateOption> {
      const normalizedOption = this.normalizeOption(option)
      const {
        DB_VERSION,
        DB_NAME,
        MetadataValidStringOffset,
        MetadataMajorVersionOffset,
        MetadataMinorVersionOffset,
        MetadataPatchVersionOffset,
        MetadataPayloadSizeOffset,
        MetadataTimestampOffset,
        MetadataSecretKeyOffset,
        MetadataSecretKeySize,
        MetadataAutoIncrementOffset,
        MetadataCountOffset,
        MetadataLastInternalIndexOffset,
      } = KlafFormat
      const [
        majorVersion,
        minorVersion,
        patchVersion
      ] = DB_VERSION.split('.')
  
      const metadata = IterableView.Create(KlafFormat.MetadataSize, 0)
      const secretKey = CryptoHelper.RandomBytes(MetadataSecretKeySize)
      const {
        path,
        engine,
        overwrite,
        payloadSize,
      } = normalizedOption
  
      IterableView.Update(metadata, MetadataValidStringOffset,        TextConverter.ToArray(DB_NAME))
      IterableView.Update(metadata, MetadataMajorVersionOffset,       IntegerConverter.ToArray8(Number(majorVersion)))
      IterableView.Update(metadata, MetadataMinorVersionOffset,       IntegerConverter.ToArray8(Number(minorVersion)))
      IterableView.Update(metadata, MetadataPatchVersionOffset,       IntegerConverter.ToArray8(Number(patchVersion)))
      IterableView.Update(metadata, MetadataPayloadSizeOffset,        IntegerConverter.ToArray32(payloadSize))
      IterableView.Update(metadata, MetadataTimestampOffset,          IntegerConverter.ToArray64(BigInt(Date.now())))
      IterableView.Update(metadata, MetadataSecretKeyOffset,          secretKey)
      IterableView.Update(metadata, MetadataAutoIncrementOffset,      IntegerConverter.ToArray64(0n))
      IterableView.Update(metadata, MetadataCountOffset,              IntegerConverter.ToArray32(0))
      IterableView.Update(metadata, MetadataLastInternalIndexOffset,  IntegerConverter.ToArray32(0))
      
      await engine._boot(path)
      const existing = await engine.exists(path)
      if (existing) {
        if (!overwrite) {
          throw KlafService.ErrorBuilder.ERR_DB_ALREADY_EXISTS(path)
        }
        await engine._close()
        await engine._unlink(path)
        await engine._reset(path)
        await engine._boot(path)
      }
      await engine._create(path, metadata)

      return normalizedOption
    }

    async open(option: KlafCreateOption): Promise<KlafServiceConstructorArguments> {
      const normalizedOption = this.normalizeOption(option)
      const {
        path,
        engine,
        journal,
        payloadSize,
        commitDebounce,
        commitDebounceMaximumSkip,
        cacheLifespan,
      } = normalizedOption
  
      await engine._boot(path)
      const existing = await engine.exists(path)
      if (!existing) {
        if (!payloadSize) {
          throw KlafService.ErrorBuilder.ERR_DB_NO_EXISTS(path)
        }
        await this.create({ path, engine, journal, payloadSize })
      }
  
      await engine._open(path)
      const isValid = await this.isValidDatabase(engine)
      
      if (!isValid) {
        await engine._close()
        throw KlafService.ErrorBuilder.ERR_DB_INVALID(path)
      }
  
      let dataJournal: DataJournal|undefined
      if (journal) {
        dataJournal = new DataJournal(engine.clone)
        const journalPath = dataJournal.getJournalPath(path)
        await dataJournal.engine._boot(journalPath)
        const existing = await dataJournal.engine.exists(journalPath)
        if (!existing) {
          const metadata = await engine.read(0, KlafFormat.MetadataSize)
          await dataJournal.make(path, metadata)
        }
        await dataJournal.engine._open(journalPath)
      }
  
      const metadata = await engine.read(0, KlafFormat.MetadataSize)
      const parsedMetadata = this.parseMetadata(metadata)
      const secretKey = Uint8Array.from(IntegerConverter.ToArray128(parsedMetadata.secretKey))
      
      return {
        path,
        engine,
        secretKey,
        journal: dataJournal,
        metadata: parsedMetadata,
        commitDebounce,
        commitDebounceMaximumSkip,
        cacheLifespan,
      }
    }
  }
  
  readonly path: string
  readonly engine: VirtualDataEngine
  readonly journal?: DataJournal
  readonly pageHeaderSize: number
  readonly pageSize: number
  readonly maximumFreeSize: number
  readonly payloadSize: number
  readonly secretKey: Uint8Array
  readonly commitDebounce: number
  readonly commitDebounceMaximumSkip: number
  readonly cacheLifespan: StringValue|number
  private readonly _locker: Ryoiki
  private readonly _transactions: KlafTransactionManager
  private _closing: boolean
  readonly _encodingIdCache: ReturnType<KlafService['_createEncodingIdCache']>
  readonly _decodingIdCache: ReturnType<KlafService['_createDecodingIdCache']>
  readonly _pageCache: ReturnType<KlafService['_createPageCache']>
  readonly _pageHeaderCache: ReturnType<KlafService['_createPageHeaderCache']>
  readonly _pageParsedHeaderCache: ReturnType<KlafService['_createPageParsedHeaderCache']>
  readonly _recordPositionCache: ReturnType<KlafService['_createRecordPositionCache']>
  readonly _recordCache: ReturnType<KlafService['_createRecordCache']>
  readonly _parsedRecordCache: ReturnType<KlafService['_createParsedRecordCache']>
  private _metadata: KlafMetadata
  private _oldMetadata: KlafMetadata

  constructor({
    path,
    secretKey,
    metadata,
    engine,
    journal,
    commitDebounce,
    commitDebounceMaximumSkip,
    cacheLifespan,
  }: KlafServiceConstructorArguments) {
    if (metadata.payloadSize < KlafFormat.PageCellSize) {
      engine._close()
      journal?.engine._close()
      throw new Error(`The payload size is too small. It must be greater than ${KlafFormat.PageCellSize}. But got a ${metadata.payloadSize}`)
    }

    this._encodingIdCache       = this._createEncodingIdCache()
    this._decodingIdCache       = this._createDecodingIdCache()
    this._pageCache             = this._createPageCache()
    this._pageHeaderCache       = this._createPageHeaderCache()
    this._pageParsedHeaderCache = this._createPageParsedHeaderCache()
    this._recordPositionCache   = this._createRecordPositionCache()
    this._recordCache           = this._createRecordCache()
    this._parsedRecordCache     = this._createParsedRecordCache()

    this.commitDebounce             = commitDebounce
    this.commitDebounceMaximumSkip  = commitDebounceMaximumSkip
    this.cacheLifespan              = cacheLifespan

    this.pageSize           = KlafFormat.PageHeaderSize + metadata.payloadSize
    this.pageHeaderSize     = KlafFormat.PageHeaderSize
    this.maximumFreeSize    = metadata.payloadSize - KlafFormat.PageCellSize
    this.payloadSize        = metadata.payloadSize
    this.path               = path
    this.secretKey          = secretKey
    this.journal            = journal
    this._metadata          = metadata
    this._oldMetadata       = { ...metadata }
    this._closing           = false
    this._locker            = new Ryoiki()
    this.engine             = new VirtualDataEngine({
      engine,
      commitDebounce,
      commitDebounceMaximumSkip,
      cacheLifespan,
      chunkSize: this.pageSize,
      startBackup: this.startBackup.bind(this),
      endBackup: this.endBackup.bind(this),
      backup: this.backup.bind(this),
    })
    this._transactions      = new KlafTransactionManager({
      commit: this.engine.commitWithDebounce.bind(this.engine)
    })
    this.engine._open(path)
  }

  get metadata(): KlafMetadata {
    return { ...this._metadata }
  }

  get closing(): boolean {
    return this._closing
  }

  get locker(): Ryoiki {
    return this._locker
  }

  createIterable(length: number, fill: number): Uint8Array {
    return IterableView.Create(length, fill)
  }

  private _createEncodingIdCache() {
    return new CacheEntanglementSync((key, state, index: number, order: number) => {
      const sIndex  = index.toString(16).padStart(7, '0')
      const sOrder  = order.toString(16).padStart(7, '0')
      const plain = `${sIndex}${sOrder}`
      const encrypted = CryptoHelper.Encrypt(plain, this.secretKey)
      return encrypted
    }, {
      lifespan: this.cacheLifespan
    })
  }

  private _createDecodingIdCache() {
    return new CacheEntanglementSync((key, state) => {
      const plain = CryptoHelper.Decrypt(key, this.secretKey)
      const index = parseInt(plain.slice(0, 7), 16)
      const order = parseInt(plain.slice(7, 14), 16)
      return {
        index,
        order,
      }
    }, {
      lifespan: this.cacheLifespan
    })
  }

  private _createPageCache() {
    return new CacheEntanglementAsync(async (key, state, index: number) => {
      const page = await this.get(index)
      return page
    }, {
      lifespan: this.cacheLifespan
    })
  }

  private _createPageHeaderCache() {
    return new CacheEntanglementAsync(async (key, state, index: number) => {
      const page    = state.page.raw
      const header  = IterableView.Read(page, 0, this.pageHeaderSize)
      return header
    }, {
      lifespan: this.cacheLifespan,
      dependencies: {
        page: this._pageCache
      },
      beforeUpdateHook: async (key, dependencyKey, index) => {
        await this._pageCache.cache(key, index)
      },
    })
  }

  private _createPageParsedHeaderCache() {
    return new CacheEntanglementAsync(async (key, state, pageIndex: number) => {
      return this.internalParsePageHeader(state.header.raw)
    }, {
      lifespan: this.cacheLifespan,
      dependencies: {
        header: this._pageHeaderCache
      },
      beforeUpdateHook: async (key, dependencyKey, index) => {
        await this._pageHeaderCache.cache(key, index)
      },
    })
  }

  private _createRecordPositionCache() {
    return new CacheEntanglementAsync(async (key, state, index: number, order: number) => {
      const pagePos       = this.pagePosition(index)
      const payloadPos    = this.pagePayloadPosition(index)
      const cellPos       = this.pageCellPosition(index, order)
      const cellOffset    = cellPos - pagePos
      const cellValue     = IterableView.Read(state.page.raw, cellOffset, KlafFormat.PageCellSize)
      const recordOffset  = IntegerConverter.FromArray32(cellValue)
      return payloadPos + recordOffset
    }, {
      lifespan: this.cacheLifespan,
      dependencies: {
        page: this._pageCache
      },
      beforeUpdateHook: async (key, dependencyKey, index, order) => {
        await this._pageCache.cache(dependencyKey, index)
      }
    })
  }

  private _createRecordCache() {
    return new CacheEntanglementAsync(async (key, state, index: number, order: number) => {
      const pagePos       = this.pagePosition(index)
      const recordPos     = state.recordPosition.raw
      const rawPage       = state.page.raw
      const recordOffset  = recordPos - pagePos
      const rawHeader     = IterableView.Read(rawPage, recordOffset, KlafFormat.RecordHeaderSize)
      const payloadOffset = KlafFormat.RecordHeaderSize + recordOffset
      const payloadLength = IntegerConverter.FromArray32(IterableView.Read(
        rawHeader,
        KlafFormat.RecordHeaderLengthOffset,
        KlafFormat.RecordHeaderLengthSize
      ))
      
      let header = await this.parsePageHeader(index)
      
      // internal 페이지일 경우
      if (!header.next) {
        const rPayload = IterableView.Read(rawPage, payloadOffset, payloadLength)
        const merged = this.createIterable(rawHeader.length + rPayload.length, 0)
        merged.set(rawHeader, 0)
        merged.set(rPayload, rawHeader.length)
        return merged
      }
  
      // overflow 페이지로 나뉘어져 있을 경우
      let remain = payloadLength + KlafFormat.RecordHeaderSize
      let lastIndex = 0
      const record = this.createIterable(remain, 0)
  
      while (remain > 0) {
        const pos   = this.pagePayloadPosition(header.index)
        const size  = Math.min(this.maximumFreeSize, Math.max(remain, 0))
        const chunk = await this.engine.read(pos, size)
        record.set(chunk, lastIndex)
        lastIndex += chunk.length
  
        if (!header.next) {
          break
        }
        header = await this.parsePageHeader(header.next)
        remain -= size
      }
  
      return record
    }, {
      lifespan: this.cacheLifespan,
      dependencies: {
        page: this._pageCache,
        recordPosition: this._recordPositionCache,
      },
      beforeUpdateHook: async (key, dependencyKey, index, order) => {
        await this._pageCache.cache(dependencyKey, index)
        await this._recordPositionCache.cache(key, index, order)
      },
    })
  }

  private _createParsedRecordCache() {
    return new CacheEntanglementAsync(async (key, state, _index: number, _order: number) => {
      return this.internalParseRecord(state.record.raw)
    }, {
      lifespan: this.cacheLifespan,
      dependencies: {
        record: this._recordCache,
      },
      beforeUpdateHook: async (key, dependencyKey, index, order) => {
        await this._recordCache.cache(key, index, order)
      },
    })
  }

  createEmptyHeader({
    type = 0,
    index = 0,
    next = 0,
    count = 0,
    free = this.payloadSize
  }: Partial<KlafPageHeader> = {}, payload?: Uint8Array): Uint8Array {
    const payloadLen = payload ? payload.length : 0
    const header = this.createIterable(this.pageHeaderSize + payloadLen, 0)

    const rType  = IntegerConverter.ToArray32(type)
    const rIndex = IntegerConverter.ToArray32(index)
    const rNext  = IntegerConverter.ToArray32(next)
    const rCount = IntegerConverter.ToArray32(count)
    const rFree  = IntegerConverter.ToArray32(free)
    IterableView.Update(header, KlafFormat.PageTypeOffset, rType)
    IterableView.Update(header, KlafFormat.PageIndexOffset, rIndex)
    IterableView.Update(header, KlafFormat.PageNextOffset, rNext)
    IterableView.Update(header, KlafFormat.PageCountOffset, rCount)
    IterableView.Update(header, KlafFormat.PageFreeOffset, rFree)

    if (payload) {
      IterableView.Update(header, this.pageHeaderSize, payload)
    }

    return header
  }

  private createEmptyPayload(): Uint8Array {
    return this.createIterable(this.payloadSize, 0)
  }
  
  private createEmptyPage(header: Partial<KlafPageHeader>): Uint8Array {
    const payload = this.createEmptyPayload()
    return this.createEmptyHeader(header, payload)
  }

  async addEmptyPage(
    header: Partial<KlafPageHeader>,
    incrementInternalIndex: boolean
  ): Promise<number> {
    // update root
    let { index, lastInternalIndex } = this._metadata
    index++
    this._metadata.index = index
    await this.engine.update(
      KlafFormat.MetadataIndexOffset,
      IntegerConverter.ToArray32(index)
    )

    // extend payload
    const page = this.createEmptyPage({ ...header, index })
    await this.engine.append(page)
    await this._pageCache.cache(index.toString(), index)

    if (header.type === KlafPageType.InternalType && incrementInternalIndex) {
      lastInternalIndex++
      this._metadata.lastInternalIndex = lastInternalIndex
      await this.engine.update(
        KlafFormat.MetadataLastInternalIndexOffset,
        IntegerConverter.ToArray32(lastInternalIndex)
      )
    }

    return index
  }

  recordId(index: number, order: number): string {
    const cache = this._encodingIdCache.cache(
      `${index}/${order}`,
      index,
      order
    )
    return cache.raw
  }

  async get(index: number): Promise<Uint8Array> {
    const start = this.pagePosition(index)
    return await this.engine.read(start, this.pageSize)
  }

  pagePosition(index: number): number {
    return KlafFormat.MetadataSize + (this.pageSize * (index - 1))
  }

  pagePayloadPosition(index: number): number {
    return this.pagePosition(index) + this.pageHeaderSize
  }

  pageCellPosition(index: number, order: number): number {
    const pageStart = this.pagePosition(index)
    const pageEnd   = pageStart + this.pageSize
    const position  = pageEnd - (KlafFormat.PageCellSize * order)
    return position
  }

  async recordPosition(index: number, order: number): Promise<number> {
    const cache = await this._recordPositionCache.cache(
      `${index}/${order}`,
      index,
      order
    )
    return cache.raw
  }

  parseRecordId(recordId: string): {
    index: number
    order: number
  } {
    const cache = this._decodingIdCache.cache(recordId)
    return cache.raw
  }

  rawRecordId(recordId: string): Uint8Array {
    const { index, order } = this.parseRecordId(recordId)
    return IterableView.Concat(
      IntegerConverter.ToArray32(index),
      IntegerConverter.ToArray32(order),
    )
  }

  createRecord(id: string, data: Uint8Array): Uint8Array {
    const rawId = this.rawRecordId(id)
    const length = IntegerConverter.ToArray32(data.length)

    const recordHeader = this.createIterable(KlafFormat.RecordHeaderSize + data.length, 0)
    // insert record index
    IterableView.Update(recordHeader, KlafFormat.RecordHeaderIndexOffset, rawId)
    // insert record length
    IterableView.Update(recordHeader, KlafFormat.RecordHeaderLengthOffset, length)
    // insert record max length
    IterableView.Update(recordHeader, KlafFormat.RecordHeaderMaxLengthOffset, length)
    
    const record = IterableView.Update(recordHeader, KlafFormat.RecordHeaderSize, data)
    return record
  }

  createCell(recordOffset: number): Uint8Array {
    return IntegerConverter.ToArray32(recordOffset)
  }

  async getRecord(index: number, order: number): Promise<Uint8Array> {
    const cache = await this._recordCache.cache(
      `${index}/${order}`,
      index,
      order
    )
    return cache.raw
  }

  internalParseRecord(rawRecord: Uint8Array): KlafRecord {
    const index = IntegerConverter.FromArray32(IterableView.Read(
      rawRecord,
      KlafFormat.RecordHeaderIndexOffset,
      KlafFormat.RecordHeaderIndexSize
    ))
    const order = IntegerConverter.FromArray32(IterableView.Read(
      rawRecord,
      KlafFormat.RecordHeaderOrderOffset,
      KlafFormat.RecordHeaderOrderSize
    ))
    const length = IntegerConverter.FromArray32(IterableView.Read(
      rawRecord,
      KlafFormat.RecordHeaderLengthOffset,
      KlafFormat.RecordHeaderLengthSize
    ))
    const maxLength = IntegerConverter.FromArray32(IterableView.Read(
      rawRecord,
      KlafFormat.RecordHeaderMaxLengthOffset,
      KlafFormat.RecordHeaderMaxLengthSize
    ))
    const deleted = IntegerConverter.FromArray8(IterableView.Read(
      rawRecord,
      KlafFormat.RecordHeaderDeletedOffset,
      KlafFormat.RecordHeaderDeletedSize
    ))
    const aliasIndex = IntegerConverter.FromArray32(IterableView.Read(
      rawRecord,
      KlafFormat.RecordHeaderAliasIndexOffset,
      KlafFormat.RecordHeaderAliasIndexSize
    ))
    const aliasOrder = IntegerConverter.FromArray32(IterableView.Read(
      rawRecord,
      KlafFormat.RecordHeaderAliasOrderOffset,
      KlafFormat.RecordHeaderAliasOrderSize
    ))

    const rawHeader   = IterableView.Read(rawRecord, 0, KlafFormat.RecordHeaderSize)
    const rawPayload  = IterableView.Read(rawRecord, KlafFormat.RecordHeaderSize, length)
    const payload     = TextConverter.FromArray(
      IterableView.Read(rawRecord, KlafFormat.RecordHeaderSize, length)
    )

    const id = this.recordId(index, order)
    const aliasId = this.recordId(aliasIndex, aliasOrder)

    return {
      header: {
        id,
        aliasId,
        index,
        order,
        aliasIndex,
        aliasOrder,
        length,
        maxLength,
        deleted,
      },
      payload,
      rawRecord,
      rawHeader,
      rawPayload,
    }
  }

  internalParsePageHeader(header: Uint8Array): KlafPageHeader {
    const type  = IntegerConverter.FromArray32(IterableView.Read(
      header,
      KlafFormat.PageTypeOffset,
      KlafFormat.PageTypeSize
    ))
    const index = IntegerConverter.FromArray32(IterableView.Read(
      header,
      KlafFormat.PageIndexOffset,
      KlafFormat.PageIndexSize
    ))
    const next  = IntegerConverter.FromArray32(IterableView.Read(
      header,
      KlafFormat.PageNextOffset,
      KlafFormat.PageNextSize
    ))
    const count = IntegerConverter.FromArray32(IterableView.Read(
      header,
      KlafFormat.PageCountOffset,
      KlafFormat.PageCountSize
    ))
    const free  = IntegerConverter.FromArray32(IterableView.Read(
      header,
      KlafFormat.PageFreeOffset,
      KlafFormat.PageFreeSize
    ))
    return {
      type,
      index,
      next,
      count,
      free,
    }
  }

  async parseRecord(index: number, order: number): Promise<KlafRecord> {
    const key = `${index}/${order}`
    const cache = await this._parsedRecordCache.cache(key, index, order)
    const record = cache.clone('object-shallow-copy')
    return record
  }

  async getPageHeader(index: number): Promise<Uint8Array> {
    const cache = await this._pageHeaderCache.cache(`${index}`, index)
    return cache.raw
  }

  async parsePageHeader(index: number): Promise<KlafPageHeader> {
    const cache = await this._pageParsedHeaderCache.cache(index.toString(), index)
    return cache.clone('object-shallow-copy')
  }

  async getHeadPageIndex(index: number): Promise<number> {
    if (index <= 1) {
      return 1
    }
    while (true) {
      const { type } = await this.parsePageHeader(index)
      if (type !== KlafPageType.OverflowType) {
        break
      }
      index--
    }
    return index
  }

  async internalPickPayload(recordId: string, recursiveAlias: boolean): Promise<Uint8Array> {
    while (true) {
      const record = this.parseRecordId(recordId)
      const rawRecord = await this.getRecord(record.index, record.order)

      const deleted = IntegerConverter.FromArray8(IterableView.Read(
        rawRecord,
        KlafFormat.RecordHeaderDeletedOffset,
        KlafFormat.RecordHeaderDeletedSize
      ))
      const aliasIndex = IntegerConverter.FromArray32(IterableView.Read(
        rawRecord,
        KlafFormat.RecordHeaderAliasIndexOffset,
        KlafFormat.RecordHeaderAliasIndexSize
      ))
      const aliasOrder = IntegerConverter.FromArray32(IterableView.Read(
        rawRecord,
        KlafFormat.RecordHeaderAliasOrderOffset,
        KlafFormat.RecordHeaderAliasOrderSize
      ))

      if (
        recursiveAlias &&
        aliasIndex &&
        aliasOrder
      ) {
        recordId = this.recordId(aliasIndex, aliasOrder)
        continue
      }

      if (deleted) {
        throw KlafService.ErrorBuilder.ERR_ALREADY_DELETED(recordId)
      }

      const rawPayload = IterableView.Read(rawRecord, KlafFormat.RecordHeaderSize)
      return rawPayload
    }
  }

  async internalPick(recordId: string, recursiveAlias: boolean): Promise<KlafPickResult> {
    while (true) {
      const recordIdInfo = this.parseRecordId(recordId)
      const page    = await this.parsePageHeader(recordIdInfo.index)
      const record  = await this.parseRecord(recordIdInfo.index, recordIdInfo.order)
      
      if (
        recursiveAlias &&
        record.header.aliasIndex &&
        record.header.aliasOrder
      ) {
        recordId = record.header.aliasId
        continue
      }
  
      if (record.header.deleted) {
        throw KlafService.ErrorBuilder.ERR_ALREADY_DELETED(recordId)
      }
  
      return {
        page,
        record,
        order: recordIdInfo.order,
      }
    }
  }

  async getRecords(index: number): Promise<KlafRecord[]> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.readLock(async () => {
      const headIndex = await this.getHeadPageIndex(index)
      const parsedHeader = await this.parsePageHeader(headIndex)
  
      const records = []
      for (let i = 0; i < parsedHeader.count; i++) {
        const order = i + 1
        const record = await this.parseRecord(parsedHeader.index, order)
        records.push(record)
      }
      return records
    })
  }

  async setPageHeader(header: KlafPageHeader): Promise<void> {
    const pos = this.pagePosition(header.index)
    const rHeader = this.createEmptyHeader(header)
    await this.engine.update(pos, rHeader)
  }

  async setPagePayload(index: number, order: number, record: Uint8Array): Promise<void> {
    const payloadPos  = this.pagePayloadPosition(index)
    const prevOrder   = order - 1

    let recordPos
    if (order > 1) {
      const prevRecord = await this.parseRecord(index, prevOrder)
      recordPos = await this.recordPosition(index, prevOrder) + prevRecord.rawRecord.length
    }
    else {
      recordPos = payloadPos
    }

    const cellPos = this.pageCellPosition(index, order)
    const cell    = this.createCell(recordPos - payloadPos)

    await this.engine.update(recordPos, record)
    await this.engine.update(cellPos, cell)
  }

  async appendToPage(header: KlafPageHeader, data: Uint8Array): Promise<string> {
    const recordId  = this.recordId(header.index, header.count + 1)
    const record    = this.createRecord(recordId, data)

    await this.setPagePayload(header.index, header.count + 1, record)
    
    const usage = KlafFormat.RecordHeaderSize + KlafFormat.PageCellSize + data.length
    header.count += 1
    header.free -= usage
    header.free = Math.max(header.free, 0)
    await this.setPageHeader(header)

    return recordId
  }

  async internalPut(text: string|Uint8Array, autoIncrement: boolean): Promise<string> {
    let data: Uint8Array
    if (typeof text === 'string') {
      data = TextConverter.ToArray(text)
    }
    else {
      data = text
    }
    const lastInternalIndex = this._metadata.lastInternalIndex
    let index   = lastInternalIndex
    let header  = await this.parsePageHeader(index)

    if (autoIncrement) {
      let { autoIncrement: increment, count } = this._metadata
      this._metadata.autoIncrement = increment + 1n
      this._metadata.count = count + 1
      await this.engine.update(
        KlafFormat.MetadataAutoIncrementOffset,
        IntegerConverter.ToArray64(increment + 1n)
      )
      await this.engine.update(
        KlafFormat.MetadataCountOffset,
        IntegerConverter.ToArray32(count + 1)
      )
    }
    
    // 1. 이전 페이지의 공간이 넉넉하여 단일 페이지에 넣을 수 있는 경우
    // 이전 페이지에 넣기
    const recordSize  = KlafFormat.RecordHeaderSize + data.length
    const recordUsage = KlafFormat.PageCellSize + recordSize
    if (header.free >= recordUsage) {
      const recordId = await this.appendToPage(header, data)
      await this._pageCache.update(header.index.toString(), header.index)
      return recordId
    }
    
    // 2. 이전 페이지의 공간이 넉넉하지 않을 경우
    
    // 새 페이지를 추가해야 합니다
    // 이전 페이지가 사용되지 않은 채 공백으로 남아 있을 수 있습니다.
    // 따라서 사용되었을 경우에만 생성되어야 합니다.
    
    // 이전 페이지가 이미 사용되었습니다. 새로운 페이지를 생성합니다.
    if (header.count) {
      index = await this.addEmptyPage({ type: KlafPageType.InternalType }, true)
      header = await this.parsePageHeader(index)
    }
    
    const count = Math.ceil(recordSize / this.maximumFreeSize)
    const isWillBeInternal = count === 1
    const isWillBeOverflow = count > 1
    const isNeverUsed = !header.count
    
    // 한 페이지에 삽입이 가능할 경우, Internal 타입으로 생성되어야 하며, 삽입 후 종료되어야 합니다.
    if (isWillBeInternal) {
      const recordId = this.appendToPage(header, data)
      await this._pageCache.update(header.index.toString(), header.index)
      return recordId
    }

    // 이전 페이지가 사용되지 않았지만, 한 페이지 내에 넣기엔 너무 큽니다.
    // Overflow 타입의 페이지로 전환됩니다.
    let isInternalIndexDeferred = false
    if (isWillBeOverflow && isNeverUsed) {
      isInternalIndexDeferred = true
    }
    
    // Overflow 타입의 페이지입니다.
    // 다음 삽입 시 무조건 새로운 페이지를 만들어야하므로, free, count 값이 고정됩니다.
    const recordId  = this.recordId(header.index, header.count + 1)
    const record    = this.createRecord(recordId, data)
    const headIndex = index

    for (let i = 0; i < count; i++) {
      const last = i === count - 1
      const start = i * this.maximumFreeSize
      const chunk = IterableView.Read(record, start, this.maximumFreeSize)
      
      const current = await this.parsePageHeader(index)
      await this.setPagePayload(
        current.index,
        current.count + 1,
        chunk
      )
      
      if (!last) {
        index = await this.addEmptyPage({ type: KlafPageType.OverflowType }, false)
      }
      current.type = KlafPageType.OverflowType
      current.free = 0
      current.next = index
      current.count += 1
      if (last) {
        current.next = 0
      }
      await this.setPageHeader(current)
      await this._pageCache.update(current.index.toString(), current.index)
    }
    const headHeader = await this.parsePageHeader(headIndex)
    headHeader.type = KlafPageType.InternalType
    headHeader.count = 1
    headHeader.free = 0
    await this.setPageHeader(headHeader)
    await this._pageCache.update(headIndex.toString(), headIndex)

    if (isInternalIndexDeferred) {
      this._metadata.lastInternalIndex = index
      await this.engine.update(
        KlafFormat.MetadataLastInternalIndexOffset,
        IntegerConverter.ToArray32(index)
      )
      await this.addEmptyPage({ type: KlafPageType.InternalType }, true)
    }

    return recordId
  }

  async setInternalRecord(
    index: number,
    order: number,
    record: Uint8Array,
    pageCaching = true
  ): Promise<number> {
    const recordPosition = await this.recordPosition(index, order)
    await this.engine.update(recordPosition, record)
    if (pageCaching) {
      await this._pageCache.update(index.toString(), index)
    }
    return index
  }

  async setOverflowedRecord(
    index: number,
    record: Uint8Array,
  ): Promise<number> {
    while (index) {
      const size = Math.min(this.maximumFreeSize, record.length)
      const chunk = IterableView.Read(record, 0, size)
      
      await this.engine.update(this.pagePayloadPosition(index), chunk)
      await this._pageCache.update(index.toString(), index)
      record = record.subarray(size)
      
      if (!record.length) {
        return index
      }

      const header = await this.getPageHeader(index)
      const parsedHeader = await this.parsePageHeader(index)
      let next = parsedHeader.next
      if (!next) {
        next = await this.addEmptyPage({
          type: KlafPageType.OverflowType,
          count: 1,
          free: 0
        }, false)
        IterableView.Update(
          header,
          KlafFormat.PageNextOffset,
          IntegerConverter.ToArray32(next)
        )
        await this.engine.update(
          this.pagePosition(index),
          header
        )
        await this._pageCache.update(index.toString(), index)
      }
      index = next
    }

    return index
  }

  async isInternalRecord(index: number): Promise<boolean> {
    const page = await this.parsePageHeader(index)
    return !page.next
  }

  async internalUpdate(id: string, text: string): Promise<{
    id: string
    text: string
  }> {
    const payload = TextConverter.ToArray(text)
    const head = await this.internalPick(id, false)
    const tail = await this.internalPick(id, true)
    
    if (head.record.header.deleted) {
      throw KlafService.ErrorBuilder.ERR_ALREADY_DELETED(id)
    }

    const record = this.createRecord(tail.record.header.id, payload)

    const isInternalBeforeTail = await this.isInternalRecord(tail.record.header.index)
    const isLongerThanBefore = tail.record.rawRecord.length < record.length

    if (isLongerThanBefore) {
      if (isInternalBeforeTail) {
        const id = await this.internalPut(text, false)
        const { index, order } = this.parseRecordId(id)
        const headClone = IterableView.Copy(head.record.rawRecord)
        IterableView.Update(
          headClone,
          KlafFormat.RecordHeaderAliasIndexOffset,
          IntegerConverter.ToArray32(index)
        )
        IterableView.Update(
          headClone,
          KlafFormat.RecordHeaderAliasOrderOffset,
          IntegerConverter.ToArray32(order)
        )
        await this.engine.update(
          await this.recordPosition(
            head.record.header.index,
            head.record.header.order
          ),
          headClone
        )
        await this._pageCache.update(
          head.record.header.index.toString(),
          head.record.header.index,
        )
        if (head.record.header.id !== tail.record.header.id) {
          await this.internalDelete(tail.record.header.id, false)
        }
        await this._pageCache.update(
          tail.record.header.index.toString(),
          tail.record.header.index,
        )
        return {
          id,
          text
        }
      }
      else {
        await this.setOverflowedRecord(tail.record.header.index, record)
      }
    }
    else {
      IterableView.Update(
        record,
        KlafFormat.RecordHeaderMaxLengthOffset,
        IntegerConverter.ToArray32(tail.record.header.maxLength)
      )
      if (isInternalBeforeTail) {
        await this.setInternalRecord(
          tail.record.header.index,
          tail.record.header.order,
          record,
          false
        )
      }
      else {
        await this.setOverflowedRecord(tail.record.header.index, record)
      }
    }
    await this._pageCache.update(
      tail.record.header.index.toString(),
      tail.record.header.index,
    )
    return {
      id: tail.record.header.id,
      text,
    }
  }

  async internalDelete(recordId: string, countDecrement: boolean): Promise<void> {
    const { index, order } = this.parseRecordId(recordId)
    const pos = await this.recordPosition(index, order) + KlafFormat.RecordHeaderDeletedOffset
    const flagForDeleted = IntegerConverter.ToArray8(1)
    if (countDecrement) {
      const { count } = this._metadata
      this._metadata.count = count - 1
      await this.engine.update(
        KlafFormat.MetadataCountOffset,
        IntegerConverter.ToArray32(count - 1)
      )
    }
    await this.engine.update(pos, flagForDeleted)
    await this._pageCache.update(index.toString(), index)

    this._encodingIdCache.delete(`${index}/${order}`)
    this._decodingIdCache.delete(recordId)
  }

  async transaction<T>(work: () => Promise<T>, lockType: 'read'|'write'): Promise<T> {
    const [err, res] = await Catcher.CatchError(this._transactions.transaction(work, lockType))
    if (err) {
      throw err
    }
    return res
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

  async pick(recordId: string): Promise<KlafPickResult> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.readLock(() => this.internalPick(recordId, true))
  }

  async pickPayload(recordId: string): Promise<Uint8Array> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.readLock(() => this.internalPickPayload(recordId, true))
  }

  async put(text: string): Promise<string> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.writeLock(() => this.internalPut(text, true))
  }

  async batch(texts: string[]): Promise<string[]> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.writeLock(async () => {
      const ids = []
      for (let i = 0, len = texts.length; i < len; i++) {
        const id = await this.internalPut(texts[i], true)
        ids.push(id)
      }
      return ids
    })
  }

  async update(recordId: string, text: string): Promise<string> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.writeLock(async () => {
      const information = await this.internalUpdate(recordId, text)
      return information.id
    })
  }

  async delete(recordId: string): Promise<void> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.writeLock(async () => {
      const { record } = await this.internalPick(recordId, false)
      await this.internalDelete(record.header.id, true)
    })
  }

  async exists(recordId: string): Promise<boolean> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    return this.readLock(() => this.internalPick(recordId, false)
      .then(() => true)
      .catch(() => false)
    )
  }

  async close(): Promise<void> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    this._closing = true
    return this.writeLock(async () => {
      this._decodingIdCache.clear()
      this._encodingIdCache.clear()
      this._pageCache.clear()
      await this.engine._close()
      await this.journal?.close(this.path)
    })
  }

  @DataJournal.Decorator.RequireInstance
  async startBackup(): Promise<void> {
    const journal = this.journal!
    const metadata = await this.engine.engine.read(0, KlafFormat.MetadataSize)
    await journal.reset(metadata)
    await journal.startTransaction({
      working: 1,
      maximumPageIndex: this._oldMetadata.index,
    })
  }
  
  @DataJournal.Decorator.RequireInstance
  async endBackup(commitError?: Error): Promise<void> {
    const journal = this.journal!
    const metadata = await this.engine.engine.read(0, KlafFormat.MetadataSize)
    await journal.reset(metadata)
    await journal.endTransaction({
      working: 0,
    })
    if (!commitError) {
      this._oldMetadata = { ...this._metadata }
    }
  }
  
  @DataJournal.Decorator.RequireInstance
  async backup(journalPageIndex: number, data: Uint8Array): Promise<void> {
    const journal = this.journal!
    if (journal.isAlreadyBackup(journalPageIndex)) {
      return
    }
    await journal.backupPage(journalPageIndex, data)
  }

  @DataJournal.Decorator.RequireInstance
  async restoreJournal(): Promise<boolean> {
    const journal = this.journal!
    const journalExisting = await journal.exists(this.path)
    if (!journalExisting) {
      return false
    }
    return await journal.restore({
      pageSize: this.pageSize,
      restoreMetadata: async (metadata) => {
        await this.engine.engine.update(0, metadata)
      },
      restoreData: async (journalPageIndex, data) => {
        let position = journalPageIndex * this.pageSize
        const isContainMetadata = journalPageIndex === 0
        if (isContainMetadata) {
          position += KlafFormat.MetadataSize
          data = data.subarray(KlafFormat.MetadataSize)
        }
        await this.engine.engine.update(position, data)
      },
      truncate: async (maximumPageIndex) => {
        const size = this.pagePosition(maximumPageIndex + 1)
        await this.engine.engine.truncate(size)
      },
      done: async (rawMetadata) => {
        await this.engine._reset(this.path)
        const bootloader = new KlafService.Bootloader()
        const metadata = bootloader.parseMetadata(rawMetadata)
        this._metadata = { ...metadata }
        this._oldMetadata = { ...metadata }
      },
    })
  }
}
