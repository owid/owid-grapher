import cx from "classnames"
import { useLinkedStaticViz } from "../utils.js"
import Image, { ImageParentContainer } from "./Image.js"
import { useDocumentContext } from "../DocumentContext.js"
import { useCallback, useMemo, useState, useId, type MouseEvent } from "react"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { MarkdownTextWrap, OverlayHeader } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight, faDownload } from "@fortawesome/free-solid-svg-icons"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.js"
import { triggerDownloadFromBlob } from "@ourworldindata/utils"
import { ImageMetadata, LinkedStaticViz, Span } from "@ourworldindata/types"
import { useTriggerOnEscape } from "../../hooks.js"
import { FloatingDownloadButton } from "./FloatingDownloadButton.js"
import SpanElements from "./SpanElements.js"

interface StaticVizProps {
    name: string
    className?: string
    containerType?: ImageParentContainer
    hasOutline?: boolean
    caption?: Span[]
}

export default function StaticViz(props: StaticVizProps) {
    const {
        name,
        className,
        containerType = "default",
        hasOutline = true,
        caption,
    } = props
    const staticViz = useLinkedStaticViz(name)
    const { isPreviewing } = useDocumentContext()
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)

    if (!staticViz) {
        if (isPreviewing) {
            return (
                <BlockErrorFallback
                    className={cx("static-viz", className)}
                    error={{
                        name: "StaticViz error",
                        message: `StaticViz with name "${name}" not found. This block will not render when the page is baked.`,
                    }}
                />
            )
        }
        return null
    }

    return (
        <figure className={cx("static-viz", className)}>
            <div className="static-viz__image-wrapper">
                <Image
                    hasOutline={hasOutline}
                    imageData={staticViz.desktop}
                    smallImageData={staticViz.mobile}
                    containerType={containerType}
                    DownloadButton={
                        <FloatingDownloadButton
                            label="Open download options"
                            onClick={() => setIsDownloadModalOpen(true)}
                            containerClassName="static-viz__download-button-container"
                        />
                    }
                />
                {isDownloadModalOpen && (
                    <StaticVizDownloadModal
                        staticViz={staticViz}
                        onClose={() => setIsDownloadModalOpen(false)}
                    />
                )}
            </div>
            {caption ? (
                <figcaption className="static-viz__caption">
                    <SpanElements spans={caption} />
                </figcaption>
            ) : null}
        </figure>
    )
}

interface DownloadOption {
    key: string
    title: string
    description: string
    previewImage?: ImageMetadata
    onClick?: () => void
    href?: string
}

const StaticVizDownloadModal = ({
    staticViz,
    onClose,
}: {
    staticViz: LinkedStaticViz
    onClose: () => void
}) => {
    const dialogTitleId = useId()
    useTriggerOnEscape(onClose)

    const downloadImage = useCallback(
        async (image: ImageMetadata, fallbackName: string) => {
            if (!image.cloudflareId) return
            const url = makeImageSrc(image)
            if (!url) return
            try {
                const response = await fetch(url)
                const blob = await response.blob()
                const filename = image.filename ?? fallbackName
                triggerDownloadFromBlob(filename, blob)
            } catch (error) {
                console.error("Failed to download static viz image", error)
            }
        },
        []
    )

    const imageOptions: DownloadOption[] = useMemo(() => {
        const hasMobile = !!staticViz.mobile
        const desktopTitle = hasMobile ? "Desktop version" : "Download image"

        const options: DownloadOption[] = [
            {
                key: "desktop-image",
                title: desktopTitle,
                description: createDimensionsLabel(staticViz.desktop),
                previewImage: staticViz.desktop,
                onClick: () =>
                    void downloadImage(
                        staticViz.desktop,
                        `${staticViz.name}-desktop.png`
                    ),
            },
        ]

        if (hasMobile) {
            options.push({
                key: "mobile-image",
                title: "Mobile version",
                description: createDimensionsLabel(staticViz.mobile!),
                previewImage: staticViz.mobile,
                onClick: () =>
                    void downloadImage(
                        staticViz.mobile!,
                        `${staticViz.name}-mobile.png`
                    ),
            })
        }

        return options
    }, [downloadImage, staticViz])

    const dataOptions: DownloadOption[] = useMemo(() => {
        const options: DownloadOption[] = []
        if (staticViz.grapherUrl) {
            options.push({
                key: "grapher-data",
                title: "Download data (CSV)",
                description:
                    "Download the data behind this visualization as a CSV file.",
                href: `${staticViz.grapherUrl}.csv`,
            })
        }
        if (staticViz.sourceUrl) {
            options.push({
                key: "source-link",
                title: "View source dataset",
                description:
                    "Visit the external dataset or documentation referenced for this visualization.",
                href: staticViz.sourceUrl,
            })
        }
        return options
    }, [staticViz.grapherUrl, staticViz.sourceUrl])

    const handleOverlayClick = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) onClose()
        },
        [onClose]
    )

    const grapherLink =
        staticViz.grapherUrl && staticViz.grapherUrl.trim().length
            ? staticViz.grapherUrl
            : undefined

    return (
        <div
            className="static-viz__download-overlay"
            onClick={handleOverlayClick}
            role="presentation"
        >
            <div
                className="static-viz-download-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
            >
                <OverlayHeader
                    title="Download"
                    onDismiss={onClose}
                    className="static-viz-download-modal__header"
                />
                <span id={dialogTitleId} className="sr-only">
                    Download
                </span>
                <div className="static-viz-download-modal__content">
                    {staticViz.description && (
                        <section className="static-viz-download-modal__section">
                            <div className="static-viz-download-modal__heading">
                                <h3>How this visualization was made</h3>
                            </div>
                            <div className="static-viz-download-modal__description">
                                <MarkdownTextWrap
                                    text={staticViz.description}
                                    fontSize={14}
                                    lineHeight={1.2}
                                />
                            </div>
                        </section>
                    )}
                    <section className="static-viz-download-modal__section">
                        <div className="static-viz-download-modal__heading">
                            <h3>Images</h3>
                            <p>
                                Download high-resolution images for this static
                                visualization.
                            </p>
                        </div>
                        {imageOptions.map((option) => (
                            <DownloadButton
                                key={option.key}
                                title={option.title}
                                description={
                                    option.description ||
                                    "High-resolution export."
                                }
                                previewImage={option.previewImage}
                                onClick={option.onClick}
                            />
                        ))}
                    </section>
                    {!!dataOptions.length && (
                        <section className="static-viz-download-modal__section">
                            <div className="static-viz-download-modal__heading">
                                <h3>Data</h3>
                                <p>
                                    Explore or download the dataset that was
                                    used to create this visualization.
                                </p>
                            </div>
                            {dataOptions.map((option) => (
                                <DownloadButton
                                    key={option.key}
                                    title={option.title}
                                    description={option.description}
                                    href={option.href}
                                />
                            ))}
                        </section>
                    )}
                    {grapherLink && (
                        <section className="static-viz-download-modal__section">
                            <div className="static-viz-download-modal__heading">
                                <h3>Continue exploring</h3>
                                <p>
                                    Visit this chart on Our World in Data to
                                    explore and customize the data.
                                </p>
                            </div>
                            <a
                                href={grapherLink}
                                className="static-viz-download-modal__grapher-link"
                            >
                                Open interactive chart{" "}
                                <FontAwesomeIcon icon={faArrowRight} />
                            </a>
                        </section>
                    )}
                </div>
            </div>
        </div>
    )
}

const DownloadButton = ({
    title,
    description,
    previewImage,
    onClick,
    href,
}: {
    title: string
    description: string
    previewImage?: ImageMetadata
    onClick?: () => void
    href?: string
}) => {
    const content = (
        <>
            {previewImage && (
                <div className="static-viz-download-modal__preview">
                    <Image
                        imageData={previewImage}
                        containerType="thumbnail"
                        shouldLightbox={false}
                        shouldHideDownloadButton
                        alt=""
                    />
                </div>
            )}
            <div className="static-viz-download-modal__button-content">
                <h4>{title}</h4>
                <p>{description}</p>
            </div>
            <FontAwesomeIcon
                icon={faDownload}
                className="static-viz-download-modal__button-icon"
                aria-hidden="true"
            />
        </>
    )

    if (href) {
        return (
            <a
                className="static-viz-download-modal__button"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {content}
            </a>
        )
    }

    return (
        <button
            type="button"
            className="static-viz-download-modal__button"
            onClick={onClick}
        >
            {content}
        </button>
    )
}

const createDimensionsLabel = (image: ImageMetadata): string => {
    if (image.originalWidth && image.originalHeight) {
        return `${image.originalWidth} × ${image.originalHeight}px`
    }
    return "High-resolution export."
}

const makeImageSrc = (image: ImageMetadata, width?: number) => {
    if (!image.cloudflareId) return undefined
    const fallbackWidth = image.originalWidth ?? 1600
    return `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/w=${
        width ?? fallbackWidth
    }`
}
