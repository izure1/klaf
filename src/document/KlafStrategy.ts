import { BPTreeNode, SerializeStrategyAsync, SerializeStrategyHead } from 'serializable-bptree'
import { SupportedType, KlafDocumentRoot } from './KlafDocument'
import { Klaf } from '../core/Klaf'
import { Throttling } from '../utils/Throttling'
import { KlafMediator } from '../core/KlafMediator'

export class KlafStrategy<T extends Record<string, SupportedType>> extends SerializeStrategyAsync<string, SupportedType> {
  protected readonly property: string
  protected readonly rootId: string
  protected readonly db: Klaf
  protected readonly throttling: Throttling
  protected readonly root: KlafDocumentRoot

  constructor(order: number, property: string, db: Klaf, throttling: Throttling, rootId: string, root: KlafDocumentRoot) {
    super(order)
    this.property = property
    this.rootId = rootId
    this.db = db
    this.throttling = throttling
    this.root = root
  }

  private get _head(): SerializeStrategyHead|null {
    return this.root.head[this.property] ?? null
  }

  private set _head(head: SerializeStrategyHead) {
    this.root.head[this.property] = head
  }

  private async _addOverflowRecord(): Promise<string> {
    return KlafMediator.Put(
      this.db,
      new Array(this.db.metadata.payloadSize),
      false
    )
  }

  private async _getRecordOwnNode(id: string) {
    const record = await this.db.pick(id)
    const node = JSON.parse(record.record.payload)
    return node
  }

  async id(): Promise<string> {
    if (this.root.reassignments.length) {
      const id = this.root.reassignments.shift()!
      await this.writeHead(this.head)
      return id
    }
    return await this._addOverflowRecord()
  }

  async read(id: string): Promise<BPTreeNode<string, SupportedType>> {
    return await this._getRecordOwnNode(id)
  }

  async write(id: string, node: BPTreeNode<string, SupportedType>): Promise<void> {
    this.throttling.execute(`write:node:${id}`, async () => {
      await this.db.update(id, JSON.stringify(node))
    })
  }

  async delete(id: string): Promise<void> {
    this.throttling.cancel(`write:node:${id}`)
    this.root.reassignments.push(id)
    await this.writeHead(this.head)
  }

  async readHead(): Promise<SerializeStrategyHead|null> {
    return this._head ?? null
  }

  async writeHead(head: SerializeStrategyHead): Promise<void> {
    this._head = head
    this.throttling.execute('write:head', async () => {
      await this.db.update(
        this.rootId,
        JSON.stringify(this.root)
      )
    })
  }
}
