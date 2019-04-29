import { select, selectAll } from 'd3-selection'

export function runEntryExcerptLinks() {
    const container = selectAll("#entries")
    const entryItems = container.selectAll(".entry-item")

    let zIndex: number = 100

    // container.selectAll(".entry-item").each(function() {
    //     const element = this as HTMLElement
    //     if (element.parentNode) {
    //         const elementCopy = element.parentNode.appendChild(element.cloneNode(true))
    //         collapsedHeight = element.offsetHeight
    //         select(elementCopy as HTMLElement)
    //             .classed("floating", true)
    //             .style("height", `${element.offsetHeight}px`)
    //             .style("max-height", "none")
    //     }
    // })

    container.selectAll(".entry-item-container").on("mouseenter", function() {
        const entryItem = select(this).select(".entry-item")
        const contentsEl = (entryItem.select(".entry-item-contents").node() as HTMLElement)
        const targetHeight = Math.max(contentsEl.scrollHeight, contentsEl.offsetHeight)
        entryItem
            .style("height", `${targetHeight}px`)
            .style("z-index", zIndex++)
    })

    container.selectAll(".entry-item-container").on("mouseleave", function() {
        select(this).select(".entry-item").style("height", null)
    })
}