import React, { useEffect, useMemo, useRef } from "react"
import { when, reaction, runInAction } from "mobx"
import {
    FetchingGrapher,
    GrapherState,
    GuidedChartContext,
    GuidedChartContextValue,
} from "@ourworldindata/grapher"
import {
    Bounds,
    queryParamsToStr,
    strToQueryParams,
} from "@ourworldindata/utils"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    CATALOG_URL,
    DATA_API_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
} from "../../settings/clientSettings.js"

export interface SlideGrapherProps {
    /** Chart slug to render */
    slug: string
    /** Initial query string — only applied on first mount for a given slug */
    initialQueryString?: string
    /**
     * Top-level ref that the GrapherState is stored on via GuidedChartContext.
     * The parent owns this so it persists across re-renders.
     */
    grapherStateRef: React.RefObject<GrapherState | null>
    /** Called when the user interacts with the Grapher and its params change */
    onQueryStringChange?: (queryString: string) => void
    /** Hide the Grapher's built-in title (when the slide provides its own) */
    hideTitle?: boolean
    /** Hide the Grapher's subtitle */
    hideSubtitle?: boolean
}

/**
 * Renders a live Grapher chart that persists across slide transitions.
 *
 * Used by both the admin editor (for live MobX sync) and the baked
 * site (for smooth transitions between slides sharing a chart slug).
 *
 * `initialQueryString` is only read on the initial mount for a given
 * slug — it is NOT reactive. This prevents the feedback loop where
 * reaction → update slide → new queryStr prop → re-apply → reaction.
 *
 * When navigating between slides with the same slug but different
 * query params, the existing GrapherState is updated in-place via
 * `clearQueryParams()` + `populateFromQueryParams()`, giving a
 * smooth transition without remounting.
 */
export function SlideGrapher(props: SlideGrapherProps): React.ReactElement {
    const { slug, initialQueryString, grapherStateRef, onQueryStringChange } =
        props

    const containerRef = useRef<HTMLDivElement>(null)
    const [bounds, setBounds] = React.useState<Bounds>(
        new Bounds(0, 0, 800, 450)
    )

    const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/${slug}.config.json`

    // Capture initialQueryString at mount time so it doesn't change
    // on re-renders (which would cause FetchingGrapher to re-init).
    const initialQueryStringRef = useRef(initialQueryString)

    const guidedChartContextValue = useMemo<GuidedChartContextValue>(
        () => ({
            grapherStateRef: grapherStateRef as React.RefObject<GrapherState>,
        }),
        [grapherStateRef]
    )

    // Static config — must NOT include hideTitle/hideSubtitle because
    // changing the config reference triggers FetchingGrapher's config
    // fetch effect, which calls reset() and wipes query params.
    // Instead, those display flags are applied imperatively below.
    const grapherConfig = useMemo(
        () => ({
            bakedGrapherURL: BAKED_GRAPHER_URL,
            adminBaseUrl: ADMIN_BASE_URL,
            hideShareButton: true,
            hideExploreTheDataButton: true,
            hideRelatedQuestion: true,
            hideLogo: true,
            isEmbeddedInAnOwidPage: true,
        }),
        []
    )

    // Apply hideTitle/hideSubtitle imperatively on the GrapherState
    // so that toggling them doesn't cause FetchingGrapher to re-fetch.
    useEffect(() => {
        const state = grapherStateRef.current
        if (!state) return
        runInAction(() => {
            state.hideTitle = props.hideTitle ?? false
            state.hideSubtitle = props.hideSubtitle ?? false
        })
    }, [props.hideTitle, props.hideSubtitle, grapherStateRef])

    // Measure the container and update bounds
    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                if (width > 0 && height > 0) {
                    setBounds(new Bounds(0, 0, width, height))
                }
            }
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // When the slug changes, clear the ref so FetchingGrapher creates
    // a fresh GrapherState for the new chart.
    const prevSlugRef = useRef(slug)
    if (prevSlugRef.current !== slug) {
        grapherStateRef.current = null
        prevSlugRef.current = slug
        initialQueryStringRef.current = initialQueryString
    }

    // Clear the ref on unmount so that if SlideGrapher remounts
    // (e.g. navigating away to a non-grapher slide and back),
    // FetchingGrapher creates a fresh GrapherState with the
    // current initialQueryString rather than reusing a stale one.
    useEffect(() => {
        return () => {
            grapherStateRef.current = null
        }
    }, [grapherStateRef])

    // Keep a ref to the callback to avoid re-running the effect when
    // only the callback identity changes.
    const onChangeRef = useRef(onQueryStringChange)
    onChangeRef.current = onQueryStringChange

    // When true, the reaction callback is suppressed to avoid a
    // feedback loop when we programmatically apply query params.
    const isSuppressingReactionRef = useRef(false)

    // Wait for the Grapher to be fully ready (config + data loaded),
    // then set up the changedParams reaction. This completely avoids
    // the transient init noise that changedParams goes through while
    // the config and data are loading. Same pattern as the chart
    // editor's when(isReady) approach in AbstractChartEditor.
    useEffect(() => {
        const state = grapherStateRef.current
        if (!state) return

        let innerDispose: (() => void) | null = null

        const outerDispose = when(
            () => state.isReady,
            () => {
                innerDispose = reaction(
                    () => state.changedParams,
                    (changedParams) => {
                        if (isSuppressingReactionRef.current) return
                        const qs = queryParamsToStr(changedParams)
                        onChangeRef.current?.(qs)
                    }
                )
            }
        )

        return () => {
            outerDispose()
            innerDispose?.()
        }
    }, [slug, grapherStateRef])

    // When navigating between slides with the same slug but different
    // query params, apply the new params to the existing GrapherState
    // (which stays mounted thanks to key={slug}). This gives a smooth
    // transition rather than a full remount. Also update the baseline
    // so the new params aren't reported as a "change".
    const prevInitialQueryStringRef = useRef(initialQueryString)
    useEffect(() => {
        if (prevInitialQueryStringRef.current === initialQueryString) return
        prevInitialQueryStringRef.current = initialQueryString

        const state = grapherStateRef.current
        if (!state || !state.isConfigReady) return

        isSuppressingReactionRef.current = true
        runInAction(() => {
            state.clearQueryParams()
            if (initialQueryString) {
                state.populateFromQueryParams(
                    strToQueryParams(initialQueryString)
                )
            }
        })
        isSuppressingReactionRef.current = false
    }, [initialQueryString, grapherStateRef])

    return (
        <div ref={containerRef} className="SlideGrapher">
            <GuidedChartContext.Provider value={guidedChartContextValue}>
                <FetchingGrapher
                    key={slug}
                    config={grapherConfig}
                    configUrl={configUrl}
                    dataApiUrl={DATA_API_URL}
                    catalogUrl={CATALOG_URL}
                    archiveContext={undefined}
                    queryStr={initialQueryStringRef.current}
                    externalBounds={bounds}
                />
            </GuidedChartContext.Provider>
        </div>
    )
}
