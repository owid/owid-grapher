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

export const SLIDE_TEMPLATE_LABELS: Record<SlideTemplate, string> = {
    [SlideTemplate.Cover]: "Cover",
    [SlideTemplate.Outline]: "Outline",
    [SlideTemplate.Image]: "Image",
    [SlideTemplate.Chart]: "Chart",
    [SlideTemplate.TwoCharts]: "Two Charts",
    [SlideTemplate.Statement]: "Statement",
    [SlideTemplate.Text]: "Text",
}

export interface SlideImageOnly {
    template: SlideTemplate.Image
    filename: string | null
    slideTitle?: string
    text?: string
    largeText?: boolean
    hideLogo?: boolean
    blueBackground?: boolean
}

export interface SlideChartOnly {
    template: SlideTemplate.Chart
    /** Relative URL path, e.g. "/grapher/life-expectancy?tab=table" or "/explorers/population" */
    url: string
    title?: string
    subtitle?: string
    hideLogo?: boolean
    text?: string
    largeText?: boolean
    blueBackground?: boolean
}

export interface SlideCoverSlide {
    template: SlideTemplate.Cover
    title: string
    subtitle?: string
    author?: string
    date?: string
    hideLogo?: boolean
}

export interface SlideStatement {
    template: SlideTemplate.Statement
    text: string
    attribution?: string
    hideLogo?: boolean
    blueBackground?: boolean
}

export interface SlideContents {
    template: SlideTemplate.Outline
    title?: string
    text: string
    hideLogo?: boolean
    blueBackground?: boolean
}

export interface SlideText {
    template: SlideTemplate.Text
    title?: string
    text: string
    largeText?: boolean
    hideLogo?: boolean
    blueBackground?: boolean
}

export interface SlideTwoCharts {
    template: SlideTemplate.TwoCharts
    url1: string
    url2: string
    title?: string
    subtitle?: string
    hideLogo?: boolean
    blueBackground?: boolean
}

export type Slide =
    | SlideImageOnly
    | SlideChartOnly
    | SlideTwoCharts
    | SlideCoverSlide
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
    authors?: string
    /** If true, charts show timeline/controls in presentation mode. If false (default), charts are minimal. */
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
    blueBackground: z.boolean().optional(),
})

const SlideChartOnlySchema = z.object({
    template: z.literal(SlideTemplate.Chart),
    url: z.string().min(1),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    text: z.string().optional(),
    largeText: z.boolean().optional(),
    hideLogo: z.boolean().optional(),
    blueBackground: z.boolean().optional(),
})

const SlideCoverSlideSchema = z.object({
    template: z.literal(SlideTemplate.Cover),
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    date: z.string().optional(),
    hideLogo: z.boolean().optional(),
})

const SlideStatementSchema = z.object({
    template: z.literal(SlideTemplate.Statement),
    text: z.string(),
    attribution: z.string().optional(),
    hideLogo: z.boolean().optional(),
    blueBackground: z.boolean().optional(),
})

const SlideContentsSchema = z.object({
    template: z.literal(SlideTemplate.Outline),
    title: z.string().optional(),
    text: z.string(),
    hideLogo: z.boolean().optional(),
    blueBackground: z.boolean().optional(),
})

const SlideTextSchema = z.object({
    template: z.literal(SlideTemplate.Text),
    title: z.string().optional(),
    text: z.string(),
    largeText: z.boolean().optional(),
    hideLogo: z.boolean().optional(),
    blueBackground: z.boolean().optional(),
})

const SlideTwoChartsSchema = z.object({
    template: z.literal(SlideTemplate.TwoCharts),
    url1: z.string().min(1),
    url2: z.string().min(1),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    hideLogo: z.boolean().optional(),
    blueBackground: z.boolean().optional(),
})

export const SlideSchema = z.discriminatedUnion("template", [
    SlideImageOnlySchema,
    SlideChartOnlySchema,
    SlideTwoChartsSchema,
    SlideCoverSlideSchema,
    SlideStatementSchema,
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
    isPublished: z.boolean().optional(),
})
