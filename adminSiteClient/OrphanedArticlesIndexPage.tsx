import { useContext } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Collapse, Empty, Progress, Table, Tag } from "antd"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import {
    OrphanedTopicArticle,
    TopicPageOrphanReport,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Admin } from "./Admin.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

async function fetchOrphans(admin: Admin): Promise<TopicPageOrphanReport[]> {
    return admin.getJSON<TopicPageOrphanReport[]>(
        "/api/gdocs/researchAndWritingOrphans"
    )
}

function coverageStatusColor(coveragePercent: number): string {
    if (coveragePercent >= 80) return "#3b8c4f"
    if (coveragePercent >= 50) return "#d99b00"
    return "#c0392b"
}

function OrphanTable({
    orphans,
}: {
    orphans: OrphanedTopicArticle[]
}): React.ReactElement {
    const columns: ColumnsType<OrphanedTopicArticle> = [
        {
            title: "Article",
            dataIndex: "title",
            key: "title",
            render: (_, orphan) => (
                <a
                    href={`${BAKED_BASE_URL}/${orphan.slug}`}
                    target="_blank"
                    rel="noopener"
                >
                    {orphan.title || orphan.slug}{" "}
                    <FontAwesomeIcon
                        icon={faArrowUpRightFromSquare}
                        size="sm"
                    />
                </a>
            ),
        },
        {
            title: "Authors",
            dataIndex: "authors",
            key: "authors",
            render: (_, orphan) => orphan.authors.join(", "),
        },
        {
            title: "Published",
            dataIndex: "publishedAt",
            key: "publishedAt",
            width: 140,
            render: (_, orphan) =>
                orphan.publishedAt
                    ? new Date(orphan.publishedAt).toLocaleDateString()
                    : "",
        },
        {
            title: "",
            key: "edit",
            width: 80,
            render: (_, orphan) => (
                <Link to={`/gdocs/${orphan.id}/preview`}>Edit</Link>
            ),
        },
    ]
    return (
        <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={orphans}
            columns={columns}
        />
    )
}

function topicPanelHeader(
    report: TopicPageOrphanReport
): React.ReactElement {
    return (
        <div className="OrphanedArticlesIndexPage__topic-header">
            <span className="OrphanedArticlesIndexPage__topic-name">
                {report.tagName}
            </span>
            <Tag color="error">{report.orphanedCount} orphaned</Tag>
            <Tag>{report.coveredCount} covered</Tag>
            <Progress
                percent={report.coveragePercent}
                size="small"
                strokeColor={coverageStatusColor(report.coveragePercent)}
                style={{ width: 160, marginLeft: "auto" }}
            />
        </div>
    )
}

export function OrphanedArticlesIndexPage(): React.ReactElement {
    const { admin } = useContext(AdminAppContext)

    const { data: reports, isLoading } = useQuery({
        queryKey: ["research-and-writing-orphans"],
        queryFn: () => fetchOrphans(admin),
    })

    const items = (reports ?? []).map((report) => ({
        key: report.gdocId,
        label: topicPanelHeader(report),
        extra: (
            <span
                className="OrphanedArticlesIndexPage__topic-links"
                // Stop the Collapse panel from toggling when clicking a link
                onClick={(e) => e.stopPropagation()}
            >
                <Link to={`/gdocs/${report.gdocId}/preview`}>
                    Edit topic page
                </Link>{" "}
                ·{" "}
                <a
                    href={`${BAKED_BASE_URL}/${report.slug}`}
                    target="_blank"
                    rel="noopener"
                >
                    View
                </a>
            </span>
        ),
        children: <OrphanTable orphans={report.orphans} />,
    }))

    return (
        <AdminLayout title="Orphaned articles">
            <main className="OrphanedArticlesIndexPage">
                <header>
                    <h2>Orphaned articles</h2>
                    <p>
                        Published articles that are tagged to a topic but are
                        not linked from that topic page&apos;s{" "}
                        <strong>research &amp; writing</strong> section.
                        Coverage is measured against the topic&apos;s tagged
                        articles. Topics with full coverage are omitted, and
                        topics are ordered by the number of orphaned articles.
                    </p>
                </header>
                {isLoading ? (
                    <p>Loading…</p>
                ) : items.length ? (
                    <Collapse items={items} />
                ) : (
                    <Empty description="Every topic page links to all of its tagged articles 🎉" />
                )}
            </main>
        </AdminLayout>
    )
}
