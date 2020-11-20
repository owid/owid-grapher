import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { GlobalEntitySelection } from "./GlobalEntitySelection"
import { GlobalEntityControl } from "./GlobalEntityControl"
import {
    GLOBAL_ENTITY_CONTROL_DATA_ATTR,
    GLOBAL_ENTITY_CONTROL_SELECTOR,
} from "./GlobalEntityControlConstants"

export function bakeGlobalEntityControl($: CheerioStatic) {
    // The data attr used to be `data-entity-select`, but later changed for consistency in the code.
    // But we should still support the old attribute.
    $(`*[data-entity-select], ${GLOBAL_ENTITY_CONTROL_SELECTOR}`).each(
        (_, el) => {
            const $el = $(el)
            const $section = $el.closest("section")

            const rendered = ReactDOMServer.renderToString(
                <GlobalEntityControl
                    globalEntitySelection={new GlobalEntitySelection()}
                />
            )

            // Move the element to top-level where <section>s are,
            // in order to make position:sticky work.
            $el.remove()
            $el.attr(GLOBAL_ENTITY_CONTROL_DATA_ATTR, "")
            $el.addClass("global-entity-control-container")
            $el.html(rendered).insertAfter($section)
        }
    )
}
