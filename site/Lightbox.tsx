import {
    faCompress,
    faDownload,
    faPlus,
    faSearchMinus,
    faSearchPlus,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { LoadingIndicator } from "@ourworldindata/grapher"
import cx from "classnames"
import React, { useCallback, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"
import { useTriggerOnEscape } from "./hooks.js"
import { triggerDownloadFromBlob } from "@ourworldindata/utils"

export const LIGHTBOX_IMAGE_CLASS = "lightbox-image"

/**
 * If the image is inside a <picture> element, get the URL of the largest
 * source image that matches the current viewport size.
 */
function getActiveSourceImgUrl(img: HTMLImageElement): string | undefined {
    if (img.closest("picture")) {
        const sources = img.closest("picture")!.querySelectorAll("source")
        const activeSource = Array.from(sources).find((s) =>
            s.media ? window.matchMedia(s.media).matches : true
        )
        const sourceSrcset = activeSource?.getAttribute("srcset")
        // split sourceSrcset into [src, width] pairs
        const srcsetPairs = sourceSrcset
            ?.split(",")
            .map((pair) => pair.trim().split(" "))
        const largestImgSrc = srcsetPairs?.at(-1)?.[0]
        return largestImgSrc
    }
    return undefined
}

// Cloudflare Images URLs end in w=1000, so we need to extract the filename from the URL
// e.g. https://imagedelivery.net/owid-id/the-filename.png/w=1000 -> the-filename.png
function getFilenameFromCloudflareUrl(url: string | undefined) {
    if (!url) return undefined
    const regex = /\/([^\/]+)\/w=/
    const match = url.match(regex)
    if (match) {
        return match[1]
    }
    return undefined
}

const Lightbox = ({
    children,
    containerNode,
    imgSrc,
    imgFilename,
}: {
    children: any
    containerNode: Element | null
    imgSrc: string
    // With CF Images, the filename is not the last part of the URL
    // so we need to pass it separately
    imgFilename?: string
}) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    const close = useCallback(() => {
        if (containerNode) {
            ReactDOM.unmountComponentAtNode(containerNode)
        }
    }, [containerNode])

    const handleDownload = useCallback(async () => {
        const response = await fetch(imgSrc)
        const blob = await response.blob()
        const filename = imgFilename || imgSrc.split("/").pop() || "image"
        triggerDownloadFromBlob(filename, blob)
    }, [imgFilename, imgSrc])

    useTriggerOnEscape(close)

    return (
        <div className="container">
            {!isLoaded && (
                <LoadingIndicator backgroundColor="#000" color="#ccc" />
            )}
            <TransformWrapper doubleClick={{ mode: "reset" }}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                        <div
                            className="content"
                            ref={contentRef}
                            onClick={(e) => {
                                if (e.target === contentRef.current) {
                                    close()
                                }
                            }}
                        >
                            <TransformComponent>
                                {children(isLoaded, setIsLoaded)}
                            </TransformComponent>
                        </div>
                        <div className="tools">
                            {isLoaded && (
                                <>
                                    <button
                                        aria-label="Zoom in"
                                        onClick={() => zoomIn()}
                                    >
                                        <FontAwesomeIcon icon={faSearchPlus} />
                                    </button>
                                    <button
                                        aria-label="Zoom out"
                                        onClick={() => zoomOut()}
                                    >
                                        <FontAwesomeIcon icon={faSearchMinus} />
                                    </button>
                                    <button
                                        aria-label="Reset zoom"
                                        onClick={() => resetTransform()}
                                    >
                                        <FontAwesomeIcon icon={faCompress} />
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        aria-label="Download high resolution image"
                                    >
                                        <FontAwesomeIcon icon={faDownload} />
                                    </button>
                                </>
                            )}
                            <button
                                aria-label="Close"
                                onClick={close}
                                className="close"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                        </div>
                    </>
                )}
            </TransformWrapper>
        </div>
    )
}

const LightboxImage = ({
    src,
    alt,
    isLoaded,
    setIsLoaded,
    width,
    height,
}: {
    src: string
    alt: string
    isLoaded: boolean
    setIsLoaded: any
    width: number
    height: number
}) => {
    return (
        <>
            <img
                width={width}
                height={height}
                onLoad={() => {
                    setIsLoaded(true)
                }}
                className={cx({
                    "lightbox__img--is-svg": src.endsWith(".svg"),
                })}
                src={src}
                alt={alt}
                style={{ opacity: !isLoaded ? 0 : 1, transition: "opacity 1s" }}
            />
        </>
    )
}

const getImageDimensions = (url: string) => {
    return new Promise<{ width: number; height: number } | undefined>(
        (resolve, reject) => {
            const img = new Image()

            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                })
            }

            img.onerror = reject
            img.src = url
        }
    )
}

export const runLightbox = () => {
    let lightboxContainer = document.querySelector(".lightbox")
    if (!lightboxContainer) {
        lightboxContainer = document.createElement("div")
        lightboxContainer.classList.add("lightbox")
        document.body.appendChild(lightboxContainer)
    }
    Array.from(
        document.querySelectorAll<HTMLImageElement>(
            `.article-content img, .${LIGHTBOX_IMAGE_CLASS}`
        )
    ).forEach((img) => {
        if (img.closest("[data-no-lightbox]")) return

        img.classList.add("lightbox-enabled")
        img.addEventListener("click", async () => {
            // An attribute placed by our WP image formatter: the URL of the original image without any WxH suffix
            const highResSrc = img.getAttribute("data-high-res-src")
            // If the image is a Gdoc Image with a smallFilename, get the source that is currently active
            const activeSourceImgUrl = getActiveSourceImgUrl(img)
            const imgFilename = getFilenameFromCloudflareUrl(activeSourceImgUrl)

            const imgSrc = highResSrc
                ? // getAttribute doesn't automatically URI encode values, img.src does
                  encodeURI(highResSrc)
                : activeSourceImgUrl
                  ? activeSourceImgUrl
                  : img.src

            // load image in advance and get naturalHeight and naturalWidth
            // if the image doesn't load, use the dimensions of the img element
            const dimensions = await getImageDimensions(imgSrc)
            const width = dimensions?.width || img.width
            const height = dimensions?.height || img.height

            const imgAlt = img.alt
            if (imgSrc) {
                ReactDOM.render(
                    <Lightbox
                        imgSrc={imgSrc}
                        imgFilename={imgFilename}
                        containerNode={lightboxContainer}
                    >
                        {(isLoaded: boolean, setIsLoaded: any) => (
                            <LightboxImage
                                width={width}
                                height={height}
                                src={imgSrc}
                                alt={imgAlt}
                                isLoaded={isLoaded}
                                setIsLoaded={setIsLoaded}
                            />
                        )}
                    </Lightbox>,
                    lightboxContainer
                )
            }
        })
    })
}
