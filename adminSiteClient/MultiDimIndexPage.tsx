import * as React from "react"
import {
    useMutation,
    UseMutationResult,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useContext, useDeferredValue, useMemo, useState } from "react"
import {
    Button,
    Dropdown,
    Flex,
    Popconfirm,
    Space,
    Switch,
    Table,
    TableColumnsType,
    Tooltip,
    Typography,
    message,
    notification,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy, faPen, faTrashCan } from "@fortawesome/free-solid-svg-icons"
import cx from "clsx"
import urljoin from "url-join"
import { copyToClipboard, excludeUndefined, Json } from "@ourworldindata/utils"
import { Admin } from "./Admin.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.mjs"
import { Link } from "./Link.js"
import { ApiMultiDimOverview } from "../adminShared/AdminTypes.js"
import { highlightFunctionForSearchWords } from "../adminShared/search.js"
import {
    ChartSearchAccessors,
    ChartSearchFacet,
    chartSearchFilter,
    chartSearchWordsToHighlight,
    countNames,
} from "./chartSearchQuery.js"
import { ChartSearchToolbar } from "./ChartSearchToolbar.js"
import {
    CountCell,
    HeaderWithHelp,
    Highlighter,
    TimestampCell,
} from "./ChartListCells.js"
import { compareTimes, DESCEND_FIRST } from "./chartListSorting.js"
import { plural } from "./variableSearchQuery.js"
import { useSearchQueryParam } from "./useSearchQueryParam.js"

// Listed the way the charts are (ChartList.tsx), with the same cells and
// search, as a step towards one list of charts in which a multi-dim is a chart
// with dimensions.

type MultiDim = ApiMultiDimOverview

const DEFAULT_PAGE_SIZE = 50

// Every multi-dim comes from ETL and has no admin author, so the source and
// author filters would have nothing to tell apart
const MULTI_DIM_FACETS: readonly ChartSearchFacet[] = ["status", "tag"]

const MULTI_DIM_SEARCH: ChartSearchAccessors<MultiDim> = {
    text: (mdim) => [
        mdim.title,
        mdim.slug,
        mdim.catalogPath,
        `${mdim.id}`,
        ...mdim.dimensions,
        ...mdim.tags,
    ],
    isPublished: (mdim) => mdim.published,
    isEtl: () => true,
    isDrifted: () => false,
    tags: (mdim) => mdim.tags,
    authors: () => [],
}

const NO_AUTHORS: [] = []

type SlugMutation = UseMutationResult<
    MultiDim,
    unknown,
    { id: number; slug: string },
    unknown
>
type PublishMutation = UseMutationResult<
    MultiDim,
    unknown,
    { id: number; published: boolean },
    unknown
>
type DeleteMutation = UseMutationResult<void, unknown, number, unknown>

/**
 * Its thumbnail comes by slug, which works for a draft too: setting a slug
 * puts the config where the thumbnails are rendered from. A draft links to its
 * admin preview, which needs no slug.
 */
function PreviewCell({ mdim }: { mdim: MultiDim }): React.ReactElement {
    const [hasFailed, setHasFailed] = useState(false)
    const href =
        mdim.published && mdim.slug
            ? urljoin(BAKED_GRAPHER_URL, mdim.slug)
            : urljoin(
                  ADMIN_BASE_URL,
                  `/admin/grapher/${encodeURIComponent(mdim.catalogPath)}`
              )
    return (
        <a href={href} target="_blank" rel="noopener">
            {mdim.slug && !hasFailed ? (
                <img
                    src={urljoin(
                        GRAPHER_DYNAMIC_THUMBNAIL_URL,
                        `/${mdim.slug}.png`
                    )}
                    height={600}
                    width={850}
                    loading="lazy"
                    className={cx("chart-list__preview", {
                        "chart-list__preview--draft": !mdim.published,
                    })}
                    onError={() => setHasFailed(true)}
                />
            ) : (
                <span className="chart-list__preview chart-list__preview--empty">
                    Preview
                </span>
            )}
        </a>
    )
}

/** Its dimensions as a pill, where a chart shows its type, named on hover */
function DimensionsPill({
    dimensions,
}: {
    dimensions: string[]
}): React.ReactElement {
    return (
        <Tooltip
            title={
                dimensions.length > 0 ? (
                    <ul className="chart-list__dimension-names">
                        {dimensions.map((name) => (
                            <li key={name}>{name}</li>
                        ))}
                    </ul>
                ) : undefined
            }
        >
            <span className="chart-list__dimensions">
                {plural(dimensions.length, "dimension")}
            </span>
        </Tooltip>
    )
}

/** The slug, editable here since this list is where it is set */
function SlugField({
    mdim,
    slugMutation,
}: {
    mdim: MultiDim
    slugMutation: SlugMutation
}): React.ReactElement {
    const onChange = (value: string): void => {
        const slug = value.trim()
        if (slug && slug !== mdim.slug)
            slugMutation.mutate({ id: mdim.id, slug })
    }
    return (
        <div className="chart-list__slug-field">
            <span className="chart-list__slug-prefix">/grapher/</span>
            <Typography.Text
                className={cx({ "chart-list__no-slug": !mdim.slug })}
                editable={{
                    text: mdim.slug ?? "",
                    onChange,
                    tooltip: mdim.slug ? "Edit slug" : "Set a slug to publish",
                }}
                copyable={
                    mdim.published && mdim.slug
                        ? {
                              text: urljoin(BAKED_GRAPHER_URL, mdim.slug),
                              tooltips: ["Copy live URL", "Copied"],
                          }
                        : false
                }
            >
                {mdim.slug ?? "no slug yet"}
            </Typography.Text>
        </div>
    )
}

/**
 * Title with the draft flag, then id, dimensions and views, slug and tags.
 * Like a chart's slug, the catalog path isn't shown, to save room, but is
 * there on hovering the title, searchable, and in the Copy menu.
 * Drafts are greyed out, as in the chart list.
 */
function MultiDimCell({
    mdim,
    highlight,
    slugMutation,
}: {
    mdim: MultiDim
    highlight: Highlighter
    slugMutation: SlugMutation
}): React.ReactElement {
    const title = highlight(mdim.title)
    return (
        <div
            className={cx("chart-list__chart", {
                "chart-list__chart--draft": !mdim.published,
            })}
        >
            <div className="chart-list__title">
                {!mdim.published && (
                    <span className="chart-list__draft-label">Draft</span>
                )}
                {mdim.published && mdim.slug ? (
                    <a
                        href={urljoin(BAKED_GRAPHER_URL, mdim.slug)}
                        target="_blank"
                        rel="noopener"
                        title={mdim.catalogPath}
                    >
                        {title}
                    </a>
                ) : (
                    <span title={mdim.catalogPath}>{title}</span>
                )}
            </div>
            <div className="chart-list__meta">
                <span>#{highlight(`${mdim.id}`)}</span>
                <span className="chart-list__meta-separator">·</span>
                <DimensionsPill dimensions={mdim.dimensions} />
                <span className="chart-list__meta-separator">·</span>
                <Tooltip title="Each combination of dimension choices is a view, a chart of its own">
                    <span className="chart-list__header-help">
                        {plural(mdim.mdimViews, "view")}
                    </span>
                </Tooltip>
            </div>
            <SlugField mdim={mdim} slugMutation={slugMutation} />
            {mdim.tags.length > 0 && (
                // Set in its ETL config, so they're read here, not edited
                <div className="chart-list__tags">
                    {mdim.tags.map((tag) => (
                        <span key={tag} className="TagBadge">
                            <span className="TagBadge__name">{tag}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

type CopyOptionKey = "admin-url" | "live-url" | "catalog-path"

async function copyOption(mdim: MultiDim, key: CopyOptionKey): Promise<void> {
    const text =
        key === "admin-url"
            ? `[${mdim.title}](${ADMIN_BASE_URL}/admin/multi-dims/${mdim.id})`
            : key === "live-url"
              ? `[${mdim.title}](${urljoin(BAKED_GRAPHER_URL, mdim.slug ?? "")})`
              : mdim.catalogPath
    const ok = await copyToClipboard(text)
    if (!ok) void message.error("Couldn't copy to the clipboard")
    else if (key === "catalog-path") void message.success("Copied catalog path")
    else void message.success("Copied Markdown link")
}

function ActionsCell({
    mdim,
    deleteMutation,
}: {
    mdim: MultiDim
    deleteMutation: DeleteMutation
}): React.ReactElement {
    const linkOptions: { key: CopyOptionKey; label: string }[] =
        excludeUndefined([
            { key: "admin-url", label: "Admin URL" },
            mdim.published && mdim.slug
                ? { key: "live-url", label: "Live URL" }
                : undefined,
        ])
    const isDeleting =
        deleteMutation.isPending && deleteMutation.variables === mdim.id

    return (
        <div className="chart-list__actions">
            <Link to={`/multi-dims/${mdim.id}`}>
                <Button
                    type="primary"
                    size="small"
                    block
                    icon={<FontAwesomeIcon icon={faPen} />}
                >
                    Edit
                </Button>
            </Link>
            <div className="chart-list__secondary-actions">
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        items: [
                            {
                                type: "group",
                                label: "Copy as Markdown link",
                                children: linkOptions,
                            },
                            { type: "divider" },
                            { key: "catalog-path", label: "Copy catalog path" },
                        ],
                        onClick: (e) => {
                            void copyOption(mdim, e.key as CopyOptionKey)
                        },
                    }}
                >
                    <Tooltip title="Copy">
                        <Button
                            size="small"
                            aria-label="Copy"
                            icon={<FontAwesomeIcon icon={faCopy} />}
                        />
                    </Tooltip>
                </Dropdown>
                {mdim.published ? (
                    <Tooltip title="Unpublish it to delete it">
                        <Button
                            size="small"
                            danger
                            disabled
                            aria-label="Delete"
                            icon={<FontAwesomeIcon icon={faTrashCan} />}
                        />
                    </Tooltip>
                ) : (
                    <Popconfirm
                        title="Delete this multi-dim?"
                        description="This deletes it and its views from the database. Also remove its step from the ETL, or the next ETL run will recreate it."
                        onConfirm={() => deleteMutation.mutate(mdim.id)}
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        cancelText="Cancel"
                    >
                        <Tooltip title="Delete">
                            <Button
                                size="small"
                                danger
                                aria-label="Delete"
                                loading={isDeleting}
                                icon={<FontAwesomeIcon icon={faTrashCan} />}
                            />
                        </Tooltip>
                    </Popconfirm>
                )}
            </div>
        </div>
    )
}

function PublishedCell({
    mdim,
    publishMutation,
}: {
    mdim: MultiDim
    publishMutation: PublishMutation
}): React.ReactElement {
    const isUpdating =
        publishMutation.isPending && publishMutation.variables?.id === mdim.id
    return (
        <Popconfirm
            title={`Are you sure you want to ${mdim.published ? "unpublish" : "publish"} this page?`}
            onConfirm={() =>
                publishMutation.mutate({
                    id: mdim.id,
                    published: !mdim.published,
                })
            }
            okText="Yes"
            cancelText="No"
            disabled={!mdim.slug}
        >
            <Tooltip title={mdim.slug ? undefined : "Set a slug to publish"}>
                <Switch
                    size="small"
                    checked={mdim.published}
                    disabled={!mdim.slug || isUpdating}
                />
            </Tooltip>
        </Popconfirm>
    )
}

function createColumns({
    highlight,
    slugMutation,
    publishMutation,
    deleteMutation,
}: {
    highlight: Highlighter
    slugMutation: SlugMutation
    publishMutation: PublishMutation
    deleteMutation: DeleteMutation
}): TableColumnsType<MultiDim> {
    return [
        {
            key: "preview",
            width: 112,
            render: (_, mdim) => <PreviewCell mdim={mdim} />,
        },
        {
            title: "Multi-dim",
            key: "multiDim",
            render: (_, mdim) => (
                <MultiDimCell
                    mdim={mdim}
                    highlight={highlight}
                    slugMutation={slugMutation}
                />
            ),
        },
        {
            key: "actions",
            width: 100,
            render: (_, mdim) => (
                <ActionsCell mdim={mdim} deleteMutation={deleteMutation} />
            ),
        },
        {
            title: "Last updated",
            key: "updatedAt",
            sorter: (a, b) => compareTimes(a.updatedAt, b.updatedAt),
            sortDirections: DESCEND_FIRST,
            defaultSortOrder: "descend",
            render: (_, mdim) => <TimestampCell time={mdim.updatedAt} />,
        },
        {
            title: "Published",
            key: "published",
            align: "center",
            sorter: (a, b) => Number(a.published) - Number(b.published),
            sortDirections: DESCEND_FIRST,
            render: (_, mdim) => (
                <PublishedCell mdim={mdim} publishMutation={publishMutation} />
            ),
        },
        {
            title: (
                <HeaderWithHelp
                    title="Views/day"
                    help="Average daily views of the multi-dim's page over the last 365 days"
                />
            ),
            key: "viewsPerDay",
            align: "right",
            sorter: (a, b) => a.viewsPerDay - b.viewsPerDay,
            sortDirections: DESCEND_FIRST,
            render: (_, mdim) => <CountCell count={mdim.viewsPerDay} />,
        },
        {
            title: "Narrative charts",
            key: "narrativeChartsCount",
            align: "right",
            sorter: (a, b) => a.narrativeChartsCount - b.narrativeChartsCount,
            sortDirections: DESCEND_FIRST,
            render: (_, mdim) => (
                <CountCell count={mdim.narrativeChartsCount} />
            ),
        },
        {
            title: (
                <HeaderWithHelp
                    title="References"
                    help="Published Google Docs and static visualizations that link to it"
                />
            ),
            key: "referencesCount",
            align: "right",
            sorter: (a, b) => a.referencesCount - b.referencesCount,
            sortDirections: DESCEND_FIRST,
            render: (_, mdim) => <CountCell count={mdim.referencesCount} />,
        },
    ]
}

async function fetchMultiDims(admin: Admin): Promise<MultiDim[]> {
    const { multiDims } = await admin.getJSONInBackground<{
        multiDims: MultiDim[]
    }>("/api/multi-dims.json")
    return multiDims
}

async function patchMultiDim(
    admin: Admin,
    id: number,
    data: Json
): Promise<MultiDim> {
    const { multiDim } = await admin.requestJSON<{ multiDim: MultiDim }>(
        `/api/multi-dims/${id}`,
        data,
        "PATCH"
    )
    return multiDim
}

async function deleteMultiDim(admin: Admin, id: number): Promise<void> {
    await admin.requestJSON(`/api/multi-dims/${id}`, {}, "DELETE")
}

export function MultiDimIndexPage(): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [notificationApi, notificationContextHolder] =
        notification.useNotification()
    const queryClient = useQueryClient()

    const { data } = useQuery({
        queryKey: ["multiDims"],
        queryFn: () => fetchMultiDims(admin),
    })

    const publishMutation = useMutation({
        mutationFn: ({ id, published }: { id: number; published: boolean }) =>
            patchMultiDim(admin, id, { published }),
        onSuccess: async ({ published }) => {
            notificationApi.info({
                title: published ? "Published" : "Unpublished",
                description: <Link to="/deploys">Check deploy progress</Link>,
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({ queryKey: ["multiDims"] })
        },
    })

    const slugMutation = useMutation({
        mutationFn: ({ id, slug }: { id: number; slug: string }) =>
            patchMultiDim(admin, id, { slug }),
        onSuccess: async ({ published }) => {
            notificationApi.info({
                title: "Slug updated",
                description: published ? (
                    <Link to="/deploys">Check deploy progress</Link>
                ) : undefined,
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({ queryKey: ["multiDims"] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteMultiDim(admin, id),
        onSuccess: async () => {
            notificationApi.info({
                title: "Multi-dim deleted",
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({ queryKey: ["multiDims"] })
        },
    })

    const [searchValue, setSearchValue] = useSearchQueryParam()
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
    const onSearchChange = (value: string): void => {
        setSearchValue(value)
        setCurrentPage(1)
    }

    const rows = useMemo(() => data ?? [], [data])
    const tagCounts = useMemo(
        () => countNames(rows, (mdim) => mdim.tags),
        [rows]
    )

    // The list follows a step behind the search box, as on the charts page
    const query = useDeferredValue(searchValue)
    const filtered = useMemo(
        () =>
            query.trim()
                ? rows.filter(chartSearchFilter(query, rows, MULTI_DIM_SEARCH))
                : rows,
        [query, rows]
    )
    const columns = useMemo(
        () =>
            createColumns({
                highlight: highlightFunctionForSearchWords(
                    chartSearchWordsToHighlight(query).inText
                ),
                slugMutation,
                publishMutation,
                deleteMutation,
            }),
        [query, slugMutation, publishMutation, deleteMutation]
    )

    return (
        <AdminLayout title="Multidimensional Data Pages">
            {notificationContextHolder}
            <main className="chart-list">
                <Flex justify="space-between" align="start" gap={24}>
                    <ChartSearchToolbar
                        query={searchValue}
                        onQueryChange={onSearchChange}
                        tags={tagCounts}
                        authors={NO_AUTHORS}
                        facets={MULTI_DIM_FACETS}
                        placeholder="Search, or filter: tag:Energy is:draft"
                        searchedIn="the title, slug, catalog path, id, dimensions and tags"
                        autoFocus
                    />
                    <Space className="chart-list__page-links">
                        <a
                            href={urljoin(
                                ADMIN_BASE_URL,
                                "/admin/grapher/covid%2Flatest%2Fcovid%23dummy"
                            )}
                            target="_blank"
                            rel="noopener"
                        >
                            Example
                        </a>
                        <a
                            href="https://docs.owid.io/projects/etl/architecture/metadata/reference/collections/"
                            target="_blank"
                            rel="noopener"
                        >
                            Docs
                        </a>
                    </Space>
                </Flex>
                <Table<MultiDim>
                    size="small"
                    tableLayout="auto"
                    scroll={{ x: true }}
                    rowKey="id"
                    columns={columns}
                    dataSource={filtered}
                    loading={!data}
                    pagination={{
                        current: currentPage,
                        pageSize,
                        onChange: (page, size) => {
                            setCurrentPage(page)
                            setPageSize(size)
                        },
                        showSizeChanger: true,
                        pageSizeOptions: [25, 50, 100, 200],
                        placement: ["topStart", "bottomEnd"],
                        showTotal: (total, [from, to]) =>
                            `${from}–${to} of ${plural(total, "multi-dim")}` +
                            (query.trim()
                                ? ` (${rows.length.toLocaleString()} total)`
                                : ""),
                    }}
                />
            </main>
        </AdminLayout>
    )
}
