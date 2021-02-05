import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { ENV } from "../settings/serverSettings"
import { GlobalEntitySelector } from "../grapher/controls/globalEntitySelector/GlobalEntitySelector"
import {
    GLOBAL_ENTITY_SELECTOR_DATA_ATTR,
    GLOBAL_ENTITY_SELECTOR_SELECTOR,
} from "../grapher/controls/globalEntitySelector/GlobalEntitySelectorConstants"
import { SelectionArray } from "../grapher/selection/SelectionArray"

export const bakeGlobalEntitySelector = (cheerioEl: CheerioStatic) => {
    // The data attr used to be `data-entity-select`, but later changed for consistency in the code.
    // But we should still support the old attribute.
    cheerioEl(`*[data-entity-select], ${GLOBAL_ENTITY_SELECTOR_SELECTOR}`).each(
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
