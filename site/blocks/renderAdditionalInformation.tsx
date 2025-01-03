import ReactDOMServer from "react-dom/server.js"
import {
    VARIATION_MERGE_LEFT,
    VARIATION_FULL_WIDTH,
    AdditionalInformation,
} from "./AdditionalInformation.js"

export const renderAdditionalInformation = ($: CheerioStatic) => {
    $("block[type='additional-information']").each(function (
        this: CheerioElement
    ) {
        const $block = $(this)
        const variation = $block.find(".is-style-merge-left").length
            ? VARIATION_MERGE_LEFT
            : VARIATION_FULL_WIDTH
        const title =
            $block.find("h3").remove().text() || "Additional information"
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
        const defaultOpen = $block.attr("default-open") === "true"
        const rendered = ReactDOMServer.renderToString(
            <div className="block-wrapper">
                <AdditionalInformation
                    content={content}
                    title={title}
                    image={image}
                    variation={variation}
                    defaultOpen={defaultOpen}
                />
            </div>
        )
        $block.after(rendered)
        $block.remove()
    })
}
