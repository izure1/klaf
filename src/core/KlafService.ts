import { CacheEntanglementAsync } from 'cache-entanglement'
import { Ryoiki } from 'ryoiki'
import { CryptoHelper } from '../utils/CryptoHelper'
import { IntegerConverter } from '../utils/IntegerConverter'
import { IterableView } from '../utils/IterableView'
import { TextConverter } from '../utils/TextConverter'
import { DataJournal, DataJournalContainer } from '../engine/DataJournal'
import { DataEngine } from '../engine/DataEngine'
import { KlafCreateOption } from './Klaf'

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
  rawRecord: number[]
  rawHeader: number[]
  rawPayload: number[]
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
      await engine.boot(path)
      return engine.exists(path)
    }

    async existsJournal(databasePath: string, journal: DataJournal): Promise<boolean> {
      const journalPath = journal.getJournalPath(databasePath)
      await journal.engine.boot(journalPath)
      return journal.engine.exists(journalPath)
    }

    parseMetadata(metadata: number[]): KlafMetadata {
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

    async create(option: KlafCreateOption): Promise<KlafServiceConstructorArguments> {
      const {
        path,
        engine,
        journal,
        payloadSize = 1024,
        overwrite = false,
      } = option
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
  
      IterableView.Update(metadata, MetadataValidStringOffset,        TextConverter.ToArray(DB_NAME))
      IterableView.Update(metadata, MetadataMajorVersionOffset,       IntegerConverter.ToArray8(Number(majorVersion)))
      IterableView.Update(metadata, MetadataMinorVersionOffset,       IntegerConverter.ToArray8(Number(minorVersion)))
      IterableView.Update(metadata, MetadataPatchVersionOffset,       IntegerConverter.ToArray8(Number(patchVersion)))
      IterableView.Update(metadata, MetadataPayloadSizeOffset,        IntegerConverter.ToArray32(payloadSize))
      IterableView.Update(metadata, MetadataTimestampOffset,          IntegerConverter.ToArray64(BigInt(Date.now())))
      IterableView.Update(metadata, MetadataSecretKeyOffset,          Array.from(secretKey))
      IterableView.Update(metadata, MetadataAutoIncrementOffset,      IntegerConverter.ToArray64(0n))
      IterableView.Update(metadata, MetadataCountOffset,              IntegerConverter.ToArray32(0))
      IterableView.Update(metadata, MetadataLastInternalIndexOffset,  IntegerConverter.ToArray32(0))
      
      await engine.boot(path)
      const existing = await engine.exists(path)
      if (existing) {
        if (!overwrite) {
          throw KlafService.ErrorBuilder.ERR_DB_ALREADY_EXISTS(path)
        }
        await engine.unlink(path)
      }
      await engine.create(path, metadata)

      let parsedMetadata = this.parseMetadata(metadata)
      return {
        path,
        engine,
        journal,
        secretKey,
        metadata: parsedMetadata,
      }
    }

    async open(option: KlafCreateOption): Promise<KlafServiceConstructorArguments> {
      const {
        path,
        engine,
        journal,
        payloadSize = 1024
      } = option
  
      await engine.boot(path)
      const existing = await engine.exists(path)
      if (!existing) {
        if (!payloadSize) {
          throw KlafService.ErrorBuilder.ERR_DB_NO_EXISTS(path)
        }
        await this.create({ path, engine, journal, payloadSize })
      }
  
      await engine.open(path)
      const isValid = await this.isValidDatabase(engine)
      
      if (!isValid) {
        await engine.close()
        throw KlafService.ErrorBuilder.ERR_DB_INVALID(path)
      }
  
      if (journal) {
        const journalPath = journal.getJournalPath(path)
        await journal.engine.boot(journalPath)
        const existing = await journal.engine.exists(journalPath)
        if (!existing) {
          const metadata = await engine.read(0, KlafFormat.MetadataSize)
          await journal.make(path, metadata)
        }
        await journal.engine.open(journalPath)
      }
  
      const metadata = await engine.read(0, KlafFormat.MetadataSize)
      const parsedMetadata = this.parseMetadata(metadata)
      const secretKey = Uint8Array.from(IntegerConverter.ToArray128(parsedMetadata.secretKey))
      
      return {
        path,
        engine,
        journal,
        secretKey,
        metadata: parsedMetadata,
      }
    }
  }
  
  readonly path: string
  readonly engine: DataEngine
  readonly journal?: DataJournal
  readonly pageHeaderSize: number
  readonly pageSize: number
  readonly maximumFreeSize: number
  readonly payloadSize: number
  readonly secretKey: Uint8Array
  private readonly _locker: Ryoiki
  private _closing: boolean
  private readonly _encodingIdCache: ReturnType<KlafService['_createEncodingIdCache']>
  private readonly _decodingIdCache: ReturnType<KlafService['_createDecodingIdCache']>
  private readonly _decodingRecordCache: ReturnType<KlafService['_createDecodingRecordCache']>
  private readonly _pageHeaderCache: ReturnType<KlafService['_createPageHeaderCache']>
  private readonly _recordPositionCache: ReturnType<KlafService['_createRecordPositionCache']>
  private readonly _recordCache: ReturnType<KlafService['_createRecordCache']>
  private readonly _metadata: KlafMetadata

  constructor({
    path,
    secretKey,
    metadata,
    engine,
    journal,
  }: KlafServiceConstructorArguments) {
    if (metadata.payloadSize < KlafFormat.PageCellSize) {
      engine.close()
      journal?.engine.close()
      throw new Error(`The payload size is too small. It must be greater than ${KlafFormat.PageCellSize}. But got a ${metadata.payloadSize}`)
    }

    this._encodingIdCache       = this._createEncodingIdCache()
    this._decodingIdCache       = this._createDecodingIdCache()
    this._decodingRecordCache   = this._createDecodingRecordCache()
    this._pageHeaderCache       = this._createPageHeaderCache()
    this._recordPositionCache   = this._createRecordPositionCache()
    this._recordCache           = this._createRecordCache(this._recordPositionCache, this._pageHeaderCache)

    this.pageSize           = KlafFormat.PageHeaderSize + metadata.payloadSize
    this.pageHeaderSize     = KlafFormat.PageHeaderSize
    this.maximumFreeSize    = metadata.payloadSize - KlafFormat.PageCellSize
    this.payloadSize        = metadata.payloadSize
    this.path               = path
    this.secretKey          = secretKey
    this.engine             = engine
    this.journal            = journal
    this._metadata          = metadata
    this._closing           = false
    this._locker            = new Ryoiki()
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

  createIterable(length: number, fill: number): number[] {
    return IterableView.Create(length, fill)
  }

  private _createEncodingIdCache() {
    return new CacheEntanglementAsync(async (key, state, index: number, order: number) => {
      const sIndex  = index.toString(16).padStart(7, '0')
      const sOrder  = order.toString(16).padStart(7, '0')
      const plain = `${sIndex}${sOrder}`
      const encrypted = CryptoHelper.Encrypt(plain, this.secretKey)
      return encrypted
    })
  }

  private _createDecodingIdCache() {
    return new CacheEntanglementAsync(async (key, state) => {
      const plain = CryptoHelper.Decrypt(key, this.secretKey)
      const index = parseInt(plain.slice(0, 7), 16)
      const order = parseInt(plain.slice(7, 14), 16)
      return {
        index,
        order,
      }
    })
  }

  private _createDecodingRecordCache() {
    return new CacheEntanglementAsync(async (key, state, rawHeader: number[]) => {
      const index = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          KlafFormat.RecordHeaderIndexOffset,
          KlafFormat.RecordHeaderIndexSize
        )
      )
      const order = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          KlafFormat.RecordHeaderOrderOffset,
          KlafFormat.RecordHeaderOrderSize
        )
      )
      const length = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          KlafFormat.RecordHeaderLengthOffset,
          KlafFormat.RecordHeaderLengthSize
        )
      )
      const maxLength = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          KlafFormat.RecordHeaderMaxLengthOffset,
          KlafFormat.RecordHeaderMaxLengthSize
        )
      )
      const deleted = IntegerConverter.FromArray8(
        IterableView.Read(
          rawHeader,
          KlafFormat.RecordHeaderDeletedOffset,
          KlafFormat.RecordHeaderDeletedSize
        )
      )
      const aliasIndex = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          KlafFormat.RecordHeaderAliasIndexOffset,
          KlafFormat.RecordHeaderAliasIndexSize
        )
      )
      const aliasOrder = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          KlafFormat.RecordHeaderAliasOrderOffset,
          KlafFormat.RecordHeaderAliasOrderSize
        )
      )
  
      const id = await this.recordId(index, order)
      const aliasId = await this.recordId(aliasIndex, aliasOrder)

      return {
        id,
        aliasId,
        index,
        order,
        aliasIndex,
        aliasOrder,
        length,
        maxLength,
        deleted,
      }
    })
  }

  private _createPageHeaderCache() {
    return new CacheEntanglementAsync(async (key, state, index: number) => {
      const page    = await this.get(index)
      const header  = IterableView.Read(page, 0, this.pageHeaderSize)
      return header
    })
  }

  private _createRecordPositionCache() {
    return new CacheEntanglementAsync(async (key, state, index: number, order: number) => {
      const payloadPos    = this.pagePayloadPosition(index)
      const cellPos       = this.pageCellPosition(index, order)
      const cellValue     = await this.engine.read(cellPos, KlafFormat.PageCellSize)
      const recordOffset  = IntegerConverter.FromArray32(cellValue)
      return payloadPos + recordOffset
    })
  }

  private _createRecordCache(
    recordPosition: ReturnType<KlafService['_createRecordPositionCache']>,
    pageHeader: ReturnType<KlafService['_createPageHeaderCache']>
  ) {
    return new CacheEntanglementAsync(async (key, {
      recordPosition,
      pageHeader,
    }, index: number, order: number) => {
      const pos = recordPosition.raw
      const rHeader = await this.engine.read(pos, KlafFormat.RecordHeaderSize)
      const payloadPos = KlafFormat.RecordHeaderSize + pos
      const payloadLength = IntegerConverter.FromArray32(
        IterableView.Read(
          rHeader,
          KlafFormat.RecordHeaderLengthOffset,
          KlafFormat.RecordHeaderLengthSize
        )
      )
  
      let header = this.parseHeader(pageHeader.raw)
      
      // internal 페이지일 경우
      if (!header.next) {
        const rPayload = await this.engine.read(payloadPos, payloadLength)
        return rHeader.concat(rPayload)
      }
  
      // overflow 페이지로 나뉘어져 있을 경우
      const record = []
      let remain = payloadLength + KlafFormat.RecordHeaderSize
  
      while (remain > 0) {
        const pos   = this.pagePayloadPosition(header.index)
        const size  = Math.min(this.maximumFreeSize, Math.abs(remain))
        const chunk = await this.engine.read(pos, size)
        record.push(...chunk)
  
        if (!header.next) {
          break
        }
        const rawHeader = await this.getHeader(header.next)
        header = this.parseHeader(rawHeader)
        remain -= size
      }
  
      return record
    }, {
      recordPosition,
      pageHeader,
    }, async (key, dependencyKey, index, order) => {
      await recordPosition.cache(key, index, order)
      await pageHeader.cache(dependencyKey, index)
    })
  }

  createEmptyHeader({
    type = 0,
    index = 0,
    next = 0,
    count = 0,
    free = this.payloadSize
  }: Partial<KlafPageHeader> = {}): number[] {
    const header = this.createIterable(this.pageHeaderSize, 0)

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

    return header
  }

  private createEmptyPayload(): number[] {
    return this.createIterable(this.payloadSize, 0)
  }
  
  private createEmptyPage(header: Partial<KlafPageHeader>): number[] {
    const payload = this.createEmptyPayload()
    return this.createEmptyHeader(header).concat(payload)
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
    const page = this.createEmptyPage(Object.assign({}, header, { index }))
    await this.engine.append(page)

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

  async recordId(index: number, order: number): Promise<string> {
    return (
      await this._encodingIdCache.cache(
        `${index}/${order}`,
        index,
        order
      )
    ).raw
  }

  async get(index: number): Promise<number[]> {
    const start = this.pagePosition(index)
    return this.engine.read(start, this.pageSize)
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
    return (
      await this._recordPositionCache.cache(
        `${index}/${order}`,
        index,
        order
      )
    ).raw
  }

  async parseRecordId(recordId: string): Promise<{
    index: number
    order: number
  }> {
    return (
      await this._decodingIdCache.cache(recordId)
    ).clone('object-shallow-copy')
  }

  async rawRecordId(recordId: string): Promise<number[]> {
    const { index, order } = await this.parseRecordId(recordId)
    return IntegerConverter.ToArray32(index).concat(
      IntegerConverter.ToArray32(order)
    )
  }

  async createRecord(id: string, data: number[]): Promise<number[]> {
    const rawId = await this.rawRecordId(id)
    const length = IntegerConverter.ToArray32(data.length)

    const recordHeader = this.createIterable(KlafFormat.RecordHeaderSize, 0)
    // insert record index
    IterableView.Update(recordHeader, KlafFormat.RecordHeaderIndexOffset, rawId)
    // insert record length
    IterableView.Update(recordHeader, KlafFormat.RecordHeaderLengthOffset, length)
    // insert record max length
    IterableView.Update(recordHeader, KlafFormat.RecordHeaderMaxLengthOffset, length)
    
    const record = recordHeader.concat(data)
    return record
  }

  createCell(recordOffset: number): number[] {
    return IntegerConverter.ToArray32(recordOffset)
  }

  async getRecord(index: number, order: number): Promise<number[]> {
    return (
      await this._recordCache.cache(
        `${index}/${order}`,
        index,
        order
      )
    ).clone('array-shallow-copy') as number[]
  }

  async parseRecord(record: number[]): Promise<KlafRecord> {
    const rawHeader   = IterableView.Read(record, 0, KlafFormat.RecordHeaderSize)
    const rawPayload  = IterableView.Read(record, KlafFormat.RecordHeaderSize)

    const header = (
      await this._decodingRecordCache.cache(
        rawHeader.join(','),
        rawHeader
      )
    ).clone('object-shallow-copy')

    const rawRecord = rawHeader.concat(rawPayload)
    const payload = TextConverter.FromArray(rawPayload)
    return {
      rawRecord,
      rawHeader,
      rawPayload,
      header,
      payload,
    }
  }

  async getHeader(index: number): Promise<number[]> {
    return (
      await this._pageHeaderCache.cache(`${index}`, index)
    ).clone('array-shallow-copy') as number[]
  }

  parseHeader(header: number[]): KlafPageHeader {
    const type  = IntegerConverter.FromArray32(
      IterableView.Read(header, KlafFormat.PageTypeOffset, KlafFormat.PageTypeSize)
    )
    const index = IntegerConverter.FromArray32(
      IterableView.Read(header, KlafFormat.PageIndexOffset, KlafFormat.PageIndexSize)
    )
    const next  = IntegerConverter.FromArray32(
      IterableView.Read(header, KlafFormat.PageNextOffset, KlafFormat.PageNextSize)
    )
    const count = IntegerConverter.FromArray32(
      IterableView.Read(header, KlafFormat.PageCountOffset, KlafFormat.PageCountSize)
    )
    const free  = IntegerConverter.FromArray32(
      IterableView.Read(header, KlafFormat.PageFreeOffset, KlafFormat.PageFreeSize)
    )
    return {
      type,
      index,
      next,
      count,
      free,
    }
  }

  async getHeadPageIndex(index: number): Promise<number> {
    if (index <= 1) {
      return 1
    }
    while (true) {
      const header = await this.getHeader(index)
      const { type } = this.parseHeader(header)
      if (type !== KlafPageType.OverflowType) {
        break
      }
      index--
    }
    return index
  }

  async internalPick(recordId: string, recursiveAlias: boolean): Promise<KlafPickResult> {
    const { index, order } = await this.parseRecordId(recordId)
    const header  = await this.getHeader(index)
    const page    = this.parseHeader(header)
    const raw     = await this.getRecord(index, order)
    const record  = await this.parseRecord(raw)
    
    if (
      recursiveAlias &&
      record.header.aliasIndex &&
      record.header.aliasOrder
    ) {
      return this.internalPick(record.header.aliasId, recursiveAlias)
    }

    if (record.header.deleted) {
      throw KlafService.ErrorBuilder.ERR_ALREADY_DELETED(recordId)
    }

    return {
      page,
      record,
      order
    }
  }

  async getRecords(index: number): Promise<KlafRecord[]> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this._locker.readLock(async (_lockId) => {
      lockId = _lockId
      const headIndex = await this.getHeadPageIndex(index)
      const header = await this.getHeader(headIndex)
      const parsedHeader = this.parseHeader(header)
  
      const records = []
      for (let i = 0; i < parsedHeader.count; i++) {
        const order = i + 1
        const rawRecord = await this.getRecord(parsedHeader.index, order)
        const record = await this.parseRecord(rawRecord)
        records.push(record)
      }
      return records
    }).finally(() => this._locker.readUnlock(lockId))
  }

  async setPageHeader(header: KlafPageHeader): Promise<void> {
    const pos = this.pagePosition(header.index)
    const rHeader = this.createEmptyHeader(header)
    await this.engine.update(pos, rHeader)
    this._pageHeaderCache.delete(`${header.index}`)
  }

  async setPagePayload(index: number, order: number, record: number[]): Promise<void> {
    const payloadPos  = this.pagePayloadPosition(index)
    const prevOrder   = order - 1

    let recordPos
    if (order > 1) {
      const record      = await this.getRecord(index, prevOrder)
      const prevRecord  = await this.parseRecord(record)
      recordPos         = await this.recordPosition(index, prevOrder) + prevRecord.rawRecord.length
    }
    else {
      recordPos = payloadPos
    }

    const cellPos = this.pageCellPosition(index, order)
    const cell    = this.createCell(recordPos - payloadPos)

    await this.engine.update(recordPos, record)
    await this.engine.update(cellPos, cell)

    this._recordCache.delete(`${index}/${order}`)
  }

  async setPage(header: KlafPageHeader, data: number[]): Promise<string> {
    const recordId  = await this.recordId(header.index, header.count + 1)
    const record    = await this.createRecord(recordId, data)

    await this.setPagePayload(header.index, header.count + 1, record)
    
    const usage = KlafFormat.RecordHeaderSize + KlafFormat.PageCellSize + data.length
    header.count += 1
    header.free -= usage

    await this.setPageHeader(header)

    return recordId
  }

  async internalPut(text: string|number[], autoIncrement: boolean): Promise<string> {
    let data: number[]
    if (typeof text === 'string') {
      data = TextConverter.ToArray(text)
    }
    else {
      data = text
    }
    const lastInternalIndex = this._metadata.lastInternalIndex
    let index   = lastInternalIndex
    let header  = this.parseHeader(await this.getHeader(index))

    await this.backup(index)

    if (autoIncrement) {
      let { autoIncrement: increment, count } = this._metadata
      this._metadata.autoIncrement = increment + 1n
      await this.engine.update(
        KlafFormat.MetadataAutoIncrementOffset,
        IntegerConverter.ToArray64(increment + 1n)
      )
      this._metadata.count = count + 1
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
      const recordId = await this.setPage(header, data)
      return recordId
    }
    
    // 2. 이전 페이지의 공간이 넉넉하지 않을 경우
    
    // 새 페이지를 추가해야 합니다
    // 이전 페이지가 사용되지 않은 채 공백으로 남아 있을 수 있습니다.
    // 따라서 사용되었을 경우에만 생성되어야 합니다.
    let appendNewPage = false
    
    // 이전 페이지가 이미 사용되었습니다. 새로운 페이지를 생성합니다.
    if (header.count) {
      appendNewPage = true
      index = await this.addEmptyPage({ type: KlafPageType.InternalType }, true)
      header = this.parseHeader(await this.getHeader(index))
    }
    
    const count = Math.ceil(recordSize / this.maximumFreeSize)
    const isWillBeInternal = count === 1
    const isWillBeOverflow = count > 1
    const isNeverUsed = !header.count
    
    // 한 페이지에 삽입이 가능할 경우, Internal 타입으로 생성되어야 하며, 삽입 후 종료되어야 합니다.
    if (isWillBeInternal) {
      await this.backup(header.index)
      return this.setPage(header, data)
    }

    // 이전 페이지가 사용되지 않았지만, 한 페이지 내에 넣기엔 너무 큽니다.
    // Overflow 타입의 페이지로 전환됩니다.
    let isInternalIndexDeferred = false
    if (isWillBeOverflow && isNeverUsed) {
      isInternalIndexDeferred = true
    }
    
    // Overflow 타입의 페이지입니다.
    // 다음 삽입 시 무조건 새로운 페이지를 만들어야하므로, free, count 값이 고정됩니다.
    const recordId  = await this.recordId(header.index, header.count + 1)
    const record    = await this.createRecord(recordId, data)
    const headIndex = index

    for (let i = 0; i < count; i++) {
      const last = i === count - 1
      const start = i * this.maximumFreeSize
      const chunk = IterableView.Read(record, start, this.maximumFreeSize)
      
      const current = this.parseHeader(await this.getHeader(index))
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
      await this.backup(current.index)
      await this.setPageHeader(current)
    }
    const headHeader = this.parseHeader(await this.getHeader(headIndex))
    headHeader.type = KlafPageType.InternalType
    headHeader.count = 1
    headHeader.free = 0
    await this.backup(headHeader.index)
    await this.setPageHeader(headHeader)

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
    record: number[]
  ): Promise<number> {
    await this.backup(index)
    await this.engine.update(await this.recordPosition(index, order), record)
    return index
  }

  async setOverflowedRecord(
    index: number,
    record: number[]
  ): Promise<number> {
    while (index) {
      const size = Math.min(this.maximumFreeSize, record.length)
      const chunk = IterableView.Read(record, 0, size)
      
      await this.backup(index)
      await this.engine.update(this.pagePayloadPosition(index), chunk)
      record = record.slice(size)
      
      if (!record.length) {
        this._recordCache.delete(`${index}/1`)
        return index
      }

      const header = await this.getHeader(index)
      const parsedHeader = this.parseHeader(header)
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
      }
      this._pageHeaderCache.delete(`${index}`)
      this._recordCache.delete(`${index}/1`)
      index = next
    }

    return index
  }

  async isInternalRecord(record: number[]): Promise<boolean> {
    const parsedRecord  = await this.parseRecord(record)
    const index         = parsedRecord.header.index
    const header        = await this.getHeader(index)
    const page          = this.parseHeader(header)
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

    const record = await this.createRecord(tail.record.header.id, payload)

    const isInternalTail = await this.isInternalRecord(tail.record.rawRecord)
    const isLongerThanBefore = tail.record.rawRecord.length < record.length

    if (isLongerThanBefore) {
      if (isInternalTail) {
        const id = await this.internalPut(text, false)
        const { index, order } = await this.parseRecordId(id)
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
        await this.backup(head.page.index)
        await this.engine.update(
          await this.recordPosition(
            head.record.header.index,
            head.record.header.order
          ),
          headClone
        )
        if (head.record.header.id !== tail.record.header.id) {
          await this.internalDelete(tail.record.header.id, false)
        }
        this._recordCache.delete(`${head.record.header.index}/${head.record.header.order}`)
        this._recordCache.delete(`${tail.record.header.index}/${tail.record.header.order}`)
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
      if (isInternalTail) {
        await this.setInternalRecord(
          tail.record.header.index,
          tail.record.header.order,
          record
        )
      }
      else {
        await this.setOverflowedRecord(tail.record.header.index, record)
      }
    }
    return {
      id: tail.record.header.id,
      text
    }
  }

  async internalDelete(
    recordId: string,
    countDecrement: boolean
  ): Promise<void> {
    const { index, order } = await this.parseRecordId(recordId)
    
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
    await this.backup(index)
    await this.engine.update(pos, flagForDeleted)
    this._recordCache.delete(`${index}/${order}`)
  }

  async pick(recordId: string): Promise<KlafPickResult> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.readLock((_lockId) => {
      lockId = _lockId
      return this.internalPick(recordId, true)
    }).finally(() => this.locker.readUnlock(lockId))
  }

  async put(text: string): Promise<string> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      return this.internalPut(text, true)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async update(recordId: string, text: string): Promise<string> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const information = await this.internalUpdate(recordId, text)
      return information.id
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async delete(recordId: string): Promise<void> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    await this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const { record } = await this.internalPick(recordId, false)
      await this.internalDelete(record.header.id, true)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async exists(recordId: string): Promise<boolean> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      return this.internalPick(recordId, false)
    })
    .then(() => true)
    .catch(() => false)
    .finally(() => this.locker.writeUnlock(lockId))
  }

  async close(handler: any): Promise<void> {
    if (this._closing) {
      throw KlafService.ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    this._closing = true
    let lockId: string
    await this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      return Promise.all([
        this.engine.close(),
        this.journal?.close(handler, this.path),
      ])
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  @DataJournal.Decorator.RequireInitialized
  async startBackup(handler: any): Promise<void> {
    const journal = this.journal!
    const metadata = await this.engine.read(0, KlafFormat.MetadataSize)
    await journal.reset(handler, metadata)
    await journal.startTransaction(handler, {
      working: 1,
      maximumPageIndex: this.metadata.index,
    })
  }

  @DataJournal.Decorator.RequireInitialized
  async endBackup(handler: any): Promise<void> {
    const journal = this.journal!
    const metadata = await this.engine.read(0, KlafFormat.MetadataSize)
    await journal.reset(handler, metadata)
    await journal.endTransaction(handler, {
      working: 0,
    })
  }
  
  @DataJournal.Decorator.RequireInitialized
  async backup(pageIndex: number): Promise<void> {
    const journal = this.journal!
    if (pageIndex === 0 || journal.isAlreadyBackup(pageIndex)) {
      return
    }
    const data = await this.get(pageIndex)
    await journal.backupPage(pageIndex, data)
  }

  @DataJournal.Decorator.RequireInitialized
  async restoreJournal(handler: any): Promise<void> {
    const journal = this.journal!
    await journal.restore(handler, {
      pageSize: this.pageSize,
      getPageIndex: (pageData) => {
        const raw = IterableView.Read(pageData, KlafFormat.PageIndexOffset, KlafFormat.PageIndexSize)
        const index = IntegerConverter.FromArray32(raw)
        return index
      },
      restoreMetadata: async (metadata) => {
        await this.engine.update(0, metadata)
      },
      restorePage: async (pageIndex, pageData) => {
        const position = this.pagePosition(pageIndex)
        await this.engine.update(position, pageData)
      },
      truncate: async (maximumPageIndex) => {
        const size = this.pagePosition(maximumPageIndex + 1)
        await this.engine.truncate(size)
      },
    })
  }
}
