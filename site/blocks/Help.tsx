import React from "react"
import ReactDOMServer from "react-dom/server.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faLightbulb } from "@fortawesome/free-solid-svg-icons/faLightbulb.js"

const Help = ({
    title,
    content,
}: {
    title: string | null
    content: string | null
}) => {
    return (
        <div className="wp-block-help">
            <div className="icon">
                <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <div>
                {title ? <h4>{title}</h4> : null}
                <div
                    className="content"
                    dangerouslySetInnerHTML={{ __html: content || "" }}
                ></div>
            </div>
        </div>
    )
}

export const renderHelp = (cheerioEl: CheerioStatic) =>
    cheerioEl("block[type='help']").each(function (this: CheerioElement) {
        const $block = cheerioEl(this)
        const title = $block.find("h4").remove().text() || null
        const content = $block.find("content").html() // the title has been removed so the rest of the block is content.
        // Side note: "content" refers here to the <content> tag output by the block on the PHP side, not
        // the ".content" class.

        const rendered = ReactDOMServer.renderToStaticMarkup(
            <Help title={title} content={content} />
        )
        $block.after(rendered)
        $block.remove()
    })
