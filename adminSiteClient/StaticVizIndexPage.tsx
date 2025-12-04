import { useContext, useMemo, useState } from "react"
import cx from "classnames"
import {
    Button,
    Flex,
    Input,
    Popconfirm,
    Table,
    TableColumnsType,
    Spin,
} from "antd"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import { Link } from "react-router-dom"
import { copyToClipboard, DbEnrichedStaticViz } from "@ourworldindata/utils"
import {
    faCopy,
    faDesktop,
    faMobileScreen,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { makeImageSrc } from "./imagesHelpers.js"

function ImagePreviewGallery({
    cloudflareId,
    mobileCloudflareId,
}: {
    cloudflareId: string
    mobileCloudflareId?: string | null
}) {
    const [activeImage, setActiveImage] = useState(cloudflareId)
    if (cloudflareId && !mobileCloudflareId) {
        return (
            <img
                className="static-viz-admin__preview-active-image"
                src={makeImageSrc(cloudflareId, 300)}
            />
        )
    }

    return (
        <div>
            {activeImage && (
                <img
                    className="static-viz-admin__preview-active-image"
                    src={makeImageSrc(activeImage, 600)}
                />
            )}
            <div className="static-viz-admin__preview-gallery-strip">
                {[cloudflareId, mobileCloudflareId!].map((id, idx) => (
                    <div
                        key={id}
                        className="static-viz-admin__preview-thumbnail"
                    >
                        <img
                            className={cx({
                                active: id === activeImage,
                            })}
                            onClick={() => setActiveImage(id)}
                            src={makeImageSrc(id, 300)}
                        />
                        <FontAwesomeIcon
                            icon={idx === 0 ? faDesktop : faMobileScreen}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

function createColumns({
    onDelete,
}: {
    onDelete: (staticViz: DbEnrichedStaticViz) => void
}): TableColumnsType<DbEnrichedStaticViz> {
    return [
        {
            title: "Image",
            dataIndex: "cloudflareId",
            key: "cloudflareId",
            width: 100,
            render: (_, record) => {
                return (
                    record.desktop && (
                        <ImagePreviewGallery
                            cloudflareId={record.desktop.cloudflareId}
                            mobileCloudflareId={record.mobile?.cloudflareId}
                        />
                    )
                )
            },
        },
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            width: 300,
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (name) => {
                return (
                    <>
                        <span>{name}</span>
                        <Button
                            type="text"
                            size="small"
                            icon={<FontAwesomeIcon icon={faCopy} size="sm" />}
                            onClick={() => copyToClipboard(name)}
                        />
                    </>
                )
            },
        },
        {
            title: "Source",
            key: "source",
            width: 200,
            render: (_, record) => {
                if (record.chartId) {
                    return (
                        <a href={`/admin/charts/${record.chartId}/edit`}>
                            {record.grapherSlug}
                        </a>
                    )
                }
                if (record.sourceUrl) {
                    return (
                        <a
                            href={record.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            External URL
                        </a>
                    )
                }
                return null
            },
        },
        {
            title: "Last updated",
            dataIndex: "updatedAt",
            key: "updatedAt",
            width: 150,
            defaultSortOrder: "descend",
            sorter: (a, b) =>
                new Date(a.updatedAt).getTime() -
                new Date(b.updatedAt).getTime(),
            render: (time) => <Timeago time={new Date(time).getTime()} />,
        },
        {
            title: "Created by",
            dataIndex: "createdBy",
            key: "createdBy",
            sorter: (a, b) =>
                a.createdBy && b.createdBy
                    ? a.createdBy.localeCompare(b.createdBy)
                    : 0,
            width: 200,
        },
        {
            title: "Updated by",
            dataIndex: "updatedBy",
            key: "updatedBy",
            sorter: (a, b) =>
                a.updatedBy && b.updatedBy
                    ? a.updatedBy.localeCompare(b.updatedBy)
                    : 0,
            width: 200,
        },
        {
            title: "Action",
            key: "action",
            width: 100,
            render: (_, staticViz) => (
                <Flex vertical>
                    <Link to={`/static-viz/${staticViz.id}`}>
                        <Button type="text">Edit</Button>
                    </Link>
                    <Popconfirm
                        title="Are you sure?"
                        description="This will permanently delete this static viz entry."
                        onConfirm={() => onDelete(staticViz)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button type="text" danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </Flex>
            ),
        },
    ]
}

export function StaticVizIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const [searchValue, setSearchValue] = useState("")

    const { data: staticVizResponse, isLoading } = useQuery({
        queryKey: ["static-viz"],
        queryFn: () => {
            return admin.getJSON<DbEnrichedStaticViz[]>("/api/static-viz.json")
        },
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (staticViz: DbEnrichedStaticViz) => {
            return admin.requestJSON(
                `/api/static-viz/${staticViz.id}`,
                {},
                "DELETE"
            )
        },
        onSuccess: () => {
            // Invalidate and refetch
            return queryClient.invalidateQueries({ queryKey: ["static-viz"] })
        },
    })

    const filteredLinkedStaticViz = useMemo(() => {
        const linkedStaticViz = staticVizResponse || []
        return linkedStaticViz.filter((item) => {
            if (!searchValue) return true
            const value = searchValue.toLowerCase()
            const { name, description, createdBy, updatedBy } = item
            return (
                name.toLowerCase().includes(value) ||
                description?.toLowerCase().includes(value) ||
                createdBy?.toLowerCase().includes(value) ||
                updatedBy?.toLowerCase().includes(value)
            )
        })
    }, [staticVizResponse, searchValue])

    const columns = useMemo(
        () => createColumns({ onDelete: deleteMutation.mutate }),
        [deleteMutation.mutate]
    )

    return (
        <AdminLayout title="Static Visualizations">
            <main className="StaticVizIndexPage">
                <Flex justify="space-between">
                    <Input
                        placeholder="Search by name or description"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                    <Link to="/static-viz/new">
                        <Button type="primary">Create New Static Viz</Button>
                    </Link>
                </Flex>
                <Spin spinning={isLoading}>
                    <Table
                        size="small"
                        columns={columns}
                        dataSource={filteredLinkedStaticViz}
                        rowKey={(x) => x.name}
                        pagination={{
                            pageSize: 50,
                            showSizeChanger: true,
                            showQuickJumper: true,
                        }}
                    />
                </Spin>
            </main>
        </AdminLayout>
    )
}
