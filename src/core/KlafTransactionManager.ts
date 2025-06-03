import { Ryoiki } from 'ryoiki'
import { Catcher } from '../utils/Catcher'

interface KlafTransactionManagerConstructorArguments {
  commit: () => Promise<void>
}

export class KlafTransactionManager {
  private _running: boolean
  private readonly _works: (() => Promise<any>)[]
  private readonly _locker: Ryoiki
  private readonly _commit: () => Promise<void>

  constructor(option: KlafTransactionManagerConstructorArguments) {
    this._commit = option.commit
    this._locker = new Ryoiki()
    this._works = []
    this._running = false
  }

  get running(): boolean {
    return this._running
  }

  protected async writeLock<T>(work: () => Promise<T>): Promise<T> {
    let lockId: string
    return this._locker.writeLock((_lockId) => {
      lockId = _lockId
      return work()
    }).finally(() => this._locker.writeUnlock(lockId))
  }

  private _createReadWrapper<T>(
    work: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason?: any) => void
  ): () => Promise<void> {
    return () => this.writeLock(async () => {
      const [err, res] = await Catcher.CatchError(work())
      if (err) reject(err)
      else resolve(res)
      this.executeNext()
    })
  }

  private _createWriteWrapper<T>(
    work: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason?: any) => void
  ): () => Promise<void> {
    return () => this.writeLock(async () => {
      const [workErr, workRes] = await Catcher.CatchError(work())
      if (workErr) {
        reject(workErr)
        return
      }
      const [commitErr] = await Catcher.CatchError(this._commit())
      if (commitErr) {
        reject(commitErr)
        return
      }
      resolve(workRes)
      this.executeNext()
    })
  }

  transaction<T>(work: () => Promise<T>, lockType: 'read'|'write'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let wrapper: () => Promise<void>
      switch (lockType) {
        case 'read': {
          wrapper = this._createReadWrapper(work, resolve, reject)
          break
        }
        case 'write': {
          wrapper = this._createWriteWrapper(work, resolve, reject)
          break
        }
        default: {
          throw new Error(`Invalid lock type: '${lockType}'`)
        }
      }
      this._works.push(wrapper)
      this.executeNext()
    })
  }

  protected executeNext(): void {
    if (this._running) {
      return
    }
    if (this._works.length) {
      const wrapper = this._works.shift()!
      wrapper()
    }
    this._running = !!this._works.length
  }
}
