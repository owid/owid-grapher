import { isEmpty } from "lodash"

const loadScript = (path: string) =>
    new Promise((resolve, reject) => {
        const s = document.createElement("script")
        s.onload = () => resolve(s) // resolve with script, not event
        s.onerror = reject
        s.src = path
        document.body.appendChild(s)
    })

const loadCss = (path: string) =>
    new Promise((resolve, reject) => {
        const s = document.createElement("link")
        s.onload = () => resolve(s) // resolve with script, not event
        s.onerror = reject
        s.rel = "stylesheet"
        s.href = path
        document.head.appendChild(s)
    })

function* recursivelyYieldRelevantContentNodes(parent: Node): Generator<Node> {
    for (const node of parent.childNodes.values()) {
        if (
            node.nodeName === "H3" ||
            node.nodeName === "H2" ||
            node.nodeName === "H4" ||
            node.nodeName === "P" ||
            node.nodeName === "UL" ||
            node.nodeName === "FIGURE"
        ) {
            yield node.cloneNode(true)
        } else if (node.nodeName === "DIV" || node.nodeName === "SECTION")
            yield* recursivelyYieldRelevantContentNodes(node) as any
    }
}

interface SlideFragments {
    title: Node | undefined
    isTitleSlide: boolean

    text: Node[]
    graphs: Node[]
}

function slideFragmentIsEmpty(fragment: SlideFragments) {
    return (
        fragment.title === undefined &&
        isEmpty(fragment.text) &&
        isEmpty(fragment.graphs)
    )
}
function createSlides() {
    const article = document.querySelector("article")
    if (article === null) return
    const slides: SlideFragments[] = []
    let currentSlide: SlideFragments = {
        title: undefined,
        isTitleSlide: true,
        text: [],
        graphs: [],
    }
    for (const node of recursivelyYieldRelevantContentNodes(article)) {
        if (
            node.nodeName === "H3" ||
            node.nodeName === "H2" ||
            node.nodeName === "H4"
        ) {
            if (slideFragmentIsEmpty(currentSlide)) {
                currentSlide.title = node.cloneNode(true)
            } else {
                slides.push(currentSlide)
                currentSlide = {
                    title: node.cloneNode(true),
                    isTitleSlide: false,
                    text: [],
                    graphs: [],
                }
            }
        } else if (node.nodeName === "P" || node.nodeName === "UL") {
            const newtag = node.cloneNode(true)
            currentSlide.text.push(newtag)
        } else if (node.nodeName === "FIGURE") {
            const grapherSrc = (node as HTMLElement).dataset.grapherSrc
            const dataExplorerSrc = (node as HTMLElement).dataset
                .dataExplorerSrc
            let newtag: Node
            if (grapherSrc || dataExplorerSrc) {
                const src = grapherSrc ?? dataExplorerSrc
                // If we have a grapherSrc set, create an iframe and set the src so that
                // the grapher is re-initialized at the new size correctly
                const iframe = document.createElement("iframe")
                iframe.src = src!
                ;(iframe as any).loading = "lazy"
                iframe.style.width = "100%"
                iframe.style.height = "600px"
                iframe.style.border = "0px none"
                newtag = iframe
            } else {
                // If we have a static image just clone the content
                newtag = node.cloneNode(true)
            }
            //node.cloneNode(true)
            currentSlide.graphs.push(newtag)
        }
    }

    if (currentSlide !== undefined) slides.push(currentSlide)
    const bodyNode = document.body
    const revealDiv = bodyNode.appendChild(document.createElement("div"))
    revealDiv.classList.add("reveal")
    const sectionsParent = revealDiv.appendChild(document.createElement("div"))
    sectionsParent.classList.add("slides")

    const addColumn = (parent: Node, nodes: Node[], classes: string[]) => {
        const column = document.createElement("div")
        column.classList.add(...classes)
        for (const node of nodes) column.appendChild(node.cloneNode(true))
        parent.appendChild(column)
    }

    const addSlide = (
        section: SlideFragments,
        parent: Node,
        graph: Node | undefined
    ) => {
        const newsection = document.createElement("section")

        if (section.isTitleSlide) newsection.classList.add("title-slide")

        if (section.title !== undefined) {
            const title = section.title.cloneNode(true)
            newsection.appendChild(title)
            if (graph === undefined && section.text.length === 0)
                (title as HTMLElement).classList.add("title-only")
        }
        if (graph !== undefined && section.text.length > 0) {
            addColumn(
                newsection,
                [graph],
                ["slideshow-column", "slideshow-chart-column"]
            )
            addColumn(newsection, section.text, [
                "slideshow-column",
                "slideshow-text-column",
            ])
        } else if (graph !== undefined) {
            addColumn(
                newsection,
                [graph],
                [
                    "slideshow-column",
                    "slideshow-chart-column",
                    "slideshow-single-column",
                ]
            )
        } else if (section.text.length > 0) {
            addColumn(newsection, section.text, [
                "slideshow-column",
                "slideshow-text-column",
                "slideshow-single-column",
            ])
        }
        parent.appendChild(newsection)
    }

    // If we have no graph for a section, just render that directly
    // If we do have (multiple) graphs, render one slide with the same title
    // and text multiple times for each graph
    for (const section of slides) {
        if (section.graphs.length === 0)
            addSlide(section, sectionsParent, undefined)
        else
            for (const graph of section.graphs) {
                addSlide(section, sectionsParent, graph)
            }
    }
}

async function initReveal() {
    const cssReveal = loadCss(
        "https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.2.1/reveal.min.css"
    )
    const cssTheme = loadCss(
        "https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.2.1/theme/white.min.css"
    )
    await Promise.allSettled([cssReveal, cssTheme])
    await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.2.1/reveal.js"
    )
    for (const notRevealElem of document
        .querySelectorAll("body > :not(.reveal)")
        .values()) {
        if (notRevealElem.nodeName !== "SCRIPT")
            notRevealElem.classList.add("slideshow-hidden")
    }
    ;(window as any).Reveal.initialize({
        disableLayout: true,
    })
}

function removeReveal() {
    for (const notRevealElem of document
        .querySelectorAll("body > :not(.reveal)")
        .values())
        if (notRevealElem.nodeName !== "SCRIPT")
            notRevealElem.classList.remove("slideshow-hidden")

    const revealElement = document.querySelector("body > .reveal")
    if (revealElement) revealElement.remove()
    document.body.classList.remove("reveal-viewport")
    document.body.removeAttribute("style")
    document.documentElement.classList.remove("reveal-full-page")
}

let isSlideshowActive = false
export function toggleSlideshow() {
    if (isSlideshowActive) removeReveal()
    else {
        createSlides()
        initReveal()
    }
    isSlideshowActive = !isSlideshowActive
}

export function registerSlideshowShortcut() {
    document.addEventListener("keydown", (e) => {
        if (e.code === "KeyS") toggleSlideshow()
    })
}
