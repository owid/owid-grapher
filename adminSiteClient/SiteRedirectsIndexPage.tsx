import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useContext, useEffect, useMemo, useState } from "react"
import {
    Alert,
    Button,
    Flex,
    Form,
    Input,
    Popconfirm,
    Space,
    Table,
    TableColumnsType,
    Typography,
    notification,
} from "antd"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { Admin } from "./Admin.js"

const SOURCE_PATTERN = /^\/$|^\/.*[^/]+$/
const INVALID_SOURCE_MESSAGE =
    "URL must start with a slash and cannot end with a slash, unless it's the root."
const TARGET_PATTERN = /^\/$|^(https?:\/\/|\/).*[^/]+$/
const INVALID_TARGET_MESSAGE =
    "URL must start with a slash or http(s):// and cannot end with a slash, unless it's the root."

type Redirect = {
    id: number
    source: string
    target: string
}

type FormData = {
    source: string
    target: string
}

async function fetchRedirects(admin: Admin) {
    const { redirects } = await admin.getJSON<{ redirects: Redirect[] }>(
        "/api/site-redirects.json"
    )
    return redirects
}

async function createRedirect(
    admin: Admin,
    data: { source: string; target: string }
) {
    const sourceUrl = new URL(data.source, window.location.origin)
    const sourcePath = sourceUrl.pathname
    const json = await admin.requestJSON<{
        success: boolean
        redirect: Redirect
    }>(
        "/api/site-redirects/new",
        { source: sourcePath, target: data.target },
        "POST"
    )
    if (!json.success) {
        throw new Error("Failed to create redirect")
    }
    return json.redirect
}

async function deleteRedirect(admin: Admin, id: number) {
    const json = await admin.requestJSON<{ success: boolean }>(
        `/api/site-redirects/${id}`,
        {},
        "DELETE"
    )
    if (!json.success) {
        throw new Error("Failed to delete redirect")
    }
}

function createColumns(
    onDelete: (id: number) => void
): TableColumnsType<Redirect> {
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
            dataIndex: "target",
            key: "target",
            render: (target) => {
                const targetUrl = new URL(target, BAKED_BASE_URL)
                return (
                    <a
                        href={targetUrl.href}
                        target="_blank"
                        rel="noopener"
                        style={{ wordBreak: "break-all" }}
                    >
                        {target}
                    </a>
                )
            },
        },
        {
            title: "",
            key: "actions",
            width: 100,
            render: (_, record) => (
                <Popconfirm
                    title={`Delete the redirect from ${record.source}?`}
                    onConfirm={() => onDelete(record.id)}
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

export default function SiteRedirectsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [notificationApi, notificationContextHolder] =
        notification.useNotification()
    const queryClient = useQueryClient()
    const [form] = Form.useForm<FormData>()
    const [search, setSearch] = useState("")

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    const { data: redirects } = useQuery({
        queryKey: ["siteRedirects"],
        queryFn: () => fetchRedirects(admin),
    })

    const createMutation = useMutation({
        mutationFn: (data: FormData) => createRedirect(admin, data),
        onSuccess: async () => {
            notificationApi.success({
                message: "Redirect created",
                placement: "bottomRight",
            })
            form.resetFields()
            return queryClient.invalidateQueries({
                queryKey: ["siteRedirects"],
            })
        },
        onError: () => {
            notificationApi.error({
                message: "Error creating redirect",
                placement: "bottomRight",
            })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteRedirect(admin, id),
        onSuccess: async () => {
            notificationApi.success({
                message: "Redirect deleted",
                placement: "bottomRight",
            })
            return queryClient.invalidateQueries({
                queryKey: ["siteRedirects"],
            })
        },
        onError: () => {
            notificationApi.error({
                message: "Error deleting redirect",
                placement: "bottomRight",
            })
        },
    })

    function handleSubmit(values: FormData) {
        createMutation.mutate(values)
    }

    const filteredRedirects = useMemo(() => {
        const query = search.trim().toLowerCase()
        return redirects?.filter((redirect) =>
            [redirect.source, redirect.target].some((field) =>
                field.toLowerCase().includes(query)
            )
        )
    }, [redirects, search])

    const columns = useMemo(
        () => createColumns((id) => deleteMutation.mutate(id)),
        [deleteMutation]
    )

    return (
        <AdminLayout title="Site Redirects">
            {notificationContextHolder}
            <main>
                <Space
                    direction="vertical"
                    size="large"
                    style={{ width: "100%" }}
                >
                    <Alert
                        message="About Site Redirects"
                        description={
                            <>
                                <Typography.Paragraph>
                                    This page is used to create and delete
                                    redirects for the site. Don't use this page
                                    to create redirects for charts, use the{" "}
                                    <Link to="/redirects">
                                        chart redirects page
                                    </Link>{" "}
                                    instead.
                                </Typography.Paragraph>
                                <Typography.Paragraph>
                                    The source has to start with a slash. Any
                                    query parameters (/war-and-peace
                                    <Typography.Text underline>
                                        ?insight=insightid
                                    </Typography.Text>
                                    ) or fragments (/war-and-peace
                                    <Typography.Text underline>
                                        #all-charts
                                    </Typography.Text>
                                    ) will be stripped, if present.
                                </Typography.Paragraph>
                                <Typography.Paragraph>
                                    The target can point to a full URL at
                                    another domain or a relative URL starting
                                    with a slash and both query parameters and
                                    fragments are allowed.
                                </Typography.Paragraph>
                                <Typography.Paragraph
                                    style={{ marginBottom: 0 }}
                                >
                                    To redirect to our homepage use a single
                                    slash as the target.
                                </Typography.Paragraph>
                            </>
                        }
                        type="info"
                        showIcon
                    />

                    <Form
                        form={form}
                        layout="inline"
                        onFinish={handleSubmit}
                        style={{ gap: 16 }}
                    >
                        <Form.Item
                            name="source"
                            label="Source"
                            rules={[
                                {
                                    required: true,
                                    message: "Please provide a source.",
                                },
                                {
                                    pattern: SOURCE_PATTERN,
                                    message: INVALID_SOURCE_MESSAGE,
                                },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        const target = getFieldValue("target")
                                        if (value && value === target) {
                                            return Promise.reject(
                                                new Error(
                                                    "Source and target cannot be the same."
                                                )
                                            )
                                        }
                                        if (value) {
                                            const sourceUrl = new URL(
                                                value,
                                                "https://ourworldindata.org"
                                            )
                                            if (sourceUrl.pathname === "/") {
                                                return Promise.reject(
                                                    new Error(
                                                        "Source cannot be the root."
                                                    )
                                                )
                                            }
                                        }
                                        return Promise.resolve()
                                    },
                                }),
                            ]}
                            style={{ minWidth: 400 }}
                        >
                            <Input placeholder="/fertility-can-decline-extremely-fast" />
                        </Form.Item>
                        <Form.Item
                            name="target"
                            label="Target"
                            rules={[
                                {
                                    required: true,
                                    message: "Please provide a target.",
                                },
                                {
                                    pattern: TARGET_PATTERN,
                                    message: INVALID_TARGET_MESSAGE,
                                },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        const source = getFieldValue("source")
                                        if (value && value === source) {
                                            return Promise.reject(
                                                new Error(
                                                    "Source and target cannot be the same."
                                                )
                                            )
                                        }
                                        return Promise.resolve()
                                    },
                                }),
                            ]}
                            style={{ minWidth: 400 }}
                        >
                            <Input placeholder="/fertility-rate" />
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={createMutation.isLoading}
                            >
                                Create
                            </Button>
                        </Form.Item>
                    </Form>

                    <div>
                        <Flex align="center" justify="space-between" gap={24}>
                            <Input
                                placeholder="Search by source or target"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ width: 400 }}
                                autoFocus
                            />
                            <Typography.Text>
                                Showing {filteredRedirects?.length ?? 0} of{" "}
                                {redirects?.length ?? 0} redirects
                            </Typography.Text>
                        </Flex>
                        <Table
                            columns={columns}
                            dataSource={filteredRedirects}
                            rowKey="id"
                            loading={!redirects}
                            pagination={{ pageSize: 20 }}
                            style={{ marginTop: 16 }}
                        />
                    </div>
                </Space>
            </main>
        </AdminLayout>
    )
}
