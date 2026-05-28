import { useCallback, useMemo } from "react"
import cx from "classnames"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UNSAFE_PortalProvider } from "react-aria"
import { NuqsAdapter } from "nuqs/adapters/react"
import {
    parseAsInteger,
    parseAsNumberLiteral,
    parseAsString,
    parseAsStringEnum,
} from "nuqs"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"

import { SankeyVariantConfig, VariantProps } from "../config.js"
import {
    Entity,
    GENDER_ALL,
    GENDER_FEMALE,
    GENDER_MALE,
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
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <div
                    ref={ref}
                    className={cx("migration-chart", {
                        "migration-chart--narrow": isNarrow,
                    })}
                >
                    <UNSAFE_PortalProvider getContainer={getPortalContainer}>
                        <FetchingSankeyVariant config={config} />
                    </UNSAFE_PortalProvider>
                </div>
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

type Metadata = NonNullable<ReturnType<typeof useMigrationMetadata>["data"]>

function FetchingSankeyVariant({ config }: { config: SankeyVariantConfig }) {
    const urlSync = config.urlSync ?? false

    const initialCountry =
        !config.country || isUserLocationCountry(config.country)
            ? DEFAULT_COUNTRY
            : config.country

    const [country, setCountry] = useUrlState({
        key: "migrationCountry",
        parser: parseAsString,
        defaultValue: initialCountry,
        enabled: urlSync,
    })
    const [year, setYear] = useUrlState({
        key: "migrationYear",
        parser: parseAsInteger,
        defaultValue: config.year ?? DEFAULT_YEAR,
        enabled: urlSync,
    })
    const [genderId, setGenderId] = useUrlState({
        key: "migrationGender",
        parser: parseAsNumberLiteral([
            GENDER_ALL,
            GENDER_FEMALE,
            GENDER_MALE,
        ] as const),
        defaultValue: config.genderId ?? GENDER_ALL,
        enabled: urlSync,
    })
    const [_view, setView] = useUrlState({
        key: "migrationView",
        parser: parseAsStringEnum<MigrationView>([
            "both",
            "immigrants",
            "emigrants",
        ]),
        defaultValue: config.migrationFlow ?? DEFAULT_VIEW,
        enabled: urlSync,
    })

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
        () => R.sumBy(immigrants, (d) => d.value),
        [immigrants]
    )
    const emigrantsTotal = useMemo(
        () => R.sumBy(emigrants, (d) => d.value),
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

    // The disabled-switcher tooltip explains *why* the other half is
    // unpickable. Undefined when both halves have data (switcher enabled).
    const countryLabel = R.capitalize(articulateEntity(country))
    const viewDisabledReason: string | undefined = onlyImmigrants
        ? `No emigrants from ${countryLabel} recorded in ${year}.`
        : onlyEmigrants
          ? `No immigrants recorded in ${countryLabel} in ${year}.`
          : undefined

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
            viewDisabledReason={viewDisabledReason}
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
    viewDisabledReason,
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
    viewDisabledReason: string | undefined
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    immigrantsTotal: number
    emigrantsTotal: number
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setGenderId: (id: GenderId) => void
    setView: (view: MigrationView) => void
}) {
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
                        metadata={metadata}
                        country={country}
                        genderId={genderId}
                        year={year}
                        view={view}
                        viewDisabledReason={viewDisabledReason}
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
