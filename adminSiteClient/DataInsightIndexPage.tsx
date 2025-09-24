import * as _ from "lodash-es"
import {
    useContext,
    useEffect,
    useMemo,
    useState,
    useCallback,
    createContext,
    Fragment,
} from "react"
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
    faRotate,
    faPlus,
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
import { Admin } from "./Admin.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    DbEnrichedImageWithUserId,
    GRAPHER_MAP_TYPE,
    GrapherChartOrMapType,
    OwidGdocDataInsightIndexItem,
    MinimalTag,
    MinimalTagWithIsTopic,
} from "@ourworldindata/types"
import { copyToClipboard, dayjs, RequiredBy } from "@ourworldindata/utils"
import {
    BAKED_BASE_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    fetchFigmaProvidedImageUrl,
    ImageUploadResponse,
    makeImageSrc,
} from "./imagesHelpers.js"
import { ReuploadImageForDataInsightModal } from "./ReuploadImageForDataInsightModal.js"
import { CreateDataInsightModal } from "./CreateDataInsightModal.js"
import { EditableTags } from "./EditableTags.js"

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

type ChartTypeFilter = GrapherChartOrMapType
type PublicationFilter = "published" | "scheduled" | "draft"
type Layout = "list" | "gallery"

const DEFAULT_LAYOUT: Layout = "list"

const editIcon = <FontAwesomeIcon icon={faPen} size="sm" />
const linkIcon = <FontAwesomeIcon icon={faUpRightFromSquare} size="sm" />
const rotateIcon = <FontAwesomeIcon icon={faRotate} size="sm" />
const figmaIcon = <FontAwesomeIcon icon={faFigma} size="sm" />
const copyIcon = <FontAwesomeIcon icon={faCopy} size="sm" />
const panoramaIcon = <FontAwesomeIcon icon={faPanorama} size="sm" />
const plusIcon = <FontAwesomeIcon icon={faPlus} size="sm" />

const NotificationContext = createContext(null)

function createColumns(ctx: {
    availableTopicTags: MinimalTag[]
    updateTags: (gdocId: string, tags: MinimalTag[]) => Promise<void>
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
            width: 200,
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
                        <Fragment key={author}>
                            {ctx.highlightFn(author)}
                            {index < authors.length - 1 ? ", " : ""}
                        </Fragment>
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
            render: (tags, dataInsight) => (
                <EditableTags
                    tags={tags}
                    onSave={(tags) =>
                        ctx.updateTags(dataInsight.id, tags as MinimalTag[])
                    }
                    suggestions={ctx.availableTopicTags}
                />
            ),
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
                        target="_blank"
                        href={makeGDocEditLink(dataInsight)}
                        icon={editIcon}
                    >
                        Edit GDoc
                    </Button>
                    {canReuploadImage(dataInsight) && (
                        <Tooltip title={makeUploadImageHelpText(dataInsight)}>
                            <Button
                                icon={rotateIcon}
                                onClick={() =>
                                    ctx.triggerImageUploadFlow(dataInsight)
                                }
                            >
                                Update image
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

    const [dataInsights, setDataInsights, refreshDataInsights] =
        useDataInsights(admin)

    const [availableTopicTags, setAvailableTopicTags] = useState<MinimalTag[]>(
        []
    )

    const [searchValue, setSearchValue] = useState("")
    const [topicTagFilter, setTopicTagFilter] = useState<string | undefined>()
    const [chartTypeFilter, setChartTypeFilter] = useState<
        GrapherChartOrMapType | undefined
    >()
    const [publicationFilter, setPublicationFilter] = useState<
        PublicationFilter | undefined
    >()
    const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)

    const [dataInsightForImageUpload, setDataInsightForImageUpload] =
        useState<DataInsightIndexItemThatCanBeUploaded>()

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const [notificationApi, notificationContextHolder] =
        notification.useNotification()

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredDataInsights = useMemo(() => {
        const topicTagFilterFn = (
            dataInsight: OwidGdocDataInsightIndexItem
        ) => {
            if (!topicTagFilter) return true
            return dataInsight.tags?.some((tag) => tag.name === topicTagFilter)
        }

        const chartTypeFilterFn = (
            dataInsight: OwidGdocDataInsightIndexItem
        ) => {
            if (!chartTypeFilter) return true
            return dataInsight.chartType === chartTypeFilter
        }

        const publicationFilterFn = (
            dataInsight: OwidGdocDataInsightIndexItem
        ) => {
            if (!publicationFilter) return true
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
            }
        }

        const searchFilterFn = filterFunctionForSearchWords(
            searchWords,
            (dataInsight: OwidGdocDataInsightIndexItem) => [
                dataInsight.title,
                dataInsight.slug,
                _.startCase(dataInsight.chartType),
                ...(dataInsight.tags ?? []).map((tag) => tag.name),
                ...dataInsight.authors,
                dataInsight.markdown ?? "",
            ]
        )

        return dataInsights.filter(
            (di) =>
                topicTagFilterFn(di) &&
                chartTypeFilterFn(di) &&
                publicationFilterFn(di) &&
                searchFilterFn(di)
        )
    }, [
        dataInsights,
        topicTagFilter,
        chartTypeFilter,
        publicationFilter,
        searchWords,
    ])

    const updateTags = useCallback(
        async (gdocId: string, tags: MinimalTag[]) => {
            const json = await admin.requestJSON(
                `/api/gdocs/${gdocId}/setTags`,
                { tagIds: tags.map((t) => t.id) },
                "POST"
            )
            if (json.success) {
                const dataInsight = dataInsights.find(
                    (gdoc) => gdoc.id === gdocId
                )
                if (dataInsight) dataInsight.tags = tags
            }
        },
        [admin, dataInsights]
    )

    const columns = useMemo(() => {
        const highlightFn = highlightFunctionForSearchWords(searchWords)

        const triggerImageUploadFlow = (
            dataInsight: DataInsightIndexItemThatCanBeUploaded
        ) => setDataInsightForImageUpload(dataInsight)

        return createColumns({
            availableTopicTags,
            updateTags,
            highlightFn,
            triggerImageUploadFlow,
        })
    }, [searchWords, availableTopicTags, updateTags])

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
                                    id: uploadedImage.id,
                                    filename: uploadedImage.filename,
                                    cloudflareId: uploadedImage.cloudflareId,
                                    originalWidth: uploadedImage.originalWidth,
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
        const fetchTags = () =>
            admin.getJSON<{ tags: MinimalTagWithIsTopic[] }>("/api/tags.json")

        void fetchTags().then((result) =>
            setAvailableTopicTags(result.tags.filter((tag) => tag.isTopic))
        )
    }, [admin])

    return (
        <AdminLayout title="Data insights">
            <NotificationContext.Provider value={null}>
                {notificationContextHolder}
                <main className="DataInsightIndexPage">
                    <Flex
                        gap="small"
                        justify="space-between"
                        style={{ marginBottom: 20 }}
                    >
                        <Flex gap="small" wrap>
                            <Input
                                placeholder="Search"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") setSearchValue("")
                                }}
                                style={{ width: 350 }}
                            />
                            <Select
                                value={topicTagFilter}
                                placeholder="Select a topic tag..."
                                options={availableTopicTags.map((tag) => ({
                                    value: tag.name,
                                    label: tag.name,
                                }))}
                                onChange={(tag: string) =>
                                    setTopicTagFilter(tag)
                                }
                                allowClear
                                popupMatchSelectWidth={false}
                            />
                            <Select
                                value={chartTypeFilter}
                                placeholder="Select a chart type..."
                                options={[
                                    ...ALL_GRAPHER_CHART_TYPES.map((type) => ({
                                        value: type,
                                        label: _.startCase(type),
                                    })),
                                    {
                                        value: GRAPHER_MAP_TYPE,
                                        label: "World map",
                                    },
                                ]}
                                onChange={(value: ChartTypeFilter) =>
                                    setChartTypeFilter(value)
                                }
                                allowClear
                                popupMatchSelectWidth={false}
                            />
                            <Select
                                value={publicationFilter}
                                placeholder="Select a publication status..."
                                options={[
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
                                allowClear
                                popupMatchSelectWidth={false}
                            />
                            <Button
                                type="dashed"
                                onClick={() => {
                                    setSearchValue("")
                                    setTopicTagFilter(undefined)
                                    setChartTypeFilter(undefined)
                                    setPublicationFilter(undefined)
                                }}
                            >
                                Reset
                            </Button>
                        </Flex>
                        <Flex gap="small">
                            <Radio.Group
                                defaultValue="list"
                                onChange={(e) => setLayout(e.target.value)}
                                block
                            >
                                <Radio.Button value="list">List</Radio.Button>
                                <Radio.Button value="gallery">
                                    Gallery
                                </Radio.Button>
                            </Radio.Group>
                            <Button
                                type="primary"
                                icon={plusIcon}
                                onClick={() => setIsCreateModalOpen(true)}
                            >
                                Add DI
                            </Button>
                        </Flex>
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
                    {isCreateModalOpen && (
                        <CreateDataInsightModal
                            closeModal={() => setIsCreateModalOpen(false)}
                            onFinish={(response) => {
                                if (response.success) {
                                    void refreshDataInsights()
                                    setIsCreateModalOpen(false)
                                    window.open(
                                        `/admin/gdocs/${response.gdocId}/preview`,
                                        "_blank"
                                    )
                                }
                            }}
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

const useDataInsights = (admin: Admin) => {
    const [dataInsights, setDataInsights] = useState<
        OwidGdocDataInsightIndexItem[]
    >([])

    const fetchAndUpdateDataInsights = useCallback(async () => {
        const updatedDataInsights =
            await admin.getJSON<OwidGdocDataInsightIndexItem[]>(
                "/api/dataInsights"
            )
        setDataInsights(updatedDataInsights)
        return updatedDataInsights
    }, [admin])

    useEffect(() => {
        void fetchAndUpdateDataInsights()
    }, [fetchAndUpdateDataInsights])

    return [dataInsights, setDataInsights, fetchAndUpdateDataInsights] as const
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
    return `/admin/narrative-charts/${dataInsight.narrativeChart.id}/edit`
}

function makePngUrlForNarrativeChart(
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "narrativeChart">
) {
    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${dataInsight.narrativeChart.chartConfigId}.png?imType=square&nocache`
}
