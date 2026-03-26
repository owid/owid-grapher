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
    sectionTitle?: string
    slideTitle?: string
    text?: MarkdownText
}

export interface SlideChartOnly {
    template: SlideTemplate.Chart
    slug: string
    queryString?: string
    sectionTitle?: string
    slideTitle?: string
    text?: MarkdownText
    hideSubtitle?: boolean
}

export interface SlideSection {
    template: SlideTemplate.Section
    title: string
    subtitle?: string
}

export interface SlideTitleSlide {
    template: SlideTemplate.Cover
    title: string
    subtitle?: string
    author?: string
    date?: string
}

export interface SlideBlank {
    template: SlideTemplate.Blank
}

export interface SlideQuote {
    template: SlideTemplate.Quote
    quote: MarkdownText
    attribution?: string
    sectionTitle?: string
}

export interface SlideBigNumber {
    template: SlideTemplate.BigNumber
    number: string
    label: string
    sectionTitle?: string
    slideTitle?: string
}

export type Slide =
    | SlideImageOnly
    | SlideChartOnly
    | SlideSection
    | SlideTitleSlide
    | SlideBlank
    | SlideQuote
    | SlideBigNumber

export interface SlideshowConfig {
    slides: Slide[]
}

// --- Zod schemas ---

const SlideImageOnlySchema = z.object({
    template: z.literal(SlideTemplate.Image),
    filename: z.string().nullable(),
    sectionTitle: z.string().optional(),
    slideTitle: z.string().optional(),
    text: z.string().optional(),
})

const SlideChartOnlySchema = z.object({
    template: z.literal(SlideTemplate.Chart),
    slug: z.string().min(1),
    queryString: z.string().optional(),
    sectionTitle: z.string().optional(),
    slideTitle: z.string().optional(),
    text: z.string().optional(),
    hideSubtitle: z.boolean().optional(),
})

const SlideSectionSchema = z.object({
    template: z.literal(SlideTemplate.Section),
    title: z.string(),
    subtitle: z.string().optional(),
})

const SlideTitleSlideSchema = z.object({
    template: z.literal(SlideTemplate.Cover),
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    date: z.string().optional(),
})

const SlideBlankSchema = z.object({
    template: z.literal(SlideTemplate.Blank),
})

const SlideQuoteSchema = z.object({
    template: z.literal(SlideTemplate.Quote),
    quote: z.string(),
    attribution: z.string().optional(),
    sectionTitle: z.string().optional(),
})

const SlideBigNumberSchema = z.object({
    template: z.literal(SlideTemplate.BigNumber),
    number: z.string(),
    label: z.string(),
    sectionTitle: z.string().optional(),
    slideTitle: z.string().optional(),
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
