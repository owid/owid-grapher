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
import { useIsomorphicLayoutEffect } from "usehooks-ts"

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

/**
 * The element's content box, i.e. what a ResizeObserver reports as
 * `entry.contentRect`: the space available inside the element, excluding its
 * border and padding. Measuring the border box here instead would size a child
 * larger than the room it actually has, and would disagree with the
 * ResizeObserver updates that follow.
 *
 * Note this reads back layout, so only call it from a layout effect.
 */
function getContentBoxSize(element: HTMLElement): {
    width: number
    height: number
} {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    // Coerce to 0 rather than NaN: test DOMs don't always resolve these.
    const px = (value: string): number => parseFloat(value) || 0
    const horizontal =
        px(style.borderLeftWidth) +
        px(style.borderRightWidth) +
        px(style.paddingLeft) +
        px(style.paddingRight)
    const vertical =
        px(style.borderTopWidth) +
        px(style.borderBottomWidth) +
        px(style.paddingTop) +
        px(style.paddingBottom)

    return {
        width: Math.max(0, rect.width - horizontal),
        height: Math.max(0, rect.height - vertical),
    }
}

// Auto-updating Bounds object based on ResizeObserver
// Optionally throttles the bounds updates
//
// The `T` type parameter narrows the return type based on `initialValue`:
// passing `null` widens the return to `Bounds | null` (so callers can detect
// the pre-measurement state); omitting it keeps the return as `Bounds`.
export function useElementBounds<T extends Bounds | null = Bounds>(
    ref: RefObject<HTMLElement | null>,
    initialValue: T = DEFAULT_GRAPHER_BOUNDS as T,
    throttleTimeOrOptions:
        | number
        | {
              throttleTime?: number
              preserveLastNonZeroBounds?: boolean
          } = {}
): Bounds | T {
    const options =
        typeof throttleTimeOrOptions === "number"
            ? { throttleTime: throttleTimeOrOptions }
            : throttleTimeOrOptions
    const { throttleTime = 100, preserveLastNonZeroBounds = false } = options
    const [bounds, setBounds] = useState<Bounds | T>(initialValue)

    const updateBoundsImmediately = useCallback(
        (width: number, height: number) => {
            setBounds((currentBounds) => {
                // A temporarily hidden element can be reported as 0x0. For
                // responsive children such as Grapher, retaining their last
                // usable layout avoids a malformed render before the next
                // non-zero ResizeObserver update arrives.
                if (
                    preserveLastNonZeroBounds &&
                    (width === 0 || height === 0)
                ) {
                    return currentBounds
                }

                if (
                    currentBounds?.width === width &&
                    currentBounds.height === height
                ) {
                    return currentBounds
                }

                return new Bounds(0, 0, width, height)
            })
        },
        [preserveLastNonZeroBounds]
    )

    useIsomorphicLayoutEffect(() => {
        const element = ref.current
        if (!element) return

        // Same box the ResizeObserver below reports, so the first measurement
        // agrees with every update after it.
        const { width, height } = getContentBoxSize(element)
        updateBoundsImmediately(width, height)
    }, [ref, updateBoundsImmediately])

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

export function useDismissOnOutsidePointerDownOrUnmount(
    onDismiss: (() => void) | undefined
): void {
    useEffect(() => {
        if (!onDismiss) return
        document.addEventListener("pointerdown", onDismiss, { passive: true })
        return () => {
            document.removeEventListener("pointerdown", onDismiss)
            onDismiss()
        }
    }, [onDismiss])
}
