import type { BPTreeNode, SerializeStrategyHead } from 'serializable-bptree'
import type { SupportedType, KlafDocumentRoot } from './KlafDocumentService'
import { SerializeStrategyAsync } from 'serializable-bptree'
import { Debounce } from '../utils/Debounce'
import { KlafService } from '../core/KlafService'
import { KlafRepositorySynchronizer } from './KlafRepositorySynchronizer'

export type QueueNode = BPTreeNode<string, SupportedType>|KlafDocumentRoot

export interface KlafStrategyConstructorArguments {
  property: string
  order: number
  service: KlafService
  synchronizer: KlafRepositorySynchronizer<QueueNode>
  rootId: string
  root: KlafDocumentRoot
  deleteQueue: Set<string>
  updateQueue: Map<string, QueueNode>
  tempNodes: Map<string, QueueNode>
}

export class KlafStrategy extends SerializeStrategyAsync<string, SupportedType> {
  protected readonly property: string
  protected readonly rootId: string
  protected readonly service: KlafService
  protected readonly synchronizer: KlafRepositorySynchronizer<QueueNode>
  protected readonly root: KlafDocumentRoot
  private _tempNodes: Map<string, QueueNode>

  constructor({
    property,
    order,
    service,
    synchronizer,
    rootId,
    root,
    tempNodes,
  }: KlafStrategyConstructorArguments) {
    super(order)
    this.property = property
    this.rootId = rootId
    this.service = service
    this.synchronizer = synchronizer
    this.root = root
    this._tempNodes = tempNodes

    this._tempNodes.set(rootId, root)
  }

  private _setHeadToRoot(head: SerializeStrategyHead): void {
    this.root.head[this.property] = head
  }

  private _getHeadInRoot(): SerializeStrategyHead|null {
    return this.root.head[this.property] ?? null
  }

  private async _addOverflowRecord(): Promise<string> {
    return this.service.internalPut(
      this.service.createIterable(this.service.metadata.payloadSize, 0),
      false
    )
  }

  private async _readFromRepository(id: string): Promise<BPTreeNode<string, SupportedType>> {
    const record = await this.service.pick(id)
    const node = JSON.parse(record.record.payload)
    return node
  }

  private _updateNode(id: string, node: QueueNode): void {
    this._tempNodes.set(id, node)
  }

  private _deleteNode(id: string): void {
    this._tempNodes.delete(id)
  }

  async id(): Promise<string> {
    if (this.root.reassignments.length) {
      const id = this.root.reassignments.shift()!
      await this.writeHead(this.head)
      return id
    }
    return this._addOverflowRecord()
  }

  async read(id: string): Promise<BPTreeNode<string, SupportedType>> {
    if (!this._tempNodes.has(id)) {
      const node = await this._readFromRepository(id)
      this._tempNodes.set(id, node)
    }
    const node = this._tempNodes.get(id) as BPTreeNode<string, SupportedType>
    return structuredClone(node)
  }

  async write(id: string, node: BPTreeNode<string, SupportedType>): Promise<void> {
    this._updateNode(id, node)
    this.synchronizer.addToUpdateQueue(id, node)
  }

  async delete(id: string): Promise<void> {
    this.root.reassignments.push(id)
    this._deleteNode(id)
    this.synchronizer.deleteFromQueue(id)
  }

  async readHead(): Promise<SerializeStrategyHead|null> {
    return this._getHeadInRoot()
  }

  async writeHead(head: SerializeStrategyHead): Promise<void> {
    this._setHeadToRoot(head)
    this._updateNode(this.rootId, this.root)
    this.synchronizer.addToUpdateQueue(this.rootId, this.root)
  }
}
