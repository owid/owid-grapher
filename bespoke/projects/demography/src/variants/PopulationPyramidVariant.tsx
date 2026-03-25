import { useMemo, useState } from "react"
import cx from "classnames"
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
import { displayEntityName, groupAgeGroupsByZone } from "../helpers/utils.js"
import { CountryData, type ParameterKey } from "../helpers/types.js"
import {
    useSimulation,
    computeStabilizedOverrides,
} from "../helpers/useSimulation.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ResponsivePopulationPyramid } from "../components/PopulationPyramid.js"
import { ParameterChartsDisclosure } from "../components/ParameterChartsDisclosure.js"
import { ResponsiveAgeZoneLegend } from "../components/AgeZoneLegend.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    CHART_FOOTER_SOURCES,
    DEFAULT_ENTITY_NAME,
    END_YEAR,
    FULL_TIME_RANGE,
    START_YEAR,
} from "../helpers/constants.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"

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

    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <BreakpointProvider value={breakpoint}>
            <div
                ref={rootRef}
                className={cx(
                    "demography-chart demography-chart__population-pyramid-variant",
                    breakpointClass(breakpoint)
                )}
            >
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
                    showAssumptionCharts={config.showAssumptionCharts}
                    initialTime={config.time}
                    stabilizingParameter={config.stabilizingParameter}
                    fertilityRateAssumptions={config.fertilityRateAssumptions}
                    lifeExpectancyAssumptions={config.lifeExpectancyAssumptions}
                    netMigrationRateAssumptions={
                        config.netMigrationRateAssumptions
                    }
                />
            </div>
        </BreakpointProvider>
    )
}

function PopulationPyramidCaptionedChart({
    data,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideTimeline,
    showAssumptionCharts = false,
    initialTime,
    stabilizingParameter,
    fertilityRateAssumptions,
    lifeExpectancyAssumptions,
    netMigrationRateAssumptions,
}: {
    data: CountryData
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideTimeline?: boolean
    showAssumptionCharts?: boolean
    initialTime?: number
    stabilizingParameter?: ParameterKey
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}) {
    const [year, setYear] = useState(initialTime ?? END_YEAR)

    // Compute scenario overrides: stabilization takes priority over manual assumptions
    const scenarioOverrides = useMemo(() => {
        if (stabilizingParameter) {
            return computeStabilizedOverrides(data, stabilizingParameter)
        }
        const hasCustom =
            fertilityRateAssumptions !== undefined ||
            lifeExpectancyAssumptions !== undefined ||
            netMigrationRateAssumptions !== undefined
        if (hasCustom) {
            return {
                fertilityRate: fertilityRateAssumptions,
                lifeExpectancy: lifeExpectancyAssumptions,
                netMigrationRate: netMigrationRateAssumptions,
            }
        }
        return undefined
    }, [
        data,
        stabilizingParameter,
        fertilityRateAssumptions,
        lifeExpectancyAssumptions,
        netMigrationRateAssumptions,
    ])

    const simulation = useSimulation(data, scenarioOverrides)
    const ageZones = useMemo(() => groupAgeGroupsByZone(), [])
    const projection = scenarioOverrides ? "custom" : "un"

    const title =
        titleOverride ??
        (data.country === "World"
            ? `Global age structure in ${year}`
            : `Age structure of ${articulateEntity(displayEntityName(data.country))} in ${year}`)
    const subtitle =
        subtitleOverride ??
        `The population of ${articulateEntity(displayEntityName(data.country))}, broken down by age and sex based on future projections. These are based on the user's fertility, life expectancy, and migration inputs to a demographic model.`

    return (
        <Frame className="demography-population-pyramid">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-population-pyramid__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <div className="detailed-population-pyramid">
                        <ResponsiveAgeZoneLegend
                            simulation={simulation}
                            year={year}
                            projection={projection}
                        />
                        <div className="detailed-population-pyramid__chart">
                            <ResponsivePopulationPyramid
                                simulation={simulation}
                                year={year}
                                ageZones={ageZones}
                                xAxisScaleMode={
                                    hideTimeline ? "adaptive" : "fixed"
                                }
                                projection={projection}
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
