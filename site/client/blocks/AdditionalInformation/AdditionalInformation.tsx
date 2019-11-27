import * as React from "react"
import { useState } from "react"
import * as ReactDOM from "react-dom"
import * as ReactDOMServer from "react-dom/server"
import AnimateHeight from "react-animate-height"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"

const CLASS_NAME = "wp-block-owid-additional-information"

const AdditionalInformation = ({
    content,
    title,
    image
}: {
    content: string | null
    title: string | null
    image: string | null
}) => {
    const [height, setHeight] = useState<number | string>(0)
    const classes = [CLASS_NAME]

    const onClickHandler = () => {
        setHeight(height === 0 ? "auto" : 0)
    }

    if (image) {
        classes.push("with-image")
    }
    if (height !== 0) {
        classes.push("open")
    }

    return (
        <div className={classes.join(" ")}>
            <h3 onClick={onClickHandler}>
                {title}
                <FontAwesomeIcon icon={faAngleRight} />
            </h3>
            <AnimateHeight height={height}>
                <div className="content-wrapper">
                    {image ? (
                        <figure
                            dangerouslySetInnerHTML={{ __html: image || "" }}
                        ></figure>
                    ) : null}
                    <div
                        className="content"
                        dangerouslySetInnerHTML={{ __html: content || "" }}
                        onClick={onClickHandler}
                    ></div>
                </div>
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
        const title = $block.find("h3").text() || "Additional information"
        const image = $block
            .find(".wp-block-column:first-child img[src]") // Wordpress outputs empty <img> tags when none is selected so we need to filter those out
            .first()
            .parent()
            .html()

        const content = $block.find(".wp-block-column:last-child").html()
        const rendered = ReactDOMServer.renderToString(
            <div className="block-wrapper">
                <AdditionalInformation
                    content={content}
                    title={title}
                    image={image}
                />
            </div>
        )
        $block.after(rendered)
        $block.remove()
    })
}

export const hydrate = () => {
    document.querySelectorAll(`.${CLASS_NAME}`).forEach(block => {
        const blockWrapper = block.parentElement
        const titleEl = block.querySelector("h3")
        const title = titleEl ? titleEl.textContent : null
        const figureEl = block.querySelector("figure")
        const image = figureEl ? figureEl.innerHTML : null
        const contentEl = block.querySelector(".content")
        const content = contentEl ? contentEl.innerHTML : null
        ReactDOM.hydrate(
            <AdditionalInformation
                content={content}
                title={title}
                image={image}
            />,
            blockWrapper
        )
    })
}
