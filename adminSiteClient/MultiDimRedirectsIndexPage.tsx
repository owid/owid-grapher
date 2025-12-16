import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useContext, useEffect, useMemo, useState } from "react"
import {
    Alert,
    Button,
    Flex,
    Input,
    Popconfirm,
    Space,
    Table,
    TableColumnsType,
    Typography,
    notification,
} from "antd"
import * as R from "remeda"
import urljoin from "url-join"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { Admin } from "./Admin.js"

type MultiDimRedirect = {
    id: number
    source: string
    multiDimId: number
    multiDimSlug: string
    multiDimTitle: string
    targetQueryStr: string | null
}

type RedirectInGroup = {
    id: number
    source: string
    targetQueryStr: string | null
}

type GroupedRedirects = {
    multiDimId: number
    multiDimSlug: string
    multiDimTitle: string
    redirects: RedirectInGroup[]
}

async function fetchAllMultiDimRedirects(admin: Admin) {
    const { redirects } = await admin.getJSON<{
        redirects: MultiDimRedirect[]
    }>("/api/multi-dim-redirects.json")
    return redirects
}

async function deleteMultiDimRedirect(
    admin: Admin,
    multiDimId: number,
    redirectId: number
) {
    return await admin.requestJSON<{ success: boolean }>(
        `/api/multi-dims/${multiDimId}/redirects/${redirectId}`,
        {},
        "DELETE"
    )
}

function groupRedirectsByMultiDim(
    redirects: MultiDimRedirect[]
): GroupedRedirects[] {
    return R.pipe(
        redirects,
        R.groupBy((redirect) => redirect.multiDimId),
        R.values(),
        R.map((groupRedirects) => {
            const first = groupRedirects[0]
            return {
                multiDimId: first.multiDimId,
                multiDimSlug: first.multiDimSlug,
                multiDimTitle: first.multiDimTitle,
                redirects: groupRedirects.map((r) => ({
                    id: r.id,
                    source: r.source,
                    targetQueryStr: r.targetQueryStr,
                })),
            }
        }),
        R.sortBy((group) => group.multiDimTitle)
    )
}

function RedirectTargetCell({
    redirect,
    multiDimSlug,
}: {
    redirect: RedirectInGroup
    multiDimSlug: string
}) {
    const baseUrl = urljoin(BAKED_GRAPHER_URL, multiDimSlug)

    if (redirect.targetQueryStr) {
        return (
            <a
                href={baseUrl + redirect.targetQueryStr}
                target="_blank"
                rel="noopener"
                style={{ wordBreak: "break-all" }}
            >
                {redirect.targetQueryStr}
            </a>
        )
    }

    return (
        <a href={baseUrl} target="_blank" rel="noopener">
            (default view)
        </a>
    )
}

function createNestedColumns(
    onDelete: (multiDimId: number, redirectId: number) => void,
    multiDimId: number,
    multiDimSlug: string
): TableColumnsType<RedirectInGroup> {
    return [
        {
            title: "Source",
            dataIndex: "source",
            key: "source",
            render: (source) => (
                <Typography.Text style={{ wordBreak: "break-all" }}>
                    {source}
                </Typography.Text>
            ),
        },
        {
            title: "Target",
            key: "target",
            render: (_, record) => (
                <RedirectTargetCell
                    redirect={record}
                    multiDimSlug={multiDimSlug}
                />
            ),
        },
        {
            title: "",
            key: "actions",
            width: 100,
            render: (_, record) => (
                <Popconfirm
                    title={`Delete the redirect from ${record.source}?`}
                    onConfirm={() => onDelete(multiDimId, record.id)}
                    okText="Yes"
                    cancelText="No"
                >
                    <Button danger size="small">
                        Delete
                    </Button>
                </Popconfirm>
            ),
        },
    ]
}

function createParentColumns(): TableColumnsType<GroupedRedirects> {
    return [
        {
            title: "Multi-dim",
            key: "multiDim",
            render: (_, record) => (
                <Flex align="center" gap={12}>
                    <Link to={`/multi-dims/${record.multiDimId}`}>
                        <Typography.Text strong>
                            {record.multiDimTitle}
                        </Typography.Text>
                    </Link>
                    <Typography.Text type="secondary">
                        ({record.multiDimSlug})
                    </Typography.Text>
                </Flex>
            ),
        },
        {
            title: "Redirects",
            key: "count",
            width: 120,
            align: "right",
            render: (_, record) => (
                <Typography.Text>{record.redirects.length}</Typography.Text>
            ),
        },
    ]
}

export default function MultiDimRedirectsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [notificationApi, notificationContextHolder] =
        notification.useNotification()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    const { data: redirects } = useQuery({
        queryKey: ["allMultiDimRedirects"],
        queryFn: () => fetchAllMultiDimRedirects(admin),
    })

    const deleteMutation = useMutation({
        mutationFn: ({
            multiDimId,
            redirectId,
        }: {
            multiDimId: number
            redirectId: number
        }) => deleteMultiDimRedirect(admin, multiDimId, redirectId),
        onSuccess: async () => {
            notificationApi.success({
                message: "Redirect deleted",
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({
                queryKey: ["allMultiDimRedirects"],
            })
        },
    })

    const filteredRedirects = useMemo(() => {
        const query = search.trim().toLowerCase()
        return redirects?.filter(
            (redirect) =>
                redirect.source.toLowerCase().includes(query) ||
                redirect.multiDimSlug.toLowerCase().includes(query) ||
                redirect.multiDimTitle.toLowerCase().includes(query)
        )
    }, [redirects, search])

    const groupedRedirects = useMemo(
        () => groupRedirectsByMultiDim(filteredRedirects ?? []),
        [filteredRedirects]
    )

    const parentColumns = useMemo(() => createParentColumns(), [])

    return (
        <AdminLayout title="Multi-dim Redirects">
            {notificationContextHolder}
            <main>
                <Space
                    direction="vertical"
                    size="large"
                    style={{ width: "100%" }}
                >
                    <Alert
                        message="About Multi-Dim Redirects"
                        description={
                            <>
                                <Typography.Paragraph className="mb-0">
                                    To <strong>create</strong> a new redirect,
                                    go to the{" "}
                                    <Link to="/multi-dims">
                                        multi-dims index page
                                    </Link>
                                    , find the target multi-dim, and create the
                                    redirect from its detail page.
                                </Typography.Paragraph>
                            </>
                        }
                        type="info"
                        showIcon
                    />

                    <div>
                        <Flex align="center" justify="space-between" gap={24}>
                            <Input
                                placeholder="Search by source, target slug, or title"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ width: 400 }}
                                autoFocus
                            />
                            <Typography.Text>
                                Showing {filteredRedirects?.length ?? 0} of{" "}
                                {redirects?.length ?? 0} redirects across{" "}
                                {groupedRedirects.length} multi-dims
                            </Typography.Text>
                        </Flex>

                        <div style={{ marginTop: 24 }}>
                            <Table
                                columns={parentColumns}
                                dataSource={groupedRedirects}
                                rowKey="multiDimId"
                                loading={!redirects}
                                pagination={false}
                                expandable={{
                                    expandedRowRender: (record) => (
                                        <Table
                                            columns={createNestedColumns(
                                                (multiDimId, redirectId) =>
                                                    deleteMutation.mutate({
                                                        multiDimId,
                                                        redirectId,
                                                    }),
                                                record.multiDimId,
                                                record.multiDimSlug
                                            )}
                                            dataSource={record.redirects}
                                            rowKey="id"
                                            pagination={false}
                                            size="small"
                                        />
                                    ),
                                    rowExpandable: (record) =>
                                        record.redirects.length > 0,
                                }}
                            />
                        </div>
                    </div>
                </Space>
            </main>
        </AdminLayout>
    )
}
