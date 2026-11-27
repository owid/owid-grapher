import { useCallback, useMemo, useState } from "react"

import type { IncomeDistributionYear } from "./types.js"
import type {
    ChartState,
    ChartStateSetters,
} from "./useIncomeDistributionState.js"
import {
    resolveSlideChartState,
    type SlideChartField,
    type Walkthrough,
    type WalkthroughSlide,
} from "./walkthroughs.js"

/** Slide fields the reader's choice outlives the slide for (see stickyReleased) */
const STICKY_FIELDS: ReadonlySet<SlideChartField> = new Set([
    "currency",
    "timeInterval",
])

/**
 * State that belongs to one slide and is dropped when the slide changes: a
 * poverty line the reader dragged on it, and the fields its control handed
 * back to the reader's own state
 */
interface SlideLocalState {
    slideKey: string
    povertyLine?: number | null
    released: ReadonlySet<SlideChartField>
}

/**
 * What the chart shows while a walkthrough plays, and the setters its
 * controls use: the slide's state over the reader's own (see
 * resolveSlideChartState), with a line dragged on the slide staying on the
 * slide. A slide's control writes to the reader's state and releases its
 * field from the slide, so from then on the slide shows what the reader
 * picked; the units stay released on the following slides too, unless the
 * walkthrough fixes them. Without a slide, the reader's own state comes
 * back unchanged.
 */
export function useWalkthroughPlayback({
    readerState,
    setters,
    walkthrough,
    slide,
    slideNumber,
    yearData,
}: {
    readerState: ChartState
    setters: ChartStateSetters
    walkthrough: Walkthrough | undefined
    slide: WalkthroughSlide | undefined
    /** 1-based */
    slideNumber: number
    yearData: IncomeDistributionYear
}): { chartState: ChartState; slideSetters: ChartStateSetters } {
    const slideKey = walkthrough ? `${walkthrough.id}:${slideNumber}` : ""

    const [storedSlideState, setSlideState] = useState<SlideLocalState>({
        slideKey: "",
        released: new Set(),
    })
    // Units the reader picked on a slide stay picked: on the slides after it
    // and on the chart once the walkthrough closes, so a reader who switched
    // to their own currency keeps seeing it
    const [stickyReleased, setStickyReleased] = useState<
        ReadonlySet<SlideChartField>
    >(() => new Set())
    const slideState = useMemo(
        (): SlideLocalState =>
            storedSlideState.slideKey === slideKey
                ? storedSlideState
                : { slideKey, released: new Set() },
        [storedSlideState, slideKey]
    )
    const updateSlideState = useCallback(
        (update: (current: SlideLocalState) => Partial<SlideLocalState>) =>
            setSlideState((stored) => {
                const current =
                    stored.slideKey === slideKey
                        ? stored
                        : { slideKey, released: new Set<SlideChartField>() }
                return { ...current, ...update(current) }
            }),
        [slideKey]
    )

    const chartState = useMemo((): ChartState => {
        if (!slide) return readerState
        const resolved = resolveSlideChartState(
            readerState,
            slide.chart,
            walkthrough?.fixedUnits
                ? slideState.released
                : new Set([...stickyReleased, ...slideState.released]),
            (name) => yearData.byName.has(name)
        )
        return slideState.povertyLine !== undefined
            ? { ...resolved, povertyLine: slideState.povertyLine }
            : resolved
    }, [walkthrough, slide, readerState, slideState, stickyReleased, yearData])

    const release = useCallback(
        (field: SlideChartField) => {
            if (STICKY_FIELDS.has(field))
                setStickyReleased((current) => new Set([...current, field]))
            else
                updateSlideState((current) => ({
                    released: new Set([...current.released, field]),
                }))
        },
        [updateSlideState]
    )
    const slideSetters = useMemo(
        (): ChartStateSetters => ({
            ...setters,
            setView: (view) => {
                setters.setView(view)
                release("view")
            },
            setSelectedCountries: (names) => {
                setters.setSelectedCountries(names)
                release("countries")
            },
            setTimeInterval: (interval) => {
                setters.setTimeInterval(interval)
                release("timeInterval")
            },
            setCurrency: (key) => {
                setters.setCurrency(key)
                release("currency")
            },
            setPovertyLine: (line) =>
                updateSlideState(() => ({ povertyLine: line })),
        }),
        [setters, release, updateSlideState]
    )

    return { chartState, slideSetters }
}
