import { useContext, useEffect, useMemo, useState } from "react"
import {
    Alert,
    FloatButton,
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
    SvgTesterDirectory,
    SvgTesterSuiteOverview,
    SvgTesterSuiteStatus,
    SvgTesterVerifyDifferenceEntry,
    SvgTesterVerifyErrorEntry,
} from "@ourworldindata/types"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import {
    displayStatus,
    DISPLAY_STATUS_LABELS,
    formatDuration,
    hasFindings,
    hasReportedResult,
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

    const { data, isLoading } = useQuery({
        queryKey: ["svgtester-results", suite],
        queryFn: () =>
            admin.getJSON<SvgTesterSuiteStatus>(
                `/api/svgtester/${suite}/results.json`
            ),
        refetchOnWindowFocus: true,
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
        <AdminLayout title={`SVG tester: ${suite}`}>
            <main className="SvgTesterSuitePage">
                <div className="SvgTesterSuitePage__nav">
                    <Link to="/svgtester">← All suites</Link>
                </div>

                <Spin spinning={isLoading}>
                    {data && (
                        <div className="SvgTesterSuitePage__summary">
                            <div className="SvgTesterSuitePage__headline-row">
                                <div className="SvgTesterSuitePage__headline">
                                    {results && isReported ? (
                                        <>
                                            <strong>
                                                {results.counts.differences.toLocaleString()}
                                            </strong>{" "}
                                            of{" "}
                                            {results.counts.total.toLocaleString()}{" "}
                                            charts rendered differently
                                        </>
                                    ) : (
                                        status && DISPLAY_STATUS_LABELS[status]
                                    )}
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
                                    {results.counts.errors > 0 && (
                                        <>
                                            {" · "}
                                            <span className="SvgTesterSuitePage__errors">
                                                {results.counts.errors.toLocaleString()}{" "}
                                                failed to render
                                            </span>
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

                <FloatButton.BackTop duration={1} />
            </main>
        </AdminLayout>
    )
}

/** Jump between the suites that have something to look at */
function SuiteSwitcher({ currentSuite }: { currentSuite: string | undefined }) {
    const { admin } = useContext(AdminAppContext)

    const { data } = useQuery({
        queryKey: ["svgtester-suites"],
        queryFn: () =>
            admin.getJSON<{ suites: SvgTesterSuiteOverview[] }>(
                "/api/svgtester/suites.json"
            ),
    })

    // The current suite stays listed even without findings, so the switcher
    // doesn't lose the page you are on.
    const suites = (data?.suites ?? []).filter(
        (status) => hasFindings(status) || status.suite === currentSuite
    )

    if (suites.length < 2) return null

    return (
        <nav className="SvgTesterSuitePage__suites" aria-label="Test suites">
            {suites.map(({ suite }) => (
                <Link
                    key={suite}
                    to={`/svgtester/${suite}`}
                    className={cx("SvgTesterSuitePage__suite", {
                        "is-active": suite === currentSuite,
                    })}
                    aria-current={suite === currentSuite ? "page" : undefined}
                >
                    {suite}
                </Link>
            ))}
        </nav>
    )
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
                    {entry.queryStr && <code> ?{entry.queryStr}</code>}
                    {entry.chartType && (
                        <Tag className="SvgTesterSuitePage__chart-type">
                            {entry.chartType}
                        </Tag>
                    )}
                </span>
                <span className="SvgTesterSuitePage__links">
                    Open chart:{" "}
                    <a
                        href={`${LIVE_URL}/grapher/${chartPath(entry)}`}
                        target="_blank"
                        rel="noopener"
                    >
                        production
                    </a>{" "}
                    ·{" "}
                    <a
                        href={`/grapher/${chartPath(entry)}`}
                        target="_blank"
                        rel="noopener"
                    >
                        this build
                    </a>
                </span>
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
                    <li key={error.viewId} className="SvgTesterErrors__item">
                        <div className="SvgTesterErrors__view">
                            <a
                                className="SvgTesterErrors__slug"
                                href={`/grapher/${error.viewId}`}
                                target="_blank"
                                rel="noopener"
                                title="Open this chart as this build renders it"
                            >
                                {error.viewId}
                            </a>
                            <span className="SvgTesterErrors__kind">
                                {KIND_LABELS[error.kind]}
                            </span>
                            <a
                                className="SvgTesterErrors__production"
                                href={`${LIVE_URL}/grapher/${error.viewId}`}
                                target="_blank"
                                rel="noopener"
                            >
                                production
                            </a>
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

function svgUrl(
    suite: string,
    kind: SvgTesterDirectory,
    entry: SvgTesterVerifyDifferenceEntry
): string {
    return `/admin/api/svgtester/${suite}/${kind}/${encodeURIComponent(entry.svgFilename)}`
}

function chartPath(entry: SvgTesterVerifyDifferenceEntry): string {
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
