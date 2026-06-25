import {
    Slide,
    SlideTemplate,
    SLIDE_TEMPLATE_FIELDS,
    SLIDE_TEMPLATE_LABELS,
    Url,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"

/** Create a default slide for a given template */
export function makeDefaultSlideForTemplate(template: SlideTemplate): Slide {
    return match(template)
        .with(SlideTemplate.Image, (t) => ({
            template: t,
            filename: null as string | null,
        }))
        .with(SlideTemplate.Chart, (t) => ({ template: t, url: "" }))
        .with(SlideTemplate.TwoCharts, (t) => ({
            template: t,
            url1: "",
            url2: "",
        }))
        .with(SlideTemplate.Cover, (t) => ({ template: t, title: "" }))
        .with(SlideTemplate.Statement, (t) => ({ template: t, text: "" }))
        .with(SlideTemplate.Outline, (t) => ({ template: t, text: "" }))
        .with(SlideTemplate.Text, (t) => ({ template: t, text: "" }))
        .exhaustive()
}

/**
 * Required, content-bearing fields for each template. These are the fields a
 * slide must have filled in to be valid/useful; conversion warns when any of
 * them end up empty on the target slide.
 */
const SLIDE_TEMPLATE_REQUIRED_FIELDS: Record<SlideTemplate, string[]> = {
    [SlideTemplate.Image]: ["filename"],
    [SlideTemplate.Chart]: ["url"],
    [SlideTemplate.TwoCharts]: ["url1", "url2"],
    [SlideTemplate.Cover]: ["title"],
    [SlideTemplate.Statement]: ["text"],
    [SlideTemplate.Outline]: ["text"],
    [SlideTemplate.Text]: ["text"],
}

/** Human-readable labels for slide fields, used in conversion warnings. */
const SLIDE_FIELD_LABELS: Record<string, string> = {
    url: "chart URL",
    url1: "first chart URL",
    url2: "second chart URL",
    filename: "image",
    title: "title",
    subtitle: "subtitle",
    text: "text",
    largeText: "large text",
    attribution: "attribution",
    author: "author",
    date: "date",
    hideLogo: "hide logo",
    blueBackground: "blue background",
}

function fieldLabel(field: string): string {
    return SLIDE_FIELD_LABELS[field] ?? field
}

/** A field counts as "empty" if it's null, undefined, or an empty string. */
function isEmptyFieldValue(value: unknown): boolean {
    return value === null || value === undefined || value === ""
}

/**
 * Convert a slide to a different template, carrying over every field that also
 * exists on the target template. Required fields missing on the source are
 * backfilled from `makeDefaultSlideForTemplate` so the result is always valid.
 * Chart URLs are renamed when converting between Chart and Two Charts.
 */
export function convertSlide(slide: Slide, target: SlideTemplate): Slide {
    const result: Record<string, unknown> = {
        ...makeDefaultSlideForTemplate(target),
    }
    const targetFields = new Set(SLIDE_TEMPLATE_FIELDS[target])
    const source = slide as Record<string, unknown>

    // Copy over every shared field (except the discriminant), skipping undefined
    for (const [key, value] of Object.entries(source)) {
        if (key === "template") continue
        if (value === undefined) continue
        if (targetFields.has(key)) {
            result[key] = value
        }
    }

    // Special-case chart URL renames between Chart and Two Charts
    if (
        slide.template === SlideTemplate.Chart &&
        target === SlideTemplate.TwoCharts &&
        !isEmptyFieldValue(source.url)
    ) {
        result.url1 = source.url
    }
    if (
        slide.template === SlideTemplate.TwoCharts &&
        target === SlideTemplate.Chart &&
        !isEmptyFieldValue(source.url1)
    ) {
        result.url = source.url1
    }

    result.template = target
    return result as Slide
}

/**
 * Describe what converting a slide to a target template will lose:
 * - droppedFields: fields with content on the source that won't survive.
 * - emptyRequiredFields: required fields on the target left empty afterwards.
 */
export function describeConversionLoss(
    slide: Slide,
    target: SlideTemplate
): { droppedFields: string[] } {
    const targetFields = new Set(SLIDE_TEMPLATE_FIELDS[target])
    const source = slide as Record<string, unknown>

    // Fields whose content is preserved via the chart URL rename special-case
    const renamedFields = new Set<string>()
    if (
        slide.template === SlideTemplate.Chart &&
        target === SlideTemplate.TwoCharts
    ) {
        renamedFields.add("url")
    }
    if (
        slide.template === SlideTemplate.TwoCharts &&
        target === SlideTemplate.Chart
    ) {
        renamedFields.add("url1")
    }

    const droppedFields: string[] = []
    for (const [key, value] of Object.entries(source)) {
        if (key === "template") continue
        if (isEmptyFieldValue(value)) continue
        if (targetFields.has(key)) continue
        if (renamedFields.has(key)) continue
        droppedFields.push(fieldLabel(key))
    }

    return { droppedFields }
}

/** Whether converting between two templates loses any content. */
export function isLossyConversion(
    slide: Slide,
    target: SlideTemplate
): boolean {
    const { droppedFields } = describeConversionLoss(slide, target)
    return droppedFields.length > 0
}

/** Build the warning message shown before a lossy conversion. */
export function buildConversionWarning(
    slide: Slide,
    target: SlideTemplate
): string {
    const { droppedFields } = describeConversionLoss(slide, target)
    const fromLabel = SLIDE_TEMPLATE_LABELS[slide.template]
    const toLabel = SLIDE_TEMPLATE_LABELS[target]
    const parts: string[] = []
    if (droppedFields.length > 0) {
        parts.push(
            `Converting ${fromLabel} → ${toLabel} will irrecoverably discard: ${droppedFields.join(
                ", "
            )}.`
        )
    }

    return parts.join(" ")
}

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
    // Note: we intentionally don't set hideTimeline here because it causes
    // GrapherState to ignore the `time` query param for charts with a time
    // dimension (line, stacked area, stacked bar). Instead, the timeline is
    // hidden via CSS in SlideContent.scss.
    hideControlsRow: true,
    hideDownloadButton: true,
    hideExploreTheDataButton: true,
    hideEntityControls: true,
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
): "slideshow-slide--narrow" | "slideshow-slide--wide" {
    return match(slide)
        .with(
            { template: SlideTemplate.Chart },
            { template: SlideTemplate.Image },
            (s) =>
                s.text
                    ? ("slideshow-slide--wide" as const)
                    : ("slideshow-slide--narrow" as const)
        )
        .otherwise(() => "slideshow-slide--wide" as const)
}
