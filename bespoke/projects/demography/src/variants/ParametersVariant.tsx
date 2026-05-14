import { useMemo } from "react"
import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type { ParametersVariantConfig, VariantProps } from "../config.js"

import { CountryData, DemographyMetadata } from "../helpers/types.js"
import {
    useSimulation,
    computeScenarioOverrides,
} from "../helpers/useSimulation.js"
import { CHART_FOOTER_SOURCES } from "../helpers/constants.js"
import { InputChartPanel } from "../components/SimulationContent.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"

export function ParametersVariant({
    config,
}: VariantProps<ParametersVariantConfig>): React.ReactElement {
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    return (
        <QueryClientProvider client={queryClient}>
            <BreakpointProvider value={breakpoint}>
                <div
                    ref={rootRef}
                    className={cx(
                        "demography-chart demography-chart__parameters-variant",
                        breakpointClass(breakpoint)
                    )}
                >
                    <FetchingParametersVariant config={config} />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function FetchingParametersVariant({
    config,
}: {
    config: ParametersVariantConfig
}): React.ReactElement {
    const [entityName, setEntityName] = useInitialEntityName(config.region)

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <CaptionedParametersVariant
            data={entityData}
            metadata={metadata}
            entityName={entityName}
            setEntityName={setEntityName}
            isLoading={isLoadingEntityData}
            title={config.title}
            subtitle={config.subtitle}
            hideEntitySelector={config.hideEntitySelector}
            fertilityRateAssumptions={config.fertilityRateAssumptions}
            lifeExpectancyAssumptions={config.lifeExpectancyAssumptions}
            netMigrationRateAssumptions={config.netMigrationRateAssumptions}
        />
    )
}

function CaptionedParametersVariant({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideEntitySelector,
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
    const isWorld = countryName === "World"

    const title: React.ReactNode = titleOverride ?? (
        <>
            Demographic assumptions for{" "}
            <EntityNameOrSelector
                hideEntitySelector={hideEntitySelector}
                entityName={entityName}
                countryName={countryName}
                metadata={metadata}
                onChange={setEntityName}
            />
        </>
    )
    const subtitle =
        subtitleOverride ??
        "Assumptions about fertility, life expectancy, and migration that underlie the UN's population medium projection."

    return (
        <Frame className="demography-captioned-chart demography-parameters">
            <ChartHeader
                className="demography-header"
                title={title}
                subtitle={subtitle}
            />
            <div className="demography-parameters__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <div className="demography-parameters__panels">
                        <InputChartPanel
                            simulation={simulation}
                            variant="fertilityRate"
                            className="parameters-panel"
                            interactive={false}
                            showProjectionLabel
                            maxGridLines={0}
                            yMin={0}
                        />
                        <InputChartPanel
                            simulation={simulation}
                            variant="lifeExpectancy"
                            className="parameters-panel"
                            interactive={false}
                            maxGridLines={0}
                            yMin={0}
                        />
                        {!isWorld && (
                            <InputChartPanel
                                simulation={simulation}
                                variant="netMigrationRate"
                                className="parameters-panel"
                                interactive={false}
                                maxGridLines={1}
                            />
                        )}
                    </div>
                )}
            </div>
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
