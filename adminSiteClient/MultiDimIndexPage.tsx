import {
    useMutation,
    UseMutationResult,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
    Button,
    Form,
    Input,
    Popconfirm,
    Switch,
    Table,
    TableColumnsType,
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPenToSquare, faXmark } from "@fortawesome/free-solid-svg-icons"

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
    isEditing,
    onToggleEditing,
    slugMutation,
}: {
    id: number
    slug: string
    isEditing: boolean
    onToggleEditing: (value: boolean) => void
    slugMutation: UseMutationResult<
        unknown,
        unknown,
        { id: number; slug: string },
        unknown
    >
}) {
    return isEditing ? (
        <Form
            initialValues={{ slug }}
            onFinish={(values) => {
                if (values.slug !== slug) {
                    slugMutation.mutate({ id, slug: values.slug })
                } else {
                    onToggleEditing(false)
                }
            }}
            style={{ maxWidth: 400 }}
        >
            <Form.Item
                name="slug"
                rules={[{ required: true, message: "Slug is required" }]}
                style={{ marginBottom: 0 }}
            >
                <Input
                    suffix={
                        <Button
                            type="text"
                            size="small"
                            onClick={() => onToggleEditing(false)}
                            icon={<FontAwesomeIcon icon={faXmark} />}
                            title="Cancel"
                        />
                    }
                    autoFocus
                    disabled={
                        slugMutation.isLoading &&
                        slugMutation.variables?.id === id
                    }
                    onKeyDown={(e) => {
                        if (e.key === "Escape") onToggleEditing(false)
                    }}
                />
            </Form.Item>
        </Form>
    ) : (
        <div
            onClick={() => onToggleEditing(true)}
            style={{ cursor: "pointer" }}
        >
            {slug}
            <Button
                type="link"
                icon={<FontAwesomeIcon icon={faPenToSquare} />}
                title="Edit slug"
            />
        </div>
    )
}

function createColumns(
    editingIds: number[],
    handleToggleEditingId: (id: number, value: boolean) => void,
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
                <SlugField
                    id={id}
                    slug={slug}
                    isEditing={editingIds.includes(id)}
                    onToggleEditing={(value) =>
                        handleToggleEditingId(id, value)
                    }
                    slugMutation={slugMutation}
                />
            ),
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
        },
    ]
}

const NotificationContext = createContext(null)

async function fetchMultiDims(admin: Admin) {
    const result = await admin.getJSON<{ multiDims: MultiDim[] }>(
        "/api/multi-dims.json"
    )
    return result.multiDims.map((mdim) => ({
        ...mdim,
        updatedAt: new Date(mdim.updatedAt),
    }))
}

async function patchMultiDim(admin: Admin, id: number, data: Json) {
    return await admin.requestJSON(`/api/multi-dims/${id}`, data, "PATCH")
}

export function MultiDimIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [notificationApi, notificationContextHolder] =
        notification.useNotification()
    const [search, setSearch] = useState("")
    const [editingIds, setEditingIds] = useState<number[]>([])
    const queryClient = useQueryClient()

    function handleToggleEditingId(id: number, value: boolean) {
        if (value) {
            setEditingIds((ids) => [...ids, id])
        } else {
            setEditingIds((ids) => ids.filter((x) => x !== id))
        }
    }

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
        onSuccess: async (_, { published }) => {
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
        onSuccess: async (_, { id }) => {
            handleToggleEditingId(id, false)
            notificationApi.info({
                message: "Slug updated",
                description: <Link to="/deploys">Check deploy progress</Link>,
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({ queryKey: ["multiDims"] })
        },
    })

    const filteredMdims = useMemo(
        () =>
            data?.filter((mdim) =>
                [mdim.title, mdim.slug].some((field) =>
                    field.toLowerCase().includes(search.toLowerCase())
                )
            ),
        [data, search]
    )

    const columns = createColumns(
        editingIds,
        handleToggleEditingId,
        slugMutation,
        publishMutation
    )

    return (
        <AdminLayout title="Multidimensional Data Pages">
            <NotificationContext.Provider value={null}>
                {notificationContextHolder}
                <main className="MultiDimIndexPage">
                    <Input
                        placeholder="Search by title or slug"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
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
