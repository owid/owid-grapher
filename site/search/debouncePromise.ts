import * as _ from "lodash-es"

export interface DebouncedPromise<T> {
    schedule(value: T): Promise<T>
    cancel(): void
}

/**
 * Unlike the naive debounce from Algolia's documentation, this settles a
 * superseded promise with `canceledValue`. Algolia tracks every sources promise
 * until it settles, so merely clearing its timeout would retain pending request
 * chains while the autocomplete remains mounted.
 */
export function createDebouncedPromise<T>(
    delay: number,
    canceledValue: T
): DebouncedPromise<T> {
    let settlePending: ((value: T) => void) | undefined
    const resolveLatest = _.debounce(
        (value: T, resolve: (value: T) => void) => {
            settlePending = undefined
            resolve(value)
        },
        delay
    )

    function schedule(value: T): Promise<T> {
        settlePending?.(canceledValue)

        return new Promise((resolve) => {
            settlePending = resolve
            resolveLatest(value, resolve)
        })
    }

    function cancel(): void {
        resolveLatest.cancel()
        settlePending?.(canceledValue)
        settlePending = undefined
    }

    return { schedule, cancel }
}
