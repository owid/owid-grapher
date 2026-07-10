import { useEffect, useMemo, useState } from "react"
import {
    QueryClient,
    QueryClientProvider,
    QueryStatus,
} from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString } from "nuqs"
import * as R from "remeda"

import { Time } from "@ourworldindata/types"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher/src/core/GrapherConstants.js"

import { CausesOfDeathConfig } from "../helpers/CausesOfDeathConstants.js"
import {
    useCausesOfDeathEntityData,
    useCausesOfDeathMetadata,
} from "../helpers/CausesOfDeathDataFetching.js"
import { CausesOfDeathMetadata } from "../helpers/CausesOfDeathMetadata.js"
import { CausesOfDeathCaptionedChart } from "./CausesOfDeathCaptionedChart.js"
import { CausesOfDeathControls } from "./CausesOfDeathControls.js"

import { useUrlState } from "../../../../hooks/useUrlState.js"

import { Spinner } from "../../../../components/Spinner/Spinner.js"

const DEFAULT_AGE_GROUP = "All ages"
const DEFAULT_SEX = "Both sexes"
const DEFAULT_ENTITY_NAME = WORLD_ENTITY_NAME

// Sentinel year meaning "the latest available year"; the concrete default
// isn't known until the metadata has loaded.
const LATEST_YEAR = -1

const queryClient = new QueryClient()

export function CausesOfDeathChartWithProviders(props: {
    container?: HTMLDivElement
    config?: CausesOfDeathConfig
}): React.ReactElement {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <CausesOfDeathChart config={props.config} />
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function CausesOfDeathChart(props: {
    config?: CausesOfDeathConfig
}): React.ReactElement {
    const { config } = props

    const urlSync = config?.urlSync ?? false

    // State, synced to the URL if the urlSync flag is set
    const [ageGroup, setAgeGroup] = useUrlState({
        key: "causesOfDeathAge",
        parser: parseAsString,
        defaultValue: config?.ageGroup ?? DEFAULT_AGE_GROUP,
        enabled: urlSync,
    })
    const [sex, setSex] = useUrlState({
        key: "causesOfDeathSex",
        parser: parseAsString,
        defaultValue: config?.sex ?? DEFAULT_SEX,
        enabled: urlSync,
    })
    const [entityName, setEntityName] = useUrlState({
        key: "causesOfDeathRegion",
        parser: parseAsString,
        defaultValue: config?.region ?? DEFAULT_ENTITY_NAME,
        enabled: urlSync,
    })
    const [year, setYear] = useUrlState({
        key: "causesOfDeathYear",
        parser: parseAsInteger,
        defaultValue: config?.year ?? LATEST_YEAR,
        enabled: urlSync,
    })

    // Fetch the metadata and the data for the selected entity
    const metadataResponse = useCausesOfDeathMetadata()
    const entityDataResponse = useCausesOfDeathEntityData(
        entityName,
        metadataResponse.data
    )

    // Only show loading overlays after 300ms delay to prevent flashing
    const isLoadingEntityData = useDelayedLoading(
        entityDataResponse.isPlaceholderData,
        300
    )

    const metadata = metadataResponse.data
    const entityData = entityDataResponse.data

    const validVariablesForAgeGroup = useMemo(() => {
        return new Set(
            metadata?.variablesForAgeGroup(ageGroup).map((v) => v.name) ?? []
        )
    }, [metadata, ageGroup])

    const activeAgeGroup = ageGroup
    const activeSex = sex
    const activeYear = metadata ? resolveYear(year, metadata) : undefined
    const activeData = useMemo(
        () =>
            entityData?.filter(
                (row) =>
                    row.ageGroup === activeAgeGroup &&
                    row.sex === activeSex &&
                    validVariablesForAgeGroup.has(row.variable)
            ),
        [entityData, activeAgeGroup, activeSex, validVariablesForAgeGroup]
    )
    const activeEntityName = activeData?.at(0)?.entityName

    const loadingStatus = combineStatuses(
        metadataResponse.status,
        entityDataResponse.status
    )

    if (loadingStatus === "error") {
        return <CausesOfDeathChartError />
    }

    if (loadingStatus === "pending") {
        return <CausesOfDeathSkeleton />
    }

    // Sanity check
    if (
        !metadata ||
        !activeData ||
        activeData.length === 0 ||
        !activeYear ||
        !activeEntityName ||
        !activeAgeGroup ||
        !activeSex
    )
        return <CausesOfDeathChartError />

    return (
        <div className="causes-of-death-chart">
            {!config?.hideControls && (
                <CausesOfDeathControls
                    metadata={metadata}
                    ageGroup={ageGroup}
                    sex={sex}
                    entityName={entityName}
                    year={activeYear}
                    setAgeGroup={setAgeGroup}
                    setSex={setSex}
                    setEntityName={setEntityName}
                    setYear={setYear}
                />
            )}
            <CausesOfDeathCaptionedChart
                data={activeData}
                metadata={metadata}
                ageGroup={activeAgeGroup}
                sex={activeSex}
                entityName={activeEntityName}
                year={activeYear}
                isLoading={isLoadingEntityData}
            />
        </div>
    )
}

/**
 * The year comes from the URL or the block config, so it might lie outside
 * the available data range — clamp it. The LATEST_YEAR sentinel maps to the
 * latest available year.
 */
function resolveYear(year: Time, metadata: CausesOfDeathMetadata): Time {
    const { start, end } = metadata.timeRange
    if (year === LATEST_YEAR) return end
    return R.clamp(year, { min: start, max: end })
}

function CausesOfDeathChartError() {
    return <div>Causes of Death visualization can't be loaded</div>
}

function CausesOfDeathSkeleton() {
    return (
        <div className="causes-of-death-skeleton">
            <Spinner />
        </div>
    )
}

/**
 * Hook that only returns true after a loading state has persisted for a minimum duration.
 * This prevents loading indicators from flashing for quick operations.
 */
function useDelayedLoading(isLoading: boolean, delay = 300): boolean {
    const [showLoading, setShowLoading] = useState(false)

    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        if (isLoading) {
            // Start a timer to show loading after delay
            timeoutId = setTimeout(() => setShowLoading(true), delay)
        } else {
            // Immediately hide loading when not loading
            setShowLoading(false)
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [isLoading, delay])

    return showLoading
}

function combineStatuses(...statuses: QueryStatus[]): QueryStatus {
    if (statuses.some((status) => status === "error")) return "error"
    if (statuses.some((status) => status === "pending")) return "pending"
    return "success"
}
