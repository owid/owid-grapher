import {
    useMutation,
    UseMutationResult,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
    Input,
    Popconfirm,
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
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { dayjs, Json } from "@ourworldindata/utils"
import { Link } from "./Link.js"

type ApiMultiDim = {
    id: number
    title: string
    slug: string
    updatedAt: string
    published: boolean
}

type MultiDim = Omit<ApiMultiDim, "updatedAt"> & {
    updatedAt: Date
}

function SlugField({
    id,
    slug,
    slugMutation,
}: {
    id: number
    slug: string
    slugMutation: UseMutationResult<
        unknown,
        unknown,
        { id: number; slug: string },
        unknown
    >
}) {
    function handleOnChange(value: string) {
        if (value !== slug) slugMutation.mutate({ id, slug: value })
    }

    return (
        <Typography.Text editable={{ onChange: handleOnChange }}>
            {slug}
        </Typography.Text>
    )
}

function createColumns(
    slugMutation: UseMutationResult<
        unknown,
        unknown,
        { id: number; slug: string },
        unknown
    >,
    publishMutation: UseMutationResult<
        unknown,
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
                    <a
                        href={urljoin(
                            BAKED_BASE_URL,
                            `/admin/grapher/${record.slug}`
                        )}
                        target="_blank"
                        rel="noopener"
                    >
                        <img
                            src={urljoin(
                                GRAPHER_DYNAMIC_THUMBNAIL_URL,
                                `/${record.slug}.png?imHeight=400`
                            )}
                            style={{ height: "140px", width: "auto" }}
                            alt="Preview"
                        />
                    </a>
                )
            },
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            width: 280,
            render: (text, record) =>
                record.published ? (
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
            title: "Slug",
            dataIndex: "slug",
            key: "slug",
            render: (slug, { id }) => (
                <SlugField id={id} slug={slug} slugMutation={slugMutation} />
            ),
            sorter: (a, b) => a.title.localeCompare(b.title),
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
                            publishMutation.isLoading &&
                            publishMutation.variables?.id === record.id
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

const NotificationContext = createContext(null)

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
            [mdim.title, mdim.slug].some((field) =>
                field.toLowerCase().includes(query)
            )
        )
    }, [data, search])

    const columns = createColumns(slugMutation, publishMutation)

    return (
        <AdminLayout title="Multidimensional Data Pages">
            <NotificationContext.Provider value={null}>
                {notificationContextHolder}
                <main>
                    <Input
                        placeholder="Search by title or slug"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                        autoFocus
                    />
                    <Table
                        columns={columns}
                        dataSource={filteredMdims}
                        rowKey={(x) => x.id}
                    />
                </main>
            </NotificationContext.Provider>
        </AdminLayout>
    )
}
