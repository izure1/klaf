import { ValueComparator } from 'serializable-bptree'
import { type PrimitiveType } from './KlafDocumentService'

export class KlafComparator extends ValueComparator<PrimitiveType> {
  private _normalize(v: PrimitiveType): string|number {
    v = v ?? null
    if (typeof v === 'boolean' || v === null) {
      v = Number(v)
    }
    return v
  }

  asc(a: PrimitiveType, b: PrimitiveType): number {
    a = this._normalize(a)
    b = this._normalize(b)
    if (typeof a === 'number' && typeof b === 'number') {
      return a-b
    }
    a = a.toString()
    b = b.toString()
    return a.localeCompare(b)
  }

  match(value: PrimitiveType): string {
    return this._normalize(value).toString()
  }
}
