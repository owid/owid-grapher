import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useContext, useEffect, useMemo, useState } from "react"
import {
    Alert,
    Button,
    Flex,
    Input,
    Modal,
    Popconfirm,
    Space,
    Table,
    TableColumnsType,
    Typography,
    notification,
} from "antd"
import * as R from "remeda"
import urljoin from "url-join"
import { Json } from "@ourworldindata/utils"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { Admin } from "./Admin.js"
import { formatSourceQueryParams } from "./multiDimRedirectHelpers.js"

type MultiDimRedirect = {
    id: number
    source: string
    sourceQueryParams: Record<string, string | null> | null
    multiDimId: number
    multiDimSlug: string
    multiDimTitle: string
    targetQueryStr: string | null
}

type RedirectInGroup = {
    id: number
    source: string
    sourceQueryParams: Record<string, string | null> | null
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

type BulkRedirectResult = {
    source: string
    status: "created" | "skipped" | "error"
    message?: string
    redirectId?: number
}

type BulkRedirectResponse = {
    success: boolean
    created: number
    skipped: number
    errors: number
    results: BulkRedirectResult[]
}

async function bulkCreateMultiDimRedirects(admin: Admin, payload: Json) {
    return await admin.requestJSON<BulkRedirectResponse>(
        "/api/multi-dim-redirects/bulk",
        payload,
        "POST",
        { onFailure: "continue" }
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
                    sourceQueryParams: r.sourceQueryParams,
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
            render: (_, record) => {
                const queryParams = formatSourceQueryParams(
                    record.sourceQueryParams
                )
                return (
                    <Typography.Text style={{ wordBreak: "break-all" }}>
                        {record.source}
                        {queryParams && (
                            <Typography.Text type="secondary">
                                {" "}
                                (when {queryParams})
                            </Typography.Text>
                        )}
                    </Typography.Text>
                )
            },
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
    const [bulkModalOpen, setBulkModalOpen] = useState(false)
    const [bulkJson, setBulkJson] = useState("")
    const [bulkResult, setBulkResult] = useState<BulkRedirectResponse | null>(
        null
    )
    const [bulkError, setBulkError] = useState<string | null>(null)

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
                title: "Redirect deleted",
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({
                queryKey: ["allMultiDimRedirects"],
            })
        },
    })

    const bulkMutation = useMutation({
        mutationFn: (payload: Json) =>
            bulkCreateMultiDimRedirects(admin, payload),
        onSuccess: async (data) => {
            setBulkResult(data)
            setBulkError(null)
            notificationApi.success({
                title: `Created ${data.created}, skipped ${data.skipped}, ${data.errors} error(s)`,
                placement: "bottomRight",
            })
            await queryClient.invalidateQueries({
                queryKey: ["allMultiDimRedirects"],
            })
        },
        onError: (error) => {
            setBulkResult(null)
            setBulkError(error instanceof Error ? error.message : String(error))
        },
    })

    const handleBulkSubmit = () => {
        let payload: Json
        try {
            payload = JSON.parse(bulkJson) as Json
        } catch (error) {
            setBulkResult(null)
            setBulkError(
                `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
            )
            return
        }
        bulkMutation.mutate(payload)
    }

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
            <Modal
                title="Bulk-create redirects from JSON"
                open={bulkModalOpen}
                onCancel={() => setBulkModalOpen(false)}
                width={720}
                footer={[
                    <Button
                        key="clear"
                        onClick={() => {
                            setBulkJson("")
                            setBulkResult(null)
                            setBulkError(null)
                        }}
                        disabled={bulkMutation.isPending}
                    >
                        Clear
                    </Button>,
                    <Button key="close" onClick={() => setBulkModalOpen(false)}>
                        Close
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={handleBulkSubmit}
                        loading={bulkMutation.isPending}
                        disabled={!bulkJson.trim()}
                    >
                        Create bulk redirects
                    </Button>,
                ]}
            >
                <Typography.Paragraph type="secondary">
                    Paste the{" "}
                    <Typography.Text code>mapping.json</Typography.Text> file
                    from the{" "}
                    <Typography.Text code>
                        /map-explorer-to-mdim
                    </Typography.Text>{" "}
                    skill here. Each resolvable entry becomes a redirect; the
                    response is shown below.
                </Typography.Paragraph>
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    title="For these redirects to take effect, each target multi-dim must be published and the source charts or explorers must be deleted afterwards, if it hasn't already."
                />
                <Input.TextArea
                    value={bulkJson}
                    onChange={(e) => setBulkJson(e.target.value)}
                    placeholder='{ "redirects": [ … ], "catchAll": { … } }'
                    rows={12}
                    style={{ fontFamily: "monospace" }}
                />
                {bulkError && (
                    <Alert
                        type="error"
                        title={bulkError}
                        style={{ marginTop: 12 }}
                        showIcon
                    />
                )}
                {bulkResult && (
                    <pre
                        style={{
                            marginTop: 12,
                            marginBottom: 0,
                            padding: 12,
                            background: "#f5f5f5",
                            borderRadius: 4,
                            maxHeight: 320,
                            overflow: "auto",
                            fontSize: 12,
                        }}
                    >
                        {JSON.stringify(bulkResult, null, 2)}
                    </pre>
                )}
            </Modal>
            <main>
                <Space
                    orientation="vertical"
                    size="large"
                    style={{ width: "100%" }}
                >
                    <Alert
                        title="About Multi-Dim Redirects"
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
                        <Button
                            type="primary"
                            onClick={() => setBulkModalOpen(true)}
                        >
                            Bulk-create redirects from JSON
                        </Button>
                    </div>

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
