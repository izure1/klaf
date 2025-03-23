import { KlafDocument } from '/dist/esm/index.mjs'
import { WebWorkerEngine } from '/dist/esm/engine/WebWorker.mjs'

const db = await KlafDocument.Open({
  path: 'test.db',
  engine: new WebWorkerEngine(),
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

console.log('Dedicated worker ready!')

onmessage = async (e) => {
  const { data } = e
  const result = {
    type: data.type,
    detail: {}
  }
  
  try {
    switch (data.type) {
      case 'put': {
        result.detail = await db.put(structuredClone(data.detail))
        break
      }
      case 'pick': {
        result.detail = await db.pick(data.detail)
        break
      }
      case 'delete': {
        result.detail = await db.delete(data.detail)
        break
      }
      default: {
        result.detail = 'Unknown operation'
      }
    }
  } catch (error) {
    result.detail = {
      error: error.message,
      stack: error.stack
    }
  }
  
  postMessage(result)
}
