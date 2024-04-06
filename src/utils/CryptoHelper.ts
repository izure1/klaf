import { ecb } from '@noble/ciphers/aes'
import { randomBytes } from '@noble/ciphers/webcrypto'
import { hexToBytes, utf8ToBytes, bytesToUtf8, bytesToHex, numberToBytesBE, bytesToNumberBE } from '@noble/ciphers/utils'

export class CryptoHelper {
  protected static readonly CachedCipher = new Map<Uint8Array, ReturnType<typeof ecb>>()

  static RandomBytes(size: number): Uint8Array {
    return randomBytes(size)
  }

  static Utf8ToBytes(text: string): Uint8Array {
    return utf8ToBytes(text)
  }

  static HexToBytes(hex: string): Uint8Array {
    return hexToBytes(hex)
  }

  static NumberToBytesBe(num: number|bigint): Uint8Array {
    return numberToBytesBE(num, 8)
  }

  static BytesToNumberBe(bytes: Uint8Array): bigint {
    return bytesToNumberBE(bytes)
  }

  static BytesToUtf8(bytes: Uint8Array): string {
    return bytesToUtf8(bytes)
  }

  static BytesToHex(bytes: Uint8Array): string {
    return bytesToHex(bytes)
  }

  protected static GetCipher(key: Uint8Array): ReturnType<typeof ecb> {
    if (!CryptoHelper.CachedCipher.has(key)) {
      CryptoHelper.CachedCipher.set(key, ecb(key))
    }
    return CryptoHelper.CachedCipher.get(key)!
  }

  static Encrypt(plain: string, key: Uint8Array): string {
    const data = CryptoHelper.Utf8ToBytes(plain)
    const cipher = CryptoHelper.GetCipher(key)
    const cipherText = cipher.encrypt(data)
    return CryptoHelper.BytesToHex(cipherText)
  }

  static Decrypt(hash: string, key: Uint8Array): string {
    const data = CryptoHelper.HexToBytes(hash)
    const cipher = CryptoHelper.GetCipher(key)
    const plainText = cipher.decrypt(data)
    return CryptoHelper.BytesToUtf8(plainText)
  }
}
