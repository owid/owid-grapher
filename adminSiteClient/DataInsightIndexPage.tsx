import { useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import {
    Button,
    Card,
    Flex,
    Input,
    Radio,
    Select,
    Space,
    Table,
    Tag,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPen, faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons"
import { faFigma } from "@fortawesome/free-brands-svg-icons"

import { AdminLayout } from "./AdminLayout.js"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import { GdocsStoreContext } from "./GdocsStoreContext.js"
import { DbPlainTag, OwidGdocDataInsightIndexItem } from "@ourworldindata/types"
import { dayjs, startCase } from "@ourworldindata/utils"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"

type PublicationFilter = "all" | "published" | "scheduled" | "draft"
type Layout = "list" | "gallery"

const DEFAULT_PUBLICATION_FILTER: PublicationFilter = "all"
const DEFAULT_LAYOUT: Layout = "list"

const editIcon = <FontAwesomeIcon icon={faPen} size="sm" />
const linkIcon = <FontAwesomeIcon icon={faUpRightFromSquare} size="sm" />
const figmaIcon = <FontAwesomeIcon icon={faFigma} size="sm" />

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
                        src={makePreviewImageSrc(dataInsight)}
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
                        href={makePreviewLink(dataInsight)}
                        target="_blank"
                        icon={linkIcon}
                    >
                        Preview
                    </Button>
                    {dataInsight["grapher-url"] && (
                        <Button
                            href={dataInsight["grapher-url"]}
                            target="_blank"
                            icon={linkIcon}
                        >
                            Grapher page
                        </Button>
                    )}
                    {dataInsight["explorer-url"] && (
                        <Button
                            href={dataInsight["explorer-url"]}
                            target="_blank"
                            icon={linkIcon}
                        >
                            Explorer view
                        </Button>
                    )}
                    {dataInsight["figma-url"] && (
                        <Button
                            href={dataInsight["figma-url"]}
                            target="_blank"
                            icon={figmaIcon}
                        >
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
                <Space size="small" direction="vertical">
                    <Button
                        type="primary"
                        target="_blank"
                        href={makeGDocEditLink(dataInsight)}
                        icon={editIcon}
                    >
                        Edit GDoc
                    </Button>
                    {dataInsight["narrative-chart"] && (
                        <Button
                            type="primary"
                            href={makeNarrativeChartEditLink(dataInsight)}
                            target="_blank"
                            icon={editIcon}
                        >
                            Edit narrative chart
                        </Button>
                    )}
                </Space>
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
    const [publicationFilter, setPublicationFilter] =
        useState<PublicationFilter>(DEFAULT_PUBLICATION_FILTER)
    const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredDataInsights = useMemo(() => {
        const publicationFilterFn = (
            dataInsight: OwidGdocDataInsightIndexItem
        ) => {
            switch (publicationFilter) {
                case "draft":
                    return !dataInsight.published
                case "scheduled":
                    return (
                        dataInsight.published &&
                        dayjs(dataInsight.publishedAt).isAfter(dayjs())
                    )
                case "published":
                    return (
                        dataInsight.published &&
                        dayjs(dataInsight.publishedAt).isBefore(dayjs())
                    )
                default:
                    return true
            }
        }
        const searchFilterFn = filterFunctionForSearchWords(
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

        return dataInsights.filter(publicationFilterFn).filter(searchFilterFn)
    }, [dataInsights, publicationFilter, searchWords])

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
                    <Flex gap="small">
                        <Input
                            placeholder="Search"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") setSearchValue("")
                            }}
                            style={{ width: 500, marginBottom: 20 }}
                        />
                        <Select
                            value={publicationFilter}
                            options={[
                                { value: "all", label: "All" },
                                { value: "draft", label: "Drafts" },
                                { value: "published", label: "Published" },
                                { value: "scheduled", label: "Scheduled" },
                            ]}
                            onChange={(value: PublicationFilter) =>
                                setPublicationFilter(value)
                            }
                            popupMatchSelectWidth={false}
                        />
                        <Button
                            type="dashed"
                            onClick={() => {
                                setSearchValue("")
                                setPublicationFilter(DEFAULT_PUBLICATION_FILTER)
                            }}
                        >
                            Reset
                        </Button>
                    </Flex>
                    <Radio.Group
                        defaultValue="list"
                        onChange={(e) => setLayout(e.target.value)}
                    >
                        <Radio.Button value="list">List</Radio.Button>
                        <Radio.Button value="gallery">Gallery</Radio.Button>
                    </Radio.Group>
                </Flex>
                {layout === "list" && (
                    <DataInsightList
                        dataInsights={filteredDataInsights}
                        searchWords={searchWords}
                    />
                )}
                {layout === "gallery" && (
                    <DataInsightGallery dataInsights={filteredDataInsights} />
                )}
            </main>
        </AdminLayout>
    )
}

function DataInsightList({
    dataInsights,
    searchWords,
}: {
    dataInsights: OwidGdocDataInsightIndexItem[]
    searchWords: SearchWord[]
}) {
    const highlightFn = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )

    const columns = useMemo(() => createColumns({ highlightFn }), [highlightFn])

    return (
        <Table
            columns={columns}
            dataSource={dataInsights}
            rowKey={(dataInsight) => dataInsight.id}
        />
    )
}

function DataInsightGallery({
    dataInsights,
}: {
    dataInsights: OwidGdocDataInsightIndexItem[]
}) {
    const dataInsightsWithPreview = dataInsights.filter(
        (dataInsight) => dataInsight.image?.cloudflareId
    )
    return (
        <Flex wrap gap="large">
            {dataInsightsWithPreview.map((dataInsight, index) => (
                <DataInsightCard
                    key={`${dataInsight.id}-${index}`}
                    dataInsight={dataInsight}
                />
            ))}
        </Flex>
    )
}

function DataInsightCard({
    dataInsight,
}: {
    dataInsight: OwidGdocDataInsightIndexItem
}) {
    const preview = (
        <img
            src={makePreviewImageSrc(dataInsight)}
            style={{
                width: 265,
                height: 265,
                border: "1px solid #f0f0f0",
            }}
        />
    )

    return (
        <Card key={dataInsight.id} cover={preview}>
            <a
                href={makePreviewLink(dataInsight)}
                target="_blank"
                rel="noreferrer noopener"
            >
                Preview
            </a>
            {" / "}
            <a
                href={makeGDocEditLink(dataInsight)}
                target="_blank"
                rel="noreferrer noopener"
            >
                GDoc
            </a>
            {dataInsight["figma-url"] && (
                <>
                    {" / "}
                    <a
                        href={dataInsight["figma-url"]}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        Figma
                    </a>
                </>
            )}
        </Card>
    )
}

function makePreviewLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `/admin/gdocs/${dataInsight.id}/preview`
}

function makeGDocEditLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `https://docs.google.com/document/d/${dataInsight.id}/edit`
}

function makeNarrativeChartEditLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `/admin/chartViews/${dataInsight.narrativeChartId}/edit`
}

function makePreviewImageSrc(dataInsight: OwidGdocDataInsightIndexItem) {
    const { cloudflareId, originalWidth } = dataInsight.image ?? {}
    return `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=${originalWidth}`
}
