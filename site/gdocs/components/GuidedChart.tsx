import { runInAction } from "mobx"
import {
    EnrichedBlockGuidedChart,
    GrapherQueryParams,
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
import {
    GuidedChartContext,
    GrapherState,
    buildArchiveGuidedChartSrc,
} from "@ourworldindata/grapher"
import type { ArchiveGuidedChartRegistration } from "@ourworldindata/grapher"
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
        onSettingsChange: (
            newSettings: MultiDimDimensionChoices,
            queryParams: GrapherQueryParams
        ) => void
        grapherContainerRef: React.RefObject<HTMLDivElement | null>
    } | null>(null)
    const { announce } = useAriaAnnouncer()
    const archiveChartRegistrationRef =
        useRef<ArchiveGuidedChartRegistration | null>(null)

    const registerArchiveChart = useCallback(
        (registration: ArchiveGuidedChartRegistration) => {
            archiveChartRegistrationRef.current = registration
            return () => {
                if (archiveChartRegistrationRef.current === registration) {
                    archiveChartRegistrationRef.current = null
                }
            }
        },
        []
    )

    const applyGuidedChartLinkToArchive = useCallback((url: Url): boolean => {
        const registration = archiveChartRegistrationRef.current
        const iframeEl = registration?.iframeRef.current
        if (!registration || !iframeEl) return false

        const nextSrc = buildArchiveGuidedChartSrc(registration, url)
        if (iframeEl.src === nextSrc) return true
        iframeEl.src = nextSrc
        return true
    }, [])

    const handleGuidedChartLinkClick = useCallback(
        (href: string) => {
            const url = Url.fromURL(href)
            const handledArchiveIframe = applyGuidedChartLinkToArchive(url)

            let didUpdateChart = handledArchiveIframe

            if (!handledArchiveIframe) {
                const grapherState = stateRef.current
                if (!grapherState) return

                // If the chart is a MultiDim, we have to update its settings directly
                if (multiDimData) {
                    const searchParams = new URLSearchParams()
                    Object.entries(url.queryParams).forEach(([key, value]) => {
                        if (value !== undefined) {
                            searchParams.set(key, value)
                        }
                    })
                    const choices = extractMultiDimChoicesFromSearchParams(
                        searchParams,
                        multiDimData.config
                    )
                    // MultiDim must set the query params itself only after it
                    // sets the config of the selected view.
                    multiDimData.onSettingsChange(choices, url.queryParams)
                } else {
                    // Update the grapher state with the new params (e.g. countries, tab, etc)
                    runInAction(() => {
                        grapherState.clearQueryParams()
                        grapherState.populateFromQueryParams(url.queryParams)
                    })
                }
                didUpdateChart = true
            }

            if (!didUpdateChart) return

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
        [announce, applyGuidedChartLinkToArchive, multiDimData]
    )

    return (
        <GuidedChartContext.Provider
            value={{
                grapherStateRef: stateRef as React.RefObject<GrapherState>,
                chartRef: chartRef as React.RefObject<HTMLDivElement>,
                onGuidedChartLinkClick: handleGuidedChartLinkClick,
                registerArchiveChart,
                registerMultiDim: (registrationData: {
                    config: MultiDimDataPageConfig
                    onSettingsChange: (
                        newSettings: MultiDimDimensionChoices,
                        queryParams: GrapherQueryParams
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
