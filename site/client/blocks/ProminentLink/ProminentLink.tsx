import * as React from "react"
import ReactDOMServer from "react-dom/server"

const PROMINENT_LINK_CLASSNAME = "wp-block-owid-prominent-link"

const ProminentLink = ({ content }: { content: string | null }) => {
    return (
        <div className={PROMINENT_LINK_CLASSNAME}>
            <a dangerouslySetInnerHTML={{ __html: content ?? "" }} href=""></a>
        </div>
    )
}

export const render = ($: CheerioStatic) => {
    $(`.${PROMINENT_LINK_CLASSNAME}>a`).each((index, el) => {
        const $block = $(el)
        const innerHTML = $block.html()

        const rendered = ReactDOMServer.renderToStaticMarkup(
            <ProminentLink content={innerHTML} />
        )

        $block.after(rendered)
        $block.remove()
    })
}
