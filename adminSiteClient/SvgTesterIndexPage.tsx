import { useContext } from "react"
import { Spin, Table, TableColumnsType, Tag, Tooltip, Typography } from "antd"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { SvgTesterSuiteStatus } from "@ourworldindata/types"
import { ENV } from "../settings/clientSettings.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import {
    DISPLAY_STATUS_LABELS,
    displayStatus,
    formatDuration,
    hasFindings,
    hasReportedResult,
    SvgTesterDisplayStatus,
} from "./svgTesterHelpers.js"

/** antd Tag colours */
const DISPLAY_STATUS_COLORS: Record<SvgTesterDisplayStatus, string> = {
    "not-run": "default",
    unreadable: "warning",
    running: "warning",
    error: "error",
    differences: "processing",
    ok: "success",
}

export function SvgTesterIndexPage() {
    const { admin } = useContext(AdminAppContext)

    const { data, isLoading } = useQuery({
        queryKey: ["svgtester-suites"],
        queryFn: () =>
            admin.getJSON<{ suites: SvgTesterSuiteStatus[] }>(
                "/api/svgtester/suites.json"
            ),
        refetchOnWindowFocus: true,
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
            </main>
        </AdminLayout>
    )
}

const columns: TableColumnsType<SvgTesterSuiteStatus> = [
    {
        title: "Suite",
        dataIndex: "suite",
        render: (suite: string, status) =>
            hasFindings(status) ? (
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
            hasReportedResult(status)
                ? status.results!.counts.differences.toLocaleString()
                : "–",
    },
    {
        title: "Errors",
        align: "right",
        render: (_, status) => {
            if (!hasReportedResult(status)) return "–"
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
        render: (_, status) =>
            hasReportedResult(status)
                ? status.results!.counts.total.toLocaleString()
                : "–",
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

function StatusTag({ status }: { status: SvgTesterSuiteStatus }) {
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
