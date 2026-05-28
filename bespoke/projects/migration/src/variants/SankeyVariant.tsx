import { useCallback, useMemo, useRef, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UNSAFE_PortalProvider } from "react-aria"

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

import { SankeyVariantConfig, VariantProps } from "../config.js"
import {
    Entity,
    GENDER_ALL,
    GenderId,
    MigrationFlow,
    MigrationRow,
    MigrationView,
} from "../types.js"
import { useMigrationData, useMigrationMetadata } from "../data.js"
import { MigrationChart } from "../components/MigrationChart.js"
import { MigrationControls } from "../components/MigrationControls.js"

// Default focal country name. Resolved to an id once metadata loads.
const DEFAULT_COUNTRY = "United States"
const DEFAULT_YEAR = 2024
const DEFAULT_VIEW: MigrationView = "both"

const queryClient = new QueryClient()

export function SankeyVariant({
    config,
}: VariantProps<SankeyVariantConfig>): React.ReactElement {
    const { width, node, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < MOBILE_BREAKPOINT

    // Portal react-aria overlays (dropdown popovers) back into our
    // Shadow DOM so the chart's scoped styles apply to them
    const getPortalContainer = useCallback((): HTMLElement => {
        const root = node?.getRootNode()
        if (root instanceof ShadowRoot) return root as unknown as HTMLElement
        return document.body
    }, [node])

    return (
        <QueryClientProvider client={queryClient}>
            <div ref={rootRef} className="migration-chart">
                <UNSAFE_PortalProvider getContainer={getPortalContainer}>
                    <FetchingSankeyVariant config={config} />
                </UNSAFE_PortalProvider>
            </div>
        </QueryClientProvider>
    )
}

type Metadata = NonNullable<ReturnType<typeof useMigrationMetadata>["data"]>

function FetchingSankeyVariant({ config }: { config: SankeyVariantConfig }) {
    const [country, setCountry] = useState<string>(
        config.country ?? DEFAULT_COUNTRY
    )
    const [year, setYear] = useState<number>(config.year ?? DEFAULT_YEAR)
    const [genderId, setGenderId] = useState<GenderId>(
        config.genderId ?? GENDER_ALL
    )
    const [_view, setView] = useState<MigrationView>(
        config.migrationFlow ?? DEFAULT_VIEW
    )

    const { data: metadata, status: metadataStatus } = useMigrationMetadata()

    // Resolve the country name to an entity id via metadata; falls back to
    // undefined until metadata loads (at which point the query enables).
    const countryId = useMemo(() => {
        if (!metadata) return undefined
        return metadata.entities.find((e) => e.name === country)?.id
    }, [metadata, country])

    const { data: migration, status: migrationStatus } =
        useMigrationData(countryId)

    const entitiesById = useMemo(() => {
        if (!metadata) return undefined
        const map = new Map<number, Entity>()
        for (const e of metadata.entities) map.set(e.id, e)
        return map
    }, [metadata])

    // Filter raw rows down to the active year/gender and resolve partner
    // ids to names. Used by the chart and the chart header.
    const immigrants = useMemo(
        () =>
            migration && entitiesById
                ? filterRows(
                      migration.immigrants,
                      year,
                      genderId,
                      entitiesById
                  )
                : [],
        [migration, entitiesById, year, genderId]
    )
    const emigrants = useMemo(
        () =>
            migration && entitiesById
                ? filterRows(migration.emigrants, year, genderId, entitiesById)
                : [],
        [migration, entitiesById, year, genderId]
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
    const view: MigrationView = onlyImmigrants
        ? "immigrants"
        : onlyEmigrants
          ? "emigrants"
          : _view

    if (
        metadataStatus === "pending" ||
        migrationStatus === "pending" ||
        !isCountryResolved
    )
        return <MigrationSkeleton />
    if (metadataStatus === "error" || !metadata)
        return <MigrationChartError message="Failed to load migration metadata" />
    if (migrationStatus === "error" || !migration)
        return <MigrationChartError message="Failed to load migration data" />

    return (
        <CaptionedSankeyVariant
            config={config}
            metadata={metadata}
            country={country}
            year={year}
            genderId={genderId}
            view={view}
            isViewDisabled={onlyImmigrants || onlyEmigrants}
            immigrants={immigrants}
            emigrants={emigrants}
            immigrantsTotal={immigrantsTotal}
            emigrantsTotal={emigrantsTotal}
            setCountry={setCountry}
            setYear={setYear}
            setGenderId={setGenderId}
            setView={setView}
        />
    )
}

function CaptionedSankeyVariant({
    config,
    metadata,
    country,
    year,
    genderId,
    view,
    isViewDisabled,
    immigrants,
    emigrants,
    immigrantsTotal,
    emigrantsTotal,
    setCountry,
    setYear,
    setGenderId,
    setView,
}: {
    config: SankeyVariantConfig
    metadata: Metadata
    country: string
    year: number
    genderId: GenderId
    view: MigrationView
    isViewDisabled: boolean
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    immigrantsTotal: number
    emigrantsTotal: number
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setGenderId: (id: GenderId) => void
    setView: (view: MigrationView) => void
}) {
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

    const shouldHideChrome =
        config.hideControls || !!config.title || !!config.subtitle

    return (
        <>
            {!shouldHideChrome && (
                <>
                    <header className="migration-heading">
                        <h1 className="migration-heading__title">
                            Where do migrants live, and where are they from?
                        </h1>
                        <p className="migration-heading__description">
                            Where international migrants live, by country of
                            birth
                        </p>
                    </header>
                    <MigrationControls
                        countryOptions={countryOptions}
                        genderOptions={genderOptions}
                        times={metadata.times}
                        country={country}
                        genderId={genderId}
                        year={year}
                        view={view}
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
                <MigrationChartHeader
                    config={config}
                    country={country}
                    year={year}
                    view={view}
                />
                <MigrationChart
                    immigrants={immigrants}
                    emigrants={emigrants}
                    country={country}
                    year={year}
                    immigrantsTotal={immigrantsTotal}
                    emigrantsTotal={emigrantsTotal}
                    view={view}
                    setView={setView}
                />
                <MigrationChartFooter source={metadata.source} />
            </Frame>
        </>
    )
}

function MigrationChartHeader({
    config,
    country,
    year,
    view,
}: {
    config: SankeyVariantConfig
    country: string
    year: number
    view: MigrationView
}) {
    const countryArticulated = articulateEntity(country)
    const defaultTitle =
        view === "immigrants"
            ? `Immigrants living in ${countryArticulated} in ${year}`
            : view === "emigrants"
              ? `Emigrants from ${countryArticulated} living abroad in ${year}`
              : `Immigrants and emigrants of ${countryArticulated} in ${year}`

    return (
        <ChartHeader
            title={config.title ?? defaultTitle}
            subtitle={config.subtitle}
        />
    )
}

function MigrationChartFooter({ source }: { source: string }) {
    return (
        <ChartFooter
            source={source}
            note='Only the top ten partners are shown; remainder grouped as "Other".'
        />
    )
}

function filterRows(
    rows: MigrationRow[],
    year: number,
    genderId: GenderId,
    entitiesById: Map<number, Entity>
): MigrationFlow[] {
    return rows
        .filter((r) => r.year === year && r.genderId === genderId)
        .map((r) => ({
            partner: entitiesById.get(r.partnerId)?.name ?? "Unknown",
            value: r.value,
        }))
}

function MigrationSkeleton() {
    return <div className="migration-skeleton" />
}

function MigrationChartError({ message }: { message: string }) {
    return <div className="migration-chart__error">{message}</div>
}
