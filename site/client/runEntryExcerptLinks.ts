import { select, selectAll } from 'd3-selection'

export function runEntryExcerptLinks() {
    const container = selectAll("#entries")
    const entryItems = container.selectAll(".entry-item")

    let collapsedHeight: number
    let zIndex: number = 100

    container.selectAll(".entry-item").each(function() {
        const element = this as HTMLElement
        if (element.parentNode) {
            const elementCopy = element.parentNode.appendChild(element.cloneNode(true))
            collapsedHeight = element.offsetHeight
            select(elementCopy as HTMLElement)
                .classed("floating", true)
                .style("height", `${element.offsetHeight}px`)
                .style("max-height", "none")
        }
    })

    container.selectAll(".entry-item-container").on("mouseenter", function() {
        const floating = select(this).select(".floating")
        const targetHeight = (floating.node() as HTMLElement).scrollHeight
        floating
            .style("height", `${targetHeight}px`)
            .style("z-index", zIndex++)
    })

    container.selectAll(".entry-item-container").on("mouseleave", function() {
        select(this).select(".floating").style("height", `${collapsedHeight}px`)
    })
}