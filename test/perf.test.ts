import fs from 'fs'
import { TissueRoll } from '../'

describe('write', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'

  beforeEach(() => {
    db = TissueRoll.Create(dbFile, undefined, true)
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
    for (let i = 0; i < 1000; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:1', () => {
    for (let i = 0; i < 1000; i++) {
      const raw = fs.readFileSync(jsonFile, 'utf-8')
      const json = JSON.parse(raw)
      json.push(`${data}-${i}`)
      fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
    }
  })

  test('tissue-write:2', () => {
    for (let i = 0; i < 2000; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:2', () => {
    for (let i = 0; i < 2000; i++) {
      const raw = fs.readFileSync(jsonFile, 'utf-8')
      const json = JSON.parse(raw)
      json.push(`${data}-${i}`)
      fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
    }
  })

  test('tissue-write:3', () => {
    for (let i = 0; i < 4000; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:3', () => {
    for (let i = 0; i < 4000; i++) {
      const raw = fs.readFileSync(jsonFile, 'utf-8')
      const json = JSON.parse(raw)
      json.push(`${data}-${i}`)
      fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
    }
  })

  test('tissue-write:4', () => {
    for (let i = 0; i < 8000; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:4', () => {
    for (let i = 0; i < 8000; i++) {
      const raw = fs.readFileSync(jsonFile, 'utf-8')
      const json = JSON.parse(raw)
      json.push(`${data}-${i}`)
      fs.writeFileSync(jsonFile, JSON.stringify(json), 'utf-8')
    }
  })

  test('tissue-write:5', () => {
    for (let i = 0; i < 16000; i++) {
      db.put(`${data}-${i}`)
    }
  })

  test('json-write:5', () => {
    for (let i = 0; i < 16000; i++) {
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
  const max = 8000
  const ids: string[] = new Array(max)
  const r = Math.floor(Math.random()*ids.length)

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < max; i++) {
      const content = `${data}-${i}`
      const id = db.put(content)
      ids[i] = id
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
    expect(db.pick(ids[r]).record.payload).toBe(`${data}-${r}`)
  })

  test('json-read:1', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json[r]).toBe(`${data}-${r}`)
  })
})

describe('read:2', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'
  const max = 16000
  const ids: string[] = new Array(max)
  const r = Math.floor(Math.random()*ids.length)

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < max; i++) {
      const content = `${data}-${i}`
      const id = db.put(content)
      ids[i] = id
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
    expect(db.pick(ids[r]).record.payload).toBe(`${data}-${r}`)
  })

  test('json-read:2', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json[r]).toBe(`${data}-${r}`)
  })
})

describe('read:3', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'
  const max = 32000
  const ids: string[] = new Array(max)
  const r = Math.floor(Math.random()*ids.length)

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < max; i++) {
      const content = `${data}-${i}`
      const id = db.put(content)
      ids[i] = id
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
    expect(db.pick(ids[r]).record.payload).toBe(`${data}-${r}`)
  })

  test('json-read:3', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json[r]).toBe(`${data}-${r}`)
  })
})

describe('read:4', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'
  const max = 64000
  const ids: string[] = new Array(max)
  const r = Math.floor(Math.random()*ids.length)

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < max; i++) {
      const content = `${data}-${i}`
      const id = db.put(content)
      ids[i] = id
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

  test('tissue-read:4', () => {
    expect(db.pick(ids[r]).record.payload).toBe(`${data}-${r}`)
  })

  test('json-read:4', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json[r]).toBe(`${data}-${r}`)
  })
})

describe('read:5', () => {
  let db: TissueRoll

  const dbFile    = 'performance-test-tissue.db'
  const jsonFile  = 'performance-test-json.json'

  const data = 'Simple test string'
  const max = 128000
  const ids: string[] = new Array(max)
  const r = Math.floor(Math.random()*ids.length)

  beforeAll(() => {
    db = TissueRoll.Create(dbFile)

    const json: Record<string, string> = {}
    for (let i = 0; i < max; i++) {
      const content = `${data}-${i}`
      const id = db.put(content)
      ids[i] = id
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

  test('tissue-read:5', () => {
    expect(db.pick(ids[r]).record.payload).toBe(`${data}-${r}`)
  })

  test('json-read:5', () => {
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    const json = JSON.parse(raw)
    expect(json[r]).toBe(`${data}-${r}`)
  })
})
