import { Klaf, IPageHeader } from './Klaf'

export class KlafMediator extends Klaf {
  static AddEmptyPage(db: Klaf, head: Partial<IPageHeader>, incrementInternalIndex: boolean): number {
    return Klaf.CallAddEmptyPage(db, head, incrementInternalIndex)
  }

  static SetPage(db: Klaf, head: Partial<IPageHeader>, data: number[]): void {
    return Klaf.CallSetPage(db, head, data)
  }

  static Put(db: Klaf, data: number[], autoIncrement: boolean): string {
    return Klaf.CallInternalPut(db, data, autoIncrement)
  }

  static Update(db: Klaf, id: string, data: string): {
    id: string
    data: string
  } {
    return Klaf.CallInternalUpdate(db, id, data)
  }

  static Delete(db: Klaf, id: string, countDecrement: boolean): void {
    return Klaf.CallInternalDelete(db, id, countDecrement)
  }

  static readonly HeaderSize = 100
  static readonly RecordHeaderSize = 40
  static readonly CellSize = 4

  static readonly UnknownType         = 0
  static readonly InternalType        = 1
  static readonly OverflowType        = 2
  static readonly SystemReservedType  = 3
}
