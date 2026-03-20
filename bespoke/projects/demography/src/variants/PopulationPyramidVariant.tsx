import { useMemo, useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { DemographyControls } from "../components/DemographyControls.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type { PopulationPyramidVariantConfig } from "../config.js"
import { articulateEntity } from "@ourworldindata/utils"
import { CountryData } from "../helpers/types.js"
import { useSimulation } from "../helpers/useSimulation.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ResponsivePopulationPyramid } from "../components/PopulationPyramid.js"
import { ResponsiveAgeZoneLegend } from "../components/AgeZoneLegend.js"
import { groupAgeGroupsByZone } from "../helpers/utils.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    DEFAULT_ENTITY_NAME,
    END_YEAR,
    FULL_TIME_RANGE,
} from "../helpers/constants.js"

export function PopulationPyramidVariantWithProviders(props: {
    container: HTMLDivElement
    config: PopulationPyramidVariantConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <PopulationPyramidVariant config={props.config} />
        </QueryClientProvider>
    )
}

function PopulationPyramidVariant({
    config,
}: {
    config: PopulationPyramidVariantConfig
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
        <div className="demography-chart demography-chart__population-pyramid-variant">
            {showControls && (
                <DemographyControls
                    metadata={metadata}
                    entityName={entityName}
                    setEntityName={setEntityName}
                />
            )}
            <PopulationPyramidCaptionedChart
                data={entityData}
                isLoading={isLoadingEntityData}
                title={config.title}
                subtitle={config.subtitle}
                hideTimeline={config.hideTimeline}
            />
        </div>
    )
}

function PopulationPyramidCaptionedChart({
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
        `Age structure of ${articulateEntity(data.country)} in ${year}`
    const subtitle =
        subtitleOverride ?? "Population distribution by age and sex. Bla bla"

    return (
        <Frame className="demography-population-pyramid">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-population-pyramid__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <div className="detailed-population-pyramid">
                        <ResponsiveAgeZoneLegend
                            populationByAgeZone={simulation.getAgeZonePopulation(
                                year
                            )}
                        />
                        <div className="detailed-population-pyramid__chart">
                            <ResponsivePopulationPyramid
                                simulation={simulation}
                                year={year}
                                ageZones={ageZones}
                                // xAxisScaleMode={
                                //     hideTimeline ? "adaptive" : "fixed"
                                // }
                                xAxisScaleMode="adaptive"
                            />
                        </div>
                    </div>
                )}
            </div>
            {!hideTimeline && (
                <div className="demography-population-pyramid__slider">
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
