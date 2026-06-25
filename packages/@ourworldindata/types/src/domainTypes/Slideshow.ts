import { z } from "zod/mini"

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
    filename: z.nullable(z.string()),
    title: z.optional(z.string()),
    text: z.optional(z.string()),
    largeText: z.optional(z.boolean()),
    hideLogo: z.optional(z.boolean()),
    blueBackground: z.optional(z.boolean()),
})

const SlideChartOnlySchema = z.object({
    template: z.literal(SlideTemplate.Chart),
    /** Relative URL path, e.g. "/grapher/life-expectancy?tab=table" or "/explorers/population" */
    url: z.string().check(z.minLength(1)),
    title: z.optional(z.string()),
    subtitle: z.optional(z.string()),
    text: z.optional(z.string()),
    largeText: z.optional(z.boolean()),
    hideLogo: z.optional(z.boolean()),
    blueBackground: z.optional(z.boolean()),
})

const SlideCoverSchema = z.object({
    template: z.literal(SlideTemplate.Cover),
    title: z.string(),
    subtitle: z.optional(z.string()),
    author: z.optional(z.string()),
    date: z.optional(z.string()),
    hideLogo: z.optional(z.boolean()),
})

const SlideStatementSchema = z.object({
    template: z.literal(SlideTemplate.Statement),
    text: z.string(),
    attribution: z.optional(z.string()),
    hideLogo: z.optional(z.boolean()),
    blueBackground: z.optional(z.boolean()),
})

const SlideContentsSchema = z.object({
    template: z.literal(SlideTemplate.Outline),
    title: z.optional(z.string()),
    text: z.string(),
    hideLogo: z.optional(z.boolean()),
    blueBackground: z.optional(z.boolean()),
})

const SlideTextSchema = z.object({
    template: z.literal(SlideTemplate.Text),
    title: z.optional(z.string()),
    text: z.string(),
    largeText: z.optional(z.boolean()),
    hideLogo: z.optional(z.boolean()),
    blueBackground: z.optional(z.boolean()),
})

const SlideTwoChartsSchema = z.object({
    template: z.literal(SlideTemplate.TwoCharts),
    url1: z.string().check(z.minLength(1)),
    url2: z.string().check(z.minLength(1)),
    title: z.optional(z.string()),
    subtitle: z.optional(z.string()),
    hideLogo: z.optional(z.boolean()),
    blueBackground: z.optional(z.boolean()),
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

/**
 * The valid field names for each slide template, derived from the per-template
 * zod schemas above. Kept adjacent to the schemas so it stays in sync when a
 * field is added or removed. Used by slide-conversion logic to know which
 * fields can be carried over when changing a slide's template.
 */
export const SLIDE_TEMPLATE_FIELDS: Record<SlideTemplate, string[]> = {
    [SlideTemplate.Image]: Object.keys(SlideImageOnlySchema.shape),
    [SlideTemplate.Chart]: Object.keys(SlideChartOnlySchema.shape),
    [SlideTemplate.TwoCharts]: Object.keys(SlideTwoChartsSchema.shape),
    [SlideTemplate.Cover]: Object.keys(SlideCoverSchema.shape),
    [SlideTemplate.Statement]: Object.keys(SlideStatementSchema.shape),
    [SlideTemplate.Outline]: Object.keys(SlideContentsSchema.shape),
    [SlideTemplate.Text]: Object.keys(SlideTextSchema.shape),
}

export const SlideshowConfigSchema = z.object({
    slides: z.array(SlideSchema),
    authors: z.optional(z.string()),
    /** If true, charts show timeline/controls in presentation mode. If false (default), charts are minimal. */
    interactiveCharts: z.optional(z.boolean()),
})

export const SlideshowCreateSchema = z.object({
    slug: z.string().check(z.minLength(1)),
    title: z.string().check(z.minLength(1)),
    config: z.optional(SlideshowConfigSchema),
    isPublished: z.optional(z.boolean()),
})

export const SlideshowUpdateSchema = z.object({
    slug: z.optional(z.string().check(z.minLength(1))),
    title: z.optional(z.string().check(z.minLength(1))),
    config: z.optional(SlideshowConfigSchema),
    isPublished: z.optional(z.boolean()),
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
