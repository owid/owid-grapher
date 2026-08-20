import { useContext } from "react"
import {
    Progress,
    Spin,
    Table,
    TableColumnsType,
    Tag,
    Tooltip,
    Typography,
} from "antd"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { SvgTesterSuiteOverview } from "@ourworldindata/types"
import { ENV } from "../settings/clientSettings.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import { SvgTesterRefreshedLabel } from "./SvgTesterRefreshedLabel.js"
import {
    DISPLAY_STATUS_LABELS,
    displayStatus,
    formatDuration,
    hasFindings,
    hasReportedResult,
    isUnderway,
    runProgress,
    SvgTesterDisplayStatus,
} from "./svgTesterHelpers.js"

/** How often to re-read the results files while the page is open */
const REFRESH_INTERVAL_MS = 10_000

/** antd Tag colours */
const DISPLAY_STATUS_COLORS: Record<SvgTesterDisplayStatus, string> = {
    "not-run": "default",
    unreadable: "warning",
    running: "processing",
    stalled: "warning",
    error: "error",
    differences: "processing",
    ok: "success",
}

export function SvgTesterIndexPage() {
    const { admin } = useContext(AdminAppContext)

    const { data, isLoading, isError, dataUpdatedAt } = useQuery({
        queryKey: ["svgtester-suites"],
        queryFn: () =>
            admin.requestJSON<{ suites: SvgTesterSuiteOverview[] }>(
                "/api/svgtester/suites.json",
                {},
                "GET",
                { onFailure: "continue", isBackground: true }
            ),
        refetchOnWindowFocus: true,
        // A hidden tab doesn't poll; refetchOnWindowFocus catches it up.
        refetchInterval: REFRESH_INTERVAL_MS,
    })

    const suites = data?.suites ?? []

    return (
        <AdminLayout title="SVG tester">
            <main className="SvgTesterIndexPage">
                <p className="SvgTesterIndexPage__intro">
                    Results of the last SVG tester run in this server&apos;s{" "}
                    <code>owid-grapher-svgs</code> checkout. Run a suite with{" "}
                    <code>make svgtest</code> locally, or let the{" "}
                    <code>SVG tester</code> Buildkite step write them on a
                    staging container.
                </p>
                <Spin spinning={isLoading}>
                    <Table
                        size="small"
                        columns={columns}
                        dataSource={suites}
                        rowKey={(status) => status.suite}
                        pagination={false}
                    />
                </Spin>
                <p className="SvgTesterIndexPage__refreshed">
                    <SvgTesterRefreshedLabel
                        isError={isError}
                        dataUpdatedAt={dataUpdatedAt}
                    />
                </p>
            </main>
        </AdminLayout>
    )
}

const columns: TableColumnsType<SvgTesterSuiteOverview> = [
    {
        title: "Suite",
        dataIndex: "suite",
        // A running suite is worth opening even before it has found anything:
        // that page follows the run.
        render: (suite: string, status) =>
            hasFindings(status) || isUnderway(status) ? (
                <Link to={`/svgtester/${suite}`}>{suite}</Link>
            ) : (
                suite
            ),
    },
    {
        title: "Status",
        render: (_, status) => <StatusTag status={status} />,
    },
    {
        title: "Differences",
        align: "right",
        render: (_, status) =>
            hasCounts(status)
                ? status.results!.counts.differences.toLocaleString()
                : "–",
    },
    {
        title: "Errors",
        align: "right",
        render: (_, status) => {
            if (!hasCounts(status)) return "–"
            const errors = status.results!.counts.errors
            if (!errors) return 0
            return (
                <Typography.Text type="danger">
                    {errors.toLocaleString()}
                </Typography.Text>
            )
        },
    },
    {
        title: "Charts",
        align: "right",
        // A run in flight counts off the views it has checked, so the row reads
        // as a report in progress rather than a finished one.
        render: (_, status) => {
            if (!hasCounts(status)) return "–"
            const progress = isUnderway(status)
                ? runProgress(status.results!)
                : undefined
            if (!progress) return status.results!.counts.total.toLocaleString()
            return (
                <span className="SvgTesterIndexPage__charts">
                    <Progress
                        className="SvgTesterIndexPage__progress"
                        percent={progress.percent}
                        size="small"
                        showInfo={false}
                    />
                    {progress.done.toLocaleString()} /{" "}
                    {progress.total.toLocaleString()}
                </span>
            )
        },
    },
    {
        title: "Ran",
        render: (_, status) => {
            const startedAt = status.results?.startedAt
            if (!startedAt) return "–"
            if (!hasReportedResult(status))
                return (
                    <>
                        started <Timeago time={startedAt} />
                    </>
                )
            return <Timeago time={startedAt} />
        },
    },
    {
        title: "Took",
        align: "right",
        render: (_, status) =>
            hasReportedResult(status)
                ? formatDuration(status.results!.durationMs)
                : "–",
    },
    {
        title: "Grapher commit",
        render: (_, status) => {
            const commit = status.results?.grapherCommit
            if (!commit) return "–"
            const short = <code>{commit.slice(0, 7)}</code>
            const link =
                ENV === "development" ? (
                    short
                ) : (
                    <a
                        href={`https://github.com/owid/owid-grapher/commit/${commit}`}
                        target="_blank"
                        rel="noopener"
                    >
                        {short}
                    </a>
                )
            return (
                <Tooltip title={status.grapherCommitSubject ?? commit}>
                    {link}
                </Tooltip>
            )
        },
    },
]

/** Whether the counts are worth printing: a run reports them as it goes */
function hasCounts(status: SvgTesterSuiteOverview): boolean {
    if (!status.results) return false
    return hasReportedResult(status) || status.results.counts.total > 0
}

function StatusTag({ status }: { status: SvgTesterSuiteOverview }) {
    const display = displayStatus(status)
    return (
        <span className="SvgTesterIndexPage__status">
            <Tag color={DISPLAY_STATUS_COLORS[display]}>
                {DISPLAY_STATUS_LABELS[display]}
            </Tag>
            {status.isStale && (
                <Tooltip title="These results describe a different grapher commit than the one checked out here. They are shown anyway, but re-run the suite to be sure.">
                    <Tag color="warning">Stale</Tag>
                </Tooltip>
            )}
        </span>
    )
}
