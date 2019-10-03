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
        const heading = entryItem.select("h4").node() as HTMLElement
        const excerpt = entryItem.select(".excerpt").node() as HTMLElement
        const targetHeight = heading.offsetHeight + excerpt.offsetHeight + 23
        // NOTE: we add heading and excerpt heights because getting the overall
        // scrollHeight of the container is not consistent across browsers.
        entryItem
            .style("height", `${targetHeight}px`)
            .style("z-index", ++zIndex)
    })

    container.selectAll(".entry-item-container").on("mouseleave", function() {
        const entryItem = select(this).select(".entry-item")
        entryItem
            .style("height", null)
            .style("z-index", --zIndex)
            .on("transitionend.zindex", () => {
                entryItem.style("z-index", null).on("transitionend.zindex", null)
            })
    })
}