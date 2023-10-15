import { randomBytes, getRandomValues, createCipheriv, createDecipheriv } from 'node:crypto'

export class CryptoHelper {
  static RandomBytes(size: number): Uint8Array {
    return getRandomValues(new Uint8Array(size))
  }
  
  static EncryptAES256(text: string, secret: Buffer): string {
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', secret, iv)
    const a = cipher.update(text, 'utf8')
    const b = cipher.final()
    const tag = cipher.getAuthTag()
    return (
      Buffer.concat([a, b]).toString('hex') +
      ':' +
      iv.toString('hex') +
      ':' +
      tag.toString('hex')
    )
  }
  
  static DecryptAES256(text: string, secret: Buffer): string {
    const [encryptedText, iv, tag] = text.split(':')
    const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(tag, 'hex'))

    const a = decipher.update(encryptedText, 'hex', 'utf8')
    const b = decipher.final('utf8')
    return a+b
  }
}
