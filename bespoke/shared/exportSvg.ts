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

// Smallest dimension (px) an <svg> must have to count as a viz
const MIN_VIZ_SIZE = 60

/** Find the viz <svg>s under `root` (excluding small icons/swatches), descending into shadow roots. */
function findVizSvgs(root: ParentNode): SVGSVGElement[] {
    const svgs: SVGSVGElement[] = []
    const collect = (node: ParentNode): void => {
        for (const el of node.querySelectorAll("*")) {
            if (el instanceof SVGSVGElement) {
                const rect = el.getBoundingClientRect()
                if (Math.max(rect.width, rect.height) >= MIN_VIZ_SIZE)
                    svgs.push(el)
            }
            if (el.shadowRoot) collect(el.shadowRoot)
        }
    }
    collect(root)
    return svgs
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

function triggerDownload(markup: string, filename: string): void {
    const blob = new Blob([markup], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

/**
 * Download every viz SVG under `root` as a standalone file, named `<baseName>.svg`
 * (or `<baseName>-1.svg`, `<baseName>-2.svg`, … when a viz has more than one, e.g.
 * the split Sankey). Pass `baseName` without an extension.
 */
export function downloadSvgs(root: ParentNode, baseName: string): void {
    const svgs = findVizSvgs(root)
    if (svgs.length === 0) {
        console.error("No viz <svg> found under the given root.")
        return
    }
    svgs.forEach((svg, i) => {
        const filename =
            svgs.length > 1 ? `${baseName}-${i + 1}.svg` : `${baseName}.svg`
        triggerDownload(serializeStandaloneSvg(svg), filename)
    })
}
