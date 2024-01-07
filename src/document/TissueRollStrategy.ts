import { BPTreeNode, SerializeStrategy, SerializeStrategyHead } from 'serializable-bptree'
import { SupportedType, TissueRollDocumentRoot } from './TissueRollDocument'
import { TissueRoll } from '../core'
import { DelayedExecution } from '../utils/DelayedExecution'

export class TissueRollStrategy<T extends Record<string, SupportedType>> extends SerializeStrategy<string, SupportedType> {
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

  private _addOverflowRecord(): string {
    const reserved = '\x00'.repeat(this.db.root.payloadSize)
    return this.db.put(reserved, false)
  }

  private _getRecordOwnNode(id: number) {
    const record = this.db.getRecords(id).pop()
    if (!record) {
      throw new Error(`The '${id}' page not found`)
    }
    return record
  }

  id(): number {
    const recordId = this._addOverflowRecord()
    const record = this.db.pick(recordId)
    return record.page.index
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
