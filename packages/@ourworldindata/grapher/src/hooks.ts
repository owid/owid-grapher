import { useCallback, useRef, useState } from "react"

/**
 * Like useState, but clearing (setting to undefined) is debounced.
 * Setting a value is always immediate and cancels any pending clear.
 */
export function useStateWithDebouncedClear<T>(
    initialValue: T | undefined,
    clearDelay = 200
): [value: T | undefined, set: (value: T) => void, clear: () => void] {
    const [value, setValue] = useState<T | undefined>(initialValue)
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    )

    const set = useCallback(
        (newValue: T) => {
            if (timerRef.current) clearTimeout(timerRef.current)
            setValue(newValue)
        },
        [setValue]
    )

    const clear = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setValue(undefined), clearDelay)
    }, [setValue, clearDelay])

    return [value, set, clear]
}
