import { useCallback, useEffect, useMemo, useState } from "react"
import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type {
    DependencyRatioVariantConfig,
    PopulationPyramidUnit,
    SimulationVariantConfig,
    VariantProps,
} from "../config.js"
import {
    CHART_FOOTER_SOURCES,
    DEFAULT_ENTITY_NAME,
} from "../helpers/constants.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import {
    parseSimulationUrlState,
    type SimulationUrlState,
} from "../helpers/urlState.js"
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

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { SimulationContent } from "../components/SimulationContent.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"

type SimulationContentMode = "population" | "dependencyRatio"

export function SimulationVariant({
    config,
}: VariantProps<SimulationVariantConfig>): React.ReactElement {
    return (
        <SimulationVariantShell
            config={config}
            mode="population"
            className="demography-chart__simulation-variant"
        />
    )
}

export function DependencyRatioVariant({
    config,
}: VariantProps<DependencyRatioVariantConfig>): React.ReactElement {
    return (
        <SimulationVariantShell
            config={config}
            mode="dependencyRatio"
            className="demography-chart__dependency-ratio-variant"
        />
    )
}

function SimulationVariantShell({
    config,
    mode,
    className,
}: {
    config: SimulationVariantConfig | DependencyRatioVariantConfig
    mode: SimulationContentMode
    className: string
}): React.ReactElement {
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    return (
        <QueryClientProvider client={queryClient}>
            <BreakpointProvider value={breakpoint}>
                <div
                    ref={rootRef}
                    className={cx(
                        "demography-chart",
                        className,
                        breakpointClass(breakpoint)
                    )}
                >
                    <FetchingSimulationVariant config={config} mode={mode} />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function FetchingSimulationVariant({
    config,
    mode,
}: {
    config: SimulationVariantConfig | DependencyRatioVariantConfig
    mode: SimulationContentMode
}): React.ReactElement {
    const urlState = useMemo(
        () => (config.urlSync ? parseSimulationUrlState() : {}),
        [config.urlSync]
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
            if (config.urlSync) {
                setShouldSyncEntityName(true)
                setUrlAssumptionState({})
            }
            setEntityNameRaw(name)
        },
        [config.urlSync, setEntityNameRaw]
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
            config.urlSync &&
            !urlState.entityName &&
            (!config.region || config.region === "userLocation") &&
            isInitialEntityNameResolved

        if (shouldSyncAutoDetectedEntityName) setShouldSyncEntityName(true)
    }, [
        config.region,
        config.urlSync,
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
            urlSync={config.urlSync}
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
            retirementAgeAssumptions={
                "retirementAgeAssumptions" in config
                    ? config.retirementAgeAssumptions
                    : undefined
            }
            urlRetirementAgeAssumptions={
                mode === "dependencyRatio"
                    ? urlAssumptionState.retirementAgeAssumptions
                    : undefined
            }
            mode={mode}
        />
    )
}

type SimulationUrlAssumptionState = Pick<
    SimulationUrlState,
    | "fertilityRateAssumptions"
    | "lifeExpectancyAssumptions"
    | "netMigrationRateAssumptions"
    | "retirementAgeAssumptions"
>

function getUrlAssumptionState(
    urlState: SimulationUrlState
): SimulationUrlAssumptionState {
    return {
        fertilityRateAssumptions: urlState.fertilityRateAssumptions,
        lifeExpectancyAssumptions: urlState.lifeExpectancyAssumptions,
        netMigrationRateAssumptions: urlState.netMigrationRateAssumptions,
        retirementAgeAssumptions: urlState.retirementAgeAssumptions,
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
    urlSync,
    urlFertilityRateAssumptions,
    urlLifeExpectancyAssumptions,
    urlNetMigrationRateAssumptions,
    baselineEntityName,
    shouldSyncEntityName,
    retirementAgeAssumptions,
    urlRetirementAgeAssumptions,
    mode,
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
    urlSync?: boolean
    urlFertilityRateAssumptions?: Record<number, number>
    urlLifeExpectancyAssumptions?: Record<number, number>
    urlNetMigrationRateAssumptions?: Record<number, number>
    baselineEntityName?: string
    shouldSyncEntityName?: boolean
    retirementAgeAssumptions?: Record<number, number>
    urlRetirementAgeAssumptions?: Record<number, number>
    mode: SimulationContentMode
}) {
    const countryName = data.country

    const entitySelector = (
        <EntityNameOrSelector
            hideEntitySelector={hideEntitySelector}
            entityName={entityName}
            countryName={countryName}
            metadata={metadata}
            onChange={setEntityName}
        />
    )
    const title: React.ReactNode = titleOverride ? (
        titleOverride
    ) : mode === "dependencyRatio" ? (
        hideEntitySelector && countryName === "World" ? (
            <>How will the dependency ratio evolve?</>
        ) : (
            <>How will the dependency ratio evolve in {entitySelector}?</>
        )
    ) : hideEntitySelector && countryName === "World" ? (
        <>How many people will there be by 2100?</>
    ) : (
        <>How many people will live in {entitySelector} by 2100?</>
    )
    const subtitle =
        subtitleOverride ??
        (mode === "dependencyRatio"
            ? "Adjust demographic assumptions and the retirement age to see how the balance between young, working-age, and retired populations changes over time."
            : "Demographers publish projections of how populations will change in the future. But what if fertility rates fall faster, or rebound? Or migration rates change? Adjust these assumptions and compare.")

    return (
        <Frame className="demography-captioned-chart">
            <ChartHeader
                className="demography-header"
                title={title}
                subtitle={subtitle}
            />
            <div className="demography-captioned-chart__chart-area">
                {isLoading && <LoadingSpinner />}
                <SimulationContent
                    data={data}
                    focusParameter={focusParameter}
                    hidePopulationPyramid={hidePopulationPyramid}
                    populationPyramidUnit={populationPyramidUnit}
                    fertilityRateAssumptions={fertilityRateAssumptions}
                    lifeExpectancyAssumptions={lifeExpectancyAssumptions}
                    netMigrationRateAssumptions={netMigrationRateAssumptions}
                    urlSync={urlSync}
                    urlFertilityRateAssumptions={urlFertilityRateAssumptions}
                    urlLifeExpectancyAssumptions={urlLifeExpectancyAssumptions}
                    urlNetMigrationRateAssumptions={
                        urlNetMigrationRateAssumptions
                    }
                    baselineEntityName={baselineEntityName}
                    shouldSyncEntityName={shouldSyncEntityName}
                    retirementAgeAssumptions={retirementAgeAssumptions}
                    urlRetirementAgeAssumptions={urlRetirementAgeAssumptions}
                    mode={mode}
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
