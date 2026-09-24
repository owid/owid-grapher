import { useCallback, useEffect, useRef, useState } from "react"
import { runInAction, reaction, when } from "mobx"
import cx from "clsx"
import { GrapherState } from "@ourworldindata/grapher"
import { Url } from "@ourworldindata/utils"
import {
    DataPerspectivesVariant,
    parseDataPerspectivesVariant,
    resolveVariantSearch,
} from "./dataPerspectivesVariant.js"
import {
    DataPerspective,
    getDataPerspectives,
} from "./dataPerspectivesFixtures.js"

/** Waits for grapher's config to load, then runs `fn` once. */
function onceConfigReady(
    ref: React.RefObject<GrapherState | null>,
    fn: (state: GrapherState) => void
): () => void {
    let tries = 0
    const id = window.setInterval(() => {
        const state = ref.current
        if (state?.isConfigReady) {
            window.clearInterval(id)
            fn(state)
        } else if (++tries > 150) {
            window.clearInterval(id)
        }
    }, 100)
    return () => window.clearInterval(id)
}

/**
 * Everything that drives the data page's live chart for the data-perspectives
 * prototype: which variant is active, applying a perspective, and — in the
 * narrative style — keeping the chart's title in step with what it shows.
 *
 * The chart is controlled through the GuidedChart machinery that already
 * drives charts in place from articles: the page provides `grapherStateRef`
 * via GuidedChartContext, and we call grapher's own `populateFromQueryParams`.
 */
export function useDataPerspectives(slug: string | undefined): {
    variant: DataPerspectivesVariant
    perspectives: DataPerspective[]
    grapherStateRef: React.RefObject<GrapherState | null>
    chartRef: React.RefObject<HTMLDivElement | null>
    applyPerspective: (index: number) => void
    narrativeStale: boolean
    restoreNarrative: () => void
    /** Classes for the element wrapping the perspective and its chart. */
    wrapperClassName: string
} {
    const perspectives = getDataPerspectives(slug)

    // Parsed after mount, not during render: the server has no window.location,
    // and React does not patch up attribute mismatches during hydration — so a
    // variant computed inline would leave the page stuck on the SSR default.
    const [variant, setVariant] = useState(() =>
        parseDataPerspectivesVariant(undefined)
    )
    useEffect(() => {
        setVariant(parseDataPerspectivesVariant(resolveVariantSearch()))
    }, [])

    const grapherStateRef = useRef<GrapherState | null>(null)
    const chartRef = useRef<HTMLDivElement | null>(null)

    const isPageswipe = variant.layout === "pageswipe"
    const isNarrative = isPageswipe && variant.style === "narrative"

    // What the chart displays before we touch it. Captured once, from grapher
    // itself rather than the saved config: a chart with no saved subtitle
    // (life-expectancy) shows one derived from its indicator, which building
    // from the config would drop. The raw values are kept too, so reverting
    // restores exactly the original behaviour.
    const originalHeader = useRef<{
        displayTitle: string
        displaySubtitle: string
        rawTitle: string | undefined
        rawSubtitle: string | undefined
    } | null>(null)

    // Once the reader changes the view, the narrative title no longer
    // describes what's on screen.
    const [narrativeStale, setNarrativeStale] = useState(false)
    const appliedParamsRef = useRef<string | null>(null)
    const lastAppliedIndexRef = useRef(0)

    const applyPerspective = useCallback(
        (index: number) => {
            const grapherState = grapherStateRef.current
            const perspective = perspectives[index]
            if (!grapherState || !perspective) return
            const url = Url.fromURL(
                `/grapher/${slug}?${perspective.queryParams}`
            )
            lastAppliedIndexRef.current = index
            runInAction(() => {
                grapherState.clearQueryParams()
                grapherState.populateFromQueryParams(url.queryParams)
                // Snapshot inside the action, so the change watcher (which
                // runs as the action ends) compares against *this* view.
                appliedParamsRef.current = JSON.stringify(
                    grapherState.changedParams
                )
            })
            setNarrativeStale(false)

            if (!isNarrative) return
            // The header has to wait for the chart's data columns: a derived
            // subtitle only exists once the data has loaded, and capturing
            // earlier gives an empty one.
            const setHeader = () =>
                runInAction(() => {
                    originalHeader.current ??= {
                        displayTitle: grapherState.mainTitle ?? "",
                        displaySubtitle: grapherState.effectiveSubtitle ?? "",
                        rawTitle: grapherState.title,
                        rawSubtitle: grapherState.subtitle,
                    }
                    const { displayTitle, displaySubtitle } =
                        originalHeader.current
                    // The chart's own title leads the subtitle, in bold.
                    const leadIn = displayTitle.replace(/\.$/, "")
                    grapherState.title = perspective.title
                    grapherState.subtitle =
                        `**${leadIn}.** ${displaySubtitle}`.trim()
                })
            const columnsLoaded = () =>
                grapherState.isReady &&
                grapherState.yColumnsFromDimensions.length > 0
            if (originalHeader.current || columnsLoaded()) setHeader()
            else void when(columnsLoaded, setHeader)
        },
        [perspectives, slug, isNarrative]
    )

    const restoreNarrative = useCallback(
        () => applyPerspective(lastAppliedIndexRef.current),
        [applyPerspective]
    )

    // The first change away from the applied perspective marks the narrative
    // stale. `hide` and `disable` are pure CSS (see wrapperClassName), so the
    // title's space and the subtitle stay put; `revert` restores the chart's
    // own title and subtitle (and, with nothing to go back to, shows no
    // restore control).
    useEffect(() => {
        if (!isNarrative) return
        let dispose: (() => void) | undefined
        const cancel = onceConfigReady(grapherStateRef, (grapherState) => {
            dispose = reaction(
                () => JSON.stringify(grapherState.changedParams),
                (params) => {
                    if (appliedParamsRef.current === null) return
                    if (params === appliedParamsRef.current) return
                    setNarrativeStale(true)
                    const original = originalHeader.current
                    if (variant.narrativeStale === "revert" && original) {
                        runInAction(() => {
                            grapherState.title = original.rawTitle
                            grapherState.subtitle = original.rawSubtitle
                        })
                    }
                }
            )
        })
        return () => {
            cancel()
            dispose?.()
        }
    }, [isNarrative, variant.narrativeStale])

    // Pageswipe shows the first perspective as the current one, so it has to
    // be what the chart actually shows — not the default view. Wait for
    // grapher's config to land, so our params aren't overwritten by its own
    // initial load.
    const appliedInitialPerspective = useRef(false)
    useEffect(() => {
        if (!isPageswipe || !perspectives.length) return
        if (appliedInitialPerspective.current) return
        return onceConfigReady(grapherStateRef, () => {
            appliedInitialPerspective.current = true
            applyPerspective(0)
        })
    }, [isPageswipe, perspectives.length, applyPerspective])

    const wrapperClassName = cx("chart-with-perspectives", {
        "chart-with-perspectives--pageswipe": isPageswipe,
        [`chart-with-perspectives--style-${variant.style}`]: isPageswipe,
        "chart-with-perspectives--narrative-hidden":
            isNarrative && narrativeStale && variant.narrativeStale === "hide",
        "chart-with-perspectives--narrative-disabled":
            isNarrative &&
            narrativeStale &&
            variant.narrativeStale === "disable",
    })

    return {
        variant,
        perspectives,
        grapherStateRef,
        chartRef,
        applyPerspective,
        narrativeStale,
        restoreNarrative,
        wrapperClassName,
    }
}
