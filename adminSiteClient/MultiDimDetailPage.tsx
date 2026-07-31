import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useContext, useEffect, useState, useMemo } from "react"
import {
    Alert,
    Col,
    Row,
    Space,
    Tag,
    Typography,
    Input,
    Button,
    Select,
    Form,
    Checkbox,
    Table,
    TableColumnsType,
    Popconfirm,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExternalLink, faTrash } from "@fortawesome/free-solid-svg-icons"
import urljoin from "url-join"
import { Admin } from "./Admin.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import {
    dimensionsToViewId,
    MultiDimDataPageConfig,
    MultiDimDimensionChoices,
    queryParamsToStr,
} from "@ourworldindata/utils"
import {
    DimensionEnriched,
    MultiDimDataPageConfigEnriched,
} from "@ourworldindata/types"
import { LoadingBlocker } from "./Forms.js"
import { formatSourceQueryParams } from "./multiDimRedirectHelpers.js"

// Source path must start with /grapher/ or /explorers/ and cannot end with a slash.
const SOURCE_PATH_PATTERN = /^\/(grapher|explorers)\/.*[^/]$/
const INVALID_SOURCE_PATH_MESSAGE =
    "Source must start with /grapher/ or /explorers/ and cannot end with a slash."

function normalizeRedirectSource(source: string): string {
    const sourceUrl = new URL(source, window.location.origin)
    return sourceUrl.pathname
}

// Parses a query-string-style input (e.g. "tab=map&country=USA") into an object,
// or null when empty. These are the source query params the redirect matches on.
function parseSourceQueryParamsInput(
    input: string
): Record<string, string> | null {
    const trimmed = input.trim().replace(/^\?/, "")
    if (!trimmed) return null
    const result = Object.fromEntries(new URLSearchParams(trimmed))
    return Object.keys(result).length > 0 ? result : null
}

type ApiMultiDimDetail = {
    id: number
    catalogPath: string
    slug: string | null
    updatedAt: string
    published: boolean
    config: MultiDimDataPageConfigEnriched
}

type MultiDimDetail = Omit<ApiMultiDimDetail, "updatedAt"> & {
    updatedAt: Date
}

type MultiDimRedirect = {
    id: number
    source: string
    sourceQueryParams: Record<string, string | null> | null
    viewConfigId: string | null
}

function deserializeMultiDim(mdim: ApiMultiDimDetail): MultiDimDetail {
    return {
        ...mdim,
        updatedAt: new Date(mdim.updatedAt),
    }
}

function DimensionSelector({
    dimension,
    value,
    onChange,
}: {
    dimension: DimensionEnriched
    value: string
    onChange: (value: string) => void
}) {
    const options = dimension.choices.map((choice) => ({
        value: choice.slug,
        label: choice.name,
    }))

    return (
        <div className="dimension-selector">
            <label className="dimension-selector__label">
                {dimension.name}
            </label>
            <Select
                className="w-100"
                value={value}
                onChange={onChange}
                options={options}
                disabled={dimension.choices.length <= 1}
            />
        </div>
    )
}

async function fetchMultiDim(
    admin: Admin,
    id: number
): Promise<MultiDimDetail> {
    const { multiDim } = await admin.getJSON<{
        multiDim: ApiMultiDimDetail
    }>(`/api/multi-dims/${id}`)
    return deserializeMultiDim(multiDim)
}

async function fetchMultiDimRedirects(
    admin: Admin,
    id: number
): Promise<MultiDimRedirect[]> {
    const { redirects } = await admin.getJSON<{
        redirects: MultiDimRedirect[]
    }>(`/api/multi-dims/${id}/redirects`)
    return redirects
}

async function createMultiDimRedirect(
    admin: Admin,
    multiDimId: number,
    source: string,
    viewConfigId: string | null,
    sourceQueryParams: Record<string, string> | null
): Promise<MultiDimRedirect> {
    const { redirect } = await admin.requestJSON<{
        redirect: MultiDimRedirect
    }>(
        `/api/multi-dims/${multiDimId}/redirects`,
        { source, viewConfigId, sourceQueryParams },
        "POST"
    )
    return redirect
}

async function deleteMultiDimRedirect(
    admin: Admin,
    multiDimId: number,
    redirectId: number
): Promise<void> {
    await admin.requestJSON(
        `/api/multi-dims/${multiDimId}/redirects/${redirectId}`,
        {},
        "DELETE"
    )
}

type RedirectFormValues = {
    source: string
    sourceQueryParams: string
    redirectToSpecificView: boolean
}

function getRedirectColumns(ctx: {
    config: MultiDimDataPageConfig | null
    setSelectedDimensions: (dims: MultiDimDimensionChoices) => void
    deleteRedirectMutation: ReturnType<
        typeof useMutation<void, Error, number, unknown>
    >
}): TableColumnsType<MultiDimRedirect> {
    const { config, setSelectedDimensions, deleteRedirectMutation } = ctx
    return [
        {
            title: "Source",
            dataIndex: "source",
            key: "source",
            render: (_, redirect) => {
                const queryParams = formatSourceQueryParams(
                    redirect.sourceQueryParams
                )
                return (
                    <>
                        <Typography.Text>{redirect.source}</Typography.Text>
                        {queryParams && (
                            <Typography.Text type="secondary">
                                {" "}
                                (when {queryParams})
                            </Typography.Text>
                        )}
                    </>
                )
            },
        },
        {
            title: "Target",
            key: "target",
            render: (_, redirect) => {
                const isDefaultView = !redirect.viewConfigId
                if (isDefaultView) {
                    return (
                        <Button
                            className="target-view-button"
                            type="link"
                            size="small"
                            onClick={() => setSelectedDimensions({})}
                        >
                            (default view)
                        </Button>
                    )
                }
                const viewDimensions = config?.findViewDimensionsByConfigId(
                    redirect.viewConfigId!
                )
                const queryStr = viewDimensions
                    ? queryParamsToStr(viewDimensions)
                    : null
                if (queryStr && viewDimensions) {
                    return (
                        <Button
                            className="target-view-button"
                            type="link"
                            size="small"
                            onClick={() =>
                                setSelectedDimensions(viewDimensions)
                            }
                        >
                            {queryStr}
                        </Button>
                    )
                }
                return (
                    <Typography.Text type="secondary">
                        (unknown view)
                    </Typography.Text>
                )
            },
        },
        {
            title: "",
            key: "actions",
            width: 50,
            render: (_, redirect) => (
                <Popconfirm
                    title="Delete redirect"
                    description="Are you sure you want to delete this redirect?"
                    onConfirm={() => deleteRedirectMutation.mutate(redirect.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                >
                    <Button
                        type="text"
                        danger
                        size="small"
                        icon={<FontAwesomeIcon icon={faTrash} />}
                        loading={deleteRedirectMutation.isPending}
                    />
                </Popconfirm>
            ),
        },
    ]
}

export function MultiDimDetailPage({ id }: { id: number }) {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const [redirectForm] = Form.useForm<RedirectFormValues>()
    const [selectedDimensions, setSelectedDimensions] =
        useState<MultiDimDimensionChoices>({})

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    const {
        data: multiDim,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["multiDim", id],
        queryFn: () => fetchMultiDim(admin, id),
    })

    const { data: redirects = [], isLoading: isLoadingRedirects } = useQuery({
        queryKey: ["multiDimRedirects", id],
        queryFn: () => fetchMultiDimRedirects(admin, id),
    })

    const createRedirectMutation = useMutation({
        mutationFn: ({
            source,
            viewConfigId,
            sourceQueryParams,
        }: {
            source: string
            viewConfigId: string | null
            sourceQueryParams: Record<string, string> | null
        }) =>
            createMultiDimRedirect(
                admin,
                id,
                source,
                viewConfigId,
                sourceQueryParams
            ),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["multiDimRedirects", id],
            })
            redirectForm.resetFields(["source", "sourceQueryParams"])
        },
    })

    const deleteRedirectMutation = useMutation({
        mutationFn: (redirectId: number) =>
            deleteMultiDimRedirect(admin, id, redirectId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["multiDimRedirects", id],
            })
        },
    })

    const config = useMemo(
        () =>
            multiDim
                ? MultiDimDataPageConfig.fromObject(multiDim.config)
                : null,
        [multiDim]
    )

    const { currentDimensions, availableSettings } = useMemo(() => {
        if (!config) return { currentDimensions: null, availableSettings: null }
        const { selectedChoices, dimensionsWithAvailableChoices } =
            config.filterToAvailableChoices(selectedDimensions)
        return {
            currentDimensions: selectedChoices,
            availableSettings: dimensionsWithAvailableChoices,
        }
    }, [config, selectedDimensions])

    function handleDimensionChange(dimensionSlug: string, choiceSlug: string) {
        setSelectedDimensions((prev) => ({
            ...prev,
            [dimensionSlug]: choiceSlug,
        }))
    }

    const currentViewConfigId = useMemo(() => {
        if (!config || !currentDimensions) return null
        const viewId = dimensionsToViewId(currentDimensions)
        const view = config.config.views.find(
            (v) => dimensionsToViewId(v.dimensions) === viewId
        )
        return view?.fullConfigId ?? null
    }, [config, currentDimensions])

    const iframeSrc = useMemo(() => {
        if (!multiDim) return null
        const baseUrl = urljoin(
            ADMIN_BASE_URL,
            `/admin/grapher/${encodeURIComponent(multiDim.catalogPath)}`
        )
        const params = new URLSearchParams()
        params.set("hideControls", "true")
        if (currentDimensions) {
            for (const [key, value] of Object.entries(currentDimensions)) {
                params.set(key, value)
            }
        }
        return `${baseUrl}?${params.toString()}`
    }, [multiDim, currentDimensions])

    function handleCreateRedirect(values: RedirectFormValues) {
        const normalizedSource = normalizeRedirectSource(values.source.trim())
        createRedirectMutation.mutate({
            source: normalizedSource,
            viewConfigId: values.redirectToSpecificView
                ? currentViewConfigId
                : null,
            sourceQueryParams: parseSourceQueryParamsInput(
                values.sourceQueryParams
            ),
        })
    }

    if (isLoading) {
        return (
            <AdminLayout>
                <main className="MultiDimDetailPage">
                    <LoadingBlocker />
                </main>
            </AdminLayout>
        )
    }

    if (isError) {
        return (
            <AdminLayout title="Error">
                <main className="MultiDimDetailPage">
                    <div className="error">
                        Failed to load multi-dimensional data page
                    </div>
                </main>
            </AdminLayout>
        )
    }

    if (!multiDim) {
        return (
            <AdminLayout title="Not Found">
                <main className="MultiDimDetailPage">
                    <div className="not-found">
                        Multi-dimensional data page not found
                    </div>
                </main>
            </AdminLayout>
        )
    }

    const liveUrl =
        multiDim.published && multiDim.slug
            ? urljoin(BAKED_GRAPHER_URL, multiDim.slug)
            : null

    const previewUrl = urljoin(
        ADMIN_BASE_URL,
        `/admin/grapher/${encodeURIComponent(multiDim.catalogPath)}`
    )

    const title = multiDim.config.title.title

    return (
        <AdminLayout title={title}>
            <main className="MultiDimDetailPage">
                <Row
                    className={`p-3 admin-bar ${multiDim.published ? "published" : "draft"}`}
                    justify="space-between"
                    align="middle"
                    gutter={[0, 8]}
                >
                    <Col flex={1}>
                        <Space>
                            <Typography.Title className="mb-0" level={4}>
                                {title}
                            </Typography.Title>
                            <Typography.Text
                                type="secondary"
                                copyable={{ text: multiDim.catalogPath }}
                            >
                                {multiDim.catalogPath}
                            </Typography.Text>
                            {!multiDim.published && (
                                <Tag color="default">Draft</Tag>
                            )}
                        </Space>
                    </Col>
                    <Col>
                        {liveUrl ? (
                            <a
                                className="ant-btn ant-btn-default"
                                href={liveUrl}
                                target="_blank"
                                rel="noopener"
                            >
                                <Space>
                                    <FontAwesomeIcon icon={faExternalLink} />
                                    View live
                                </Space>
                            </a>
                        ) : (
                            <a
                                className="ant-btn ant-btn-default"
                                href={previewUrl}
                                target="_blank"
                                rel="noopener"
                            >
                                <Space>
                                    <FontAwesomeIcon icon={faExternalLink} />
                                    View preview
                                </Space>
                            </a>
                        )}
                    </Col>
                </Row>

                <div className="content-container">
                    <div className="redirects-sidebar">
                        <Typography.Title level={5}>
                            Create a redirect
                        </Typography.Title>

                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            title="For a redirect to take effect, the target multi-dim must be published and the source chart or explorer must be deleted afterwards, if it hasn't already."
                        />

                        <Form
                            form={redirectForm}
                            layout="vertical"
                            onFinish={handleCreateRedirect}
                            initialValues={{
                                source: "",
                                sourceQueryParams: "",
                                redirectToSpecificView: true,
                            }}
                        >
                            <Form.Item
                                label="Source"
                                name="source"
                                extra="Must start with /grapher/ or /explorers/."
                                rules={[
                                    {
                                        required: true,
                                        message:
                                            "Please provide a source path.",
                                    },
                                    {
                                        pattern: SOURCE_PATH_PATTERN,
                                        message: INVALID_SOURCE_PATH_MESSAGE,
                                    },
                                ]}
                            >
                                <Input placeholder="/grapher/example" />
                            </Form.Item>
                            <Form.Item
                                label="Source query params"
                                name="sourceQueryParams"
                                extra="Optional. Only redirect when these query params match, e.g. tab=map&country=USA. Leave empty to match any."
                            >
                                <Input placeholder="tab=map&country=USA" />
                            </Form.Item>
                            <Form.Item
                                name="redirectToSpecificView"
                                valuePropName="checked"
                                extra="Uses the currently selected view as the target."
                            >
                                <Checkbox>Redirect to specific view</Checkbox>
                            </Form.Item>
                            <Form.Item
                                shouldUpdate={(prev, cur) =>
                                    prev.redirectToSpecificView !==
                                    cur.redirectToSpecificView
                                }
                            >
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    disabled={createRedirectMutation.isPending}
                                    loading={createRedirectMutation.isPending}
                                >
                                    Create
                                </Button>
                            </Form.Item>
                        </Form>

                        <Typography.Title level={5}>
                            Existing redirects
                        </Typography.Title>
                        <Table<MultiDimRedirect>
                            columns={getRedirectColumns({
                                config,
                                setSelectedDimensions,
                                deleteRedirectMutation,
                            })}
                            dataSource={redirects}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            loading={isLoadingRedirects}
                            locale={{
                                emptyText: (
                                    <Typography.Text type="secondary">
                                        No redirects configured yet.
                                    </Typography.Text>
                                ),
                            }}
                        />
                    </div>

                    <div className="preview-container">
                        {availableSettings && currentDimensions && (
                            <div className="preview-wrapper">
                                <div className="dimension-selectors">
                                    {Object.values(availableSettings).map(
                                        (dimension) => (
                                            <DimensionSelector
                                                key={dimension.slug}
                                                dimension={dimension}
                                                value={
                                                    currentDimensions[
                                                        dimension.slug
                                                    ]
                                                }
                                                onChange={(value) =>
                                                    handleDimensionChange(
                                                        dimension.slug,
                                                        value
                                                    )
                                                }
                                            />
                                        )
                                    )}
                                </div>
                                {iframeSrc && (
                                    <iframe
                                        className="preview-iframe"
                                        src={iframeSrc}
                                        title="Multi-dimensional chart preview"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </AdminLayout>
    )
}
