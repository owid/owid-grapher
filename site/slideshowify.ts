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
            node.nodeName === "P" ||
            node.nodeName === "FIGURE"
        ) {
            yield node.cloneNode(true)
        } else if (node.nodeName === "DIV" || node.nodeName === "SECTION")
            yield* recursivelyYieldRelevantContentNodes(node) as any
    }
}

interface SlideFragments {
    title: Node | undefined

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
        text: [],
        graphs: [],
    }
    for (const node of recursivelyYieldRelevantContentNodes(article)) {
        if (node.nodeName === "H3" || node.nodeName === "H2") {
            if (
                currentSlide !== undefined &&
                !slideFragmentIsEmpty(currentSlide)
            )
                slides.push(currentSlide)
            currentSlide = { title: node.cloneNode(true), text: [], graphs: [] }
        } else if (node.nodeName === "P") {
            const newtag = node.cloneNode(true)
            currentSlide.text.push(newtag)
        } else if (node.nodeName === "FIGURE") {
            const newtag = document.createElement("iframe")
            newtag.src = (node as HTMLElement).dataset.grapherSrc ?? ""
            ;(newtag as any).loading = "lazy"
            newtag.style.width = "100%"
            newtag.style.height = "600px"
            newtag.style.border = "0px none"
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
    for (const section of slides) {
        const newsection = document.createElement("section")
        if (section.title !== undefined) newsection.appendChild(section.title)
        const chartColumn = document.createElement("div")
        chartColumn.classList.add("slideshow-column", "slideshow-chart-column")
        for (const chart of section.graphs) chartColumn.appendChild(chart)
        newsection.appendChild(chartColumn)
        const textColumn = document.createElement("div")
        textColumn.classList.add("slideshow-column", "slideshow-text-column")
        for (const text of section.text) textColumn.appendChild(text)
        newsection.appendChild(textColumn)
        sectionsParent.appendChild(newsection)
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
    ;(window as any).Reveal.initialize()
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
