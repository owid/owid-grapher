import * as React from "react"
import * as ReactDOMServer from "react-dom/server.js"
import { ENV } from "../settings/serverSettings.js"
import { GlobalEntitySelector } from "../grapher/controls/globalEntitySelector/GlobalEntitySelector.js"
import {
    GLOBAL_ENTITY_SELECTOR_DATA_ATTR,
    GLOBAL_ENTITY_SELECTOR_ELEMENT,
} from "../grapher/controls/globalEntitySelector/GlobalEntitySelectorConstants.js"
import { SelectionArray } from "../grapher/selection/SelectionArray.js"

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
