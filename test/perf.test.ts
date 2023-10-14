import fs from 'fs'
import { TissueRoll } from '../'

describe('write', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)
    fs.writeFileSync(jsonFile, JSON.stringify([]), 'utf-8')
  })
  
  afterAll(() => {
    if (db) {
      db.close()
    }
    fs.unlinkSync(dbFile)
    fs.unlinkSync(jsonFile)
  })

  test('tissue-write:1', () => {
    for (let i = 0; i < 1; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:1', () => {
    for (let i = 0; i < 1; i++) {
      const raw = fs.readFileSync(jsonFile, 'utf-8')
      const json = JSON.parse(raw)
      json.push(`${data}-${i}`)
      fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
    }
  })

  test('tissue-write:2', () => {
    for (let i = 0; i < 100; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:2', () => {
    for (let i = 0; i < 100; i++) {
      const raw = fs.readFileSync(jsonFile, 'utf-8')
      const json = JSON.parse(raw)
      json.push(`${data}-${i}`)
      fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
    }
  })

  test('tissue-write:3', () => {
    for (let i = 0; i < 10000; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:3', () => {
    for (let i = 0; i < 10000; i++) {
      const raw = fs.readFileSync(jsonFile, 'utf-8')
      const json = JSON.parse(raw)
      json.push(`${data}-${i}`)
      fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
    }
  })
})


describe('read:1', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < 1000; i++) {
      const content = `${data}-${i}`
      db.put(content)
      json[i.toString()] = content
    }

    fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
  })
  
  afterAll(() => {
    if (db) {
      db.close()
    }
    fs.unlinkSync(dbFile)
    fs.unlinkSync(jsonFile)
  })

  test('tissue-read:1', () => {
    expect(db.pick(100010001).record.payload).toBe(`${data}-0`)
  })

  test('json-read:1', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json['0']).toBe(`${data}-0`)
  })
})

describe('read:2', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < 10000; i++) {
      const content = `${data}-${i}`
      db.put(content)
      json[i.toString()] = content
    }

    fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
  })
  
  afterAll(() => {
    if (db) {
      db.close()
    }
    fs.unlinkSync(dbFile)
    fs.unlinkSync(jsonFile)
  })

  test('tissue-read:2', () => {
    expect(db.pick(100010001).record.payload).toBe(`${data}-0`)
  })

  test('json-read:2', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json['0']).toBe(`${data}-0`)
  })
})

describe('read:3', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < 100000; i++) {
      const content = `${data}-${i}`
      db.put(content)
      json[i.toString()] = content
    }

    fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
  })
  
  afterAll(() => {
    if (db) {
      db.close()
    }
    fs.unlinkSync(dbFile)
    fs.unlinkSync(jsonFile)
  })

  test('tissue-read:3', () => {
    expect(db.pick(100010001).record.payload).toBe(`${data}-0`)
  })

  test('json-read:3', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json['0']).toBe(`${data}-0`)
  })
})
