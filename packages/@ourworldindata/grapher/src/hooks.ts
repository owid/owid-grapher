import { useCallback, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { OwidColumnDef } from "@ourworldindata/types"
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
