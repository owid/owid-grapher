import {
    GRAPHER_EMBEDDED_FIGURE_ATTR,
    GRAPHER_LOADED_EVENT_NAME,
} from "@ourworldindata/grapher"
import {
    EXPLORER_EMBEDDED_FIGURE_SELECTOR,
    ExplorerContainerId,
} from "@ourworldindata/explorer"

declare global {
    interface Window {
        _OWID_HAVE_ALL_GRAPHERS_LOADED?: boolean
    }
}

/**
 * Counts the number of visible chart embeds in the page and sets a boolean on the window once all of them have loaded
 * We set a boolean instead of dispatching a second event, because grapher pages can sometimes finish loading faster than others scripts can execute
 * See Grapher.tsx for the mobx reaction that is dispatched when a grapher is loaded
 */
export function runAllGraphersLoadedListener() {
    const grapherEmbeds = [
        ...document.querySelectorAll<HTMLElement>(
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
            const computedStyle = window.getComputedStyle(parent)
            if (
                computedStyle.display === "none" ||
                computedStyle.visibility === "hidden"
            )
                return false

            // Parent height is so small that the child is not visible, e.g. inside expandable paragraph
            if (parent.offsetTop + parent.offsetHeight < el.offsetTop)
                return false

            parent = parent.parentElement
        }
        return true
    })

    if (grapherEmbeds.length === 0) {
        window._OWID_HAVE_ALL_GRAPHERS_LOADED = true
    }
    let loadedEmbeds = 0
    document.addEventListener(GRAPHER_LOADED_EVENT_NAME, () => {
        loadedEmbeds++
        if (loadedEmbeds === grapherEmbeds.length) {
            window._OWID_HAVE_ALL_GRAPHERS_LOADED = true
        }
    })
}
