import { type DataEngine } from '../engine/DataEngine'
import { Klaf } from './Klaf'
import { KlafService } from './KlafService'

export class KlafMediator extends Klaf {
  static GetService(db: Klaf): KlafService {
    return Klaf.GetService(db)
  }

  static GetEngine(db: Klaf): DataEngine {
    const service = KlafMediator.GetService(db)
    return service.engine
  }
}
