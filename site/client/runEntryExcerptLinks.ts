import { select, selectAll, BaseType } from 'd3-selection'

export function runEntryExcerptLinks() {
    const container = selectAll("#entries")
    container.selectAll(".entry-item").each(function() {
        const element = this as Element
        if (element.parentNode) {
            const elementCopy = element.parentNode.insertBefore(element.cloneNode(true), element)
            select(elementCopy as BaseType).classed("floating", true)
        }
    })
}