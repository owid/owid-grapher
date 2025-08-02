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

const analytics = new SiteAnalytics()

export default function GuidedChart({
    d,
    containerType = "default",
}: {
    d: EnrichedBlockGuidedChart
    containerType?: Container
}) {
    const stateRef = useRef<GrapherState | null>(null)
    const chartRef = useRef<HTMLDivElement | null>(null)
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
        analytics.logGuidedChartLinkClick(url.fullUrl)

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
    }, [])

    return (
        <GuidedChartContext.Provider
            value={{
                grapherStateRef: stateRef as React.RefObject<GrapherState>,
                chartRef: chartRef as React.RefObject<HTMLDivElement>,
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
