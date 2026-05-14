import React, { useEffect, useMemo, useRef } from "react"
import { when, reaction } from "mobx"
import {
    FetchingGrapher,
    GrapherState,
    GuidedChartContext,
    GuidedChartContextValue,
    useElementBounds,
} from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    CATALOG_URL,
    DATA_API_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
} from "../../../settings/clientSettings.js"
import { getSlideshowGrapherConfig } from "../../../site/slideshows/slideshowUtils.js"

export interface SlideGrapherProps {
    /** Chart slug — used as the React key for remounting */
    slug: string
    /** Override the config URL (e.g. for multi-dim views loaded by UUID) */
    configUrl?: string
    /** Initial query string — captured on mount; subsequent changes are ignored. */
    initialQueryString?: string
    /** Called when the user interacts with the Grapher and its params change */
    onQueryStringChange?: (queryString: string) => void
    /** If true, show timeline and controls. If false, hide them. */
    interactiveCharts?: boolean
    /** Called once when the chart is fully loaded, with its title and subtitle */
    onChartReady?: (info: { title: string; subtitle: string }) => void
}

/**
 * Renders a live Grapher chart inside the slideshow editor.
 *
 * Lifecycle: this component is keyed by the editor's apply token, so a fresh
 * mount happens every time the editor wants to apply a new URL. That means
 * `initialQueryString` only needs to be read once, on mount. User interactions
 * with the chart fire a MobX reaction that reports the new query string up,
 * but those changes are not fed back into the chart — the parent updates its
 * persisted URL state, which only flows back here on the next apply (= remount).
 */
export function SlideGrapher(props: SlideGrapherProps): React.ReactElement {
    const { slug, onQueryStringChange } = props

    const grapherStateRef = useRef<GrapherState | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(containerRef)

    // Capture initialQueryString at mount so chart-originated URL updates
    // (which flow back through props as the persisted slide URL changes)
    // don't cause FetchingGrapher to re-init.
    const initialQueryStringRef = useRef(props.initialQueryString)

    // Include the initial query string in the config URL so the server can
    // resolve the correct multi-dim view. Stable across renders by design.
    const resolvedConfigUrl =
        props.configUrl ??
        `${GRAPHER_DYNAMIC_CONFIG_URL}/${slug}.config.json${initialQueryStringRef.current ?? ""}`

    const guidedChartContextValue = useMemo<GuidedChartContextValue>(
        () => ({
            grapherStateRef: grapherStateRef as React.RefObject<GrapherState>,
        }),
        [grapherStateRef]
    )

    const grapherConfig = useMemo(
        () => ({
            bakedGrapherURL: BAKED_GRAPHER_URL,
            adminBaseUrl: ADMIN_BASE_URL,
            ...getSlideshowGrapherConfig({
                interactiveCharts: props.interactiveCharts ?? false,
            }),
        }),
        [props.interactiveCharts]
    )

    // Keep refs to callbacks so the reaction-setup effect can stay mount-only.
    const onChangeRef = useRef(onQueryStringChange)
    onChangeRef.current = onQueryStringChange
    const onChartReadyRef = useRef(props.onChartReady)
    onChartReadyRef.current = props.onChartReady

    // Wait for the Grapher to be fully ready (config + data loaded), then set
    // up the changedParams reaction. This avoids the transient init noise that
    // changedParams emits while config and data are loading. Same pattern as
    // AbstractChartEditor's when(isReady).
    useEffect(() => {
        const state = grapherStateRef.current
        if (!state) return

        let innerDispose: (() => void) | null = null

        const outerDispose = when(
            () => state.isReady,
            () => {
                onChartReadyRef.current?.({
                    title: state.currentTitle,
                    subtitle: state.currentSubtitle,
                })

                innerDispose = reaction(
                    () => state.changedParams,
                    (changedParams) => {
                        // externalQueryParams contains non-Grapher params
                        // (e.g. multi-dim dimension selectors like
                        // ?metric=unvaccinated&antigen=mcv1) that must be
                        // preserved in the reported query string.
                        const merged = new URLSearchParams([
                            ...Object.entries(
                                state.externalQueryParams
                            ),
                            ...Object.entries(changedParams),
                        ])
                        const qs = merged.toString()
                        onChangeRef.current?.(qs ? `?${qs}` : "")
                    }
                )
            }
        )

        return () => {
            outerDispose()
            innerDispose?.()
        }
    }, [grapherStateRef])

    return (
        <div ref={containerRef} className="slideshow-slide__grapher-container">
            <GuidedChartContext.Provider value={guidedChartContextValue}>
                <FetchingGrapher
                    config={grapherConfig}
                    configUrl={resolvedConfigUrl}
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
