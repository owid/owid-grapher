import { EnrichedBlockGuidedChart } from "@ourworldindata/types"
import { Container } from "./layout.js"
import { useRef, useCallback } from "react"
import { Url } from "@ourworldindata/utils"
import { ArticleBlocks } from "./ArticleBlocks.js"
import { GuidedChartContext, GrapherState } from "@ourworldindata/grapher"

export default function GuidedChart({
    d,
    containerType = "default",
}: {
    d: EnrichedBlockGuidedChart
    containerType?: Container
}) {
    const stateRef = useRef<GrapherState | null>(null)

    const handleGuidedChartLinkClick = useCallback((href: string) => {
        if (!stateRef.current) return

        stateRef.current.clearQueryParams()
        stateRef.current.populateFromQueryParams(Url.fromURL(href).queryParams)
    }, [])

    return (
        <GuidedChartContext.Provider
            value={{
                grapherStateRef: stateRef as React.RefObject<GrapherState>,
                onGuidedChartLinkClick: handleGuidedChartLinkClick,
            }}
        >
            <div className="grid grid-cols-12-full-width span-cols-14">
                <ArticleBlocks
                    blocks={d.content}
                    containerType={containerType}
                />
            </div>
        </GuidedChartContext.Provider>
    )
}
