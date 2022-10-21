import { faCompress } from "@fortawesome/free-solid-svg-icons/faCompress"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faSearchMinus } from "@fortawesome/free-solid-svg-icons/faSearchMinus"
import { faSearchPlus } from "@fortawesome/free-solid-svg-icons/faSearchPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { LoadingIndicator } from "@ourworldindata/grapher"
import React, { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

export const LIGHTBOX_IMAGE_CLASS = "lightbox-image"

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

    const close = () => {
        if (containerNode) {
            ReactDOM.unmountComponentAtNode(containerNode)
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                close()
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    })

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
    isLoaded,
    setIsLoaded,
}: {
    src: string
    isLoaded: boolean
    setIsLoaded: any
}) => {
    return (
        <>
            <img
                onLoad={() => {
                    setIsLoaded(true)
                }}
                src={src}
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
            const imgSrc = img.getAttribute("data-high-res-src") ?? img.src
            if (imgSrc) {
                ReactDOM.render(
                    <Lightbox imgSrc={imgSrc} containerNode={lightboxContainer}>
                        {(isLoaded: boolean, setIsLoaded: any) => (
                            <Image
                                src={imgSrc}
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
