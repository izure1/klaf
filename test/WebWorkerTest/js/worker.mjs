import { KlafDocument } from '/dist/esm/index.mjs'
import { WebWorkerEngine } from '/dist/esm/engine/WebWorker.mjs'

const engine = new WebWorkerEngine()
const db = await KlafDocument.Open({
  path: 'test.db',
  engine,
  version: 0,
  scheme: {
    name: {
      default: () => ''
    },
    age: {
      default: () => 0,
      validate: (v) => typeof v === 'number'
    }
  }
})

console.log('ready!')

onmessage = async (e) => {
  const { data } = e
  const result = {
    type: data.type,
    detail: {}
  }
  switch (data.type) {
    case 'put': {
      result.detail = await db.put(structuredClone(data.detail))
      break
    }
    case 'pick': {
      result.detail = await db.pick(data.detail)
      break
    }
    case 'download': {
      result.detail = engine.fileHandle
      break
    }
    default: {
      result.detail = 'Unknown'
    }
  }
  postMessage(result)
}