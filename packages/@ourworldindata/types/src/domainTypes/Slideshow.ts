import { z } from "zod"

export enum SlideTemplate {
    Image = "image",
    Chart = "chart",
    TwoCharts = "two-charts",
    Cover = "cover",
    Statement = "statement",
    Outline = "outline",
    Text = "text",
}

/** Canonical display labels for each slide template */
export const SLIDE_TEMPLATE_LABELS: Record<SlideTemplate, string> = {
    [SlideTemplate.Cover]: "Cover",
    [SlideTemplate.Outline]: "Outline",
    [SlideTemplate.Image]: "Image",
    [SlideTemplate.Chart]: "Chart",
    [SlideTemplate.TwoCharts]: "Two Charts",
    [SlideTemplate.Statement]: "Statement",
    [SlideTemplate.Text]: "Text",
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
    largeText?: boolean
    hideLogo?: boolean
}

export interface SlideChartOnly {
    template: SlideTemplate.Chart
    /** Relative URL path, e.g. "/grapher/life-expectancy?tab=table" or "/explorers/population" */
    url: string
    title?: string
    subtitle?: string
    hideLogo?: boolean
    text?: MarkdownText
    largeText?: boolean
}

export interface SlideSection {
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

export interface SlideStatement {
    template: SlideTemplate.Statement
    /** The statement text — rendered large and bold */
    text: MarkdownText
    attribution?: string
    hideLogo?: boolean
}

export interface SlideContents {
    template: SlideTemplate.Outline
    title?: string
    /** Markdown list — bolded items are styled as "active" */
    text: MarkdownText
    hideLogo?: boolean
}

export interface SlideText {
    template: SlideTemplate.Text
    title?: string
    text: MarkdownText
    largeText?: boolean
    hideLogo?: boolean
}

export interface SlideTwoCharts {
    template: SlideTemplate.TwoCharts
    url1: string
    url2: string
    title?: string
    subtitle?: string
    hideLogo?: boolean
}

export type Slide =
    | SlideImageOnly
    | SlideChartOnly
    | SlideTwoCharts
    | SlideTitleSlide
    | SlideStatement
    | SlideContents
    | SlideText

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
    /** If true, charts show timeline/controls. If false (default), charts are minimal. */
    interactiveCharts?: boolean
}

// --- Zod schemas ---

const SlideImageOnlySchema = z.object({
    template: z.literal(SlideTemplate.Image),
    filename: z.string().nullable(),
    slideTitle: z.string().optional(),
    text: z.string().optional(),
    largeText: z.boolean().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideChartOnlySchema = z.object({
    template: z.literal(SlideTemplate.Chart),
    url: z.string().min(1),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    text: z.string().optional(),
    largeText: z.boolean().optional(),
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

const SlideQuoteSchema = z.object({
    template: z.literal(SlideTemplate.Statement),
    text: z.string(),
    attribution: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideContentsSchema = z.object({
    template: z.literal(SlideTemplate.Outline),
    title: z.string().optional(),
    text: z.string(),
    hideLogo: z.boolean().optional(),
})

const SlideTextSchema = z.object({
    template: z.literal(SlideTemplate.Text),
    title: z.string().optional(),
    text: z.string(),
    largeText: z.boolean().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideTwoChartsSchema = z.object({
    template: z.literal(SlideTemplate.TwoCharts),
    url1: z.string().min(1),
    url2: z.string().min(1),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

export const SlideSchema = z.discriminatedUnion("template", [
    SlideImageOnlySchema,
    SlideChartOnlySchema,
    SlideTwoChartsSchema,
    SlideTitleSlideSchema,
    SlideQuoteSchema,
    SlideContentsSchema,
    SlideTextSchema,
])

export const SlideshowConfigSchema = z.object({
    slides: z.array(SlideSchema),
    authors: z.string().optional(),
    interactiveCharts: z.boolean().optional(),
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
