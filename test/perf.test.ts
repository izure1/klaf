import { unlink } from 'node:fs/promises'
import Chance from 'chance'
import { TissueRoll, TissueRollDocument } from '../'

function createDatabase(name: string) {
  const db = TissueRoll.Create(`perf-${name}.db`, undefined, true)
  const close = () => {
    db.close()
    unlink(`perf-${name}.db`)
  }

  return {
    db,
    close,
  }
}

function createSqlDatabase(name: string) {
  const db = TissueRollDocument.Create<{
    id: string
    name: string
    age: number
  }>(`perf-${name}.db`, undefined, true)
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

describe('perf:core', () => {
  const { db, close } = createDatabase('tissue-roll')

  afterAll(() => {
    close()
  })

  test('write:1000', () => {
    for (let i = 0; i < 1000; i++) {
      db.put(`Simple Text - ${i}`)
    }
  })
  test('read:1000', () => {
    db.pick(db.getRecords(1)[0].header.id)
  })
  test('write:2000', () => {
    for (let i = 1000; i < 2000; i++) {
      db.put(`Simple Text - ${i}`)
    }
  })
  test('read:2000', () => {
    db.pick(db.getRecords(2)[0].header.id)
  })
  test('write:4000', () => {
    for (let i = 2000; i < 4000; i++) {
      db.put(`Simple Text - ${i}`)
    }
  })
  test('read:4000', () => {
    db.pick(db.getRecords(3)[0].header.id)
  })
  test('write:8000', () => {
    for (let i = 4000; i < 8000; i++) {
      db.put(`Simple Text - ${i}`)
    }
  })
  test('read:8000', () => {
    db.pick(db.getRecords(4)[0].header.id)
  })
})

describe('perf:document', () => {
  const { db, close } = createSqlDatabase('tissue-roll-sql')

  afterAll(() => {
    close()
  })

  test('write:1000', () => {
    for (let i = 0; i < 1000; i++) {
      db.put(createFakeUser())
    }
  })
  test('read:1000', () => {
    db.pick({ age: 30 })
  })
  test('write:2000', () => {
    for (let i = 1000; i < 2000; i++) {
      db.put(createFakeUser())
    }
  })
  test('read:2000', () => {
    db.pick({ age: 31 })
  })
  test('write:4000', () => {
    for (let i = 2000; i < 4000; i++) {
      db.put(createFakeUser())
    }
  })
  test('read:4000', () => {
    db.pick({ age: 32 })
  })
  test('write:8000', () => {
    for (let i = 4000; i < 8000; i++) {
      db.put(createFakeUser())
    }
  })
  test('read:8000', () => {
    db.pick({ age: 33 })
  })
})
