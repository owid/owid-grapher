import { useState, useRef, useEffect } from "react"
import AnimateHeight from "react-animate-height"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"
import { MultiEmbedderSingleton } from "../../site/multiembedder/MultiEmbedder.js"

export const ADDITIONAL_INFORMATION_CLASS_NAME =
    "wp-block-owid-additional-information"
export const VARIATION_MERGE_LEFT = "merge-left"
export const VARIATION_FULL_WIDTH = "full-width"

/*
 * This block has 2 variations (on large screens):
 * 1- merge left, with or without image.
 * 2- full width, with its content using the usual automatic layout
 *
 * For both these variations, the title is optional and is
 * assumed to be contained in the first h3 tag.
 */

export const AdditionalInformation = ({
    content,
    title,
    image,
    variation,
    defaultOpen,
}: {
    content: string | null
    title: string | null
    image: string | null
    variation: string
    defaultOpen: boolean
}) => {
    const [height, setHeight] = useState<number | "auto">(
        defaultOpen ? "auto" : 0
    )
    const [hasBeenOpened, setHasBeenOpened] = useState(defaultOpen)
    const refContainer = useRef<HTMLDivElement>(null)
    const classes = [ADDITIONAL_INFORMATION_CLASS_NAME]

    useEffect(() => {
        const onOpenHandler = () => {
            setHeight("auto")
            if (!hasBeenOpened) {
                setHasBeenOpened(true)
            }
        }

        if (refContainer.current) {
            // Trigger embedder check for new figures that may have become visible.
            MultiEmbedderSingleton.observeFigures(refContainer.current)
        }
        // Expands accordions for print media.
        window.addEventListener("beforeprint", () => {
            onOpenHandler()
        })
    }, [hasBeenOpened])

    const onClickHandler = () => {
        setHeight(height === 0 ? "auto" : 0)
        if (!hasBeenOpened) {
            setHasBeenOpened(true)
        }
    }

    if (image) {
        classes.push("with-image")
    }
    if (height !== 0) {
        classes.push("open")
    }

    const renderFullWidthVariation = () => {
        return (
            <div
                className="content"
                dangerouslySetInnerHTML={{ __html: content || "" }}
            ></div>
        )
    }

    const renderMergeLeftVariation = () => {
        return (
            <div className="content-wrapper">
                {image ? (
                    <figure
                        dangerouslySetInnerHTML={{ __html: image || "" }}
                    ></figure>
                ) : null}
                <div
                    className="content"
                    dangerouslySetInnerHTML={{ __html: content || "" }}
                ></div>
            </div>
        )
    }

    return (
        <div
            data-variation={variation}
            data-default-open={defaultOpen}
            ref={refContainer}
            className={classes.join(" ")}
        >
            <h3
                className="additional-information__heading"
                onClick={onClickHandler}
                data-track-note="additional_information_toggle"
            >
                <FontAwesomeIcon icon={faAngleRight} />
                {title}
            </h3>
            <AnimateHeight height={height} animateOpacity={true} duration={250}>
                {variation === VARIATION_MERGE_LEFT
                    ? renderMergeLeftVariation()
                    : renderFullWidthVariation()}
            </AnimateHeight>
        </div>
    )
}

export default AdditionalInformation
