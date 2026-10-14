import * as React from "react"
import { useMemo } from "react"
import {
    Empty,
    Flex,
    Popover,
    Table,
    TableColumnsType,
    TablePaginationConfig,
    TableProps,
    Tooltip,
    Typography,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEyeSlash, faLock } from "@fortawesome/free-solid-svg-icons"

import { Link } from "./Link.js"
import { Timeago } from "./Forms.js"
import {
    buildRegexFromSearchWord,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import {
    catalogTableOf,
    parseCatalogPath,
    plural,
    SearchHighlighter,
    searchHref,
} from "./variableSearchQuery.js"
import {
    DatasetSearchGroup,
    VariableResultView,
} from "../adminShared/variableSearch.js"

/** Rows per page of the flat list. */
export const INDICATORS_PAGE_SIZE = 50

/**
 * An indicator as the list shows it. Only the name is always there: the
 * dataset and source pages hand it less than a search result carries.
 */
export type VariableListItem = Pick<VariableResultView, "id" | "name"> &
    Partial<VariableResultView>

/**
 * Columns beyond the always-present name, in the order they are shown. `table`
 * is the table segment of the catalog path on its own, for a list of one
 * dataset's indicators, where the rest of the path is the same on every row.
 */
export type VariableListField = "catalogPath" | "table" | "uploadedAt" | "usage"

interface VariableListProps {
    variables: VariableListItem[]
    fields: VariableListField[]
    /** Terms to highlight in the name and catalog path. */
    searchWords?: SearchWord[]
    loading?: boolean
    /**
     * Sorting sorts the rows the table was handed, so it is only meaningful
     * for a list that holds all of them — a server-paginated list would
     * silently sort the current page alone.
     */
    sortable?: boolean
    /** Over the defaults: a page of 50, with the size changer. */
    pagination?: TablePaginationConfig
}

interface UsagePart {
    noun: string
    links: {
        key: number | string
        href: string
        label: string
        title?: string
    }[]
}

/** The kinds of thing using the indicator, each with what they are. */
function usageParts(variable: VariableListItem): UsagePart[] {
    const parts: UsagePart[] = [
        {
            noun: "chart",
            links: (variable.charts ?? [])
                .toSorted((a, b) => (a.slug || "").localeCompare(b.slug || ""))
                .map((chart) => ({
                    key: chart.id,
                    href: `/admin/charts/${chart.id}/edit`,
                    label: chart.slug || `Chart #${chart.id}`,
                    title: chart.title || undefined,
                })),
        },
        {
            noun: "multi-dim",
            links: (variable.multiDims ?? []).map((multiDim) => ({
                key: multiDim.id,
                href: `/admin/multi-dims/${multiDim.id}`,
                label:
                    multiDim.slug ||
                    multiDim.title ||
                    `Multi-dim #${multiDim.id}`,
            })),
        },
        {
            noun: "explorer",
            links: (variable.explorerSlugs ?? []).map((slug) => ({
                key: slug,
                href: `/admin/explorers/${slug}`,
                label: slug,
            })),
        },
    ].filter((part) => part.links.length > 0)
    return parts
}

/** "1 chart · 1 multi-dim", as the cell shows it; for sizing its column. */
function usageLabel(variable: VariableListItem): string {
    return usageParts(variable)
        .map((part) => plural(part.links.length, part.noun))
        .join(" · ")
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
    const parts = usageParts(variable)

    return (
        <>
            {parts.length === 0 && <span className="text-muted">—</span>}
            {parts.map((part, index) => {
                const label = plural(part.links.length, part.noun)
                return (
                    <React.Fragment key={part.noun}>
                        {index > 0 && (
                            <span className="variable-list__usage-separator">
                                ·
                            </span>
                        )}
                        <Popover
                            title={label}
                            content={
                                <ul className="list-unstyled mb-0 variable-list__usage-popover">
                                    {part.links.map((link) => (
                                        <li key={link.key}>
                                            <a
                                                href={link.href}
                                                title={link.title}
                                            >
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            }
                        >
                            <span className="variable-list__usage-part">
                                {label}
                            </span>
                        </Popover>
                    </React.Fragment>
                )
            })}
            <PopularityCell popularity={variable.popularity} />
        </>
    )
}

/** A 0-1 score reads better against its neighbours than as a number. */
function PopularityCell({
    popularity,
}: {
    popularity: number | null | undefined
}): React.ReactElement | null {
    if (popularity === null || popularity === undefined) return null
    return (
        <Tooltip title={`Popularity ${popularity.toFixed(2)}`}>
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

/**
 * The catalog path, which is what the namespace / version / dataset / table /
 * short name columns were each showing a slice of. The dataset segment links
 * to the dataset, saving a hop through the indicator page.
 */
function CatalogPathCell({
    variable,
    highlight,
}: {
    variable: VariableListItem
    /** Built from `pathSearchWords`. */
    highlight: SearchHighlighter
}): React.ReactElement {
    const { catalogPath, datasetId } = variable
    if (!catalogPath) return <span className="text-muted">—</span>

    // `grapher/` is on every row, so it is only noise here
    const { namespace, version, dataset, table, shortName } =
        parseCatalogPath(catalogPath)

    const slash = <span className="variable-list__path-slash">/</span>

    return (
        <span className="variable-list__path" title={catalogPath}>
            <span className="variable-list__path-prefix">
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
            </span>
            {shortName && (
                <span className="variable-list__path-short">
                    #{highlight(shortName)}
                </span>
            )}
        </span>
    )
}

/**
 * Column widths. The table is sticky, which makes its layout `fixed`: a width
 * is a hard limit the browser never adjusts to the content, so columns have
 * to be sized up front.
 *
 * The name has no width and takes whatever the others leave, being the column
 * with the most to say. The catalog path and the upload date take a share of
 * the table. The table name and "Used in" are short, predictable text that
 * reads badly wrapped — "1 chart · 1 multi-dim · 1 explorer" over two lines
 * — so they are sized in pixels to the longest value among the rows, which
 * also keeps a column of six-letter table names from taking a third of the
 * table. The table name is capped, and ellipsised beyond the cap.
 */
const CATALOG_PATH_WIDTH = "35%"
const UPLOADED_AT_WIDTH = "14%"
// antd's 14px font averages about 7.5px a character; a cell has 8px of
// padding a side, and the header needs room for its sort arrows
const CHAR_WIDTH = 7.5
const CELL_PADDING = 16
const SORTER_WIDTH = 24
const MAX_TABLE_NAME_CHARS = 40
/** The popularity bar after the usage, from `.variable-list__popularity`. */
const POPULARITY_WIDTH = 62

function textColumnWidth(chars: number): number {
    return Math.ceil(chars * CHAR_WIDTH) + CELL_PADDING + SORTER_WIDTH
}

function longestLength(
    variables: VariableListItem[],
    text: (variable: VariableListItem) => string | undefined,
    atLeast: number
): number {
    // a loop rather than Math.max(...lengths): a dataset can have tens of
    // thousands of indicators, more than fit in a call's arguments
    let longest = atLeast
    for (const variable of variables) {
        longest = Math.max(longest, text(variable)?.length ?? 0)
    }
    return longest
}

function columnWidths(variables: VariableListItem[]): {
    name: undefined
    catalogPath: string
    uploadedAt: string
    table: number
    usage: number
} {
    const tableNameChars = longestLength(
        variables,
        (variable) => catalogTableOf(variable.catalogPath),
        "Table".length
    )
    const usageChars = longestLength(variables, usageLabel, "Used in".length)
    const hasPopularity = variables.some(
        (variable) =>
            variable.popularity !== null && variable.popularity !== undefined
    )
    return {
        name: undefined,
        catalogPath: CATALOG_PATH_WIDTH,
        uploadedAt: UPLOADED_AT_WIDTH,
        table: textColumnWidth(Math.min(tableNameChars, MAX_TABLE_NAME_CHARS)),
        usage:
            textColumnWidth(usageChars) +
            (hasPopularity ? POPULARITY_WIDTH : 0),
    }
}

function createColumns({
    fields,
    searchWords,
    sortable,
    variables,
}: {
    fields: VariableListField[]
    searchWords: SearchWord[]
    sortable: boolean
    /** The rows, which size the content-fitted columns. */
    variables: VariableListItem[]
}): TableColumnsType<VariableListItem> {
    const width = columnWidths(variables)
    const highlight = highlightFunctionForSearchWords(searchWords)
    const pathHighlight = highlightFunctionForSearchWords(
        pathSearchWords(searchWords)
    )
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
                    highlight={pathHighlight}
                />
            ),
        },
        table: {
            width: width.table,
            title: "Table",
            dataIndex: "catalogPath",
            key: "table",
            ellipsis: true,
            sorter:
                sortable &&
                ((a, b) =>
                    (catalogTableOf(a.catalogPath) ?? "").localeCompare(
                        catalogTableOf(b.catalogPath) ?? ""
                    )),
            render: (_, variable) => {
                const table = catalogTableOf(variable.catalogPath)
                return table ? (
                    <span title={table}>{pathHighlight(table)}</span>
                ) : (
                    <span className="text-muted">—</span>
                )
            },
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
    }

    return [
        {
            width: width.name,
            title: "Name",
            dataIndex: "name",
            key: "name",
            sorter: sortable && ((a, b) => a.name.localeCompare(b.name)),
            render: (_, variable) => (
                <IndicatorCell variable={variable} highlight={highlight} />
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
    loading,
    sortable = true,
    pagination,
}: VariableListProps): React.ReactElement {
    const columns = useMemo(
        () => createColumns({ fields, searchWords, sortable, variables }),
        [fields, searchWords, sortable, variables]
    )

    return (
        <Table<VariableListItem>
            size="small"
            sticky
            rowKey="id"
            columns={columns}
            dataSource={variables}
            loading={loading}
            pagination={{
                pageSize: INDICATORS_PAGE_SIZE,
                showSizeChanger: true,
                showTotal: (total, [from, to]) =>
                    `${from}-${to} of ${total} indicators`,
                ...pagination,
            }}
        />
    )
}

function DatasetGroupHeader({
    group,
    highlight,
    isSearch,
}: {
    group: DatasetSearchGroup
    highlight: SearchHighlighter
    isSearch: boolean
}): React.ReactElement {
    const path = [group.namespace, group.version, group.shortName]
        .filter(Boolean)
        .join("/")
    return (
        <Flex justify="space-between" align="baseline" gap="middle" wrap>
            <Flex align="baseline" gap="small" wrap>
                <Link to={`/datasets/${group.id}`}>
                    <strong>{highlight(group.name)}</strong>
                </Link>
                {path && (
                    <Typography.Text type="secondary">{path}</Typography.Text>
                )}
            </Flex>
            <Typography.Text type="secondary">
                {plural(
                    group.matchCount,
                    isSearch ? "matching indicator" : "indicator"
                )}
                {group.uploadedAt && (
                    <>
                        {" · "}
                        <Timeago
                            time={group.uploadedAt}
                            by={group.uploadedBy ?? "Bulk import"}
                        />
                    </>
                )}
            </Typography.Text>
        </Flex>
    )
}

/** The indicator's own cell: its name, linking to the indicator. */
function IndicatorCell({
    variable,
    highlight,
}: {
    variable: VariableListItem
    highlight: SearchHighlighter
}): React.ReactElement {
    return (
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
            <Link
                to={`/variables/${variable.id}`}
                title={variable.catalogPath ?? undefined}
            >
                {highlight(variable.name)}
            </Link>
        </>
    )
}

/**
 * Search results grouped by the dataset they belong to. A search matches far
 * more indicators than datasets — "road deaths" hits 831 across 12 — so the
 * datasets are the useful thing to page through, each showing its most-read
 * few and offering the rest as a narrower search.
 *
 * One row per dataset with its indicators in a table nested under it, as on
 * the multi-dim redirects page, but always shown: the indicators are what a
 * search is after, so there is nothing to expand.
 */
export function GroupedVariableList({
    groups,
    isSearch,
    searchWords = NO_SEARCH_WORDS,
    searchValue,
    emptyHint,
    loading,
    pagination,
}: {
    groups: DatasetSearchGroup[]
    /** Groups say "matching indicators" for a search, "indicators" otherwise. */
    isSearch: boolean
    searchWords?: SearchWord[]
    /** The query the groups came from, extended by the "more" links. */
    searchValue: string
    /** Shown under the message that nothing matches. */
    emptyHint?: React.ReactNode
    loading?: boolean
    /** Over the datasets, which is what the server pages through. */
    pagination: TableProps<DatasetSearchGroup>["pagination"]
}): React.ReactElement {
    const highlight = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )
    const indicatorColumns = useMemo(
        () =>
            createColumns({
                fields: ["usage"],
                searchWords,
                sortable: false,
                // sized over every group, so the nested tables line up
                variables: groups.flatMap((group) => group.variables),
            }),
        [searchWords, groups]
    )
    const groupColumns: TableColumnsType<DatasetSearchGroup> = useMemo(
        () => [
            {
                title: "Dataset",
                key: "dataset",
                render: (_, group) => (
                    <DatasetGroupHeader
                        group={group}
                        highlight={highlight}
                        isSearch={isSearch}
                    />
                ),
            },
        ],
        [highlight, isSearch]
    )

    return (
        <Table<DatasetSearchGroup>
            size="small"
            sticky
            rowKey="id"
            columns={groupColumns}
            dataSource={groups}
            loading={loading}
            pagination={pagination}
            locale={{
                emptyText: (
                    <Flex vertical gap="small">
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="No indicators match this search."
                        />
                        {emptyHint && (
                            <div className="variable-list__empty-hint">
                                {emptyHint}
                            </div>
                        )}
                    </Flex>
                ),
            }}
            expandable={{
                expandedRowKeys: groups.map((group) => group.id),
                showExpandColumn: false,
                expandedRowRender: (group) => (
                    <Table<VariableListItem>
                        size="small"
                        showHeader={false}
                        rowKey="id"
                        columns={indicatorColumns}
                        dataSource={group.variables}
                        pagination={false}
                        footer={
                            group.matchCount > group.variables.length
                                ? () => (
                                      <Link
                                          to={searchHref(
                                              // the dataset first: it's
                                              // what the link narrows to
                                              [
                                                  `dataset-id:${group.id}`,
                                                  searchValue.trim(),
                                              ]
                                                  .filter(Boolean)
                                                  .join(" ")
                                          )}
                                      >
                                          {group.matchCount -
                                              group.variables.length}{" "}
                                          more in this dataset →
                                      </Link>
                                  )
                                : undefined
                        }
                    />
                ),
            }}
        />
    )
}
