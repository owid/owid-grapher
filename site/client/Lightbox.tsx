import * as React from "react"
import * as ReactDOM from "react-dom"
import { useRef, useState, useEffect } from "react"
import { LoadingBlocker } from "admin/client/LoadingBlocker"
const Panzoom = require("@panzoom/panzoom")
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { PanzoomObject } from "@panzoom/panzoom/dist/src/types"

const Lightbox = ({
    children,
    containerNode
}: {
    children: React.ReactElement
    containerNode: Element | null
}) => {
    const containerRef = useRef<HTMLDivElement>(null!)

    const close = () => {
        if (containerNode) {
            ReactDOM.unmountComponentAtNode(containerNode)
        }
    }

    return (
        <div ref={containerRef} className="container">
            <div className="content">{children}</div>
            <button aria-label="Close" onClick={close} className="close">
                <FontAwesomeIcon icon={faPlus} />
            </button>
        </div>
    )
}

const Image = ({ src }: { src: string }) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const panzoom = useRef<PanzoomObject | null>(null)

    const imageRef = useRef<HTMLImageElement>(null!)
    const imageContainerRef = useRef<HTMLDivElement>(null!)

    const toggleZoom = () => {
        if (panzoom.current) {
            if (panzoom.current.getScale() === 1) {
                panzoom.current.zoom(
                    imageRef.current.naturalWidth /
                        imageRef.current.clientWidth,
                    { animate: true }
                )
            } else {
                panzoom.current.reset()
            }
        }
    }

    useEffect(() => {
        if (imageRef.current.naturalWidth > imageRef.current.clientWidth) {
            panzoom.current = Panzoom(imageContainerRef.current, {
                panOnlyWhenZoomed: true,
                maxScale:
                    imageRef.current.naturalWidth / imageRef.current.clientWidth
            })
        }
        return () => {
            if (panzoom.current) {
                panzoom.current.destroy()
            }
        }
    }, [imageRef, isLoaded])

    return (
        <>
            {!isLoaded && <LoadingBlocker />}
            <div ref={imageContainerRef}>
                <img
                    onLoad={() => {
                        setIsLoaded(true)
                    }}
                    src={src}
                    style={{ opacity: !isLoaded ? 0 : 1 }}
                    onDoubleClick={toggleZoom}
                    ref={imageRef}
                />
            </div>
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
    Array.from(document.querySelectorAll("img")).forEach(img => {
        img.addEventListener("click", () => {
            const imgSrc = img.getAttribute("data-high-res-src")
                ? img.getAttribute("data-high-res-src")
                : img.src
            if (imgSrc) {
                ReactDOM.render(
                    <Lightbox containerNode={lightboxContainer}>
                        <Image src={imgSrc} />
                    </Lightbox>,
                    lightboxContainer
                )
            }
        })
    })
}
