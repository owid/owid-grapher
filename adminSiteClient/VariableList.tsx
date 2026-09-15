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
    /**
     * 0-1, from the analytics service. Not shown, but it is what a search is
     * ordered by — see `searchVariables`.
     */
    popularity?: number | null
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

/**
 * Relative column widths, turned into percentages over whatever columns a page
 * asks for. Percentages rather than pixels so the table always fills its
 * container exactly: at any window width it fits, with no sideways scrolling,
 * and no column collapses to nothing when the others no longer fit.
 */
const COLUMN_WEIGHTS: Record<VariableListField | "name", number> = {
    name: 28,
    namespace: 11,
    version: 8,
    dataset: 12,
    table: 11,
    shortName: 12,
    usage: 8,
    uploadedAt: 13,
}

function columnWidths(
    fields: VariableListField[]
): Record<VariableListField | "name", string> {
    const shown: (VariableListField | "name")[] = ["name", ...fields]
    const total = shown.reduce((sum, key) => sum + COLUMN_WEIGHTS[key], 0)
    return Object.fromEntries(
        shown.map((key) => [
            key,
            `${((COLUMN_WEIGHTS[key] / total) * 100).toFixed(2)}%`,
        ])
    ) as Record<VariableListField | "name", string>
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
    const width = columnWidths(fields)
    const columnsByField: Record<
        VariableListField,
        TableColumnsType<VariableListItem>[number]
    > = {
        namespace: {
            width: width.namespace,
            title: "Namespace",
            dataIndex: "namespace",
            key: "namespace",
            sorter:
                sortable &&
                ((a, b) =>
                    (a.namespace ?? "").localeCompare(b.namespace ?? "")),
        },
        version: {
            width: width.version,
            title: "Version",
            dataIndex: "version",
            key: "version",
            sorter:
                sortable &&
                ((a, b) => (a.version ?? "").localeCompare(b.version ?? "")),
        },
        dataset: {
            width: width.dataset,
            title: "Dataset",
            dataIndex: "dataset",
            key: "dataset",
            ellipsis: true,
            sorter:
                sortable &&
                ((a, b) => (a.dataset ?? "").localeCompare(b.dataset ?? "")),
        },
        table: {
            width: width.table,
            title: "Table",
            dataIndex: "table",
            key: "table",
            ellipsis: true,
            render: (table) => truncate(table),
        },
        shortName: {
            width: width.shortName,
            title: "Short name",
            dataIndex: "shortName",
            key: "shortName",
            ellipsis: true,
            render: (shortName) => truncate(shortName),
        },
        uploadedAt: {
            width: width.uploadedAt,
            title: "Uploaded",
            dataIndex: "uploadedAt",
            key: "uploadedAt",
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
            width: width.usage,
            title: "Usage",
            dataIndex: "usageCount",
            key: "usage",
            sorter:
                sortable &&
                ((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0)),
            render: (_, variable) => <UsageCell variable={variable} />,
        },
    }

    return [
        {
            width: width.name,
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
