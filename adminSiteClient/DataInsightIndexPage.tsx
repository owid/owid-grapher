import { useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import {
    Button,
    Card,
    Flex,
    Input,
    notification,
    Radio,
    Select,
    Space,
    Table,
    Tooltip,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCopy,
    faPanorama,
    faPen,
    faUpload,
    faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons"
import { faFigma } from "@fortawesome/free-brands-svg-icons"

import { AdminLayout } from "./AdminLayout.js"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    DbEnrichedImageWithUserId,
    DbPlainTag,
    GRAPHER_MAP_TYPE,
    GrapherChartOrMapType,
    OwidGdocDataInsightIndexItem,
} from "@ourworldindata/types"
import {
    copyToClipboard,
    dayjs,
    RequiredBy,
    startCase,
} from "@ourworldindata/utils"
import {
    BAKED_BASE_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { ImageUploadResponse, makeImageSrc } from "./imagesHelpers.js"
import { ReuploadImageForDataInsightModal } from "./ReuploadImageForDataInsightModal.js"

type NarrativeDataInsightIndexItem = RequiredBy<
    OwidGdocDataInsightIndexItem,
    "image" | "narrativeChart"
>
type FigmaDataInsightIndexItem = RequiredBy<
    OwidGdocDataInsightIndexItem,
    "image" | "figmaUrl"
>

type DataInsightIndexItemThatCanBeUploaded =
    | NarrativeDataInsightIndexItem
    | FigmaDataInsightIndexItem

type FigmaResponse =
    | { success: true; imageUrl: string }
    | { success: false; errorMessage: string }

type ChartTypeFilter = GrapherChartOrMapType | "all"
type PublicationFilter = "all" | "published" | "scheduled" | "draft"
type Layout = "list" | "gallery"

const DEFAULT_CHART_TYPE_FILTER: ChartTypeFilter = "all"
const DEFAULT_PUBLICATION_FILTER: PublicationFilter = "all"
const DEFAULT_LAYOUT: Layout = "list"

const editIcon = <FontAwesomeIcon icon={faPen} size="sm" />
const linkIcon = <FontAwesomeIcon icon={faUpRightFromSquare} size="sm" />
const uploadIcon = <FontAwesomeIcon icon={faUpload} size="sm" />
const figmaIcon = <FontAwesomeIcon icon={faFigma} size="sm" />
const copyIcon = <FontAwesomeIcon icon={faCopy} size="sm" />
const panoramaIcon = <FontAwesomeIcon icon={faPanorama} size="sm" />

const NotificationContext = React.createContext(null)

function createColumns(ctx: {
    highlightFn: (
        text: string | null | undefined
    ) => React.ReactElement | string
    triggerImageUploadFlow: (
        dataInsight: DataInsightIndexItemThatCanBeUploaded
    ) => void
}): ColumnsType<OwidGdocDataInsightIndexItem> {
    return [
        {
            title: "Preview",
            key: "preview",
            render: (_, dataInsight) =>
                hasImage(dataInsight) ? (
                    <>
                        <img
                            className="border"
                            src={makeImageSrc(
                                dataInsight.image.cloudflareId,
                                dataInsight.image.originalWidth
                            )}
                            style={{ maxWidth: 200 }}
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={copyIcon}
                            onClick={() =>
                                copyToClipboard(dataInsight.image.filename)
                            }
                        >
                            Copy filename
                        </Button>
                    </>
                ) : undefined,
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            width: 300,
            render: (title, dataInsight) =>
                dataInsight.published &&
                dayjs(dataInsight.publishedAt).isBefore(dayjs()) &&
                dataInsight.slug ? (
                    <a
                        href={makeDataInsightLink(dataInsight)}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        {ctx.highlightFn(title)}
                    </a>
                ) : (
                    ctx.highlightFn(title)
                ),
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
                    {dataInsight.approvedBy &&
                        ` (approved by ${dataInsight.approvedBy})`}
                </>
            ),
        },
        {
            title: "Topic tags",
            dataIndex: "tags",
            key: "tags",
            render: (tags: DbPlainTag[]) =>
                tags.map((tag) => (
                    <a
                        key={tag.name}
                        href={`/admin/tags/${tag.id}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ display: "block" }}
                    >
                        {ctx.highlightFn(tag.name)}
                    </a>
                )),
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
                    {hasNarrativeChart(dataInsight) && (
                        <Button
                            href={makeNarrativeChartEditLink(dataInsight)}
                            target="_blank"
                            icon={panoramaIcon}
                        >
                            Narrative chart
                        </Button>
                    )}
                    {dataInsight.grapherUrl && (
                        <Button
                            href={dataInsight.grapherUrl}
                            target="_blank"
                            icon={linkIcon}
                        >
                            Grapher page
                        </Button>
                    )}
                    {dataInsight.explorerUrl && (
                        <Button
                            href={dataInsight.explorerUrl}
                            target="_blank"
                            icon={linkIcon}
                        >
                            Explorer view
                        </Button>
                    )}
                    {dataInsight.figmaUrl && (
                        <Button
                            href={dataInsight.figmaUrl}
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
                    {canReuploadImage(dataInsight) && (
                        <Tooltip title={makeUploadImageHelpText(dataInsight)}>
                            <Button
                                icon={uploadIcon}
                                onClick={() =>
                                    ctx.triggerImageUploadFlow(dataInsight)
                                }
                            >
                                Reupload image
                            </Button>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ]
}

export function DataInsightIndexPage() {
    const { admin } = useContext(AdminAppContext)

    const [dataInsights, setDataInsights] = useState<
        OwidGdocDataInsightIndexItem[]
    >([])

    const [searchValue, setSearchValue] = useState("")
    const [chartTypeFilter, setChartTypeFilter] = useState<
        GrapherChartOrMapType | "all"
    >(DEFAULT_CHART_TYPE_FILTER)
    const [publicationFilter, setPublicationFilter] =
        useState<PublicationFilter>(DEFAULT_PUBLICATION_FILTER)
    const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)

    const [dataInsightForImageUpload, setDataInsightForImageUpload] =
        useState<DataInsightIndexItemThatCanBeUploaded>()

    const [notificationApi, notificationContextHolder] =
        notification.useNotification()

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredDataInsights = useMemo(() => {
        const chartTypeFilterFn = (
            dataInsight: OwidGdocDataInsightIndexItem
        ) => {
            if (chartTypeFilter === "all") return true
            return dataInsight.chartType === chartTypeFilter
        }

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
                case "all":
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

        return dataInsights.filter(
            (di) =>
                chartTypeFilterFn(di) &&
                publicationFilterFn(di) &&
                searchFilterFn(di)
        )
    }, [dataInsights, chartTypeFilter, publicationFilter, searchWords])

    const columns = useMemo(() => {
        const highlightFn = highlightFunctionForSearchWords(searchWords)

        const triggerImageUploadFlow = (
            dataInsight: DataInsightIndexItemThatCanBeUploaded
        ) => setDataInsightForImageUpload(dataInsight)

        return createColumns({
            highlightFn,
            triggerImageUploadFlow,
        })
    }, [searchWords])

    const updateDataInsightPreview = (
        dataInsightId: string,
        uploadedImage: DbEnrichedImageWithUserId
    ) => {
        setDataInsights((dataInsights) =>
            dataInsights.map((dataInsight) =>
                dataInsight.id === dataInsightId
                    ? {
                          ...dataInsight,
                          image: dataInsight.image
                              ? {
                                    ...dataInsight.image,
                                    filename: uploadedImage.filename!,
                                    cloudflareId: uploadedImage.cloudflareId!,
                                    originalWidth: uploadedImage.originalWidth!,
                                }
                              : undefined,
                      }
                    : dataInsight
            )
        )
    }

    const onImageUploadComplete = async (
        response: ImageUploadResponse,
        dataInsight: { id: string; title: string }
    ) => {
        if (response.success) {
            updateDataInsightPreview(dataInsight.id, response.image)

            notificationApi.info({
                message: "Image replaced!",
                description:
                    "Make sure you update the alt text if your revision has substantive changes",
                placement: "bottomRight",
            })
        } else {
            notificationApi.warning({
                message: "Image upload failed",
                description: response?.errorMessage,
                placement: "bottomRight",
            })
        }
    }

    useEffect(() => {
        const fetchAllDataInsights = async () =>
            (await admin.getJSON(
                "/api/dataInsights"
            )) as OwidGdocDataInsightIndexItem[]

        void fetchAllDataInsights().then((dataInsights) =>
            setDataInsights(dataInsights)
        )
    }, [admin])

    return (
        <AdminLayout title="Data insights">
            <NotificationContext.Provider value={null}>
                {notificationContextHolder}
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
                                value={chartTypeFilter}
                                options={[
                                    {
                                        value: "all",
                                        label: "All chart types",
                                    },
                                    ...ALL_GRAPHER_CHART_TYPES.map((type) => ({
                                        value: type,
                                        label: startCase(type),
                                    })),
                                    {
                                        value: GRAPHER_MAP_TYPE,
                                        label: "World map",
                                    },
                                ]}
                                onChange={(value: ChartTypeFilter) =>
                                    setChartTypeFilter(value)
                                }
                                popupMatchSelectWidth={false}
                            />
                            <Select
                                value={publicationFilter}
                                options={[
                                    {
                                        value: "all",
                                        label: "Any publication status",
                                    },
                                    { value: "draft", label: "Drafts" },
                                    {
                                        value: "published",
                                        label: "Published",
                                    },
                                    {
                                        value: "scheduled",
                                        label: "Scheduled",
                                    },
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
                                    setChartTypeFilter(
                                        DEFAULT_CHART_TYPE_FILTER
                                    )
                                    setPublicationFilter(
                                        DEFAULT_PUBLICATION_FILTER
                                    )
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
                        <Table
                            columns={columns}
                            dataSource={filteredDataInsights}
                            rowKey={(dataInsight) => dataInsight.id}
                        />
                    )}
                    {layout === "gallery" && (
                        <DataInsightGallery
                            dataInsights={filteredDataInsights}
                        />
                    )}
                    {dataInsightForImageUpload && (
                        <UploadImageModal
                            admin={admin}
                            dataInsight={dataInsightForImageUpload}
                            onUploadComplete={onImageUploadComplete}
                            closeModal={() =>
                                setDataInsightForImageUpload(undefined)
                            }
                        />
                    )}
                </main>
            </NotificationContext.Provider>
        </AdminLayout>
    )
}

function DataInsightGallery({
    dataInsights,
}: {
    dataInsights: OwidGdocDataInsightIndexItem[]
}) {
    const dataInsightsWithPreviewImage = dataInsights.filter((dataInsight) =>
        hasImage(dataInsight)
    )
    return (
        <Flex wrap gap="large">
            {dataInsightsWithPreviewImage.map((dataInsight) => (
                <DataInsightCard
                    key={dataInsight.id}
                    dataInsight={dataInsight}
                />
            ))}
        </Flex>
    )
}

function DataInsightCard({
    dataInsight,
}: {
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "image">
}) {
    const preview = (
        <img
            className="border"
            src={makeImageSrc(
                dataInsight.image.cloudflareId,
                dataInsight.image.originalWidth
            )}
            style={{ width: 265, height: 265 }}
        />
    )

    return (
        <Card cover={preview}>
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
            {dataInsight.figmaUrl && (
                <>
                    {" / "}
                    <a
                        href={dataInsight.figmaUrl}
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

interface UploadImageModalProps<
    DataInsightIndexItem = DataInsightIndexItemThatCanBeUploaded,
> {
    admin: Admin
    dataInsight: DataInsightIndexItem
    onUploadComplete: (
        response: ImageUploadResponse,
        dataInsight: { id: string; title: string }
    ) => void
    closeModal: () => void
}

function UploadImageModal(props: UploadImageModalProps) {
    const { dataInsight, ...restProps } = props

    // Prefer Figma over narrative charts if both are present
    if (canReuploadFigmaImage(dataInsight)) {
        return (
            <UploadFigmaImageModal dataInsight={dataInsight} {...restProps} />
        )
    }

    if (canReuploadNarrativeChartImage(dataInsight)) {
        return (
            <UploadNarrativeChartImageModal
                dataInsight={dataInsight}
                {...restProps}
            />
        )
    }

    return null
}

function UploadNarrativeChartImageModal({
    dataInsight,
    onUploadComplete,
    closeModal,
}: UploadImageModalProps<NarrativeDataInsightIndexItem>) {
    const sourceUrl = makePngUrlForNarrativeChart(dataInsight)

    return (
        <ReuploadImageForDataInsightModal
            description={makeUploadImageHelpText(dataInsight)}
            dataInsight={dataInsight}
            existingImage={dataInsight.image}
            sourceUrl={sourceUrl}
            onUploadComplete={onUploadComplete}
            closeModal={closeModal}
        />
    )
}

function UploadFigmaImageModal({
    admin,
    dataInsight,
    onUploadComplete,
    closeModal,
}: UploadImageModalProps<FigmaDataInsightIndexItem>) {
    const [figmaImageUrl, setFigmaImageUrl] = useState<string | undefined>()
    const [isLoadingFigmaImageUrl, setIsLoadingFigmaImageUrl] = useState(false)
    const [figmaLoadingError, setFigmaLoadingError] = useState<
        string | undefined
    >()

    useEffect(() => {
        const fetchFigmaImage = async () => {
            setIsLoadingFigmaImageUrl(true)
            try {
                const response = await fetchFigmaProvidedImageUrl(
                    admin,
                    dataInsight.figmaUrl
                )
                setFigmaImageUrl(
                    response.success ? response.imageUrl : undefined
                )
                setFigmaLoadingError(
                    !response.success ? response.errorMessage : undefined
                )
            } catch (error) {
                if (error instanceof Error) setFigmaLoadingError(error.message)
            } finally {
                setIsLoadingFigmaImageUrl(false)
            }
        }
        void fetchFigmaImage()
    }, [dataInsight, admin])

    return (
        <ReuploadImageForDataInsightModal
            description={makeUploadImageHelpText(dataInsight)}
            dataInsight={dataInsight}
            existingImage={dataInsight.image}
            sourceUrl={figmaImageUrl}
            isLoadingSourceUrl={isLoadingFigmaImageUrl}
            loadingSourceUrlError={figmaLoadingError}
            onUploadComplete={onUploadComplete}
            closeModal={closeModal}
        />
    )
}

function hasNarrativeChart(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is RequiredBy<OwidGdocDataInsightIndexItem, "narrativeChart"> {
    return !!dataInsight.narrativeChart
}

function hasImage(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is RequiredBy<OwidGdocDataInsightIndexItem, "image"> {
    return !!dataInsight.image
}

function hasFigmaUrl(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is RequiredBy<OwidGdocDataInsightIndexItem, "figmaUrl"> {
    return !!dataInsight.figmaUrl
}

function canReuploadNarrativeChartImage(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is NarrativeDataInsightIndexItem {
    return hasImage(dataInsight) && hasNarrativeChart(dataInsight)
}

function canReuploadFigmaImage(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is FigmaDataInsightIndexItem {
    return hasImage(dataInsight) && hasFigmaUrl(dataInsight)
}

function canReuploadImage(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is DataInsightIndexItemThatCanBeUploaded {
    return (
        canReuploadNarrativeChartImage(dataInsight) ||
        canReuploadFigmaImage(dataInsight)
    )
}

function makeUploadImageHelpText(
    dataInsight: DataInsightIndexItemThatCanBeUploaded
): string {
    if (canReuploadFigmaImage(dataInsight))
        return "Fetch a PNG from Figma and upload it as the image for this data insight"
    else if (canReuploadNarrativeChartImage(dataInsight))
        return "Fetch a PNG of the narrative chart and upload it as the image for this data insight"
    else return ""
}

async function fetchFigmaProvidedImageUrl(
    admin: Admin,
    figmaUrl: string
): Promise<FigmaResponse> {
    const { fileId, nodeId } = extractIdsFromFigmaUrl(figmaUrl) ?? {}
    if (!fileId || !nodeId)
        return {
            success: false,
            errorMessage:
                "Invalid Figma URL. The provided URL should point to a Figma node.",
        }

    try {
        return admin.getJSON("/api/figma/image", { fileId, nodeId })
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error)
        return { success: false, errorMessage }
    }
}

function extractIdsFromFigmaUrl(
    figmaUrl: string
): { fileId: string; nodeId: string } | undefined {
    const regex =
        /figma\.com\/design\/(?<fileId>[^/]+).*[?&]node-id=(?<nodeId>[^&]+)/
    const { groups } = figmaUrl.match(regex) ?? {}
    if (groups) {
        const fileId = groups.fileId
        const nodeId = groups.nodeId.replace("-", ":")
        return { fileId, nodeId }
    }
    return undefined
}

function makePreviewLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `/admin/gdocs/${dataInsight.id}/preview`
}

function makeGDocEditLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `https://docs.google.com/document/d/${dataInsight.id}/edit`
}

function makeDataInsightLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `${BAKED_BASE_URL}/data-insights/${dataInsight.slug}`
}

function makeNarrativeChartEditLink(
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "narrativeChart">
) {
    return `/admin/chartViews/${dataInsight.narrativeChart.id}/edit`
}

function makePngUrlForNarrativeChart(
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "narrativeChart">
) {
    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${dataInsight.narrativeChart.chartConfigId}.png?imType=square&nocache`
}
