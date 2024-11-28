import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
import { Button, Flex, Input, Space, Table } from "antd"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import { ApiChartViewOverview } from "../adminShared/AdminTypes.js"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { Link } from "./Link.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"

function createColumns(
    highlightFn: (
        text: string | null | undefined
    ) => React.ReactElement | string
): ColumnsType<ApiChartViewOverview> {
    return [
        {
            title: "Preview",
            key: "chartConfigId",
            dataIndex: "chartConfigId",
            width: 200,
            render: (chartConfigId) => (
                <img
                    src={`${BAKED_GRAPHER_URL}/by-uuid/${chartConfigId}.svg`}
                    style={{ maxWidth: 200, maxHeight: 200 }}
                />
            ),
        },
        {
            title: "Slug",
            dataIndex: "slug",
            key: "slug",
            width: 150,
            render: (slug) => highlightFn(slug),
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            render: (title) => highlightFn(title),
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
            render: (parent) => (
                <Link to={`/charts/${parent.id}/edit`}>
                    {highlightFn(parent.title)}
                </Link>
            ),
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
            render: (time, chartView) => (
                <Timeago time={time} by={chartView.lastEditedByUser} />
            ),
        },
        {
            title: "Action",
            key: "action",
            width: 100,
            render: (_, chartView) => (
                <Space size="middle">
                    <Button
                        type="primary"
                        href={`/admin/chartViews/${chartView.id}/edit`}
                    >
                        Edit
                    </Button>
                </Space>
            ),
        },
    ]
}

export function ChartViewIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [chartViews, setChartViews] = useState<ApiChartViewOverview[]>([])
    const [searchValue, setSearchValue] = useState("")

    const getChartViews = useCallback(async () => {
        const json = await admin.getJSON<{
            chartViews: ApiChartViewOverview[]
        }>("/api/chartViews")
        setChartViews(json.chartViews)
    }, [admin])

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredChartViews = useMemo(() => {
        const filterFn = filterFunctionForSearchWords(
            searchWords,
            (chartView: ApiChartViewOverview) => [
                `${chartView.id}`,
                chartView.title,
                chartView.slug,
                chartView.parent.title,
            ]
        )

        return chartViews.filter(filterFn)
    }, [chartViews, searchWords])
    const highlightFn = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )
    const columns = useMemo(() => createColumns(highlightFn), [highlightFn])

    useEffect(() => {
        void getChartViews()
    }, [getChartViews])

    return (
        <AdminLayout title="Chart views">
            <main className="ChartViewIndexPage">
                <Flex justify="space-between">
                    <Input
                        placeholder="Search"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                </Flex>
                <Table columns={columns} dataSource={filteredChartViews} />
            </main>
        </AdminLayout>
    )
}
