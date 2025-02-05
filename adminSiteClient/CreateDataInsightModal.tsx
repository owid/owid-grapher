import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    Form,
    Modal,
    Space,
    FormProps,
    Input,
    Checkbox,
    Button,
    Alert,
} from "antd"
import { useContext, useEffect, useState } from "react"
import {
    fetchFigmaProvidedImageUrl,
    ImageUploadResponse,
    makeImageSrc,
    uploadImageFromSourceUrl,
} from "./imagesHelpers"
import { AdminAppContext } from "./AdminAppContext"
import { ENV, GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings"
import { LoadingImage } from "./ReuploadImageForDataInsightModal"

const spinnerIcon = <FontAwesomeIcon icon={faSpinner} spin />
const checkIcon = <FontAwesomeIcon icon={faCheck} />

export function CreateDataInsightModal({
    title,
    author,
    narrativeChart,
    figmaUrl,
    imageFilename,
    closeModal,
    onClose,
}: {
    title?: string
    author?: string
    narrativeChart?: {
        name: string
        configId: string
    }
    figmaUrl?: string
    imageFilename?: string
    closeModal: () => void
    onClose?: () => void
}) {
    const { admin } = useContext(AdminAppContext)

    const [form] = Form.useForm()

    const narrativeChartImageUrl = narrativeChart
        ? makePngUrlForNarrativeChart(narrativeChart.configId)
        : undefined

    // TODO: copy pasted from DI index page, unify
    const [figmaImageUrl, setFigmaImageUrl] = useState<string | undefined>()
    const [isLoadingFigmaImageUrl, setIsLoadingFigmaImageUrl] = useState(false)
    const [figmaImageLoadingError, setFigmaImageLoadingError] = useState<
        string | undefined
    >()

    const imageUrl = figmaImageUrl || narrativeChartImageUrl

    const handleOk = async () => {
        const imageFilename = form.getFieldValue("imageFilename")

        // // Upload the given image if it's provided
        // let imageUploadResponse: ImageUploadResponse | undefined
        // if (imageUrl && imageFilename) {
        //     imageUploadResponse = await uploadImageFromSourceUrl({
        //         admin,
        //         image: { filename: imageFilename },
        //         sourceUrl: imageUrl,
        //     })
        //     console.log("image response", imageUploadResponse)
        // }

        const imageUploadResponse = { success: true }

        const payload = {
            title: form.getFieldValue("title"),
            authors: form.getFieldValue("authors"),
            narrativeChart: form.getFieldValue("narrativeChart"),
            figmaUrl: form.getFieldValue("figmaUrl"),
            imageFilename: imageUploadResponse?.success
                ? imageFilename
                : undefined,
        }
        // const response = await admin.requestJSON(
        //     `/api/dataInsights/create`,
        //     payload,
        //     "POST"
        // )

        console.log("post", payload)

        onClose({ success: true })
        closeModal()
    }

    const fetchFigmaImage = async (figmaUrl: string) => {
        setIsLoadingFigmaImageUrl(true)
        try {
            const response = await fetchFigmaProvidedImageUrl(figmaUrl)
            setFigmaImageUrl(response.success ? response.imageUrl : undefined)
            setFigmaImageLoadingError(
                !response.success ? response.errorMessage : undefined
            )
        } catch (error) {
            if (error instanceof Error) {
                setFigmaImageUrl(undefined)
                setFigmaImageLoadingError(error.message)
            }
        } finally {
            setIsLoadingFigmaImageUrl(false)
        }
    }

    return (
        <Modal
            title="Create Data Insight"
            open={true}
            width={765}
            okText="Create"
            // okButtonProps={{
            //     icon: isImageUploadInProgress ? spinnerIcon : checkIcon,
            //     disabled:
            //         isImageUploadInProgress ||
            //         isLoadingSourceUrl ||
            //         (!sourceUrl && !isLoadingSourceUrl),
            // }}
            onOk={() => handleOk()}
            onCancel={() => closeModal()}
        >
            <div className="di-modal-content">
                <Form
                    form={form}
                    name="basic"
                    layout="vertical"
                    // labelCol={{ span: 8 }}
                    // wrapperCol={{ span: 16 }}
                    // style={{ maxWidth: 600 }}
                    // initialValues={{ remember: true }}
                    // onFinish={() => console.log("Form submitted")}
                    // onFinishFailed={() => console.log("Form submission failed")}
                    autoComplete="off"
                >
                    <Form.Item label="Title" name="title" initialValue={title}>
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Authors"
                        name="authors"
                        initialValue={author ?? admin.username}
                    >
                        <Input />
                    </Form.Item>

                    {/* <Form.Item
                    label="Narrative chart"
                    name="narrativeChart"
                    initialValue={narrativeChart?.name}
                >
                    <Input />
                </Form.Item> */}

                    <Form.Item
                        label="Figma URL"
                        name="figmaUrl"
                        initialValue={figmaUrl}
                    >
                        <Input
                            onChange={(e) => {
                                const figmaUrl = e.target.value
                                if (figmaUrl) {
                                    fetchFigmaImage(figmaUrl)
                                } else {
                                    setFigmaImageUrl(undefined)
                                    setIsLoadingFigmaImageUrl(false)
                                    setFigmaImageLoadingError(undefined)
                                }
                            }}
                        />
                    </Form.Item>

                    {imageFilename && (
                        <Form.Item
                            label="Image Filename"
                            name="imageFilename"
                            initialValue={imageFilename}
                        >
                            <Input />
                        </Form.Item>
                    )}
                </Form>

                {imageUrl && (
                    <LoadingImage
                        url={imageUrl}
                        size={350}
                        isLoading={isLoadingFigmaImageUrl}
                        loadingError={figmaImageLoadingError}
                    />
                )}
                {figmaImageLoadingError && (
                    <Alert
                        type="error"
                        message={`Figma image loading failed: ${figmaImageLoadingError}`}
                    />
                )}
            </div>
        </Modal>
    )
}

function makePngUrlForNarrativeChart(configId: string) {
    return `${makeDynamicThumbnailUrl()}/by-uuid/${configId}.png?imType=square&nocache`
}

function makeDynamicThumbnailUrl() {
    if (ENV === "development") return "https://ourworldindata.org/grapher"
    return GRAPHER_DYNAMIC_THUMBNAIL_URL
}
