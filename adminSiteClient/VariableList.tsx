import * as React from "react"
import { useMemo } from "react"
import { Popover, TableColumnsType, TableProps } from "antd"

import { Link } from "./Link.js"
import { Timeago } from "./Forms.js"
import { AdminTable, AdminTableSearch } from "./AdminTable.js"
import { SearchHighlighter } from "./adminTableHelpers.js"

export interface VariableListItem {
    id: number
    name: string
    namespace?: string
    version?: string
    dataset?: string
    table?: string
    shortName?: string
    uploadedAt?: Date
    uploadedBy?: string
    isPrivate?: boolean
    nonRedistributable?: boolean
    charts?: { id: number; slug: string | null; title: string | null }[]
    usageCount?: number
    multiDims?: { id: number; slug: string }[]
    explorerSlugs?: string[]
}

/** Columns beyond the always-present name, in the order they are shown. */
export type VariableListField =
    | "namespace"
    | "version"
    | "dataset"
    | "table"
    | "shortName"
    | "uploadedAt"
    | "usage"

interface VariableListProps {
    variables: VariableListItem[]
    fields: VariableListField[]
    searchHighlight?: SearchHighlighter
    search?: AdminTableSearch
    /** Extra controls shown next to the search box. */
    filters?: React.ReactNode
    loading?: boolean
    /**
     * Sorting sorts the rows the table was handed, so it is only meaningful
     * for a list that holds all of them — a server-paginated list would
     * silently sort the current page alone.
     */
    sortable?: boolean
    pagination?: TableProps<VariableListItem>["pagination"]
}

/** Some tables and short names are very long, so truncate them. */
function truncate(text: string | undefined): string | undefined {
    if (text && text.length > 20) return text.substring(0, 20) + "..."
    return text
}

function UsageCount({
    count,
    label,
    suffix,
    children,
}: {
    count: number
    label: string
    suffix: string
    children?: React.ReactNode
}): React.ReactElement {
    const title = `Used in ${count} ${label}${count === 1 ? "" : "s"}`
    const text = `${count}${suffix}`
    if (count === 0) return <span title={title}>{text}</span>
    return (
        <Popover title={title} content={children}>
            <span
                style={{ cursor: "help" }}
                className="text-decoration-underline"
            >
                {text}
            </span>
        </Popover>
    )
}

function UsageCell({
    variable,
}: {
    variable: VariableListItem
}): React.ReactElement {
    const charts = variable.charts ?? []
    const multiDims = variable.multiDims ?? []
    const explorerSlugs = variable.explorerSlugs ?? []

    if (!variable.usageCount) return <span className="text-muted">—</span>

    const sortedCharts = charts.toSorted((a, b) =>
        (a.slug || "").localeCompare(b.slug || "")
    )

    return (
        <>
            {variable.usageCount} (
            <UsageCount count={charts.length} label="chart" suffix="C">
                <ul className="list-unstyled mb-0 variable-list__usage-popover">
                    {sortedCharts.map((chart) => (
                        <li key={chart.id}>
                            <a
                                href={`/admin/charts/${chart.id}/edit`}
                                title={chart.title || undefined}
                            >
                                {chart.slug || `Chart #${chart.id}`}
                            </a>
                        </li>
                    ))}
                </ul>
            </UsageCount>{" "}
            <UsageCount count={multiDims.length} label="multi-dim" suffix="M">
                <ul className="list-unstyled mb-0 variable-list__usage-popover">
                    {multiDims.map((multiDim) => (
                        <li key={multiDim.id}>
                            <a href={`/admin/multi-dims/${multiDim.id}`}>
                                {multiDim.slug}
                            </a>
                        </li>
                    ))}
                </ul>
            </UsageCount>{" "}
            <UsageCount
                count={explorerSlugs.length}
                label="path-based explorer"
                suffix="E"
            >
                <ul className="list-unstyled mb-0 variable-list__usage-popover">
                    {explorerSlugs.map((slug) => (
                        <li key={slug}>
                            <a href={`/admin/explorers/${slug}`}>{slug}</a>
                        </li>
                    ))}
                </ul>
            </UsageCount>
            )
        </>
    )
}

function createColumns({
    fields,
    highlight,
    sortable,
}: {
    fields: VariableListField[]
    highlight: SearchHighlighter
    sortable: boolean
}): TableColumnsType<VariableListItem> {
    const columnsByField: Record<
        VariableListField,
        TableColumnsType<VariableListItem>[number]
    > = {
        namespace: {
            title: "Namespace",
            dataIndex: "namespace",
            key: "namespace",
            width: 170,
            sorter:
                sortable &&
                ((a, b) =>
                    (a.namespace ?? "").localeCompare(b.namespace ?? "")),
        },
        version: {
            title: "Version",
            dataIndex: "version",
            key: "version",
            width: 110,
            sorter:
                sortable &&
                ((a, b) => (a.version ?? "").localeCompare(b.version ?? "")),
        },
        dataset: {
            title: "Dataset",
            dataIndex: "dataset",
            key: "dataset",
            sorter:
                sortable &&
                ((a, b) => (a.dataset ?? "").localeCompare(b.dataset ?? "")),
        },
        table: {
            title: "Table",
            dataIndex: "table",
            key: "table",
            render: (table) => truncate(table),
        },
        shortName: {
            title: "Short name",
            dataIndex: "shortName",
            key: "shortName",
            render: (shortName) => truncate(shortName),
        },
        uploadedAt: {
            title: "Uploaded",
            dataIndex: "uploadedAt",
            key: "uploadedAt",
            width: 200,
            sorter:
                sortable &&
                ((a, b) =>
                    new Date(a.uploadedAt ?? 0).getTime() -
                    new Date(b.uploadedAt ?? 0).getTime()),
            render: (uploadedAt, variable) => (
                <Timeago
                    time={uploadedAt}
                    by={variable.uploadedBy ?? "Bulk import"}
                />
            ),
        },
        usage: {
            title: "Usage",
            dataIndex: "usageCount",
            key: "usage",
            width: 140,
            sorter:
                sortable &&
                ((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0)),
            render: (_, variable) => <UsageCell variable={variable} />,
        },
    }

    return [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            sorter: sortable && ((a, b) => a.name.localeCompare(b.name)),
            render: (name, variable) => (
                <>
                    {variable.nonRedistributable ? (
                        <span className="text-secondary">
                            Non-redistributable:{" "}
                        </span>
                    ) : variable.isPrivate ? (
                        <span className="text-secondary">Unpublished: </span>
                    ) : null}
                    <Link to={`/variables/${variable.id}`}>
                        {highlight(name)}
                    </Link>
                </>
            ),
        },
        ...fields.map((field) => columnsByField[field]),
    ]
}

export function VariableList({
    variables,
    fields,
    searchHighlight,
    search,
    filters,
    loading,
    sortable = true,
    pagination,
}: VariableListProps): React.ReactElement {
    const columns = useMemo(() => {
        const highlight: SearchHighlighter =
            searchHighlight ?? ((text) => text ?? "")
        return createColumns({ fields, highlight, sortable })
    }, [fields, searchHighlight, sortable])

    return (
        <AdminTable
            columns={columns}
            dataSource={variables}
            loading={loading}
            search={search}
            filters={filters}
            entityName="indicators"
            pagination={pagination}
        />
    )
}
