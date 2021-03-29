/**
 * Prevents creating multiple promises for a single key.
 *
 * If an existing promise for a key is pending, that promise will be returned without
 * creating a new one.
 *
 * If a promise throws an error, it will be discarded, and a new one created the next
 * time a key is requested.
 *
 * For now it only supports primitive value keys, but we can extend it if necessary.
 */
export class PromiseCache<Key extends string | number | undefined, Result> {
    constructor(private createPromiseFromKey: (key: Key) => Promise<Result>) {}

    private promisesByKey = new Map<Key, Promise<Result>>()

    get(key: Key): Promise<Result> {
        if (!this.promisesByKey.has(key)) {
            this.promisesByKey.set(
                key,
                // Make sure to attach .catch() _before_ adding it to the cache.
                // Otherwise external logic would be able to attach a catch() that
                // could make this one unreachable.
                this.createPromiseFromKey(key).catch((error) => {
                    this.promisesByKey.delete(key)
                    throw error
                })
            )
        }
        return this.promisesByKey.get(key)!
    }

    has(key: Key): boolean {
        return this.promisesByKey.has(key)
    }
}
