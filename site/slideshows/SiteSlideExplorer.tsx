import React, { useEffect, useRef, useState } from "react"
import {
    buildExplorerProps,
    Explorer,
    ExplorerProps,
} from "@ourworldindata/explorer"
import {
    getSlideshowGrapherConfig,
    parseSlideChartUrl,
} from "./slideshowUtils.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { fetchText } from "@ourworldindata/utils"
import { reaction, runInAction } from "mobx"

/** Append hideControls=true to a query string so explorer chrome is hidden */
function withHiddenControls(queryString?: string): string {
    const params = new URLSearchParams(queryString?.replace(/^\?/, "") ?? "")
    params.set("hideControls", "true")
    return `?${params.toString()}`
}

/**
 * Simple explorer wrapper for the baked site / preview.
 * Fetches explorer HTML, builds props, and applies display overrides.
 * No query string tracking or admin callbacks.
 */
export function SiteSlideExplorer(props: {
    url: string
    interactiveCharts?: boolean
}): React.ReactElement {
    const { url, interactiveCharts } = props
    const parsed = parseSlideChartUrl(url)
    const explorerRef = useRef<Explorer>(null)

    const [explorerProps, setExplorerProps] = useState<ExplorerProps | null>(
        null
    )

    // Fetch explorer HTML and build props on mount
    useEffect(() => {
        let cancelled = false
        const explorerUrl = `${BAKED_BASE_URL}/explorers/${parsed.slug}`
        void fetchText(explorerUrl).then((html) => {
            if (cancelled) return
            void buildExplorerProps(
                html,
                withHiddenControls(parsed.queryString)
            ).then((props) => {
                if (!cancelled) setExplorerProps(props)
            })
        })
        return () => {
            cancelled = true
        }
    }, [parsed.slug, parsed.queryString])

    // Apply display overrides whenever the grapher becomes ready.
    // The Explorer resets grapherState on every view change, so
    // using reaction ensures overrides survive resets.
    useEffect(() => {
        const explorer = explorerRef.current
        if (!explorer) return

        const dispose = reaction(
            () => explorer.grapherState?.isReady,
            (isReady) => {
                if (!isReady) return
                const config = getSlideshowGrapherConfig({
                    interactiveCharts: interactiveCharts ?? false,
                })
                runInAction(() => {
                    Object.assign(explorer.grapherState, config)
                })
            },
            { fireImmediately: true }
        )

        return () => dispose()
    }, [explorerProps, interactiveCharts])

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
