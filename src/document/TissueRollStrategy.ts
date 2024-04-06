import { BPTreeNode, SerializeStrategySync, SerializeStrategyHead } from 'serializable-bptree'
import { SupportedType, TissueRollDocumentRoot } from './TissueRollDocument'
import { TissueRoll } from '../core/TissueRoll'
import { TissueRollMediator } from '../core/TissueRollMediator'
import { DelayedExecution } from '../utils/DelayedExecution'
import { TextConverter } from '../utils/TextConverter'

export class TissueRollStrategy<T extends Record<string, SupportedType>> extends SerializeStrategySync<string, SupportedType> {
  protected readonly property: string
  protected readonly rootId: string
  protected readonly db: TissueRoll
  protected readonly locker: DelayedExecution
  protected readonly root: TissueRollDocumentRoot

  constructor(order: number, property: string, db: TissueRoll, locker: DelayedExecution, rootId: string, root: TissueRollDocumentRoot) {
    super(order)
    this.property = property
    this.rootId = rootId
    this.db = db
    this.locker = locker
    this.root = root
  }

  private _addEmptyPage(): number {
    return TissueRollMediator.AddEmptyPage(this.db, { type: TissueRollMediator.OverflowType })
  }

  private _getRecordOwnNode(id: number) {
    const record = this.db.getRecords(id).pop()
    if (!record) {
      throw new Error(`The '${id}' page not found`)
    }
    return record
  }

  id(isLeaf: boolean): number {
    return this._addEmptyPage()
  }

  read(id: number): BPTreeNode<string, SupportedType> {
    const record = this._getRecordOwnNode(id)
    return JSON.parse(record.payload)
  }

  write(id: number, node: BPTreeNode<string, SupportedType>): void {
    const key = `write:${id}`
    this.locker.execute(key, () => {
      const record = this._getRecordOwnNode(id)
      const stringify = JSON.stringify(node)
      this.db.update(record.header.id, stringify)
    })
  }

  readHead(): SerializeStrategyHead|null {
    return this.root.head[this.property] ?? null
  }

  writeHead(head: SerializeStrategyHead): void {
    this.root.head[this.property] = head
    this.locker.execute('write:head', () => {
      this.db.update(
        this.rootId,
        JSON.stringify(this.root)
      )
    })
  }
}
