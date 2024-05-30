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

const Lightbox = ({
    children,
    containerNode,
    imgSrc,
}: {
    children: any
    containerNode: Element | null
    imgSrc: string
}) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    const close = useCallback(() => {
        if (containerNode) {
            ReactDOM.unmountComponentAtNode(containerNode)
        }
    }, [containerNode])

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
                                    <a
                                        href={imgSrc}
                                        download={imgSrc.split("/").pop()}
                                        aria-label="Download high resolution image"
                                    >
                                        <FontAwesomeIcon icon={faDownload} />
                                    </a>
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

const Image = ({
    src,
    alt,
    isLoaded,
    setIsLoaded,
}: {
    src: string
    alt: string
    isLoaded: boolean
    setIsLoaded: any
}) => {
    return (
        <>
            <img
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
        img.addEventListener("click", () => {
            // An attribute placed by our WP image formatter: the URL of the original image without any WxH suffix
            const highResSrc = img.getAttribute("data-high-res-src")
            // If the image is a Gdoc Image with a smallFilename, get the source that is currently active
            const activeSourceImgUrl = getActiveSourceImgUrl(img)
            const imgSrc = highResSrc
                ? // getAttribute doesn't automatically URI encode values, img.src does
                  encodeURI(highResSrc)
                : activeSourceImgUrl
                  ? activeSourceImgUrl
                  : img.src

            const imgAlt = img.alt
            if (imgSrc) {
                ReactDOM.render(
                    <Lightbox imgSrc={imgSrc} containerNode={lightboxContainer}>
                        {(isLoaded: boolean, setIsLoaded: any) => (
                            <Image
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
