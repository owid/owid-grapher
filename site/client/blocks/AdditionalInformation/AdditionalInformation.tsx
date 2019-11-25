import * as React from "react"
import { useState } from "react"
import * as ReactDOM from "react-dom"
import * as ReactDOMServer from "react-dom/server"
import AnimateHeight from "react-animate-height"

const CLASS_NAME = "wp-block-owid-additional-information"

const AdditionalInformation = ({
    content,
    title
}: {
    content: string | null
    title: string | null
}) => {
    const [height, setHeight] = useState<number | string>(0)

    const onClickHandler = () => {
        setHeight(height === 0 ? "auto" : 0)
    }
    return (
        <div className={CLASS_NAME}>
            <h3 onClick={onClickHandler}>{title}</h3>
            <AnimateHeight height={height}>
                <div
                    className="content"
                    dangerouslySetInnerHTML={{ __html: content || "" }}
                    onClick={onClickHandler}
                ></div>
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
        const title = $block.find("attributes title").text()
        const content = $block.find("content").html()
        const rendered = ReactDOMServer.renderToString(
            <div className="block-wrapper">
                <AdditionalInformation content={content} title={title} />
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
        const contentEl = block.querySelector(".content")
        const content = contentEl ? contentEl.innerHTML : null
        ReactDOM.hydrate(
            <AdditionalInformation content={content} title={title} />,
            blockWrapper
        )
    })
}
