import { CacheBranchSync } from 'cachebranch'
import { h64 } from 'xxhashjs'

export class Base64Helper {
  static readonly UrlDomain = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=+/'.split('')
  static readonly UrlSafeDomain = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-_'.split('')
  private static readonly _CachedEncodedUrl = new CacheBranchSync<string>()
  private static readonly _CachedDecodedUrl = new CacheBranchSync<string>()

  static UrlSafeEncode(plain: string): string {
    const hashKey = h64(plain, 0).toString(16)
    return Base64Helper._CachedEncodedUrl.ensure(hashKey, () => (
      btoa(plain).replaceAll('+', '-').replaceAll('/', '_')
    )).raw
  }

  static UrlSafeDecode(base64: string): string {
    const hashKey = h64(base64, 0).toString(16)
    return Base64Helper._CachedDecodedUrl.ensure(hashKey, () => (
      atob(base64.replaceAll('-', '+').replaceAll('_', '/'))
    )).raw
  }
}
