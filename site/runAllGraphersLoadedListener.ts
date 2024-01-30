import {
    GRAPHER_EMBEDDED_FIGURE_ATTR,
    GRAPHER_LOADED_EVENT_NAME,
    ALL_GRAPHERS_LOADED_EVENT_NAME,
} from "@ourworldindata/grapher"
import {
    EXPLORER_EMBEDDED_FIGURE_SELECTOR,
    ExplorerContainerId,
} from "../explorer/ExplorerConstants.js"

// Counts the number of embeds in the page and dispatches an event when all of them are loaded
// See Grapher.tsx for the mobx reaction that is dispatched when a grapher is loaded
export function runAllGraphersLoadedListener() {
    const grapherEmbeds = [
        ...document.querySelectorAll(
            [
                // embedded graphers
                `[${GRAPHER_EMBEDDED_FIGURE_ATTR}]`,
                // embedded explorers
                `[${EXPLORER_EMBEDDED_FIGURE_SELECTOR}]`,
                // explorers in explorer pages
                `#${ExplorerContainerId}`,
            ].join()
        ),
        // filter out embeds that have a parent with display:none e.g. inside expandable paragraphs
    ].filter((el) => {
        let parent = el.parentElement
        while (parent) {
            if (parent.style.display === "none") return false
            parent = parent.parentElement
        }
        return true
    })

    if (grapherEmbeds.length === 0) {
        // Putting this dispatch inside a timeout so external scripts have enough time to set up a listener.
        // This isn't ideal, but it seems better than duplicating the grapher selection and filtering code any time
        // we need to handle the case where there are no graphers on the page.
        setTimeout(() => {
            document.dispatchEvent(
                new CustomEvent(ALL_GRAPHERS_LOADED_EVENT_NAME)
            )
        }, 2000)
    }
    let loadedEmbeds = 0
    document.addEventListener(GRAPHER_LOADED_EVENT_NAME, () => {
        loadedEmbeds++
        if (loadedEmbeds === grapherEmbeds.length) {
            document.dispatchEvent(
                new CustomEvent(ALL_GRAPHERS_LOADED_EVENT_NAME)
            )
        }
    })
}
