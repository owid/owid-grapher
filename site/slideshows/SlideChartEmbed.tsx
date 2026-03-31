import React, { useEffect, useRef, useState } from "react"
import { reaction, runInAction } from "mobx"
import { GrapherState } from "@ourworldindata/grapher"
import { Explorer, ExplorerProps } from "@ourworldindata/explorer"
import { SlideGrapher } from "./SlideGrapher.js"
import { type ResolvedChart, getCachedResolution } from "./slideChartPreload.js"

interface SlideChartEmbedProps {
    url: string
    /** If provided, the GrapherState is stored on this ref (for admin editor). Otherwise each chart owns its own. */
    grapherStateRef?: React.RefObject<GrapherState | null>
    onQueryStringChange?: (queryString: string) => void
    hideTitle?: boolean
    hideSubtitle?: boolean
}

/**
 * Embeds a chart (grapher, multi-dim, or explorer) in a slide.
 * Resolves the chart type client-side by trying different config
 * URL patterns.
 */
export function SlideChartEmbed(
    props: SlideChartEmbedProps
): React.ReactElement {
    const {
        url,
        grapherStateRef,
        onQueryStringChange,
        hideTitle,
        hideSubtitle,
    } = props

    const [resolved, setResolved] = useState<ResolvedChart>({
        type: "loading",
    })

    useEffect(() => {
        let cancelled = false
        void getCachedResolution(url).then((result) => {
            if (!cancelled) setResolved(result)
        })
        return () => {
            cancelled = true
        }
    }, [url])

    switch (resolved.type) {
        case "loading":
            return (
                <div className="SlideContent__media-placeholder">
                    Loading chart...
                </div>
            )

        case "error":
            return (
                <div className="SlideContent__media-placeholder">
                    {resolved.message}
                </div>
            )

        case "grapher":
            return (
                <SlideGrapher
                    slug={resolved.slug}
                    initialQueryString={resolved.queryString}
                    grapherStateRef={grapherStateRef}
                    onQueryStringChange={onQueryStringChange}
                    hideTitle={hideTitle}
                    hideSubtitle={hideSubtitle}
                />
            )

        case "multi-dim":
            return (
                <SlideGrapher
                    slug={resolved.slug}
                    configUrl={resolved.configUrl}
                    initialQueryString={resolved.queryString}
                    grapherStateRef={grapherStateRef}
                    onQueryStringChange={(grapherQs) => {
                        // Merge grapher params with the preserved
                        // dimension params so the multi-dim view
                        // selection isn't lost when e.g. time changes
                        const params = new URLSearchParams(
                            grapherQs.replace(/^\?/, "")
                        )
                        for (const [key, value] of Object.entries(
                            resolved.dimensionParams
                        )) {
                            params.set(key, value)
                        }
                        const merged = params.toString()
                        onQueryStringChange?.(merged ? `?${merged}` : "")
                    }}
                    hideTitle={hideTitle}
                    hideSubtitle={hideSubtitle}
                />
            )

        case "explorer":
            return (
                <SlideExplorer
                    explorerProps={resolved.explorerProps}
                    onQueryStringChange={onQueryStringChange}
                    hideTitle={hideTitle}
                    hideSubtitle={hideSubtitle}
                />
            )
    }
}

/**
 * Wrapper around `<Explorer>` that sets up a MobX reaction on
 * `queryStr` to track user interactions (tab changes, entity
 * selection, etc.) and propagate them back as URL query string
 * changes — same pattern as SlideGrapher does for graphers.
 */
function SlideExplorer(props: {
    explorerProps: ExplorerProps
    onQueryStringChange?: (queryString: string) => void
    hideTitle?: boolean
    hideSubtitle?: boolean
}): React.ReactElement {
    const { explorerProps, onQueryStringChange, hideTitle, hideSubtitle } =
        props
    const explorerRef = useRef<Explorer>(null)
    const onChangeRef = useRef(onQueryStringChange)
    onChangeRef.current = onQueryStringChange
    const hideTitleRef = useRef(hideTitle)
    hideTitleRef.current = hideTitle
    const hideSubtitleRef = useRef(hideSubtitle)
    hideSubtitleRef.current = hideSubtitle

    useEffect(() => {
        const explorer = explorerRef.current
        if (!explorer) return

        const disposers: (() => void)[] = []

        // Re-apply display overrides whenever the grapher becomes ready.
        // The Explorer resets grapherState on every view change, so
        // using reaction (not when) ensures overrides survive resets.
        disposers.push(
            reaction(
                () => explorer.grapherState?.isReady,
                (isReady) => {
                    if (!isReady) return
                    runInAction(() => {
                        explorer.grapherState.hideTitle =
                            hideTitleRef.current ?? false
                        explorer.grapherState.hideSubtitle =
                            hideSubtitleRef.current ?? false
                        explorer.grapherState.hideLogo = true
                    })
                },
                { fireImmediately: true }
            )
        )

        // Track query string changes for persistence
        disposers.push(
            reaction(
                () => explorer.queryStr,
                (queryStr) => {
                    // Strip hideControls — we always hide controls in slideshows
                    const params = new URLSearchParams(
                        queryStr.replace(/^\?/, "")
                    )
                    params.delete("hideControls")
                    const cleaned = params.toString()
                    onChangeRef.current?.(cleaned ? `?${cleaned}` : "")
                }
            )
        )

        return () => disposers.forEach((d) => d())
    }, [])

    return (
        <div className="SlideContent__explorer-container">
            <Explorer
                ref={explorerRef}
                {...explorerProps}
                isEmbeddedInAnOwidPage={true}
            />
        </div>
    )
}
