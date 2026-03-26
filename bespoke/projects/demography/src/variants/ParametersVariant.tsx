import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import { DemographyControls } from "../components/DemographyControls.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type { ParametersVariantConfig } from "../config.js"

import { articulateEntity } from "@ourworldindata/utils"
import { displayEntityName } from "../helpers/utils.js"

import { CountryData } from "../helpers/types.js"
import { useSimulation } from "../helpers/useSimulation.js"
import { InputChartPanel } from "../components/SimulationContent.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { BENCHMARK_LINE_COLOR } from "../helpers/constants.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import { GRAY_60 } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"

export function ParametersVariantWithProviders(props: {
    container: HTMLDivElement
    config: ParametersVariantConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <ParametersVariant config={props.config} />
        </QueryClientProvider>
    )
}

function ParametersVariant({
    config,
}: {
    config: ParametersVariantConfig
}): React.ReactElement {
    const showControls = !config.hideControls
    const [entityName, setEntityName] = useInitialEntityName(config.region)

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
                    "demography-chart demography-chart__parameters-variant",
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
                <ParametersCaptionedChart
                    data={entityData}
                    isLoading={isLoadingEntityData}
                    title={config.title}
                    subtitle={config.subtitle}
                />
            </div>
        </BreakpointProvider>
    )
}

function ParametersCaptionedChart({
    data,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
}: {
    data: CountryData
    isLoading?: boolean
    title?: string
    subtitle?: string
}) {
    const simulation = useSimulation(data)
    const countryName = data.country

    const title =
        titleOverride ??
        (countryName === "World"
            ? "Global demographic assumptions"
            : `Demographic assumptions for ${articulateEntity(displayEntityName(countryName))}`)
    const subtitle = subtitleOverride

    return (
        <Frame className="demography-parameters">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-parameters__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <div className="demography-parameters__panels">
                        <InputChartPanel
                            simulation={simulation}
                            variant="lifeExpectancy"
                            className="parameters-panel"
                            interactive={false}
                            showProjectionLabel
                        />
                        <InputChartPanel
                            simulation={simulation}
                            variant="fertilityRate"
                            className="parameters-panel"
                            interactive={false}
                        />
                        <InputChartPanel
                            simulation={simulation}
                            variant="netMigrationRate"
                            className={cx("parameters-panel", {
                                "chart-panel--muted":
                                    countryName === "World",
                            })}
                            interactive={false}
                            lineColor={
                                countryName === "World"
                                    ? BENCHMARK_LINE_COLOR
                                    : undefined
                            }
                            labelColor={
                                countryName === "World"
                                    ? GRAY_60
                                    : undefined
                            }
                            hideInfoIcon={countryName === "World"}
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
