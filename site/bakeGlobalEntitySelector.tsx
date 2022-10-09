import {
    GlobalEntitySelector,
    GLOBAL_ENTITY_SELECTOR_DATA_ATTR,
    GLOBAL_ENTITY_SELECTOR_ELEMENT,
    SelectionArray,
} from "@ourworldindata/grapher"
import React from "react"
import ReactDOMServer from "react-dom/server.js"
import { ENV } from "../settings/serverSettings.js"

export const bakeGlobalEntitySelector = (cheerioEl: CheerioStatic) => {
    // The data attr used to be `data-entity-select`, but later changed for consistency in the code.
    // But we should still support the old attribute.
    cheerioEl(`*[data-entity-select], ${GLOBAL_ENTITY_SELECTOR_ELEMENT}`).each(
        (_, el) => {
            const $el = cheerioEl(el)
            const $section = $el.closest("section")

            const rendered = ReactDOMServer.renderToString(
                <GlobalEntitySelector
                    environment={ENV}
                    selection={new SelectionArray()}
                />
            )

            // Move the element to top-level where <section>s are,
            // in order to make position:sticky work.
            $el.remove()
            $el.attr(GLOBAL_ENTITY_SELECTOR_DATA_ATTR, "")
            $el.addClass("global-entity-control-container")
            $el.html(rendered).insertAfter($section)
        }
    )
}
