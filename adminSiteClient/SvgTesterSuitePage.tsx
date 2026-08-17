import { useContext, useEffect, useMemo, useState } from "react"
import {
    Alert,
    FloatButton,
    Progress,
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

/** How often to look for a new run when the last one has already reported */
const IDLE_REFRESH_INTERVAL_MS = 30_000

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
    const differences = useMemo(() => results?.differences ?? [], [results])

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

    const status = data ? displayStatus(data) : undefined

    const isReported = data ? hasReportedResult(data) : false

    // The browser jumps to the fragment before the cards it names exist: they
    // only render once the results have loaded.
    useEffect(() => {
        if (!location.hash) return
        document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }, [location.hash, results])

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
                                    <SuiteHeadline status={data} />
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
                                <Space size="middle" wrap>
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
                                    <Typography.Text type="secondary">
                                        Showing{" "}
                                        {visible.length.toLocaleString()} of{" "}
                                        {differences.length.toLocaleString()}
                                    </Typography.Text>
                                </Space>
                            </div>

                            {visible.map((entry) => (
                                <DifferenceCard
                                    key={anchorId(entry.viewId, entry.queryStr)}
                                    suite={suite}
                                    entry={entry}
                                />
                            ))}
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
function SuiteHeadline({ status }: { status: SvgTesterSuiteStatus }) {
    const results = status.results
    const display = displayStatus(status)

    if (results && hasReportedResult(status))
        return (
            <>
                <strong>{results.counts.differences.toLocaleString()}</strong>{" "}
                of {results.counts.total.toLocaleString()} charts rendered
                differently
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
}: {
    suite: string
    entry: SvgTesterVerifyDifferenceEntry
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
            // LINES, not the WORDS mode: word-granularity over a thousand lines of SVG markup is too slow
            compareMethod={DiffMethod.LINES}
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
