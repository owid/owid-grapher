import { useCallback, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faSearchPlus,
    faSearchMinus,
    faCompress,
    faDownload,
    faPlus,
} from "@fortawesome/free-solid-svg-icons"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { LoadingIndicator } from "@ourworldindata/grapher"
import { triggerDownloadFromBlob } from "@ourworldindata/utils"
import { unmountComponentAtNode } from "react-dom"
import { useTriggerOnEscape } from "./hooks.js"

export const Lightbox = ({
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
            unmountComponentAtNode(containerNode)
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
