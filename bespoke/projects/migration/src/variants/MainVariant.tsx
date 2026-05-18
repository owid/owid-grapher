import { useCallback, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { articulateEntity } from "@ourworldindata/utils"
import { BasicDropdownOption } from "@ourworldindata/grapher"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { type DropdownCollection } from "../../../../components/InlineLabeledDropdown/InlineLabeledDropdown.js"
import { groupByUserLocation } from "../../../../components/EntityDropdown/EntityDropdown.js"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"

import { MainVariantConfig, VariantProps } from "../config.js"
import {
    Entity,
    GENDER_ALL,
    GenderId,
    MigrationData,
    MigrationRow,
    useMigrationData,
    useMigrationMetadata,
} from "../data.js"
import {
    MigrationFlow,
    MigrationSankey,
    MigrationView,
    formatPeople,
} from "../components/MigrationSankey.js"
import { MigrationControls } from "../components/MigrationControls.js"

// Default focal country name. Resolved to an id once metadata loads.
const DEFAULT_COUNTRY = "United States"
const DEFAULT_YEAR = 2024

const queryClient = new QueryClient()

export function MainVariant({
    config,
}: VariantProps<MainVariantConfig>): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="migration-chart">
                <FetchingMainVariant config={config} />
            </div>
        </QueryClientProvider>
    )
}

function FetchingMainVariant({ config }: { config: MainVariantConfig }) {
    const {
        data: metadata,
        status: metadataStatus,
        error: metadataError,
    } = useMigrationMetadata()

    const [country, setCountry] = useState<string>(
        config.country ?? DEFAULT_COUNTRY
    )
    const [year, setYear] = useState<number>(config.year ?? DEFAULT_YEAR)
    const [genderId, setGenderId] = useState<GenderId>(
        config.genderId ?? GENDER_ALL
    )
    const [view, setView] = useState<MigrationView>(
        config.migrationFlow ?? "both"
    )

    // Resolve the country name to an entity id via metadata; falls back to
    // undefined until metadata loads (at which point the query enables).
    const countryId = useMemo(() => {
        if (!metadata) return undefined
        return metadata.entities.find((e) => e.name === country)?.id
    }, [metadata, country])

    const {
        data: migration,
        status: migrationStatus,
        error: migrationError,
    } = useMigrationData(countryId)

    if (metadataStatus === "pending") return <MigrationSkeleton />
    if (metadataStatus === "error" || !metadata)
        return <MigrationChartError error={metadataError} />

    return (
        <CaptionedMainVariant
            metadata={metadata}
            migration={migration}
            migrationStatus={migrationStatus}
            migrationError={migrationError}
            country={country}
            year={year}
            genderId={genderId}
            view={view}
            setCountry={setCountry}
            setYear={setYear}
            setGenderId={setGenderId}
            setView={setView}
            config={config}
        />
    )
}

type Metadata = NonNullable<ReturnType<typeof useMigrationMetadata>["data"]>

function CaptionedMainVariant({
    metadata,
    migration,
    migrationStatus,
    migrationError,
    country,
    year,
    genderId,
    view,
    setCountry,
    setYear,
    setGenderId,
    setView,
    config,
}: {
    metadata: Metadata
    migration: MigrationData | undefined
    migrationStatus: "pending" | "error" | "success"
    migrationError: Error | null
    country: string
    year: number
    genderId: GenderId
    view: MigrationView
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setGenderId: (id: GenderId) => void
    setView: (view: MigrationView) => void
    config: MainVariantConfig
}) {
    const entitiesById = useMemo(() => {
        const map = new Map<number, Entity>()
        for (const e of metadata.entities) map.set(e.id, e)
        return map
    }, [metadata.entities])

    // Country options are keyed by name so groupByUserLocation can match
    // the user's home country (also keyed by name in the geo lookup) and
    // surface it at the top.
    const { data: userCountryInfo } = useUserCountryInformation()
    const countryOptions = useMemo<DropdownCollection>(() => {
        const flat: BasicDropdownOption[] = metadata.entities
            .map((e) => ({ value: e.name, label: e.name }))
            .sort((a, b) => a.label.localeCompare(b.label))
        return groupByUserLocation(flat, userCountryInfo)
    }, [metadata.entities, userCountryInfo])

    const genderOptions = useMemo<BasicDropdownOption[]>(
        () =>
            metadata.genders.map((g) => ({
                value: String(g.id),
                label: g.name,
            })),
        [metadata.genders]
    )

    const filterRows = useCallback(
        (rows: MigrationRow[]): MigrationFlow[] =>
            rows
                .filter((r) => r.year === year && r.genderId === genderId)
                .map((r) => ({
                    partner: entitiesById.get(r.partnerId)?.name ?? "Unknown",
                    value: r.value,
                })),
        [year, genderId, entitiesById]
    )

    const immigrants = useMemo(
        () => (migration ? filterRows(migration.immigrants) : []),
        [migration, filterRows]
    )
    const emigrants = useMemo(
        () => (migration ? filterRows(migration.emigrants) : []),
        [migration, filterRows]
    )

    const immigrantsTotal = useMemo(
        () => immigrants.reduce((sum, d) => sum + d.value, 0),
        [immigrants]
    )
    const emigrantsTotal = useMemo(
        () => emigrants.reduce((sum, d) => sum + d.value, 0),
        [emigrants]
    )

    // When the selected country only migrates in one direction for the
    // current year/gender, the other view has nothing to show — coerce
    // the displayed view to the half that has data and disable the radios.
    // The user's stored view preference is left untouched so it comes back
    // when they navigate to a combo with both sides.
    const onlyImmigrants = immigrants.length > 0 && emigrants.length === 0
    const onlyEmigrants = emigrants.length > 0 && immigrants.length === 0
    const effectiveView: MigrationView = onlyImmigrants
        ? "immigrants"
        : onlyEmigrants
          ? "emigrants"
          : view
    const isViewDisabled = onlyImmigrants || onlyEmigrants

    const hasData = immigrants.length > 0 || emigrants.length > 0
    const isLoadingMigration = migrationStatus === "pending"
    const isErrorMigration = migrationStatus === "error"

    const countryArticulated = articulateEntity(country)
    const defaultTitle =
        effectiveView === "immigrants"
            ? `Immigration to ${countryArticulated} in ${year}`
            : effectiveView === "emigrants"
              ? `Emigration from ${countryArticulated} in ${year}`
              : `Migration to and from ${countryArticulated} in ${year}`

    const defaultSubtitle: React.ReactNode = hasData ? (
        <Subtitle
            country={country}
            year={year}
            view={effectiveView}
            immigrantsTotal={immigrantsTotal}
            emigrantsTotal={emigrantsTotal}
        />
    ) : null

    const title = config.title ?? defaultTitle
    const subtitle = config.subtitle ?? defaultSubtitle

    // Hide the big page heading and the controls when the embedder is
    // providing its own framing (custom title/subtitle) or explicitly opts
    // out of the controls.
    const hideOutsideFrame =
        config.hideControls || !!config.title || !!config.subtitle

    return (
        <>
            {!hideOutsideFrame && (
                <>
                    <header className="migration-heading">
                        <h1 className="migration-heading__title">
                            How do people move between countries?
                        </h1>
                        <p className="migration-heading__description">
                            Where people migrate to, and where they come from
                        </p>
                    </header>
                    <MigrationControls
                        countryOptions={countryOptions}
                        genderOptions={genderOptions}
                        times={metadata.times}
                        country={country}
                        genderId={genderId}
                        year={year}
                        view={effectiveView}
                        viewDisabled={isViewDisabled}
                        hideFlowSwitcher={config.hideFlowSwitcher}
                        setCountry={setCountry}
                        setGenderId={setGenderId}
                        setYear={setYear}
                        setView={setView}
                    />
                </>
            )}
            <Frame className="migration-captioned-chart">
                <ChartHeader title={title} subtitle={subtitle} />
                <div className="migration-captioned-chart__chart-area">
                    {isLoadingMigration ? (
                        <MigrationSkeleton />
                    ) : isErrorMigration ? (
                        <MigrationChartError error={migrationError} />
                    ) : hasData ? (
                        <MigrationSankey
                            immigrants={immigrants}
                            emigrants={emigrants}
                            country={country}
                            year={year}
                            immigrantsTotal={immigrantsTotal}
                            emigrantsTotal={emigrantsTotal}
                            view={effectiveView}
                            setView={setView}
                        />
                    ) : (
                        <EmptyState
                            message={`No ${year} migration recorded for ${countryArticulated}.`}
                        />
                    )}
                </div>
                <ChartFooter source={metadata.source} />
            </Frame>
        </>
    )
}

function Subtitle({
    country,
    year,
    view,
    immigrantsTotal,
    emigrantsTotal,
}: {
    country: string
    year: number
    view: MigrationView
    immigrantsTotal: number
    emigrantsTotal: number
}) {
    const name = capitalize(articulateEntity(country))
    if (view === "immigrants") {
        if (immigrantsTotal === 0) {
            return (
                <>
                    {name} had no recorded immigrants in {year}.
                </>
            )
        }
        return (
            <>
                {name} received {formatPeople(immigrantsTotal)} immigrants in{" "}
                {year}.
            </>
        )
    }
    if (view === "emigrants") {
        if (emigrantsTotal === 0) {
            return (
                <>
                    {name} had no recorded emigrants in {year}.
                </>
            )
        }
        return (
            <>
                {name} sent {formatPeople(emigrantsTotal)} emigrants in {year}.
            </>
        )
    }
    if (immigrantsTotal === 0 && emigrantsTotal === 0) {
        return (
            <>
                {name} had no recorded migration in {year}.
            </>
        )
    }
    if (immigrantsTotal > 0 && emigrantsTotal > 0) {
        return (
            <>
                {name} received {formatPeople(immigrantsTotal)} immigrants and
                sent {formatPeople(emigrantsTotal)} emigrants in {year}.
            </>
        )
    }
    if (immigrantsTotal > 0) {
        return (
            <>
                {name} received {formatPeople(immigrantsTotal)} immigrants in{" "}
                {year}.
            </>
        )
    }
    return (
        <>
            {name} sent {formatPeople(emigrantsTotal)} emigrants in {year}.
        </>
    )
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

function EmptyState({
    message,
    cta,
}: {
    message: React.ReactNode
    cta?: { label: string; onClick: () => void }
}) {
    return (
        <div className="migration-captioned-chart__empty">
            <p className="migration-captioned-chart__empty-message">
                {message}
            </p>
            {cta && (
                <button
                    type="button"
                    className="migration-captioned-chart__empty-cta"
                    onClick={cta.onClick}
                >
                    {cta.label} →
                </button>
            )}
        </div>
    )
}

function MigrationSkeleton() {
    return <div className="migration-skeleton" />
}

function MigrationChartError({ error }: { error: Error | null }) {
    return (
        <div className="migration-chart__error">
            Failed to load migration data{error ? `: ${error.message}` : ""}
        </div>
    )
}
