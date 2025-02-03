import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Modal, Space } from "antd"
import { useContext, useState } from "react"
import {
    ImageUploadResponse,
    makeImageSrc,
    reuploadImageFromSourceUrl,
} from "./imagesHelpers"
import { AdminAppContext } from "./AdminAppContext"

const spinnerIcon = <FontAwesomeIcon icon={faSpinner} spin />
const checkIcon = <FontAwesomeIcon icon={faCheck} />

export function ReuploadImageForDataInsightModal({
    dataInsight,
    existingImage,

    // the source URL to upload the image from
    sourceUrl,

    // loading state
    isLoadingSourceUrl,
    loadingSourceUrlError,

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
            ? await reuploadImageFromSourceUrl({
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
            title="Upload image for data insight"
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
                <div>
                    <b>Data insight</b>
                    <br />
                    {dataInsight.title}
                </div>

                <div>
                    <b>Filename</b>
                    <br />
                    {existingImage.filename}
                </div>

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
            <div className="image-preview">
                <Space size="middle">
                    <img
                        className="border"
                        src={imageBefore}
                        width={size}
                        height={size}
                    />
                    {isLoading ? (
                        <div className="placeholder">{spinnerIcon}</div>
                    ) : imageAfter ? (
                        <img
                            className="border"
                            src={imageAfter}
                            width={size}
                            height={size}
                        />
                    ) : (
                        <div className="error">
                            <b>Loading preview failed</b>
                            <p>{loadingError}</p>
                        </div>
                    )}
                </Space>
            </div>
        </div>
    )
}
