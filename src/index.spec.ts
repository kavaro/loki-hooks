import test from 'ava'
import sinon from 'sinon'
import Loki from 'lokijs'
import { v4 as uuid } from 'uuid'
import { Hooks, HookMethods } from 'member-hooks'
import { THooksLoki, createHooksLoki } from '.'

interface TSeqOptions {
  field?: string,
  key?: string
}

function seqHook(methods: HookMethods, options?: TSeqOptions): void {
  const { field = 'seq', key = 'seq' } = { ...options }
  methods.before('insert', 10, function (this: any, args: any[]): void {
    const hooks = this.hooks
    const store = hooks.store || (hooks.store = {})
    const doc = args[0]
    doc[field] = store[key] = (store[key] || 0) + 1
  })
}

function loadedHook(methods: HookMethods): void {
  methods.before('loaded', 10, function (this: any): void {
    this.loadedCallCount = (this.loadedCallCount || 0) + 1
  })
}

function saveHook(methods: HookMethods): void {
  methods.before('saveDatabaseInternal', 10, function (this: Loki, args: any[]): void {
    if (!this.events.saved) {
      this.events.saved = []
    }
    const fn = args[0]
    args[0] = (err: any) => {
      fn(err)
      if (!err) {
        this.emit('saved')
      }
    }
  })
}

const dbRegistry = new Hooks()
dbRegistry.register('saveDatabaseInternal', saveHook)

const collectionRegistry = new Hooks()
collectionRegistry.register('seq', seqHook)
collectionRegistry.register('loaded', loadedHook)

const HooksLoki = createHooksLoki(dbRegistry, collectionRegistry)

async function save(db: THooksLoki): Promise<void> {
  return new Promise(resolve => {
    db.saveDatabase(resolve)
  })
}

async function load(db: THooksLoki): Promise<void> {
  return new Promise(resolve => {
    db.loadDatabase({}, resolve)
  })
}

test('should add database hooks', async t => {
  const dbName = uuid()
  const db = new HooksLoki(dbName, {
    adapter: new Loki.LokiMemoryAdapter(),
    hooks: {
      config: [['saveDatabaseInternal', {}]]
    }
  })
  const saved = sinon.spy()
  db.addListener('saved', saved)
  await save(db)
  t.assert(saved.calledOnce)
  const dbLoaded = sinon.spy(db.loaded)
  db.loaded = dbLoaded
  await load(db)
  t.assert(dbLoaded.callCount > 0)
})

test('should add collection hooks', async t => {
  const dbName = uuid()
  const db = new HooksLoki(dbName, { adapter: new Loki.LokiMemoryAdapter() })
  let collection = db.addCollection('collection', {
    disableMeta: true,
    hooks: {
      store: { seq: 10 },
      config: [
        ['seq', { field: 'seq' }], 
        ['loaded', {}]
      ]
    }
  })
  t.deepEqual(collection.insert({ id: 'id1' }), { $loki: 1, id: 'id1', seq: 11 })
  await save(db)
  await load(db)
  collection = db.getCollection('collection')
  t.assert((collection as any).loadedCallCount > 0)
  t.deepEqual(collection.insert({ id: 'id1' }), { $loki: 2, id: 'id1', seq: 12 })
  db.removeCollection('collection')
  const newCollection = db.addCollection('collection', { disableMeta: true })
  t.deepEqual(newCollection.insert({ id: 'id1' }), { $loki: 1, id: 'id1' })
})

