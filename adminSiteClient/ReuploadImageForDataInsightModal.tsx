import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Modal, Space } from "antd"
import { useContext, useState } from "react"
import {
    ImageUploadResponse,
    makeImageSrc,
    uploadImageFromSourceUrl,
} from "./imagesHelpers"
import { AdminAppContext } from "./AdminAppContext"

const spinnerIcon = <FontAwesomeIcon icon={faSpinner} size="sm" spin />
const checkIcon = <FontAwesomeIcon icon={faCheck} size="sm" />

export function ReuploadImageForDataInsightModal({
    dataInsight,
    existingImage,

    // the source URL to upload the image from
    sourceUrl,

    // loading state
    isLoadingSourceUrl,
    loadingSourceUrlError,

    // modal presentation
    title = "Upload image for data insight",
    description,

    // modal-related actions
    closeModal,
    onUploadComplete,
}: {
    dataInsight: { id: string; title: string }
    existingImage: {
        id: number
        filename: string
        cloudflareId: string
        originalWidth: number
    }
    sourceUrl?: string
    isLoadingSourceUrl?: boolean
    loadingSourceUrlError?: string
    title?: string
    description?: string
    closeModal: () => void
    onUploadComplete?: (
        response: ImageUploadResponse,
        dataInsight: { id: string; title: string }
    ) => void
}) {
    const { admin } = useContext(AdminAppContext)

    const currentImageUrl = makeImageSrc(
        existingImage.cloudflareId,
        existingImage.originalWidth
    )

    const [isImageUploadInProgress, setIsImageUploadInProgress] =
        useState(false)

    const handleImageUpload = async () => {
        setIsImageUploadInProgress(true)
        const response = sourceUrl
            ? await uploadImageFromSourceUrl({
                  admin,
                  image: existingImage,
                  sourceUrl,
              })
            : ({
                  success: false,
                  errorMessage: "Source URL missing",
              } as ImageUploadResponse)
        onUploadComplete?.(response, dataInsight)
        setIsImageUploadInProgress(false)
        closeModal()
    }

    return (
        <Modal
            title={title}
            open={true}
            width={765}
            okText="Upload"
            okButtonProps={{
                icon: isImageUploadInProgress ? spinnerIcon : checkIcon,
                disabled:
                    isImageUploadInProgress ||
                    isLoadingSourceUrl ||
                    (!sourceUrl && !isLoadingSourceUrl),
            }}
            onOk={() => handleImageUpload()}
            onCancel={() => closeModal()}
        >
            <div className="di-modal-content">
                {description && (
                    <p>
                        <i>{description}</i>
                    </p>
                )}

                <p>
                    <b>Data insight</b>
                    <br />
                    {dataInsight.title}
                </p>

                <p>
                    <b>Filename</b>
                    <br />
                    {existingImage.filename}
                </p>

                <ImagePreview
                    imageBefore={currentImageUrl}
                    imageAfter={sourceUrl}
                    isLoading={isLoadingSourceUrl}
                    loadingError={loadingSourceUrlError}
                />
            </div>
        </Modal>
    )
}

function ImagePreview({
    imageBefore,
    imageAfter,
    size = 350,
    isLoading = false,
    loadingError = "",
}: {
    imageBefore: string
    imageAfter?: string
    size?: number
    isLoading?: boolean
    loadingError?: string
}) {
    return (
        <div>
            <b>Preview (before/after)</b>
            <div className="side-by-side-preview">
                <Space size="middle">
                    <img
                        className="border"
                        src={imageBefore}
                        width={size}
                        height={size}
                    />
                    <LoadingImage
                        url={imageAfter}
                        size={size}
                        isLoading={isLoading}
                        loadingError={loadingError}
                    />
                </Space>
            </div>
        </div>
    )
}

export function LoadingImage({
    url,
    size = 350,
    isLoading = false,
    loadingError = "",
}: {
    url?: string
    size?: number
    isLoading?: boolean
    loadingError?: string
}) {
    return isLoading ? (
        <div className="loading-image placeholder">{spinnerIcon}</div>
    ) : url ? (
        <img className="border" src={url} width={size} height={size} />
    ) : (
        <div className="loading-image error">
            <b>Loading preview failed</b>
            <p>{loadingError}</p>
        </div>
    )
}
