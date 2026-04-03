import { z } from "zod"

export enum SlideTemplate {
    Image = "image",
    Chart = "chart",
    Section = "section",
    Cover = "cover",
    Blank = "blank",
    Quote = "quote",
    BigNumber = "big-number",
}

/** Canonical display labels for each slide template */
export const SLIDE_TEMPLATE_LABELS: Record<SlideTemplate, string> = {
    [SlideTemplate.Image]: "Image",
    [SlideTemplate.Chart]: "Chart",
    [SlideTemplate.Section]: "Section",
    [SlideTemplate.Cover]: "Cover",
    [SlideTemplate.Blank]: "Blank",
    [SlideTemplate.Quote]: "Quote",
    [SlideTemplate.BigNumber]: "Big Number",
}

/**
 * A subset of markdown supporting newlines, **bold**, and *italics*.
 * Rendered with a minimal parser - no headings, links, images, etc.
 */
export type MarkdownText = string

export interface SlideImageOnly {
    template: SlideTemplate.Image
    filename: string | null
    slideTitle?: string
    text?: MarkdownText
    hideLogo?: boolean
}

export interface SlideChartOnly {
    template: SlideTemplate.Chart
    /** Relative URL path, e.g. "/grapher/life-expectancy?tab=table" or "/explorers/population" */
    url: string
    titleOverride?: string
    subtitleOverride?: string
    hideLogo?: boolean
    text?: MarkdownText
}

export interface SlideSection {
    template: SlideTemplate.Section
    title: string
    subtitle?: string
    hideLogo?: boolean
}

export interface SlideTitleSlide {
    template: SlideTemplate.Cover
    title: string
    subtitle?: string
    author?: string
    date?: string
    hideLogo?: boolean
}

export interface SlideBlank {
    template: SlideTemplate.Blank
    hideLogo?: boolean
}

export interface SlideQuote {
    template: SlideTemplate.Quote
    quote: MarkdownText
    attribution?: string
    hideLogo?: boolean
}

export interface SlideBigNumber {
    template: SlideTemplate.BigNumber
    number: string
    label: string
    slideTitle?: string
    hideLogo?: boolean
}

export type Slide =
    | SlideImageOnly
    | SlideChartOnly
    | SlideSection
    | SlideTitleSlide
    | SlideBlank
    | SlideQuote
    | SlideBigNumber

/**
 * Pre-resolved chart info computed at bake time so the client
 * doesn't need to probe multiple endpoints to determine the chart type.
 * Keyed by the slide URL (e.g. "/grapher/life-expectancy?tab=table").
 */
export type ResolvedSlideChartInfo =
    | { type: "grapher" }
    | { type: "multi-dim"; configId: string }
    | { type: "explorer" }

export interface SlideshowConfig {
    slides: Slide[]
    /** Display name(s) of the author(s). Defaults to the creating user's name. */
    authors?: string
}

// --- Zod schemas ---

const SlideImageOnlySchema = z.object({
    template: z.literal(SlideTemplate.Image),
    filename: z.string().nullable(),
    slideTitle: z.string().optional(),
    text: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideChartOnlySchema = z.object({
    template: z.literal(SlideTemplate.Chart),
    url: z.string().min(1),
    titleOverride: z.string().optional(),
    subtitleOverride: z.string().optional(),
    text: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideSectionSchema = z.object({
    template: z.literal(SlideTemplate.Section),
    title: z.string(),
    subtitle: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideTitleSlideSchema = z.object({
    template: z.literal(SlideTemplate.Cover),
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    date: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideBlankSchema = z.object({
    template: z.literal(SlideTemplate.Blank),
    hideLogo: z.boolean().optional(),
})

const SlideQuoteSchema = z.object({
    template: z.literal(SlideTemplate.Quote),
    quote: z.string(),
    attribution: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideBigNumberSchema = z.object({
    template: z.literal(SlideTemplate.BigNumber),
    number: z.string(),
    label: z.string(),
    slideTitle: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

export const SlideSchema = z.discriminatedUnion("template", [
    SlideImageOnlySchema,
    SlideChartOnlySchema,
    SlideSectionSchema,
    SlideTitleSlideSchema,
    SlideBlankSchema,
    SlideQuoteSchema,
    SlideBigNumberSchema,
])

export const SlideshowConfigSchema = z.object({
    slides: z.array(SlideSchema),
    authors: z.string().optional(),
})

export const SlideshowCreateSchema = z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    config: SlideshowConfigSchema.optional(),
})

export const SlideshowUpdateSchema = z.object({
    slug: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    config: SlideshowConfigSchema.optional(),
    isPublished: z.number().int().min(0).max(1).optional(),
})
