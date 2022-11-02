import React from "react"
import ReactDOMServer from "react-dom/server.js"
import { FullPost, WP_BlockClass, WP_BlockType } from "@ourworldindata/utils"
import { RelatedCharts } from "./RelatedCharts.js"

export const AllCharts = ({ post }: { post: FullPost }) => {
    if (!post.relatedCharts?.length) return null
    return (
        <>
            <h3>All our interactive charts on {post.title}</h3>
            <div className={WP_BlockClass.FullContentWidth}>
                <RelatedCharts charts={post.relatedCharts} />
            </div>
        </>
    )
}

export const renderAllCharts = (cheerioEl: CheerioStatic, post: FullPost) =>
    cheerioEl(`block[type='${WP_BlockType.AllCharts}']`).each(function (
        this: CheerioElement
    ) {
        const $block = cheerioEl(this)

        const rendered = ReactDOMServer.renderToStaticMarkup(
            <AllCharts post={post} />
        )
        $block.after(rendered)
        $block.remove()
    })
