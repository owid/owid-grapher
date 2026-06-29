/** Export a bespoke viz as a standalone SVG */

// Paint and text properties to inline so the SVG is self-contained
const STYLE_PROPS = [
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-miterlimit",
    "opacity",
    "color",
    "visibility",
    "mix-blend-mode",
    "paint-order",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-variant",
    "letter-spacing",
    "word-spacing",
    "text-anchor",
    "text-decoration",
    "dominant-baseline",
    "alignment-baseline",
]

const renderedArea = (el: Element): number => {
    const rect = el.getBoundingClientRect()
    return rect.width * rect.height
}

/** Find the largest <svg> by rendered area, descending into shadow roots. */
function findLargestSvg(root: ParentNode): SVGSVGElement | undefined {
    const svgs: SVGSVGElement[] = []
    const collect = (node: ParentNode): void => {
        for (const el of node.querySelectorAll("*")) {
            if (el instanceof SVGSVGElement) svgs.push(el)
            if (el.shadowRoot) collect(el.shadowRoot)
        }
    }
    collect(root)
    return svgs.sort((a, b) => renderedArea(b) - renderedArea(a))[0]
}

/** Clone an SVG with its computed styles inlined so it stands on its own. */
function serializeStandaloneSvg(source: SVGSVGElement): string {
    const clone = source.cloneNode(true) as SVGSVGElement

    // Walk source and clone in lockstep. Iterate back-to-front so removing a
    // hidden node doesn't shift the indices of nodes we've yet to visit.
    const sourceNodes = [source, ...source.querySelectorAll("*")]
    const cloneNodes = [clone, ...clone.querySelectorAll("*")]
    for (let i = sourceNodes.length - 1; i >= 0; i--) {
        const dest = cloneNodes[i]
        if (!(dest instanceof SVGElement)) continue
        const style = getComputedStyle(sourceNodes[i])
        if (style.display === "none") {
            dest.remove() // drop hover tooltips, inactive states, etc.
            continue
        }
        let inline = dest.getAttribute("style") ?? ""
        for (const prop of STYLE_PROPS) {
            const value = style.getPropertyValue(prop)
            if (value && value !== "normal" && value !== "auto") {
                inline += `${prop}:${value};`
            }
        }
        if (inline) dest.setAttribute("style", inline)
    }

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    if (!clone.getAttribute("viewBox")) {
        const rect = source.getBoundingClientRect()
        clone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`)
    }

    return new XMLSerializer().serializeToString(clone)
}

/** Find the largest viz SVG under `root` and download it as a standalone file. */
export function downloadSvg(root: ParentNode, filename: string): void {
    const svg = findLargestSvg(root)
    if (!svg) {
        console.error("downloadSvg: no <svg> found under the given root.")
        return
    }
    const blob = new Blob([serializeStandaloneSvg(svg)], {
        type: "image/svg+xml",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}
