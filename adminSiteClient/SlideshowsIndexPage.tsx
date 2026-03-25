import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import { Button, Flex, Input, Space, Table, TableColumnsType } from "antd"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import { ApiSlideshowOverview } from "../adminShared/AdminTypes.js"
import { Link } from "./Link.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"

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
            width: 100,
            render: (_, slideshow) => (
                <Space size="middle">
                    <Link to={`/slideshows/${slideshow.id}/edit`}>
                        <Button type="primary">Edit</Button>
                    </Link>
                    <Button
                        type="dashed"
                        danger
                        onClick={() => ctx.deleteFn(slideshow.id)}
                    >
                        Delete
                    </Button>
                </Space>
            ),
        },
    ]
}

export function SlideshowsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [slideshows, setSlideshows] = useState<ApiSlideshowOverview[]>([])
    const [searchValue, setSearchValue] = useState("")

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredSlideshows = useMemo(() => {
        const filterFn = filterFunctionForSearchWords(
            searchWords,
            (slideshow: ApiSlideshowOverview) => [
                `${slideshow.id}`,
                slideshow.title,
                slideshow.slug,
                slideshow.authorName,
            ]
        )

        return slideshows.filter(filterFn)
    }, [slideshows, searchWords])

    const highlightFn = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )

    const deleteFn = useCallback(
        async (slideshowId: number) => {
            if (confirm("Are you sure you want to delete this slideshow?")) {
                await admin.requestJSON(
                    `/api/slideshows/${slideshowId}`,
                    {},
                    "DELETE"
                )
                setSlideshows((prev) =>
                    prev.filter((s) => s.id !== slideshowId)
                )
            }
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
                <Flex justify="space-between">
                    <Input
                        placeholder="Search"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                    <Link to="/slideshows/create">
                        <Button type="primary">Create slideshow</Button>
                    </Link>
                </Flex>
                <Table
                    columns={columns}
                    dataSource={filteredSlideshows}
                    rowKey="id"
                />
            </main>
        </AdminLayout>
    )
}
