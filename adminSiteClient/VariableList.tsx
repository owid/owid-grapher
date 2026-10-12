import * as React from "react"
import { useContext, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    Alert,
    Button,
    Empty,
    Flex,
    Popover,
    Table,
    TableColumnsType,
    TableProps,
    Tooltip,
    Typography,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEyeSlash, faLock } from "@fortawesome/free-solid-svg-icons"

import { Link } from "./Link.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import {
    buildRegexFromSearchWord,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import {
    fieldedTerms,
    parseCatalogPath,
    plural,
    SearchHighlighter,
    searchHref,
    withoutTerms,
} from "./variableSearchQuery.js"
import {
    DatasetSearchGroup,
    VariableResultView,
    VariablesGroupedSearchResult,
} from "../adminShared/variableSearch.js"

/** Rows per page of the flat list. */
export const INDICATORS_PAGE_SIZE = 50

/**
 * An indicator as the list shows it. Only the name is always there: the
 * dataset and source pages hand it less than a search result carries.
 */
export type VariableListItem = Pick<VariableResultView, "id" | "name"> &
    Partial<VariableResultView>

/** Columns beyond the always-present name, in the order they are shown. */
export type VariableListField = "catalogPath" | "uploadedAt" | "usage"

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
    pagination?: TableProps<VariableListItem>["pagination"]
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
                        {multiDim.slug ||
                            multiDim.title ||
                            `Multi-dim #${multiDim.id}`}
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

    const popularity = <PopularityCell popularity={variable.popularity} />

    if (!parts.length)
        return (
            <>
                <span className="text-muted">—</span>
                {popularity}
            </>
        )

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
            {popularity}
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
    const columns = useMemo(() => {
        const highlight = highlightFunctionForSearchWords(searchWords)
        return createColumns({ fields, highlight, searchWords, sortable })
    }, [fields, searchWords, sortable])

    return (
        <Table<VariableListItem>
            size="small"
            sticky
            rowKey="id"
            columns={columns}
            dataSource={variables}
            loading={loading}
            pagination={
                pagination === false
                    ? false
                    : {
                          pageSize: INDICATORS_PAGE_SIZE,
                          showSizeChanger: true,
                          showTotal: (total, [from, to]) =>
                              `${from}-${to} of ${total} indicators`,
                          ...pagination,
                      }
            }
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

/**
 * A `field:value` term matches exactly and silently, so a search that mixes
 * one with free text can come back empty without saying which half is to
 * blame — `namespace:climate civil` finds nothing because "civil" lives in
 * `democracy`. Says how much the search finds without its fielded terms, and
 * offers to drop them.
 */
function EmptySearchHint({
    searchValue,
    onSearchValue,
}: {
    searchValue: string
    onSearchValue: (value: string) => void
}): React.ReactElement | null {
    const { admin } = useContext(AdminAppContext)

    const fielded = useMemo(() => fieldedTerms(searchValue), [searchValue])
    const widened = useMemo(
        () => withoutTerms(searchValue, fielded),
        [searchValue, fielded]
    )

    const { data } = useQuery({
        queryKey: ["variable-search-widened", widened],
        queryFn: () =>
            admin.getJSONInBackground<VariablesGroupedSearchResult>(
                "/api/variables.json",
                {
                    search: widened,
                    group: "dataset",
                    limit: 1,
                    offset: 0,
                }
            ),
        enabled: fielded.length > 0 && widened.trim().length > 0,
    })

    if (fielded.length === 0 || !data?.numTotalRows) return null

    return (
        <Alert
            type="info"
            showIcon
            title={
                <>
                    Nothing matches{" "}
                    {fielded.map((term) => (
                        <React.Fragment key={term}>
                            <code>{term}</code>{" "}
                        </React.Fragment>
                    ))}
                    — <b>{plural(data.numTotalRows, "indicator")}</b> in{" "}
                    {plural(data.numTotalDatasets, "dataset")} match the rest of
                    the search.
                </>
            }
            action={
                <Button size="small" onClick={() => onSearchValue(widened)}>
                    Search for {`“${widened}”`}
                </Button>
            }
        />
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
    onSearchValue,
    loading,
    pagination,
}: {
    groups: DatasetSearchGroup[]
    /** Groups say "matching indicators" for a search, "indicators" otherwise. */
    isSearch: boolean
    searchWords?: SearchWord[]
    /** The query the groups came from, extended by the "more" links. */
    searchValue: string
    onSearchValue: (value: string) => void
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
                highlight,
                searchWords,
                sortable: false,
            }),
        [highlight, searchWords]
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
                        <EmptySearchHint
                            searchValue={searchValue}
                            onSearchValue={onSearchValue}
                        />
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
