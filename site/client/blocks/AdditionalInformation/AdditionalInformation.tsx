import * as React from "react"
import { useState, useRef, useEffect } from "react"
import * as ReactDOM from "react-dom"
import * as ReactDOMServer from "react-dom/server"
import AnimateHeight from "react-animate-height"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"
import { MultiEmbedder } from "site/client/Grapher"

export const CLASS_NAME = "wp-block-owid-additional-information"
const VARIATION_MERGE_LEFT = "merge-left"
const VARIATION_FULL_WIDTH = "full-width"

/*
 * This block has 2 variations (on large screens):
 * 1- merge left, with or without image.
 * 2- full width, with its content using the usual automatic layout
 *
 * For both these variations, the title is optional and is
 * assumed to be contained in the first h3 tag.
 */

const AdditionalInformation = ({
    content,
    title,
    image,
    variation
}: {
    content: string | null
    title: string | null
    image: string | null
    variation: string
}) => {
    const [height, setHeight] = useState<number | string>(0)
    const [hasBeenOpened, setHasBeenOpened] = useState(false)
    const refContainer = useRef<HTMLDivElement>(null)
    const classes = [CLASS_NAME]

    useEffect(() => {
        if (refContainer.current) {
            // tslint:disable-next-line: no-unused-expression
            new MultiEmbedder(refContainer.current)
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

    const onOpenHandler = () => {
        setHeight("auto")
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
            ref={refContainer}
            className={classes.join(" ")}
        >
            <h3 onClick={onClickHandler}>
                <FontAwesomeIcon icon={faAngleRight} />
                {title}
            </h3>
            <AnimateHeight height={height} animateOpacity={true}>
                {variation === VARIATION_MERGE_LEFT
                    ? renderMergeLeftVariation()
                    : renderFullWidthVariation()}
            </AnimateHeight>
        </div>
    )
}

export default AdditionalInformation

export const render = ($: CheerioStatic) => {
    $("block[type='additional-information']").each(function(
        this: CheerioElement
    ) {
        const $block = $(this)
        const variation = $block.find(".is-style-merge-left").length
            ? VARIATION_MERGE_LEFT
            : VARIATION_FULL_WIDTH
        const title =
            $block
                .find("h3")
                .remove()
                .text() || "Additional information"
        const image =
            variation === VARIATION_MERGE_LEFT
                ? $block
                      .find(".wp-block-column:first-child img[src]") // Wordpress outputs empty <img> tags when none is selected so we need to filter those out
                      .first()
                      .parent() // Get the wrapping <figure>
                      .html()
                : null
        const content =
            variation === VARIATION_MERGE_LEFT
                ? $block.find(".wp-block-column:last-child").html()
                : $block.find("content").html() // the title has been removed so the rest of a variation "full width" block is content.
        // Side note: "content" refers here to the <content> tag output by the block on the PHP side, not
        // the ".content" class.
        const rendered = ReactDOMServer.renderToString(
            <div className="block-wrapper">
                <AdditionalInformation
                    content={content}
                    title={title}
                    image={image}
                    variation={variation}
                />
            </div>
        )
        $block.after(rendered)
        $block.remove()
    })
}

export const hydrate = () => {
    document.querySelectorAll<HTMLElement>(`.${CLASS_NAME}`).forEach(block => {
        const blockWrapper = block.parentElement
        const titleEl = block.querySelector("h3")
        const title = titleEl ? titleEl.textContent : null
        const variation = block.getAttribute("data-variation") || ""
        const figureEl = block.querySelector(".content-wrapper > figure")
        const image = figureEl ? figureEl.innerHTML : null
        const contentEl = block.querySelector(".content")
        const content = contentEl ? contentEl.innerHTML : null
        ReactDOM.hydrate(
            <AdditionalInformation
                content={content}
                title={title}
                image={image}
                variation={variation}
            />,
            blockWrapper
        )
    })
}
