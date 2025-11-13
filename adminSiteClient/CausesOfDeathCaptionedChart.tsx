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
import { MyCausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"

// TODO: Fetch World data immediately (waits for the metadata to resolve right now)
// TODO: Not sure yet how to best show loading states when switching countries

export function CausesOfDeathCaptionedChart({
    tilingMethod = d3.treemapSquarify,
    selectedAgeGroup = "all-ages",
    debug = false,
}: {
    tilingMethod?: any
    selectedAgeGroup?: "all-ages" | "under-5"
    debug?: boolean
}) {
    const isNarrow = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    const [selectedEntityName, setSelectedEntityName] =
        useState(WORLD_ENTITY_NAME)
    const [selectedYear, setSelectedYear] = useState<Time>()

    // Fetch metadata
    const { data: metadata, status: metadataStatus } =
        useCausesOfDeathMetadata(selectedAgeGroup)

    // Fetch data for the selected entity
    const {
        data: entityData,
        status: entityDataStatus,
        isPlaceholderData,
        isFetching,
    } = useCausesOfDeathEntityData(
        selectedEntityName,
        metadata,
        selectedAgeGroup
    )

    // Extract available years from entity data
    const availableYears = useMemo(
        () => [...new Set(entityData?.map((row) => row.year))],
        [entityData]
    )

    const currentYear = selectedYear ?? availableYears.at(-1)

    // Only show loading overlay after 300ms delay to prevent flashing
    const showDelayedLoading = useDelayedLoading(isPlaceholderData, 300)

    // Show loading state only for initial load (when no data exists)
    if (metadataStatus === "pending" || entityDataStatus === "pending") {
        return <div>Loading country data...</div>
    }

    // Show error state for entity data
    if (metadataStatus === "error" || entityDataStatus === "error") {
        return <div>Error loading country data</div>
    }

    if (
        !metadata ||
        !entityData ||
        entityData.length === 0 ||
        currentYear === undefined
    )
        return <div>No data available</div>

    const { entityName } = entityData[0]
    const data = entityData.filter((row) => row.year === currentYear)

    const dimensionsConfig = {
        initialWidth: 900,
        ratio: 3 / 2,
        minHeight: 400,
        maxHeight: 800,
    }

    return (
        <article className="causes-of-death-captioned-chart">
            <SideBySide>
                <AgeBracketDropdown
                    className="causes-of-death__entity-dropdown"
                    availableAgeBrackets={["all-ages", "under-5"]}
                    selectedAgeBracket={selectedAgeGroup}
                    onChange={() => void 0}
                    isLoading={isFetching}
                />
                <EntityDropdown
                    className="causes-of-death__entity-dropdown"
                    availableEntities={metadata?.availableEntities}
                    selectedEntityName={selectedEntityName}
                    onChange={setSelectedEntityName}
                    isLoading={isFetching}
                />
                <CausesOfDeathTimeSlider
                    className="causes-of-death__time-slider"
                    years={availableYears}
                    selectedYear={currentYear}
                    onChange={setSelectedYear}
                    isLoading={isFetching}
                />
            </SideBySide>

            <div style={{ padding: 16, border: "1px solid #e0e0e0" }}>
                <OwidLogo />
                <CausesOfDeathHeader
                    data={data}
                    entityName={entityName}
                    year={currentYear}
                    selectedAgeGroup={selectedAgeGroup}
                />
                {/* <SideBySide>
                <AgeBracketDropdown
                    className="causes-of-death__entity-dropdown"
                    availableAgeBrackets={["all-ages", "under-5"]}
                    selectedAgeBracket={selectedAgeGroup}
                    onChange={() => void 0}
                    isLoading={isFetching}
                />
                <EntityDropdown
                    className="causes-of-death__entity-dropdown"
                    availableEntities={metadata?.availableEntities}
                    selectedEntityName={selectedEntityName}
                    onChange={setSelectedEntityName}
                    isLoading={isFetching}
                />
                <CausesOfDeathTimeSlider
                    className="causes-of-death__time-slider"
                    years={availableYears}
                    selectedYear={currentYear}
                    onChange={setSelectedYear}
                    isLoading={isFetching}
                />
            </SideBySide> */}

                {isNarrow && (
                    <CausesOfDeathMobileBarChart
                        data={data}
                        metadata={metadata}
                    />
                )}

                <div
                    className={cx("causes-of-death-captioned-chart__treemap", {
                        "causes-of-death-captioned-chart__treemap--loading":
                            isPlaceholderData,
                    })}
                >
                    {showDelayedLoading && (
                        <div className="causes-of-death-captioned-chart__treemap-loading-overlay">
                            Loading data for {selectedEntityName}...
                        </div>
                    )}

                    <ResponsiveCausesOfDeathTreemap
                        data={data}
                        historicalData={entityData}
                        metadata={metadata}
                        entityName={entityName}
                        year={currentYear}
                        dimensionsConfig={dimensionsConfig}
                        tilingMethod={isNarrow ? d3.treemapSlice : tilingMethod}
                        debug={debug}
                        isNarrow={isNarrow}
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
    selectedAgeGroup = "under-5",
}: {
    data: DataRow[]
    entityName: EntityName
    year: Time
    selectedAgeGroup?: "all-ages" | "under-5"
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

    const ageGroupDescription =
        selectedAgeGroup === "under-5" ? "children under 5" : "people"
    const titleQuestion =
        selectedAgeGroup === "under-5"
            ? "What do children die from?"
            : "What do people die from?"

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
                of deaths among {ageGroupDescription} in{" "}
                {formatCountryName(entityName)} in {year}:{" "}
                {formattedNumTotalDeaths}. Each rectangle within is proportional
                to the share of deaths due to a particular cause.
            </p>
        </header>
    )
}

function CausesOfDeathFooter({
    metadata,
}: {
    metadata: MyCausesOfDeathMetadata
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
    availableAgeBrackets: ("all-ages" | "under-5")[]
    selectedAgeBracket: "all-ages" | "under-5"
    onChange: (ageBracket: string) => void
    className?: string
    isLoading?: boolean
}) {
    const options = useMemo(() => {
        return (
            availableAgeBrackets?.map((ageBracket: string) => ({
                value: ageBracket,
                label: ageBracket === "all-ages" ? "All" : "Under 5",
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
            onChange(option?.value ?? "all-ages")
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
                border: "1px solid #e0e0e0",
                padding: 16,
                marginBottom: 16,
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
