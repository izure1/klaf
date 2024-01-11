import fs from 'node:fs'

import type { FpeCipher } from 'node-fpe'
import type { IHookallSync } from 'hookall'
import { useHookallSync } from 'hookall'

import { ErrorBuilder } from './ErrorBuilder'
import { TextConverter } from '../utils/TextConverter'
import { IntegerConverter } from '../utils/IntegerConverter'
import { Base64Helper } from '../utils/Base64Helper'
import { CryptoHelper } from '../utils/CryptoHelper'
import { FpeBuilder } from '../utils/FpeBuilder'
import { IterableView, FileView } from '../utils/IterableView'
import { CacheStore } from '../utils/CacheStore'

type IPageHeader = {
  type: number
  index: number
  next: number
  count: number
  free: number
}

type IRootHeader = {
  majorVersion: number
  minorVersion: number
  patchVersion: number
  payloadSize: number
  timestamp: bigint
  secretKey: bigint
  autoIncrement: bigint
  count: number
  index: number
}

type IHookerRecordInformation = { id: string, data: string }
type IHooker = {
  put: (data: string) => string
  update: (record: IHookerRecordInformation) => IHookerRecordInformation
  delete: (recordId: string) => string
}

export class TissueRoll {
  protected static readonly DB_VERSION                    = '2.6.0'
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
  protected static readonly RootSecretKeySize             = 8
  protected static readonly RootAutoIncrementOffset       = TissueRoll.RootSecretKeyOffset+TissueRoll.RootSecretKeySize
  protected static readonly RootAutoIncrementSize         = 8
  protected static readonly RootCountOffset               = TissueRoll.RootAutoIncrementOffset+TissueRoll.RootAutoIncrementSize
  protected static readonly RootCountSize                 = 4

  protected static readonly RootChunkSize                 = 200
  protected static readonly HeaderSize                    = 100
  protected static readonly CellSize                      = 4
  protected static readonly RecordHeaderSize              = 40
  protected static readonly RecordHeaderIndexOffset       = 0
  protected static readonly RecordHeaderIndexSize         = 4
  protected static readonly RecordHeaderOrderOffset       = TissueRoll.RecordHeaderIndexOffset+TissueRoll.RecordHeaderIndexSize
  protected static readonly RecordHeaderOrderSize         = 4
  protected static readonly RecordHeaderSaltOffset        = TissueRoll.RecordHeaderOrderOffset+TissueRoll.RecordHeaderOrderSize
  protected static readonly RecordHeaderSaltSize          = 4
  protected static readonly RecordHeaderLengthOffset      = TissueRoll.RecordHeaderSaltOffset+TissueRoll.RecordHeaderSaltSize
  protected static readonly RecordHeaderLengthSize        = 4
  protected static readonly RecordHeaderMaxLengthOffset   = TissueRoll.RecordHeaderLengthOffset+TissueRoll.RecordHeaderLengthSize
  protected static readonly RecordHeaderMaxLengthSize     = 4
  protected static readonly RecordHeaderDeletedOffset     = TissueRoll.RecordHeaderMaxLengthOffset+TissueRoll.RecordHeaderMaxLengthSize
  protected static readonly RecordHeaderDeletedSize       = 1
  protected static readonly RecordHeaderAliasIndexOffset  = TissueRoll.RecordHeaderDeletedOffset+TissueRoll.RecordHeaderDeletedSize
  protected static readonly RecordHeaderAliasIndexSize    = 4
  protected static readonly RecordHeaderAliasOrderOffset  = TissueRoll.RecordHeaderAliasIndexOffset+TissueRoll.RecordHeaderAliasIndexSize
  protected static readonly RecordHeaderAliasOrderSize    = 4
  protected static readonly RecordHeaderAliasSaltOffset   = TissueRoll.RecordHeaderAliasOrderOffset+TissueRoll.RecordHeaderAliasOrderSize
  protected static readonly RecordHeaderAliasSaltSize     = 4


  protected static readonly UnknownType                   = 0
  protected static readonly InternalType                  = 1
  protected static readonly OverflowType                  = 2
  protected static readonly SystemReservedType            = 3


  /**
   * It creates a new database file.
   * @param file This is the path where the database file will be created.
   * @param payloadSize This is the maximum data size a single page in the database can hold. The default is `8192`. If this value is too large or too small, it can affect performance.
   * @param overwrite This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  static Create(file: string, payloadSize = 8192, overwrite = false): TissueRoll {
    if (fs.existsSync(file) && !overwrite) {
      throw ErrorBuilder.ERR_DB_ALREADY_EXISTS(file)
    }
    
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
    } = TissueRoll
    const [
      majorVersion,
      minorVersion,
      patchVersion
    ] = DB_VERSION.split('.')
    const secretKey = CryptoHelper.RandomBytes(RootSecretKeySize)
    IterableView.Update(root, RootValidStringOffset,    TextConverter.ToArray(DB_NAME))
    IterableView.Update(root, RootMajorVersionOffset,   IntegerConverter.ToArray8(Number(majorVersion)))
    IterableView.Update(root, RootMinorVersionOffset,   IntegerConverter.ToArray8(Number(minorVersion)))
    IterableView.Update(root, RootPatchVersionOffset,   IntegerConverter.ToArray8(Number(patchVersion)))
    IterableView.Update(root, RootPayloadSizeOffset,    IntegerConverter.ToArray32(payloadSize))
    IterableView.Update(root, RootTimestampOffset,      IntegerConverter.ToArray64(BigInt(Date.now())))
    IterableView.Update(root, RootSecretKeyOffset,      Array.from(secretKey))
    IterableView.Update(root, RootAutoIncrementOffset,  IntegerConverter.ToArray64(0n))
    IterableView.Update(root, RootCountOffset,          IntegerConverter.ToArray32(0))

    fs.writeFileSync(file, Buffer.from(root))

    const inst = TissueRoll.Open(file)
    inst._addEmptyPage({ type: TissueRoll.InternalType })
    return inst
  }

  /**
   * It opens or creates a database file at the specified path. 
   * If `payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `8192`.
   * @param file This is the path where the database file is located.
   * @param payloadSize If this value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `8192`.
   */
  static Open(file: string, payloadSize = 8192) {
    // 파일이 존재하지 않을 경우
    if (!fs.existsSync(file)) {
      if (!payloadSize) {
        throw ErrorBuilder.ERR_DB_NO_EXISTS(file)
      }
      // 옵션이 지정되었을 경우 새롭게 생성합니다
      return TissueRoll.Create(file, payloadSize)
    }

    // 파일이 존재할 경우 열기
    const fd = fs.openSync(file, 'r+')
    
    // 올바른 형식의 파일인지 체크
    if (!TissueRoll.CheckDBValid(fd)) {
      fs.closeSync(fd)
      throw ErrorBuilder.ERR_DB_INVALID(file)
    }

    const root = TissueRoll.ParseRootChunk(fd)
    const secretBuf = Buffer.from(IntegerConverter.ToArray64(root.secretKey))
    const secretKey = secretBuf.toString('base64')
    
    return new TissueRoll(fd, secretKey, root.payloadSize)
  }

  protected static ParseRootChunk(fd: number): IRootHeader {
    const rHeader = FileView.Read(fd, 0, TissueRoll.RootChunkSize)
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
    const secretKey     = IntegerConverter.FromArray64(
      IterableView.Read(rHeader, RootSecretKeyOffset, RootSecretKeySize)
    )
    const autoIncrement = IntegerConverter.FromArray64(
      IterableView.Read(rHeader, RootAutoIncrementOffset, RootAutoIncrementSize)
    )
    const count = IntegerConverter.FromArray32(
      IterableView.Read(rHeader, RootCountOffset, RootCountSize)
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
    }
  }

  protected static CreateIterable(len: number, fill: number): number[] {
    return new Array(len).fill(fill)
  }

  protected static CheckDBValid(fd: number) {
    const chunk = FileView.Read(
      fd,
      TissueRoll.RootValidStringOffset,
      TissueRoll.RootValidStringSize
    )
    const text = TextConverter.FromArray(chunk)
    return text === TissueRoll.DB_NAME
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

  protected static CallInternalDelete(db: TissueRoll, index: number, order: number, countDecrement: boolean): void {
    return db.callInternalDelete(index, order, countDecrement)
  }


  protected readonly chunkSize: number
  protected readonly headerSize: number
  protected readonly payloadSize: number
  protected readonly fd: number
  protected readonly secretKey: string
  protected readonly fpe: FpeCipher
  protected readonly hooker: IHookallSync<IHooker>
  private readonly _cachedId: CacheStore<string>
  private readonly _cachedIdInfo: CacheStore<{ index: number, order: number, salt: number }>

  protected constructor(fd: number, secretKey: string, payloadSize: number) {
    if (payloadSize < TissueRoll.CellSize) {
      fs.closeSync(fd)
      throw new Error(`The payload size is too small. It must be greater than ${TissueRoll.CellSize}. But got a ${payloadSize}`)
    }
    this.chunkSize    = TissueRoll.HeaderSize+payloadSize
    this.headerSize   = TissueRoll.HeaderSize
    this.payloadSize  = payloadSize
    this.fd           = fd
    this.secretKey    = secretKey
    this.fpe          = new FpeBuilder()
      .setSecretKey(secretKey)
      .setDomain(Base64Helper.UrlSafeDomain)
      .build()
    
    this.hooker = useHookallSync<IHooker>(this)
    this._cachedId = new CacheStore()
    this._cachedIdInfo = new CacheStore()
  }

  get root(): IRootHeader {
    return TissueRoll.ParseRootChunk(this.fd)
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
    IterableView.Update(header, 0, rType)
    IterableView.Update(header, 4, rIndex)
    IterableView.Update(header, 8, rNext)
    IterableView.Update(header, 12, rCount)
    IterableView.Update(header, 16, rFree)

    return header
  }

  private _createEmptyPayload(): number[] {
    return TissueRoll.CreateIterable(this.payloadSize, 0)
  }
  
  private _createEmptyPage(header: Partial<IPageHeader>): number[] {
    return this._createEmptyHeader(header).concat(this._createEmptyPayload())
  }

  private _addEmptyPage(header: Partial<IPageHeader>): number {
    // update root
    let { index } = this.root
    index++
    FileView.Update(this.fd, TissueRoll.RootIndexOffset, IntegerConverter.ToArray32(index))

    // extend payload
    const page = this._createEmptyPage(Object.assign({}, header, { index }))
    FileView.Append(this.fd, page)

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

  private _createSalt(): number {
    return IntegerConverter.FromArray32(CryptoHelper.RandomBytes(4))
  }

  private _recordPosition(index: number, order: number): number {
    const payloadPos    = this._pagePayloadPosition(index)
    const cellPos       = this._cellPosition(index, order)
    const cellValue     = FileView.Read(this.fd, cellPos, TissueRoll.CellSize)
    const recordOffset  = IntegerConverter.FromArray32(cellValue)
    return payloadPos+recordOffset
  }

  private _get(index: number): number[] {
    const start = this._pagePosition(index)
    return FileView.Read(this.fd, start, this.chunkSize)
  }

  private _recordId(index: number, order: number, salt: number): string {
    return this._cachedId.get(`${index}:${order}:${salt}`, () => {
      const sIndex  = index.toString(16).padStart(8, '0')
      const sOrder  = order.toString(16).padStart(8, '0')
      const sSalt   = salt.toString(16).padStart(8, '0')
      const base64  = Base64Helper.UrlSafeEncode(`${sIndex}${sOrder}${sSalt}`)
      const result  = this.fpe.encrypt(base64)
      return result
    })
  }

  private _normalizeRecordId(recordId: string) {
    return this._cachedIdInfo.get(recordId, () => {
      const base64 = this.fpe.decrypt(recordId)
      const plain = Base64Helper.UrlSafeDecode(base64)
      const index = parseInt(plain.slice(0, 8), 16)
      const order = parseInt(plain.slice(8, 16), 16)
      const salt  = parseInt(plain.slice(16, 24), 16)
      return {
        index,
        order,
        salt,
      }
    })
  }

  private _rawRecordId(recordId: string): number[] {
    const { index, order, salt } = this._normalizeRecordId(recordId)
    return IntegerConverter.ToArray32(index).concat(
      IntegerConverter.ToArray32(order),
      IntegerConverter.ToArray32(salt)
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
    const recordPos = this._recordPosition(index, order)
    const recordHeader = FileView.Read(this.fd, recordPos, TissueRoll.RecordHeaderSize)
    const recordPayloadPos = TissueRoll.RecordHeaderSize+recordPos
    const recordPayloadLength = IntegerConverter.FromArray32(
      IterableView.Read(
        recordHeader,
        TissueRoll.RecordHeaderLengthOffset,
        TissueRoll.RecordHeaderLengthSize
      )
    )

    let header = this._normalizeHeader(this._getHeader(index))
    
    // internal 페이지일 경우
    if (!header.next) {
      const recordPayload = FileView.Read(this.fd, recordPayloadPos, recordPayloadLength)
      return recordHeader.concat(recordPayload)
    }

    // overflow 페이지로 나뉘어져 있을 경우
    const record = []
    const payloadMaxLength = this.payloadSize-TissueRoll.CellSize
    
    let remain = recordPayloadLength+TissueRoll.RecordHeaderSize

    while (remain > 0) {
      const pos   = this._pagePayloadPosition(header.index)
      const size  = Math.min(payloadMaxLength, Math.abs(remain))
      const chunk = FileView.Read(this.fd, pos, size)
      record.push(...chunk)

      if (!header.next) {
        break
      }
      header = this._normalizeHeader(this._getHeader(header.next))
      remain -= size
    }

    return record
  }

  private _normalizeRecord(record: number[]) {
    const rawHeader   = IterableView.Read(record, 0, TissueRoll.RecordHeaderSize)
    const rawPayload  = IterableView.Read(record, TissueRoll.RecordHeaderSize)

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
    const salt = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        TissueRoll.RecordHeaderSaltOffset,
        TissueRoll.RecordHeaderSaltSize
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
    const aliasSalt = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        TissueRoll.RecordHeaderAliasSaltOffset,
        TissueRoll.RecordHeaderAliasSaltSize
      )
    )

    const id = this._recordId(index, order, salt)
    const aliasId = this._recordId(aliasIndex, aliasOrder, aliasSalt)

    const header = {
      id,
      aliasId,
      index,
      order,
      salt,
      aliasIndex,
      aliasOrder,
      aliasSalt,
      length,
      maxLength,
      deleted,
    }
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
    const page    = this._get(index)
    const header  = IterableView.Read(page, 0, this.headerSize)
    return header
  }

  private _normalizeHeader(header: number[]): IPageHeader {
    const type  = IntegerConverter.FromArray32(IterableView.Read(header, 0, 4))
    const index = IntegerConverter.FromArray32(IterableView.Read(header, 4, 4))
    const next  = IntegerConverter.FromArray32(IterableView.Read(header, 8, 4))
    const count = IntegerConverter.FromArray32(IterableView.Read(header, 12, 4))
    const free  = IntegerConverter.FromArray32(IterableView.Read(header, 16, 4))
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

  protected pickRecord(recordId: string, recursiveAlias: boolean): {
    page: ReturnType<TissueRoll['_normalizeHeader']>
    record: ReturnType<TissueRoll['_normalizeRecord']>
    order: number
  } {
    const { index, order, salt } = this._normalizeRecordId(recordId)

    const page      = this._normalizeHeader(this._getHeader(index))
    const rawRecord = this._getRecord(index, order)
    const record    = this._normalizeRecord(rawRecord)
    
    if (recursiveAlias && record.header.aliasIndex && record.header.aliasOrder) {
      return this.pickRecord(record.header.aliasId, recursiveAlias)
    }

    if (record.header.salt !== salt) {
      throw ErrorBuilder.ERR_INVALID_RECORD(recordId)
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
   * The page index should be within the range of `1` to `instance.root.index`.
   * @param index The page index.
   */
  getRecords(index: number): ReturnType<TissueRoll['pick']>['record'][] {
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

  private _putPageHeader(header: IPageHeader): void {
    const pos = this._pagePosition(header.index)
    const rHeader = this._createEmptyHeader(header)
    FileView.Update(this.fd, pos, rHeader)
  }

  private _putPagePayload(index: number, order: number, record: number[]): void {
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

    // update payload
    FileView.Update(this.fd, recordPos, record)
    // update cell
    FileView.Update(this.fd, cellPos, cell)
  }

  private _putJustOnePage(header: IPageHeader, data: number[]): string {
    const salt      = this._createSalt()
    const recordId  = this._recordId(header.index, header.count+1, salt)
    const record    = this._createRecord(recordId, data)

    this._putPagePayload(header.index, header.count+1, record)
    
    const usage = TissueRoll.RecordHeaderSize+TissueRoll.CellSize+data.length
    header.count += 1
    header.free -= usage
    this._putPageHeader(header)

    return recordId
  }

  protected callInternalPut(data: number[], autoIncrement: boolean): string {
    let index   = this.root.index
    let header  = this._normalizeHeader(this._getHeader(index))

    if (header.type !== TissueRoll.InternalType) {
      index   = this._addEmptyPage({ type: TissueRoll.InternalType })
      header  = this._normalizeHeader(this._getHeader(index))
    }

    if (autoIncrement) {
      let { autoIncrement: increment, count } = this.root
      FileView.Update(
        this.fd,
        TissueRoll.RootAutoIncrementOffset,
        IntegerConverter.ToArray64(increment+1n)
      )
      FileView.Update(
        this.fd,
        TissueRoll.RootCountOffset,
        IntegerConverter.ToArray32(count+1)
      )
    }
    
    // 1. 이전 페이지의 공간이 넉넉하여 단일 페이지에 넣을 수 있는 경우
    // 이전 페이지에 넣기
    const recordSize  = TissueRoll.RecordHeaderSize+data.length
    const recordUsage = TissueRoll.CellSize+recordSize
    if (header.free >= recordUsage) {
      return this._putJustOnePage(header, data)
    }
    
    // 2. 이전 페이지의 공간이 넉넉하지 않을 경우
    
    // 새 페이지를 추가해야 합니다.
    // 하지만 이전 페이지가 사용되지 않은 채 공백으로 남아 있을 수 있습니다.
    // 따라서 사용되었을 경우에만 생성되어야 합니다.
    if (header.count) {
      index = this._addEmptyPage({ type: TissueRoll.InternalType })
      header = this._normalizeHeader(this._getHeader(index))
    }
    
    const chunkSize = this.payloadSize-TissueRoll.CellSize
    const count = Math.ceil(recordSize/chunkSize)
    
    // 한 페이지에 삽입이 가능할 경우, Internal 타입으로 생성되어야 하며, 삽입 후 종료되어야 합니다.
    if (count === 1) {
      return this._putJustOnePage(header, data)
    }
    
    // Overflow 타입의 페이지입니다.
    // 다음 삽입 시 무조건 새로운 페이지를 만들어야하므로, free, count 값이 고정됩니다.
    const salt      = this._createSalt()
    const recordId  = this._recordId(header.index, header.count+1, salt)
    const record    = this._createRecord(recordId, data)
    const headIndex = index

    for (let i = 0; i < count; i++) {
      const last = i === count-1
      const start = i*chunkSize
      const chunk = IterableView.Read(record, start, chunkSize)
      
      const currentHeader = this._normalizeHeader(this._getHeader(index))
      this._putPagePayload(currentHeader.index, currentHeader.count+1, chunk)
      
      if (!last) {
        index = this._addEmptyPage({ type: TissueRoll.OverflowType })
      }
      currentHeader.type = TissueRoll.OverflowType
      currentHeader.free = 0
      currentHeader.next = index
      currentHeader.count += 1
      if (last) {
        currentHeader.next = 0
      }
      this._putPageHeader(currentHeader)
    }
    const headHeader = this._normalizeHeader(this._getHeader(headIndex))
    headHeader.type = TissueRoll.InternalType
    headHeader.count = 1
    headHeader.free = 0
    this._putPageHeader(headHeader)

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

  protected callInternalUpdate(id: string, data: string) {
    const payload = TextConverter.ToArray(data)
    const payloadLen = IntegerConverter.ToArray32(payload.length)
    const head = this.pickRecord(id, false)
    const tail = this.pickRecord(id, true)

    if (tail.record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(id)
    }
    
    let extendOverflow = false
    // 최근 업데이트 레코드보다 크기가 큰 값이 들어왔을 경우 새롭게 생성해야 합니다.
    // 최근 업데이트 레코드는 무조건 기존의 레코드보다 길이가 깁니다.
    if (tail.record.header.maxLength < payload.length) {
      // Overflow 타입의 페이지가 아닐 경우엔 새롭게 삽입해야 합니다.
      if (!tail.page.next) {
        const afterRecordId = this.callInternalPut(payload, false)
        const { index, order, salt } = this._normalizeRecordId(afterRecordId)
        
        if (tail.record.header.aliasIndex && tail.record.header.aliasOrder) {
          this.callInternalDelete(
            tail.record.header.aliasIndex,
            tail.record.header.aliasOrder,
            false
          )
        }
        
        // update head record's header
        const headPos = this._recordPosition(head.page.index, head.order)
        IterableView.Update(
          head.record.rawHeader,
          TissueRoll.RecordHeaderAliasIndexOffset,
          IntegerConverter.ToArray32(index)
        )
        IterableView.Update(
          head.record.rawHeader,
          TissueRoll.RecordHeaderAliasOrderOffset,
          IntegerConverter.ToArray32(order)
        )
        IterableView.Update(
          head.record.rawHeader,
          TissueRoll.RecordHeaderAliasSaltOffset,
          IntegerConverter.ToArray32(salt)
        )
        FileView.Update(this.fd, headPos, head.record.rawHeader)
  
        return { id, data }
      }
      // Overflow 타입의 페이지일 경우엔, 페이지를 늘릴 수 있습니다.
      else {
        extendOverflow = true
      }
    }

    // 기존의 레코드보다 짧거나, overflow 페이지일 경우 덮어쓰기합니다
    const rawRecord = TissueRoll.CreateIterable(TissueRoll.RecordHeaderSize+payload.length, 0)
    IterableView.Update(rawRecord, 0, tail.record.rawHeader)

    const chunkSize = this.payloadSize-TissueRoll.CellSize
    const count = Math.ceil(rawRecord.length/chunkSize)

    // 업데이트할 레코드를 데이터 크기에 맞추어 새롭게 생성한 뒤
    const maxPayloadLen = IntegerConverter.ToArray32(
      Math.max(payload.length, tail.record.header.maxLength)
    )
    IterableView.Update(rawRecord, TissueRoll.RecordHeaderMaxLengthOffset, maxPayloadLen)
    IterableView.Update(rawRecord, TissueRoll.RecordHeaderLengthOffset, payloadLen)
    IterableView.Update(rawRecord, TissueRoll.RecordHeaderSize, payload)

    // 각 페이지에 맞추어 재삽입합니다
    let index = tail.page.index
    let order = tail.order

    for (let i = 0; i < count; i++) {
      const last = i === count-1
      const start = i*chunkSize
      const chunk = IterableView.Read(rawRecord, start, chunkSize)
      this._putPagePayload(index, order, chunk)

      const page = this._normalizeHeader(this._getHeader(index))
      index = page.next
      order = 1

      if (last) break
      if (extendOverflow && index === 0) {
        index = this._addEmptyPage({
          type: TissueRoll.OverflowType,
          free: 0,
          count: 1
        })
        this._putPageHeader(Object.assign({}, page, { next: index }))
      }
    }
    
    return { id, data }
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

  protected callInternalDelete(index: number, order: number, countDecrement: boolean): void {
    const pos = this._recordPosition(index, order)+TissueRoll.RecordHeaderDeletedOffset
    const buf = IntegerConverter.ToArray8(1)
    if (countDecrement) {
      const { count } = this.root
      FileView.Update(
        this.fd,
        TissueRoll.RootCountOffset,
        IntegerConverter.ToArray32(count-1)
      )
    }
    FileView.Update(this.fd, pos, buf)
  }

  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  delete(recordId: string): void {
    this.hooker.trigger('delete', recordId, (recordId) => {
      const { page, order } = this.pickRecord(recordId, false)
      this.callInternalDelete(page.index, order, true)
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
    fs.closeSync(this.fd)
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
