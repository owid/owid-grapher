import {
    EnrichedBlockGuidedChart,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { Container } from "./layout.js"
import { useRef, useCallback } from "react"
import {
    MultiDimDataPageConfig,
    Url,
    extractMultiDimChoicesFromSearchParams,
} from "@ourworldindata/utils"
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
    const multiDimRegistration = useRef<{
        config: any
        updater: (newSettings: MultiDimDimensionChoices) => void
    } | null>(null)

    const handleGuidedChartLinkClick = useCallback((href: string) => {
        if (!stateRef.current) return

        const url = Url.fromURL(href)

        // If we have a MultiDim, update its settings directly
        if (multiDimRegistration.current) {
            const searchParams = new URLSearchParams()
            Object.entries(url.queryParams).forEach(([key, value]) => {
                if (value !== undefined) {
                    searchParams.set(key, value)
                }
            })

            // Extract MultiDim settings from the guided chart link
            const choices = extractMultiDimChoicesFromSearchParams(
                searchParams,
                multiDimRegistration.current.config
            )
            const newSettings =
                multiDimRegistration.current.config.filterToAvailableChoices(
                    choices
                ).selectedChoices
            multiDimRegistration.current.updater(newSettings)
        }

        stateRef.current.clearQueryParams()
        stateRef.current.populateFromQueryParams(url.queryParams)
    }, [])

    return (
        <GuidedChartContext.Provider
            value={{
                grapherStateRef: stateRef as React.RefObject<GrapherState>,
                onGuidedChartLinkClick: handleGuidedChartLinkClick,
                onMultiDimSettingsUpdate: (registrationData: {
                    config: MultiDimDataPageConfig
                    updater: (newSettings: MultiDimDimensionChoices) => void
                }) => {
                    multiDimRegistration.current = registrationData
                },
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
