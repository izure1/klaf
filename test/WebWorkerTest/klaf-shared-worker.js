import { KlafDocument } from '/dist/esm/index.mjs'
import { WebWorkerEngine } from '/dist/esm/engine/WebWorker.mjs'

let db = null;
const connections = new Set();

const initializeDatabase = async () => {
  if (db) {
    return
  }
  db = await KlafDocument.Open({
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
  console.log('Shared worker database ready!')
}

// Initialize database when first connection is made
self.onconnect = async (e) => {
  const port = e.ports[0];
  connections.add(port);

  // Initialize database if it's the first connection
  if (connections.size === 1) {
    await initializeDatabase();
  }

  port.onmessage = async (event) => {
    const { data } = event;
    const result = {
      type: data.type,
      detail: {}
    }

    if (!db) {
      result.detail = 'Database not initialized';
      port.postMessage(result);
      return;
    }

    switch (data.type) {
      case 'put': {
        result.detail = await db.put(structuredClone(data.detail))
        break;
      }
      case 'pick': {
        result.detail = await db.pick(data.detail)
        break;
      }
      case 'delete': {
        result.detail = await db.delete(data.detail)
        break
      }
      default: {
        result.detail = 'Unknown operation'
      }
    }

    port.postMessage(result);
  }

  // When port is closed, remove from connections
  port.onclose = async () => {
    connections.delete(port);
    
    // If no more connections, you might want to close the database
    if (connections.size === 0) {
      console.log('db closed')
      await db.close()
      db = null;
    }
  }
}
