import type { BPTreeNode, SerializeStrategyHead } from 'serializable-bptree'
import type { SupportedType, KlafDocumentRoot } from './KlafDocument'
import { SerializeStrategyAsync } from 'serializable-bptree'
import { Klaf } from '../core/Klaf'
import { Throttling } from '../utils/Throttling'
import { KlafMediator } from '../core/KlafMediator'

enum QueueType {
  'Update',
  'Delete',
}

interface QueueUnit {
  command: QueueType
}

interface QueueUpdateUnit extends QueueUnit {
  command: QueueType.Update
  node: BPTreeNode<string, SupportedType>|KlafDocumentRoot
}

interface QueueDeleteUnit extends QueueUnit {
  command: QueueType.Delete
}

export class KlafStrategy extends SerializeStrategyAsync<string, SupportedType> {
  protected readonly property: string
  protected readonly rootId: string
  protected readonly db: Klaf
  protected readonly throttling: Throttling
  protected readonly root: KlafDocumentRoot
  private readonly _queue: Map<string, QueueDeleteUnit|QueueUpdateUnit>
  private readonly _temps: Map<string, BPTreeNode<string, SupportedType>|KlafDocumentRoot>

  constructor(
    order: number,
    property: string,
    updateQueue: Map<string, QueueDeleteUnit|QueueUpdateUnit>,
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
    this._queue = updateQueue
    this._temps = new Map()

    this._temps.set(rootId, root)
  }

  private _setHeadToRoot(head: SerializeStrategyHead): void {
    this.root.head[this.property] = head
  }

  private _getHeadInRoot(): SerializeStrategyHead|null {
    return this.root.head[this.property] ?? null
  }

  private async _addOverflowRecord(): Promise<string> {
    return await KlafMediator.Put(
      this.db,
      new Array(this.db.metadata.payloadSize),
      false
    )
  }

  private async _readFromRepository(id: string): Promise<BPTreeNode<string, SupportedType>> {
    const record = await this.db.pick(id)
    const node = JSON.parse(record.record.payload)
    return node
  }

  private _requestSyncToRepository(): Promise<void> {
    return this.throttling.execute('sync', async () => {
      const queue = Array.from(this._queue)
      this._queue.clear()

      const deleteQueue = queue.filter(([id, unit]) => unit.command === QueueType.Delete) as [string, QueueDeleteUnit][]
      const updateQueue = queue.filter(([id, unit]) => unit.command === QueueType.Update) as [string, QueueUpdateUnit][]
      
      const deletePromises = deleteQueue.map(([id]) => {
        return this.db.delete(id).then(() => {
          this._temps.delete(id)
        })
      })
      const updatePromises = updateQueue.map(([id, unit]) => {
        return this.db.update(id, JSON.stringify(unit.node)).then(() => {
          this._temps.delete(id)
        })
      })
      
      await Promise.all(deletePromises)
      await Promise.all(updatePromises)
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
    if (!this._temps.has(id)) {
      const node = await this._readFromRepository(id)
      this._temps.set(id, node)
    }
    const node = this._temps.get(id) as BPTreeNode<string, SupportedType>
    return structuredClone(node)
  }

  async write(id: string, node: BPTreeNode<string, SupportedType>): Promise<void> {
    this._queue.set(id, { command: QueueType.Update, node })
    this._temps.set(id, node)
    this._requestSyncToRepository()
  }

  async delete(id: string): Promise<void> {
    this.root.reassignments.push(id)
    this._queue.set(id, { command: QueueType.Delete })
    this._temps.delete(id)
    this._requestSyncToRepository()
  }

  async readHead(): Promise<SerializeStrategyHead|null> {
    return this._getHeadInRoot()
  }

  async writeHead(head: SerializeStrategyHead): Promise<void> {
    this._setHeadToRoot(head)
    this._queue.set(this.rootId, { command: QueueType.Update, node: this.root })
    this._temps.set(this.rootId, this.root)
    this._requestSyncToRepository()
  }
}
