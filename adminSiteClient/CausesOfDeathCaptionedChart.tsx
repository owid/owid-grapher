import * as R from "remeda"
import cx from "classnames"
import { EntityName, Time } from "@ourworldindata/types"
import {
    COUNTRIES_WITH_DEFINITE_ARTICLE,
    DataRow,
    EntityMetadata,
} from "./CausesOfDeathConstants"
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
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher"

// TODO: Fetch World data immediately (waits for the metadata to resolve right now)
// TODO: Not sure yet how to best show loading states when switching countries

export function CausesOfDeathCaptionedChart({
    year,
    tilingMethod = d3.treemapSquarify,
    debug = false,
}: {
    year: Time
    tilingMethod?: any
    debug?: boolean
}) {
    const [selectedEntityName, setSelectedEntityName] =
        useState(WORLD_ENTITY_NAME)

    // Fetch metadata
    const { data: metadata, status: metadataStatus } =
        useCausesOfDeathMetadata()

    // Fetch data for the selected entity
    const {
        data: entityData,
        status: entityDataStatus,
        isPlaceholderData,
        isFetching,
    } = useCausesOfDeathEntityData(selectedEntityName, metadata)

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

    if (!entityData || !metadata) return <div>No data available</div>

    const entityName = entityData[0].entityName
    const data = entityData.filter((row) => row.year === year)

    const dimensionsConfig = {
        initialWidth: 900,
        ratio: 3 / 2,
        minHeight: 400,
        maxHeight: 800,
    }

    return (
        <article className="causes-of-death-captioned-chart">
            <OwidLogo />
            <CausesOfDeathHeader
                data={data}
                entityName={entityName}
                year={year}
            />
            <EntityDropdown
                className="causes-of-death__entity-dropdown"
                availableEntities={metadata?.availableEntities}
                selectedEntityName={selectedEntityName}
                onChange={setSelectedEntityName}
                isLoading={isFetching}
            />
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
                    metadata={metadata}
                    entityName={entityName}
                    year={year}
                    dimensionsConfig={dimensionsConfig}
                    tilingMethod={tilingMethod}
                    debug={debug}
                />
            </div>
            <CausesOfDeathFooter />
        </article>
    )
}

function CausesOfDeathHeader({
    data,
    entityName,
    year,
}: {
    data: DataRow[]
    entityName: EntityName
    year: Time
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

    return (
        <header className="causes-of-death-header">
            <h1>
                What do people die from?{" "}
                <span>
                    Causes of death {locationDescription} in {year}
                </span>
            </h1>
            <p className="causes-of-death-header__subtitle">
                The size of the entire visualization represents the total number
                of deaths in {formatCountryName(entityName)} in {year}:{" "}
                {formattedNumTotalDeaths}. Each rectangle within is proportional
                to the share of deaths due to a particular cause.
            </p>
        </header>
    )
}

function CausesOfDeathFooter() {
    return (
        <footer className="causes-of-death-footer">
            <div>
                <b>Data source:</b> IHME, Global Burden of Disease (2024)
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

function formatCountryName(countryName: string): string {
    if (COUNTRIES_WITH_DEFINITE_ARTICLE.includes(countryName)) {
        return `the ${countryName}`
    }
    return countryName
}
