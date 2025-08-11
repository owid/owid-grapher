import {
    EnrichedBlockGuidedChart,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { Container } from "./layout.js"
import { useRef, useCallback, useState } from "react"
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
    const [multiDimData, setMultiDimData] = useState<{
        config: MultiDimDataPageConfig
        onSettingsChange: (newSettings: MultiDimDimensionChoices) => void
        grapherContainerRef: React.RefObject<HTMLDivElement | null>
    } | null>(null)
    const { announce } = useAriaAnnouncer()

    const handleGuidedChartLinkClick = useCallback(
        (href: string) => {
            if (!stateRef.current) return

            const url = Url.fromURL(href)

            // If the chart is a MultiDim, we have to update its settings directly
            if (multiDimData) {
                const searchParams = new URLSearchParams()
                Object.entries(url.queryParams).forEach(([key, value]) => {
                    if (value !== undefined) {
                        searchParams.set(key, value)
                    }
                })

                // Extract MultiDim choices from the guided chart link and update the MultiDim component
                const choices = extractMultiDimChoicesFromSearchParams(
                    searchParams,
                    multiDimData.config
                )
                multiDimData.onSettingsChange(choices)
            }

            // Update the grapher state with the new params (e.g. countries, tab, etc)
            stateRef.current.clearQueryParams()
            stateRef.current.populateFromQueryParams(url.queryParams)
            analytics.logGuidedChartLinkClick(url.fullUrl)
            announce("Chart updated to reflect the selected view.")

            // Scroll to chart on small screens
            if (window.innerWidth <= 768) {
                const target =
                    multiDimData?.grapherContainerRef.current ||
                    chartRef.current
                // Small delay to allow chart updates to complete
                setTimeout(() => {
                    target?.scrollIntoView({
                        behavior: "smooth",
                    })
                }, 100)
            }
        },
        [announce, multiDimData]
    )

    return (
        <GuidedChartContext.Provider
            value={{
                grapherStateRef: stateRef as React.RefObject<GrapherState>,
                chartRef: chartRef as React.RefObject<HTMLDivElement>,
                onGuidedChartLinkClick: handleGuidedChartLinkClick,
                registerMultiDim: (registrationData: {
                    config: MultiDimDataPageConfig
                    onSettingsChange: (
                        newSettings: MultiDimDimensionChoices
                    ) => void
                    grapherContainerRef: React.RefObject<HTMLDivElement | null>
                }) => {
                    setMultiDimData(registrationData)
                },
            }}
        >
            <ArticleBlocks blocks={d.content} containerType={containerType} />
        </GuidedChartContext.Provider>
    )
}
