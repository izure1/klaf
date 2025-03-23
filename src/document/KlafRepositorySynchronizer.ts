export type UpdateToRepoFn<T> = (id: string, node: T) => Promise<void>
export type DeleteFromRepoFn = (id: string) => Promise<void>

export interface KlafRepositorySynchronizerConstructorArguments<T> {
  updateFn: UpdateToRepoFn<T>
  deleteFn: DeleteFromRepoFn
}

export class KlafRepositorySynchronizer<T> {
  private _deleteQueue: Set<string>
  private _updateQueue: Map<string, T>
  private _updateFn: UpdateToRepoFn<T>
  private _deleteFn: DeleteFromRepoFn
  private _dirty: boolean

  constructor({
    updateFn,
    deleteFn,
  }: KlafRepositorySynchronizerConstructorArguments<T>) {
    this._updateFn = updateFn
    this._deleteFn = deleteFn
    this._deleteQueue = new Set()
    this._updateQueue = new Map()
    this._dirty = false
  }

  addToUpdateQueue(id: string, node: T): void {
    if (this._deleteQueue.has(id)) {
      return
    }
    this._updateQueue.set(id, node)
  }

  deleteFromQueue(id: string): void {
    this._deleteQueue.add(id)
    this._updateQueue.delete(id)
  }

  isNeedToSync(): boolean {
    return this._dirty
  }

  async sync(): Promise<void> {
    let deleteQueue = this._deleteQueue
    let updateQueue = this._updateQueue

    this._deleteQueue = new Set()
    this._updateQueue = new Map()

    for (const id of deleteQueue) await this._deleteFn(id)
    for (const [id, node] of updateQueue) await this._updateFn(id, node)

    deleteQueue.clear()
    updateQueue.clear()
  }
}
