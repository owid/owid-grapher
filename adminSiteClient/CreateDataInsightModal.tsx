import {
    faCheck,
    faSpinner,
    faRobot,
    faCheckCircle,
    faCircleXmark,
    faDownload,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    Form,
    Modal,
    Input,
    Button,
    Space,
    Flex,
    Select,
    FormItemProps,
} from "antd"
import { ValidateStatus } from "antd/es/form/FormItem"
import {
    Fragment,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
import cx from "classnames"
import {
    fetchFigmaProvidedImageUrl,
    ImageUploadResponse,
    makeImageSrc,
    uploadImageFromSourceUrl,
} from "./imagesHelpers"
import { AdminAppContext } from "./AdminAppContext"
import {
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
    SLACK_DI_PITCHES_CHANNEL_ID,
} from "../settings/clientSettings"
import { LoadingImage } from "./ReuploadImageForDataInsightModal"
import { ApiChartViewOverview } from "../adminShared/AdminTypes"
import {
    downloadImage,
    isEmpty,
    MinimalTag,
    MinimalTagWithIsTopic,
    RequiredBy,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { Checkbox } from "antd/lib"

const DEFAULT_RUNNING_MESSAGE: Record<Task, string> = {
    createDI: "Creating data insight...",
    uploadImage: "Uploading image...",
    loadFigmaImage: "Loading Figma image...",
    suggestAltText: "Suggesting alt text...",
    setTopicTags: "Setting topic tags...",
    sendSlackMessage: "Sending Slack message...",
} as const

const DEFAULT_SUCCESS_MESSAGE: Record<Task, string> = {
    createDI: "Data insight created successfully",
    uploadImage: "Image uploaded successfully",
    loadFigmaImage: "Figma image loaded successfully",
    suggestAltText: "Alt text suggested successfully",
    setTopicTags: "Topic tags assigned",
    sendSlackMessage: "Slack message sent",
} as const

const DEFAULT_ERROR_MESSAGE: Record<Task, string> = {
    createDI: "Data insight creation failed",
    uploadImage: "Uploading image failed",
    loadFigmaImage: "Loading Figma image failed",
    suggestAltText: "Suggesting alt text failed",
    setTopicTags: "Setting topic tags failed",
    sendSlackMessage: "Sending Slack message failed",
} as const

type Task =
    | "createDI"
    | "uploadImage"
    | "loadFigmaImage"
    | "suggestAltText"
    | "setTopicTags"
    | "sendSlackMessage"

type Progress =
    | { status: "idle" }
    | { status: "running"; message: string }
    | { status: "complete"; success: boolean; message: string }

type FormFieldName =
    | "title"
    | "authors"
    | "topicTagIds"
    | "grapherUrl"
    | "narrativeChart"
    | "figmaUrl"
    | "imageFilename"
    | "imageAltText"
    | "slackNote"
type ImageFormFieldName = "imageFilename" | "imageAltText"

type FormData = Partial<
    Omit<Record<FormFieldName, string>, "topicTagIds"> & {
        topicTagIds?: number[]
    }
>
type FormDataWithTitle = RequiredBy<FormData, "title">
type FormDataWithImageFilename = RequiredBy<FormData, "imageFilename">

type DataInsightCreationResponse =
    | { success: true; gdocId: string }
    | { success: false; errorMessage: string }

interface NarrativeChart {
    name: string
    configId: string
    title: string
}

type ImageSource = "figma" | "narrativeChart" | "grapher" | "explorer"

const spinnerIcon = <FontAwesomeIcon icon={faSpinner} size="sm" spin />
const checkIcon = <FontAwesomeIcon icon={faCheck} size="sm" />
const robotIcon = <FontAwesomeIcon icon={faRobot} size="sm" />
const successIcon = <FontAwesomeIcon icon={faCheckCircle} size="sm" />
const failIcon = <FontAwesomeIcon icon={faCircleXmark} size="sm" />
const downloadIcon = <FontAwesomeIcon icon={faDownload} size="sm" />

export function CreateDataInsightModal(props: {
    // modal settings
    description?: string
    initialValues?: FormData
    hiddenFields?: Omit<FormFieldName, ImageFormFieldName>[]

    // data
    narrativeChart?: NarrativeChart // create a DI for this narrative chart if given

    // actions
    closeModal: () => void
    onFinish?: (response: DataInsightCreationResponse) => void
}) {
    const { admin } = useContext(AdminAppContext)

    const initialValues = useMemo(
        () => props.initialValues ?? {},
        [props.initialValues]
    )
    const hiddenFields = useMemo(
        () => props.hiddenFields ?? [],
        [props.hiddenFields]
    )

    const [form] = Form.useForm<FormData>()
    const [formData, setFormData] = useState<FormData>(initialValues)

    // tracks progress of various tasks like uploading an image or creating a DI
    const { progress, setProgress, updateProgress } = useProgress(
        "createDI",
        "uploadImage",
        "loadFigmaImage",
        "suggestAltText",
        "setTopicTags",
        "sendSlackMessage"
    )

    const [shouldSendMessageToSlack, setShouldSendMessageToSlack] =
        useState(true)

    // loaded from Figma if a Figma URL is provided
    const [figmaImageUrl, setFigmaImageUrl] = useState<string | undefined>()

    // used for autocompletion
    const [allTopicTags, setAllTopicTags] = useState<MinimalTag[]>([])

    // used for autocompletion
    const [allNarrativeCharts, setAllNarrativeCharts] = useState<
        NarrativeChart[]
    >([])

    const allNarrativeChartsMap = useMemo(
        () => new Map(allNarrativeCharts.map((chart) => [chart.name, chart])),
        [allNarrativeCharts]
    )

    const narrativeChart = formData.narrativeChart
        ? allNarrativeChartsMap.get(formData.narrativeChart)
        : props.narrativeChart

    const topicTags = allTopicTags.filter((tag) =>
        formData.topicTagIds?.includes(tag.id)
    )

    const getDataInsightImageUrl = (args?: {
        cache: boolean
    }): { source: ImageSource; url: string } | undefined => {
        if (figmaImageUrl) return { source: "figma", url: figmaImageUrl }

        // A figma URL is specified but no figma image url could be loaded
        if (formData.figmaUrl) return undefined

        const options = { cache: args?.cache ?? false }

        if (narrativeChart)
            return {
                source: "narrativeChart",
                url: makePngUrlForNarrativeChart(
                    narrativeChart.configId,
                    options
                ),
            }

        const grapherUrl = formData.grapherUrl?.trim()
        if (grapherUrl && grapherUrl.includes("/grapher/")) {
            return {
                source: "grapher",
                url: makePngUrlForGrapherOrExplorer(grapherUrl, options),
            }
        }
        if (grapherUrl && grapherUrl.includes("/explorers/")) {
            return {
                source: "explorer",
                url: makePngUrlForGrapherOrExplorer(grapherUrl, options),
            }
        }

        return undefined
    }

    const { url: imageUrl, source: imageSource } =
        getDataInsightImageUrl() ?? {}
    const { url: cachedImageUrl } =
        getDataInsightImageUrl({ cache: true }) ?? {}

    const shouldShowField = useCallback(
        (fieldName: FormFieldName) => !hiddenFields.includes(fieldName),
        [hiddenFields]
    )

    const setFormField = (name: FormFieldName, value: string) => {
        // update form and revalidate
        form.setFieldValue(name, value)
        void form.validateFields()

        // update form data
        setFormData((formData) => ({
            ...formData,
            [name]: value,
        }))
    }

    const handleSubmit = async (formData: FormData) => {
        // prevent multiple simultaneous submissions
        if (progress.createDI.status === "running") return

        // immediately fail if the submission isn't valid
        // (this shouldn't happen since invalid data is not submitted)
        if (!isValid(formData)) {
            setProgress("createDI", "failure", "Invalid submission")
            return
        }

        // don't proceed if the figma image couldn't be loaded
        if (
            progress.loadFigmaImage.status === "complete" &&
            !progress.loadFigmaImage.success
        ) {
            setProgress(
                "createDI",
                "failure",
                "No image could be loaded from Figma using the provided URL. Please check the URL and try again, or remove it if it's not needed."
            )
            return
        }

        setProgress("createDI", "running")

        let cloudflareImageId: string | undefined
        if (imageUrl && isValidForImageUpload(formData)) {
            setProgress("uploadImage", "running")

            try {
                const response = await uploadImage({ formData, imageUrl })
                updateProgress("uploadImage", response)
                if (!response.success) {
                    setProgress(
                        "createDI",
                        "failure",
                        "Not attempted since image upload failed"
                    )
                    return
                } else {
                    cloudflareImageId = response.image.cloudflareId ?? undefined
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error)
                setProgress("uploadImage", "failure", errorMessage)
                setProgress(
                    "createDI",
                    "failure",
                    "Not attempted since image upload failed"
                )
                return
            }
        }

        // Create the data insight Gdoc
        const createResponse = await createDataInsight({ formData })
        updateProgress("createDI", createResponse)

        // Set topic tags if given
        const topicTagIds = formData.topicTagIds ?? []
        if (createResponse.success && topicTagIds.length > 0) {
            setProgress("setTopicTags", "running")
            try {
                const response = await setTags({
                    gdocId: createResponse.gdocId,
                    tagIds: topicTagIds,
                })
                updateProgress("setTopicTags", response)
            } catch {
                setProgress("setTopicTags", "failure")
            }
        }

        // Send a message to Slack if requested
        if (shouldSendMessageToSlack && cloudflareImageId) {
            setProgress("sendSlackMessage", "running")
            try {
                await sendDataInsightToSlack({
                    formData,
                    imageUrl: makeImageSrc(cloudflareImageId, 1250),
                })
                setProgress("sendSlackMessage", "success")
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error)
                setProgress("sendSlackMessage", "failure", errorMessage)
            }
        }

        props.onFinish?.(createResponse)
    }

    const uploadImage = async ({
        formData,
        imageUrl,
    }: {
        formData: FormDataWithImageFilename
        imageUrl: string
    }) => {
        // Upload image
        const response = await uploadImageFromSourceUrl({
            admin,
            image: { filename: formData.imageFilename },
            sourceUrl: imageUrl,
        })

        // Update alt text
        if (response.success && formData.imageAltText) {
            await admin.requestJSON<ImageUploadResponse>(
                `/api/images/${response.image.id}`,
                { defaultAlt: formData.imageAltText.trim() },
                "PATCH"
            )
        }

        return response
    }

    const createDataInsight = ({
        formData,
    }: {
        formData: FormDataWithTitle
    }) => {
        const payload = {
            title: formData.title,
            authors: formData.authors,
            grapherUrl: formData.grapherUrl,
            narrativeChart: narrativeChart?.name,
            figmaUrl: formData.figmaUrl,
            filename: formData.imageFilename,
        }

        return admin.requestJSON<DataInsightCreationResponse>(
            `/api/dataInsights/create`,
            payload,
            "POST"
        )
    }

    const setTags = ({
        gdocId,
        tagIds,
    }: {
        gdocId: string
        tagIds: number[]
    }): Promise<{ success: true }> => {
        return admin.requestJSON(
            `/api/gdocs/${gdocId}/setTags`,
            { tagIds },
            "POST"
        )
    }

    const sendDataInsightToSlack = async ({
        formData,
        imageUrl,
    }: {
        formData: FormDataWithTitle
        imageUrl: string
    }) => {
        const { title, slackNote, authors } = formData

        let text = `*${title}*`
        if (slackNote) text += `\n\n${slackNote}`
        if (authors) text += `\n\nby ${authors}`

        const blocks = [
            {
                type: "section",
                text: { type: "mrkdwn", text },
            },
            {
                type: "image",
                image_url: imageUrl,
                alt_text: formData.imageAltText,
            },
        ]

        const payload = {
            blocks,
            channel: SLACK_DI_PITCHES_CHANNEL_ID,
            username: "Data insight bot",
        }

        void admin.requestJSON(`/api/slack/sendMessage`, payload, "POST")
    }

    const fetchFigmaImage = async (figmaUrl: string) => {
        setProgress("loadFigmaImage", "running")
        try {
            const response = await fetchFigmaProvidedImageUrl(admin, figmaUrl)
            setFigmaImageUrl(response.success ? response.imageUrl : undefined)
            updateProgress("loadFigmaImage", response)
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            setProgress("loadFigmaImage", "failure", errorMessage)
            setFigmaImageUrl(undefined)
        }
    }

    const suggestImageAltText = async (imageUrl: string) => {
        setProgress("suggestAltText", "running", "")
        try {
            const searchParams = new URLSearchParams({ imageUrl })
            const response = await admin.requestJSON<{
                success: true
                altText: string
            }>(`/api/gpt/suggest-alt-text?${searchParams}`, {}, "GET", {
                onFailure: "continue",
            })
            setFormField("imageAltText", response.altText)
            setProgress("suggestAltText", "success")
        } catch (error) {
            let errorMessage =
                error instanceof Error ? error.message : String(error)
            // Makes the error message nicer if the request times out,
            // which frequently happens for Grapher exports
            if (errorMessage.includes("Timeout while downloading")) {
                errorMessage =
                    "The request timed out. Please try again – a second attempt may succeed"
            }
            setProgress("suggestAltText", "failure", errorMessage)
            setFormField("imageAltText", "")
        }
    }

    const hasNarrativeChartField = shouldShowField("narrativeChart")
    useEffect(() => {
        // no need to load narrative charts if the the field is hidden
        // since they're used for autocompletion
        if (!hasNarrativeChartField) return

        const getChartViews = async () =>
            await admin.getJSON<{
                chartViews: ApiChartViewOverview[]
            }>("/api/chartViews")

        void getChartViews().then((result) => {
            setAllNarrativeCharts(
                result.chartViews.map((chartView) => ({
                    name: chartView.name,
                    configId: chartView.chartConfigId,
                    title: chartView.title,
                }))
            )
        })
    }, [admin, hasNarrativeChartField])

    const hasTopicTagsField = shouldShowField("topicTagIds")
    useEffect(() => {
        // no need to load topic tags if the the field is hidden
        // since they're used for autocompletion
        if (!hasTopicTagsField) return

        const fetchTags = () =>
            admin.getJSON<{ tags: MinimalTagWithIsTopic[] }>("/api/tags.json")

        void fetchTags().then((result) =>
            setAllTopicTags(result.tags.filter((tag) => tag.isTopic))
        )
    }, [admin, hasTopicTagsField])

    const showFeedbackBox = ({
        formData,
        progress,
        imageUrl,
    }: {
        formData: FormData
        progress: Record<Task, Progress>
        imageUrl?: string
        grapherUrl?: string
    }): boolean => {
        if (!isValid(formData)) return false
        if (imageUrl && !isValidForImageUpload(formData)) return false
        if (
            progress.loadFigmaImage.status === "complete" &&
            !progress.loadFigmaImage.success
        )
            return false
        return true
    }

    return (
        <Modal
            title="Create a data insight"
            open={true}
            width={765}
            onCancel={() => props.closeModal()}
            footer={null}
        >
            <div className="di-modal-content">
                {props.description && (
                    <p>
                        <i>{props.description}</i>
                    </p>
                )}

                <Form
                    form={form}
                    className="form"
                    name="basic"
                    layout="vertical"
                    autoComplete="off"
                    requiredMark="optional"
                    onFinish={handleSubmit}
                    onValuesChange={(values) => {
                        setFormData((formData) => ({
                            ...formData,
                            ...values,
                        }))
                    }}
                >
                    <FormField
                        label="Title"
                        name="title"
                        initialValue={initialValues.title}
                        show={shouldShowField("title")}
                        rules={[
                            {
                                required: true,
                                message: "Please provide a title for the DI",
                            },
                        ]}
                    />

                    <FormField
                        label="Authors"
                        name="authors"
                        initialValue={initialValues.authors ?? admin.username}
                        show={shouldShowField("authors")}
                    />

                    <TopicTagsSelect
                        allTopicTags={allTopicTags}
                        show={shouldShowField("topicTagIds")}
                    />

                    {(shouldShowField("narrativeChart") ||
                        shouldShowField("grapherUrl")) && (
                        <Flex gap="middle">
                            <NarrativeChartSelect
                                allNarrativeCharts={{
                                    array: allNarrativeCharts,
                                    map: allNarrativeChartsMap,
                                }}
                                form={{
                                    data: formData,
                                    setField: setFormField,
                                }}
                                initialValue={initialValues.narrativeChart}
                                show={shouldShowField("narrativeChart")}
                                style={{ flex: "1 1 0px", maxWidth: "48%" }}
                            />

                            <FormField
                                label="Grapher or Explorer URL"
                                name="grapherUrl"
                                placeholder="https://ourworldindata.org/grapher/***"
                                initialValue={initialValues.grapherUrl}
                                style={{ flex: "1 1 0px" }}
                                show={shouldShowField("grapherUrl")}
                                rules={[
                                    {
                                        pattern:
                                            /^https:\/\/ourworldindata\.org\/(grapher|explorers)\/.*/gm,
                                        message:
                                            "The URL should start with https://ourworldindata.org/grapher/ or https://ourworldindata.org/explorers/",
                                    },
                                ]}
                            />
                        </Flex>
                    )}

                    <FormField
                        label="Figma URL"
                        name="figmaUrl"
                        placeholder="https://www.figma.com/design/***/Charts?node-id=***"
                        show={shouldShowField("figmaUrl")}
                        onChange={async (figmaUrl) => {
                            if (figmaUrl) {
                                await fetchFigmaImage(figmaUrl)
                            } else {
                                setFigmaImageUrl(undefined)
                                setProgress("loadFigmaImage", "idle")
                            }
                        }}
                        validateStatus={validate(progress.loadFigmaImage)}
                        help={makeHelpText(progress.loadFigmaImage)}
                    />

                    {imageUrl && (
                        <>
                            <FormField
                                label="Image filename"
                                name="imageFilename"
                                initialValue={initialValues.imageFilename}
                                rules={[
                                    {
                                        required: true,
                                        message:
                                            "Please provide a filename for the image",
                                    },
                                ]}
                            />
                            <Space
                                size="small"
                                direction="vertical"
                                style={{ width: "100%" }}
                            >
                                <FormField
                                    label="Image alt text"
                                    name="imageAltText"
                                    className="form-item image-alt-text"
                                    validateStatus={validate(
                                        progress.suggestAltText
                                    )}
                                    help={makeHelpText(progress.suggestAltText)}
                                    rules={[
                                        {
                                            max: 1600,
                                            message:
                                                "Image alt text cannot exceed 1600 characters",
                                        },
                                    ]}
                                >
                                    <Input.TextArea
                                        autoSize={true}
                                        onChange={() => {
                                            setProgress(
                                                "suggestAltText",
                                                "idle"
                                            )
                                        }}
                                    />
                                </FormField>
                                <Button
                                    color="default"
                                    variant="filled"
                                    icon={robotIcon}
                                    onClick={() =>
                                        suggestImageAltText(cachedImageUrl!)
                                    }
                                >
                                    Suggest
                                </Button>
                            </Space>
                            <div className="image-preview">
                                <h3>Image preview</h3>

                                <Space size="small" direction="vertical">
                                    <ImagePreview
                                        imageUrl={imageUrl}
                                        progress={progress.loadFigmaImage}
                                    />
                                    {imageUrl && (
                                        <Button
                                            color="default"
                                            variant="filled"
                                            icon={downloadIcon}
                                            onClick={() => {
                                                void downloadImage(
                                                    imageUrl,
                                                    formData.imageFilename ??
                                                        "image.png"
                                                )
                                            }}
                                        >
                                            Download
                                        </Button>
                                    )}
                                </Space>
                            </div>
                        </>
                    )}

                    {imageUrl && (
                        <p>
                            <Checkbox
                                checked={shouldSendMessageToSlack}
                                onChange={(e) => {
                                    setShouldSendMessageToSlack(
                                        e.target.checked
                                    )
                                }}
                            >
                                Share data insight in the #data-insight-pitches
                                channel
                            </Checkbox>
                            {shouldSendMessageToSlack && (
                                <FormField
                                    name="slackNote"
                                    className="slackNote"
                                    aria-label="Note (shared on Slack)"
                                >
                                    <Input.TextArea placeholder="Note (shared on Slack)" />
                                </FormField>
                            )}
                        </p>
                    )}

                    {showFeedbackBox({ formData, progress, imageUrl }) && (
                        <div className="feedback-box">
                            <h2>This data insight will be created by:</h2>

                            <ul>
                                <ImageUploadFeedback
                                    imageUrl={imageUrl}
                                    imageSource={imageSource}
                                    formData={formData}
                                    progress={progress.uploadImage}
                                />
                                <DataInsightCreationFeedback
                                    formData={formData}
                                    progress={progress.createDI}
                                />
                                <TopicTagsFeedback
                                    topicTags={topicTags}
                                    progress={progress.setTopicTags}
                                />
                            </ul>

                            <SendMessageToSlackFeedback
                                shouldSend={
                                    !!imageUrl && shouldSendMessageToSlack
                                }
                                progress={progress.sendSlackMessage}
                            />
                        </div>
                    )}

                    <div className="form-submit">
                        <Space align="end">
                            <Button onClick={() => props.closeModal()}>
                                Cancel
                            </Button>
                            <SubmitButton progress={progress.createDI} />
                        </Space>
                    </div>
                </Form>
            </div>
        </Modal>
    )
}

function FormField(
    props: FormItemProps<FormData> & {
        show?: boolean
        placeholder?: string
        onChange?: (value: string) => void
        children?: React.ReactNode
    }
) {
    const {
        show = true,
        onChange,
        children,
        placeholder,
        ...passthroughProps
    } = props

    if (!show) return null

    return (
        <Form.Item<FormData> {...passthroughProps}>
            {children ?? (
                <Input
                    placeholder={placeholder}
                    onChange={(e) => onChange?.(e.target.value)}
                />
            )}
        </Form.Item>
    )
}

function NarrativeChartSelect({
    allNarrativeCharts,
    form,
    initialValue,
    show,
    style,
}: {
    allNarrativeCharts: {
        array: NarrativeChart[]
        map: Map<string, NarrativeChart>
    }
    form?: {
        data: FormData
        setField: (name: FormFieldName, value: string) => void
    }
    initialValue?: string
    show?: boolean
    style?: React.CSSProperties
}) {
    if (!show) return null

    const handleSelect = (name: string) => {
        if (!form) return

        const narrativeChart = allNarrativeCharts.map.get(name)
        if (!narrativeChart) return

        if (!form.data.imageFilename) {
            const filename = `${name}.png`
            form.setField("imageFilename", filename)
        }
        if (!form.data.title) {
            form.setField("title", narrativeChart.title)
        }
    }

    return (
        <FormField
            label="Narrative chart"
            name="narrativeChart"
            initialValue={initialValue}
            style={style}
        >
            <Select
                placeholder="Select a narrative chart..."
                showSearch
                options={allNarrativeCharts.array.map(({ name }) => ({
                    value: name,
                    label: name,
                }))}
                onSelect={handleSelect}
                allowClear
            />
        </FormField>
    )
}

function TopicTagsSelect({
    allTopicTags,
    show,
}: {
    allTopicTags: MinimalTag[]
    show?: boolean
}) {
    if (!show) return null
    return (
        <FormField label="Topic tags" name="topicTagIds">
            <Select
                placeholder="Select topic tags..."
                mode="multiple"
                options={allTopicTags.map(({ id, name }) => ({
                    value: id,
                    label: name,
                }))}
                filterOption={(input, option) => {
                    if (!option) return false
                    return option.label
                        .toLowerCase()
                        .includes(input.toLowerCase())
                }}
                allowClear
            />
        </FormField>
    )
}

function SubmitButton({ progress }: { progress: Progress }) {
    const isRunning = progress.status === "running"
    const isCompleteAndSuccessful =
        progress.status === "complete" && progress.success

    return (
        <Button
            type="primary"
            htmlType="submit"
            disabled={isCompleteAndSuccessful}
            icon={isRunning ? spinnerIcon : checkIcon}
        >
            {isCompleteAndSuccessful ? "Created" : "Create"}
        </Button>
    )
}

function ImagePreview({
    imageUrl,
    progress,
}: {
    imageUrl: string
    progress: Progress
}) {
    return (
        <LoadingImage
            url={imageUrl}
            isLoading={progress.status === "running"}
            loadingError={
                progress.status === "complete" && !progress.success
                    ? progress.message
                    : undefined
            }
        />
    )
}

function ImageUploadFeedback({
    imageUrl,
    imageSource,
    formData,
    progress,
}: {
    imageUrl?: string
    imageSource?: ImageSource
    formData: FormData
    progress: Progress
}) {
    if (!imageUrl || !imageSource || !formData.imageFilename) return null

    const text = makeImageUploadFeedbackText(imageSource)

    return (
        <li>
            <span>
                {text}, saved as <i>{formData.imageFilename}</i>
            </span>
            <FeedbackTag progress={progress} />
        </li>
    )
}

function DataInsightCreationFeedback({
    formData,
    progress,
}: {
    formData: FormData
    progress: Progress
}) {
    const titleSuffix = formData.title ? (
        <>
            , titled <i>{formData.title}</i>
        </>
    ) : (
        ""
    )
    return (
        <li>
            <span>
                Adding a new Google Doc to your data insights folder
                {titleSuffix}
            </span>
            <FeedbackTag progress={progress} />
        </li>
    )
}

function TopicTagsFeedback({
    topicTags,
    progress,
}: {
    topicTags: MinimalTag[]
    progress: Progress
}) {
    if (topicTags.length === 0) return null
    return (
        <li>
            <span>
                Tagging the newly created data insight, with{" "}
                {topicTags.map((tag, index) => (
                    <Fragment key={tag.id}>
                        <i>{tag.name}</i>
                        {index < topicTags.length - 1 && " and "}
                    </Fragment>
                ))}
            </span>
            <FeedbackTag progress={progress} />
        </li>
    )
}

function SendMessageToSlackFeedback({
    shouldSend,
    progress,
}: {
    shouldSend: boolean
    progress: Progress
}) {
    if (!shouldSend) return null
    return (
        <p>
            <span>
                The newly created data insight will be shared in the
                #data-insight-pitches channel for review.
            </span>
            <FeedbackTag progress={progress} />
        </p>
    )
}

function FeedbackTag({ progress }: { progress: Progress }) {
    if (progress.status === "idle") return null

    const className = "feedback-tag"

    if (progress.status === "running")
        return <span className={className}>{progress.message}</span>

    const classNames = cx(className, {
        success: progress.success,
        error: !progress.success,
    })

    return (
        <span className={classNames}>
            {progress.success ? successIcon : failIcon}
            {progress.message}
        </span>
    )
}

function validate(progress: Progress): ValidateStatus {
    if (progress.status === "idle") return "success"
    if (progress.status === "running") return "validating"
    return progress.success ? "success" : "error"
}

function makeHelpText(progress: Progress): string | undefined {
    if (progress.status === "running") return progress.message
    if (progress.status === "complete" && !progress.success)
        return progress.message
    return undefined
}

function isValidForImageUpload(
    formData: FormData
): formData is FormDataWithImageFilename {
    return !isEmpty(formData.imageFilename)
}

function isValid(formData: FormData): formData is FormDataWithTitle {
    return !isEmpty(formData.title)
}

function useProgress(...tasks: Task[]) {
    // Initialize progress state with idle status for each task
    const initialValues = tasks.reduce(
        (acc, task) => ({
            ...acc,
            [task]: { status: "idle" },
        }),
        {} as Record<Task, Progress>
    )

    const [progress, setProgress] =
        useState<Record<Task, Progress>>(initialValues)

    const reset = (task: Task) => {
        setProgress((prevState) => ({
            ...prevState,
            [task]: { status: "idle" },
        }))
    }

    const setRunning = (task: Task, message?: string) => {
        setProgress((prevState) => ({
            ...prevState,
            [task]: {
                status: "running",
                message: message ?? DEFAULT_RUNNING_MESSAGE[task],
            },
        }))
    }

    const setSuccess = (task: Task, message?: string) => {
        setProgress((prevState) => ({
            ...prevState,
            [task]: {
                status: "complete",
                success: true,
                message: message ?? DEFAULT_SUCCESS_MESSAGE[task],
            },
        }))
    }

    const setFailure = (task: Task, message?: string) => {
        setProgress((prevState) => ({
            ...prevState,
            [task]: {
                status: "complete",
                success: false,
                message: message ?? DEFAULT_ERROR_MESSAGE[task],
            },
        }))
    }

    const setProgressStatus = (
        task: Task,
        status: "idle" | "running" | "success" | "failure",
        message?: string
    ) => {
        match(status)
            .with("idle", () => reset(task))
            .with("running", () => setRunning(task, message))
            .with("success", () => setSuccess(task, message))
            .with("failure", () => setFailure(task, message))
            .exhaustive()
    }

    const updateProgress = (
        task: Task,
        response: { success: true } | { success: false; errorMessage: string },
        successMessage?: string
    ) => {
        setProgress((prevState) => ({
            ...prevState,
            [task]: {
                status: "complete",
                success: response.success,
                message: response.success
                    ? (successMessage ?? DEFAULT_SUCCESS_MESSAGE[task])
                    : response.errorMessage,
            },
        }))
    }

    return { progress, setProgress: setProgressStatus, updateProgress }
}

function makeImageUploadFeedbackText(source: ImageSource): string {
    switch (source) {
        case "figma":
            return "Uploading a PNG from Figma as the image for this data insight"
        case "narrativeChart":
            return "Uploading a PNG of the narrative chart as the image for this data insight"
        case "grapher":
            return "Uploading a PNG of the grapher chart as the image for this data insight"
        case "explorer":
            return "Uploading a PNG of the explorer chart as the image for this data insight"
    }
}

function makePngUrlForNarrativeChart(
    configId: string,
    { cache = false } = {}
): string {
    const searchParams = new URLSearchParams({ imType: "square" })
    if (!cache) searchParams.append("nocache", "true")

    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${configId}.png?${searchParams}`
}

function makePngUrlForGrapherOrExplorer(
    urlString: string,
    { cache = false } = {}
): string {
    const url = new URL(urlString)

    // update search params
    url.searchParams.append("imType", "square")
    if (!cache) url.searchParams.append("nocache", "true")

    const pngUrl = `${url.protocol}//${url.host}${url.pathname}.png${url.search}`

    return pngUrl
}
