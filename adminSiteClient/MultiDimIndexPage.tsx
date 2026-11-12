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
import { Admin } from "./Admin.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.mjs"
import { copyToClipboard, excludeUndefined, Json } from "@ourworldindata/utils"
import { Link } from "./Link.js"
import { highlightFunctionForSearchWords } from "../adminShared/search.js"
import {
    ChartSearchFacet,
    chartSearchFilter,
    chartSearchWordsToHighlight,
    countNames,
    SearchableChart,
} from "./chartSearchQuery.js"
import { ChartSearchToolbar } from "./ChartSearchToolbar.js"
import {
    CountCell,
    HeaderWithHelp,
    Highlighter,
    TimestampCell,
} from "./ChartList.js"
import { plural } from "./variableSearchQuery.js"
import { useSearchQueryParam } from "./useSearchQueryParam.js"

// Listed the way charts are (ChartList.tsx), with the same cells and search,
// as a step towards one list in which a multi-dim is a chart with dimensions

type ApiMultiDim = {
    id: number
    catalogPath: string
    title: string
    slug: string | null
    updatedAt: string
    published: boolean
    mdimViews: number
    /** The names of its dimensions */
    dimensions: string[]
    /** Its topic tags, as named in its ETL config */
    tags: string[]
    viewsPerDay: number
    narrativeChartsCount: number
    referencesCount: number
}

type MultiDim = Omit<ApiMultiDim, "updatedAt"> & {
    updatedAt: Date
}

type SlugMutation = UseMutationResult<
    MultiDim,
    unknown,
    { id: number; slug: string },
    unknown
>
type DeleteMutation = UseMutationResult<void, unknown, number, unknown>

/** Counts are most useful largest first */
const DESCEND_FIRST: ("descend" | "ascend")[] = ["descend", "ascend"]

/**
 * Its thumbnail comes by slug, which works for a draft too: setting a slug
 * puts the config where thumbnails are rendered from. A draft links to its
 * admin preview.
 */
function PreviewCell({ mdim }: { mdim: MultiDim }) {
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

/**
 * As a chart's cell: title with the draft flag, then id with its dimensions
 * (where a chart shows its type) and views, the slug and the tags. Like a
 * chart's slug, the catalog path is on hovering the title.
 */
function MultiDimCell({
    mdim,
    highlight,
    slugMutation,
}: {
    mdim: MultiDim
    highlight: Highlighter
    slugMutation: SlugMutation
}) {
    const title = highlight(mdim.title)
    return (
        <div
            className={cx("chart-list__chart", {
                "chart-list__chart--draft": !mdim.published,
            })}
        >
            <div className="chart-list__title" title={mdim.catalogPath}>
                {!mdim.published && (
                    <span className="chart-list__draft-label">Draft</span>
                )}
                {mdim.published && mdim.slug ? (
                    <a
                        href={urljoin(BAKED_GRAPHER_URL, mdim.slug)}
                        target="_blank"
                        rel="noopener"
                    >
                        {title}
                    </a>
                ) : (
                    title
                )}
            </div>
            <div className="chart-list__meta">
                <span>#{highlight(`${mdim.id}`)}</span>
                <span className="chart-list__meta-separator">·</span>
                <Tooltip title={mdim.dimensions.join(", ")}>
                    <span className="chart-list__dimensions">
                        {plural(mdim.dimensions.length, "dimension")}
                    </span>
                </Tooltip>
                <span className="chart-list__meta-separator">·</span>
                <span>{plural(mdim.mdimViews, "view")}</span>
            </div>
            <div className="chart-list__slug-field">
                <SlugField
                    id={mdim.id}
                    slug={mdim.slug}
                    slugMutation={slugMutation}
                />
            </div>
            {mdim.tags.length > 0 && (
                // Set in its ETL config, so shown, not edited
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

async function copyOption(mdim: MultiDim, key: CopyOptionKey) {
    const text =
        key === "admin-url"
            ? `[${mdim.title}](${ADMIN_BASE_URL}/admin/multi-dims/${mdim.id})`
            : key === "live-url"
              ? `[${mdim.title}](${urljoin(BAKED_GRAPHER_URL, mdim.slug ?? "")})`
              : mdim.catalogPath
    if (await copyToClipboard(text)) void message.success("Copied")
    else void message.error("Couldn't copy to the clipboard")
}

/** Edit over Copy and Delete, as for charts. Only a draft can be deleted. */
function ActionsCell({
    mdim,
    deleteMutation,
}: {
    mdim: MultiDim
    deleteMutation: DeleteMutation
}) {
    const deleteButton = (
        <Button
            size="small"
            danger
            disabled={mdim.published}
            aria-label="Delete"
            loading={
                deleteMutation.isPending && deleteMutation.variables === mdim.id
            }
            icon={<FontAwesomeIcon icon={faTrashCan} />}
        />
    )
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
                        items: excludeUndefined([
                            {
                                key: "admin-url",
                                label: "Admin URL as Markdown",
                            },
                            mdim.published && mdim.slug
                                ? {
                                      key: "live-url",
                                      label: "Live URL as Markdown",
                                  }
                                : undefined,
                            { key: "catalog-path", label: "Catalog path" },
                        ]),
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
                        {deleteButton}
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
                        <Tooltip title="Delete">{deleteButton}</Tooltip>
                    </Popconfirm>
                )}
            </div>
        </div>
    )
}

function SlugField({
    id,
    slug,
    slugMutation,
}: {
    id: number
    slug: string | null
    slugMutation: UseMutationResult<
        MultiDim,
        unknown,
        { id: number; slug: string },
        unknown
    >
}) {
    const copyable = slug
        ? {
              text: urljoin(BAKED_GRAPHER_URL, slug),
              tooltips: ["Copy live URL", "Copied"],
          }
        : undefined

    function handleOnChange(value: string) {
        if (value !== slug) slugMutation.mutate({ id, slug: value })
    }

    return (
        <Typography.Text
            copyable={copyable}
            editable={{ onChange: handleOnChange }}
        >
            {slug}
        </Typography.Text>
    )
}

function createColumns(
    slugMutation: UseMutationResult<
        MultiDim,
        unknown,
        { id: number; slug: string },
        unknown
    >,
    publishMutation: UseMutationResult<
        MultiDim,
        unknown,
        { id: number; published: boolean },
        unknown
    >,
    deleteMutation: UseMutationResult<void, unknown, number, unknown>,
    highlight: Highlighter
): TableColumnsType<MultiDim> {
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
            dataIndex: "updatedAt",
            key: "updatedAt",
            defaultSortOrder: "descend",
            sortDirections: DESCEND_FIRST,
            render: (updatedAt: Date) => (
                <TimestampCell time={updatedAt.toISOString()} />
            ),
            sorter: (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
        },
        {
            title: "Published",
            dataIndex: "published",
            key: "published",
            align: "center",
            render: (published, record) => (
                <Popconfirm
                    title={`Are you sure you want to ${published ? "unpublish" : "publish"} this page?`}
                    onConfirm={() =>
                        publishMutation.mutate({
                            id: record.id,
                            published: !published,
                        })
                    }
                    okText="Yes"
                    cancelText="No"
                >
                    <Switch
                        checked={published}
                        disabled={
                            !record.slug ||
                            (publishMutation.isPending &&
                                publishMutation.variables?.id === record.id)
                        }
                    />
                </Popconfirm>
            ),
            sorter: (a, b) => Number(b.published) - Number(a.published),
        },
        {
            title: (
                <HeaderWithHelp
                    title="Views/day"
                    help="Average daily views of its page over the last 365 days"
                />
            ),
            dataIndex: "viewsPerDay",
            key: "viewsPerDay",
            align: "right",
            sortDirections: DESCEND_FIRST,
            render: (count) => <CountCell count={count} />,
            sorter: (a, b) => a.viewsPerDay - b.viewsPerDay,
        },
        {
            title: "Narrative charts",
            dataIndex: "narrativeChartsCount",
            key: "narrativeChartsCount",
            align: "right",
            sortDirections: DESCEND_FIRST,
            render: (count) => <CountCell count={count} />,
            sorter: (a, b) => a.narrativeChartsCount - b.narrativeChartsCount,
        },
        {
            title: (
                <HeaderWithHelp
                    title="References"
                    help="Published Google Docs and static visualizations that link to it"
                />
            ),
            dataIndex: "referencesCount",
            key: "referencesCount",
            align: "right",
            sortDirections: DESCEND_FIRST,
            render: (count) => <CountCell count={count} />,
            sorter: (a, b) => a.referencesCount - b.referencesCount,
        },
    ]
}

function deserializeMultiDim(mdim: ApiMultiDim): MultiDim {
    return {
        ...mdim,
        updatedAt: new Date(mdim.updatedAt),
    }
}

async function fetchMultiDims(admin: Admin) {
    const { multiDims } = await admin.getJSONInBackground<{
        multiDims: ApiMultiDim[]
    }>("/api/multi-dims.json")
    return multiDims.map(deserializeMultiDim)
}

async function patchMultiDim(admin: Admin, id: number, data: Json) {
    const { multiDim } = await admin.requestJSON<{ multiDim: ApiMultiDim }>(
        `/api/multi-dims/${id}`,
        data,
        "PATCH"
    )
    return deserializeMultiDim(multiDim)
}

async function deleteMultiDim(admin: Admin, id: number): Promise<void> {
    await admin.requestJSON(`/api/multi-dims/${id}`, {}, "DELETE")
}

// Every multi-dim comes from ETL and has no admin author, so the search
// offers neither the source nor the author filter
const FACETS: readonly ChartSearchFacet[] = ["status", "tag"]

function searchableMultiDim(mdim: MultiDim): SearchableChart {
    return {
        text: [
            mdim.title,
            mdim.slug ?? undefined,
            mdim.catalogPath,
            `${mdim.id}`,
            ...mdim.dimensions,
            ...mdim.tags,
        ],
        isPublished: mdim.published,
        isEtl: true,
        isDrifted: false,
        tags: mdim.tags,
        authors: [],
    }
}

export function MultiDimIndexPage() {
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
    const [pageSize, setPageSize] = useState(50)
    const mdims = useMemo(() => data ?? [], [data])
    const tagCounts = useMemo(
        () => countNames(mdims, (mdim) => mdim.tags),
        [mdims]
    )
    // The table follows a step behind the search box, as for charts
    const query = useDeferredValue(searchValue)
    const filteredMdims = useMemo(
        () => mdims.filter(chartSearchFilter(query, mdims, searchableMultiDim)),
        [query, mdims]
    )
    const highlight = useMemo(
        () =>
            highlightFunctionForSearchWords(
                chartSearchWordsToHighlight(query).inText
            ),
        [query]
    )

    const columns = createColumns(
        slugMutation,
        publishMutation,
        deleteMutation,
        highlight
    )

    return (
        <AdminLayout title="Multidimensional Data Pages">
            {notificationContextHolder}
            <main className="chart-list">
                <Flex justify="space-between" align="start" gap={24}>
                    <ChartSearchToolbar
                        query={searchValue}
                        onQueryChange={(value) => {
                            setSearchValue(value)
                            setCurrentPage(1)
                        }}
                        tags={tagCounts}
                        authors={[]}
                        facets={FACETS}
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
                <Table
                    size="small"
                    tableLayout="auto"
                    scroll={{ x: true }}
                    columns={columns}
                    dataSource={filteredMdims}
                    rowKey={(x) => x.id}
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
                            (query.trim() ? ` (${mdims.length} total)` : ""),
                    }}
                />
            </main>
        </AdminLayout>
    )
}
