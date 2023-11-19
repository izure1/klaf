import { BPTreeNode, SerializeStrategy, SerializeStrategyHead } from 'serializable-bptree'
import { SupportedType, TissueRollDocumentRoot } from './TissueRollDocument'

import { TissueRoll } from '../core'
import { DelayedExecution } from '../utils/DelayedExecution'

export class TissueRollStrategy extends SerializeStrategy<string, SupportedType> {
  protected readonly property: string
  protected readonly db: TissueRoll
  private readonly _delayedExecution: DelayedExecution

  constructor(order: number, property: string, db: TissueRoll, delay = 0) {
    super(order)
    this.property = property
    this.db = db
    this._delayedExecution = new DelayedExecution(delay)
  }

  private _addOverflowRecord(): string {
    const reserved = '\x00'.repeat(this.db.root.payloadSize)
    return this.db.put(reserved)
  }

  private _getRecordOwnRoot() {
    const record = this.db.getRecords(1).pop()!
    return record
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
    this._delayedExecution.execute(key, () => {
      const record = this._getRecordOwnNode(id)
      const stringify = JSON.stringify(node)
      this.db.update(record.header.id, stringify)
    })
  }

  readHead(): SerializeStrategyHead|null {
    const record = this._getRecordOwnRoot()
    const root = JSON.parse(record.payload) as TissueRollDocumentRoot
    return root.head[this.property] ?? null
  }

  writeHead(head: SerializeStrategyHead): void {
    this._delayedExecution.execute('write:head', () => {
      const record = this._getRecordOwnRoot()
      const root = JSON.parse(record.payload) as TissueRollDocumentRoot
      root.head[this.property] = head
      this.db.update(record.header.id, JSON.stringify(root))
    })
  }
}
