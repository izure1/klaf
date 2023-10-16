import fs from 'node:fs'

import type { FpeCipher } from 'node-fpe'

import { TextConverter } from './TextConverter'
import { IntegerConverter } from './IntegerConverter'
import { Base64Helper } from './Base64Helper'
import { ErrorBuilder } from './ErrorBuilder'
import { CryptoHelper } from './CryptoHelper'
import { FpeBuilder } from './FpeBuilder'
import { IterableView, FileView } from './IterableView'

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
  index: number
}

export class TissueRoll {
  protected static DB_VERSION                   = '2.0.0'
  protected static DB_NAME                      = 'TissueRoll'
  protected static RootValidStringOffset        = 0
  protected static RootValidStringSize          = 10
  protected static RootMajorVersionOffset       = TissueRoll.RootValidStringOffset+TissueRoll.RootValidStringSize
  protected static RootMajorVersionSize         = 1
  protected static RootMinorVersionOffset       = TissueRoll.RootMajorVersionOffset+TissueRoll.RootMajorVersionSize
  protected static RootMinorVersionSize         = 1
  protected static RootPatchVersionOffset       = TissueRoll.RootMinorVersionOffset+TissueRoll.RootMinorVersionSize
  protected static RootPatchVersionSize         = 1
  protected static RootIndexOffset              = TissueRoll.RootPatchVersionOffset+TissueRoll.RootPatchVersionSize
  protected static RootIndexSize                = 4
  protected static RootPayloadSizeOffset        = TissueRoll.RootIndexOffset+TissueRoll.RootIndexSize
  protected static RootPayloadSizeSize          = 4
  protected static RootTimestampOffset          = TissueRoll.RootPayloadSizeOffset+TissueRoll.RootPayloadSizeSize
  protected static RootTimestampSize            = 8
  protected static RootSecretKeyOffset          = TissueRoll.RootTimestampOffset+TissueRoll.RootTimestampSize
  protected static RootSecretKeySize            = 8

  protected static RootChunkSize                = 200
  protected static HeaderSize                   = 100
  protected static CellSize                     = 4
  protected static RecordHeaderSize             = 40
  protected static RecordHeaderIndexOffset      = 0
  protected static RecordHeaderIndexSize        = 4
  protected static RecordHeaderOrderOffset      = TissueRoll.RecordHeaderIndexOffset+TissueRoll.RecordHeaderIndexSize
  protected static RecordHeaderOrderSize        = 4
  protected static RecordHeaderSaltOffset       = TissueRoll.RecordHeaderOrderOffset+TissueRoll.RecordHeaderOrderSize
  protected static RecordHeaderSaltSize         = 4
  protected static RecordHeaderLengthOffset     = TissueRoll.RecordHeaderSaltOffset+TissueRoll.RecordHeaderSaltSize
  protected static RecordHeaderLengthSize       = 4
  protected static RecordHeaderMaxLengthOffset  = TissueRoll.RecordHeaderLengthOffset+TissueRoll.RecordHeaderLengthSize
  protected static RecordHeaderMaxLengthSize    = 4
  protected static RecordHeaderDeletedOffset    = TissueRoll.RecordHeaderMaxLengthOffset+TissueRoll.RecordHeaderMaxLengthSize
  protected static RecordHeaderDeletedSize      = 1
  protected static RecordHeaderAliasIndexOffset = TissueRoll.RecordHeaderDeletedOffset+TissueRoll.RecordHeaderDeletedSize
  protected static RecordHeaderAliasIndexSize   = 4
  protected static RecordHeaderAliasOrderOffset = TissueRoll.RecordHeaderAliasIndexOffset+TissueRoll.RecordHeaderAliasIndexSize
  protected static RecordHeaderAliasOrderSize   = 4
  protected static RecordHeaderAliasSaltOffset  = TissueRoll.RecordHeaderAliasOrderOffset+TissueRoll.RecordHeaderAliasOrderSize
  protected static RecordHeaderAliasSaltSize    = 4


  protected static UnknownType                  = 0
  protected static InternalType                 = 1
  protected static OverflowType                 = 2
  protected static SystemReservedType           = 3


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
    } = TissueRoll
    const [
      majorVersion,
      minorVersion,
      patchVersion
    ] = DB_VERSION.split('.')
    const secretKey = CryptoHelper.RandomBytes(RootSecretKeySize)
    IterableView.Update(root, RootValidStringOffset,  TextConverter.ToArray(DB_NAME))
    IterableView.Update(root, RootMajorVersionOffset, IntegerConverter.ToArray8(Number(majorVersion)))
    IterableView.Update(root, RootMinorVersionOffset, IntegerConverter.ToArray8(Number(minorVersion)))
    IterableView.Update(root, RootPatchVersionOffset, IntegerConverter.ToArray8(Number(patchVersion)))
    IterableView.Update(root, RootPayloadSizeOffset,  IntegerConverter.ToArray32(payloadSize))
    IterableView.Update(root, RootTimestampOffset,    IntegerConverter.ToArray64(BigInt(Date.now())))
    IterableView.Update(root, RootSecretKeyOffset,    Array.from(secretKey))

    fs.writeFileSync(file, Buffer.from(root))

    const inst = TissueRoll.Open(file)
    inst._addEmptyPage({ type: TissueRoll.InternalType })
    return inst
  }

  /**
   * It opens or creates a database file at the specified path. 
   * If `payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one.
   * @param file This is the path where the database file is located.
   * @param payloadSize If this value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `0`.
   */
  static Open(file: string, payloadSize = 0) {
    // 파일이 존재하지 않을 경우
    if (!fs.existsSync(file)) {
      if (!payloadSize) {
        throw ErrorBuilder.ERR_DB_NO_EXISTS(file)
      }
      // 옵션이 지정되었을 경우 새롭게 생성합니다
      else {
        return TissueRoll.Create(file, payloadSize)
      }
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
    return {
      majorVersion,
      minorVersion,
      patchVersion,
      payloadSize,
      timestamp,
      secretKey,
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


  protected readonly chunkSize: number
  protected readonly headerSize: number
  protected readonly payloadSize: number
  protected readonly fd: number
  protected readonly secretKey: string
  protected readonly fpe: FpeCipher

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
  }

  get root(): IRootHeader {
    return TissueRoll.ParseRootChunk(this.fd)
  }

  private _createEmptyHeader({
    type = 0,
    index = 0,
    next = 0,
    count = 0,
    free = this.payloadSize-TissueRoll.CellSize
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
    return [
      ...this._createEmptyHeader(header),
      ...this._createEmptyPayload()
    ]
  }

  private _addEmptyPage(header: Partial<IPageHeader>): number {
    // update root
    let { index } = this.root
    index++
    FileView.Update(this.fd, TissueRoll.RootIndexOffset, IntegerConverter.ToArray32(index))

    // extend payload
    const page = this._createEmptyPage({ ...header, index })
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
    const sIndex  = index.toString(16).padStart(8, '0')
    const sOrder  = order.toString(16).padStart(8, '0')
    const sSalt   = salt.toString(16).padStart(8, '0')
    const base64  = Base64Helper.UrlSafeEncode(`${sIndex}${sOrder}${sSalt}`)
    return this.fpe.encrypt(base64)
  }

  private _normalizeRecordId(recordId: string) {
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
  }

  private _rawRecordId(recordId: string): number[] {
    const { index, order, salt } = this._normalizeRecordId(recordId)
    return [
      ...IntegerConverter.ToArray32(index),
      ...IntegerConverter.ToArray32(order),
      ...IntegerConverter.ToArray32(salt),
    ]
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
    
    const record = [...recordHeader, ...data]
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
      return [...recordHeader, ...recordPayload]
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
    const rawRecord = [...rawHeader, ...rawPayload]
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

  protected pickRecord(recordId: string, includeUpdated: boolean): {
    page: ReturnType<TissueRoll['_normalizeHeader']>
    record: ReturnType<TissueRoll['_normalizeRecord']>
    order: number
  } {
    const { index, order, salt } = this._normalizeRecordId(recordId)

    const page      = this._normalizeHeader(this._getHeader(index))
    const rawRecord = this._getRecord(index, order)
    const record    = this._normalizeRecord(rawRecord)
    
    if (includeUpdated && record.header.aliasIndex && record.header.aliasOrder) {
      return this.pickRecord(record.header.aliasId, false)
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
   * Get record from database with a id.  
   * Don't pass an incorrect record ID. This does not ensure the validity of the record.
   * If you pass an incorrect record ID, it may result in returning non-existent or corrupted records.
   * @param recordId The record id what you want pick.
   */
  pick(recordId: string) {
    return this.pickRecord(recordId, true)
  }

  private _putPageHead(header: IPageHeader): void {
    const pos = this._pagePosition(header.index)
    const rHeader = this._createEmptyHeader(header)
    FileView.Update(this.fd, pos, rHeader)
  }

  private _putPagePayload(header: IPageHeader, record: number[]): void {
    const payloadPos = this._pagePayloadPosition(header.index)
    let recordPos = payloadPos
    if (header.count) {
      const prevOrder         = header.count
      const prevRawRecord     = this._getRecord(header.index, prevOrder)
      const prevRecord        = this._normalizeRecord(prevRawRecord)
      const prevRecordPos     = this._recordPosition(header.index, prevOrder)
      const prevRecordLength  = prevRecord.header.length
      recordPos = prevRecordPos+TissueRoll.RecordHeaderSize+prevRecordLength
    }
    
    const order = header.count+1
    const cellPos = this._cellPosition(header.index, order)

    const recordOffset = recordPos-payloadPos
    const cell = this._createCell(recordOffset)

    // update payload
    FileView.Update(this.fd, recordPos, record)
    // update cell
    FileView.Update(this.fd, cellPos, cell)
  }

  private _putJustOnePage(header: IPageHeader, data: number[]): string {
    const order     = header.count+1
    const salt      = this._createSalt()
    const recordId  = this._recordId(header.index, order, salt)
    const record    = this._createRecord(recordId, data)

    this._putPagePayload(header, record)
    
    const usage = TissueRoll.RecordHeaderSize+TissueRoll.CellSize+data.length
    header.count += 1
    header.free -= usage
    this._putPageHead(header)

    return recordId
  }

  private _put(data: number[]): string {
    let index   = this._getHeadPageIndex(this.root.index)
    let header  = this._normalizeHeader(this._getHeader(index))

    if (header.type !== TissueRoll.InternalType) {
      index   = this._addEmptyPage({ type: TissueRoll.InternalType })
      header  = this._normalizeHeader(this._getHeader(index))
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
    let count = Math.ceil(recordSize/chunkSize)
    
    // 한 페이지에 삽입이 가능할 경우, Internal 타입으로 생성되어야 하며, 삽입 후 종료되어야 합니다.
    if (count === 1) {
      return this._putJustOnePage(header, data)
    }
    
    // Overflow 타입의 페이지입니다.
    // 다음 삽입 시 무조건 새로운 페이지를 만들어야하므로, free, count 값이 고정됩니다.
    const order       = header.count+1
    const salt        = this._createSalt()
    const recordId    = this._recordId(header.index, order, salt)
    const record      = this._createRecord(recordId, data)
    const headIndex   = index

    for (let i = 0; i < count; i++) {
      const last = i === count-1
      const start = i*chunkSize
      const chunk = IterableView.Read(record, start, chunkSize)
      
      const currentHeader = this._normalizeHeader(this._getHeader(index))
      this._putPagePayload(currentHeader, chunk)
      
      if (!last) {
        index = this._addEmptyPage({ type: TissueRoll.OverflowType })
      }
      currentHeader.type = TissueRoll.OverflowType
      currentHeader.free = 0
      currentHeader.next = index
      if (last) {
        currentHeader.next = 0
      }
      this._putPageHead(currentHeader)
    }
    const headHeader = this._normalizeHeader(this._getHeader(headIndex))
    headHeader.type = TissueRoll.InternalType
    headHeader.count = 1
    headHeader.free = 0
    this._putPageHead(headHeader)

    return recordId
  }

  /**
   * Shut down the database to close file input and output.
   */
  close(): void {
    fs.closeSync(this.fd)
  }

  /**
   * You store data in the database and receive a record ID for the saved data. This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
   * @param data The data string what you want store.
   * @returns The record id.
   */
  put(data: string): string {
    const rData = TextConverter.ToArray(data)
    return this._put(rData)
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
    const payload = TextConverter.ToArray(data)
    const before = this.pickRecord(recordId, false)

    if (before.record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(recordId)
    }
    
    const pos = this._recordPosition(before.page.index, before.order)
    const len = IntegerConverter.ToArray32(payload.length)

    if (before.record.header.maxLength < payload.length) {
      const afterRecordId = this._put(payload)
      const { index, order, salt } = this._normalizeRecordId(afterRecordId)

      if (before.record.header.aliasIndex && before.record.header.aliasOrder) {
        this._delete(
          before.record.header.aliasIndex,
          before.record.header.aliasOrder
        )
      }

      const updatedRawHeader = [...before.record.rawHeader]
      IterableView.Update(
        updatedRawHeader,
        TissueRoll.RecordHeaderAliasIndexOffset,
        IntegerConverter.ToArray32(index)
      )
      IterableView.Update(
        updatedRawHeader,
        TissueRoll.RecordHeaderAliasOrderOffset,
        IntegerConverter.ToArray32(order)
      )
      IterableView.Update(
        updatedRawHeader,
        TissueRoll.RecordHeaderAliasSaltOffset,
        IntegerConverter.ToArray32(salt)
      )
      FileView.Update(this.fd, pos, updatedRawHeader)

      return recordId
    }

    IterableView.Ensure(
      before.record.rawRecord,
      TissueRoll.RecordHeaderSize+payload.length,
      0
    )
    IterableView.Update(before.record.rawRecord, TissueRoll.RecordHeaderLengthOffset, len)
    IterableView.Update(before.record.rawRecord, TissueRoll.RecordHeaderSize, payload)
    FileView.Update(this.fd, pos, before.record.rawRecord)
    
    return recordId
  }

  private _delete(index: number, order: number): void {
    const pos = this._recordPosition(index, order)+TissueRoll.RecordHeaderDeletedOffset
    const buf = IntegerConverter.ToArray8(1)
    
    FileView.Update(this.fd, pos, buf)
  }

  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  delete(recordId: string): void {
    const { page, order } = this.pickRecord(recordId, false)
    this._delete(page.index, order)
  }

  /**
   * It returns whether the record exists in the database. If it has been deleted or has an invalid record ID, it returns `false`.
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
}
