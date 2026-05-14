import { useMemo, useState } from "react"
import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type {
    PopulationPyramidUnit,
    PopulationPyramidVariantConfig,
    VariantProps,
} from "../config.js"
import {
    entityNameForSentence,
    groupAgeGroupsByZone,
} from "../helpers/utils.js"
import { CountryData, DemographyMetadata } from "../helpers/types.js"
import {
    useSimulation,
    computeScenarioOverrides,
} from "../helpers/useSimulation.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { PopulationPyramid } from "../components/PopulationPyramid.js"
import { ParameterChartsDisclosure } from "../components/ParameterChartsDisclosure.js"
import { AgeZoneLegend } from "../components/AgeZoneLegend.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    CHART_FOOTER_SOURCES,
    END_YEAR,
    FULL_TIME_RANGE,
    START_YEAR,
} from "../helpers/constants.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"

export function PopulationPyramidVariant({
    config,
}: VariantProps<PopulationPyramidVariantConfig>): React.ReactElement {
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    return (
        <QueryClientProvider client={queryClient}>
            <BreakpointProvider value={breakpoint}>
                <div
                    ref={rootRef}
                    className={cx(
                        "demography-chart demography-chart__population-pyramid-variant",
                        breakpointClass(breakpoint)
                    )}
                >
                    <FetchingPopulationPyramidVariant config={config} />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function FetchingPopulationPyramidVariant({
    config,
}: {
    config: PopulationPyramidVariantConfig
}): React.ReactElement {
    const [entityName, setEntityName] = useInitialEntityName(config.region)

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <CaptionedPopulationPyramidVariant
            data={entityData}
            metadata={metadata}
            entityName={entityName}
            setEntityName={setEntityName}
            isLoading={isLoadingEntityData}
            title={config.title}
            subtitle={config.subtitle}
            hideEntitySelector={config.hideEntitySelector}
            hideTimeline={config.hideTimeline}
            showAssumptionCharts={config.showAssumptionCharts}
            initialTime={config.time}
            fertilityRateAssumptions={config.fertilityRateAssumptions}
            lifeExpectancyAssumptions={config.lifeExpectancyAssumptions}
            netMigrationRateAssumptions={config.netMigrationRateAssumptions}
            populationPyramidUnit={config.populationPyramidUnit}
        />
    )
}

function CaptionedPopulationPyramidVariant({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideEntitySelector,
    hideTimeline,
    showAssumptionCharts = false,
    initialTime,
    fertilityRateAssumptions,
    lifeExpectancyAssumptions,
    netMigrationRateAssumptions,
    populationPyramidUnit,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideEntitySelector?: boolean
    hideTimeline?: boolean
    showAssumptionCharts?: boolean
    initialTime?: number
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
    populationPyramidUnit?: PopulationPyramidUnit
}) {
    const [year, setYear] = useState(initialTime ?? END_YEAR)

    const scenarioOverrides = useMemo(
        () =>
            computeScenarioOverrides({
                fertilityRateAssumptions,
                lifeExpectancyAssumptions,
                netMigrationRateAssumptions,
            }),
        [
            fertilityRateAssumptions,
            lifeExpectancyAssumptions,
            netMigrationRateAssumptions,
        ]
    )

    const simulation = useSimulation(data, scenarioOverrides)
    const ageZones = useMemo(() => groupAgeGroupsByZone(), [])
    const projection = scenarioOverrides ? "custom" : "un"

    const title: React.ReactNode = titleOverride ?? (
        <>
            Age structure of{" "}
            <EntityNameOrSelector
                hideEntitySelector={hideEntitySelector}
                entityName={entityName}
                countryName={data.country}
                metadata={metadata}
                onChange={setEntityName}
            />{" "}
            in {year}
        </>
    )
    const subtitle =
        subtitleOverride ??
        `Population of ${entityNameForSentence(data.country)}, broken down by age and sex based on future projections. These are based on the user's fertility, life expectancy, and migration inputs to a demographic model.`

    return (
        <Frame className="demography-captioned-chart demography-population-pyramid">
            <ChartHeader
                className="demography-header"
                title={title}
                subtitle={subtitle}
            />
            <div className="demography-population-pyramid__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <div className="detailed-population-pyramid">
                        <AgeZoneLegend
                            simulation={simulation}
                            year={year}
                            projection={projection}
                        />
                        <div className="detailed-population-pyramid__chart">
                            <PopulationPyramid
                                simulation={simulation}
                                year={year}
                                ageZones={ageZones}
                                xAxisScaleMode={
                                    hideTimeline ? "adaptive" : "fixed"
                                }
                                projection={projection}
                                unit={populationPyramidUnit}
                            />
                        </div>
                    </div>
                )}
            </div>
            {!hideTimeline && (
                <div className="demography-population-pyramid__slider">
                    <div className="demography-year-slider">
                        <span className="demography-year-slider__label">
                            {START_YEAR}
                        </span>
                        <TimeSlider
                            times={FULL_TIME_RANGE}
                            selectedTime={year}
                            onChange={setYear}
                            showEdgeLabels={false}
                        />
                        <span className="demography-year-slider__label">
                            {END_YEAR}
                        </span>
                    </div>
                </div>
            )}
            {showAssumptionCharts && simulation && (
                <ParameterChartsDisclosure simulation={simulation} />
            )}
            <ChartFooter
                className="demography-footer"
                source={CHART_FOOTER_SOURCES}
                note="Projections are based on user inputs and do not necessarily reflect plausible scenarios or those assumed by expert demographers."
            />
        </Frame>
    )
}
