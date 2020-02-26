import * as React from "react"
import * as ReactDOM from "react-dom"
import { useState, useRef } from "react"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faSearchPlus } from "@fortawesome/free-solid-svg-icons/faSearchPlus"
import { faSearchMinus } from "@fortawesome/free-solid-svg-icons/faSearchMinus"
import { faCompress } from "@fortawesome/free-solid-svg-icons/faCompress"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { LoadingBlocker } from "site/client/LoadingBlocker"

const DEFAULT_MAX_ZOOM_SCALE = 2

const Lightbox = ({
    children,
    containerNode
}: {
    children: any
    containerNode: Element | null
}) => {
    const close = () => {
        if (containerNode) {
            ReactDOM.unmountComponentAtNode(containerNode)
        }
    }
    const [maxScale, setMaxScale] = useState(DEFAULT_MAX_ZOOM_SCALE)
    const [isLoaded, setIsLoaded] = useState(false)

    return (
        <div className="container">
            {!isLoaded && <LoadingBlocker />}
            <TransformWrapper
                doubleClick={{ mode: "reset" }}
                options={{ maxScale }}
            >
                {({ zoomIn, zoomOut, resetTransform }: any) => (
                    <>
                        <div className="content">
                            <TransformComponent>
                                {children(isLoaded, setIsLoaded, setMaxScale)}
                            </TransformComponent>
                        </div>
                        <div className="tools">
                            <button aria-label="Zoom in" onClick={zoomIn}>
                                <FontAwesomeIcon icon={faSearchPlus} />
                            </button>
                            <button aria-label="Zoom out" onClick={zoomOut}>
                                <FontAwesomeIcon icon={faSearchMinus} />
                            </button>
                            <button
                                aria-label="Reset zoom"
                                onClick={resetTransform}
                            >
                                <FontAwesomeIcon icon={faCompress} />
                            </button>
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
    setMaxScale
}: {
    src: string
    isLoaded: boolean
    setIsLoaded: any
    setMaxScale: any
}) => {
    const imageRef = useRef<HTMLImageElement>(null!)

    return (
        <>
            <img
                onLoad={() => {
                    setIsLoaded(true)
                    if (src.split(".").pop() === "svg") {
                        setMaxScale(4)
                    } else {
                        if (
                            imageRef.current.naturalWidth !==
                            imageRef.current.clientWidth
                        ) {
                            setMaxScale(
                                imageRef.current.naturalWidth /
                                    imageRef.current.clientWidth
                            )
                        }
                    }
                }}
                src={src}
                style={{ opacity: !isLoaded ? 0 : 1, transition: "opacity 1s" }}
                ref={imageRef}
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
        document.querySelectorAll(
            ".article-content .wp-block-column:nth-child(2) img"
        )
    ).forEach(img => {
        img.addEventListener("click", () => {
            const imgSrc = img.getAttribute("data-high-res-src")
                ? img.getAttribute("data-high-res-src")
                : img.src
            if (imgSrc) {
                ReactDOM.render(
                    <Lightbox containerNode={lightboxContainer}>
                        {(
                            isLoaded: boolean,
                            setIsLoaded: any,
                            setMaxScale: any
                        ) => (
                            <Image
                                src={imgSrc}
                                isLoaded={isLoaded}
                                setIsLoaded={setIsLoaded}
                                setMaxScale={setMaxScale}
                            />
                        )}
                    </Lightbox>,
                    lightboxContainer
                )
            }
        })
    })
}
