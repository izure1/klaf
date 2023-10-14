// src/TissueRoll.ts
import fs2 from "fs";

// src/TextConverter.ts
var TextConverter = class _TextConverter {
  static Encoder = new TextEncoder();
  static Decoder = new TextDecoder();
  static FromArray(array) {
    const r = Uint8Array.from(array);
    return _TextConverter.Decoder.decode(r);
  }
  static ToArray(str) {
    return Array.from(_TextConverter.Encoder.encode(str));
  }
};

// src/IntegerConverter.ts
var IntegerConverter = class _IntegerConverter {
  static Buffer8 = new ArrayBuffer(1);
  static Buffer16 = new ArrayBuffer(2);
  static Buffer32 = new ArrayBuffer(4);
  static Buffer64 = new ArrayBuffer(8);
  static View8 = new DataView(_IntegerConverter.Buffer8);
  static View16 = new DataView(_IntegerConverter.Buffer16);
  static View32 = new DataView(_IntegerConverter.Buffer32);
  static View64 = new DataView(_IntegerConverter.Buffer64);
  static FromArray8(array) {
    const view = _IntegerConverter.View8;
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i]);
    }
    return view.getUint8(0);
  }
  static FromArray16(array) {
    const view = _IntegerConverter.View16;
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i]);
    }
    return view.getUint16(0);
  }
  static FromArray32(array) {
    const view = _IntegerConverter.View32;
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i]);
    }
    return view.getUint32(0);
  }
  static FromArray64(array) {
    const view = _IntegerConverter.View64;
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i]);
    }
    return Number(view.getBigUint64(0));
  }
  static ToArray8(num) {
    const view = _IntegerConverter.View8;
    view.setUint8(0, num);
    const array = [];
    for (let i = 0; i < 1; i++) {
      array.push(view.getUint8(i));
    }
    return array;
  }
  static ToArray16(num) {
    const view = _IntegerConverter.View16;
    view.setUint16(0, num);
    const array = [];
    for (let i = 0; i < 2; i++) {
      array.push(view.getUint8(i));
    }
    return array;
  }
  static ToArray32(num) {
    const view = _IntegerConverter.View32;
    view.setUint32(0, num);
    const array = [];
    for (let i = 0; i < 4; i++) {
      array.push(view.getUint8(i));
    }
    return array;
  }
  static ToArray64(num) {
    const view = _IntegerConverter.View64;
    view.setBigUint64(0, BigInt(num));
    const array = [];
    for (let i = 0; i < 8; i++) {
      array.push(view.getUint8(i));
    }
    return array;
  }
};

// src/ErrorBuilder.ts
var ErrorBuilder = class {
  static ERR_DB_ALREADY_EXISTS(file) {
    return new Error(`The path '${file}' database file is already existing. If you want overwrite, pass a 'overwrite' parameter with 'true'.`);
  }
  static ERR_DB_INVALID(file) {
    return new Error(`The path '${file}' database file seems to be invalid. Maybe broken or incorrect format.`);
  }
  static ERR_DB_NO_EXISTS(file) {
    return new Error(`The database file not exists in '${file}'.`);
  }
  static ERR_ALREADY_DELETED(recordId) {
    return new Error(`The record '${recordId}' is already deleted.`);
  }
};

// src/IterableView.ts
import fs from "fs";
var IterableView = class {
  static Read(array, start, length = array.length - start) {
    return array.slice(start, start + length);
  }
  static Update(array, start, data) {
    for (let i = 0, len = Math.min(data.length, array.length - start); i < len; i++) {
      const j = start + i;
      array[j] = data[i];
    }
    return array;
  }
  static Ensure(array, len, fill) {
    if (array.length >= len) {
      return array;
    }
    const extended = new Array(len - array.length).fill(fill);
    array.push(...extended);
    return array;
  }
};
var FileView = class _FileView {
  static Size(fd) {
    return fs.fstatSync(fd).size;
  }
  static Read(fd, start, length = _FileView.Size(fd) - start) {
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, buf.length, start);
    return Array.from(buf);
  }
  static Update(fd, start, data) {
    const size = _FileView.Size(fd);
    const writable = Math.min(data.length, size - start);
    const chunk = data.slice(0, writable);
    const buf = Uint8Array.from(chunk);
    fs.writeSync(fd, buf, 0, buf.length, start);
    return chunk;
  }
  static Append(fd, data) {
    const buf = Uint8Array.from(data);
    const pos = fs.fstatSync(fd).size;
    fs.writeSync(fd, buf, 0, buf.length, pos);
  }
};

// src/TissueRoll.ts
var TissueRoll = class _TissueRoll {
  static DB_VERSION = "1.0.0";
  static DB_NAME = "TissueRoll";
  static RootValidStringOffset = 0;
  static RootValidStringSize = 10;
  static RootMajorVersionOffset = 10;
  static RootMajorVersionSize = 1;
  static RootMinorVersionOffset = 11;
  static RootMinorVersionSize = 1;
  static RootPatchVersionOffset = 12;
  static RootPatchVersionSize = 1;
  static RootIndexOffset = 13;
  static RootIndexSize = 4;
  static RootPayloadSizeOffset = 17;
  static RootPayloadSizeSize = 4;
  static RootTimestampOffset = 21;
  static RootTimestampSize = 8;
  static RootChunkSize = 100;
  static HeaderSize = 100;
  static CellSize = 4;
  static RecordHeaderSize = 40;
  static RecordHeaderIndexSize = 8;
  static RecordHeaderLengthSize = 4;
  static RecordHeaderMaxLengthSize = 4;
  static RecordHeaderDeletedSize = 1;
  static RecordHeaderIndexOffset = 0;
  static RecordHeaderLengthOffset = 8;
  static RecordHeaderMaxLengthOffset = 12;
  static RecordHeaderDeletedOffset = 16;
  static UnknownType = 0;
  static InternalType = 1;
  static OverflowType = 2;
  static SystemReservedType = 3;
  /**
   * It creates a new database file.
   * @param file This is the path where the database file will be created.
   * @param payloadSize This is the maximum data size a single page in the database can hold. The default is `1024`. If this value is too large or too small, it can affect performance.
   * @param overwrite This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  static Create(file, payloadSize = 1024, overwrite = false) {
    if (fs2.existsSync(file) && !overwrite) {
      throw ErrorBuilder.ERR_DB_ALREADY_EXISTS(file);
    }
    const fd = fs2.openSync(file, "w+");
    const inst = new _TissueRoll(fd, payloadSize);
    const root = _TissueRoll.CreateIterable(_TissueRoll.RootChunkSize, 0);
    const {
      DB_VERSION,
      DB_NAME,
      RootValidStringOffset,
      RootMajorVersionOffset,
      RootMinorVersionOffset,
      RootPatchVersionOffset,
      RootPayloadSizeOffset,
      RootTimestampOffset
    } = _TissueRoll;
    const [
      majorVersion,
      minorVersion,
      patchVersion
    ] = DB_VERSION.split(".");
    IterableView.Update(root, RootValidStringOffset, TextConverter.ToArray(DB_NAME));
    IterableView.Update(root, RootMajorVersionOffset, IntegerConverter.ToArray8(Number(majorVersion)));
    IterableView.Update(root, RootMinorVersionOffset, IntegerConverter.ToArray8(Number(minorVersion)));
    IterableView.Update(root, RootPatchVersionOffset, IntegerConverter.ToArray8(Number(patchVersion)));
    IterableView.Update(root, RootPayloadSizeOffset, IntegerConverter.ToArray32(payloadSize));
    IterableView.Update(root, RootTimestampOffset, IntegerConverter.ToArray64(Date.now()));
    FileView.Append(inst.fd, root);
    inst._addEmptyPage({ type: _TissueRoll.InternalType });
    return inst;
  }
  /**
   * It opens or creates a database file at the specified path. 
   * If `payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one.
   * @param file This is the path where the database file is located.
   * @param payloadSize If this value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `0`.
   */
  static Open(file, payloadSize = 0) {
    if (!fs2.existsSync(file)) {
      if (!payloadSize) {
        throw ErrorBuilder.ERR_DB_NO_EXISTS(file);
      } else {
        return _TissueRoll.Create(file, payloadSize);
      }
    }
    const fd = fs2.openSync(file, "r+");
    if (!_TissueRoll.CheckDBValid(fd)) {
      fs2.closeSync(fd);
      throw ErrorBuilder.ERR_DB_INVALID(file);
    }
    const root = _TissueRoll.ParseRootChunk(fd);
    return new _TissueRoll(fd, root.payloadSize);
  }
  static ParseRootChunk(fd) {
    const rHeader = FileView.Read(fd, 0, _TissueRoll.RootChunkSize);
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
      RootTimestampSize
    } = _TissueRoll;
    const majorVersion = IntegerConverter.FromArray8(
      IterableView.Read(rHeader, RootMajorVersionOffset, RootMajorVersionSize)
    );
    const minorVersion = IntegerConverter.FromArray8(
      IterableView.Read(rHeader, RootMinorVersionOffset, RootMinorVersionSize)
    );
    const patchVersion = IntegerConverter.FromArray8(
      IterableView.Read(rHeader, RootPatchVersionOffset, RootPatchVersionSize)
    );
    const index = IntegerConverter.FromArray32(
      IterableView.Read(rHeader, RootIndexOffset, RootIndexSize)
    );
    const payloadSize = IntegerConverter.FromArray32(
      IterableView.Read(rHeader, RootPayloadSizeOffset, RootPayloadSizeSize)
    );
    const timestamp = IntegerConverter.FromArray64(
      IterableView.Read(rHeader, RootTimestampOffset, RootTimestampSize)
    );
    return {
      majorVersion,
      minorVersion,
      patchVersion,
      payloadSize,
      timestamp,
      index
    };
  }
  static CreateIterable(len, fill) {
    return new Array(len).fill(fill);
  }
  static CheckDBValid(fd) {
    const chunk = FileView.Read(
      fd,
      _TissueRoll.RootValidStringOffset,
      _TissueRoll.RootValidStringSize
    );
    const text = TextConverter.FromArray(chunk);
    return text === _TissueRoll.DB_NAME;
  }
  chunkSize;
  headerSize;
  payloadSize;
  fd;
  constructor(fd, payloadSize) {
    if (payloadSize < _TissueRoll.CellSize) {
      fs2.closeSync(fd);
      throw new Error(`The payload size is too small. It must be greater than ${_TissueRoll.CellSize}. But got a ${payloadSize}`);
    }
    this.chunkSize = _TissueRoll.HeaderSize + payloadSize;
    this.headerSize = _TissueRoll.HeaderSize;
    this.payloadSize = payloadSize;
    this.fd = fd;
  }
  get root() {
    return _TissueRoll.ParseRootChunk(this.fd);
  }
  _createEmptyHeader({
    type = 0,
    index = 0,
    next = 0,
    count = 0,
    free = this.payloadSize - _TissueRoll.CellSize
  } = {}) {
    const header = _TissueRoll.CreateIterable(this.headerSize, 0);
    const rType = IntegerConverter.ToArray32(type);
    const rIndex = IntegerConverter.ToArray32(index);
    const rNext = IntegerConverter.ToArray32(next);
    const rCount = IntegerConverter.ToArray32(count);
    const rFree = IntegerConverter.ToArray32(free);
    IterableView.Update(header, 0, rType);
    IterableView.Update(header, 4, rIndex);
    IterableView.Update(header, 8, rNext);
    IterableView.Update(header, 12, rCount);
    IterableView.Update(header, 16, rFree);
    return header;
  }
  _createEmptyPayload() {
    return _TissueRoll.CreateIterable(this.payloadSize, 0);
  }
  _createEmptyPage(header) {
    return [
      ...this._createEmptyHeader(header),
      ...this._createEmptyPayload()
    ];
  }
  _addEmptyPage(header) {
    let { index } = this.root;
    index++;
    FileView.Update(this.fd, _TissueRoll.RootIndexOffset, IntegerConverter.ToArray32(index));
    const page = this._createEmptyPage({ ...header, index });
    FileView.Append(this.fd, page);
    return index;
  }
  _pagePosition(index) {
    return _TissueRoll.RootChunkSize + this.chunkSize * (index - 1);
  }
  _pagePayloadPosition(index) {
    return this._pagePosition(index) + this.headerSize;
  }
  _cellPosition(index, order) {
    const pagePos = this._pagePosition(index);
    const endOfPage = pagePos + this.chunkSize;
    return endOfPage - _TissueRoll.CellSize * order;
  }
  _recordPosition(index, order) {
    const payloadPos = this._pagePayloadPosition(index);
    const cellPos = this._cellPosition(index, order);
    const cellValue = FileView.Read(this.fd, cellPos, _TissueRoll.CellSize);
    const recordOffset = IntegerConverter.FromArray32(cellValue);
    return payloadPos + recordOffset;
  }
  _get(index) {
    const start = this._pagePosition(index);
    return FileView.Read(this.fd, start, this.chunkSize);
  }
  _recordId(index, order) {
    const sIndex = index.toString().padStart(4, "0");
    const sOrder = order.toString().padStart(4, "0");
    return Number(`1${sIndex}${sOrder}`);
  }
  _recordIdFromRaw(rawRecordId) {
    const index = IntegerConverter.FromArray32(IterableView.Read(rawRecordId, 0, 4));
    const order = IntegerConverter.FromArray32(IterableView.Read(rawRecordId, 4, 4));
    return this._recordId(index, order);
  }
  _normalizeRecordId(recordId) {
    const stringify = recordId.toString();
    const index = Number(stringify.slice(1, 5));
    const order = Number(stringify.slice(5, 9));
    return {
      index,
      order
    };
  }
  _rawRecordId(recordId) {
    const { index, order } = this._normalizeRecordId(recordId);
    return [
      ...IntegerConverter.ToArray32(index),
      ...IntegerConverter.ToArray32(order)
    ];
  }
  _createRecord(id, data) {
    const rawId = this._rawRecordId(id);
    const length = IntegerConverter.ToArray32(data.length);
    const recordHeader = _TissueRoll.CreateIterable(_TissueRoll.RecordHeaderSize, 0);
    IterableView.Update(recordHeader, _TissueRoll.RecordHeaderIndexOffset, rawId);
    IterableView.Update(recordHeader, _TissueRoll.RecordHeaderLengthOffset, length);
    IterableView.Update(recordHeader, _TissueRoll.RecordHeaderMaxLengthOffset, length);
    const record = [...recordHeader, ...data];
    return record;
  }
  _createCell(recordOffset) {
    return IntegerConverter.ToArray32(recordOffset);
  }
  _getRecord(index, order) {
    const recordPos = this._recordPosition(index, order);
    const recordHeader = FileView.Read(this.fd, recordPos, _TissueRoll.RecordHeaderSize);
    const recordPayloadPos = _TissueRoll.RecordHeaderSize + recordPos;
    const recordPayloadLength = IntegerConverter.FromArray32(
      IterableView.Read(
        recordHeader,
        _TissueRoll.RecordHeaderLengthOffset,
        _TissueRoll.RecordHeaderLengthSize
      )
    );
    let header = this._normalizeHeader(this._getHeader(index));
    if (!header.next) {
      const recordPayload = FileView.Read(this.fd, recordPayloadPos, recordPayloadLength);
      return [...recordHeader, ...recordPayload];
    }
    const record = [];
    const payloadMaxLength = this.payloadSize - _TissueRoll.CellSize;
    let remain = recordPayloadLength + _TissueRoll.RecordHeaderSize;
    while (remain > 0) {
      const pos = this._pagePayloadPosition(header.index);
      const size = Math.min(payloadMaxLength, Math.abs(remain));
      const chunk = FileView.Read(this.fd, pos, size);
      record.push(...chunk);
      if (!header.next) {
        break;
      }
      header = this._normalizeHeader(this._getHeader(header.next));
      remain -= size;
    }
    return record;
  }
  _normalizeRecord(record) {
    const rawHeader = IterableView.Read(record, 0, _TissueRoll.RecordHeaderSize);
    const rawPayload = IterableView.Read(record, _TissueRoll.RecordHeaderSize);
    const index = this._recordIdFromRaw(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderIndexOffset,
        _TissueRoll.RecordHeaderIndexSize
      )
    );
    const length = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderLengthOffset,
        _TissueRoll.RecordHeaderLengthSize
      )
    );
    const maxLength = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderMaxLengthOffset,
        _TissueRoll.RecordHeaderMaxLengthSize
      )
    );
    const deleted = IntegerConverter.FromArray8(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderDeletedOffset,
        _TissueRoll.RecordHeaderDeletedSize
      )
    );
    const header = {
      index,
      length,
      maxLength,
      deleted
    };
    const rawRecord = [...rawHeader, ...rawPayload];
    const payload = TextConverter.FromArray(rawPayload);
    return {
      rawRecord,
      rawHeader,
      rawPayload,
      header,
      payload
    };
  }
  _getHeader(index) {
    const page = this._get(index);
    const header = IterableView.Read(page, 0, this.headerSize);
    return header;
  }
  _normalizeHeader(header) {
    const type = IntegerConverter.FromArray32(IterableView.Read(header, 0, 4));
    const index = IntegerConverter.FromArray32(IterableView.Read(header, 4, 4));
    const next = IntegerConverter.FromArray32(IterableView.Read(header, 8, 4));
    const count = IntegerConverter.FromArray32(IterableView.Read(header, 12, 4));
    const free = IntegerConverter.FromArray32(IterableView.Read(header, 16, 4));
    return {
      type,
      index,
      next,
      count,
      free
    };
  }
  _getHeadPageIndex(index) {
    if (index <= 1) {
      return 1;
    }
    while (true) {
      const { type } = this._normalizeHeader(this._getHeader(index));
      if (type !== _TissueRoll.OverflowType) {
        break;
      }
      index--;
    }
    return index;
  }
  /**
   * Get record from database with a id.  
   * Don't pass an incorrect record ID. This does not ensure the validity of the record.
   * If you pass an incorrect record ID, it may result in returning non-existent or corrupted records.
   * @param recordId The record id what you want pick.
   */
  pick(recordId) {
    const { index, order } = this._normalizeRecordId(recordId);
    const page = this._normalizeHeader(this._getHeader(index));
    const rawRecord = this._getRecord(index, order);
    const record = this._normalizeRecord(rawRecord);
    if (record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(recordId);
    }
    return {
      page,
      record,
      order
    };
  }
  _putPageHead(header) {
    const pos = this._pagePosition(header.index);
    const rHeader = this._createEmptyHeader(header);
    FileView.Update(this.fd, pos, rHeader);
  }
  _putPagePayload(header, record) {
    const payloadPos = this._pagePayloadPosition(header.index);
    let recordPos = payloadPos;
    if (header.count) {
      const prevOrder = header.count;
      const prevRawRecord = this._getRecord(header.index, prevOrder);
      const prevRecord = this._normalizeRecord(prevRawRecord);
      const prevRecordPos = this._recordPosition(header.index, prevOrder);
      const prevRecordLength = prevRecord.header.length;
      recordPos = prevRecordPos + _TissueRoll.RecordHeaderSize + prevRecordLength;
    }
    const order = header.count + 1;
    const cellPos = this._cellPosition(header.index, order);
    const recordOffset = recordPos - payloadPos;
    const cell = this._createCell(recordOffset);
    FileView.Update(this.fd, recordPos, record);
    FileView.Update(this.fd, cellPos, cell);
  }
  _putJustOnePage(header, data) {
    const order = header.count + 1;
    const recordId = this._recordId(header.index, order);
    const record = this._createRecord(recordId, data);
    this._putPagePayload(header, record);
    const usage = _TissueRoll.RecordHeaderSize + _TissueRoll.CellSize + data.length;
    header.count += 1;
    header.free -= usage;
    this._putPageHead(header);
    return recordId;
  }
  _put(data) {
    let index = this._getHeadPageIndex(this.root.index);
    let header = this._normalizeHeader(this._getHeader(index));
    if (header.type !== _TissueRoll.InternalType) {
      index = this._addEmptyPage({ type: _TissueRoll.InternalType });
      header = this._normalizeHeader(this._getHeader(index));
    }
    const recordSize = _TissueRoll.RecordHeaderSize + data.length;
    const recordUsage = _TissueRoll.CellSize + recordSize;
    if (header.free >= recordUsage) {
      return this._putJustOnePage(header, data);
    }
    if (header.count) {
      index = this._addEmptyPage({ type: _TissueRoll.InternalType });
      header = this._normalizeHeader(this._getHeader(index));
    }
    const chunkSize = this.payloadSize - _TissueRoll.CellSize;
    let count = Math.ceil(recordSize / chunkSize);
    if (count === 1) {
      return this._putJustOnePage(header, data);
    }
    const order = header.count + 1;
    const recordId = this._recordId(header.index, order);
    const record = this._createRecord(recordId, data);
    const headIndex = index;
    for (let i = 0; i < count; i++) {
      const last = i === count - 1;
      const start = i * chunkSize;
      const chunk = IterableView.Read(record, start, chunkSize);
      const currentHeader = this._normalizeHeader(this._getHeader(index));
      this._putPagePayload(currentHeader, chunk);
      if (!last) {
        index = this._addEmptyPage({ type: _TissueRoll.OverflowType });
      }
      currentHeader.type = _TissueRoll.OverflowType;
      currentHeader.free = 0;
      currentHeader.next = index;
      if (last) {
        currentHeader.next = 0;
      }
      this._putPageHead(currentHeader);
    }
    const headHeader = this._normalizeHeader(this._getHeader(headIndex));
    headHeader.type = _TissueRoll.InternalType;
    headHeader.count = 1;
    headHeader.free = 0;
    this._putPageHead(headHeader);
    return recordId;
  }
  /**
   * Shut down the database to close file input and output.
   */
  close() {
    fs2.closeSync(this.fd);
  }
  /**
   * You store data in the database and receive a record ID for the saved data. This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
   * @param data The data string what you want store.
   * @returns The record id.
   */
  put(data) {
    const rData = TextConverter.ToArray(data);
    return this._put(rData);
  }
  /**
   * You can update an existing record.  
   * If the new data is smaller, it replaces the old one. If it's larger, a new record is created, and you get its ID. In this case, the old record is deleted and can't be used anymore.
   * @param recordId The record id what you want update.
   * @param data The data string what you want update.
   * @returns The updated record id.
   */
  update(recordId, data) {
    const payload = TextConverter.ToArray(data);
    const prev = this.pick(recordId);
    if (prev.record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(recordId);
    }
    if (prev.record.header.maxLength < payload.length) {
      this.delete(recordId);
      return this._put(payload);
    }
    const pos = this._recordPosition(prev.page.index, prev.order);
    const len = IntegerConverter.ToArray32(payload.length);
    IterableView.Ensure(
      prev.record.rawRecord,
      _TissueRoll.RecordHeaderSize + payload.length,
      0
    );
    IterableView.Update(prev.record.rawRecord, _TissueRoll.RecordHeaderLengthOffset, len);
    IterableView.Update(prev.record.rawRecord, _TissueRoll.RecordHeaderSize, payload);
    FileView.Update(this.fd, pos, prev.record.rawRecord);
    return recordId;
  }
  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  delete(recordId) {
    const { index, order } = this._normalizeRecordId(recordId);
    const pos = this._recordPosition(index, order) + _TissueRoll.RecordHeaderDeletedOffset;
    const buf = IntegerConverter.ToArray8(1);
    FileView.Update(this.fd, pos, buf);
  }
};
export {
  TissueRoll
};
