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
import { LoadingIndicator, BodyDiv } from "@ourworldindata/components"
import { triggerDownloadFromBlob } from "@ourworldindata/utils"
import { useTriggerOnEscape } from "./hooks.js"
import cx from "classnames"

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
        <img
            width={width}
            height={height}
            onLoad={() => setIsLoaded(true)}
            className={cx({
                "lightbox__img--is-svg": src.endsWith(".svg"),
            })}
            src={src}
            alt={alt}
            style={{ opacity: !isLoaded ? 0 : 1, transition: "opacity 1s" }}
        />
    )
}

export const Lightbox = ({
    onClose,
    imgSrc,
    imgFilename,
    width,
    height,
    alt,
}: {
    onClose: () => void
    imgSrc: string
    imgFilename?: string
    width: number
    height: number
    alt: string
    // With CF Images, the filename is not the last part of the URL
    // so we need to pass it separately
}) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    const handleDownload = useCallback(async () => {
        const response = await fetch(imgSrc)
        const blob = await response.blob()
        const filename = imgFilename || imgSrc.split("/").pop() || "image"
        triggerDownloadFromBlob(filename, blob)
    }, [imgFilename, imgSrc])

    const onContentClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === contentRef.current) {
                onClose()
            }
        },
        [onClose]
    )

    useTriggerOnEscape(onClose)

    return (
        <BodyDiv divClassname="lightbox">
            <div className="container">
                {!isLoaded && <LoadingIndicator color="#ccc" />}
                <TransformWrapper
                    doubleClick={{ mode: "reset" }}
                    smooth={false}
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            <div
                                className="content"
                                ref={contentRef}
                                onClick={onContentClick}
                            >
                                <TransformComponent>
                                    <LightboxImage
                                        width={width}
                                        height={height}
                                        src={imgSrc}
                                        alt={alt}
                                        isLoaded={isLoaded}
                                        setIsLoaded={setIsLoaded}
                                    />
                                </TransformComponent>
                            </div>
                            <div className="tools">
                                {isLoaded && (
                                    <>
                                        <button
                                            aria-label="Zoom in"
                                            onClick={() => zoomIn()}
                                        >
                                            <FontAwesomeIcon
                                                icon={faSearchPlus}
                                            />
                                        </button>
                                        <button
                                            aria-label="Zoom out"
                                            onClick={() => zoomOut()}
                                        >
                                            <FontAwesomeIcon
                                                icon={faSearchMinus}
                                            />
                                        </button>
                                        <button
                                            aria-label="Reset zoom"
                                            onClick={() => resetTransform()}
                                        >
                                            <FontAwesomeIcon
                                                icon={faCompress}
                                            />
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            aria-label="Download high resolution image"
                                        >
                                            <FontAwesomeIcon
                                                icon={faDownload}
                                            />
                                        </button>
                                    </>
                                )}
                                <button
                                    aria-label="Close"
                                    onClick={onClose}
                                    className="close"
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </>
                    )}
                </TransformWrapper>
            </div>
        </BodyDiv>
    )
}
