import { useEffect, useRef, useState } from "react"
import { useIsClient } from "usehooks-ts"

// Vendored from spin-delay v2.0.1 (MIT):
// https://github.com/smeijer/spin-delay/blob/v2.0.1/src/index.ts
// We keep an ESM copy here because the package only publishes a UMD build,
// which leaves a runtime `require("react")` in Grapher's published ESM bundle.

type SpinDelayOptions = {
    delay?: number
    minDuration?: number
    ssr?: boolean
}

type SpinDelayState = "IDLE" | "DELAY" | "DISPLAY" | "EXPIRE"

const defaultOptions = {
    delay: 500,
    minDuration: 200,
    ssr: true,
}

export function useSpinDelay(
    loading: boolean,
    options: SpinDelayOptions = {}
): boolean {
    const resolvedOptions = { ...defaultOptions, ...options }
    const isSsr = !useIsClient() && resolvedOptions.ssr
    const initialState = isSsr && loading ? "DISPLAY" : "IDLE"
    const [state, setState] = useState<SpinDelayState>(initialState)
    const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        if (loading && (state === "IDLE" || isSsr)) {
            clearTimeout(timeout.current)
            const delay = isSsr ? 0 : resolvedOptions.delay
            timeout.current = setTimeout(() => {
                if (!loading) {
                    setState("IDLE")
                    return
                }

                timeout.current = setTimeout(() => {
                    setState("EXPIRE")
                }, resolvedOptions.minDuration)
                setState("DISPLAY")
            }, delay)

            if (!isSsr) setState("DELAY")
        }

        if (!loading && state !== "DISPLAY") {
            clearTimeout(timeout.current)
            setState("IDLE")
        }
    }, [
        loading,
        state,
        resolvedOptions.delay,
        resolvedOptions.minDuration,
        isSsr,
    ])

    useEffect((): (() => void) => {
        return (): void => clearTimeout(timeout.current)
    }, [])

    return state === "DISPLAY" || state === "EXPIRE"
}
