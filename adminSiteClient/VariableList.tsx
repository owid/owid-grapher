import * as React from "react"
import { useMemo } from "react"
import { Popover, TableColumnsType, TableProps, Tooltip } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEyeSlash, faLock } from "@fortawesome/free-solid-svg-icons"

import { Link } from "./Link.js"
import { Timeago } from "./Forms.js"
import { AdminTable, AdminTableSearch } from "./AdminTable.js"
import {
    buildRegexFromSearchWord,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import { SearchHighlighter } from "./adminTableHelpers.js"

export interface VariableListItem {
    id: number
    name: string
    catalogPath?: string
    datasetId?: number
    datasetName?: string
    uploadedAt?: Date
    uploadedBy?: string
    isPrivate?: boolean
    nonRedistributable?: boolean
    charts?: { id: number; slug: string | null; title: string | null }[]
    usageCount?: number
    multiDims?: { id: number; slug: string }[]
    explorerSlugs?: string[]
    /** 0-1, from the analytics service. Absent for indicators nobody reads. */
    popularity?: number | null
}

/** Columns beyond the always-present name, in the order they are shown. */
export type VariableListField =
    | "catalogPath"
    | "uploadedAt"
    | "usage"
    | "popularity"

export interface DatasetSearchGroup {
    id: number
    name: string
    namespace: string
    version: string | null
    shortName: string | null
    matchCount: number
    variables: VariableListItem[]
}

interface VariableListProps {
    variables: VariableListItem[]
    fields: VariableListField[]
    /** Terms to highlight in the name and catalog path. */
    searchWords?: SearchWord[]
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

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`
}

/**
 * What uses this indicator, naming each kind rather than counting the kinds
 * that are almost always zero. Hovering lists what they are.
 */
function UsageCell({
    variable,
}: {
    variable: VariableListItem
}): React.ReactElement {
    const charts = variable.charts ?? []
    const multiDims = variable.multiDims ?? []
    const explorerSlugs = variable.explorerSlugs ?? []

    const sortedCharts = charts.toSorted((a, b) =>
        (a.slug || "").localeCompare(b.slug || "")
    )

    const parts: { key: string; label: string; items: React.ReactNode }[] = []
    if (charts.length)
        parts.push({
            key: "charts",
            label: plural(charts.length, "chart"),
            items: sortedCharts.map((chart) => (
                <li key={chart.id}>
                    <a
                        href={`/admin/charts/${chart.id}/edit`}
                        title={chart.title || undefined}
                    >
                        {chart.slug || `Chart #${chart.id}`}
                    </a>
                </li>
            )),
        })
    if (multiDims.length)
        parts.push({
            key: "multiDims",
            label: plural(multiDims.length, "multi-dim"),
            items: multiDims.map((multiDim) => (
                <li key={multiDim.id}>
                    <a href={`/admin/multi-dims/${multiDim.id}`}>
                        {multiDim.slug}
                    </a>
                </li>
            )),
        })
    if (explorerSlugs.length)
        parts.push({
            key: "explorers",
            label: plural(explorerSlugs.length, "explorer"),
            items: explorerSlugs.map((slug) => (
                <li key={slug}>
                    <a href={`/admin/explorers/${slug}`}>{slug}</a>
                </li>
            )),
        })

    if (!parts.length) return <span className="text-muted">—</span>

    return (
        <>
            {parts.map((part, index) => (
                <React.Fragment key={part.key}>
                    {index > 0 && (
                        <span className="variable-list__usage-separator">
                            ·
                        </span>
                    )}
                    <Popover
                        title={part.label}
                        content={
                            <ul className="list-unstyled mb-0 variable-list__usage-popover">
                                {part.items}
                            </ul>
                        }
                    >
                        <span className="variable-list__usage-part">
                            {part.label}
                        </span>
                    </Popover>
                </React.Fragment>
            ))}
        </>
    )
}

/** A 0-1 score reads better against its neighbours than as a number. */
function PopularityCell({
    popularity,
}: {
    popularity: number | null | undefined
}): React.ReactElement {
    if (popularity === null || popularity === undefined)
        return <span className="text-muted">—</span>
    return (
        <Tooltip title={popularity.toFixed(2)}>
            <div className="variable-list__popularity">
                <div
                    className="variable-list__popularity-fill"
                    style={{ width: `${Math.round(popularity * 100)}%` }}
                />
            </div>
        </Tooltip>
    )
}

/**
 * The path is highlighted a segment at a time, so a term spanning a separator
 * — `ihme_gbd/2026-02-07`, the kind you get from pasting part of a path —
 * would match none of them. Splitting the term the same way the path is split
 * highlights every segment it covers.
 */
function pathSearchWords(searchWords: SearchWord[]): SearchWord[] {
    return searchWords.flatMap((searchWord) =>
        searchWord.word
            .split(/[/#]/)
            .filter(Boolean)
            .map((part) => ({
                ...searchWord,
                word: part,
                regex: buildRegexFromSearchWord(part),
            }))
    )
}

const SHORT_NAME_VISIBLE_LENGTH = 22

/**
 * Indicator short names run past 60 characters and what tells them apart sits
 * at the end, so cut the middle rather than the tail. When the search matched
 * inside the name, cut around the match instead, so what you searched for is
 * what you see.
 */
function elideShortName(shortName: string, searchWords: SearchWord[]): string {
    if (shortName.length <= SHORT_NAME_VISIBLE_LENGTH) return shortName

    const match = searchWords
        .filter((word) => !word.exclude)
        .map((word) => shortName.search(word.regex))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0]

    if (match === undefined)
        return `${shortName.slice(0, 11)}…${shortName.slice(-10)}`

    const start = Math.max(0, match - 6)
    const end = Math.min(shortName.length, start + SHORT_NAME_VISIBLE_LENGTH)
    return `${start > 0 ? "…" : ""}${shortName.slice(start, end)}${
        end < shortName.length ? "…" : ""
    }`
}

/**
 * The catalog path, which is what the namespace / version / dataset / table /
 * short name columns were each showing a slice of. The dataset segment links
 * to the dataset, saving a hop through the indicator page.
 */
function CatalogPathCell({
    variable,
    searchWords,
}: {
    variable: VariableListItem
    searchWords: SearchWord[]
}): React.ReactElement {
    const { catalogPath, datasetId } = variable
    if (!catalogPath) return <span className="text-muted">—</span>

    const words = pathSearchWords(searchWords)
    const highlight = highlightFunctionForSearchWords(words)

    // `grapher/` is on every row, so it is only noise here
    const [path, shortName] = catalogPath
        .replace(/^grapher\//, "")
        .split("#") as [string, string | undefined]
    const [namespace, version, dataset, ...rest] = path.split("/")
    const table = rest.join("/")

    const slash = <span className="variable-list__path-slash">/</span>

    return (
        <span className="variable-list__path" title={catalogPath}>
            {highlight(namespace)}
            {slash}
            {highlight(version)}
            {slash}
            {datasetId ? (
                <Link
                    to={`/datasets/${datasetId}`}
                    title={variable.datasetName}
                >
                    {highlight(dataset)}
                </Link>
            ) : (
                highlight(dataset)
            )}
            {table && (
                <>
                    {slash}
                    {highlight(table)}
                </>
            )}
            {shortName && (
                <span className="variable-list__path-short">
                    #{highlight(elideShortName(shortName, words))}
                </span>
            )}
        </span>
    )
}

/**
 * `table#short_name` — the tail a group header doesn't already show, with the
 * short name cut the same way the flat list cuts it.
 */
function catalogPathTail(
    catalogPath: string | undefined,
    searchWords: SearchWord[]
): string {
    if (!catalogPath) return ""
    const withoutPrefix = catalogPath.replace(/^grapher\//, "")
    const [path, shortName] = withoutPrefix.split("#")
    const table = path.split("/").slice(3).join("/")
    if (!shortName) return table
    return `${table}#${elideShortName(shortName, searchWords)}`
}

/**
 * Relative column widths, turned into percentages over whatever columns a page
 * asks for. Percentages rather than pixels so the table always fills its
 * container exactly: at any window width it fits, with no sideways scrolling,
 * and no column collapses to nothing when the others no longer fit.
 */
const COLUMN_WEIGHTS: Record<VariableListField | "name", number> = {
    name: 35,
    catalogPath: 35,
    // "3 charts" is what this says on almost every row; the rare row that also
    // names a multi-dim and an explorer wraps rather than taxing all the rest
    usage: 10,
    popularity: 7,
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
    searchWords,
    sortable,
}: {
    fields: VariableListField[]
    highlight: SearchHighlighter
    searchWords: SearchWord[]
    sortable: boolean
}): TableColumnsType<VariableListItem> {
    const width = columnWidths(fields)
    const columnsByField: Record<
        VariableListField,
        TableColumnsType<VariableListItem>[number]
    > = {
        catalogPath: {
            width: width.catalogPath,
            title: "Catalog path",
            dataIndex: "catalogPath",
            key: "catalogPath",
            sorter:
                sortable &&
                ((a, b) =>
                    (a.catalogPath ?? "").localeCompare(b.catalogPath ?? "")),
            render: (_, variable) => (
                <CatalogPathCell
                    variable={variable}
                    searchWords={searchWords}
                />
            ),
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
            title: "Used in",
            dataIndex: "usageCount",
            key: "usage",
            sorter:
                sortable &&
                ((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0)),
            render: (_, variable) => <UsageCell variable={variable} />,
        },
        popularity: {
            width: width.popularity,
            title: "Popularity",
            dataIndex: "popularity",
            key: "popularity",
            sorter:
                sortable &&
                ((a, b) => (a.popularity ?? 0) - (b.popularity ?? 0)),
            render: (popularity) => <PopularityCell popularity={popularity} />,
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
                        <Tooltip title="Non-redistributable — the data download is disabled on charts using it">
                            <FontAwesomeIcon
                                className="variable-list__flag"
                                icon={faLock}
                            />
                        </Tooltip>
                    ) : variable.isPrivate ? (
                        <Tooltip title="Unpublished — its dataset is private">
                            <FontAwesomeIcon
                                className="variable-list__flag"
                                icon={faEyeSlash}
                            />
                        </Tooltip>
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

const NO_SEARCH_WORDS: SearchWord[] = []

export function VariableList({
    variables,
    fields,
    searchWords = NO_SEARCH_WORDS,
    search,
    filters,
    loading,
    sortable = true,
    pagination,
}: VariableListProps): React.ReactElement {
    const columns = useMemo(() => {
        const highlight = highlightFunctionForSearchWords(searchWords)
        return createColumns({ fields, highlight, searchWords, sortable })
    }, [fields, searchWords, sortable])

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

type GroupedRow =
    | { kind: "dataset"; key: string; group: DatasetSearchGroup }
    | { kind: "indicator"; key: string; variable: VariableListItem }
    | { kind: "more"; key: string; group: DatasetSearchGroup }

function DatasetGroupHeader({
    group,
    highlight,
}: {
    group: DatasetSearchGroup
    highlight: SearchHighlighter
}): React.ReactElement {
    const path = [group.namespace, group.version, group.shortName]
        .filter(Boolean)
        .join("/")
    return (
        <div className="variable-list__group">
            <Link
                className="variable-list__group-name"
                to={`/datasets/${group.id}`}
            >
                {highlight(group.name)}
            </Link>
            <span className="variable-list__group-path">{path}</span>
            <span className="variable-list__group-count">
                {plural(group.matchCount, "matching indicator")}
            </span>
        </div>
    )
}

/**
 * Search results grouped by the dataset they belong to. A search matches far
 * more indicators than datasets — "road deaths" hits 831 across 12 — so the
 * datasets are the useful thing to page through, each showing its most-read
 * few and offering the rest as a narrower search.
 */
export function GroupedVariableList({
    groups,
    searchWords = NO_SEARCH_WORDS,
    searchValue,
    onSearchValue,
    search,
    loading,
    footer,
}: {
    groups: DatasetSearchGroup[]
    searchWords?: SearchWord[]
    /** The query the groups came from, extended by the "more" links. */
    searchValue: string
    onSearchValue: (value: string) => void
    search?: AdminTableSearch
    loading?: boolean
    footer?: React.ReactNode
}): React.ReactElement {
    const rows = useMemo(
        (): GroupedRow[] =>
            groups.flatMap((group) => [
                {
                    kind: "dataset" as const,
                    key: `d${group.id}`,
                    group,
                },
                ...group.variables.map((variable) => ({
                    kind: "indicator" as const,
                    key: `v${variable.id}`,
                    variable,
                })),
                ...(group.matchCount > group.variables.length
                    ? [
                          {
                              kind: "more" as const,
                              key: `m${group.id}`,
                              group,
                          },
                      ]
                    : []),
            ]),
        [groups]
    )

    const columns = useMemo((): TableColumnsType<GroupedRow> => {
        const highlight = highlightFunctionForSearchWords(searchWords)
        const pathWords = pathSearchWords(searchWords)
        const pathHighlight = highlightFunctionForSearchWords(pathWords)
        // A dataset header and a "more" link span the whole width
        const spanned = (row: GroupedRow) =>
            row.kind === "indicator" ? {} : { colSpan: 0 }

        return [
            {
                title: "Indicator",
                key: "name",
                width: "42%",
                onCell: (row) =>
                    row.kind === "indicator" ? {} : { colSpan: 4 },
                render: (_, row) => {
                    if (row.kind === "dataset")
                        return (
                            <DatasetGroupHeader
                                group={row.group}
                                highlight={highlight}
                            />
                        )
                    if (row.kind === "more") {
                        const { group } = row
                        const narrowed = `${searchValue} dataset:${group.shortName}`
                        return (
                            <button
                                type="button"
                                className="variable-list__group-more"
                                onClick={() => onSearchValue(narrowed)}
                            >
                                {group.matchCount - group.variables.length} more
                                in this dataset →
                            </button>
                        )
                    }
                    return (
                        <>
                            {row.variable.nonRedistributable ? (
                                <Tooltip title="Non-redistributable — the data download is disabled on charts using it">
                                    <FontAwesomeIcon
                                        className="variable-list__flag"
                                        icon={faLock}
                                    />
                                </Tooltip>
                            ) : row.variable.isPrivate ? (
                                <Tooltip title="Unpublished — its dataset is private">
                                    <FontAwesomeIcon
                                        className="variable-list__flag"
                                        icon={faEyeSlash}
                                    />
                                </Tooltip>
                            ) : null}
                            <Link to={`/variables/${row.variable.id}`}>
                                {highlight(row.variable.name)}
                            </Link>{" "}
                            <span
                                className="variable-list__path"
                                title={row.variable.catalogPath}
                            >
                                {pathHighlight(
                                    catalogPathTail(
                                        row.variable.catalogPath,
                                        pathWords
                                    )
                                )}
                            </span>
                        </>
                    )
                },
            },
            {
                title: "Used in",
                key: "usage",
                width: "16%",
                onCell: spanned,
                render: (_, row) =>
                    row.kind === "indicator" ? (
                        <UsageCell variable={row.variable} />
                    ) : null,
            },
            {
                title: "Popularity",
                key: "popularity",
                width: "10%",
                onCell: spanned,
                render: (_, row) =>
                    row.kind === "indicator" ? (
                        <PopularityCell popularity={row.variable.popularity} />
                    ) : null,
            },
            {
                title: "Uploaded",
                key: "uploadedAt",
                width: "16%",
                onCell: spanned,
                render: (_, row) =>
                    row.kind === "indicator" ? (
                        <Timeago
                            time={row.variable.uploadedAt}
                            by={row.variable.uploadedBy ?? "Bulk import"}
                        />
                    ) : null,
            },
        ]
    }, [searchWords, searchValue, onSearchValue])

    return (
        <>
            <AdminTable
                className="variable-list--grouped"
                columns={columns}
                dataSource={rows}
                rowKey="key"
                rowClassName={(row) => `variable-list__row--${row.kind}`}
                loading={loading}
                search={search}
                pagination={false}
            />
            {footer}
        </>
    )
}
