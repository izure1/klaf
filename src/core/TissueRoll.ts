import type { IHookallSync } from 'hookall'
import { useHookallSync } from 'hookall'
import { CacheEntanglementSync } from 'cache-entanglement'

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

export type IHookerRecordInformation = { id: string, data: string }
export type IHooker = {
  put: (data: string) => string
  update: (record: IHookerRecordInformation) => IHookerRecordInformation
  delete: (recordId: string) => string
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

export interface TissueRollCreateOption {
  /**
   * This is the path where the database file will be created.
   */
  path: string
  /**
   * The engine that determines how the database will function.
   * By default, it supports `FileSystem`, `InMemory`, and `WebWorker`. You can import engine modules from `tissue-roll/engine/~` to use them.
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

export class TissueRoll {
  protected static readonly DB_VERSION                    = '6.0.0'
  protected static readonly DB_NAME                       = 'TissueRoll'
  protected static readonly RootValidStringOffset         = 0
  protected static readonly RootValidStringSize           = TissueRoll.DB_NAME.length
  protected static readonly RootMajorVersionOffset        = TissueRoll.RootValidStringOffset+TissueRoll.RootValidStringSize
  protected static readonly RootMajorVersionSize          = 1
  protected static readonly RootMinorVersionOffset        = TissueRoll.RootMajorVersionOffset+TissueRoll.RootMajorVersionSize
  protected static readonly RootMinorVersionSize          = 1
  protected static readonly RootPatchVersionOffset        = TissueRoll.RootMinorVersionOffset+TissueRoll.RootMinorVersionSize
  protected static readonly RootPatchVersionSize          = 1
  protected static readonly RootIndexOffset               = TissueRoll.RootPatchVersionOffset+TissueRoll.RootPatchVersionSize
  protected static readonly RootIndexSize                 = 4
  protected static readonly RootPayloadSizeOffset         = TissueRoll.RootIndexOffset+TissueRoll.RootIndexSize
  protected static readonly RootPayloadSizeSize           = 4
  protected static readonly RootTimestampOffset           = TissueRoll.RootPayloadSizeOffset+TissueRoll.RootPayloadSizeSize
  protected static readonly RootTimestampSize             = 8
  protected static readonly RootSecretKeyOffset           = TissueRoll.RootTimestampOffset+TissueRoll.RootTimestampSize
  protected static readonly RootSecretKeySize             = 16
  protected static readonly RootAutoIncrementOffset       = TissueRoll.RootSecretKeyOffset+TissueRoll.RootSecretKeySize
  protected static readonly RootAutoIncrementSize         = 8
  protected static readonly RootCountOffset               = TissueRoll.RootAutoIncrementOffset+TissueRoll.RootAutoIncrementSize
  protected static readonly RootCountSize                 = 4
  protected static readonly RootLastInternalIndexOffset   = TissueRoll.RootCountOffset+TissueRoll.RootCountSize
  protected static readonly RootLastInternalIndexSize     = 4

  protected static readonly RootChunkSize                 = 200
  protected static readonly HeaderSize                    = 100
  protected static readonly CellSize                      = 4

  protected static readonly PageTypeOffset                = 0
  protected static readonly PageTypeSize                  = 4
  protected static readonly PageIndexOffset               = TissueRoll.PageTypeOffset+TissueRoll.PageTypeSize
  protected static readonly PageIndexSize                 = 4
  protected static readonly PageNextOffset                = TissueRoll.PageIndexOffset+TissueRoll.PageIndexSize
  protected static readonly PageNextSize                  = 4
  protected static readonly PageCountOffset               = TissueRoll.PageNextOffset+TissueRoll.PageNextSize
  protected static readonly PageCountSize                 = 4
  protected static readonly PageFreeOffset                = TissueRoll.PageCountOffset+TissueRoll.PageCountSize
  protected static readonly PageFreeSize                  = 4

  protected static readonly RecordHeaderSize              = 40
  protected static readonly RecordHeaderIndexOffset       = 0
  protected static readonly RecordHeaderIndexSize         = 4
  protected static readonly RecordHeaderOrderOffset       = TissueRoll.RecordHeaderIndexOffset+TissueRoll.RecordHeaderIndexSize
  protected static readonly RecordHeaderOrderSize         = 4
  protected static readonly RecordHeaderLengthOffset      = TissueRoll.RecordHeaderOrderOffset+TissueRoll.RecordHeaderOrderSize
  protected static readonly RecordHeaderLengthSize        = 4
  protected static readonly RecordHeaderMaxLengthOffset   = TissueRoll.RecordHeaderLengthOffset+TissueRoll.RecordHeaderLengthSize
  protected static readonly RecordHeaderMaxLengthSize     = 4
  protected static readonly RecordHeaderDeletedOffset     = TissueRoll.RecordHeaderMaxLengthOffset+TissueRoll.RecordHeaderMaxLengthSize
  protected static readonly RecordHeaderDeletedSize       = 1
  protected static readonly RecordHeaderAliasIndexOffset  = TissueRoll.RecordHeaderDeletedOffset+TissueRoll.RecordHeaderDeletedSize
  protected static readonly RecordHeaderAliasIndexSize    = 4
  protected static readonly RecordHeaderAliasOrderOffset  = TissueRoll.RecordHeaderAliasIndexOffset+TissueRoll.RecordHeaderAliasIndexSize
  protected static readonly RecordHeaderAliasOrderSize    = 4


  protected static readonly UnknownType                   = 0
  protected static readonly InternalType                  = 1
  protected static readonly OverflowType                  = 2
  protected static readonly SystemReservedType            = 3

  /**
   * It creates a new database file.
   * @param option The database creation options.
   */
  static async Create(option: TissueRollCreateOption): Promise<TissueRoll> {
    const {
      path,
      engine,
      payloadSize = 1024,
      overwrite = false
    } = option
    // create root
    const root = TissueRoll.CreateIterable(TissueRoll.RootChunkSize, 0)
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
    } = TissueRoll
    const [
      majorVersion,
      minorVersion,
      patchVersion
    ] = DB_VERSION.split('.')
    const secretKey = CryptoHelper.RandomBytes(RootSecretKeySize)
    IterableView.Update(root, RootValidStringOffset,        TextConverter.ToArray(DB_NAME))
    IterableView.Update(root, RootMajorVersionOffset,       IntegerConverter.ToArray8(Number(majorVersion)))
    IterableView.Update(root, RootMinorVersionOffset,       IntegerConverter.ToArray8(Number(minorVersion)))
    IterableView.Update(root, RootPatchVersionOffset,       IntegerConverter.ToArray8(Number(patchVersion)))
    IterableView.Update(root, RootPayloadSizeOffset,        IntegerConverter.ToArray32(payloadSize))
    IterableView.Update(root, RootTimestampOffset,          IntegerConverter.ToArray64(BigInt(Date.now())))
    IterableView.Update(root, RootSecretKeyOffset,          Array.from(secretKey))
    IterableView.Update(root, RootAutoIncrementOffset,      IntegerConverter.ToArray64(0n))
    IterableView.Update(root, RootCountOffset,              IntegerConverter.ToArray32(0))
    IterableView.Update(root, RootLastInternalIndexOffset,  IntegerConverter.ToArray32(0))

    await engine.boot(path)

    if (await engine.exists(path) && !overwrite) {
      throw ErrorBuilder.ERR_DB_ALREADY_EXISTS(path)
    }
    await engine.create(path, root)

    const database = await TissueRoll.Open({ path, engine })
    database._addEmptyPage({ type: TissueRoll.InternalType }, true)
    return database
  }

  /**
   * It opens or creates a database file at the specified path. 
   * If `option.payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `1024`.
   * @param option The database creation options.
   */
  static async Open(option: TissueRollCreateOption): Promise<TissueRoll> {
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
      return await TissueRoll.Create({ path, engine, payloadSize })
    }

    await engine.open(path)
    if (!TissueRoll.CheckDBVerify(engine)) {
      await engine.close()
      throw ErrorBuilder.ERR_DB_INVALID(path)
    }

    const root = TissueRoll.ParseRootChunk(engine)
    const secretKey = Uint8Array.from(IntegerConverter.ToArray128(root.secretKey))
    
    return new TissueRoll(engine, secretKey, root.payloadSize)
  }

  protected static ParseRootChunk(engine: DataEngine): IRootHeader {
    const rHeader = engine.read(0, TissueRoll.RootChunkSize)
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
    } = TissueRoll
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

  protected static CheckDBVerify(engine: DataEngine) {
    const chunk = engine.read(
      TissueRoll.RootValidStringOffset,
      TissueRoll.RootValidStringSize
    )
    const text = TextConverter.FromArray(chunk)
    return text === TissueRoll.DB_NAME
  }

  protected static CallAddEmptyPage(db: TissueRoll, head: Partial<IPageHeader>, incrementInternalIndex: boolean): number {
    return db._addEmptyPage(head, incrementInternalIndex)
  }

  protected static CallSetPage(db: TissueRoll, head: Partial<IPageHeader>, data: number[]): void {
    const newHeadRaw = db._createEmptyHeader(head)
    const newHead = db._normalizeHeader(newHeadRaw)
    db._setPage(newHead, data)
  }

  protected static CallInternalPut(db: TissueRoll, data: number[], autoIncrement: boolean): string {
    return db.callInternalPut(data, autoIncrement)
  }

  protected static CallInternalUpdate(db: TissueRoll, id: string, data: string): {
    id: string
    data: string
  } {
    return db.callInternalUpdate(id, data)
  }

  protected static CallInternalDelete(db: TissueRoll, id: string, countDecrement: boolean): void {
    return db.callInternalDelete(id, countDecrement)
  }

  readonly engine: DataEngine
  protected readonly chunkSize: number
  protected readonly maximumFreeSize: number
  protected readonly headerSize: number
  protected readonly payloadSize: number
  protected readonly secretKey: Uint8Array
  protected readonly hooker: IHookallSync<IHooker>
  private readonly _encodingIdCache: ReturnType<TissueRoll['_createEncodingIdCache']>
  private readonly _decodingIdCache: ReturnType<TissueRoll['_createDecodingIdCache']>
  private readonly _decodingRecordCache: ReturnType<TissueRoll['_createDecodingRecordCache']>
  private readonly _pageHeaderCache: ReturnType<TissueRoll['_createPageHeaderCache']>
  private readonly _recordPositionCache: ReturnType<TissueRoll['_createRecordPositionCache']>
  private readonly _recordCache: ReturnType<TissueRoll['_createRecordCache']>

  protected constructor(engine: DataEngine, secretKey: Uint8Array, payloadSize: number) {
    if (payloadSize < TissueRoll.CellSize) {
      engine.close()
      throw new Error(`The payload size is too small. It must be greater than ${TissueRoll.CellSize}. But got a ${payloadSize}`)
    }
    this.chunkSize        = TissueRoll.HeaderSize+payloadSize
    this.headerSize       = TissueRoll.HeaderSize
    this.maximumFreeSize  = payloadSize-TissueRoll.CellSize
    this.payloadSize      = payloadSize
    this.secretKey        = secretKey
    this.engine           = engine
    
    this.hooker = useHookallSync<IHooker>(this)
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
    return TissueRoll.ParseRootChunk(this.engine)
  }

  private _createEncodingIdCache() {
    return new CacheEntanglementSync((key, state, index: number, order: number) => {
      const sIndex  = index.toString(16).padStart(7, '0')
      const sOrder  = order.toString(16).padStart(7, '0')
      const plain = `${sIndex}${sOrder}`
      const encrypted = CryptoHelper.Encrypt(plain, this.secretKey)
      return encrypted
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
    })
  }

  private _createDecodingRecordCache() {
    return new CacheEntanglementSync((key, state, rawHeader: number[]) => {
      const index = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          TissueRoll.RecordHeaderIndexOffset,
          TissueRoll.RecordHeaderIndexSize
        )
      )
      const order = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          TissueRoll.RecordHeaderOrderOffset,
          TissueRoll.RecordHeaderOrderSize
        )
      )
      const length = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          TissueRoll.RecordHeaderLengthOffset,
          TissueRoll.RecordHeaderLengthSize
        )
      )
      const maxLength = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          TissueRoll.RecordHeaderMaxLengthOffset,
          TissueRoll.RecordHeaderMaxLengthSize
        )
      )
      const deleted = IntegerConverter.FromArray8(
        IterableView.Read(
          rawHeader,
          TissueRoll.RecordHeaderDeletedOffset,
          TissueRoll.RecordHeaderDeletedSize
        )
      )
      const aliasIndex = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          TissueRoll.RecordHeaderAliasIndexOffset,
          TissueRoll.RecordHeaderAliasIndexSize
        )
      )
      const aliasOrder = IntegerConverter.FromArray32(
        IterableView.Read(
          rawHeader,
          TissueRoll.RecordHeaderAliasOrderOffset,
          TissueRoll.RecordHeaderAliasOrderSize
        )
      )
  
      const id = this._recordId(index, order)
      const aliasId = this._recordId(aliasIndex, aliasOrder)

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
    return new CacheEntanglementSync((key, state, index: number) => {
      const page    = this._get(index)
      const header  = IterableView.Read(page, 0, this.headerSize)
      return header
    })
  }

  private _createRecordPositionCache() {
    return new CacheEntanglementSync((key, state, index: number, order: number) => {
      const payloadPos    = this._pagePayloadPosition(index)
      const cellPos       = this._cellPosition(index, order)
      const cellValue     = this.engine.read(cellPos, TissueRoll.CellSize)
      const recordOffset  = IntegerConverter.FromArray32(cellValue)
      return payloadPos+recordOffset
    })
  }

  private _createRecordCache(
    recordPosition: ReturnType<TissueRoll['_createRecordPositionCache']>,
    pageHeader: ReturnType<TissueRoll['_createPageHeaderCache']>
  ) {
    return new CacheEntanglementSync((key, {
      recordPosition,
      pageHeader,
    }, index: number, order: number) => {
      const pos = recordPosition.raw
      const rHeader = this.engine.read(pos, TissueRoll.RecordHeaderSize)
      const payloadPos = TissueRoll.RecordHeaderSize+pos
      const payloadLength = IntegerConverter.FromArray32(
        IterableView.Read(
          rHeader,
          TissueRoll.RecordHeaderLengthOffset,
          TissueRoll.RecordHeaderLengthSize
        )
      )
  
      let header = this._normalizeHeader(pageHeader.raw)
      
      // internal 페이지일 경우
      if (!header.next) {
        const rPayload = this.engine.read(payloadPos, payloadLength)
        return rHeader.concat(rPayload)
      }
  
      // overflow 페이지로 나뉘어져 있을 경우
      const record = []
      let remain = payloadLength+TissueRoll.RecordHeaderSize
  
      while (remain > 0) {
        const pos   = this._pagePayloadPosition(header.index)
        const size  = Math.min(this.maximumFreeSize, Math.abs(remain))
        const chunk = this.engine.read(pos, size)
        record.push(...chunk)
  
        if (!header.next) {
          break
        }
        header = this._normalizeHeader(this._getHeader(header.next))
        remain -= size
      }
  
      return record
    }, {
      recordPosition,
      pageHeader,
    }, (key, dependencyKey, index, order) => {
      recordPosition.cache(key, index, order)
      pageHeader.cache(dependencyKey, index)
    })
  }

  private _createEmptyHeader({
    type = 0,
    index = 0,
    next = 0,
    count = 0,
    free = this.payloadSize
  }: Partial<IPageHeader> = {}): number[] {
    const header = TissueRoll.CreateIterable(this.headerSize, 0)

    const rType  = IntegerConverter.ToArray32(type)
    const rIndex = IntegerConverter.ToArray32(index)
    const rNext  = IntegerConverter.ToArray32(next)
    const rCount = IntegerConverter.ToArray32(count)
    const rFree  = IntegerConverter.ToArray32(free)
    IterableView.Update(header, TissueRoll.PageTypeOffset, rType)
    IterableView.Update(header, TissueRoll.PageIndexOffset, rIndex)
    IterableView.Update(header, TissueRoll.PageNextOffset, rNext)
    IterableView.Update(header, TissueRoll.PageCountOffset, rCount)
    IterableView.Update(header, TissueRoll.PageFreeOffset, rFree)

    return header
  }

  private _createEmptyPayload(): number[] {
    return TissueRoll.CreateIterable(this.payloadSize, 0)
  }
  
  private _createEmptyPage(header: Partial<IPageHeader>): number[] {
    return this._createEmptyHeader(header).concat(this._createEmptyPayload())
  }

  private _addEmptyPage(header: Partial<IPageHeader>, incrementInternalIndex: boolean): number {
    // update root
    let { index, lastInternalIndex } = this.metadata
    index++
    this.engine.update(
      TissueRoll.RootIndexOffset,
      IntegerConverter.ToArray32(index)
    )

    // extend payload
    const page = this._createEmptyPage(Object.assign({}, header, { index }))
    this.engine.append(page)

    if (header.type === TissueRoll.InternalType && incrementInternalIndex) {
      lastInternalIndex++
      this.engine.update(
        TissueRoll.RootLastInternalIndexOffset,
        IntegerConverter.ToArray32(lastInternalIndex)
      )
    }

    return index
  }

  private _pagePosition(index: number): number {
    return TissueRoll.RootChunkSize+(this.chunkSize*(index-1))
  }

  private _pagePayloadPosition(index: number): number {
    return this._pagePosition(index)+this.headerSize
  }

  private _cellPosition(index: number, order: number): number {
    const pagePos = this._pagePosition(index)
    const endOfPage = pagePos+this.chunkSize
    return endOfPage-(TissueRoll.CellSize*order)
  }

  private _recordPosition(index: number, order: number): number {
    return this._recordPositionCache.cache(`${index}/${order}`, index, order).raw
  }

  private _get(index: number): number[] {
    const start = this._pagePosition(index)
    return this.engine.read(start, this.chunkSize)
  }

  private _recordId(index: number, order: number): string {
    return this._encodingIdCache.cache(`${index}/${order}`, index, order).raw
  }

  private _normalizeRecordId(recordId: string): {
    index: number
    order: number
  } {
    return this._decodingIdCache.cache(recordId).clone('object-shallow-copy')
  }

  private _rawRecordId(recordId: string): number[] {
    const { index, order } = this._normalizeRecordId(recordId)
    return IntegerConverter.ToArray32(index).concat(
      IntegerConverter.ToArray32(order)
    )
  }

  private _createRecord(id: string, data: number[]): number[] {
    const rawId = this._rawRecordId(id)
    const length = IntegerConverter.ToArray32(data.length)

    const recordHeader = TissueRoll.CreateIterable(TissueRoll.RecordHeaderSize, 0)
    // insert record index
    IterableView.Update(recordHeader, TissueRoll.RecordHeaderIndexOffset, rawId)
    // insert record length
    IterableView.Update(recordHeader, TissueRoll.RecordHeaderLengthOffset, length)
    // insert record max length
    IterableView.Update(recordHeader, TissueRoll.RecordHeaderMaxLengthOffset, length)
    
    const record = recordHeader.concat(data)
    return record
  }

  private _createCell(recordOffset: number): number[] {
    return IntegerConverter.ToArray32(recordOffset)
  }

  private _getRecord(index: number, order: number): number[] {
    return this._recordCache
      .cache(`${index}/${order}`, index, order)
      .clone('array-shallow-copy') as number[]
  }

  private _normalizeRecord(record: number[]): NormalizedRecord {
    const rawHeader   = IterableView.Read(record, 0, TissueRoll.RecordHeaderSize)
    const rawPayload  = IterableView.Read(record, TissueRoll.RecordHeaderSize)

    const header = this._decodingRecordCache
      .cache(rawHeader.join(','), rawHeader)
      .clone('object-shallow-copy')

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

  private _getHeader(index: number): number[] {
    return this._pageHeaderCache
      .cache(`${index}`, index)
      .clone('array-shallow-copy') as number[]
  }

  private _normalizeHeader(header: number[]): IPageHeader {
    const type  = IntegerConverter.FromArray32(
      IterableView.Read(header, TissueRoll.PageTypeOffset, TissueRoll.PageTypeSize)
    )
    const index = IntegerConverter.FromArray32(
      IterableView.Read(header, TissueRoll.PageIndexOffset, TissueRoll.PageIndexSize)
    )
    const next  = IntegerConverter.FromArray32(
      IterableView.Read(header, TissueRoll.PageNextOffset, TissueRoll.PageNextSize)
    )
    const count = IntegerConverter.FromArray32(
      IterableView.Read(header, TissueRoll.PageCountOffset, TissueRoll.PageCountSize)
    )
    const free  = IntegerConverter.FromArray32(
      IterableView.Read(header, TissueRoll.PageFreeOffset, TissueRoll.PageFreeSize)
    )
    return {
      type,
      index,
      next,
      count,
      free,
    }
  }

  private _getHeadPageIndex(index: number): number {
    if (index <= 1) {
      return 1
    }
    while (true) {
      const { type } = this._normalizeHeader(this._getHeader(index))
      if (type !== TissueRoll.OverflowType) {
        break
      }
      index--
    }
    return index
  }

  protected pickRecord(recordId: string, recursiveAlias: boolean): PickResult {
    const { index, order } = this._normalizeRecordId(recordId)
    const page    = this._normalizeHeader(this._getHeader(index))
    const raw     = this._getRecord(index, order)
    const record  = this._normalizeRecord(raw)
    
    if (recursiveAlias && record.header.aliasIndex && record.header.aliasOrder) {
      return this.pickRecord(record.header.aliasId, recursiveAlias)
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
  getRecords(index: number): PickResult['record'][] {
    const headIndex = this._getHeadPageIndex(index)
    const header = this._normalizeHeader(this._getHeader(headIndex))

    const records = []
    for (let i = 0; i < header.count; i++) {
      const order = i+1
      const rawRecord = this._getRecord(header.index, order)
      const record = this._normalizeRecord(rawRecord)
      records.push(record)
    }
    return records
  }

  /**
   * Get record from database with a id.  
   * Don't pass an incorrect record ID. This does not ensure the validity of the record.
   * Use the `exists` method to validate the record id.
   * @param recordId The record id what you want pick.
   */
  pick(recordId: string) {
    return this.pickRecord(recordId, true)
  }

  private _setPageHeader(header: IPageHeader): void {
    const pos = this._pagePosition(header.index)
    const rHeader = this._createEmptyHeader(header)

    this.engine.update(pos, rHeader)
    this._pageHeaderCache.delete(`${header.index}`)
  }

  private _setPagePayload(index: number, order: number, record: number[]): void {
    const payloadPos  = this._pagePayloadPosition(index)
    const prevOrder   = order-1

    let recordPos
    if (order > 1) {
      const prevRecord  = this._normalizeRecord(this._getRecord(index, prevOrder))
      recordPos         = this._recordPosition(index, prevOrder)+prevRecord.rawRecord.length
    }
    else {
      recordPos = payloadPos
    }

    const cellPos = this._cellPosition(index, order)
    const cell    = this._createCell(recordPos-payloadPos)

    this.engine.update(recordPos, record)
    this.engine.update(cellPos, cell)

    this._recordCache.delete(`${index}/${order}`)
  }

  private _setPage(header: IPageHeader, data: number[]): string {
    const recordId  = this._recordId(header.index, header.count+1)
    const record    = this._createRecord(recordId, data)

    this._setPagePayload(header.index, header.count+1, record)
    
    const usage = TissueRoll.RecordHeaderSize+TissueRoll.CellSize+data.length
    header.count += 1
    header.free -= usage

    this._setPageHeader(header)

    return recordId
  }

  protected callInternalPut(data: number[], autoIncrement: boolean): string {
    const lastInternalIndex = this.metadata.lastInternalIndex
    let index   = lastInternalIndex
    let header  = this._normalizeHeader(this._getHeader(index))

    if (autoIncrement) {
      let { autoIncrement: increment, count } = this.metadata
      this.engine.update(
        TissueRoll.RootAutoIncrementOffset,
        IntegerConverter.ToArray64(increment+1n)
      )
      this.engine.update(
        TissueRoll.RootCountOffset,
        IntegerConverter.ToArray32(count+1)
      )
    }
    
    // 1. 이전 페이지의 공간이 넉넉하여 단일 페이지에 넣을 수 있는 경우
    // 이전 페이지에 넣기
    const recordSize  = TissueRoll.RecordHeaderSize+data.length
    const recordUsage = TissueRoll.CellSize+recordSize
    if (header.free >= recordUsage) {
      const recordId = this._setPage(header, data)
      return recordId
    }
    
    // 2. 이전 페이지의 공간이 넉넉하지 않을 경우
    
    // 새 페이지를 추가해야 합니다.
    // 하지만 이전 페이지가 사용되지 않은 채 공백으로 남아 있을 수 있습니다.
    // 따라서 사용되었을 경우에만 생성되어야 합니다.
    if (header.count) {
      index = this._addEmptyPage({ type: TissueRoll.InternalType }, true)
      header = this._normalizeHeader(this._getHeader(index))
    }
    
    const count = Math.ceil(recordSize/this.maximumFreeSize)
    
    // 한 페이지에 삽입이 가능할 경우, Internal 타입으로 생성되어야 하며, 삽입 후 종료되어야 합니다.
    if (count === 1) {
      return this._setPage(header, data)
    }

    let isInternalIndexDeferred = false
    if (count > 1 && !header.count) {
      isInternalIndexDeferred = true
    }
    
    // Overflow 타입의 페이지입니다.
    // 다음 삽입 시 무조건 새로운 페이지를 만들어야하므로, free, count 값이 고정됩니다.
    const recordId  = this._recordId(header.index, header.count+1)
    const record    = this._createRecord(recordId, data)
    const headIndex = index

    for (let i = 0; i < count; i++) {
      const last = i === count-1
      const start = i*this.maximumFreeSize
      const chunk = IterableView.Read(record, start, this.maximumFreeSize)
      
      const currentHeader = this._normalizeHeader(this._getHeader(index))
      this._setPagePayload(currentHeader.index, currentHeader.count+1, chunk)
      
      if (!last) {
        index = this._addEmptyPage({ type: TissueRoll.OverflowType }, false)
      }
      currentHeader.type = TissueRoll.OverflowType
      currentHeader.free = 0
      currentHeader.next = index
      currentHeader.count += 1
      if (last) {
        currentHeader.next = 0
      }
      this._setPageHeader(currentHeader)
    }
    const headHeader = this._normalizeHeader(this._getHeader(headIndex))
    headHeader.type = TissueRoll.InternalType
    headHeader.count = 1
    headHeader.free = 0
    this._setPageHeader(headHeader)

    if (isInternalIndexDeferred) {
      this.engine.update(
        TissueRoll.RootLastInternalIndexOffset,
        IntegerConverter.ToArray32(index)
      )
      this._addEmptyPage({ type: TissueRoll.InternalType }, true)
    }

    return recordId
  }

  /**
   * You store data in the database and receive a record ID for the saved data.
   * This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
   * @param data The data string what you want store.
   * @returns The record id.
   */
  put(data: string): string {
    return this.hooker.trigger('put', data, (data) => {
      const rData = TextConverter.ToArray(data)
      const id = this.callInternalPut(rData, true)
      return id
    })
  }

  private _overwriteInternalRecord(index: number, order: number, record: number[]): number {
    this.engine.update(this._recordPosition(index, order), record)
    return index
  }

  private _overwriteOverflowedRecord(index: number, record: number[]): number {
    while (index) {
      const size = Math.min(this.maximumFreeSize, record.length)
      const chunk = IterableView.Read(record, 0, size)
      
      this.engine.update(this._pagePayloadPosition(index), chunk)
      record = record.slice(size)
      
      if (!record.length) {
        this._recordCache.delete(`${index}/1`)
        return index
      }

      const rHeader = this._getHeader(index)
      const header = this._normalizeHeader(rHeader)
      let next = header.next
      if (!next) {
        next = this._addEmptyPage({
          type: TissueRoll.OverflowType,
          count: 1,
          free: 0
        }, false)
        IterableView.Update(
          rHeader,
          TissueRoll.PageNextOffset,
          IntegerConverter.ToArray32(next)
        )
        this.engine.update(
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

  private _isInternalRecord(record: number[]): boolean {
    const index = this._normalizeRecord(record).header.index
    const page =  this._normalizeHeader(this._getHeader(index))
    return !page.next
  }

  protected callInternalUpdate(id: string, data: string): {
    id: string
    data: string
  } {
    const payload = TextConverter.ToArray(data)
    const head = this.pickRecord(id, false)
    const tail = this.pickRecord(id, true)
    
    if (head.record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(id)
    }

    const record = this._createRecord(tail.record.header.id, payload)

    if (tail.record.rawRecord.length < record.length) {
      if (this._isInternalRecord(tail.record.rawRecord)) {
        const id = this.callInternalPut(payload, false)
        const { index, order } = this._normalizeRecordId(id)
        const headClone = IterableView.Copy(head.record.rawRecord)
        IterableView.Update(
          headClone,
          TissueRoll.RecordHeaderAliasIndexOffset,
          IntegerConverter.ToArray32(index)
        )
        IterableView.Update(
          headClone,
          TissueRoll.RecordHeaderAliasOrderOffset,
          IntegerConverter.ToArray32(order)
        )
        this.engine.update(
          this._recordPosition(
            head.record.header.index,
            head.record.header.order
          ),
          headClone
        )
        if (head.record.header.id !== tail.record.header.id) {
          this.callInternalDelete(tail.record.header.id, false)
        }
        this._recordCache.delete(`${head.record.header.index}/${head.record.header.order}`)
        this._recordCache.delete(`${tail.record.header.index}/${tail.record.header.order}`)
        return {
          id,
          data
        }
      }
      else {
        this._overwriteOverflowedRecord(tail.record.header.index, record)
      }
    }
    else {
      IterableView.Update(
        record,
        TissueRoll.RecordHeaderMaxLengthOffset,
        IntegerConverter.ToArray32(tail.record.header.maxLength)
      )
      if (this._isInternalRecord(tail.record.rawRecord)) {
        this._overwriteInternalRecord(
          tail.record.header.index,
          tail.record.header.order,
          record
        )
      }
      else {
        this._overwriteOverflowedRecord(tail.record.header.index, record)
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
  update(recordId: string, data: string): string {
    const information = this.hooker.trigger('update', {
      id: recordId,
      data
    }, ({ id, data }) => this.callInternalUpdate(id, data))
    return information.id
  }

  protected callInternalDelete(recordId: string, countDecrement: boolean): void {
    const { index, order } = this._normalizeRecordId(recordId)
    
    const pos = this._recordPosition(index, order)+TissueRoll.RecordHeaderDeletedOffset
    const buf = IntegerConverter.ToArray8(1)
    if (countDecrement) {
      const { count } = this.metadata
      this.engine.update(
        TissueRoll.RootCountOffset,
        IntegerConverter.ToArray32(count-1)
      )
    }
    this.engine.update(pos, buf)
    this._recordCache.delete(`${index}/${order}`)
  }

  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  delete(recordId: string): void {
    this.hooker.trigger('delete', recordId, (recordId) => {
      const { record } = this.pickRecord(recordId, false)
      this.callInternalDelete(record.header.id, true)
      return recordId
    })
  }

  /**
   * It returns whether the record exists in the database.
   * If it has been deleted or has an invalid record ID, it returns `false`.
   * @param recordId The record id what you want verify.
   */
  exists(recordId: string): boolean {
    try {
      this.pickRecord(recordId, false)
      return true
    } catch (e) {
      return false
    }
  }

  /**
   * Shut down the database to close file input and output.
   */
  close(): void {
    this.engine.close()
  }

  /**
   * Hook into the database for pre-processing before put data.  
   * The callback function receives the input data, and the value returned by this callback function is what actually puts into the database.
   * 
   * If multiple pre-processing functions are registered, they run sequentially, with each subsequent pre-processing function receiving the data returned by the previous one as a parameter.
   * @param command Only "put"
   * @param callback The pre-processing callback function. This function must return the string that you want to put into the database.
   */
  onBefore(command: 'put', callback: (data: string) => string): this
  /**
   * Hook into the database for pre-processing before updating data.  
   * The callback function receives the record ID and the data to be updated.
   * The data returned by this callback function, along with the record ID, is what is actually used to update the database.
   * 
   * If multiple pre-processing functions are registered, they run sequentially, with each subsequent pre-processing function receiving the data and record ID returned by the previous one as parameters.
   * @param command Only "update"
   * @param callback The pre-processing callback function. This function must return the record ID and data that you want to update in the database.
   */
  onBefore(command: 'update', callback: (record: IHookerRecordInformation) => IHookerRecordInformation): this
  /**
   * Hook into the database for pre-processing before deleting a record.  
   * The callback function receives the ID of the record to be deleted.
   * The record ID returned by this callback function is what is actually used to delete the record from the database.
   * 
   * If multiple pre-processing functions are registered, they run sequentially, with each subsequent pre-processing function receiving the record ID returned by the previous one as a parameter.
   * @param command Only "delete"
   * @param callback The pre-processing callback function. This function must return the record ID that you want to delete from the database.
   */
  onBefore(command: 'delete', callback: (recordId: string) => string): this
  /**
   * Register preprocessing functions for hooking before executing database operations such as `put`, `update`, and `delete` commands.  
   * The value returned by this callback function is what is actually applied to the database.
   * 
   * If multiple pre-processing functions are registered, they run sequentially, with each subsequent pre-processing function receiving the value returned by the previous one as a parameter.
   * @param command Only which "put", "update", "delete"
   * @param callback The pre-processing callback function.
   */
  onBefore(command: 'put'|'update'|'delete', callback: (arg: any) => any): this {
    this.hooker.onBefore(command, callback)
    return this
  }

  /**
   * Hook into the database after put a data.  
   * The callback function receives the newly created record ID.
   * 
   * If multiple post-processing functions are registered, they run sequentially, with each subsequent post-processing function receiving the value returned by the previous one as a parameter.
   * @param command Only "put"
   * @param callback The post-processing callback function. This function must return a string for the parameters of the following post-processing functions.
   */
  onAfter(command: 'put', callback: (recordId: string) => string): this
  /**
   * Hook into the database after put data.  
   * The callback function receives the newly created record ID and the input data.
   * 
   * If multiple post-processing functions are registered, they run sequentially, with each subsequent post-processing function receiving the values returned by the previous one as parameters.
   * @param command Only "update"
   * @param callback The post-processing callback function. This function must return the record ID and data for the parameters of the following post-processing function.
   */
  onAfter(command: 'update', callback: (record: IHookerRecordInformation) => IHookerRecordInformation): this
  /**
   * Hook into the database after deleting a record.  
   * The callback function receives the deleted record ID.
   * 
   * If multiple post-processing functions are registered, they run sequentially, with each subsequent post-processing function receiving the values returned by the previous one as parameters.
   * @param command Only "delete"
   * @param callback The post-processing callback function. This function must return a string for the parameters of the following post-processing functions.
   */
  onAfter(command: 'delete', callback: (recordId: string) => string): this
  /**
   * Register post-processing functions for hooking after performing database operations such as `put`, `update`, and `delete` commands.  
   * You can use the value returned by this callback function for additional operations.
   * 
   * If multiple post-processing functions are registered, they run sequentially, with each subsequent post-processing function receiving the values returned by the previous one as parameters.
   * @param command Only which "put", "update", "delete"
   * @param callback The post-processing callback function.
   */
  onAfter(command: 'put'|'update'|'delete', callback: (arg: any) => any): this {
    this.hooker.onAfter(command, callback)
    return this
  }

  /**
   * Same as the `onBefore` method, but only works once. For more information, see the `onBefore` method.
   * @param command Only "put"
   * @param callback The pre-processing callback function. This function must return the string that you want to put into the database.
   */
  onceBefore(command: 'put', callback: (data: string) => string): this
  /**
   * Same as the `onBefore` method, but only works once. For more information, see the `onBefore` method.
   * @param command Only "update"
   * @param callback The pre-processing callback function. This function must return the record ID and data that you want to update in the database.
   */
  onceBefore(command: 'update', callback: (record: IHookerRecordInformation) => IHookerRecordInformation): this
  /**
   * Same as the `onBefore` method, but only works once. For more information, see the `onBefore` method.
   * @param command Only "delete"
   * @param callback The pre-processing callback function. This function must return the record ID that you want to delete from the database.
   */
  onceBefore(command: 'delete', callback: (recordId: string) => string): this
  /**
   * Same as the `onBefore` method, but only works once. For more information, see the `onBefore` method.
   * @param command Only which "put", "update", "delete"
   * @param callback The pre-processing callback function.
   */
  onceBefore(command: 'put'|'update'|'delete', callback: (arg: any) => any): this {
    this.hooker.onceBefore(command, callback)
    return this
  }

  /**
   * Same as the `onAfter` method, but only works once. For more information, see the `onAfter` method.
   * @param command Only "put"
   * @param callback The post-processing callback function. This function must return a string for the parameters of the following post-processing functions.
   */
  onceAfter(command: 'put', callback: (recordId: string) => string): this
  /**
   * Same as the `onAfter` method, but only works once. For more information, see the `onAfter` method.
   * @param command Only "update"
   * @param callback The post-processing callback function. This function must return the record ID and data for the parameters of the following post-processing function.
   */
  onceAfter(command: 'update', callback: (record: IHookerRecordInformation) => IHookerRecordInformation): this
  /**
   * Same as the `onAfter` method, but only works once. For more information, see the `onAfter` method.
   * @param command Only "delete"
   * @param callback The post-processing callback function. This function must return a string for the parameters of the following post-processing functions.
   */
  onceAfter(command: 'delete', callback: (recordId: string) => string): this
  /**
   * Same as the `onAfter` method, but only works once. For more information, see the `onAfter` method.
   * @param command Only which "put", "update", "delete"
   * @param callback The post-processing callback function.
   */
  onceAfter(command: 'put'|'update'|'delete', callback: (arg: any) => any): this {
    this.hooker.onceAfter(command, callback)
    return this
  }

  /**
   * You remove the pre-processing functions added with `onBefore` or `onceBefore` methods.  
   * If there is no callback parameter, it removes all pre-processing functions registered for that command.
   * @param command Only "put"
   * @param callback Functions you want to remove.
   */
  offBefore(command: 'put', callback: (data: string) => string): this
  /**
   * You remove the pre-processing functions added with `onBefore` or `onceBefore` methods.  
   * If there is no callback parameter, it removes all pre-processing functions registered for that command.
   * @param command Only "update"
   * @param callback Functions you want to remove.
   */
  offBefore(command: 'update', callback: (record: IHookerRecordInformation) => IHookerRecordInformation): this
  /**
   * You remove the pre-processing functions added with `onBefore` or `onceBefore` methods.  
   * If there is no callback parameter, it removes all pre-processing functions registered for that command.
   * @param command Only "delete"
   * @param callback Functions you want to remove.
   */
  offBefore(command: 'delete', callback: (recordId: string) => string): this
  /**
   * You remove the pre-processing functions added with `onBefore` or `onceBefore` methods.  
   * If there is no callback parameter, it removes all pre-processing functions registered for that command.
   * @param command Only which "put", "update", "delete"
   * @param callback Functions you want to remove.
   */
  offBefore(command: 'put'|'update'|'delete', callback?: (arg: any) => any): this {
    this.hooker.offBefore(command, callback)
    return this
  }

  /**
   * You remove the post-processing functions added with `onAfter` or `onceAfter` methods.  
   * If there is no callback parameter, it removes all post-processing functions registered for that command.
   * @param command Only "put"
   * @param callback Functions you want to remove.
   */
  offAfter(command: 'put', callback: (recordId: string) => string): this
  /**
   * You remove the post-processing functions added with `onAfter` or `onceAfter` methods.  
   * If there is no callback parameter, it removes all post-processing functions registered for that command.
   * @param command Only "update"
   * @param callback Functions you want to remove.
   */
  offAfter(command: 'update', callback: (record: IHookerRecordInformation) => IHookerRecordInformation): this
  /**
   * You remove the post-processing functions added with `onAfter` or `onceAfter` methods.  
   * If there is no callback parameter, it removes all post-processing functions registered for that command.
   * @param command Only "delete"
   * @param callback Functions you want to remove.
   */
  offAfter(command: 'delete', callback: (recordId: string) => string): this
  /**
   * You remove the post-processing functions added with `onAfter` or `onceAfter` methods.  
   * If there is no callback parameter, it removes all post-processing functions registered for that command.
   * @param command Only which "put", "update", "delete"
   * @param callback Functions you want to remove.
   */
  offAfter(command: 'put'|'update'|'delete', callback?: (arg: any) => any): this {
    this.hooker.offAfter(command, callback)
    return this
  }
}
