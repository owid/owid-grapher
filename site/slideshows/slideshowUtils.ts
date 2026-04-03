import { Slide, SlideTemplate, Url } from "@ourworldindata/utils"

/** Parse a slide chart URL into its components */
export function parseSlideChartUrl(url: string): {
    type: "grapher" | "explorer"
    slug: string
    queryString?: string
} {
    const parsed = Url.fromURL(url)
    const pathname = parsed.pathname ?? ""
    const type = pathname.startsWith("/explorers/") ? "explorer" : "grapher"
    const slug = parsed.slug ?? ""
    const queryString = parsed.queryStr || undefined
    return { type, slug, queryString }
}

export function getSlideAspectRatio(
    slide: Slide
): "slide--narrow" | "slide--wide" {
    if (slide.template === SlideTemplate.Chart) {
        if (slide.text) {
            return "slide--wide"
        }
        return "slide--narrow"
    }
    return "slide--wide"
}
