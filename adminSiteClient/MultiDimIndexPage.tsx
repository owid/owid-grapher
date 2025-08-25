import {
    useMutation,
    UseMutationResult,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useContext, useEffect, useMemo, useState } from "react"
import {
    Flex,
    Input,
    Popconfirm,
    Space,
    Switch,
    Table,
    TableColumnsType,
    Typography,
    notification,
} from "antd"
import { Admin } from "./Admin.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { dayjs, Json } from "@ourworldindata/utils"
import { Link } from "./Link.js"

type ApiMultiDim = {
    id: number
    catalogPath: string | null
    title: string
    slug: string | null
    updatedAt: string
    published: boolean
}

type MultiDim = Omit<ApiMultiDim, "updatedAt"> & {
    updatedAt: Date
}

function PreviewLink({
    slug,
    catalogPath,
}: {
    slug: string | null
    catalogPath: string | null
}) {
    const [status, setStatus] = useState<"loading" | "success" | "error">(
        "loading"
    )

    const content = (
        <>
            {slug ? (
                <>
                    {status !== "success" && (
                        <div className="multi-dim-preview">
                            {status === "loading"
                                ? "Loading image..."
                                : "Error loading image"}
                        </div>
                    )}
                    <img
                        className="multi-dim-preview-img"
                        style={{
                            display: status === "success" ? "block" : "none",
                        }}
                        src={urljoin(
                            GRAPHER_DYNAMIC_THUMBNAIL_URL,
                            `/${slug}.png?imHeight=400`
                        )}
                        alt=""
                        onLoad={() => setStatus("success")}
                        onError={() => setStatus("error")}
                    />
                </>
            ) : (
                <div className="multi-dim-preview">Preview</div>
            )}
        </>
    )

    if (catalogPath) {
        return (
            <a
                className="multi-dim-preview-link"
                target="_blank"
                rel="noopener"
                href={urljoin(
                    ADMIN_BASE_URL,
                    `/admin/grapher/${encodeURIComponent(catalogPath)}`
                )}
            >
                {content}
            </a>
        )
    }

    return content
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
    >
): TableColumnsType<MultiDim> {
    return [
        {
            title: "Preview",
            dataIndex: "thumbnailUrl",
            width: 100,
            key: "thumbnail",
            render: (_, record) => {
                return (
                    <PreviewLink
                        slug={record.slug}
                        catalogPath={record.catalogPath}
                    />
                )
            },
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            render: (text, record) =>
                record.published && record.slug ? (
                    <a
                        href={urljoin(BAKED_GRAPHER_URL, record.slug)}
                        target="_blank"
                        rel="noopener"
                    >
                        {text}
                    </a>
                ) : (
                    text
                ),
            sorter: (a, b) => a.title.localeCompare(b.title),
        },
        {
            title: "Catalog path",
            dataIndex: "catalogPath",
            key: "catalogPath",
            render: (catalogPath) =>
                catalogPath && (
                    <Typography.Text copyable>{catalogPath}</Typography.Text>
                ),
            sorter: (a, b) => {
                if (a.catalogPath === null) return 1
                if (b.catalogPath === null) return -1
                return a.catalogPath.localeCompare(b.catalogPath)
            },
        },
        {
            title: "Slug",
            dataIndex: "slug",
            key: "slug",
            render: (slug, { id }) => (
                <SlugField id={id} slug={slug} slugMutation={slugMutation} />
            ),
            sorter: (a, b) => {
                if (a.slug === null) return 1
                if (b.slug === null) return -1
                return a.slug.localeCompare(b.slug)
            },
        },
        {
            title: "Last updated",
            dataIndex: "updatedAt",
            key: "updatedAt",
            defaultSortOrder: "descend",
            render: (updatedAt) => {
                const date = dayjs(updatedAt)
                return <span title={date.format()}>{date.fromNow()}</span>
            },
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
                            (publishMutation.isLoading &&
                                publishMutation.variables?.id === record.id)
                        }
                    />
                </Popconfirm>
            ),
            sorter: (a, b) => Number(b.published) - Number(a.published),
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
    const { multiDims } = await admin.getJSON<{ multiDims: ApiMultiDim[] }>(
        "/api/multi-dims.json"
    )
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

export function MultiDimIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [notificationApi, notificationContextHolder] =
        notification.useNotification()
    const [search, setSearch] = useState("")
    const queryClient = useQueryClient()

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    const { data } = useQuery({
        queryKey: ["multiDims"],
        queryFn: () => fetchMultiDims(admin),
    })

    const publishMutation = useMutation({
        mutationFn: ({ id, published }: { id: number; published: boolean }) =>
            patchMultiDim(admin, id, { published }),
        onSuccess: async ({ published }) => {
            notificationApi.info({
                message: published ? "Published" : "Unpublished",
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
                message: "Slug updated",
                description: published ? (
                    <Link to="/deploys">Check deploy progress</Link>
                ) : undefined,
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({ queryKey: ["multiDims"] })
        },
    })

    const filteredMdims = useMemo(() => {
        const query = search.trim().toLowerCase()
        return data?.filter((mdim) =>
            [mdim.title, mdim.slug ?? ""].some((field) =>
                field.toLowerCase().includes(query)
            )
        )
    }, [data, search])

    const columns = createColumns(slugMutation, publishMutation)

    return (
        <AdminLayout title="Multidimensional Data Pages">
            {notificationContextHolder}
            <main>
                <Space direction="vertical" size="middle">
                    <Flex align="center" justify="space-between" gap={24}>
                        <Input
                            placeholder="Search by title or slug"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: 500 }}
                            autoFocus
                        />
                        <Space>
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
                        columns={columns}
                        dataSource={filteredMdims}
                        rowKey={(x) => x.id}
                    />
                </Space>
            </main>
        </AdminLayout>
    )
}
