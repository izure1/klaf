import { Klaf, IPageHeader } from './Klaf'

export class KlafMediator extends Klaf {
  static async AddEmptyPage(db: Klaf, head: Partial<IPageHeader>, incrementInternalIndex: boolean): Promise<number> {
    return await Klaf.CallAddEmptyPage(db, head, incrementInternalIndex)
  }

  static async SetPage(db: Klaf, head: Partial<IPageHeader>, data: number[]): Promise<void> {
    return await Klaf.CallSetPage(db, head, data)
  }

  static async Put(db: Klaf, data: number[], autoIncrement: boolean): Promise<string> {
    return await Klaf.CallInternalPut(db, data, autoIncrement)
  }

  static async Update(db: Klaf, id: string, data: string): Promise<{
    id: string
    data: string
  }> {
    return await Klaf.CallInternalUpdate(db, id, data)
  }

  static async Delete(db: Klaf, id: string, countDecrement: boolean): Promise<void> {
    return await Klaf.CallInternalDelete(db, id, countDecrement)
  }

  static readonly HeaderSize = 100
  static readonly RecordHeaderSize = 40
  static readonly CellSize = 4

  static readonly UnknownType         = 0
  static readonly InternalType        = 1
  static readonly OverflowType        = 2
  static readonly SystemReservedType  = 3
}
