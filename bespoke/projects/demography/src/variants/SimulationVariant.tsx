import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type { SimulationVariantConfig } from "../config.js"
import { CHART_FOOTER_SOURCES } from "../helpers/constants.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import {
    CountryData,
    DemographyMetadata,
    ParameterKey,
} from "../helpers/types.js"
import { articulateEntity } from "@ourworldindata/utils"
import { displayEntityName } from "../helpers/utils.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { SimulationContent } from "../components/SimulationContent.js"
import { InlineEntitySelector } from "../components/InlineEntitySelector.js"
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
    const [entityName, setEntityName] = useInitialEntityName(config.region)
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <BreakpointProvider value={breakpoint}>
            <div
                ref={rootRef}
                className={cx(
                    "demography-chart demography-chart__simulation-variant",
                    breakpointClass(breakpoint)
                )}
            >
                <SimulationCaptionedChart
                    data={entityData}
                    metadata={metadata}
                    entityName={entityName}
                    setEntityName={setEntityName}
                    isLoading={isLoadingEntityData}
                    subtitle={config.subtitle}
                    breakpoint={breakpoint}
                    hideControls={config.hideControls}
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
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideControls,
    focusParameter,
    stabilizingParameter,
    hidePopulationPyramid,
    breakpoint,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    subtitle?: string
    hideControls?: boolean
    focusParameter?: ParameterKey
    stabilizingParameter?: ParameterKey
    hidePopulationPyramid?: boolean
    breakpoint?: string
}) {
    const countryName = data.country

    const title: React.ReactNode = (
        <>
            How many people will live in{" "}
            {hideControls ? (
                articulateEntity(displayEntityName(countryName))
            ) : (
                <InlineEntitySelector
                    metadata={metadata}
                    entityName={entityName}
                    onChange={setEntityName}
                />
            )}{" "}
            by 2100?
        </>
    )
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
