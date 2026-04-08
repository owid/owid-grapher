import { Slide, SlideTemplate, Url } from "@ourworldindata/utils"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"

/** Config applied to all slideshow chart embeds */
const baseGrapherConfig: Partial<GrapherProgrammaticInterface> = {
    hideLogo: true,
    hideTitle: true,
    hideSubtitle: true,
    hideShareButton: true,
    hideFullscreenButton: true,
    hideRelatedQuestion: true,
    isEmbeddedInAnOwidPage: true,
}

/** Additional config when charts should be non-interactive (presentation mode) */
const minimalGrapherConfig: Partial<GrapherProgrammaticInterface> = {
    hideTimeline: true,
    hideControlsRow: true,
    hideDownloadButton: true,
    hideExploreTheDataButton: true,
}

/** Additional config when charts should be interactive */
const interactiveGrapherConfig: Partial<GrapherProgrammaticInterface> = {
    hideExploreTheDataButton: false,
    hideDownloadButton: true,
}

/**
 * Returns the Grapher config for a slideshow chart embed.
 *
 * @param interactiveCharts - If true, timeline and controls are shown.
 *   If false, they're hidden for a cleaner presentation.
 */
export function getSlideshowGrapherConfig(options: {
    interactiveCharts: boolean
}): Partial<GrapherProgrammaticInterface> {
    return {
        ...baseGrapherConfig,
        ...(options.interactiveCharts
            ? interactiveGrapherConfig
            : minimalGrapherConfig),
    }
}

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
    if (
        slide.template === SlideTemplate.Chart ||
        slide.template === SlideTemplate.Image
    ) {
        if (slide.text) {
            return "slide--wide"
        }
        return "slide--narrow"
    }
    return "slide--wide"
}
