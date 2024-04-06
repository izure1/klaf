import { TissueRoll, IPageHeader } from '../core/TissueRoll'

export class TissueRollMediator extends TissueRoll {
  static AddEmptyPage(db: TissueRoll, head: Partial<IPageHeader>): number {
    return TissueRoll.CallAddEmptyPage(db, head)
  }

  static Put(db: TissueRoll, data: number[], autoIncrement: boolean): string {
    return TissueRoll.CallInternalPut(db, data, autoIncrement)
  }

  static Update(db: TissueRoll, id: string, data: string): {
    id: string
    data: string
  } {
    return TissueRoll.CallInternalUpdate(db, id, data)
  }

  static Delete(db: TissueRoll, id: string, countDecrement: boolean): void {
    return TissueRoll.CallInternalDelete(db, id, countDecrement)
  }

  static readonly HeaderSize = 100
  static readonly RecordHeaderSize = 40
  static readonly CellSize = 4

  static readonly UnknownType         = 0
  static readonly InternalType        = 1
  static readonly OverflowType        = 2
  static readonly SystemReservedType  = 3
}
