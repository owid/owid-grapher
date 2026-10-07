import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import {
    parseAsArrayOf,
    parseAsBoolean,
    parseAsInteger,
    parseAsString,
    parseAsStringEnum,
} from "nuqs"
import type { BespokeMetadata, OwidOrigin } from "@ourworldindata/types"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import type { VariantProps } from "../../../../helpers/config.js"

import type { ScatterVariantConfig } from "../core/config.js"
import { Feed, queryClient, useFeed } from "../core/feed.js"
import { maxPopulation, selectedIds } from "../core/points.js"
import {
    EntityId,
    INDEX_KEYS,
    IndexKey,
    OUTCOME_KEYS,
    SeriesKey,
} from "../core/types.js"
import {
    CHART_TITLE,
    SINGLE_COLUMN_BREAKPOINT,
    SMALL_COUNTRIES_NOTE,
    TOLERANCE_NOTE,
    X_VARS,
    Y_VARS,
} from "../core/constants.js"
import { IndexDropdown } from "../components/IndexDropdown.js"
import { CountryPicker } from "../components/CountryPicker.js"
import { SettingsMenu } from "../components/SettingsMenu.js"
import { Legend } from "../components/Legend.js"
import { Timeline } from "../components/Timeline.js"
import { Tooltip } from "../components/Tooltip.js"
import {
    AnimationRange,
    HoverContext,
    ScatterPanel,
} from "../components/ScatterPanel.js"

export function ScatterVariant({
    config,
    urls,
}: VariantProps<ScatterVariantConfig>): React.ReactElement {
    return (
        <EmbedConfigProvider config={config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <FetchingScatterVariant config={config} urls={urls} />
                </QueryClientProvider>
            </NuqsAdapter>
        </EmbedConfigProvider>
    )
}

function FetchingScatterVariant({
    config,
    urls,
}: VariantProps<ScatterVariantConfig>): React.ReactElement {
    const { data: feed, status } = useFeed(urls)
    if (status === "pending") return <ChartSkeleton className="dd-chart-box" />
    if (status === "error" || !feed)
        return <ChartError className="dd-chart-box" />
    return <ScatterChart feed={feed} config={config} />
}

/** Grapher's adaptive play speed: 4000 ms in total, clamped to 100-200 ms per year */
function msPerTick(nYears: number): number {
    return Math.min(200, Math.max(100, 4000 / Math.max(1, nYears)))
}

/** Room above and below the frame when it is scaled to the window */
const FIT_PADDING = 40

function ScatterChart({
    feed,
    config,
}: {
    feed: Feed
    config: ScatterVariantConfig & {
        urlSync: boolean
        hideMetadataModal: boolean
    }
}): React.ReactElement {
    // ---- Shareable state: the index, the year, the selection and the two settings ----
    const [xKey, setXKey] = useUrlState({
        key: "index",
        parser: parseAsStringEnum<IndexKey>([...INDEX_KEYS]),
        defaultValue: config.index ?? "libdem",
    })
    const [yearParam, setYearParam] = useUrlState({
        key: "year",
        parser: parseAsInteger,
        defaultValue: config.year ?? 0, // 0 = the latest well-covered year
    })
    const [countries, setCountries] = useUrlState<string[]>({
        key: "countries",
        parser: parseAsArrayOf(parseAsString),
        defaultValue: config.countries,
    })
    const [sizeByPopulation, setSizeByPopulation] = useUrlState({
        key: "bubbles",
        parser: parseAsBoolean,
        defaultValue: config.sizeByPopulation,
    })
    const [showSmallCountries, setShowSmallCountries] = useUrlState({
        key: "small",
        parser: parseAsBoolean,
        defaultValue: config.showSmallCountries,
    })

    // ---- Transient state ----
    const [hovered, setHovered] = useState<{
        eid: EntityId
        context: HoverContext
    } | null>(null)
    const [hoverContinent, setHoverContinent] = useState<string | null>(null)
    const [mutedContinents, setMutedContinents] = useState<ReadonlySet<string>>(
        () => new Set()
    )
    const [animation, setAnimation] = useState<AnimationRange | null>(null)

    // ---- Derived ----
    const years = useMemo(() => feed.yearsWithData(xKey), [feed, xKey])
    const year = useMemo(() => {
        if (yearParam && years.includes(yearParam)) return yearParam
        // A year the new index doesn't cover (the EIU index starts in 2006): the nearest one it does
        if (yearParam)
            return years.reduce((a, b) =>
                Math.abs(b - yearParam) < Math.abs(a - yearParam) ? b : a
            )
        return feed.defaultYear(xKey)
    }, [feed, xKey, yearParam, years])
    const selected = useMemo(
        () => selectedIds(feed, countries),
        [feed, countries]
    )
    const filters = useMemo(
        () => ({ mutedContinents, showSmallCountries }),
        [mutedContinents, showSmallCountries]
    )
    const maxPop = useMemo(
        () =>
            sizeByPopulation
                ? maxPopulation(feed, year, showSmallCountries)
                : 0,
        [feed, year, sizeByPopulation, showSmallCountries]
    )
    const x = X_VARS[xKey]

    const setYear = useCallback(
        (y: number) => {
            if (years.includes(y)) setYearParam(y)
        },
        [years, setYearParam]
    )
    const setSelected = useCallback(
        (ids: Set<EntityId>) =>
            setCountries([...ids].map((eid) => feed.entities[eid]).sort()),
        [feed, setCountries]
    )
    const toggleEntity = useCallback(
        (eid: EntityId) => {
            const next = new Set(selected)
            if (next.has(eid)) next.delete(eid)
            else next.add(eid)
            setSelected(next)
        },
        [selected, setSelected]
    )
    const onHover = useCallback(
        (eid: EntityId | null, context?: HoverContext) => {
            setHovered(eid === null || !context ? null : { eid, context })
        },
        []
    )

    // ---- Play: step through the years; the axes hold the whole range until play stops ----
    const yearRef = useRef(year)
    yearRef.current = year
    const stopPlaying = useCallback(() => setAnimation(null), [])
    const togglePlay = useCallback(() => {
        if (animation) {
            stopPlaying()
            return
        }
        const last = years[years.length - 1]
        const start = year === last ? years[0] : year
        if (start !== year) setYearParam(start)
        setAnimation({ start, end: last })
    }, [animation, stopPlaying, years, year, setYearParam])
    useEffect(() => {
        if (!animation) return
        const id = setInterval(() => {
            const i = years.indexOf(yearRef.current)
            if (i < 0 || i >= years.length - 1) {
                setAnimation(null)
                return
            }
            setYearParam(years[i + 1])
        }, msPerTick(years.length))
        return () => clearInterval(id)
    }, [animation, years, setYearParam])

    // A tooltip pinned to the bottom on touch goes away with a tap anywhere outside a plot.
    useEffect(() => {
        if (!hovered?.context.fixed) return
        const onTouch = (e: TouchEvent): void => {
            if (!e.composedPath().some((el) => el instanceof SVGSVGElement))
                setHovered(null)
        }
        document.addEventListener("touchstart", onTouch, { passive: true })
        return () => document.removeEventListener("touchstart", onTouch)
    }, [hovered])

    // ---- Fit to the screen: scale the frame down to the window's height, proportions kept ----
    const fitRef = useRef<HTMLDivElement>(null)
    const [fitScale, setFitScale] = useState(1)
    const [naturalHeight, setNaturalHeight] = useState(0)
    useEffect(() => {
        const el = fitRef.current
        if (!config.fitToScreen || !el) {
            setFitScale(1)
            return
        }
        const update = (): void => {
            const natural = el.offsetHeight // unaffected by the transform
            const twoColumns = el.offsetWidth > SINGLE_COLUMN_BREAKPOINT
            const k =
                twoColumns && natural > 0
                    ? Math.min(1, (window.innerHeight - FIT_PADDING) / natural)
                    : 1
            setFitScale(k)
            setNaturalHeight(natural)
        }
        const observer = new ResizeObserver(update)
        observer.observe(el)
        window.addEventListener("resize", update)
        update()
        return () => {
            observer.disconnect()
            window.removeEventListener("resize", update)
        }
    }, [config.fitToScreen])

    // ---- Text ----
    const title = config.title ?? CHART_TITLE
    const subtitle = config.subtitle ?? (
        <>
            {x.subtitle.pre}
            <strong>{x.subtitle.name}</strong>
            {x.subtitle.post}
        </>
    )
    const note = [
        TOLERANCE_NOTE,
        showSmallCountries ? "" : SMALL_COUNTRIES_NOTE,
    ]
        .filter(Boolean)
        .join(" ")
    const metadata = useMemo(() => buildBespokeMetadata(feed), [feed])

    return (
        <BespokeMetadataProvider metadata={metadata}>
            <div
                className={cx("democracy-development", {
                    "democracy-development--fit": config.fitToScreen,
                })}
                style={
                    fitScale < 1
                        ? { height: Math.ceil(naturalHeight * fitScale) }
                        : undefined
                }
            >
                <div
                    ref={fitRef}
                    className="democracy-development__fit"
                    style={
                        fitScale < 1
                            ? { transform: `scale(${fitScale})` }
                            : undefined
                    }
                >
                    <Frame className="democracy-development__frame">
                        <ChartHeader
                            title={
                                <>
                                    {title}
                                    <span className="dd-title-time">
                                        , {year}
                                    </span>
                                </>
                            }
                            subtitle={subtitle}
                        />
                        {!config.hideControls && (
                            <div className="controls__row dd-controls">
                                <IndexDropdown
                                    value={xKey}
                                    onChange={setXKey}
                                />
                                <CountryPicker
                                    feed={feed}
                                    xKey={xKey}
                                    year={year}
                                    showSmallCountries={showSmallCountries}
                                    selected={selected}
                                    onChange={setSelected}
                                />
                                <SettingsMenu
                                    sizeByPopulation={sizeByPopulation}
                                    showSmallCountries={showSmallCountries}
                                    onSizeByPopulation={setSizeByPopulation}
                                    onShowSmallCountries={setShowSmallCountries}
                                />
                            </div>
                        )}
                        <Legend
                            continents={feed.continents}
                            muted={mutedContinents}
                            onHover={setHoverContinent}
                            onToggle={(c) => {
                                const next = new Set(mutedContinents)
                                if (next.has(c)) next.delete(c)
                                else {
                                    next.add(c)
                                    // Muting the last continent would empty the chart; it clears the legend instead
                                    if (next.size === feed.continents.length)
                                        next.clear()
                                }
                                setMutedContinents(next)
                            }}
                            sizeByPopulation={sizeByPopulation}
                            maxPop={maxPop}
                        />
                        <div className="dd-grid">
                            {OUTCOME_KEYS.map((yKey) => (
                                <ScatterPanel
                                    key={yKey}
                                    feed={feed}
                                    xKey={xKey}
                                    yKey={yKey}
                                    year={year}
                                    years={years}
                                    animation={animation}
                                    filters={filters}
                                    selected={selected}
                                    hovered={hovered?.eid ?? null}
                                    hoverContinent={hoverContinent}
                                    sizeByPopulation={sizeByPopulation}
                                    maxPop={maxPop}
                                    scale={fitScale}
                                    onHover={onHover}
                                    onToggle={toggleEntity}
                                />
                            ))}
                        </div>
                        <div className="dd-x-axis-label">{x.axisLabel}</div>
                        <Timeline
                            years={years}
                            year={year}
                            isPlaying={animation !== null}
                            onChange={(y) => {
                                stopPlaying()
                                setYear(y)
                            }}
                            onTogglePlay={togglePlay}
                        />
                        <ChartFooter source={feed.source} note={note} />
                        {hovered && (
                            <Tooltip
                                feed={feed}
                                eid={hovered.eid}
                                xKey={xKey}
                                year={year}
                                context={hovered.context}
                                sizeByPopulation={sizeByPopulation}
                                frame={fitRef.current}
                                scale={fitScale}
                            />
                        )}
                    </Frame>
                </div>
            </div>
        </BespokeMetadataProvider>
    )
}

/** What "Learn more about this data" opens: the chart's method and every source's own origin */
function buildBespokeMetadata(feed: Feed): BespokeMetadata {
    const seen = new Set<string>()
    const origins: OwidOrigin[] = []
    const order: SeriesKey[] = [...INDEX_KEYS, ...OUTCOME_KEYS, "population"]
    for (const key of order) {
        for (const origin of feed.indicators[key]?.origins ?? []) {
            const id = `${origin.producer}|${origin.title}|${origin.datePublished}`
            if (seen.has(id)) continue
            seen.add(id)
            origins.push({
                producer: origin.producer,
                title: origin.title,
                attribution: origin.attribution,
                datePublished: origin.datePublished,
                dateAccessed: origin.dateAccessed,
                urlMain: origin.urlMain,
                citationFull: origin.citationFull,
            })
        }
    }
    const panels = OUTCOME_KEYS.map(
        (k) => `- **${Y_VARS[k].title}**: ${Y_VARS[k].unit}`
    ).join("\n")
    const indices = INDEX_KEYS.map(
        (k) => `- **${X_VARS[k].label}**: ${X_VARS[k].optionDesc}`
    ).join("\n")
    return {
        title: feed.title,
        descriptionShort:
            "Four measures of development against each country's score on a democracy index, in the same year. Each dot is a country.",
        descriptionKey: [
            "The horizontal axis is one of four democracy indices, switchable above the chart:",
            indices,
            "The four panels show:",
            panels,
            "Two measures are shown as their complements so that a higher value is better in every panel: children surviving to age 5 is 100% minus the child mortality rate, and people above the poverty line is 100% minus the share living on less than $10 a day.",
            "For the year shown, each country's democracy score is taken from that exact year. Its development measures are taken from the same year where available; otherwise the closest year within the indicator's tolerance (GDP and poverty: 5 years; expected years of schooling: 10 years; child mortality: 3 years) is used and marked in the tooltip.",
            "Each panel shades a triangle in its bottom-right corner and states what that empty corner means: a high democracy score combined with an outcome near the worst of that year. The triangle is drawn in a fixed position rather than fitted to each year's data, and its size is set per index against every year the index covers, so that the corner is empty or brushed only marginally.",
            "Only countries are shown; regions and historical entities are left out. Countries with fewer than 500,000 people are hidden unless the settings menu shows them.",
        ].join("\n\n"),
        origins,
        timespan: `${feed.yearRange.first}–${feed.yearRange.last}`,
    }
}
