import { unlink } from 'node:fs/promises'
import Chance from 'chance'
import { Klaf, KlafDocument } from 'klaf.js'
import { FileSystemEngine } from 'klaf.js/engine/FileSystem'

async function createDatabase(name: string) {
  const engine = new FileSystemEngine()
  const db = await Klaf.Create({
    path: `perf-${name}.db`,
    engine,
    overwrite: true
  })
  const close = async () => {
    await db.close()
    unlink(`perf-${name}.db`)
  }

  return {
    db,
    close,
  }
}

async function createDocumentDatabase(name: string) {
  const engine = new FileSystemEngine()
  const db = await KlafDocument.Create({
    path: `perf-${name}.db`,
    version: 0,
    engine,
    scheme: {
      id: {
        default: () => '',
      },
      name: {
        default: () => ''
      },
      age: {
        default: () => 0
      }
    },
    overwrite: true
  })
  const close = async () => {
    await db.close()
    await unlink(`perf-${name}.db`)
  }

  return {
    db,
    close,
  }
}

const chance = new Chance()
function createFakeUser() {
  const id = chance.guid()
  const name = chance.name()
  const age = chance.age()
  return {
    id,
    name,
    age,
  }
}

const JEST_TIMEOUT = 2147483647

describe('perf:core', () => {
  jest.setTimeout(JEST_TIMEOUT)
  let db: Awaited<ReturnType<typeof createDatabase>>['db']
  let close: Awaited<ReturnType<typeof createDatabase>>['close']
  beforeAll(async () => {
    const database = await createDatabase('klaf')
    db = database.db
    close = database.close
  })
  afterAll(async () => await close())
  test('write:1000', async () => {
    for (let i = 0; i < 1000; i++) {
      await db.put(`Simple Text - ${i}`)
    }
  })
  test('read:1000', async () => {
    await db.pick((await db.getRecords(1))[0].header.id)
  })
  test('write:2000', async () => {
    for (let i = 1000; i < 2000; i++) {
      await db.put(`Simple Text - ${i}`)
    }
  })
  test('read:2000', async () => {
    await db.pick((await db.getRecords(2))[0].header.id)
  })
  test('write:4000', async () => {
    for (let i = 2000; i < 4000; i++) {
      await db.put(`Simple Text - ${i}`)
    }
  })
  test('read:4000', async () => {
    await db.pick((await db.getRecords(3))[0].header.id)
  })
  test('write:8000', async () => {
    for (let i = 4000; i < 8000; i++) {
      await db.put(`Simple Text - ${i}`)
    }
  })
  test('read:8000', async () => {
    await db.pick((await db.getRecords(4))[0].header.id)
  })
})

describe('perf:document', () => {
  jest.setTimeout(JEST_TIMEOUT)
  let db: Awaited<ReturnType<typeof createDocumentDatabase>>['db']
  let close: Awaited<ReturnType<typeof createDocumentDatabase>>['close']
  beforeAll(async () => {
    const database = await createDocumentDatabase('klaf-document')
    db = database.db
    close = database.close
  })
  afterAll(async () => await close())
  test('write:1000', async () => {
    for (let i = 0; i < 1000; i++) {
      await db.put(createFakeUser())
    }
  })
  test('read:1000', async () => {
    await db.pick({ age: 30 })
  })
  test('write:2000', async () => {
    for (let i = 1000; i < 2000; i++) {
      await db.put(createFakeUser())
    }
  })
  test('read:2000', async () => {
    await db.pick({ age: 31 })
  })
  test('write:4000', async () => {
    for (let i = 2000; i < 4000; i++) {
      await db.put(createFakeUser())
    }
  })
  test('read:4000', async () => {
    await db.pick({ age: 32 })
  })
  test('write:8000', async () => {
    for (let i = 4000; i < 8000; i++) {
      await db.put(createFakeUser())
    }
  })
  test('read:8000', async () => {
    await db.pick({ age: 33 })
  })
})
