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
import { useSimulation } from "../helpers/useSimulation.js"
import { InputChartPanel } from "../components/SimulationContent.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import {
    BENCHMARK_LINE_COLOR,
    START_YEAR,
    HISTORICAL_END_YEAR,
    END_YEAR,
} from "../helpers/constants.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import { GRAY_60 } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"

export function ParametersVariant({
    config,
}: VariantProps<ParametersVariantConfig>): React.ReactElement {
    const [entityName, setEntityName] = useInitialEntityName(config.region)

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

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
                    <ParametersCaptionedChart
                        data={entityData}
                        metadata={metadata}
                        entityName={entityName}
                        setEntityName={setEntityName}
                        isLoading={isLoadingEntityData}
                        title={config.title}
                        subtitle={config.subtitle}
                        hideControls={config.hideControls}
                    />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function ParametersCaptionedChart({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideControls,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideControls?: boolean
}) {
    const simulation = useSimulation(data)
    const countryName = data.country

    const yearLabels = [
        [START_YEAR, "start"],
        [HISTORICAL_END_YEAR, "middle"],
        [END_YEAR, "end"],
    ] as const

    const title: React.ReactNode = titleOverride ?? (
        <>
            Demographic assumptions for{" "}
            <EntityNameOrSelector
                hideControls={hideControls}
                entityName={entityName}
                countryName={countryName}
                metadata={metadata}
                onChange={setEntityName}
            />
        </>
    )
    const subtitle =
        subtitleOverride ??
        "Assumptions about fertility, life expectancy, and migration that underlie the UN's population medium projection"

    return (
        <Frame className="demography-parameters">
            <ChartHeader title={title} subtitle={subtitle} />
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
                            yearLabels={yearLabels}
                            maxGridLines={0}
                            showEndpointLabels
                            yMin={0}
                        />
                        <InputChartPanel
                            simulation={simulation}
                            variant="lifeExpectancy"
                            className="parameters-panel"
                            interactive={false}
                            yearLabels={yearLabels}
                            maxGridLines={0}
                            showEndpointLabels
                            yMin={0}
                        />
                        <InputChartPanel
                            simulation={simulation}
                            variant="netMigrationRate"
                            className={cx("parameters-panel", {
                                "chart-panel--muted": countryName === "World",
                            })}
                            interactive={false}
                            lineColor={
                                countryName === "World"
                                    ? BENCHMARK_LINE_COLOR
                                    : undefined
                            }
                            labelColor={
                                countryName === "World" ? GRAY_60 : undefined
                            }
                            hideInfoIcon={countryName === "World"}
                            yearLabels={yearLabels}
                            maxGridLines={1}
                            showEndpointLabels
                        />
                    </div>
                )}
            </div>
            <ChartFooter
                className="demography-footer"
                source="Historical estimates and projections from the UN World Population Prospects"
            />
        </Frame>
    )
}
