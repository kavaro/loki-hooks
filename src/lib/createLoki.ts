import Loki from 'lokijs'
import { Hooks } from 'member-hooks'
import {
  THookOptions,
  THooksCollection,
  THooksCollectionOptions,
  THooksLoki,
  THooksLokiConfigOptions,
  THooksLokiDbObject
} from './types'

let called = false

/**
 * Enhances Loki constructor and addCollection method with a hooks option and adds a loaded method to Loki and Collection.
 * The hooks option allows the user to decorate the database and collection methods hooks as enabled by the member-hooks module.
 * The loaded methods will be called after the database or collection has been loaded and can be used in hooks to intercept a load.
 * The createHooksLoki function takes a database and a collection hooks registry (see member-hooks for documentation) as argument and returns the HooksLoki class.
 * This database registry allows the user to define hooks for the database.
 * This collection registry allows the user to define hooks for the collections.
 * The createHooksLoki function should be called only once in the lifetime of the application because it modifies Loki prototype methods
 * @param dbRegistry
 * @param collectionRegistry
 */
export function createHooksLoki(dbRegistry: Hooks, collectionRegistry: Hooks): THooksLoki {
  /* istanbul ignore if */
  if (called) {
    throw new Error(`createHooksLoki should be called only once`)
  }
  called = true

  // @ts-ignore
  Loki.prototype.loaded = function (): void { }
  // @ts-ignore
  Loki.Collection.prototype.loaded = function (): void { }

  function installHooks(registry: Hooks, obj: THooksLoki | THooksCollection<any>, hookOptions?: THookOptions): void {
    obj.hooks = hookOptions
    const hooksConfig = hookOptions?.config
    /* istanbul ignore else */
    if (hooksConfig) {
      registry.install(obj, hooksConfig)
    }
  }

  const configureOptions = Loki.prototype.configureOptions
  Loki.prototype.configureOptions = function (this: THooksLoki, options: THooksLokiConfigOptions, initialConfig): void {
    configureOptions.call(this, options, initialConfig)
    installHooks(dbRegistry, this, options.hooks)
  }

  const loadJSONObject = Loki.prototype.loadJSONObject
  Loki.prototype.loadJSONObject = function (this: THooksLoki, dbObject: THooksLokiDbObject, options): void {
    loadJSONObject.call(this, dbObject, options)
    installHooks(dbRegistry, this, dbObject.hooks)
    const collections = this.collections
    /* istanbul ignore else */
    if (collections) {
      collections.forEach((collection: THooksCollection<any>, index) => {
        installHooks(collectionRegistry, collection, dbObject.collections[index].hooks)
        collection.loaded()
      })
    }
    this.loaded()
  }

  const addCollection = Loki.prototype.addCollection
  Loki.prototype.addCollection = function <T extends object = any>(this: THooksLoki, name: string, options?: THooksCollectionOptions<T>): THooksCollection<T> {
    const collection = addCollection.call(this, name, options as any) as unknown as THooksCollection<T>
    /* istanbul ignore next */
    const hooks = options ? options.hooks : undefined
    installHooks(collectionRegistry, collection, hooks)
    return collection
  }

  const removeCollection = Loki.prototype.removeCollection
  Loki.prototype.removeCollection = function (name: string): void {
    collectionRegistry.uninstall(this.getCollection(name))
    return removeCollection.call(this, name)
  }

  return Loki as unknown as THooksLoki
}
