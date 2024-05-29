import {
    GRAPHER_LEGEND_CLASS,
    GRAPHER_SIDE_PANEL_CLASS,
    GRAPHER_TIMELINE_CLASS,
} from "./GrapherConstants"

export function isElementInteractive(element: Element): boolean {
    const interactiveElements = [
        "a",
        "button",
        "input",
        `.${GRAPHER_TIMELINE_CLASS}`,
        `.${GRAPHER_SIDE_PANEL_CLASS}`,
        `.${GRAPHER_LEGEND_CLASS}`,
    ]
    const selector = interactiveElements.join(", ")

    // check if the target is an interactive element or contained within one
    return element.closest(selector) !== null
}
