import { BPTreeNode, SerializeStrategyAsync, SerializeStrategyHead } from 'serializable-bptree'
import { SupportedType, KlafDocumentRoot } from './KlafDocument'
import { Klaf } from '../core/Klaf'
import { Throttling } from '../utils/Throttling'
import { KlafMediator } from '../core/KlafMediator'

export class KlafStrategy extends SerializeStrategyAsync<string, SupportedType> {
  protected readonly property: string
  protected readonly rootId: string
  protected readonly db: Klaf
  protected readonly throttling: Throttling
  protected readonly root: KlafDocumentRoot
  private readonly _writeQueue: Map<string, BPTreeNode<string, SupportedType>>
  private readonly _deleteQueue: Set<string>

  constructor(
    order: number,
    property: string,
    db: Klaf,
    throttling: Throttling,
    rootId: string,
    root: KlafDocumentRoot
  ) {
    super(order)
    this.property = property
    this.rootId = rootId
    this.db = db
    this.throttling = throttling
    this.root = root
    this._writeQueue = new Map()
    this._deleteQueue = new Set()
  }

  private _setRootHead(head: SerializeStrategyHead) {
    this.root.head[this.property] = head
  }

  private _getRootHead(): SerializeStrategyHead|null {
    return this.root.head[this.property] ?? null
  }

  private async _addOverflowRecord(): Promise<string> {
    return await KlafMediator.Put(
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

  private _requestSyncNodes() {
    this.throttling.execute('sync-nodes', async () => {
      for (const [id, node] of this._writeQueue) {
        await this.db.update(id, JSON.stringify(node))
      }
      for (const id of this._deleteQueue) {
        await this.db.delete(id)
      }
      this._writeQueue.clear()
      this._deleteQueue.clear()
    })
  }

  private _requestSyncHead() {
    this.throttling.execute('sync-head', async () => {
      await this.db.update(this.rootId, JSON.stringify(this.root))
    })
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
    if (!this._writeQueue.has(id)) {
      const node = await this._getRecordOwnNode(id)
      this._writeQueue.set(id, node)
    }
    return structuredClone(this._writeQueue.get(id)!)
  }

  async write(id: string, node: BPTreeNode<string, SupportedType>): Promise<void> {
    this._writeQueue.set(id, node)
    this._requestSyncNodes()
  }

  async delete(id: string): Promise<void> {
    this.root.reassignments.push(id)
    this._writeQueue.delete(id)
    this._deleteQueue.add(id)
    this._requestSyncNodes()
    await this.writeHead(this.head)
  }

  async readHead(): Promise<SerializeStrategyHead|null> {
    return this._getRootHead()
  }

  async writeHead(head: SerializeStrategyHead): Promise<void> {
    this._setRootHead(head)
    this._requestSyncHead()
  }
}
