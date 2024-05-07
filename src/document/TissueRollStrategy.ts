import { BPTreeNode, SerializeStrategySync, SerializeStrategyHead } from 'serializable-bptree'
import { SupportedType, TissueRollDocumentRoot } from './TissueRollDocument'
import { TissueRoll } from '../core/TissueRoll'
import { DelayedExecution } from '../utils/DelayedExecution'
import { TissueRollMediator } from '../core/TissueRollMediator'

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

  private get _head(): SerializeStrategyHead|null {
    return this.root.head[this.property] ?? null
  }

  private set _head(head: SerializeStrategyHead) {
    this.root.head[this.property] = head
  }

  private _addOverflowRecord(): string {
    return TissueRollMediator.Put(
      this.db,
      new Array(this.db.metadata.payloadSize),
      false
    )
  }

  private _getRecordOwnNode(id: string) {
    const record = this.db.pick(id)
    const node = JSON.parse(record.record.payload)
    return node
  }

  id(isLeaf: boolean): string {
    if (this.root.reassignments.length) {
      const id = this.root.reassignments.shift()!
      this.writeHead(this.head)
      return id
    }
    return this._addOverflowRecord()
  }

  read(id: string): BPTreeNode<string, SupportedType> {
    return this._getRecordOwnNode(id)
  }

  write(id: string, node: BPTreeNode<string, SupportedType>): void {
    this.locker.execute(`write:node:${id}`, () => {
      this.db.update(id, JSON.stringify(node))
    })
  }

  delete(id: string): void {
    this.locker.cancel(`write:node:${id}`)
    this.root.reassignments.push(id)
    this.writeHead(this.head)
  }

  readHead(): SerializeStrategyHead|null {
    return this._head ?? null
  }

  writeHead(head: SerializeStrategyHead): void {
    this._head = head
    this.locker.execute('write:head', () => {
      this.db.update(
        this.rootId,
        JSON.stringify(this.root)
      )
    })
  }
}
