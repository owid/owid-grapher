import { hydrate } from "react-dom"
import { wrapInDiv } from "@ourworldindata/utils"
import {
    TableOfContents,
    TableOfContentsData,
    TOC_WRAPPER_CLASSNAME,
} from "./TableOfContents.js"

export const runTableOfContents = (tocData: TableOfContentsData) => {
    const tocWrapperEl = document.querySelector<HTMLElement>(
        `.${TOC_WRAPPER_CLASSNAME}`
    )
    if (!tocWrapperEl) return

    const sidebarRootEl = wrapInDiv(tocWrapperEl, ["sidebar-root"])
    hydrate(<TableOfContents {...tocData} />, sidebarRootEl)
}
