import { useMemo } from "react"
import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"

import type { PopulationVariantConfig, VariantProps } from "../config.js"
import type { CountryData, DemographyMetadata } from "../helpers/types.js"

import { queryClient, useDemographyData } from "../helpers/fetch.js"
import {
    START_YEAR,
    END_YEAR,
    CHART_FOOTER_SOURCES,
} from "../helpers/constants.js"
import {
    useSimulation,
    computeScenarioOverrides,
} from "../helpers/useSimulation.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"

import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { PopulationChart } from "../components/PopulationChart.js"
import { ParameterChartsDisclosure } from "../components/ParameterChartsDisclosure.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"

export function PopulationVariant({
    config,
}: VariantProps<PopulationVariantConfig>): React.ReactElement {
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    return (
        <QueryClientProvider client={queryClient}>
            <BreakpointProvider value={breakpoint}>
                <div
                    ref={rootRef}
                    className={cx(
                        "demography-chart demography-chart__population-variant",
                        breakpointClass(breakpoint)
                    )}
                >
                    <FetchingPopulationVariant config={config} />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function FetchingPopulationVariant({
    config,
}: {
    config: PopulationVariantConfig
}): React.ReactElement {
    const [entityName, setEntityName] = useInitialEntityName(config.region)

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <CaptionedPopulationVariant
            data={entityData}
            metadata={metadata}
            entityName={entityName}
            setEntityName={setEntityName}
            title={config.title}
            subtitle={config.subtitle}
            hideEntitySelector={config.hideEntitySelector}
            isLoading={isLoadingEntityData}
            showAssumptionCharts={config.showAssumptionCharts}
            fertilityRateAssumptions={config.fertilityRateAssumptions}
            lifeExpectancyAssumptions={config.lifeExpectancyAssumptions}
            netMigrationRateAssumptions={config.netMigrationRateAssumptions}
        />
    )
}

function CaptionedPopulationVariant({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideEntitySelector,
    showAssumptionCharts = false,
    fertilityRateAssumptions,
    lifeExpectancyAssumptions,
    netMigrationRateAssumptions,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideEntitySelector?: boolean
    showAssumptionCharts?: boolean
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}) {
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
    const hasCustomProjection = scenarioOverrides !== undefined
    const countryName = data.country

    const title: React.ReactNode = titleOverride ?? (
        <>
            Population of{" "}
            <EntityNameOrSelector
                hideEntitySelector={hideEntitySelector}
                entityName={entityName}
                countryName={countryName}
                metadata={metadata}
                onChange={setEntityName}
            />
            ,{" "}
            <span className="nowrap">
                {START_YEAR} to {END_YEAR}
            </span>
        </>
    )
    const subtitle =
        subtitleOverride ??
        "Historical estimates and projections of total population."

    return (
        <Frame className="demography-captioned-chart demography-population-variant">
            <ChartHeader
                className="demography-header"
                title={title}
                subtitle={subtitle}
            />

            <div className="demography-population-variant__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <PopulationChart
                        simulation={simulation}
                        showCustomProjection={hasCustomProjection}
                    />
                )}
            </div>

            {showAssumptionCharts && simulation && (
                <ParameterChartsDisclosure simulation={simulation} />
            )}

            <ChartFooter
                className="demography-footer"
                source={
                    hasCustomProjection
                        ? CHART_FOOTER_SOURCES
                        : "Historical estimates and projections from the UN World Population Prospects"
                }
                note={
                    hasCustomProjection
                        ? "Projections are based on user inputs and do not necessarily reflect plausible scenarios or those assumed by expert demographers."
                        : undefined
                }
            />
        </Frame>
    )
}
