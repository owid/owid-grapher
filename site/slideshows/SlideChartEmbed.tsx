import React, { useEffect, useRef, useState } from "react"
import { reaction, runInAction } from "mobx"
import { GrapherState } from "@ourworldindata/grapher"
import { ResolvedSlideChartInfo } from "@ourworldindata/types"
import {
    Explorer,
    ExplorerProps,
    buildExplorerProps,
} from "@ourworldindata/explorer"
import { fetchText } from "@ourworldindata/utils"
import {
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
} from "../../settings/clientSettings.js"
import { SlideGrapher } from "./SlideGrapher.js"
import { parseSlideChartUrl } from "./slideshowUtils.js"

interface SlideChartEmbedProps {
    url: string
    /** Pre-resolved chart info from bake time. If not provided, falls back to client-side resolution. */
    resolvedInfo?: ResolvedSlideChartInfo
    /** If provided, the GrapherState is stored on this ref (for admin editor). Otherwise each chart owns its own. */
    grapherStateRef?: React.RefObject<GrapherState | null>
    onQueryStringChange?: (queryString: string) => void
    hideTitle?: boolean
    hideSubtitle?: boolean
}

/**
 * Embeds a chart (grapher, multi-dim, or explorer) in a slide.
 *
 * When `resolvedInfo` is provided (baked site), uses it directly to
 * determine the rendering strategy — no client-side probing needed.
 *
 * When not provided (admin editor), falls back to parsing the URL
 * to determine the type.
 */
export function SlideChartEmbed(
    props: SlideChartEmbedProps
): React.ReactElement {
    const {
        url,
        resolvedInfo,
        grapherStateRef,
        onQueryStringChange,
        hideTitle,
        hideSubtitle,
    } = props

    const parsed = parseSlideChartUrl(url)

    // If we have bake-time resolution info, use it directly
    const chartType = resolvedInfo?.type ?? parsed.type

    if (chartType === "explorer") {
        return (
            <SlideExplorer
                url={url}
                onQueryStringChange={onQueryStringChange}
                hideTitle={hideTitle}
                hideSubtitle={hideSubtitle}
            />
        )
    }

    // For multi-dim with bake-time resolution, use the pre-resolved config UUID
    const configUrl =
        resolvedInfo?.type === "multi-dim"
            ? `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${resolvedInfo.configId}.config.json`
            : undefined

    return (
        <SlideGrapher
            slug={parsed.slug}
            configUrl={configUrl}
            initialQueryString={parsed.queryString}
            grapherStateRef={grapherStateRef}
            onQueryStringChange={onQueryStringChange}
            hideTitle={hideTitle}
            hideSubtitle={hideSubtitle}
        />
    )
}

/**
 * Wrapper around `<Explorer>` that fetches the explorer HTML,
 * builds props, applies display overrides, and tracks query
 * string changes.
 */
function SlideExplorer(props: {
    url: string
    onQueryStringChange?: (queryString: string) => void
    hideTitle?: boolean
    hideSubtitle?: boolean
}): React.ReactElement {
    const { url, onQueryStringChange, hideTitle, hideSubtitle } = props
    const parsed = parseSlideChartUrl(url)
    const explorerRef = useRef<Explorer>(null)
    const onChangeRef = useRef(onQueryStringChange)
    onChangeRef.current = onQueryStringChange
    const hideTitleRef = useRef(hideTitle)
    hideTitleRef.current = hideTitle
    const hideSubtitleRef = useRef(hideSubtitle)
    hideSubtitleRef.current = hideSubtitle

    const [explorerProps, setExplorerProps] = useState<ExplorerProps | null>(
        null
    )

    // Fetch explorer HTML and build props on mount
    useEffect(() => {
        let cancelled = false
        const baseUrl = BAKED_GRAPHER_URL.replace("/grapher", "")
        const explorerUrl = `${baseUrl}/explorers/${parsed.slug}`
        void fetchText(explorerUrl).then((html) => {
            if (cancelled) return
            // Append hideControls=true so explorer controls are hidden
            const searchParams = new URLSearchParams(
                parsed.queryString?.replace(/^\?/, "") ?? ""
            )
            searchParams.set("hideControls", "true")
            void buildExplorerProps(html, `?${searchParams.toString()}`).then(
                (props) => {
                    if (!cancelled) setExplorerProps(props)
                }
            )
        })
        return () => {
            cancelled = true
        }
    }, [parsed.slug, parsed.queryString])

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
                    runInAction(() => {
                        explorer.grapherState.hideTitle =
                            hideTitleRef.current ?? false
                        explorer.grapherState.hideSubtitle =
                            hideSubtitleRef.current ?? false
                        explorer.grapherState.hideLogo = true
                        explorer.grapherState.hideFullscreenButton = true
                        explorer.grapherState.hideShareButton = true
                        explorer.grapherState.hideDownloadButton = true
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
    }, [explorerProps])

    if (!explorerProps) {
        return (
            <div className="SlideContent__media-placeholder">
                Loading explorer...
            </div>
        )
    }

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
