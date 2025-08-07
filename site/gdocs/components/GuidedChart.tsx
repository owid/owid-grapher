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
import { SiteAnalytics } from "../../SiteAnalytics.js"
import { useAriaAnnouncer } from "../../AriaAnnouncerUtils.js"

const analytics = new SiteAnalytics()

export default function GuidedChart({
    d,
    containerType = "default",
}: {
    d: EnrichedBlockGuidedChart
    containerType?: Container
    className?: string
}) {
    const stateRef = useRef<GrapherState | null>(null)
    const chartRef = useRef<HTMLDivElement | null>(null)
    const multiDimRef = useRef<{
        config: MultiDimDataPageConfig
        updater: (newSettings: MultiDimDimensionChoices) => void
    } | null>(null)
    const { announce } = useAriaAnnouncer()

    const handleGuidedChartLinkClick = useCallback(
        (href: string) => {
            if (!stateRef.current) return

            const url = Url.fromURL(href)

            // If the chart is a MultiDim, we have to update its settings directly
            if (multiDimRef.current) {
                const searchParams = new URLSearchParams()
                Object.entries(url.queryParams).forEach(([key, value]) => {
                    if (value !== undefined) {
                        searchParams.set(key, value)
                    }
                })

                // Extract MultiDim settings from the guided chart link
                // and update the MultiDim component
                const choices = extractMultiDimChoicesFromSearchParams(
                    searchParams,
                    multiDimRef.current.config
                )
                const availableChoices =
                    multiDimRef.current.config.filterToAvailableChoices(choices)
                multiDimRef.current.updater(availableChoices.selectedChoices)
            }

            // Update the grapher state with the new params (e.g. countries, tab, etc)
            stateRef.current.clearQueryParams()
            stateRef.current.populateFromQueryParams(url.queryParams)
            analytics.logGuidedChartLinkClick(url.fullUrl)
            announce("Chart updated to reflect the selected view.")

            // Scroll to chart on small screens
            if (chartRef.current && window.innerWidth <= 768) {
                // Small delay to allow chart updates to complete
                setTimeout(() => {
                    chartRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    })
                }, 100)
            }
        },
        [announce]
    )

    return (
        <GuidedChartContext.Provider
            value={{
                grapherStateRef: stateRef as React.RefObject<GrapherState>,
                chartRef: chartRef as React.RefObject<HTMLDivElement>,
                onGuidedChartLinkClick: handleGuidedChartLinkClick,
                registerMultiDim: (registrationData: {
                    config: MultiDimDataPageConfig
                    updater: (newSettings: MultiDimDimensionChoices) => void
                }) => {
                    multiDimRef.current = registrationData
                },
            }}
        >
            <ArticleBlocks blocks={d.content} containerType={containerType} />
        </GuidedChartContext.Provider>
    )
}
