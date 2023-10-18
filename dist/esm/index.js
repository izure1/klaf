var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/node-fpe/lib/index.js
var require_lib = __commonJS({
  "node_modules/node-fpe/lib/index.js"(exports, module) {
    var crypto = __require("crypto");
    var digits = "1234567890".split("");
    module.exports = function({ secret, domain = digits }) {
      if (!secret) {
        throw new Error("`secret` is required");
      }
      function enc(text) {
        return crypto.createHmac("sha256", secret).update(text).digest("hex");
      }
      const sorted = domain.map((c) => c).sort((c1, c2) => enc(c1).localeCompare(enc(c2)));
      const encTable = {};
      const decTable = {};
      for (let i in domain) {
        encTable[domain[i]] = sorted[i];
        decTable[sorted[i]] = domain[i];
      }
      function validate(text, result) {
        if (text.length !== result.length) {
          throw new Error(
            `some of the input characters are not in the cipher's domain: [${domain}]`
          );
        }
      }
      function encrypt(text) {
        if (typeof text !== "string") {
          throw new Error("input is not a string");
        }
        const encrypted = text.split("").map((c) => encTable[c]).join("");
        validate(text, encrypted);
        return encrypted;
      }
      function decrypt(text) {
        if (typeof text !== "string") {
          throw new Error("input is not a string");
        }
        const decrypted = text.split("").map((c) => decTable[c]).join("");
        validate(text, decrypted);
        return decrypted;
      }
      return { encrypt, decrypt };
    };
  }
});

// src/TissueRoll.ts
import fs2 from "node:fs";

// node_modules/hookall/dist/esm/index.js
var __defProp2 = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var HookallStore = class extends WeakMap {
  ensure(obj, key) {
    if (!this.has(obj)) {
      const scope2 = {};
      this.set(obj, scope2);
    }
    const scope = this.get(obj);
    if (!Object.prototype.hasOwnProperty.call(scope, key)) {
      scope[key] = /* @__PURE__ */ new Map();
    }
    return scope[key];
  }
};
var _Hookall = class {
  beforeHooks;
  afterHooks;
  constructor(target) {
    this.beforeHooks = _Hookall._Store.ensure(target, "before");
    this.afterHooks = _Hookall._Store.ensure(target, "after");
  }
  _ensureCommand(hooks, command) {
    if (!hooks.has(command)) {
      hooks.set(command, []);
    }
    return hooks.get(command);
  }
  _createWrapper(command, callback, repeat) {
    return {
      callback,
      command,
      repeat
    };
  }
  _on(hooks, command, callback, repeat) {
    const wrappers = this._ensureCommand(hooks, command);
    const wrapper = this._createWrapper(command, callback, repeat);
    wrappers.unshift(wrapper);
  }
  onBefore(command, callback) {
    this._on(this.beforeHooks, command, callback, -1);
    return this;
  }
  onceBefore(command, callback) {
    this._on(this.beforeHooks, command, callback, 1);
    return this;
  }
  onAfter(command, callback) {
    this._on(this.afterHooks, command, callback, -1);
    return this;
  }
  onceAfter(command, callback) {
    this._on(this.afterHooks, command, callback, 1);
    return this;
  }
  _off(hooks, command, callback) {
    const wrappers = this._ensureCommand(hooks, command);
    if (callback) {
      const i = wrappers.findIndex((wrapper) => wrapper.callback === callback);
      if (i !== -1) {
        wrappers.splice(i, 1);
      }
    } else {
      wrappers.length = 0;
    }
    return this;
  }
  offBefore(command, callback) {
    this._off(this.beforeHooks, command, callback);
    return this;
  }
  offAfter(command, callback) {
    this._off(this.afterHooks, command, callback);
    return this;
  }
  async _hookWith(hooks, command, value) {
    let wrappers = this._ensureCommand(hooks, command);
    let i = wrappers.length;
    while (i--) {
      const wrapper = wrappers[i];
      value = await wrapper.callback(value);
      wrapper.repeat -= 1;
      if (wrapper.repeat === 0) {
        this._off(hooks, command, wrapper.callback);
      }
    }
    return value;
  }
  async trigger(command, initialValue, callback) {
    let value;
    value = await this._hookWith(this.beforeHooks, command, initialValue);
    value = await callback(value);
    value = await this._hookWith(this.afterHooks, command, value);
    return value;
  }
};
var Hookall = _Hookall;
__publicField(Hookall, "Global", {});
__publicField(Hookall, "_Store", new HookallStore());
var HookallStore2 = class extends WeakMap {
  ensure(obj, key) {
    if (!this.has(obj)) {
      const scope2 = {};
      this.set(obj, scope2);
    }
    const scope = this.get(obj);
    if (!Object.prototype.hasOwnProperty.call(scope, key)) {
      scope[key] = /* @__PURE__ */ new Map();
    }
    return scope[key];
  }
};
var _HookallSync = class {
  beforeHooks;
  afterHooks;
  constructor(target) {
    this.beforeHooks = _HookallSync._Store.ensure(target, "before");
    this.afterHooks = _HookallSync._Store.ensure(target, "after");
  }
  _ensureCommand(hooks, command) {
    if (!hooks.has(command)) {
      hooks.set(command, []);
    }
    return hooks.get(command);
  }
  _createWrapper(command, callback, repeat) {
    return {
      callback,
      command,
      repeat
    };
  }
  _on(hooks, command, callback, repeat) {
    const wrappers = this._ensureCommand(hooks, command);
    const wrapper = this._createWrapper(command, callback, repeat);
    wrappers.unshift(wrapper);
  }
  onBefore(command, callback) {
    this._on(this.beforeHooks, command, callback, -1);
    return this;
  }
  onceBefore(command, callback) {
    this._on(this.beforeHooks, command, callback, 1);
    return this;
  }
  onAfter(command, callback) {
    this._on(this.afterHooks, command, callback, -1);
    return this;
  }
  onceAfter(command, callback) {
    this._on(this.afterHooks, command, callback, 1);
    return this;
  }
  _off(hooks, command, callback) {
    const wrappers = this._ensureCommand(hooks, command);
    if (callback) {
      const i = wrappers.findIndex((wrapper) => wrapper.callback === callback);
      if (i !== -1) {
        wrappers.splice(i, 1);
      }
    } else {
      wrappers.length = 0;
    }
    return this;
  }
  offBefore(command, callback) {
    this._off(this.beforeHooks, command, callback);
    return this;
  }
  offAfter(command, callback) {
    this._off(this.afterHooks, command, callback);
    return this;
  }
  _hookWith(hooks, command, value) {
    let wrappers = this._ensureCommand(hooks, command);
    let i = wrappers.length;
    while (i--) {
      const wrapper = wrappers[i];
      value = wrapper.callback(value);
      wrapper.repeat -= 1;
      if (wrapper.repeat === 0) {
        this._off(hooks, command, wrapper.callback);
      }
    }
    return value;
  }
  trigger(command, initialValue, callback) {
    let value;
    value = this._hookWith(this.beforeHooks, command, initialValue);
    value = callback(value);
    value = this._hookWith(this.afterHooks, command, value);
    return value;
  }
};
var HookallSync = _HookallSync;
__publicField(HookallSync, "Global", {});
__publicField(HookallSync, "_Store", new HookallStore2());
function useHookallSync(target = HookallSync.Global) {
  return new HookallSync(target);
}

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
    return view.getBigUint64(0);
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
    view.setBigUint64(0, num);
    const array = [];
    for (let i = 0; i < 8; i++) {
      array.push(view.getUint8(i));
    }
    return array;
  }
};

// src/Base64Helper.ts
var Base64Helper = class {
  static UrlDomain = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=+/".split("");
  static UrlSafeDomain = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-_".split("");
  static UrlSafeEncode(plain) {
    return btoa(plain).replaceAll("+", "-").replaceAll("/", "_");
  }
  static UrlSafeDecode(base64) {
    return atob(base64.replaceAll("-", "+").replaceAll("_", "/"));
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
  static ERR_INVALID_RECORD(recordId) {
    return new Error(`The record '${recordId}' is invalid. Maybe incorrect id.`);
  }
};

// src/CryptoHelper.ts
import { randomBytes, getRandomValues, createCipheriv, createDecipheriv } from "node:crypto";
var CryptoHelper = class {
  static RandomBytes(size) {
    return getRandomValues(new Uint8Array(size));
  }
  static EncryptAES256(text, secret) {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", secret, iv);
    const a = cipher.update(text, "utf8");
    const b = cipher.final();
    const tag = cipher.getAuthTag();
    return Buffer.concat([a, b]).toString("hex") + ":" + iv.toString("hex") + ":" + tag.toString("hex");
  }
  static DecryptAES256(text, secret) {
    const [encryptedText, iv, tag] = text.split(":");
    const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    const a = decipher.update(encryptedText, "hex", "utf8");
    const b = decipher.final("utf8");
    return a + b;
  }
};

// src/FpeBuilder.ts
var import_node_fpe = __toESM(require_lib());
var FpeBuilder = class {
  _secret;
  _domain;
  constructor() {
    this._secret = "";
    this._domain = [];
  }
  setSecretKey(secret) {
    this._secret = secret;
    return this;
  }
  setDomain(domain) {
    this._domain = domain;
    return this;
  }
  build() {
    return (0, import_node_fpe.default)({
      secret: this._secret,
      domain: this._domain
    });
  }
};

// src/IterableView.ts
import fs from "node:fs";
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
  static DB_VERSION = "2.0.0";
  static DB_NAME = "TissueRoll";
  static RootValidStringOffset = 0;
  static RootValidStringSize = 10;
  static RootMajorVersionOffset = _TissueRoll.RootValidStringOffset + _TissueRoll.RootValidStringSize;
  static RootMajorVersionSize = 1;
  static RootMinorVersionOffset = _TissueRoll.RootMajorVersionOffset + _TissueRoll.RootMajorVersionSize;
  static RootMinorVersionSize = 1;
  static RootPatchVersionOffset = _TissueRoll.RootMinorVersionOffset + _TissueRoll.RootMinorVersionSize;
  static RootPatchVersionSize = 1;
  static RootIndexOffset = _TissueRoll.RootPatchVersionOffset + _TissueRoll.RootPatchVersionSize;
  static RootIndexSize = 4;
  static RootPayloadSizeOffset = _TissueRoll.RootIndexOffset + _TissueRoll.RootIndexSize;
  static RootPayloadSizeSize = 4;
  static RootTimestampOffset = _TissueRoll.RootPayloadSizeOffset + _TissueRoll.RootPayloadSizeSize;
  static RootTimestampSize = 8;
  static RootSecretKeyOffset = _TissueRoll.RootTimestampOffset + _TissueRoll.RootTimestampSize;
  static RootSecretKeySize = 8;
  static RootChunkSize = 200;
  static HeaderSize = 100;
  static CellSize = 4;
  static RecordHeaderSize = 40;
  static RecordHeaderIndexOffset = 0;
  static RecordHeaderIndexSize = 4;
  static RecordHeaderOrderOffset = _TissueRoll.RecordHeaderIndexOffset + _TissueRoll.RecordHeaderIndexSize;
  static RecordHeaderOrderSize = 4;
  static RecordHeaderSaltOffset = _TissueRoll.RecordHeaderOrderOffset + _TissueRoll.RecordHeaderOrderSize;
  static RecordHeaderSaltSize = 4;
  static RecordHeaderLengthOffset = _TissueRoll.RecordHeaderSaltOffset + _TissueRoll.RecordHeaderSaltSize;
  static RecordHeaderLengthSize = 4;
  static RecordHeaderMaxLengthOffset = _TissueRoll.RecordHeaderLengthOffset + _TissueRoll.RecordHeaderLengthSize;
  static RecordHeaderMaxLengthSize = 4;
  static RecordHeaderDeletedOffset = _TissueRoll.RecordHeaderMaxLengthOffset + _TissueRoll.RecordHeaderMaxLengthSize;
  static RecordHeaderDeletedSize = 1;
  static RecordHeaderAliasIndexOffset = _TissueRoll.RecordHeaderDeletedOffset + _TissueRoll.RecordHeaderDeletedSize;
  static RecordHeaderAliasIndexSize = 4;
  static RecordHeaderAliasOrderOffset = _TissueRoll.RecordHeaderAliasIndexOffset + _TissueRoll.RecordHeaderAliasIndexSize;
  static RecordHeaderAliasOrderSize = 4;
  static RecordHeaderAliasSaltOffset = _TissueRoll.RecordHeaderAliasOrderOffset + _TissueRoll.RecordHeaderAliasOrderSize;
  static RecordHeaderAliasSaltSize = 4;
  static UnknownType = 0;
  static InternalType = 1;
  static OverflowType = 2;
  static SystemReservedType = 3;
  /**
   * It creates a new database file.
   * @param file This is the path where the database file will be created.
   * @param payloadSize This is the maximum data size a single page in the database can hold. The default is `8192`. If this value is too large or too small, it can affect performance.
   * @param overwrite This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  static Create(file, payloadSize = 8192, overwrite = false) {
    if (fs2.existsSync(file) && !overwrite) {
      throw ErrorBuilder.ERR_DB_ALREADY_EXISTS(file);
    }
    const root = _TissueRoll.CreateIterable(_TissueRoll.RootChunkSize, 0);
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
      RootSecretKeySize
    } = _TissueRoll;
    const [
      majorVersion,
      minorVersion,
      patchVersion
    ] = DB_VERSION.split(".");
    const secretKey = CryptoHelper.RandomBytes(RootSecretKeySize);
    IterableView.Update(root, RootValidStringOffset, TextConverter.ToArray(DB_NAME));
    IterableView.Update(root, RootMajorVersionOffset, IntegerConverter.ToArray8(Number(majorVersion)));
    IterableView.Update(root, RootMinorVersionOffset, IntegerConverter.ToArray8(Number(minorVersion)));
    IterableView.Update(root, RootPatchVersionOffset, IntegerConverter.ToArray8(Number(patchVersion)));
    IterableView.Update(root, RootPayloadSizeOffset, IntegerConverter.ToArray32(payloadSize));
    IterableView.Update(root, RootTimestampOffset, IntegerConverter.ToArray64(BigInt(Date.now())));
    IterableView.Update(root, RootSecretKeyOffset, Array.from(secretKey));
    fs2.writeFileSync(file, Buffer.from(root));
    const inst = _TissueRoll.Open(file);
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
    const secretBuf = Buffer.from(IntegerConverter.ToArray64(root.secretKey));
    const secretKey = secretBuf.toString("base64");
    return new _TissueRoll(fd, secretKey, root.payloadSize);
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
      RootTimestampSize,
      RootSecretKeyOffset,
      RootSecretKeySize
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
    const secretKey = IntegerConverter.FromArray64(
      IterableView.Read(rHeader, RootSecretKeyOffset, RootSecretKeySize)
    );
    return {
      majorVersion,
      minorVersion,
      patchVersion,
      payloadSize,
      timestamp,
      secretKey,
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
  secretKey;
  fpe;
  hooker;
  constructor(fd, secretKey, payloadSize) {
    if (payloadSize < _TissueRoll.CellSize) {
      fs2.closeSync(fd);
      throw new Error(`The payload size is too small. It must be greater than ${_TissueRoll.CellSize}. But got a ${payloadSize}`);
    }
    this.chunkSize = _TissueRoll.HeaderSize + payloadSize;
    this.headerSize = _TissueRoll.HeaderSize;
    this.payloadSize = payloadSize;
    this.fd = fd;
    this.secretKey = secretKey;
    this.fpe = new FpeBuilder().setSecretKey(secretKey).setDomain(Base64Helper.UrlSafeDomain).build();
    this.hooker = useHookallSync(this);
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
  _createSalt() {
    return IntegerConverter.FromArray32(CryptoHelper.RandomBytes(4));
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
  _recordId(index, order, salt) {
    const sIndex = index.toString(16).padStart(8, "0");
    const sOrder = order.toString(16).padStart(8, "0");
    const sSalt = salt.toString(16).padStart(8, "0");
    const base64 = Base64Helper.UrlSafeEncode(`${sIndex}${sOrder}${sSalt}`);
    return this.fpe.encrypt(base64);
  }
  _normalizeRecordId(recordId) {
    const base64 = this.fpe.decrypt(recordId);
    const plain = Base64Helper.UrlSafeDecode(base64);
    const index = parseInt(plain.slice(0, 8), 16);
    const order = parseInt(plain.slice(8, 16), 16);
    const salt = parseInt(plain.slice(16, 24), 16);
    return {
      index,
      order,
      salt
    };
  }
  _rawRecordId(recordId) {
    const { index, order, salt } = this._normalizeRecordId(recordId);
    return [
      ...IntegerConverter.ToArray32(index),
      ...IntegerConverter.ToArray32(order),
      ...IntegerConverter.ToArray32(salt)
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
    const index = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderIndexOffset,
        _TissueRoll.RecordHeaderIndexSize
      )
    );
    const order = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderOrderOffset,
        _TissueRoll.RecordHeaderOrderSize
      )
    );
    const salt = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderSaltOffset,
        _TissueRoll.RecordHeaderSaltSize
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
    const aliasIndex = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderAliasIndexOffset,
        _TissueRoll.RecordHeaderAliasIndexSize
      )
    );
    const aliasOrder = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderAliasOrderOffset,
        _TissueRoll.RecordHeaderAliasOrderSize
      )
    );
    const aliasSalt = IntegerConverter.FromArray32(
      IterableView.Read(
        rawHeader,
        _TissueRoll.RecordHeaderAliasSaltOffset,
        _TissueRoll.RecordHeaderAliasSaltSize
      )
    );
    const id = this._recordId(index, order, salt);
    const aliasId = this._recordId(aliasIndex, aliasOrder, aliasSalt);
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
  pickRecord(recordId, recursiveAlias) {
    const { index, order, salt } = this._normalizeRecordId(recordId);
    const page = this._normalizeHeader(this._getHeader(index));
    const rawRecord = this._getRecord(index, order);
    const record = this._normalizeRecord(rawRecord);
    if (recursiveAlias && record.header.aliasIndex && record.header.aliasOrder) {
      return this.pickRecord(record.header.aliasId, recursiveAlias);
    }
    if (record.header.salt !== salt) {
      throw ErrorBuilder.ERR_INVALID_RECORD(recordId);
    }
    if (record.header.deleted) {
      throw ErrorBuilder.ERR_ALREADY_DELETED(recordId);
    }
    return {
      page,
      record,
      order
    };
  }
  /**
   * Get record from database with a id.  
   * Don't pass an incorrect record ID. This does not ensure the validity of the record.
   * If you pass an incorrect record ID, it may result in returning non-existent or corrupted records.
   * @param recordId The record id what you want pick.
   */
  pick(recordId) {
    return this.pickRecord(recordId, true);
  }
  _putPageHeader(header) {
    const pos = this._pagePosition(header.index);
    const rHeader = this._createEmptyHeader(header);
    FileView.Update(this.fd, pos, rHeader);
  }
  _putPagePayload(index, order, record) {
    const payloadPos = this._pagePayloadPosition(index);
    const prevOrder = order - 1;
    let recordPos;
    if (order > 1) {
      const prevRecord = this._normalizeRecord(this._getRecord(index, prevOrder));
      recordPos = this._recordPosition(index, prevOrder) + prevRecord.rawRecord.length;
    } else {
      recordPos = payloadPos;
    }
    const cellPos = this._cellPosition(index, order);
    const cell = this._createCell(recordPos - payloadPos);
    FileView.Update(this.fd, recordPos, record);
    FileView.Update(this.fd, cellPos, cell);
  }
  _putJustOnePage(header, data) {
    const salt = this._createSalt();
    const recordId = this._recordId(header.index, header.count + 1, salt);
    const record = this._createRecord(recordId, data);
    this._putPagePayload(header.index, header.count + 1, record);
    const usage = _TissueRoll.RecordHeaderSize + _TissueRoll.CellSize + data.length;
    header.count += 1;
    header.free -= usage;
    this._putPageHeader(header);
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
    const count = Math.ceil(recordSize / chunkSize);
    if (count === 1) {
      return this._putJustOnePage(header, data);
    }
    const salt = this._createSalt();
    const recordId = this._recordId(header.index, header.count + 1, salt);
    const record = this._createRecord(recordId, data);
    const headIndex = index;
    for (let i = 0; i < count; i++) {
      const last = i === count - 1;
      const start = i * chunkSize;
      const chunk = IterableView.Read(record, start, chunkSize);
      const currentHeader = this._normalizeHeader(this._getHeader(index));
      this._putPagePayload(currentHeader.index, currentHeader.count + 1, chunk);
      if (!last) {
        index = this._addEmptyPage({ type: _TissueRoll.OverflowType });
      }
      currentHeader.type = _TissueRoll.OverflowType;
      currentHeader.free = 0;
      currentHeader.next = index;
      currentHeader.count += 1;
      if (last) {
        currentHeader.next = 0;
      }
      this._putPageHeader(currentHeader);
    }
    const headHeader = this._normalizeHeader(this._getHeader(headIndex));
    headHeader.type = _TissueRoll.InternalType;
    headHeader.count = 1;
    headHeader.free = 0;
    this._putPageHeader(headHeader);
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
    return this.hooker.trigger("put", data, (data2) => {
      const rData = TextConverter.ToArray(data2);
      const id = this._put(rData);
      return id;
    });
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
  update(recordId, data) {
    const information = this.hooker.trigger("update", { recordId, data }, ({ recordId: recordId2, data: data2 }) => {
      const payload = TextConverter.ToArray(data2);
      const payloadLen = IntegerConverter.ToArray32(payload.length);
      const head = this.pickRecord(recordId2, false);
      const tail = this.pickRecord(recordId2, true);
      if (tail.record.header.deleted) {
        throw ErrorBuilder.ERR_ALREADY_DELETED(recordId2);
      }
      if (tail.record.header.maxLength < payload.length) {
        const afterRecordId = this._put(payload);
        const { index: index2, order: order2, salt } = this._normalizeRecordId(afterRecordId);
        if (tail.record.header.aliasIndex && tail.record.header.aliasOrder) {
          this._delete(
            tail.record.header.aliasIndex,
            tail.record.header.aliasOrder
          );
        }
        const headPos = this._recordPosition(head.page.index, head.order);
        IterableView.Update(
          head.record.rawHeader,
          _TissueRoll.RecordHeaderAliasIndexOffset,
          IntegerConverter.ToArray32(index2)
        );
        IterableView.Update(
          head.record.rawHeader,
          _TissueRoll.RecordHeaderAliasOrderOffset,
          IntegerConverter.ToArray32(order2)
        );
        IterableView.Update(
          head.record.rawHeader,
          _TissueRoll.RecordHeaderAliasSaltOffset,
          IntegerConverter.ToArray32(salt)
        );
        FileView.Update(this.fd, headPos, head.record.rawHeader);
        return { recordId: recordId2, data: data2 };
      }
      const rawRecord = _TissueRoll.CreateIterable(_TissueRoll.RecordHeaderSize + payload.length, 0);
      IterableView.Update(rawRecord, 0, tail.record.rawHeader);
      const chunkSize = this.payloadSize - _TissueRoll.CellSize;
      const count = Math.ceil(rawRecord.length / chunkSize);
      IterableView.Update(rawRecord, _TissueRoll.RecordHeaderLengthOffset, payloadLen);
      IterableView.Update(rawRecord, _TissueRoll.RecordHeaderSize, payload);
      let index = tail.page.index;
      let order = tail.order;
      for (let i = 0; i < count; i++) {
        const start = i * chunkSize;
        const chunk = IterableView.Read(rawRecord, start, chunkSize);
        this._putPagePayload(index, order, chunk);
        const page = this._normalizeHeader(this._getHeader(index));
        index = page.next;
        order = 1;
      }
      return { recordId: recordId2, data: data2 };
    });
    return information.recordId;
  }
  _delete(index, order) {
    const pos = this._recordPosition(index, order) + _TissueRoll.RecordHeaderDeletedOffset;
    const buf = IntegerConverter.ToArray8(1);
    FileView.Update(this.fd, pos, buf);
  }
  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  delete(recordId) {
    this.hooker.trigger("delete", recordId, (recordId2) => {
      const { page, order } = this.pickRecord(recordId2, false);
      this._delete(page.index, order);
      return recordId2;
    });
  }
  /**
   * It returns whether the record exists in the database. If it has been deleted or has an invalid record ID, it returns `false`.
   * @param recordId The record id what you want verify.
   */
  exists(recordId) {
    try {
      this.pickRecord(recordId, false);
      return true;
    } catch (e) {
      return false;
    }
  }
  /**
   * Register preprocessing functions for hooking before executing database operations such as `put`, `update`, and `delete` commands.  
   * The value returned by this callback function is what is actually applied to the database.
   * 
   * If multiple pre-processing functions are registered, they run sequentially, with each subsequent pre-processing function receiving the value returned by the previous one as a parameter.
   * @param command Only which "put", "update", "delete"
   * @param callback The pre-processing callback function.
   */
  onBefore(command, callback) {
    this.hooker.onBefore(command, callback);
    return this;
  }
  /**
   * Register post-processing functions for hooking after performing database operations such as `put`, `update`, and `delete` commands.  
   * You can use the value returned by this callback function for additional operations.
   * 
   * If multiple post-processing functions are registered, they run sequentially, with each subsequent post-processing function receiving the values returned by the previous one as parameters.
   * @param command Only which "put", "update", "delete"
   * @param callback The post-processing callback function.
   */
  onAfter(command, callback) {
    this.hooker.onAfter(command, callback);
    return this;
  }
  /**
   * Same as the `onBefore` method, but only works once. For more information, see the `onBefore` method.
   * @param command Only which "put", "update", "delete"
   * @param callback The pre-processing callback function.
   */
  onceBefore(command, callback) {
    this.hooker.onceBefore(command, callback);
    return this;
  }
  /**
   * Same as the `onAfter` method, but only works once. For more information, see the `onAfter` method.
   * @param command Only which "put", "update", "delete"
   * @param callback The post-processing callback function.
   */
  onceAfter(command, callback) {
    this.hooker.onceAfter(command, callback);
    return this;
  }
  /**
   * You remove the pre-processing functions added with `onBefore` or `onceBefore` methods.  
   * If there is no callback parameter, it removes all pre-processing functions registered for that command.
   * @param command Only which "put", "update", "delete"
   * @param callback Functions you want to remove.
   */
  offBefore(command, callback) {
    this.hooker.offBefore(command, callback);
    return this;
  }
  /**
   * You remove the post-processing functions added with `onAfter` or `onceAfter` methods.  
   * If there is no callback parameter, it removes all post-processing functions registered for that command.
   * @param command Only which "put", "update", "delete"
   * @param callback Functions you want to remove.
   */
  offAfter(command, callback) {
    this.hooker.offAfter(command, callback);
    return this;
  }
};
export {
  TissueRoll
};
