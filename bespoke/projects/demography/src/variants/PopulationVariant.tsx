import { useMemo } from "react"
import cx from "clsx"
import { QueryClientProvider } from "@tanstack/react-query"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"

import type { DemographyConfig } from "../index.js"
import type {
    BespokeComponentDataUrls,
    BespokeVariantProps,
} from "owid-bespoke-types"
import type { CountryData, DemographyMetadata } from "../core/types.js"

import { queryClient, useDemographyData } from "../core/fetch.js"
import {
    START_YEAR,
    END_YEAR,
    CHART_FOOTER_SOURCES,
    DEFAULT_ENTITY_NAME,
} from "../core/constants.js"
import {
    useSimulation,
    computeScenarioOverrides,
} from "../core/useSimulation.js"
import { useInitialEntityName } from "../core/useInitialEntityName.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../core/useBreakpoint.js"

import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { PopulationChart } from "../components/PopulationChart.js"
import { ParameterChartsDisclosure } from "../components/ParameterChartsDisclosure.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"

export function PopulationVariant({
    config,
    urls,
}: BespokeVariantProps<DemographyConfig>): React.ReactElement {
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
                    <FetchingPopulationVariant config={config} urls={urls} />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function FetchingPopulationVariant({
    config,
    urls,
}: {
    config: DemographyConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const [requestedEntityName, setEntityName] = useInitialEntityName(
        config.region,
        urls.metadataUrl
    )

    const { entityName, metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(requestedEntityName, urls, [
            config.region,
            DEFAULT_ENTITY_NAME,
        ])

    if (status === "pending")
        return <ChartSkeleton className="demography-chart-box" />
    if (!metadata || !entityData)
        return <ChartError className="demography-chart-box" />

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
    showAssumptionCharts,
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
                {isLoading && <Spinner />}
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
