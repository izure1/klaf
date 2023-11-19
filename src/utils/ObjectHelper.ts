export class ObjectHelper {
  static HasProperty(obj: Record<string, any>, property: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, property)
  }

  static VerifyProperties(
    obj: Record<string, any>,
    verifies: Record<string, (v: any) => boolean>
  ): boolean {
    for (const key in verifies) {
      if (!ObjectHelper.HasProperty(obj, key)) {
        return false
      }
      const verify = verifies[key]
      const v = obj[key]
      if (!verify(v)) {
        return false
      }
    }
    return true
  }

  static IsObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  static Parse(value: string, err: Error): Record<string, unknown> {
    try {
      return JSON.parse(value)
    } catch (e) {
      throw err
    }
  }
}
