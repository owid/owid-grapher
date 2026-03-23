import { useMemo, useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { DemographyControls } from "../components/DemographyControls.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type { AgeDistributionVariantConfig } from "../config.js"
import { articulateEntity } from "@ourworldindata/utils"
import { CountryData } from "../helpers/types.js"
import { useSimulation } from "../helpers/useSimulation.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ResponsivePopulationByAgeChart } from "../components/PopulationByAgeChart.js"
import { groupAgeGroupsByZone } from "../helpers/utils.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    DEFAULT_ENTITY_NAME,
    END_YEAR,
    FULL_TIME_RANGE,
} from "../helpers/constants.js"

export function AgeDistributionVariantWithProviders(props: {
    container: HTMLDivElement
    config: AgeDistributionVariantConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <AgeDistributionVariant config={props.config} />
        </QueryClientProvider>
    )
}

function AgeDistributionVariant({
    config,
}: {
    config: AgeDistributionVariantConfig
}): React.ReactElement {
    const showControls = !config.hideControls
    const [entityName, setEntityName] = useState(
        config.region ?? DEFAULT_ENTITY_NAME
    )

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <div className="demography-chart demography-chart__age-distribution-variant">
            {showControls && (
                <DemographyControls
                    metadata={metadata}
                    entityName={entityName}
                    setEntityName={setEntityName}
                />
            )}
            <AgeDistributionCaptionedChart
                data={entityData}
                isLoading={isLoadingEntityData}
                title={config.title}
                subtitle={config.subtitle}
                hideTimeline={config.hideTimeline}
            />
        </div>
    )
}

function AgeDistributionCaptionedChart({
    data,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideTimeline,
}: {
    data: CountryData
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideTimeline?: boolean
}) {
    const [year, setYear] = useState(END_YEAR)
    const simulation = useSimulation(data)
    const ageZones = useMemo(() => groupAgeGroupsByZone(), [])

    const title =
        titleOverride ??
        `Age distribution of ${articulateEntity(data.country)} in ${year}`
    const subtitle =
        subtitleOverride ?? "Total population by five-year age group"

    return (
        <Frame className="demography-age-distribution">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-age-distribution__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <div className="demography-age-distribution__chart">
                        <ResponsivePopulationByAgeChart
                            simulation={simulation}
                            year={year}
                            ageZones={ageZones}
                            yAxisScaleMode="adaptive"
                        />
                    </div>
                )}
            </div>
            {!hideTimeline && (
                <div className="demography-age-distribution__slider">
                    <TimeSlider
                        times={FULL_TIME_RANGE}
                        selectedTime={year}
                        onChange={setYear}
                    />
                </div>
            )}
            <ChartFooter
                className="demography-footer"
                source="List of data sources"
                note="Optional note"
            />
        </Frame>
    )
}
