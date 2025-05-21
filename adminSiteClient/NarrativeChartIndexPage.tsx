import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import { Button, Flex, Input, Space, Table, TableColumnsType } from "antd"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import { ApiNarrativeChartOverview } from "../adminShared/AdminTypes.js"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"
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
    deleteFn: (narrativeChartId: number) => void
}): TableColumnsType<ApiNarrativeChartOverview> {
    return [
        {
            title: "Preview",
            key: "chartConfigId",
            dataIndex: "chartConfigId",
            width: 200,
            render: (chartConfigId) => (
                <img
                    src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${chartConfigId}.svg`}
                    style={{ maxWidth: 200, maxHeight: 200 }}
                />
            ),
        },
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            width: 150,
            render: (name) => ctx.highlightFn(name),
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            render: (title) => ctx.highlightFn(title),
        },
        {
            title: "ID",
            dataIndex: "id",
            width: 50,
            key: "id",
        },
        {
            title: "Parent",
            dataIndex: "parent",
            key: "parent",
            render: (parent) => {
                const title = ctx.highlightFn(parent.title)
                if (!parent.url) return title
                return parent.type === "chart" ? (
                    <Link to={parent.url}>{title}</Link>
                ) : (
                    <a
                        href={`/admin${parent.url}`}
                        target="_blank"
                        rel="noopener"
                    >
                        {title}
                    </a>
                )
            },
            width: 200,
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
            render: (time, narrativeChart) => (
                <Timeago time={time} by={narrativeChart.lastEditedByUser} />
            ),
        },
        {
            title: "Action",
            key: "action",
            width: 100,
            render: (_, narrativeChart) => (
                <Space size="middle">
                    <Link to={`/narrative-charts/${narrativeChart.id}/edit`}>
                        <Button type="primary">Edit</Button>
                    </Link>
                    <Button
                        type="dashed"
                        danger
                        onClick={() => ctx.deleteFn(narrativeChart.id)}
                    >
                        Delete
                    </Button>
                </Space>
            ),
        },
    ]
}

export function NarrativeChartIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [narrativeCharts, setNarrativeCharts] = useState<
        ApiNarrativeChartOverview[]
    >([])
    const [searchValue, setSearchValue] = useState("")

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredNarrativeCharts = useMemo(() => {
        const filterFn = filterFunctionForSearchWords(
            searchWords,
            (narrativeChart: ApiNarrativeChartOverview) => [
                `${narrativeChart.id}`,
                narrativeChart.title,
                narrativeChart.name,
                narrativeChart.parent.title,
            ]
        )

        return narrativeCharts.filter(filterFn)
    }, [narrativeCharts, searchWords])
    const highlightFn = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )
    const deleteFn = useCallback(
        async (narrativeChartId: number) => {
            if (
                confirm("Are you sure you want to delete this narrative chart?")
            ) {
                await admin
                    .requestJSON(
                        `/api/narrative-charts/${narrativeChartId}`,
                        {},
                        "DELETE"
                    )
                    .then(() => alert("Narrative chart deleted"))
                    .then(() => window.location.reload())
            }
        },
        [admin]
    )
    const columns = useMemo(
        () => createColumns({ highlightFn, deleteFn }),
        [highlightFn, deleteFn]
    )

    useEffect(() => {
        const getNarrativeCharts = async () =>
            await admin.getJSON<{
                narrativeCharts: ApiNarrativeChartOverview[]
            }>("/api/narrative-charts")

        void getNarrativeCharts().then((res) =>
            setNarrativeCharts(res.narrativeCharts)
        )
    }, [admin])

    return (
        <AdminLayout title="Narrative charts">
            <main>
                <Flex justify="space-between">
                    <Input
                        placeholder="Search"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                </Flex>
                <Table columns={columns} dataSource={filteredNarrativeCharts} />
            </main>
        </AdminLayout>
    )
}
