import ReactDOMServer from "react-dom/server"
import { Help } from "./Help.js"
import { CheerioAPI } from "cheerio"

export const renderHelp = (cheerioEl: CheerioAPI) =>
    cheerioEl("block[type='help']").each((_i, el) => {
        const $block = cheerioEl(el)
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
