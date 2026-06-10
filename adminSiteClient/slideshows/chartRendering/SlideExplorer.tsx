import {
    buildExplorerProps,
    Explorer,
    ExplorerProps,
} from "@ourworldindata/explorer"
import {
    getSlideshowGrapherConfig,
    parseSlideChartUrl,
} from "../../../site/slideshows/slideshowUtils.js"
import { useEffect, useRef, useState } from "react"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { fetchText } from "@ourworldindata/utils"
import { reaction, runInAction } from "mobx"

// Append hideControls=true to a query string so explorer chrome is hidden
function withHiddenControls(queryString?: string): string {
    const params = new URLSearchParams(queryString?.replace(/^\?/, "") ?? "")
    params.set("hideControls", "true")
    return `?${params.toString()}`
}

// Strip the hideControls param we inject
function withoutHiddenControls(queryStr: string): string {
    const params = new URLSearchParams(queryStr.replace(/^\?/, ""))
    params.delete("hideControls")
    const cleaned = params.toString()
    return cleaned ? `?${cleaned}` : ""
}

/**
 * Wrapper around `<Explorer>` that fetches the explorer HTML,
 * builds props, applies display overrides, and tracks query
 * string changes.
 */
export function SlideExplorer(props: {
    url: string
    onQueryStringChange?: (queryString: string) => void
    interactiveCharts?: boolean
    onChartReady?: (info: { title: string; subtitle: string }) => void
}): React.ReactElement {
    const { url, onQueryStringChange, interactiveCharts, onChartReady } = props
    const parsed = parseSlideChartUrl(url)
    const explorerRef = useRef<Explorer>(null)
    const onChangeRef = useRef(onQueryStringChange)
    onChangeRef.current = onQueryStringChange
    const onChartReadyRef = useRef(onChartReady)
    onChartReadyRef.current = onChartReady
    const interactiveChartsRef = useRef(interactiveCharts)
    interactiveChartsRef.current = interactiveCharts

    const explorerPropsKey = `${parsed.slug}\n${parsed.queryString ?? ""}`
    const [explorerPropsState, setExplorerPropsState] = useState<{
        key: string
        props: ExplorerProps
    } | null>(null)
    const explorerProps =
        explorerPropsState?.key === explorerPropsKey
            ? explorerPropsState.props
            : null
    const [explorerHtmlState, setExplorerHtmlState] = useState<{
        slug: string
        html: string
    } | null>(null)
    const explorerHtml =
        explorerHtmlState?.slug === parsed.slug ? explorerHtmlState.html : null

    // Fetch explorer HTML when the explorer slug changes. Query string changes
    // are applied below from the already-fetched HTML so chart-originated URL
    // persistence doesn't force a network refetch.
    useEffect(() => {
        let cancelled = false
        setExplorerHtmlState(null)
        setExplorerPropsState(null)
        const explorerUrl = `${BAKED_BASE_URL}/explorers/${parsed.slug}`
        void fetchText(explorerUrl).then((html) => {
            if (!cancelled) setExplorerHtmlState({ slug: parsed.slug, html })
        })
        return () => {
            cancelled = true
        }
    }, [parsed.slug])

    useEffect(() => {
        if (!explorerHtml) return
        let cancelled = false
        setExplorerPropsState(null)
        void buildExplorerProps(
            explorerHtml,
            withHiddenControls(parsed.queryString)
        ).then((props) => {
            if (!cancelled)
                setExplorerPropsState({ key: explorerPropsKey, props })
        })
        return () => {
            cancelled = true
        }
    }, [explorerHtml, explorerPropsKey, parsed.queryString])

    // Apply display overrides and track query string changes
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
                    onChartReadyRef.current?.({
                        title: explorer.grapherState.currentTitle,
                        subtitle: explorer.grapherState.currentSubtitle,
                    })
                    const config = getSlideshowGrapherConfig({
                        interactiveCharts:
                            interactiveChartsRef.current ?? false,
                    })
                    runInAction(() => {
                        Object.assign(explorer.grapherState, config)
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
                    onChangeRef.current?.(withoutHiddenControls(queryStr))
                }
            )
        )

        return () => disposers.forEach((d) => d())
    }, [explorerProps])

    if (!explorerProps) {
        return (
            <div className="slide__media-placeholder">Loading explorer...</div>
        )
    }

    return (
        <div className="slideshow-slide__grapher-container">
            <Explorer
                ref={explorerRef}
                {...explorerProps}
                isEmbeddedInAnOwidPage={true}
            />
        </div>
    )
}
