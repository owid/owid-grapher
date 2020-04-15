import * as React from "react"
import ReactDOMServer from "react-dom/server"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLightbulb } from "@fortawesome/free-solid-svg-icons/faLightbulb"

const Help = ({
    title,
    content
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

export default Help

export const render = ($: CheerioStatic) => {
    $("block[type='help']").each(function(this: CheerioElement) {
        const $block = $(this)
        const title =
            $block
                .find("h4")
                .remove()
                .text() || null
        const content = $block.find("content").html() // the title has been removed so the rest of the block is content.
        // Side note: "content" refers here to the <content> tag output by the block on the PHP side, not
        // the ".content" class.

        const rendered = ReactDOMServer.renderToStaticMarkup(
            <Help title={title} content={content} />
        )
        $block.after(rendered)
        $block.remove()
    })
}
