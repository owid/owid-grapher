import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import { Button, Modal, Space, TableColumnsType } from "antd"
import { AdminTable } from "../AdminTable.js"
import { useListSearch } from "../adminTableHelpers.js"
import { SearchField } from "../../adminShared/searchFilter.js"

import { AdminLayout } from "../AdminLayout.js"
import { AdminAppContext } from "../AdminAppContext.js"
import { Timeago } from "../Forms.js"
import { ApiSlideshowOverview } from "../../adminShared/AdminTypes.js"
import { Link } from "../Link.js"

function createColumns(ctx: {
    highlightFn: (
        text: string | null | undefined
    ) => React.ReactElement | string
    deleteFn: (slideshowId: number) => void
}): TableColumnsType<ApiSlideshowOverview> {
    return [
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            render: (title) => ctx.highlightFn(title),
        },
        {
            title: "Slug",
            dataIndex: "slug",
            key: "slug",
            width: 200,
            render: (slug) => ctx.highlightFn(slug),
        },
        {
            title: "Author",
            dataIndex: "authorName",
            key: "authorName",
            width: 150,
            render: (authorName) => ctx.highlightFn(authorName),
        },
        {
            title: "Published",
            dataIndex: "isPublished",
            key: "isPublished",
            width: 100,
            render: (isPublished) => (isPublished ? "Yes" : "No"),
        },
        {
            title: "Last updated",
            dataIndex: "updatedAt",
            key: "updatedAt",
            width: 150,
            defaultSortOrder: "descend",
            sorter: (a, b) =>
                a.updatedAt && b.updatedAt
                    ? new Date(a.updatedAt).getTime() -
                      new Date(b.updatedAt).getTime()
                    : 0,
            render: (time, slideshow) => (
                <Timeago time={time} by={slideshow.authorName} />
            ),
        },
        {
            title: "Action",
            key: "action",
            width: 200,
            render: (_, slideshow) => (
                <Space size="middle">
                    <Link to={`/slideshows/${slideshow.id}/edit`}>
                        <Button type="primary">Edit</Button>
                    </Link>
                    <a
                        href={`/admin/slideshows/${slideshow.id}/preview`}
                        target="_blank"
                        rel="noopener"
                    >
                        <Button>Preview</Button>
                    </a>
                    <Button
                        type="dashed"
                        danger
                        onClick={() => ctx.deleteFn(slideshow.id)}
                    >
                        Delete slideshow
                    </Button>
                </Space>
            ),
        },
    ]
}

const SEARCH_FIELDS: SearchField<ApiSlideshowOverview>[] = [
    {
        name: "title",
        type: "string",
        description: "Title",
        get: (s) => s.title,
    },
    { name: "slug", type: "string", description: "Slug", get: (s) => s.slug },
    {
        name: "author",
        type: "string",
        description: "Author",
        get: (s) => s.authorName,
    },
    {
        name: "id",
        type: "number",
        description: "Slideshow id",
        get: (s) => s.id,
    },
]

export function SlideshowsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [slideshows, setSlideshows] = useState<ApiSlideshowOverview[]>([])
    const {
        results: filteredSlideshows,
        highlight: highlightFn,
        search,
    } = useListSearch(slideshows, SEARCH_FIELDS, {
        placeholder: "Search slideshows...",
        autoFocus: true,
    })

    const deleteFn = useCallback(
        (slideshowId: number) => {
            Modal.confirm({
                title: "Delete this entire slideshow?",
                content:
                    "All slides in this deck will be permanently deleted. This cannot be undone.",
                okText: "Delete slideshow",
                okType: "danger",
                cancelText: "Cancel",
                onOk: async () => {
                    await admin.requestJSON(
                        `/api/slideshows/${slideshowId}`,
                        {},
                        "DELETE"
                    )
                    setSlideshows((prev) =>
                        prev.filter((s) => s.id !== slideshowId)
                    )
                },
            })
        },
        [admin]
    )

    const columns = useMemo(
        () => createColumns({ highlightFn, deleteFn }),
        [highlightFn, deleteFn]
    )

    useEffect(() => {
        const getSlideshows = async () =>
            await admin.getJSON<{
                slideshows: ApiSlideshowOverview[]
            }>("/api/slideshows.json")

        void getSlideshows().then((res) => setSlideshows(res.slideshows))
    }, [admin])

    return (
        <AdminLayout title="Slideshows">
            <main>
                <AdminTable
                    columns={columns}
                    dataSource={filteredSlideshows}
                    rowKey="id"
                    entityName="slideshows"
                    search={search}
                    actions={
                        <Link to="/slideshows/create">
                            <Button type="primary">Create slideshow</Button>
                        </Link>
                    }
                />
            </main>
        </AdminLayout>
    )
}
