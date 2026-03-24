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
    CHART_FOOTER_SOURCES,
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
                initialTime={config.time}
                fertilityRateAssumptions={config.fertilityRateAssumptions}
                lifeExpectancyAssumptions={config.lifeExpectancyAssumptions}
                netMigrationRateAssumptions={config.netMigrationRateAssumptions}
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
    initialTime,
    fertilityRateAssumptions,
    lifeExpectancyAssumptions,
    netMigrationRateAssumptions,
}: {
    data: CountryData
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideTimeline?: boolean
    initialTime?: number
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}) {
    const [year, setYear] = useState(initialTime ?? END_YEAR)

    const hasCustomAssumptions =
        fertilityRateAssumptions !== undefined ||
        lifeExpectancyAssumptions !== undefined ||
        netMigrationRateAssumptions !== undefined

    const scenarioOverrides = useMemo(
        () =>
            hasCustomAssumptions
                ? {
                      fertilityRate: fertilityRateAssumptions,
                      lifeExpectancy: lifeExpectancyAssumptions,
                      netMigrationRate: netMigrationRateAssumptions,
                  }
                : undefined,
        [
            hasCustomAssumptions,
            fertilityRateAssumptions,
            lifeExpectancyAssumptions,
            netMigrationRateAssumptions,
        ]
    )

    const simulation = useSimulation(data, scenarioOverrides)
    const ageZones = useMemo(() => groupAgeGroupsByZone(), [])

    const getPopulationForYear = hasCustomAssumptions
        ? simulation?.getPopulationForYear
        : simulation?.getBenchmarkPopulationForYear
    const getAgeZonePopulation = hasCustomAssumptions
        ? simulation?.getAgeZonePopulation
        : simulation?.getBenchmarkAgeZonePopulation

    const title =
        titleOverride ??
        `Age structure of ${articulateEntity(data.country)} in ${year}`
    const subtitle =
        subtitleOverride ??
        `The population of ${articulateEntity(data.country)}, broken down by age and sex based on future projections. These are based on the user's fertility, life expectancy, and migration inputs to a demographic model.`

    return (
        <Frame className="demography-population-pyramid">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-population-pyramid__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && getPopulationForYear && getAgeZonePopulation && (
                    <div className="detailed-population-pyramid">
                        <ResponsiveAgeZoneLegend
                            populationByAgeZone={getAgeZonePopulation(year)}
                        />
                        <div className="detailed-population-pyramid__chart">
                            <ResponsivePopulationPyramid
                                simulation={simulation}
                                year={year}
                                ageZones={ageZones}
                                xAxisScaleMode={
                                    hideTimeline ? "adaptive" : "fixed"
                                }
                                getPopulationForYear={getPopulationForYear}
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
                source={CHART_FOOTER_SOURCES}
                note="Optional note"
            />
        </Frame>
    )
}

