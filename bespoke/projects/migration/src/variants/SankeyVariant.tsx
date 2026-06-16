import { useMemo } from "react"
import cx from "classnames"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import {
    assignColors,
    OTHER_KEY,
} from "../../../../components/Sankey/SankeyHelpers.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"

import { SankeyVariantConfig, VariantProps } from "../config.js"
import { MigrationFlow, MigrationRow, MigrationView, Sex } from "../types.js"
import { useMigrationData, useMigrationMetadata } from "../data.js"
import {
    formatPeople,
    getSexAdjective,
    getSexNoun,
    OTHERS_ENTITY_NAME,
} from "../helpers.js"
import { MigrationChart } from "../components/MigrationChart.js"
import { MigrationControls } from "../components/MigrationControls.js"

const DEFAULT_COUNTRY = "United States"
const DEFAULT_VIEW: MigrationView = "both"

const queryClient = new QueryClient()

export function SankeyVariant({
    config,
}: VariantProps<SankeyVariantConfig>): React.ReactElement {
    const { width, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < MOBILE_BREAKPOINT

    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <div
                    ref={ref}
                    className={cx("migration-chart", {
                        "migration-chart--narrow": isNarrow,
                    })}
                >
                    <FetchingSankeyVariant config={config} />
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
        defaultValue: config.year ?? 2024,
        enabled: urlSync,
    })
    const [sex, setSex] = useUrlState({
        key: "migrationSex",
        parser: parseAsStringEnum<Sex>(["both", "female", "male"]),
        defaultValue: config.sex ?? "both",
        enabled: urlSync,
    })
    const [_view, setView] = useUrlState({
        key: "migrationFlow",
        parser: parseAsStringEnum<MigrationView>([
            "both",
            "immigrants",
            "emigrants",
        ]),
        defaultValue: config.flow ?? DEFAULT_VIEW,
        enabled: urlSync,
    })

    const { data: metadata, status: metadataStatus } = useMigrationMetadata()

    const availableCountryNames = useMemo(
        () =>
            metadata
                ? new Set(
                      metadata.entities
                          .filter((e) => e.name !== OTHERS_ENTITY_NAME)
                          .map((e) => e.name)
                  )
                : undefined,
        [metadata]
    )
    const { isResolved: isCountryResolved } = useResolveUserLocation({
        configCountry: config.country,
        availableCountryNames,
        urlSync,
        urlStateKey: "migrationCountry",
        setCountry,
    })

    const countryId = useMemo(() => {
        if (!metadata) return undefined
        return metadata.entities.find((e) => e.name === country)?.id
    }, [metadata, country])

    const {
        data: migration,
        status: migrationStatus,
        isPlaceholderData,
    } = useMigrationData(countryId, metadata)

    // Dim the chart and show a spinner while a new country file loads,
    // keeping the previous country on screen until the new one arrives.
    const isLoading = useDelayedLoading(isPlaceholderData)

    // Filter rows down to the active year/sex
    const immigrants = useMemo(
        () => (migration ? filterRows(migration.immigrants, year, sex) : []),
        [migration, year, sex]
    )
    const emigrants = useMemo(
        () => (migration ? filterRows(migration.emigrants, year, sex) : []),
        [migration, year, sex]
    )

    const immigrantsTotal = useMemo(
        () => R.sumBy(immigrants, (d) => d.value),
        [immigrants]
    )
    const emigrantsTotal = useMemo(
        () => R.sumBy(emigrants, (d) => d.value),
        [emigrants]
    )

    // Country-scoped, all-time partner color map. Computed from the full
    // migration response (all years, both sexes, immigrants + emigrants
    // combined) and ordered by total volume, so partner colors stay
    // stable as the user drags the time slider or switches sex.
    // Recomputes when the country changes (because `migration` refetches).
    const colorMap = useMemo<Map<string, string> | undefined>(() => {
        if (!migration) return undefined
        const totals = new Map<string, number>()
        for (const r of [...migration.immigrants, ...migration.emigrants]) {
            totals.set(r.partner, (totals.get(r.partner) ?? 0) + r.value)
        }
        const ordered = R.pipe(
            [...totals],
            R.sortBy([(p) => p[1], "desc"]),
            R.map(([name]) => name)
        )
        return assignColors([...ordered, OTHER_KEY])
    }, [migration])

    // When the selected country only migrates in one direction for the
    // current year/sex, the other view has nothing to show — coerce
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

    // While a new country loads, the query serves the previous country's rows
    // as placeholder data
    const displayedCountry = migration?.country ?? country

    const countryLabel = R.capitalize(articulateEntity(displayedCountry))
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
        return (
            <MigrationChartError message="Failed to load migration metadata" />
        )
    if (migrationStatus === "error" || !migration)
        return <MigrationChartError message="Failed to load migration data" />

    return (
        <CaptionedSankeyVariant
            config={config}
            metadata={metadata}
            country={country}
            displayedCountry={displayedCountry}
            year={year}
            sex={sex}
            view={view}
            viewDisabledReason={viewDisabledReason}
            immigrants={immigrants}
            emigrants={emigrants}
            immigrantsTotal={immigrantsTotal}
            emigrantsTotal={emigrantsTotal}
            colorMap={colorMap}
            isLoading={isLoading}
            setCountry={setCountry}
            setYear={setYear}
            setSex={setSex}
            setView={setView}
        />
    )
}

function CaptionedSankeyVariant({
    config,
    metadata,
    country,
    displayedCountry,
    year,
    sex,
    view,
    viewDisabledReason,
    immigrants,
    emigrants,
    immigrantsTotal,
    emigrantsTotal,
    colorMap,
    isLoading,
    setCountry,
    setYear,
    setSex,
    setView,
}: {
    config: SankeyVariantConfig
    metadata: Metadata
    country: string
    displayedCountry: string
    year: number
    sex: Sex
    view: MigrationView
    viewDisabledReason: string | undefined
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    immigrantsTotal: number
    emigrantsTotal: number
    colorMap: Map<string, string> | undefined
    isLoading: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setSex: (sex: Sex) => void
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
                            Where do migrants live, and where were they born?
                        </h1>
                        <p className="migration-heading__description">
                            Based on the total migrant population — not annual
                            flows — by country of birth.
                        </p>
                    </header>
                    <MigrationControls
                        metadata={metadata}
                        country={country}
                        sex={sex}
                        year={year}
                        view={view}
                        viewDisabledReason={viewDisabledReason}
                        hideFlowSwitcher={config.hideFlowSwitcher}
                        setCountry={setCountry}
                        setSex={setSex}
                        setYear={setYear}
                        setView={setView}
                    />
                </>
            )}
            <Frame className="migration-captioned-chart">
                <MigrationChartHeader
                    config={config}
                    country={displayedCountry}
                    year={year}
                    sex={sex}
                    view={view}
                    immigrantsTotal={immigrantsTotal}
                    emigrantsTotal={emigrantsTotal}
                />
                <MigrationChart
                    immigrants={immigrants}
                    emigrants={emigrants}
                    country={displayedCountry}
                    year={year}
                    sex={sex}
                    immigrantsTotal={immigrantsTotal}
                    emigrantsTotal={emigrantsTotal}
                    view={view}
                    setView={setView}
                    colorMap={colorMap}
                    isLoading={isLoading}
                    excludeFromTop={[OTHERS_ENTITY_NAME]}
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
    sex,
    view,
    immigrantsTotal,
    emigrantsTotal,
}: {
    config: SankeyVariantConfig
    country: string
    year: number
    sex: Sex
    view: MigrationView
    immigrantsTotal: number
    emigrantsTotal: number
}) {
    const countryArticulated = articulateEntity(country)

    const adjective = getSexAdjective(sex)
    const sexPrefix = adjective ? `${adjective} ` : ""
    const peopleNoun = getSexNoun(adjective)

    const immigrantsCount = formatPeople(immigrantsTotal, { unit: false })
    const emigrantsCount = formatPeople(emigrantsTotal, { unit: false })

    const defaultTitle =
        view === "immigrants"
            ? `${immigrantsCount} ${peopleNoun} living in ${countryArticulated} in ${year} were born in another country. Where were they born?`
            : view === "emigrants"
              ? `${emigrantsCount} ${peopleNoun} born in ${countryArticulated} lived abroad in ${year}. Where did they live?`
              : `Where ${sexPrefix}immigrants in ${countryArticulated} were born, and where its emigrants lived in ${year}`

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
            note='Only the largest partners are named; the remainder are grouped as "Other". Figures represent migrant stocks — the number of migrants living in a country at a given time — not annual flows.'
        />
    )
}

function filterRows(
    rows: MigrationRow[],
    year: number,
    sex: Sex
): MigrationFlow[] {
    return rows
        .filter((r) => r.year === year && r.sex === sex && r.value > 0)
        .map((r) => ({ partner: r.partner, value: r.value }))
}

function MigrationSkeleton() {
    return <div className="migration-skeleton" />
}

function MigrationChartError({ message }: { message: string }) {
    return <div className="migration-chart__error">{message}</div>
}
