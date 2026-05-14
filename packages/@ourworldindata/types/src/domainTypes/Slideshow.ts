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
    /** Relative URL path, e.g. "/grapher/life-expectancy?tab=table" or "/explorers/population" */
    url: z.string().min(1),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    text: z.string().optional(),
    largeText: z.boolean().optional(),
    hideLogo: z.boolean().optional(),
    blueBackground: z.boolean().optional(),
})

const SlideCoverSchema = z.object({
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
    SlideCoverSchema,
    SlideStatementSchema,
    SlideContentsSchema,
    SlideTextSchema,
])

export const SlideshowConfigSchema = z.object({
    slides: z.array(SlideSchema),
    authors: z.string().optional(),
    /** If true, charts show timeline/controls in presentation mode. If false (default), charts are minimal. */
    interactiveCharts: z.boolean().optional(),
})

export const SlideshowCreateSchema = z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    config: SlideshowConfigSchema.optional(),
    isPublished: z.boolean().optional(),
})

export const SlideshowUpdateSchema = z.object({
    slug: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    config: SlideshowConfigSchema.optional(),
    isPublished: z.boolean().optional(),
})

export type SlideImageOnly = z.infer<typeof SlideImageOnlySchema>
export type SlideChartOnly = z.infer<typeof SlideChartOnlySchema>
export type SlideCover = z.infer<typeof SlideCoverSchema>
export type SlideStatement = z.infer<typeof SlideStatementSchema>
export type SlideContents = z.infer<typeof SlideContentsSchema>
export type SlideText = z.infer<typeof SlideTextSchema>
export type SlideTwoCharts = z.infer<typeof SlideTwoChartsSchema>
export type Slide = z.infer<typeof SlideSchema>
export type SlideshowConfig = z.infer<typeof SlideshowConfigSchema>

/**
 * Pre-resolved chart info computed at bake time so the client
 * doesn't need to probe multiple endpoints to determine the chart type.
 * Keyed by the slide URL (e.g. "/grapher/life-expectancy?tab=table").
 */
export type ResolvedSlideChartInfo =
    | { type: "grapher" }
    | { type: "multi-dim"; configId: string }
    | { type: "explorer" }
