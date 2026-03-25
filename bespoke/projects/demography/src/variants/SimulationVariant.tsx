import { useState } from "react"
import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import { DemographyControls } from "../components/DemographyControls.js"
import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type { SimulationVariantConfig } from "../config.js"
import {
    CHART_FOOTER_SOURCES,
    DEFAULT_ENTITY_NAME,
} from "../helpers/constants.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { CountryData, ParameterKey } from "../helpers/types.js"
import { articulateEntity } from "@ourworldindata/utils"
import { displayEntityName } from "../helpers/utils.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { SimulationContent } from "../components/SimulationContent.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"

export function SimulationVariantWithProviders(props: {
    container: HTMLDivElement
    config: SimulationVariantConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <SimulationVariant config={props.config} />
        </QueryClientProvider>
    )
}

function SimulationVariant({
    config,
}: {
    config: SimulationVariantConfig
}): React.ReactElement {
    const [entityName, setEntityName] = useState(
        config.region ?? DEFAULT_ENTITY_NAME
    )
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    const showControls = !config.hideControls

    return (
        <BreakpointProvider value={breakpoint}>
            <div
                ref={rootRef}
                className={cx(
                    "demography-chart demography-chart__simulation-variant",
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
                <SimulationCaptionedChart
                    data={entityData}
                    isLoading={isLoadingEntityData}
                    title={config.title}
                    subtitle={config.subtitle}
                    focusParameter={config.focusParameter}
                    stabilizingParameter={config.stabilizingParameter}
                    hidePopulationPyramid={config.hidePopulationPyramid}
                />
            </div>
        </BreakpointProvider>
    )
}

function SimulationCaptionedChart({
    data,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    focusParameter,
    stabilizingParameter,
    hidePopulationPyramid,
}: {
    data: CountryData
    isLoading?: boolean
    title?: string
    subtitle?: string
    focusParameter?: ParameterKey
    stabilizingParameter?: ParameterKey
    hidePopulationPyramid?: boolean
}) {
    const countryName = data.country

    const title =
        titleOverride ??
        `How many people will live in ${articulateEntity(displayEntityName(countryName))} by 2100?`
    const subtitle =
        subtitleOverride ??
        "Demographers publish projections of how populations will change in the future. But what if fertility rates fall faster, or rebound? Or migration rates change? Adjust these assumptions and compare."

    return (
        <Frame className="demography-captioned-chart">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-captioned-chart__chart-area">
                {isLoading && <LoadingSpinner />}
                <SimulationContent
                    data={data}
                    focusParameter={focusParameter}
                    stabilizingParameter={stabilizingParameter}
                    hidePopulationPyramid={hidePopulationPyramid}
                />
            </div>
            <ChartFooter
                className="demography-footer"
                source={CHART_FOOTER_SOURCES}
                note={
                    <>
                        Technical details and assumptions used in this
                        population model are available at{" "}
                        <a
                            href="https://population-simulation.owid.io/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            https://population-simulation.owid.io/
                        </a>
                    </>
                }
            />
        </Frame>
    )
}
