import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import * as _ from "lodash-es"
import { OwidColumnDef } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { DEFAULT_GRAPHER_BOUNDS } from "./core/GrapherConstants.js"
import {
    CsvDownloadType,
    getDownloadUrl,
    type DataDownloadContextBase,
    type DataDownloadContextServerSide,
} from "./download.js"

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

export function useDataApiDownloadConfig({
    downloadCtxBase,
    firstYColDef,
}: {
    downloadCtxBase: DataDownloadContextBase
    firstYColDef?: OwidColumnDef
}): {
    csvUrl: string
    metadataUrl: string
    onlyVisible: boolean
    setOnlyVisible: Dispatch<SetStateAction<boolean>>
    shortColNames: boolean
    setShortColNames: Dispatch<SetStateAction<boolean>>
} {
    const [onlyVisible, setOnlyVisible] = useState(false)
    const [shortColNames, setShortColNames] = useState(
        !!firstYColDef?.shortName
    )

    const downloadCtx: DataDownloadContextServerSide = useMemo(
        () => ({
            ...downloadCtxBase,
            csvDownloadType: onlyVisible
                ? CsvDownloadType.CurrentSelection
                : CsvDownloadType.Full,
            shortColNames,
        }),
        [downloadCtxBase, onlyVisible, shortColNames]
    )

    const csvUrl = useMemo(
        () => getDownloadUrl("csv", downloadCtx),
        [downloadCtx]
    )
    const metadataUrl = useMemo(
        () => getDownloadUrl("metadata.json", downloadCtx),
        [downloadCtx]
    )

    return {
        csvUrl,
        metadataUrl,
        onlyVisible,
        setOnlyVisible,
        shortColNames,
        setShortColNames,
    }
}

// Auto-updating Bounds object based on ResizeObserver
// Optionally throttles the bounds updates
export const useElementBounds = (
    ref: RefObject<HTMLElement | null>,
    initialValue: Bounds = DEFAULT_GRAPHER_BOUNDS,
    throttleTime: number | undefined = 100
) => {
    const [bounds, setBounds] = useState<Bounds>(initialValue)

    const updateBoundsImmediately = useCallback(
        (width: number, height: number) => {
            setBounds(new Bounds(0, 0, width, height))
        },
        []
    )

    const updateBoundsThrottled = useMemo(
        () =>
            throttleTime !== undefined
                ? _.throttle(
                      updateBoundsImmediately,
                      throttleTime,

                      // We use `leading` because, in many cases, there is only a single resize event (e.g. phone screen
                      // orientation change), and we want to optimize for a fast response time in that case
                      { leading: true }
                  )
                : updateBoundsImmediately,
        [throttleTime, updateBoundsImmediately]
    )

    useEffect(() => {
        const element = ref.current
        if (!element) return

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            const { width, height } = entry.contentRect
            updateBoundsThrottled(width, height)
        })

        observer.observe(element)
        return () => observer.disconnect()
    }, [ref, updateBoundsThrottled])

    return bounds
}
