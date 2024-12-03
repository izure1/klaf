import { KlafDocument } from '/dist/esm/index.mjs'
import { WebWorkerEngine } from '/dist/esm/engine/WebWorker.mjs'

let db = null;

const initializeDatabase = async () => {
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
  console.log('Service worker database ready!')
}

// Initialize database on install
self.addEventListener('install', (event) => {
  event.waitUntil(initializeDatabase());
});

// Handle messages from clients
self.addEventListener('message', async (event) => {
  const { data } = event;
  const result = {
    type: data.type,
    detail: {}
  }

  if (!db) {
    result.detail = 'Database not initialized';
    event.ports[0].postMessage(result);
    return;
  }

  switch (data.type) {
    case 'put': {
      result.detail = await db.put(structuredClone(data.detail))
      break;
    }
    case 'pick': {
      result.detail = await db.pick(data.detail)
      console.log(result)
      break;
    }
    default: {
      result.detail = 'Unknown operation'
    }
  }

  event.ports[0].postMessage(result);
});

// Optional: Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
});
