import { useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import { Button, Flex, Input, Space, Table, Tag } from "antd"

import { AdminLayout } from "./AdminLayout.js"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import { GdocsStoreContext } from "./GdocsStoreContext.js"
import { DbPlainTag, OwidGdocDataInsightIndexItem } from "@ourworldindata/types"
import { dayjs, startCase } from "@ourworldindata/utils"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"

function createColumns(ctx: {
    highlightFn: (
        text: string | null | undefined
    ) => React.ReactElement | string
}): ColumnsType<OwidGdocDataInsightIndexItem> {
    return [
        {
            title: "Preview",
            key: "preview",
            render: (_, dataInsight) =>
                dataInsight.image?.cloudflareId ? (
                    <img
                        src={`${CLOUDFLARE_IMAGES_URL}/${dataInsight.image.cloudflareId}/w=${dataInsight.image.originalWidth}`}
                        style={{ maxWidth: 150 }}
                    />
                ) : undefined,
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            width: 300,
            render: (title) => ctx.highlightFn(title),
        },
        {
            title: "Authors",
            dataIndex: "authors",
            key: "authors",
            width: 150,
            render: (authors: string[], dataInsight) => (
                <>
                    {authors.map((author, index) => (
                        <React.Fragment key={author}>
                            {ctx.highlightFn(author)}
                            {index < authors.length - 1 ? ", " : ""}
                        </React.Fragment>
                    ))}
                    {dataInsight["approved-by"] &&
                        ` (approved by ${dataInsight["approved-by"]})`}
                </>
            ),
        },
        {
            title: "Tags",
            dataIndex: "tags",
            key: "tags",
            render: (tags: DbPlainTag[]) =>
                tags.map((tag) => (
                    <Space key={tag.name} size="small">
                        <Tag color="orange">
                            <a
                                href={`/admin/tags/${tag.id}`}
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                {ctx.highlightFn(tag.name)}
                            </a>
                        </Tag>
                    </Space>
                )),
        },
        {
            title: "Chart type",
            dataIndex: "chartType",
            key: "chartType",
            width: 150,
            render: (chartType) => ctx.highlightFn(startCase(chartType)),
        },
        {
            title: "Published",
            dataIndex: "publishedAt",
            key: "publishedAt",
            render: (publishedAt) => {
                if (!publishedAt) return undefined
                const publicationDate = dayjs(publishedAt)
                const isScheduledForPublication =
                    publicationDate.isAfter(dayjs())
                if (isScheduledForPublication)
                    return (
                        <>
                            Scheduled for publication{" "}
                            <Timeago time={publishedAt} />
                        </>
                    )
                return (
                    <>
                        Published <Timeago time={publishedAt} />
                    </>
                )
            },
        },
        {
            title: "Links",
            key: "links",
            render: (_, dataInsight) => (
                <Space size="small" direction="vertical">
                    <Button
                        href={`/admin/gdocs/${dataInsight.id}/preview`}
                        target="_blank"
                    >
                        Preview
                    </Button>
                    {dataInsight["narrative-view"] && (
                        <Button
                            href={dataInsight["narrative-view"]}
                            target="_blank"
                        >
                            Narrative chart
                        </Button>
                    )}
                    {dataInsight["grapher-url"] && (
                        <Button
                            href={dataInsight["grapher-url"]}
                            target="_blank"
                        >
                            Grapher page
                        </Button>
                    )}
                    {dataInsight["explorer-url"] && (
                        <Button
                            href={dataInsight["explorer-url"]}
                            target="_blank"
                        >
                            Explorer view
                        </Button>
                    )}
                    {dataInsight["figma-url"] && (
                        <Button href={dataInsight["figma-url"]} target="_blank">
                            Figma
                        </Button>
                    )}
                </Space>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            render: (_, dataInsight) => (
                <Button
                    type="primary"
                    href={`https://docs.google.com/document/d/${dataInsight.id}/edit`}
                >
                    Edit GDoc
                </Button>
            ),
        },
    ]
}

export function DataInsightIndexPage() {
    const context = useContext(GdocsStoreContext)
    const [dataInsights, setDataInsights] = useState<
        OwidGdocDataInsightIndexItem[]
    >([])
    const [searchValue, setSearchValue] = useState("")

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredDataInsights = useMemo(() => {
        const filterFn = filterFunctionForSearchWords(
            searchWords,
            (dataInsight: OwidGdocDataInsightIndexItem) => [
                dataInsight.title,
                dataInsight.slug,
                startCase(dataInsight.chartType),
                ...(dataInsight.tags ?? []).map((tag) => tag.name),
                ...dataInsight.authors,
                dataInsight.markdown ?? "",
            ]
        )

        return dataInsights.filter(filterFn)
    }, [dataInsights, searchWords])

    const highlightFn = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )

    const columns = useMemo(() => createColumns({ highlightFn }), [highlightFn])

    useEffect(() => {
        const fetchAllDataInsights = async () =>
            (await context?.admin.getJSON(
                "/api/dataInsights"
            )) as OwidGdocDataInsightIndexItem[]

        void fetchAllDataInsights().then((dataInsights) =>
            setDataInsights(dataInsights)
        )
    }, [context?.admin])

    return (
        <AdminLayout title="Data insights">
            <main className="DataInsightIndexPage">
                <Flex justify="space-between">
                    <Input
                        placeholder="Search"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setSearchValue("")
                        }}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                </Flex>
                <Table columns={columns} dataSource={filteredDataInsights} />
            </main>
        </AdminLayout>
    )
}
