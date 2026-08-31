import { useCallback, useEffect, useMemo, useState } from "react"
import cx from "clsx"
import { QueryClientProvider } from "@tanstack/react-query"

import { queryClient, useDemographyData } from "../core/fetch.js"
import type {
    PopulationPyramidUnit,
    SimulationVariantConfig,
} from "../core/config.js"
import type { VariantProps } from "../../../../helpers/config.js"
import { CHART_FOOTER_SOURCES, DEFAULT_ENTITY_NAME } from "../core/constants.js"
import { useInitialEntityName } from "../core/useInitialEntityName.js"
import {
    parseSimulationUrlState,
    type SimulationUrlState,
} from "../core/urlState.js"
import {
    DemographyChartError,
    DemographySkeleton,
} from "../components/DemographyLoadAndError.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import {
    EmbedConfigProvider,
    useEmbedConfig,
} from "../../../../hooks/useEmbedConfig.js"
import { CountryData, DemographyMetadata, ParameterKey } from "../core/types.js"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { SimulationContent } from "../components/SimulationContent.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../core/useBreakpoint.js"

export function SimulationVariant({
    config,
}: VariantProps<SimulationVariantConfig>): React.ReactElement {
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    return (
        <EmbedConfigProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <BreakpointProvider value={breakpoint}>
                    <div
                        ref={rootRef}
                        className={cx(
                            "demography-chart demography-chart__simulation-variant",
                            breakpointClass(breakpoint)
                        )}
                    >
                        <FetchingSimulationVariant config={config} />
                    </div>
                </BreakpointProvider>
            </QueryClientProvider>
        </EmbedConfigProvider>
    )
}

function FetchingSimulationVariant({
    config,
}: {
    config: SimulationVariantConfig
}): React.ReactElement {
    const { urlSync } = useEmbedConfig()

    const urlState = useMemo(
        () => (urlSync ? parseSimulationUrlState() : {}),
        [urlSync]
    )
    const [urlAssumptionState, setUrlAssumptionState] =
        useState<SimulationUrlAssumptionState>(() =>
            getUrlAssumptionState(urlState)
        )
    const [shouldSyncEntityName, setShouldSyncEntityName] = useState(
        Boolean(urlState.entityName)
    )
    const [entityName, setEntityNameRaw, isInitialEntityNameResolved] =
        useInitialEntityName(urlState.entityName ?? config.region)
    const setEntityName = useCallback(
        (name: string) => {
            if (urlSync) {
                setShouldSyncEntityName(true)
                setUrlAssumptionState({})
            }
            setEntityNameRaw(name)
        },
        [urlSync, setEntityNameRaw]
    )

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    useEffect(() => {
        if (!metadata) return
        if (metadata.slugs[entityName]) return

        const fallbackEntityName =
            config.region && metadata.slugs[config.region]
                ? config.region
                : DEFAULT_ENTITY_NAME
        setEntityNameRaw(fallbackEntityName)
        setShouldSyncEntityName(false)
    }, [config.region, entityName, metadata, setEntityNameRaw])

    useEffect(() => {
        const shouldSyncAutoDetectedEntityName =
            urlSync &&
            !urlState.entityName &&
            (!config.region || config.region === "userLocation") &&
            isInitialEntityNameResolved

        if (shouldSyncAutoDetectedEntityName) setShouldSyncEntityName(true)
    }, [
        config.region,
        urlSync,
        isInitialEntityNameResolved,
        urlState.entityName,
    ])

    if (status === "pending") return <DemographySkeleton />
    if (metadata && !metadata.slugs[entityName]) return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <CaptionedSimulationVariant
            data={entityData}
            metadata={metadata}
            entityName={entityName}
            setEntityName={setEntityName}
            isLoading={isLoadingEntityData}
            title={config.title}
            subtitle={config.subtitle}
            hideEntitySelector={config.hideEntitySelector}
            focusParameter={config.focusParameter}
            hidePopulationPyramid={config.hidePopulationPyramid}
            populationPyramidUnit={config.populationPyramidUnit}
            fertilityRateAssumptions={config.fertilityRateAssumptions}
            lifeExpectancyAssumptions={config.lifeExpectancyAssumptions}
            netMigrationRateAssumptions={config.netMigrationRateAssumptions}
            urlFertilityRateAssumptions={
                urlAssumptionState.fertilityRateAssumptions
            }
            urlLifeExpectancyAssumptions={
                urlAssumptionState.lifeExpectancyAssumptions
            }
            urlNetMigrationRateAssumptions={
                urlAssumptionState.netMigrationRateAssumptions
            }
            baselineEntityName={getBaselineEntityName(config.region)}
            shouldSyncEntityName={shouldSyncEntityName}
            urlTab={urlState.tab}
            urlYear={urlState.year}
        />
    )
}

type SimulationUrlAssumptionState = Pick<
    SimulationUrlState,
    | "fertilityRateAssumptions"
    | "lifeExpectancyAssumptions"
    | "netMigrationRateAssumptions"
>

function getUrlAssumptionState(
    urlState: SimulationUrlState
): SimulationUrlAssumptionState {
    return {
        fertilityRateAssumptions: urlState.fertilityRateAssumptions,
        lifeExpectancyAssumptions: urlState.lifeExpectancyAssumptions,
        netMigrationRateAssumptions: urlState.netMigrationRateAssumptions,
    }
}

function getBaselineEntityName(region: string | undefined): string | undefined {
    if (!region || region === "userLocation") return undefined
    return region
}

function CaptionedSimulationVariant({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideEntitySelector,
    focusParameter,
    hidePopulationPyramid,
    populationPyramidUnit,
    fertilityRateAssumptions,
    lifeExpectancyAssumptions,
    netMigrationRateAssumptions,
    urlFertilityRateAssumptions,
    urlLifeExpectancyAssumptions,
    urlNetMigrationRateAssumptions,
    baselineEntityName,
    shouldSyncEntityName,
    urlTab,
    urlYear,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideEntitySelector?: boolean
    focusParameter?: ParameterKey
    hidePopulationPyramid?: boolean
    populationPyramidUnit?: PopulationPyramidUnit
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
    urlFertilityRateAssumptions?: Record<number, number>
    urlLifeExpectancyAssumptions?: Record<number, number>
    urlNetMigrationRateAssumptions?: Record<number, number>
    baselineEntityName?: string
    shouldSyncEntityName?: boolean
    urlTab?: ParameterKey
    urlYear?: number
}) {
    const countryName = data.country

    const title: React.ReactNode = titleOverride ? (
        titleOverride
    ) : hideEntitySelector && countryName === "World" ? (
        <>How many people will there be by 2100?</>
    ) : (
        <>
            How many people will live in{" "}
            <EntityNameOrSelector
                hideEntitySelector={hideEntitySelector}
                entityName={entityName}
                countryName={countryName}
                metadata={metadata}
                onChange={setEntityName}
            />{" "}
            by 2100?
        </>
    )
    const subtitle =
        subtitleOverride ??
        "Demographers publish projections of how populations will change in the future. But what if fertility rates fall faster, or rebound? Or migration rates change? Adjust these assumptions and compare."

    return (
        <Frame className="demography-captioned-chart">
            <ChartHeader
                className="demography-header"
                title={title}
                subtitle={subtitle}
            />
            <div className="demography-captioned-chart__chart-area">
                {isLoading && <Spinner />}
                <SimulationContent
                    data={data}
                    focusParameter={focusParameter}
                    hidePopulationPyramid={hidePopulationPyramid}
                    populationPyramidUnit={populationPyramidUnit}
                    fertilityRateAssumptions={fertilityRateAssumptions}
                    lifeExpectancyAssumptions={lifeExpectancyAssumptions}
                    netMigrationRateAssumptions={netMigrationRateAssumptions}
                    urlFertilityRateAssumptions={urlFertilityRateAssumptions}
                    urlLifeExpectancyAssumptions={urlLifeExpectancyAssumptions}
                    urlNetMigrationRateAssumptions={
                        urlNetMigrationRateAssumptions
                    }
                    baselineEntityName={baselineEntityName}
                    shouldSyncEntityName={shouldSyncEntityName}
                    urlTab={urlTab}
                    urlYear={urlYear}
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
                            href="https://docs.owid.io/projects/etl/analyses/population_tool"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            https://docs.owid.io/projects/etl/analyses/population_tool
                        </a>
                    </>
                }
            />
        </Frame>
    )
}
