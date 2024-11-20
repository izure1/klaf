import { CacheEntanglementAsync } from 'cache-entanglement'
import { Ryoiki } from 'ryoiki'

import { ErrorBuilder } from './ErrorBuilder'
import { TextConverter } from '../utils/TextConverter'
import { IntegerConverter } from '../utils/IntegerConverter'
import { CryptoHelper } from '../utils/CryptoHelper'
import { IterableView } from '../utils/IterableView'
import { DataEngine } from '../engine/DataEngine'

export type IPageHeader = {
  type: number
  index: number
  next: number
  count: number
  free: number
}

export type IRootHeader = {
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

export type PickResult = {
  page: IPageHeader
  record: NormalizedRecord
  order: number
}

export type NormalizedRecord = {
  rawRecord: number[],
  rawHeader: number[],
  rawPayload: number[],
  header: {
    id: string,
    aliasId: string,
    index: number,
    order: number,
    aliasIndex: number,
    aliasOrder: number,
    length: number,
    maxLength: number,
    deleted: number,
  },
  payload: string,
}

export interface KlafCreateOption {
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
   * This is the maximum data size a single page in the database can hold. The default is `1024`. If this value is too large or too small, it can affect performance.
   */
  payloadSize?: number
  /**
   * This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  overwrite?: boolean
}

export class Klaf {
  protected static readonly DB_VERSION                    = '8.0.0'
  protected static readonly DB_NAME                       = 'TissueRoll'
  protected static readonly RootValidStringOffset         = 0
  protected static readonly RootValidStringSize           = Klaf.DB_NAME.length
  protected static readonly RootMajorVersionOffset        = Klaf.RootValidStringOffset+Klaf.RootValidStringSize
  protected static readonly RootMajorVersionSize          = 1
  protected static readonly RootMinorVersionOffset        = Klaf.RootMajorVersionOffset+Klaf.RootMajorVersionSize
  protected static readonly RootMinorVersionSize          = 1
  protected static readonly RootPatchVersionOffset        = Klaf.RootMinorVersionOffset+Klaf.RootMinorVersionSize
  protected static readonly RootPatchVersionSize          = 1
  protected static readonly RootIndexOffset               = Klaf.RootPatchVersionOffset+Klaf.RootPatchVersionSize
  protected static readonly RootIndexSize                 = 4
  protected static readonly RootPayloadSizeOffset         = Klaf.RootIndexOffset+Klaf.RootIndexSize
  protected static readonly RootPayloadSizeSize           = 4
  protected static readonly RootTimestampOffset           = Klaf.RootPayloadSizeOffset+Klaf.RootPayloadSizeSize
  protected static readonly RootTimestampSize             = 8
  protected static readonly RootSecretKeyOffset           = Klaf.RootTimestampOffset+Klaf.RootTimestampSize
  protected static readonly RootSecretKeySize             = 16
  protected static readonly RootAutoIncrementOffset       = Klaf.RootSecretKeyOffset+Klaf.RootSecretKeySize
  protected static readonly RootAutoIncrementSize         = 8
  protected static readonly RootCountOffset               = Klaf.RootAutoIncrementOffset+Klaf.RootAutoIncrementSize
  protected static readonly RootCountSize                 = 4
  protected static readonly RootLastInternalIndexOffset   = Klaf.RootCountOffset+Klaf.RootCountSize
  protected static readonly RootLastInternalIndexSize     = 4

  protected static readonly RootChunkSize                 = 200
  protected static readonly HeaderSize                    = 100
  protected static readonly CellSize                      = 4

  protected static readonly PageTypeOffset                = 0
  protected static readonly PageTypeSize                  = 4
  protected static readonly PageIndexOffset               = Klaf.PageTypeOffset+Klaf.PageTypeSize
  protected static readonly PageIndexSize                 = 4
  protected static readonly PageNextOffset                = Klaf.PageIndexOffset+Klaf.PageIndexSize
  protected static readonly PageNextSize                  = 4
  protected static readonly PageCountOffset               = Klaf.PageNextOffset+Klaf.PageNextSize
  protected static readonly PageCountSize                 = 4
  protected static readonly PageFreeOffset                = Klaf.PageCountOffset+Klaf.PageCountSize
  protected static readonly PageFreeSize                  = 4

  protected static readonly RecordHeaderSize              = 40
  protected static readonly RecordHeaderIndexOffset       = 0
  protected static readonly RecordHeaderIndexSize         = 4
  protected static readonly RecordHeaderOrderOffset       = Klaf.RecordHeaderIndexOffset+Klaf.RecordHeaderIndexSize
  protected static readonly RecordHeaderOrderSize         = 4
  protected static readonly RecordHeaderLengthOffset      = Klaf.RecordHeaderOrderOffset+Klaf.RecordHeaderOrderSize
  protected static readonly RecordHeaderLengthSize        = 4
  protected static readonly RecordHeaderMaxLengthOffset   = Klaf.RecordHeaderLengthOffset+Klaf.RecordHeaderLengthSize
  protected static readonly RecordHeaderMaxLengthSize     = 4
  protected static readonly RecordHeaderDeletedOffset     = Klaf.RecordHeaderMaxLengthOffset+Klaf.RecordHeaderMaxLengthSize
  protected static readonly RecordHeaderDeletedSize       = 1
  protected static readonly RecordHeaderAliasIndexOffset  = Klaf.RecordHeaderDeletedOffset+Klaf.RecordHeaderDeletedSize
  protected static readonly RecordHeaderAliasIndexSize    = 4
  protected static readonly RecordHeaderAliasOrderOffset  = Klaf.RecordHeaderAliasIndexOffset+Klaf.RecordHeaderAliasIndexSize
  protected static readonly RecordHeaderAliasOrderSize    = 4


  protected static readonly UnknownType                   = 0
  protected static readonly InternalType                  = 1
  protected static readonly OverflowType                  = 2
  protected static readonly SystemReservedType            = 3

  /**
   * It creates a new database file.
   * @param option The database creation options.
   */
  static async Create(option: KlafCreateOption): Promise<Klaf> {
    const {
      path,
      engine,
      payloadSize = 1024,
      overwrite = false
    } = option
    // create metadata
    const metadata = Klaf.CreateIterable(Klaf.RootChunkSize, 0)
    const {
      DB_VERSION,
      DB_NAME,
      RootValidStringOffset,
      RootMajorVersionOffset,
      RootMinorVersionOffset,
      RootPatchVersionOffset,
      RootPayloadSizeOffset,
      RootTimestampOffset,
      RootSecretKeyOffset,
      RootSecretKeySize,
      RootAutoIncrementOffset,
      RootCountOffset,
      RootLastInternalIndexOffset,
    } = Klaf
    const [
      majorVersion,
      minorVersion,
      patchVersion
    ] = DB_VERSION.split('.')
    const secretKey = CryptoHelper.RandomBytes(RootSecretKeySize)
    IterableView.Update(metadata, RootValidStringOffset,        TextConverter.ToArray(DB_NAME))
    IterableView.Update(metadata, RootMajorVersionOffset,       IntegerConverter.ToArray8(Number(majorVersion)))
    IterableView.Update(metadata, RootMinorVersionOffset,       IntegerConverter.ToArray8(Number(minorVersion)))
    IterableView.Update(metadata, RootPatchVersionOffset,       IntegerConverter.ToArray8(Number(patchVersion)))
    IterableView.Update(metadata, RootPayloadSizeOffset,        IntegerConverter.ToArray32(payloadSize))
    IterableView.Update(metadata, RootTimestampOffset,          IntegerConverter.ToArray64(BigInt(Date.now())))
    IterableView.Update(metadata, RootSecretKeyOffset,          Array.from(secretKey))
    IterableView.Update(metadata, RootAutoIncrementOffset,      IntegerConverter.ToArray64(0n))
    IterableView.Update(metadata, RootCountOffset,              IntegerConverter.ToArray32(0))
    IterableView.Update(metadata, RootLastInternalIndexOffset,  IntegerConverter.ToArray32(0))

    await engine.boot(path)

    if ((await engine.exists(path)) && !overwrite) {
      throw ErrorBuilder.ERR_DB_ALREADY_EXISTS(path)
    }
    await engine.create(path, metadata)

    const database = await Klaf.Open({ path, engine })
    await database._addEmptyPage({ type: Klaf.InternalType }, true)
    return database
  }

  /**
   * It opens or creates a database file at the specified path. 
   * If `option.payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `1024`.
   * @param option The database creation options.
   */
  static async Open(option: KlafCreateOption): Promise<Klaf> {
    const {
      path,
      engine,
      payloadSize = 1024
    } = option

    await engine.boot(path)

    if (!(await engine.exists(path))) {
      if (!payloadSize) {
        throw ErrorBuilder.ERR_DB_NO_EXISTS(path)
      }
      return await Klaf.Create({ path, engine, payloadSize })
    }

    await engine.open(path)
    if (!(await Klaf.CheckDBVerify(engine))) {
      await engine.close()
      throw ErrorBuilder.ERR_DB_INVALID(path)
    }

    const metadata  = await Klaf.ParseRootChunk(engine)
    const secretKey = Uint8Array.from(IntegerConverter.ToArray128(metadata.secretKey))
    
    return new Klaf(engine, metadata, secretKey)
  }

  protected static async ParseRootChunk(engine: DataEngine): Promise<IRootHeader> {
    const rHeader = await engine.read(0, Klaf.RootChunkSize)
    const {
      RootMajorVersionOffset,
      RootMajorVersionSize,
      RootMinorVersionOffset,
      RootMinorVersionSize,
      RootPatchVersionOffset,
      RootPatchVersionSize,
      RootIndexOffset,
      RootIndexSize,
      RootPayloadSizeOffset,
      RootPayloadSizeSize,
      RootTimestampOffset,
      RootTimestampSize,
      RootSecretKeyOffset,
      RootSecretKeySize,
      RootAutoIncrementOffset,
      RootAutoIncrementSize,
      RootCountOffset,
      RootCountSize,
      RootLastInternalIndexOffset,
      RootLastInternalIndexSize,
    } = Klaf
    const majorVersion  = IntegerConverter.FromArray8(
      IterableView.Read(rHeader, RootMajorVersionOffset, RootMajorVersionSize)
    )
    const minorVersion  = IntegerConverter.FromArray8(
      IterableView.Read(rHeader, RootMinorVersionOffset, RootMinorVersionSize)
    )
    const patchVersion  = IntegerConverter.FromArray8(
      IterableView.Read(rHeader, RootPatchVersionOffset, RootPatchVersionSize)
    )
    const index         = IntegerConverter.FromArray32(
      IterableView.Read(rHeader, RootIndexOffset, RootIndexSize)
    )
    const payloadSize   = IntegerConverter.FromArray32(
      IterableView.Read(rHeader, RootPayloadSizeOffset, RootPayloadSizeSize)
    )
    const timestamp     = IntegerConverter.FromArray64(
      IterableView.Read(rHeader, RootTimestampOffset, RootTimestampSize)
    )
    const secretKey     = IntegerConverter.FromArray128(
      IterableView.Read(rHeader, RootSecretKeyOffset, RootSecretKeySize)
    )
    const autoIncrement = IntegerConverter.FromArray64(
      IterableView.Read(rHeader, RootAutoIncrementOffset, RootAutoIncrementSize)
    )
    const count = IntegerConverter.FromArray32(
      IterableView.Read(rHeader, RootCountOffset, RootCountSize)
    )
    const lastInternalIndex = IntegerConverter.FromArray32(
      IterableView.Read(rHeader, RootLastInternalIndexOffset, RootLastInternalIndexSize)
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

  protected static CreateIterable(len: number, fill: number): number[] {
    return new Array(len).fill(fill)
  }

  protected static async CheckDBVerify(engine: DataEngine): Promise<boolean> {
    const chunk = await engine.read(
      Klaf.RootValidStringOffset,
      Klaf.RootValidStringSize
    )
    const text = TextConverter.FromArray(chunk)
    return text === Klaf.DB_NAME
  }

  protected static async CallAddEmptyPage(db: Klaf, head: Partial<IPageHeader>, incrementInternalIndex: boolean): Promise<number> {
    return await db._addEmptyPage(head, incrementInternalIndex)
  }

  protected static async CallSetPage(db: Klaf, head: Partial<IPageHeader>, data: number[]): Promise<void> {
    const newHeadRaw = db._createEmptyHeader(head)
    const newHead = db._normalizeHeader(newHeadRaw)
    await db._setPage(newHead, data)
  }

  protected static async CallInternalPut(db: Klaf, data: number[], autoIncrement: boolean): Promise<string> {
    return await db.callInternalPut(data, autoIncrement)
  }

  protected static async CallInternalUpdate(db: Klaf, id: string, data: string): Promise<{
    id: string
    data: string
  }> {
    return await db.callInternalUpdate(id, data)
  }

  protected static async CallInternalDelete(db: Klaf, id: string, countDecrement: boolean): Promise<void> {
    return await db.callInternalDelete(id, countDecrement)
  }

  readonly engine: DataEngine
  protected readonly chunkSize: number
  protected readonly maximumFreeSize: number
  protected readonly headerSize: number
  protected readonly payloadSize: number
  protected readonly secretKey: Uint8Array
  protected readonly locker: Ryoiki
  protected closing: boolean
  private readonly _encodingIdCache: ReturnType<Klaf['_createEncodingIdCache']>
  private readonly _decodingIdCache: ReturnType<Klaf['_createDecodingIdCache']>
  private readonly _decodingRecordCache: ReturnType<Klaf['_createDecodingRecordCache']>
  private readonly _pageHeaderCache: ReturnType<Klaf['_createPageHeaderCache']>
  private readonly _recordPositionCache: ReturnType<Klaf['_createRecordPositionCache']>
  private readonly _recordCache: ReturnType<Klaf['_createRecordCache']>
  private readonly _metadata: IRootHeader

  protected constructor(engine: DataEngine, metadata: IRootHeader, secretKey: Uint8Array) {
    if (metadata.payloadSize < Klaf.CellSize) {
      engine.close()
      throw new Error(`The payload size is too small. It must be greater than ${Klaf.CellSize}. But got a ${metadata.payloadSize}`)
    }
    this.chunkSize        = Klaf.HeaderSize+metadata.payloadSize
    this.headerSize       = Klaf.HeaderSize
    this.maximumFreeSize  = metadata.payloadSize-Klaf.CellSize
    this.payloadSize      = metadata.payloadSize
    this.secretKey        = secretKey
    this.engine           = engine
    this._metadata        = metadata
    this.closing          = false
    
    this.locker = new Ryoiki()
    this._encodingIdCache = this._createEncodingIdCache()
    this._decodingIdCache = this._createDecodingIdCache()
    this._decodingRecordCache = this._createDecodingRecordCache()
    this._pageHeaderCache = this._createPageHeaderCache()
    this._recordPositionCache = this._createRecordPositionCache()
    this._recordCache = this._createRecordCache(
      this._recordPositionCache,
      this._pageHeaderCache
    )
  }

  get metadata(): IRootHeader {
    return { ...this._metadata }
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
          Klaf.RecordHeaderIndexOffset,
          Klaf.RecordHeaderIndexSize
        )
      )
      const order = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          Klaf.RecordHeaderOrderOffset,
          Klaf.RecordHeaderOrderSize
        )
      )
      const length = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          Klaf.RecordHeaderLengthOffset,
          Klaf.RecordHeaderLengthSize
        )
      )
      const maxLength = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          Klaf.RecordHeaderMaxLengthOffset,
          Klaf.RecordHeaderMaxLengthSize
        )
      )
      const deleted = IntegerConverter.FromArray8(
        IterableView.Read(
          rawHeader,
          Klaf.RecordHeaderDeletedOffset,
          Klaf.RecordHeaderDeletedSize
        )
      )
      const aliasIndex = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          Klaf.RecordHeaderAliasIndexOffset,
          Klaf.RecordHeaderAliasIndexSize
        )
      )
      const aliasOrder = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          Klaf.RecordHeaderAliasOrderOffset,
          Klaf.RecordHeaderAliasOrderSize
        )
      )
  
      const id = await this._recordId(index, order)
      const aliasId = await this._recordId(aliasIndex, aliasOrder)

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
      const page    = await this._get(index)
      const header  = IterableView.Read(page, 0, this.headerSize)
      return header
    })
  }

  private _createRecordPositionCache() {
    return new CacheEntanglementAsync(async (key, state, index: number, order: number) => {
      const payloadPos    = this._pagePayloadPosition(index)
      const cellPos       = this._cellPosition(index, order)
      const cellValue     = await this.engine.read(cellPos, Klaf.CellSize)
      const recordOffset  = IntegerConverter.FromArray32(cellValue)
      return payloadPos+recordOffset
    })
  }

  private _createRecordCache(
    recordPosition: ReturnType<Klaf['_createRecordPositionCache']>,
    pageHeader: ReturnType<Klaf['_createPageHeaderCache']>
  ) {
    return new CacheEntanglementAsync(async (key, {
      recordPosition,
      pageHeader,
    }, index: number, order: number) => {
      const pos = recordPosition.raw
      const rHeader = await this.engine.read(pos, Klaf.RecordHeaderSize)
      const payloadPos = Klaf.RecordHeaderSize+pos
      const payloadLength = IntegerConverter.FromArray32(
        IterableView.Read(
          rHeader,
          Klaf.RecordHeaderLengthOffset,
          Klaf.RecordHeaderLengthSize
        )
      )
  
      let header = this._normalizeHeader(pageHeader.raw)
      
      // internal 페이지일 경우
      if (!header.next) {
        const rPayload = await this.engine.read(payloadPos, payloadLength)
        return rHeader.concat(rPayload)
      }
  
      // overflow 페이지로 나뉘어져 있을 경우
      const record = []
      let remain = payloadLength+Klaf.RecordHeaderSize
  
      while (remain > 0) {
        const pos   = this._pagePayloadPosition(header.index)
        const size  = Math.min(this.maximumFreeSize, Math.abs(remain))
        const chunk = await this.engine.read(pos, size)
        record.push(...chunk)
  
        if (!header.next) {
          break
        }
        header = this._normalizeHeader(await this._getHeader(header.next))
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

  private _createEmptyHeader({
    type = 0,
    index = 0,
    next = 0,
    count = 0,
    free = this.payloadSize
  }: Partial<IPageHeader> = {}): number[] {
    const header = Klaf.CreateIterable(this.headerSize, 0)

    const rType  = IntegerConverter.ToArray32(type)
    const rIndex = IntegerConverter.ToArray32(index)
    const rNext  = IntegerConverter.ToArray32(next)
    const rCount = IntegerConverter.ToArray32(count)
    const rFree  = IntegerConverter.ToArray32(free)
    IterableView.Update(header, Klaf.PageTypeOffset, rType)
    IterableView.Update(header, Klaf.PageIndexOffset, rIndex)
    IterableView.Update(header, Klaf.PageNextOffset, rNext)
    IterableView.Update(header, Klaf.PageCountOffset, rCount)
    IterableView.Update(header, Klaf.PageFreeOffset, rFree)

    return header
  }

  private _createEmptyPayload(): number[] {
    return Klaf.CreateIterable(this.payloadSize, 0)
  }
  
  private _createEmptyPage(header: Partial<IPageHeader>): number[] {
    return this._createEmptyHeader(header).concat(this._createEmptyPayload())
  }

  private async _addEmptyPage(header: Partial<IPageHeader>, incrementInternalIndex: boolean): Promise<number> {
    // update root
    let { index, lastInternalIndex } = this._metadata
    index++
    this._metadata.index = index
    await this.engine.update(
      Klaf.RootIndexOffset,
      IntegerConverter.ToArray32(index)
    )

    // extend payload
    const page = this._createEmptyPage(Object.assign({}, header, { index }))
    await this.engine.append(page)

    if (header.type === Klaf.InternalType && incrementInternalIndex) {
      lastInternalIndex++
      this._metadata.lastInternalIndex = lastInternalIndex
      await this.engine.update(
        Klaf.RootLastInternalIndexOffset,
        IntegerConverter.ToArray32(lastInternalIndex)
      )
    }

    return index
  }

  private _pagePosition(index: number): number {
    return Klaf.RootChunkSize+(this.chunkSize*(index-1))
  }

  private _pagePayloadPosition(index: number): number {
    return this._pagePosition(index)+this.headerSize
  }

  private _cellPosition(index: number, order: number): number {
    const pagePos = this._pagePosition(index)
    const endOfPage = pagePos+this.chunkSize
    return endOfPage-(Klaf.CellSize*order)
  }

  private async _recordPosition(index: number, order: number): Promise<number> {
    return (
      await this._recordPositionCache.cache(
        `${index}/${order}`,
        index,
        order
      )
    ).raw
  }

  private async _get(index: number): Promise<number[]> {
    const start = this._pagePosition(index)
    return await this.engine.read(start, this.chunkSize)
  }

  private async _recordId(index: number, order: number): Promise<string> {
    return (
      await this._encodingIdCache.cache(
        `${index}/${order}`,
        index,
        order
      )
    ).raw
  }

  private async _normalizeRecordId(recordId: string): Promise<{
    index: number
    order: number
  }> {
    return (
      await this._decodingIdCache.cache(recordId)
    ).clone('object-shallow-copy')
  }

  private async _rawRecordId(recordId: string): Promise<number[]> {
    const { index, order } = await this._normalizeRecordId(recordId)
    return IntegerConverter.ToArray32(index).concat(
      IntegerConverter.ToArray32(order)
    )
  }

  private async _createRecord(id: string, data: number[]): Promise<number[]> {
    const rawId = await this._rawRecordId(id)
    const length = IntegerConverter.ToArray32(data.length)

    const recordHeader = Klaf.CreateIterable(Klaf.RecordHeaderSize, 0)
    // insert record index
    IterableView.Update(recordHeader, Klaf.RecordHeaderIndexOffset, rawId)
    // insert record length
    IterableView.Update(recordHeader, Klaf.RecordHeaderLengthOffset, length)
    // insert record max length
    IterableView.Update(recordHeader, Klaf.RecordHeaderMaxLengthOffset, length)
    
    const record = recordHeader.concat(data)
    return record
  }

  private _createCell(recordOffset: number): number[] {
    return IntegerConverter.ToArray32(recordOffset)
  }

  private async _getRecord(index: number, order: number): Promise<number[]> {
    return (
      await this._recordCache.cache(
        `${index}/${order}`,
        index,
        order
      )
    ).clone('array-shallow-copy') as number[]
  }

  private async _normalizeRecord(record: number[]): Promise<NormalizedRecord> {
    const rawHeader   = IterableView.Read(record, 0, Klaf.RecordHeaderSize)
    const rawPayload  = IterableView.Read(record, Klaf.RecordHeaderSize)

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

  private async _getHeader(index: number): Promise<number[]> {
    return (
      await this._pageHeaderCache.cache(`${index}`, index)
    ).clone('array-shallow-copy') as number[]
  }

  private _normalizeHeader(header: number[]): IPageHeader {
    const type  = IntegerConverter.FromArray32(
      IterableView.Read(header, Klaf.PageTypeOffset, Klaf.PageTypeSize)
    )
    const index = IntegerConverter.FromArray32(
      IterableView.Read(header, Klaf.PageIndexOffset, Klaf.PageIndexSize)
    )
    const next  = IntegerConverter.FromArray32(
      IterableView.Read(header, Klaf.PageNextOffset, Klaf.PageNextSize)
    )
    const count = IntegerConverter.FromArray32(
      IterableView.Read(header, Klaf.PageCountOffset, Klaf.PageCountSize)
    )
    const free  = IntegerConverter.FromArray32(
      IterableView.Read(header, Klaf.PageFreeOffset, Klaf.PageFreeSize)
    )
    return {
      type,
      index,
      next,
      count,
      free,
    }
  }

  private async _getHeadPageIndex(index: number): Promise<number> {
    if (index <= 1) {
      return 1
    }
    while (true) {
      const { type } = this._normalizeHeader(await this._getHeader(index))
      if (type !== Klaf.OverflowType) {
        break
      }
      index--
    }
    return index
  }

  protected async pickRecord(recordId: string, recursiveAlias: boolean): Promise<PickResult> {
    const { index, order } = await this._normalizeRecordId(recordId)
    const page    = this._normalizeHeader(await this._getHeader(index))
    const raw     = await this._getRecord(index, order)
    const record  = await this._normalizeRecord(raw)
    
    if (
      recursiveAlias &&
      record.header.aliasIndex &&
      record.header.aliasOrder
    ) {
      return await this.pickRecord(record.header.aliasId, recursiveAlias)
    }

    if (record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(recordId)
    }

    return {
      page,
      record,
      order
    }
  }

  /**
   * It takes a page index as a parameter and returns a list of all records recorded on that page.  
   * The page index should be within the range of `1` to `instance.metadata.index`.
   * @param index The page index.
   */
  async getRecords(index: number): Promise<NormalizedRecord[]> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.readLock(async (_lockId) => {
      lockId = _lockId
      const headIndex = await this._getHeadPageIndex(index)
      const header = this._normalizeHeader(await this._getHeader(headIndex))
  
      const records = []
      for (let i = 0; i < header.count; i++) {
        const order = i+1
        const rawRecord = await this._getRecord(header.index, order)
        const record = await this._normalizeRecord(rawRecord)
        records.push(record)
      }
      return records
    }).finally(() => this.locker.readUnlock(lockId))
  }

  /**
   * Get record from database with a id.  
   * Don't pass an incorrect record ID. This does not ensure the validity of the record.
   * Use the `exists` method to validate the record id.
   * @param recordId The record id what you want pick.
   */
  async pick(recordId: string): Promise<PickResult> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.readLock((_lockId) => {
      lockId = _lockId
      return this.pickRecord(recordId, true)
    }).finally(() => this.locker.readUnlock(lockId))
  }

  private async _setPageHeader(header: IPageHeader): Promise<void> {
    const pos = this._pagePosition(header.index)
    const rHeader = this._createEmptyHeader(header)

    await this.engine.update(pos, rHeader)
    this._pageHeaderCache.delete(`${header.index}`)
  }

  private async _setPagePayload(index: number, order: number, record: number[]): Promise<void> {
    const payloadPos  = this._pagePayloadPosition(index)
    const prevOrder   = order-1

    let recordPos
    if (order > 1) {
      const prevRecord  = await this._normalizeRecord(await this._getRecord(index, prevOrder))
      recordPos         = await this._recordPosition(index, prevOrder)+prevRecord.rawRecord.length
    }
    else {
      recordPos = payloadPos
    }

    const cellPos = this._cellPosition(index, order)
    const cell    = this._createCell(recordPos-payloadPos)

    await this.engine.update(recordPos, record)
    await this.engine.update(cellPos, cell)

    this._recordCache.delete(`${index}/${order}`)
  }

  private async _setPage(header: IPageHeader, data: number[]): Promise<string> {
    const recordId  = await this._recordId(header.index, header.count+1)
    const record    = await this._createRecord(recordId, data)

    await this._setPagePayload(header.index, header.count+1, record)
    
    const usage = Klaf.RecordHeaderSize+Klaf.CellSize+data.length
    header.count += 1
    header.free -= usage

    await this._setPageHeader(header)

    return recordId
  }

  protected async callInternalPut(data: number[], autoIncrement: boolean): Promise<string> {
    const lastInternalIndex = this._metadata.lastInternalIndex
    let index   = lastInternalIndex
    let header  = this._normalizeHeader(await this._getHeader(index))

    if (autoIncrement) {
      let { autoIncrement: increment, count } = this._metadata
      this._metadata.autoIncrement = increment+1n
      await this.engine.update(
        Klaf.RootAutoIncrementOffset,
        IntegerConverter.ToArray64(increment+1n)
      )
      this._metadata.count = count+1
      await this.engine.update(
        Klaf.RootCountOffset,
        IntegerConverter.ToArray32(count+1)
      )
    }
    
    // 1. 이전 페이지의 공간이 넉넉하여 단일 페이지에 넣을 수 있는 경우
    // 이전 페이지에 넣기
    const recordSize  = Klaf.RecordHeaderSize+data.length
    const recordUsage = Klaf.CellSize+recordSize
    if (header.free >= recordUsage) {
      const recordId = await this._setPage(header, data)
      return recordId
    }
    
    // 2. 이전 페이지의 공간이 넉넉하지 않을 경우
    
    // 새 페이지를 추가해야 합니다.
    // 하지만 이전 페이지가 사용되지 않은 채 공백으로 남아 있을 수 있습니다.
    // 따라서 사용되었을 경우에만 생성되어야 합니다.
    if (header.count) {
      index = await this._addEmptyPage({ type: Klaf.InternalType }, true)
      header = this._normalizeHeader(await this._getHeader(index))
    }
    
    const count = Math.ceil(recordSize/this.maximumFreeSize)
    
    // 한 페이지에 삽입이 가능할 경우, Internal 타입으로 생성되어야 하며, 삽입 후 종료되어야 합니다.
    if (count === 1) {
      return await this._setPage(header, data)
    }

    let isInternalIndexDeferred = false
    if (count > 1 && !header.count) {
      isInternalIndexDeferred = true
    }
    
    // Overflow 타입의 페이지입니다.
    // 다음 삽입 시 무조건 새로운 페이지를 만들어야하므로, free, count 값이 고정됩니다.
    const recordId  = await this._recordId(header.index, header.count+1)
    const record    = await this._createRecord(recordId, data)
    const headIndex = index

    for (let i = 0; i < count; i++) {
      const last = i === count-1
      const start = i*this.maximumFreeSize
      const chunk = IterableView.Read(record, start, this.maximumFreeSize)
      
      const currentHeader = this._normalizeHeader(await this._getHeader(index))
      await this._setPagePayload(currentHeader.index, currentHeader.count+1, chunk)
      
      if (!last) {
        index = await this._addEmptyPage({ type: Klaf.OverflowType }, false)
      }
      currentHeader.type = Klaf.OverflowType
      currentHeader.free = 0
      currentHeader.next = index
      currentHeader.count += 1
      if (last) {
        currentHeader.next = 0
      }
      await this._setPageHeader(currentHeader)
    }
    const headHeader = this._normalizeHeader(await this._getHeader(headIndex))
    headHeader.type = Klaf.InternalType
    headHeader.count = 1
    headHeader.free = 0
    await this._setPageHeader(headHeader)

    if (isInternalIndexDeferred) {
      this._metadata.lastInternalIndex = index
      await this.engine.update(
        Klaf.RootLastInternalIndexOffset,
        IntegerConverter.ToArray32(index)
      )
      await this._addEmptyPage({ type: Klaf.InternalType }, true)
    }

    return recordId
  }

  /**
   * You store data in the database and receive a record ID for the saved data.
   * This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
   * @param data The data string what you want store.
   * @returns The record id.
   */
  async put(data: string): Promise<string> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const rData = TextConverter.ToArray(data)
      return this.callInternalPut(rData, true)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  private async _overwriteInternalRecord(
    index: number,
    order: number,
    record: number[]
  ): Promise<number> {
    await this.engine.update(await this._recordPosition(index, order), record)
    return index
  }

  private async _overwriteOverflowedRecord(
    index: number,
    record: number[]
  ): Promise<number> {
    while (index) {
      const size = Math.min(this.maximumFreeSize, record.length)
      const chunk = IterableView.Read(record, 0, size)
      
      await this.engine.update(this._pagePayloadPosition(index), chunk)
      record = record.slice(size)
      
      if (!record.length) {
        this._recordCache.delete(`${index}/1`)
        return index
      }

      const rHeader = await this._getHeader(index)
      const header = this._normalizeHeader(rHeader)
      let next = header.next
      if (!next) {
        next = await this._addEmptyPage({
          type: Klaf.OverflowType,
          count: 1,
          free: 0
        }, false)
        IterableView.Update(
          rHeader,
          Klaf.PageNextOffset,
          IntegerConverter.ToArray32(next)
        )
        await this.engine.update(
          this._pagePosition(index),
          rHeader
        )
      }
      this._pageHeaderCache.delete(`${index}`)
      this._recordCache.delete(`${index}/1`)
      index = next
    }

    return index
  }

  private async _isInternalRecord(record: number[]): Promise<boolean> {
    const index = (await this._normalizeRecord(record)).header.index
    const page =  this._normalizeHeader(await this._getHeader(index))
    return !page.next
  }

  protected async callInternalUpdate(id: string, data: string): Promise<{
    id: string
    data: string
  }> {
    const payload = TextConverter.ToArray(data)
    const head = await this.pickRecord(id, false)
    const tail = await this.pickRecord(id, true)
    
    if (head.record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(id)
    }

    const record = await this._createRecord(tail.record.header.id, payload)

    if (tail.record.rawRecord.length < record.length) {
      if ((await this._isInternalRecord(tail.record.rawRecord))) {
        const id = await this.callInternalPut(payload, false)
        const { index, order } = await this._normalizeRecordId(id)
        const headClone = IterableView.Copy(head.record.rawRecord)
        IterableView.Update(
          headClone,
          Klaf.RecordHeaderAliasIndexOffset,
          IntegerConverter.ToArray32(index)
        )
        IterableView.Update(
          headClone,
          Klaf.RecordHeaderAliasOrderOffset,
          IntegerConverter.ToArray32(order)
        )
        await this.engine.update(
          await this._recordPosition(
            head.record.header.index,
            head.record.header.order
          ),
          headClone
        )
        if (head.record.header.id !== tail.record.header.id) {
          await this.callInternalDelete(tail.record.header.id, false)
        }
        this._recordCache.delete(`${head.record.header.index}/${head.record.header.order}`)
        this._recordCache.delete(`${tail.record.header.index}/${tail.record.header.order}`)
        return {
          id,
          data
        }
      }
      else {
        await this._overwriteOverflowedRecord(tail.record.header.index, record)
      }
    }
    else {
      IterableView.Update(
        record,
        Klaf.RecordHeaderMaxLengthOffset,
        IntegerConverter.ToArray32(tail.record.header.maxLength)
      )
      if ((await this._isInternalRecord(tail.record.rawRecord))) {
        await this._overwriteInternalRecord(
          tail.record.header.index,
          tail.record.header.order,
          record
        )
      }
      else {
        await this._overwriteOverflowedRecord(tail.record.header.index, record)
      }
    }
    return {
      id: tail.record.header.id,
      data
    }
  }

  /**
   * You update an existing record.
   * 
   * If the inserted data is shorter than the previous data, the existing record is updated.
   * Conversely, if the new data is longer, a new record is created.
   * 
   * These newly created records are called `alias record`, and when you call the `pick` method using the current record ID, the alias record is retrieved.
   * If an alias record existed previously, the existing alias record is deleted and can no longer be used.
   * @param recordId The record id what you want update.
   * @param data The data string what you want update.
   * @returns The record id.
   */
  async update(recordId: string, data: string): Promise<string> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const information = await this.callInternalUpdate(recordId, data)
      return information.id
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  protected async callInternalDelete(
    recordId: string,
    countDecrement: boolean
  ): Promise<void> {
    const { index, order } = await this._normalizeRecordId(recordId)
    
    const pos = await this._recordPosition(index, order)+Klaf.RecordHeaderDeletedOffset
    const buf = IntegerConverter.ToArray8(1)
    if (countDecrement) {
      const { count } = this._metadata
      this._metadata.count = count-1
      await this.engine.update(
        Klaf.RootCountOffset,
        IntegerConverter.ToArray32(count-1)
      )
    }
    await this.engine.update(pos, buf)
    this._recordCache.delete(`${index}/${order}`)
  }

  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  async delete(recordId: string): Promise<void> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    await this.locker.writeLock(async (_lockId) => {
      lockId = _lockId
      const { record } = await this.pickRecord(recordId, false)
      await this.callInternalDelete(record.header.id, true)
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  /**
   * It returns whether the record exists in the database.
   * If it has been deleted or has an invalid record ID, it returns `false`.
   * @param recordId The record id what you want verify.
   */
  async exists(recordId: string): Promise<boolean> {
    if (this.closing) {
      throw ErrorBuilder.ERR_DATABASE_CLOSING()
    }
    let lockId: string
    return this.locker
      .readLock((_lockId) => {
        lockId = _lockId
        return this.pickRecord(recordId, false)
      })
      .then(() => true)
      .catch(() => false)
      .finally(() => this.locker.readUnlock(lockId))
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
    await this.locker.writeLock((_lockId) => {
      lockId = _lockId
      return this.engine.close()
    }).finally(() => this.locker.writeUnlock(lockId))
  }
}
