import { useContext, useEffect, useMemo, useState } from "react"
import {
    Alert,
    FloatButton,
    Progress,
    Segmented,
    Select,
    Space,
    Spin,
    Tag,
    Tooltip,
    Typography,
} from "antd"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"
import cx from "clsx"
import { useQuery } from "@tanstack/react-query"
import { Link, useHistory, useLocation, useParams } from "react-router-dom"
import * as _ from "lodash-es"
import {
    SVG_TESTER_PROGRESS_INTERVAL_MS,
    SvgTesterDirectory,
    SvgTesterSuiteOverview,
    SvgTesterSuiteStatus,
    SvgTesterVerifyDifferenceEntry,
    SvgTesterVerifyErrorEntry,
    SvgTesterVerifyRunSummary,
} from "@ourworldindata/types"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import { SvgTesterRefreshedLabel } from "./SvgTesterRefreshedLabel.js"
import {
    displayStatus,
    DISPLAY_STATUS_LABELS,
    formatDuration,
    hasFindings,
    hasReportedResult,
    isUnderway,
    runProgress,
} from "./svgTesterHelpers.js"
import pMap from "p-map"
import {
    compareSvgsVisually,
    encodeVerdicts,
    readVerdicts,
    VISUAL_DIFF_CONCURRENCY,
    type VisualVerdict,
    writeVerdicts,
} from "./svgVisualDiff.js"

const LIVE_URL = "https://ourworldindata.org"

type ViewMode = "side-by-side" | "swipe" | "overlay" | "diff" | "interactive"

const VIEW_MODE_OPTIONS: { label: string; value: ViewMode }[] = [
    { label: "Side by side", value: "side-by-side" },
    { label: "Swipe", value: "swipe" },
    { label: "Overlay", value: "overlay" },
    { label: "Diff", value: "diff" },
    { label: "Interactive", value: "interactive" },
]

const KIND_LABELS: Record<SvgTesterVerifyErrorEntry["kind"], string> = {
    timeout: "Timed out",
    render: "Failed to render",
}

const CHART_TYPE_PARAM = "chartType"

/** Ordered as the list shows them: what to review first comes first */
const VISUAL_VERDICT_LABELS: Record<VisualVerdict, string> = {
    changed: "Visible change",
    unknown: "Couldn't check",
    identical: "No visible change",
}

const VISUAL_VERDICTS = Object.keys(VISUAL_VERDICT_LABELS) as VisualVerdict[]

/** Which differences to list, once we know which ones only changed in markup */
type VisualFilter = VisualVerdict | "all"

const DEFAULT_VISUAL_FILTER: VisualFilter = "changed"

/** How many of a run's differences turned out to be markup-only */
interface VisualSummary {
    total: number
    /** Partial while the check is still going, empty before it starts */
    counts: Partial<Record<VisualVerdict, number>>
    remainingCount: number
    /** False while the check is still going, when the counts are partial */
    isComplete: boolean
}

/** How often to look for a new run when the last one has already reported */
const IDLE_REFRESH_INTERVAL_MS = 30_000

/** How often the countdown is allowed to move, out of thousands of answers */
const VISUAL_DIFF_PROGRESS_MS = 250

/**
 * How often the answers so far are written down. Rarer than the countdown: this
 * one touches storage, and its point is only that leaving mid-check shouldn't
 * cost minutes of work.
 */
const VISUAL_DIFF_SAVE_MS = 2_000

/** Stable identity, so holding results back doesn't itself rebuild the list */
const NO_VISUAL_RESULTS: Record<string, VisualVerdict> = {}

export function SvgTesterSuitePage() {
    const { admin } = useContext(AdminAppContext)
    const { suite } = useParams<{ suite: string }>()
    const location = useLocation()
    const history = useHistory()

    const chartType =
        new URLSearchParams(location.search).get(CHART_TYPE_PARAM) ?? "all"

    const setChartType = (value: string): void => {
        const params = new URLSearchParams(location.search)
        if (value === "all") params.delete(CHART_TYPE_PARAM)
        else params.set(CHART_TYPE_PARAM, value)
        history.replace({ search: params.toString(), hash: "" })
    }

    // Not in the URL, unlike the chart type: which differences render
    // identically is only known once this session has checked them
    const [visualFilter, setVisualFilter] = useState<VisualFilter>(
        DEFAULT_VISUAL_FILTER
    )

    const { data, isLoading, isError, dataUpdatedAt } = useQuery({
        queryKey: ["svgtester-results", suite],
        queryFn: () =>
            admin.requestJSON<SvgTesterSuiteStatus>(
                `/api/svgtester/${suite}/results.json`,
                {},
                "GET",
                { onFailure: "continue", isBackground: true }
            ),
        refetchOnWindowFocus: true,
        // Keep pace with a live run; once it has reported, the only thing left to
        // catch is the next run starting, which can wait.
        refetchInterval: (query) =>
            query.state.data && hasReportedResult(query.state.data)
                ? IDLE_REFRESH_INTERVAL_MS
                : SVG_TESTER_PROGRESS_INTERVAL_MS,
    })

    const results = data?.results

    // Deduplicated: the pipeline lists some views twice, and rows that are equal
    // collide on their React key. Remove once it stops emitting them.
    const differences = useMemo(
        () =>
            _.uniqBy(results?.differences ?? [], (entry) => entry.svgFilename),
        [results?.differences]
    )

    const chartTypeCounts = useMemo(
        () => _.countBy(differences, (entry) => entry.chartType ?? "Unknown"),
        [differences]
    )

    const visible = useMemo(
        () =>
            chartType === "all"
                ? differences
                : differences.filter(
                      (entry) => (entry.chartType ?? "Unknown") === chartType
                  ),
        [differences, chartType]
    )

    const isReported = data ? hasReportedResult(data) : false

    // Check visual differences once the run has reported
    const { verdictBySvg, remainingCount, isComplete } = useVisualDiffs(
        suite,
        differences,
        isReported ? results?.startedAt : undefined,
        {
            grapherCommit: results?.grapherCommit ?? null,
            svgsCommit: results?.svgsCommit ?? null,
        }
    )

    const applied = verdictBySvg ?? NO_VISUAL_RESULTS

    const grouped = useMemo(() => {
        const byVerdict = _.groupBy(
            visible,
            (entry) => applied[entry.svgFilename] ?? "changed"
        )
        return {
            changed: byVerdict.changed ?? [],
            unknown: byVerdict.unknown ?? [],
            identical: byVerdict.identical ?? [],
        }
    }, [visible, applied])

    const populatedVerdicts = VISUAL_VERDICTS.filter(
        (verdict) => grouped[verdict].length > 0
    )
    // Nothing to filter when every difference is in the same bucket
    const showVisualFilter = populatedVerdicts.length > 1

    const visualFilterOptions = [
        ...populatedVerdicts.map((verdict) => ({
            value: verdict,
            label: `${VISUAL_VERDICT_LABELS[verdict]} (${grouped[verdict].length.toLocaleString()})`,
        })),
        {
            value: "all" as const,
            label: `All (${visible.length.toLocaleString()})`,
        },
    ]

    // The selection sticks, so it can name a bucket since emptied
    const effectiveVisualFilter: VisualFilter = visualFilterOptions.some(
        (option) => option.value === visualFilter
    )
        ? visualFilter
        : "all"

    const shown = useMemo(
        () =>
            effectiveVisualFilter === "all"
                ? VISUAL_VERDICTS.flatMap((verdict) => grouped[verdict])
                : grouped[effectiveVisualFilter],
        [effectiveVisualFilter, grouped]
    )

    const cards = useMemo(
        () =>
            shown.map((entry) => (
                <DifferenceCard
                    key={anchorId(entry.viewId, entry.queryStr)}
                    suite={suite}
                    entry={entry}
                    verdict={applied[entry.svgFilename] ?? "changed"}
                />
            )),
        [shown, suite, applied]
    )

    const visualSummary = differences.length
        ? {
              total: differences.length,
              counts: _.countBy(Object.values(applied)) as Partial<
                  Record<VisualVerdict, number>
              >,
              remainingCount,
              isComplete,
          }
        : undefined

    const status = data ? displayStatus(data) : undefined

    // The browser jumps to the fragment before the cards it names exist: they
    // only render once the results have loaded.
    useEffect(() => {
        if (!location.hash) return
        document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }, [location.hash, differences])

    return (
        <AdminLayout title={pageTitle(suite, data)}>
            <main className="SvgTesterSuitePage">
                <div className="SvgTesterSuitePage__nav">
                    <Link to="/svgtester">← All suites</Link>
                </div>

                <Spin spinning={isLoading}>
                    {data && (
                        <div className="SvgTesterSuitePage__summary">
                            <div className="SvgTesterSuitePage__headline-row">
                                <div className="SvgTesterSuitePage__headline">
                                    <SuiteHeadline
                                        status={data}
                                        visual={visualSummary}
                                    />
                                </div>
                                <SuiteSwitcher currentSuite={suite} />
                            </div>
                            {results && (
                                <div className="SvgTesterSuitePage__meta">
                                    {suite} ·{" "}
                                    {isReported ? (
                                        <>
                                            ran{" "}
                                            <Timeago time={results.startedAt} />{" "}
                                            in{" "}
                                            {formatDuration(results.durationMs)}
                                        </>
                                    ) : (
                                        <>
                                            started{" "}
                                            <Timeago time={results.startedAt} />
                                        </>
                                    )}
                                    {results.grapherCommit && (
                                        <>
                                            {" · "}
                                            <CommitLabel
                                                commit={results.grapherCommit}
                                                subject={
                                                    data.grapherCommitSubject
                                                }
                                                isStale={data.isStale}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                            {results && !isReported && (
                                <SuiteRunProgress
                                    results={results}
                                    isStalled={status === "stalled"}
                                />
                            )}
                        </div>
                    )}

                    {results && <SvgTesterErrors errors={results.errors} />}

                    {status &&
                        isReported &&
                        !differences.length &&
                        !results?.errors.length && (
                            <Alert
                                type="info"
                                showIcon
                                title={DISPLAY_STATUS_LABELS[status]}
                                description="There is nothing to compare for this suite."
                            />
                        )}

                    {!!differences.length && (
                        <>
                            <div className="SvgTesterSuitePage__controls">
                                <Space size="middle" align="center" wrap>
                                    <Select
                                        value={chartType}
                                        onChange={setChartType}
                                        style={{ minWidth: 220 }}
                                        options={[
                                            {
                                                value: "all",
                                                label: `All chart types (${differences.length.toLocaleString()})`,
                                            },
                                            ..._.sortBy(
                                                Object.entries(chartTypeCounts),
                                                ([, count]) => -count
                                            ).map(([type, count]) => ({
                                                value: type,
                                                label: `${type} (${count.toLocaleString()})`,
                                            })),
                                        ]}
                                    />
                                    {showVisualFilter && (
                                        <Segmented<VisualFilter>
                                            value={effectiveVisualFilter}
                                            onChange={setVisualFilter}
                                            options={visualFilterOptions}
                                        />
                                    )}
                                    <Typography.Text type="secondary">
                                        Showing {shown.length.toLocaleString()}{" "}
                                        of {differences.length.toLocaleString()}
                                    </Typography.Text>
                                </Space>
                            </div>

                            {cards}
                        </>
                    )}
                </Spin>

                <p className="SvgTesterSuitePage__refreshed">
                    <SvgTesterRefreshedLabel
                        isError={isError}
                        dataUpdatedAt={dataUpdatedAt}
                    />
                </p>

                <FloatButton.BackTop duration={1} />
            </main>
        </AdminLayout>
    )
}

/** What the run has found, or how far it has got if it is still going */
function SuiteHeadline({
    status,
    visual,
}: {
    status: SvgTesterSuiteStatus
    visual: VisualSummary | undefined
}) {
    const results = status.results
    const display = displayStatus(status)

    if (results && hasReportedResult(status))
        return (
            <>
                <strong>{results.counts.differences.toLocaleString()}</strong>{" "}
                of {results.counts.total.toLocaleString()} charts rendered
                differently
                <VisualHeadlineClause visual={visual} />
                {results.counts.errors > 0 && (
                    <span className="SvgTesterSuitePage__errors">
                        {", "}
                        <strong>
                            {results.counts.errors.toLocaleString()}
                        </strong>{" "}
                        failed to render
                    </span>
                )}
            </>
        )

    const progress = results ? runProgress(results) : undefined
    if (!progress) return <>{DISPLAY_STATUS_LABELS[display]}</>

    return (
        <>
            {DISPLAY_STATUS_LABELS[display]} ·{" "}
            <strong>{progress.done.toLocaleString()}</strong> of{" "}
            {progress.total.toLocaleString()} charts checked
        </>
    )
}

/**
 * How many of the flagged charts actually look different. Markup can change
 * without moving a pixel, so this is the number that says how much there is to
 * review.
 */
function VisualHeadlineClause({
    visual,
}: {
    visual: VisualSummary | undefined
}) {
    if (!visual) return null

    if (!visual.isComplete)
        return (
            <span className="SvgTesterSuitePage__visual-note">
                {" · "}
                {visual.remainingCount > 0
                    ? `${visual.remainingCount.toLocaleString()} left to check for visible changes…`
                    : "rechecking what couldn't be checked…"}
            </span>
        )

    const changedCount = visual.counts.changed ?? 0
    const unknownCount = visual.counts.unknown ?? 0

    // "none changed visibly" would be a finding, and there isn't one to report
    if (unknownCount === visual.total)
        return (
            <span className="SvgTesterSuitePage__visual-note">
                {" — "}
                none could be checked for visible changes
            </span>
        )

    return (
        <>
            {" — "}
            {changedCount === visual.total ? (
                "all changed visibly"
            ) : changedCount ? (
                <>
                    only <strong>{changedCount.toLocaleString()}</strong>{" "}
                    changed visibly
                </>
            ) : (
                "none changed visibly"
            )}
            {unknownCount > 0 && (
                <span className="SvgTesterSuitePage__visual-note">
                    {", "}
                    {unknownCount.toLocaleString()} couldn't be checked
                </span>
            )}
        </>
    )
}

/** How a run that hasn't reported yet is getting on */
function SuiteRunProgress({
    results,
    isStalled,
}: {
    results: SvgTesterVerifyRunSummary
    isStalled: boolean
}) {
    const progress = runProgress(results)
    // Nothing to say yet: the run is still working out what it has to do, which
    // the headline already covers.
    if (!progress && !isStalled) return null

    const { differences, errors } = results.counts

    const parts = [
        `${differences.toLocaleString()} differences so far`,
        ...(errors > 0 ? [`${errors.toLocaleString()} failed to render`] : []),
    ]

    return (
        <div className="SvgTesterSuitePage__progress">
            {progress && (
                <Progress
                    percent={progress.percent}
                    status={isStalled ? "exception" : "active"}
                    size="small"
                />
            )}
            {progress && (
                <div className="SvgTesterSuitePage__progress-note">
                    <Typography.Text type="secondary">
                        {parts.join(" · ")}
                    </Typography.Text>
                </div>
            )}
            {isStalled && (
                <div className="SvgTesterSuitePage__progress-note">
                    <Typography.Text type="warning">
                        No progress since <Timeago time={results.updatedAt} /> —
                        the run was probably killed.
                    </Typography.Text>
                </div>
            )}
        </div>
    )
}

/** Jump between the suites that have something to look at */
function SuiteSwitcher({ currentSuite }: { currentSuite: string | undefined }) {
    const { admin } = useContext(AdminAppContext)

    const { data } = useQuery({
        queryKey: ["svgtester-suites"],
        queryFn: () =>
            admin.requestJSON<{ suites: SvgTesterSuiteOverview[] }>(
                "/api/svgtester/suites.json",
                {},
                "GET",
                { onFailure: "continue", isBackground: true }
            ),
        refetchOnWindowFocus: true,
        // Slower than the run it sits next to: these notes are a hint about the
        // other suites, and this route asks git about every one of them.
        refetchInterval: IDLE_REFRESH_INTERVAL_MS,
    })

    // The current suite stays listed even without findings, so the switcher
    // doesn't lose the page you are on.
    const suites = (data?.suites ?? []).filter(
        (status) =>
            hasFindings(status) ||
            isUnderway(status) ||
            status.suite === currentSuite
    )

    if (suites.length < 2) return null

    return (
        <nav className="SvgTesterSuitePage__suites" aria-label="Test suites">
            {suites.map((status) => {
                const note = suiteNote(status)
                return (
                    <Link
                        key={status.suite}
                        to={`/svgtester/${status.suite}`}
                        className={cx("SvgTesterSuitePage__suite", {
                            "is-active": status.suite === currentSuite,
                        })}
                        aria-current={
                            status.suite === currentSuite ? "page" : undefined
                        }
                    >
                        {status.suite}
                        {note && (
                            <span className="SvgTesterSuitePage__suite-note">
                                {note}
                            </span>
                        )}
                    </Link>
                )
            })}
        </nav>
    )
}

/**
 * What the other suites are up to, so a run in one doesn't hide what another
 * already found
 */
function suiteNote(status: SvgTesterSuiteOverview): string {
    if (isUnderway(status))
        return DISPLAY_STATUS_LABELS[displayStatus(status)].toLowerCase()
    const counts = status.results?.counts
    if (!counts) return ""
    const findings = counts.differences + counts.errors
    return findings ? findings.toLocaleString() : ""
}

function CommitLabel({
    commit,
    subject,
    isStale,
}: {
    commit: string
    subject: string | null | undefined
    isStale: boolean | undefined
}) {
    return (
        <>
            commit{" "}
            <Tooltip title={subject ?? commit}>
                <code className="SvgTesterSuitePage__commit">
                    {commit.slice(0, 7)}
                </code>
            </Tooltip>
            {isStale && " (stale)"}
        </>
    )
}

function DifferenceCard({
    suite,
    entry,
    verdict,
}: {
    suite: string
    entry: SvgTesterVerifyDifferenceEntry
    verdict: VisualVerdict
}) {
    const [mode, setMode] = useState<ViewMode>("side-by-side")
    const beforeUrl = svgUrl(suite, "references", entry)
    const afterUrl = svgUrl(suite, "differences", entry)
    const anchor = anchorId(entry.viewId, entry.queryStr)

    // A thumbnail is a 300x160 rendering of a chart; the live chart is the full
    // one, so there is nothing for an interactive view to compare against.
    const viewModes =
        suite === "thumbnails"
            ? VIEW_MODE_OPTIONS.filter((o) => o.value !== "interactive")
            : VIEW_MODE_OPTIONS

    return (
        <section className="SvgTesterSuitePage__card" id={anchor}>
            <header className="SvgTesterSuitePage__card-header">
                <span className="SvgTesterSuitePage__identity">
                    <a
                        className="SvgTesterSuitePage__anchor"
                        href={`#${anchor}`}
                        aria-label={`Link to ${entry.viewId}`}
                        title="Link to this chart"
                    >
                        #
                    </a>{" "}
                    <strong>{entry.viewId}</strong>
                    {entry.queryStr && (
                        <SvgTesterQueryParams queryStr={entry.queryStr} />
                    )}
                    {entry.chartType && (
                        <Tag className="SvgTesterSuitePage__chart-type">
                            {entry.chartType}
                        </Tag>
                    )}
                    {verdict !== "changed" && (
                        <Tag
                            className="SvgTesterSuitePage__chart-type"
                            title={
                                verdict === "unknown"
                                    ? "This chart's pixels can't be read — an embedded <foreignObject> taints the canvas — so it may not have changed at all"
                                    : undefined
                            }
                        >
                            {VISUAL_VERDICT_LABELS[verdict]}
                        </Tag>
                    )}
                </span>
                <SvgTesterChartLinks entry={entry} />
            </header>

            <div
                className="SvgTesterSuitePage__modes"
                role="group"
                aria-label="Comparison view"
            >
                {viewModes.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={cx("SvgTesterSuitePage__mode", {
                            "is-active": mode === option.value,
                        })}
                        aria-pressed={mode === option.value}
                        onClick={() => setMode(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {mode === "side-by-side" && (
                <div className="SvgTesterSuitePage__side-by-side">
                    <figure className="SvgTesterSuitePage__pane SvgTesterSuitePage__pane--before">
                        <figcaption>Reference</figcaption>
                        <a
                            href={`${LIVE_URL}/grapher/${chartPath(entry)}`}
                            target="_blank"
                            rel="noopener"
                            title="Open this chart on ourworldindata.org"
                        >
                            <img
                                src={beforeUrl}
                                alt="Reference"
                                loading="lazy"
                            />
                        </a>
                    </figure>
                    <figure className="SvgTesterSuitePage__pane SvgTesterSuitePage__pane--after">
                        <figcaption>Current</figcaption>
                        <a
                            href={`/grapher/${chartPath(entry)}`}
                            target="_blank"
                            rel="noopener"
                            title="Open this chart as this build renders it"
                        >
                            <img src={afterUrl} alt="Current" loading="lazy" />
                        </a>
                    </figure>
                </div>
            )}
            {mode === "swipe" && (
                <SvgTesterSlider beforeUrl={beforeUrl} afterUrl={afterUrl} />
            )}
            {mode === "overlay" && (
                <SvgTesterOverlay beforeUrl={beforeUrl} afterUrl={afterUrl} />
            )}
            {mode === "diff" && (
                <SvgTesterDiff beforeUrl={beforeUrl} afterUrl={afterUrl} />
            )}
            {mode === "interactive" && (
                <SvgTesterInteractive chartPath={chartPath(entry)} />
            )}
        </section>
    )
}

/** Charts that did not render at all */
function SvgTesterErrors({ errors }: { errors: SvgTesterVerifyErrorEntry[] }) {
    if (!errors.length) return null

    return (
        <section className="SvgTesterErrors">
            <h2 className="SvgTesterErrors__heading">
                {errors.length} {errors.length === 1 ? "chart" : "charts"} did
                not render
            </h2>
            <ul className="SvgTesterErrors__list">
                {errors.map((error) => (
                    <li
                        key={anchorId(error.viewId, error.queryStr)}
                        className="SvgTesterErrors__item"
                    >
                        <div className="SvgTesterErrors__view">
                            <span className="SvgTesterErrors__identity">
                                <strong>{error.viewId}</strong>
                                {error.queryStr && (
                                    <SvgTesterQueryParams
                                        queryStr={error.queryStr}
                                    />
                                )}
                                <span className="SvgTesterErrors__kind">
                                    {KIND_LABELS[error.kind]}
                                </span>
                            </span>
                            <SvgTesterChartLinks entry={error} />
                        </div>
                        <pre className="SvgTesterErrors__message">
                            {error.message}
                        </pre>
                    </li>
                ))}
            </ul>
        </section>
    )
}

function SvgTesterChartLinks({
    entry,
}: {
    entry: { viewId: string; queryStr?: string }
}) {
    const path = chartPath(entry)

    return (
        <span className="SvgTesterChartLinks">
            Open chart:{" "}
            <a
                href={`${LIVE_URL}/grapher/${path}`}
                target="_blank"
                rel="noopener"
            >
                production
            </a>{" "}
            ·{" "}
            <a href={`/grapher/${path}`} target="_blank" rel="noopener">
                this build
            </a>
        </span>
    )
}

function SvgTesterQueryParams({ queryStr }: { queryStr: string }) {
    const decoded = [...new URLSearchParams(queryStr)]
        .map(([key, value]) => `${key}=${value}`)
        .join("&")

    return (
        <code className="SvgTesterQueryParams" title={queryStr}>
            ?{decoded}
        </code>
    )
}

/** Before/after swipe comparison */
function SvgTesterSlider({
    beforeUrl,
    afterUrl,
}: {
    beforeUrl: string
    afterUrl: string
}) {
    const [position, setPosition] = useState(50)

    return (
        <div
            className="SvgTesterSlider"
            style={{ "--position": `${position}%` } as React.CSSProperties}
        >
            <div className="SvgTesterSlider__images">
                <img src={beforeUrl} alt="Reference" loading="lazy" />
                <img
                    className="SvgTesterSlider__after"
                    src={afterUrl}
                    alt="Current"
                    loading="lazy"
                />
                <input
                    className="SvgTesterSlider__range"
                    type="range"
                    min={0}
                    max={100}
                    value={position}
                    aria-label="Reveal more of the current rendering"
                    onChange={(e) => setPosition(e.target.valueAsNumber)}
                />
                {/* Decorative: the input above it takes the pointer events. */}
                <div className="SvgTesterSlider__handle" aria-hidden="true" />
            </div>
        </div>
    )
}

/**
 * The two renderings stacked with a difference blend: identical pixels cancel
 * out and only changes survive
 */
function SvgTesterOverlay({
    beforeUrl,
    afterUrl,
}: {
    beforeUrl: string
    afterUrl: string
}) {
    return (
        // The frame is on the outer element and the inversion on the inner one:
        // a filter applies to everything it contains, so a border inside it
        // would come out inverted too.
        <div className="SvgTesterOverlay">
            <div className="SvgTesterOverlay__stack">
                <img src={beforeUrl} alt="Reference" loading="lazy" />
                <img
                    className="SvgTesterOverlay__difference"
                    src={afterUrl}
                    alt="Current, blended against the reference"
                    loading="lazy"
                />
            </div>
        </div>
    )
}

function SvgTesterDiff({
    beforeUrl,
    afterUrl,
}: {
    beforeUrl: string
    afterUrl: string
}) {
    // Only runs when the diff tab is opened, so the SVG text is not fetched for
    // every entry in a large report just to render its images.
    const { data, isLoading, error } = useQuery({
        queryKey: ["svgtester-diff", beforeUrl, afterUrl],
        queryFn: async () => {
            const [before, after] = await Promise.all([
                fetchText(beforeUrl),
                fetchText(afterUrl),
            ])
            return { before, after }
        },
        staleTime: Infinity,
    })

    if (isLoading) return <Spin />
    if (error || !data)
        return (
            <Alert
                type="error"
                showIcon
                title="Could not load the SVGs to diff"
                description={String(error)}
            />
        )

    return (
        <ReactDiffViewer
            oldValue={data.before}
            newValue={data.after}
            compareMethod={DiffMethod.WORDS_WITH_SPACE}
            splitView={true}
            showDiffOnly={true}
            extraLinesSurroundingDiff={3}
            styles={{ contentText: { wordBreak: "break-all" } }}
            highlightLanguage="svg"
        />
    )
}

/** The two interactive charts as iframes, side by side */
function SvgTesterInteractive({ chartPath }: { chartPath: string }) {
    return (
        <div className="SvgTesterInteractive">
            <figure className="SvgTesterInteractive__pane">
                <figcaption>Production</figcaption>
                <iframe
                    src={`${LIVE_URL}/grapher/${chartPath}`}
                    title="This chart on ourworldindata.org"
                    loading="lazy"
                />
            </figure>
            <figure className="SvgTesterInteractive__pane">
                <figcaption>This build</figcaption>
                <iframe
                    src={`/grapher/${chartPath}`}
                    title="This chart as this build renders it"
                    loading="lazy"
                />
            </figure>
        </div>
    )
}

/** Readable in a browser tab: which suite, and where it stands */
function pageTitle(
    suite: string | undefined,
    data: SvgTesterSuiteStatus | undefined
): string {
    const base = `SVG tester: ${suite}`
    if (!data) return base
    const display = displayStatus(data)
    if (display === "differences")
        return `${base} (${data.results!.counts.differences.toLocaleString()} differences)`
    return `${base} (${DISPLAY_STATUS_LABELS[display].toLowerCase()})`
}

/** Checks every difference for a real visual change */
function useVisualDiffs(
    suite: string | undefined,
    differences: SvgTesterVerifyDifferenceEntry[],
    runKey: string | undefined,
    commits: { grapherCommit: string | null; svgsCommit: string | null }
): {
    verdictBySvg: Record<string, VisualVerdict> | undefined
    remainingCount: number
    isComplete: boolean
} {
    const [verdictBySvg, setVerdictBySvg] =
        useState<Record<string, VisualVerdict>>()
    const [isComplete, setIsComplete] = useState(false)
    const [checkedCount, setCheckedCount] = useState(0)
    const [todoCount, setTodoCount] = useState(0)

    // Pulled out so the effect depends on the values rather than the object
    const { grapherCommit, svgsCommit } = commits

    useEffect(() => {
        setVerdictBySvg(undefined)
        setIsComplete(false)
        setCheckedCount(0)
        setTodoCount(0)
        if (!suite || !runKey || !differences.length) return

        const svgFilenames = differences.map((entry) => entry.svgFilename)

        // Whatever this run was already checked for, so a reopened report
        // doesn't rasterize thousands of pairs to reach the same answers
        const verdicts: Record<string, VisualVerdict> =
            readVerdicts(suite, runKey, svgFilenames) ?? {}

        // A stored "unknown" is worth asking about again: it says the pair
        // couldn't be read, not that it was read and found to differ
        const todo = differences.filter(
            (entry) =>
                !verdicts[entry.svgFilename] ||
                verdicts[entry.svgFilename] === "unknown"
        )

        // Shown straight away, so the report reads correctly while the rest of
        // the work goes on behind it. A copy, since `verdicts` goes on being
        // written to and state that mutates under React renders inconsistently.
        setVerdictBySvg({ ...verdicts })
        setTodoCount(todo.length)
        if (!todo.length) {
            setIsComplete(true)
            return
        }

        // Leaving the suite abandons whatever has not started: those answers are
        // for a report nobody is looking at any more.
        const abandon = new AbortController()
        let checked = 0
        // Thousands of answers, and only the countdown shows them arriving
        const publishProgress = _.throttle(
            () => setCheckedCount(checked),
            VISUAL_DIFF_PROGRESS_MS,
            { leading: false }
        )

        const saveVerdicts = (): void =>
            writeVerdicts(
                suite,
                encodeVerdicts({
                    runKey,
                    svgFilenames,
                    verdicts,
                    grapherCommit,
                    svgsCommit,
                })
            )
        const saveProgress = _.throttle(saveVerdicts, VISUAL_DIFF_SAVE_MS, {
            leading: false,
        })

        const check = async (
            entry: SvgTesterVerifyDifferenceEntry
        ): Promise<void> => {
            verdicts[entry.svgFilename] = await compareSvgsVisually(
                svgUrl(suite, "references", entry),
                svgUrl(suite, "differences", entry)
            )
        }
        const options = {
            concurrency: VISUAL_DIFF_CONCURRENCY,
            signal: abandon.signal,
        }

        void pMap(
            todo,
            async (entry) => {
                await check(entry)
                checked++
                publishProgress()
                saveProgress()
            },
            options
        )
            // Whatever couldn't be checked gets one more go once the rest has
            // drained. Nothing else will ask again: a run that has reported
            // keeps handing back the same results, so the check doesn't run
            // again until the page is reloaded.
            .then(() =>
                pMap(
                    todo.filter(
                        (entry) => verdicts[entry.svgFilename] === "unknown"
                    ),
                    check,
                    options
                )
            )
            .then(
                () => {
                    publishProgress.cancel()
                    saveProgress.cancel()
                    setVerdictBySvg({ ...verdicts })
                    setIsComplete(true)
                    saveVerdicts()
                },
                () => {
                    // Abandoned, so there is nothing to report
                }
            )

        return () => {
            publishProgress.cancel()
            saveProgress.cancel()
            // Leaving shouldn't cost the answers already in hand
            saveVerdicts()
            abandon.abort()
        }
    }, [suite, runKey, differences, grapherCommit, svgsCommit])

    return {
        verdictBySvg,
        remainingCount: todoCount - checkedCount,
        isComplete,
    }
}

function svgUrl(
    suite: string,
    kind: SvgTesterDirectory,
    entry: SvgTesterVerifyDifferenceEntry
): string {
    return `/admin/api/svgtester/${suite}/${kind}/${encodeURIComponent(entry.svgFilename)}`
}

function chartPath(entry: { viewId: string; queryStr?: string }): string {
    return entry.queryStr ? `${entry.viewId}?${entry.queryStr}` : entry.viewId
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} fetching ${url}`)
    return response.text()
}

function anchorId(viewId: string, queryStr?: string): string {
    const id = queryStr ? `${viewId}?${queryStr}` : viewId
    return encodeURIComponent(id)
}
