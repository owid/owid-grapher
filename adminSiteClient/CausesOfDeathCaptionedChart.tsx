import * as R from "remeda"
import cx from "classnames"
import { EntityName, Time } from "@ourworldindata/types"
import { DataRow, EntityMetadata } from "./CausesOfDeathConstants"
import React, { useMemo, useState, useCallback, useEffect } from "react"
import * as d3 from "d3"
import {
    Dropdown,
    BasicDropdownOption,
} from "@ourworldindata/grapher/src/controls/Dropdown"
import {
    useCausesOfDeathEntityData,
    useCausesOfDeathMetadata,
} from "./CausesOfDeathDataFetching"
import { ResponsiveCausesOfDeathTreemap } from "./CausesOfDeathTreemap"
import { CausesOfDeathMobileBarChart } from "./CausesOfDeathMobileBarChart"
import { CausesOfDeathTimeSlider } from "./CausesOfDeathTimeSlider"
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher"
import { formatCountryName } from "./CausesOfDeathHelpers.js"
import { useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../site/SiteConstants.js"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"

//
// TODO: Not sure yet how to best show loading states when switching countries
//

const DEFAULT_AGE_GROUP = "All ages"
const DEFAULT_ENTITY_NAME = WORLD_ENTITY_NAME

export function CausesOfDeathCaptionedChart({
    debug = false,
}: {
    debug?: boolean
}) {
    const isNarrow = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    const [selectedAgeGroup, setSelectedAgeGroup] = useState(DEFAULT_AGE_GROUP)
    const [selectedEntityName, setSelectedEntityName] =
        useState(DEFAULT_ENTITY_NAME)
    const [selectedYear, setSelectedYear] = useState<Time>()

    // Fetch metadata
    const metadataResponse = useCausesOfDeathMetadata()

    // Fetch data for the selected entity
    const entityDataResponse = useCausesOfDeathEntityData(
        selectedEntityName,
        metadataResponse.data
    )

    const response = [metadataResponse, entityDataResponse]
    const loadingStatus = response.some((r) => r.status === "error")
        ? "error"
        : response.some((r) => r.status === "pending")
          ? "pending"
          : "success"

    // Only show loading overlays after 300ms delay to prevent flashing
    const showDelayedLoading = useDelayedLoading(
        entityDataResponse.isPlaceholderData,
        300
    )

    // Show error state for entity data
    if (loadingStatus === "error") {
        return <div>Error loading data</div>
    }

    // Show loading state only for initial load
    if (loadingStatus === "pending") {
        return <div>Loading data...</div>
    }

    if (!metadataResponse.data || !entityDataResponse.data)
        return <div>No data available</div>

    const metadata = metadataResponse.data
    const entityData = entityDataResponse.data

    const activeAgeGroup = selectedAgeGroup
    const activeYear = selectedYear ?? metadata.availableYears.at(-1)
    const activeTimeSeriesData = entityData.filter(
        (row) => row.ageGroup === activeAgeGroup
    )
    const activeData = activeTimeSeriesData.filter(
        (row) => row.year === activeYear
    )
    console.log("activeData", activeData)
    const activeEntityName = activeData.at(0)?.entityName

    // Sanity check
    if (
        activeData.length === 0 ||
        !activeYear ||
        !activeEntityName ||
        !activeAgeGroup
    )
        return null

    const dimensionsConfig = {
        initialWidth: 900,
        ratio: 3 / 2,
        minHeight: 400,
        maxHeight: 800,
    }

    const tilingMethod = isNarrow
        ? d3.treemapSlice
        : stackedSliceDiceTiling({ minSliceWidth: 120, minStackHeight: 40 })

    return (
        <article className="causes-of-death-captioned-chart">
            <div
                style={{
                    border: "1px solid #e0e0e0",
                    padding: 16,
                    marginBottom: 16,
                }}
            >
                <div className="controls-title">Configure the data</div>
                <SideBySide>
                    <AgeBracketDropdown
                        className="causes-of-death__entity-dropdown"
                        availableAgeBrackets={metadata.availableAgeGroups}
                        selectedAgeBracket={selectedAgeGroup}
                        onChange={setSelectedAgeGroup}
                    />
                    <EntityDropdown
                        className="causes-of-death__entity-dropdown"
                        availableEntities={metadata?.availableEntities}
                        selectedEntityName={selectedEntityName}
                        onChange={setSelectedEntityName}
                        isLoading={entityDataResponse.isFetching}
                    />
                    <CausesOfDeathTimeSlider
                        className="causes-of-death__time-slider"
                        years={metadata.availableYears}
                        selectedYear={activeYear}
                        onChange={setSelectedYear}
                        isLoading={entityDataResponse.isFetching}
                    />
                </SideBySide>
            </div>

            <div style={{ padding: 16, border: "1px solid #e0e0e0" }}>
                <OwidLogo />
                <CausesOfDeathHeader
                    data={activeData}
                    entityName={activeEntityName}
                    year={activeYear}
                    ageGroup={activeAgeGroup}
                />

                {isNarrow && (
                    <CausesOfDeathMobileBarChart
                        data={activeData}
                        metadata={metadata}
                    />
                )}

                <div
                    className={cx("causes-of-death-captioned-chart__treemap", {
                        "causes-of-death-captioned-chart__treemap--loading":
                            entityDataResponse.isPlaceholderData,
                    })}
                >
                    {showDelayedLoading && (
                        <div className="causes-of-death-captioned-chart__treemap-loading-overlay">
                            Loading data for {selectedEntityName}...
                        </div>
                    )}

                    <ResponsiveCausesOfDeathTreemap
                        data={activeData}
                        historicalData={activeTimeSeriesData}
                        metadata={metadata}
                        entityName={activeEntityName}
                        year={activeYear}
                        ageGroup={activeAgeGroup}
                        dimensionsConfig={dimensionsConfig}
                        tilingMethod={tilingMethod}
                        isNarrow={isNarrow}
                        debug={debug}
                    />
                </div>
                <CausesOfDeathFooter metadata={metadata} />
            </div>
        </article>
    )
}

function CausesOfDeathHeader({
    data,
    entityName,
    year,
    ageGroup: _ageGroup,
}: {
    data: DataRow[]
    entityName: EntityName
    year: Time
    ageGroup: string
}) {
    const numTotalDeaths = useMemo(
        () =>
            R.pipe(
                data,
                R.filter((row) => row.year === year),
                R.sumBy((d) => d.value)
            ),
        [data, year]
    )

    const formattedNumTotalDeaths = useMemo(
        () => formatNumberLongText(numTotalDeaths),
        [numTotalDeaths]
    )

    const locationDescription =
        entityName === "World"
            ? "globally"
            : `in ${formatCountryName(entityName)}`

    const titleQuestion = "What do people die from?"

    return (
        <header className="causes-of-death-header">
            <h1>
                {titleQuestion}{" "}
                <span>
                    Causes of death {locationDescription} in {year}
                </span>
            </h1>
            <p className="causes-of-death-header__subtitle">
                The size of the entire visualization represents the total number
                of deaths {locationDescription} in {year}:{" "}
                {formattedNumTotalDeaths}. Each rectangle within is proportional
                to the share of deaths due to a particular cause.
            </p>
        </header>
    )
}

function CausesOfDeathFooter({
    metadata,
}: {
    metadata: CausesOfDeathMetadata
}) {
    return (
        <footer className="causes-of-death-footer">
            <div>
                <b>Data source:</b> {metadata.source}
            </div>
            <TooltipTrigger>
                <Link
                    className="cc-by-button"
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    CC BY
                </Link>
                <Tooltip className="cc-by-tooltip">
                    Our World in Data charts are licensed under Creative
                    Commons; you are free to use, share, and adapt this
                    material. Click through to the CC BY page for more
                    information. Please bear in mind that the underlying source
                    data for all our charts might be subject to different
                    license terms from third-party authors.
                </Tooltip>
            </TooltipTrigger>
        </footer>
    )
}

function EntityDropdown({
    availableEntities,
    selectedEntityName,
    onChange,
    className,
    isLoading,
}: {
    availableEntities: EntityMetadata[]
    selectedEntityName: EntityName
    onChange: (entityName: EntityName) => void
    className?: string
    isLoading?: boolean
}) {
    const options = useMemo(() => {
        return (
            availableEntities?.map((entity: EntityMetadata) => ({
                value: entity.name,
                label: entity.name,
                id: entity.id,
            })) ?? []
        )
    }, [availableEntities])

    const selectedValue = useMemo(() => {
        return (
            options.find((entity) => entity.value === selectedEntityName) ||
            null
        )
    }, [options, selectedEntityName])

    const handleChange = useCallback(
        (option: BasicDropdownOption | null) => {
            onChange(option?.value ?? WORLD_ENTITY_NAME)
        },
        [onChange]
    )

    return (
        <Dropdown
            className={className}
            options={options}
            value={selectedValue}
            onChange={handleChange}
            placeholder="Select a region..."
            isSearchable={true}
            isClearable={false}
            isLoading={isLoading}
            aria-label="Select region"
            renderTriggerValue={renderRegionTriggerValue}
        />
    )
}

function AgeBracketDropdown({
    availableAgeBrackets,
    selectedAgeBracket,
    onChange,
    className,
    isLoading,
}: {
    availableAgeBrackets: string[]
    selectedAgeBracket: string
    onChange: (ageBracket: string) => void
    className?: string
    isLoading?: boolean
}) {
    const options = useMemo(() => {
        return (
            availableAgeBrackets?.map((ageBracket: string) => ({
                value: ageBracket,
                label: ageBracket,
                id: ageBracket,
            })) ?? []
        )
    }, [availableAgeBrackets])

    const selectedValue = useMemo(() => {
        return (
            options.find((entity) => entity.value === selectedAgeBracket) ||
            null
        )
    }, [options, selectedAgeBracket])

    const handleChange = useCallback(
        (option: BasicDropdownOption | null) => {
            if (option) {
                onChange(option.value)
            }
        },
        [onChange]
    )

    return (
        <Dropdown
            className={className}
            options={options}
            value={selectedValue}
            onChange={handleChange}
            placeholder="Select an age bracket..."
            isSearchable={true}
            isClearable={false}
            isLoading={isLoading}
            aria-label="Select age bracket"
            renderTriggerValue={renderAgeBracketTriggerValue}
        />
    )
}

function SideBySide({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="side-by-side"
            style={{
                rowGap: 12,
            }}
        >
            {children}
        </div>
    )
}

function OwidLogo() {
    return (
        <img
            src="/owid-logo.svg"
            alt="Our World in Data logo"
            className="owid-logo"
            width={52}
            height={29}
        />
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

function formatNumberLongText(value: number): string {
    if (value === 0) return "0"

    if (value >= 1000000000) {
        const billions = value / 1000000000
        return `${billions.toFixed(1)} billion`
    } else if (value >= 1000000) {
        const millions = value / 1000000
        return `${millions.toFixed(1)} million`
    } else if (value >= 1000) {
        const thousands = value / 1000
        return `${thousands.toFixed(0)} thousand`
    } else {
        return value.toString()
    }
}

function renderRegionTriggerValue(
    option: BasicDropdownOption | null
): React.ReactNode | undefined {
    if (!option) return undefined
    return (
        <>
            <span className="label">Region: </span>
            {option.label}
        </>
    )
}

function renderAgeBracketTriggerValue(
    option: BasicDropdownOption | null
): React.ReactNode | undefined {
    if (!option) return undefined
    return (
        <>
            <span className="label">Age: </span>
            {option.label}
        </>
    )
}
