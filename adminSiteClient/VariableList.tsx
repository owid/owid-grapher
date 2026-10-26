import * as React from "react"
import { useMemo } from "react"
import {
    Checkbox,
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
 * A dataset and the indicators shown under it. A page of one dataset's
 * indicators, or a host's own table, knows less about it than the grouped
 * search does.
 */
export type DatasetListGroup<Item extends VariableListItem = VariableListItem> =
    Pick<DatasetSearchGroup, "id" | "name"> &
        Partial<Omit<DatasetSearchGroup, "id" | "name" | "variables">> & {
            variables: Item[]
        }

/** Ticking indicators instead of following links, as a picker does. */
export interface IndicatorSelection<Item> {
    isSelected: (item: Item) => boolean
    onToggle: (item: Item) => void
    /** Runs a "more in this dataset" search in place */
    onNarrow: (search: string) => void
}

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
    /**
     * Let the browser size the columns to what is on the page, rather than
     * giving each a share of the table. Suits a list without the catalog path,
     * where the other columns are short; widths may shift between pages.
     */
    autoColumnWidths?: boolean
}

/**
 * What uses this indicator, naming each kind rather than counting the kinds
 * that are almost always zero. Hovering lists what they are.
 */
function UsageCell({
    variable,
    opensInNewTab,
}: {
    variable: VariableListItem
    /** In a picker, where following a link would leave unsaved work */
    opensInNewTab: boolean
}): React.ReactElement | null {
    // Unknown, as for a host table's column, which is not the same as unused
    if (variable.usageCount === undefined) return null
    const parts: {
        noun: string
        links: {
            key: number | string
            href: string
            label: string
            title?: string
        }[]
    }[] = [
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
                                                {...(opensInNewTab && {
                                                    target: "_blank",
                                                    rel: "noopener",
                                                })}
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
 * Relative column widths, turned into percentages over whatever columns a page
 * asks for. Percentages rather than pixels so the table always fills its
 * container exactly: at any window width it fits, with no sideways scrolling,
 * and no column collapses to nothing when the others no longer fit.
 *
 * The table is sticky, which defaults its layout to `fixed`, where a width is
 * a hard limit the browser never adjusts to the content. A list with
 * `autoColumnWidths` sets the layout to `auto` and these go unused.
 */
const COLUMN_WEIGHTS: Record<VariableListField | "name", number> = {
    name: 35,
    catalogPath: 35,
    table: 20,
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

function createColumns<Item extends VariableListItem>({
    fields,
    searchWords,
    sortable,
    selection,
    autoColumnWidths,
}: {
    fields: VariableListField[]
    searchWords: SearchWord[]
    sortable: boolean
    selection?: IndicatorSelection<Item>;
    autoColumnWidths: boolean
}): TableColumnsType<Item> {
    const shares = columnWidths(fields)
    // the catalog path keeps its share: it never wraps, so left to size itself
    // it would push the table wider than the page
    const width: Partial<Record<VariableListField | "name", string>> =
        autoColumnWidths ? { catalogPath: shares.catalogPath } : shares
    // left to size itself, a short column would otherwise wrap to give the
    // name more room
    const nowrap = autoColumnWidths ? "variable-list__nowrap" : undefined
    const highlight = highlightFunctionForSearchWords(searchWords)
    const pathHighlight = highlightFunctionForSearchWords(
        pathSearchWords(searchWords)
    )
    const columnsByField: Record<
        VariableListField,
        TableColumnsType<Item>[number]
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
            className: nowrap,
            sorter:
                sortable &&
                ((a, b) =>
                    (catalogTableOf(a.catalogPath) ?? "").localeCompare(
                        catalogTableOf(b.catalogPath) ?? ""
                    )),
            render: (_, variable) => {
                const table = catalogTableOf(variable.catalogPath)
                return table ? (
                    <span className="variable-list__table-name" title={table}>
                        {pathHighlight(table)}
                    </span>
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
            className: nowrap,
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
            className: autoColumnWidths
                ? "variable-list__nowrap variable-list__usage-column"
                : undefined,
            sorter:
                sortable &&
                ((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0)),
            render: (_, variable) => (
                <UsageCell variable={variable} opensInNewTab={!!selection} />
            ),
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
                <IndicatorCell
                    variable={variable}
                    highlight={highlight}
                    selection={selection}
                />
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
    autoColumnWidths = false,
}: VariableListProps): React.ReactElement {
    const columns = useMemo(
        () =>
            createColumns({ fields, searchWords, sortable, autoColumnWidths }),
        [fields, searchWords, sortable, autoColumnWidths]
    )

    return (
        <Table<VariableListItem>
            size="small"
            sticky
            tableLayout={autoColumnWidths ? "auto" : undefined}
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
    isLinked,
}: {
    group: DatasetListGroup
    highlight: SearchHighlighter
    isSearch: boolean
    isLinked: boolean
}): React.ReactElement {
    const path = [group.namespace, group.version, group.shortName]
        .filter(Boolean)
        .join("/")
    const name = <strong>{highlight(group.name)}</strong>
    const count =
        group.matchCount !== undefined &&
        plural(group.matchCount, isSearch ? "matching indicator" : "indicator")
    return (
        <Flex justify="space-between" align="baseline" gap="middle" wrap>
            <Flex align="baseline" gap="small" wrap>
                {isLinked ? (
                    <Link to={`/datasets/${group.id}`}>{name}</Link>
                ) : (
                    name
                )}
                {path && (
                    <Typography.Text type="secondary">{path}</Typography.Text>
                )}
            </Flex>
            <Typography.Text type="secondary">
                {count}
                {count && group.uploadedAt && " · "}
                {group.uploadedAt && (
                    <Timeago
                        time={group.uploadedAt}
                        by={group.uploadedBy ?? "Bulk import"}
                    />
                )}
            </Typography.Text>
        </Flex>
    )
}

/** The indicator's own cell: its name, linking to the indicator or ticking it. */
function IndicatorCell<Item extends VariableListItem>({
    variable,
    highlight,
    selection,
}: {
    variable: Item
    highlight: SearchHighlighter
    selection?: IndicatorSelection<Item>
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
            {selection ? (
                <Checkbox
                    checked={selection.isSelected(variable)}
                    onChange={() => selection.onToggle(variable)}
                    title={variable.catalogPath ?? undefined}
                >
                    {highlight(variable.name)}
                </Checkbox>
            ) : (
                <Link
                    to={`/variables/${variable.id}`}
                    title={variable.catalogPath ?? undefined}
                >
                    {highlight(variable.name)}
                </Link>
            )}
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
export function GroupedVariableList<
    Item extends VariableListItem = VariableListItem,
>({
    groups,
    isSearch,
    searchWords = NO_SEARCH_WORDS,
    searchValue,
    emptyHint,
    loading,
    pagination,
    selection,
}: {
    groups: DatasetListGroup<Item>[]
    /** Groups say "matching indicators" for a search, "indicators" otherwise. */
    isSearch: boolean
    searchWords?: SearchWord[]
    /** The query the groups came from, extended by the "more" links. */
    searchValue: string
    /** Shown under the message that nothing matches. */
    emptyHint?: React.ReactNode
    loading?: boolean
    /** Over the datasets, which is what the server pages through. */
    pagination: TableProps<DatasetListGroup<Item>>["pagination"]
    /**
     * Makes the list a picker: names tick rather than link, "more" narrows in
     * place, and the links left open in a new tab, so unsaved work stays
     */
    selection?: IndicatorSelection<Item>
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
                selection,
                autoColumnWidths: false,
            }),
        [searchWords, selection]
    )
    const groupColumns: TableColumnsType<DatasetListGroup<Item>> = useMemo(
        () => [
            {
                title: "Dataset",
                key: "dataset",
                render: (_, group) => (
                    <DatasetGroupHeader
                        group={group}
                        highlight={highlight}
                        isSearch={isSearch}
                        isLinked={!selection}
                    />
                ),
            },
        ],
        [highlight, isSearch, selection]
    )

    return (
        <Table<DatasetListGroup<Item>>
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
                expandedRowRender: (group) => {
                    const moreCount =
                        (group.matchCount ?? group.variables.length) -
                        group.variables.length
                    return (
                        <Table<Item>
                            size="small"
                            showHeader={false}
                            rowKey="id"
                            columns={indicatorColumns}
                            dataSource={group.variables}
                            pagination={false}
                            footer={
                                moreCount > 0
                                    ? () => (
                                          <MoreInDataset
                                              count={moreCount}
                                              // the dataset first: it's what
                                              // the link narrows to
                                              search={[
                                                  `dataset-id:${group.id}`,
                                                  searchValue.trim(),
                                              ]
                                                  .filter(Boolean)
                                                  .join(" ")}
                                              onNarrow={selection?.onNarrow}
                                          />
                                      )
                                    : undefined
                            }
                        />
                    )
                },
            }}
        />
    )
}

function MoreInDataset({
    count,
    search,
    onNarrow,
}: {
    count: number
    search: string
    onNarrow?: (search: string) => void
}): React.ReactElement {
    const label = <>{count} more in this dataset →</>
    return onNarrow ? (
        <Typography.Link onClick={() => onNarrow(search)}>
            {label}
        </Typography.Link>
    ) : (
        <Link to={searchHref(search)}>{label}</Link>
    )
}
