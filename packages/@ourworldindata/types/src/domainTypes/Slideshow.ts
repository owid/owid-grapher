import { z } from "zod"

export enum SlideTemplate {
    ImageChartOnly = "image-chart-only",
    Section = "section",
    ImageChartWithText = "image-chart-with-text",
    TitleSlide = "title-slide",
    Blank = "blank",
    TwoColumnText = "two-column-text",
    Quote = "quote",
    BigNumber = "big-number",
    FullSlideImage = "full-slide-image",
}

/**
 * A subset of markdown supporting newlines, **bold**, and *italics*.
 * Rendered with a minimal parser - no headings, links, images, etc.
 */
export type MarkdownText = string

/** Either an uploaded image (by filename) or a grapher URL, but not both */
export type SlideMedia =
    | { type: "image"; filename: string }
    | { type: "grapher"; url: string }

export interface SlideImageChartOnly {
    template: SlideTemplate.ImageChartOnly
    media: SlideMedia | null
    sectionTitle?: string
    slideTitle?: string
}

export interface SlideSection {
    template: SlideTemplate.Section
    title: string
    subtitle?: string
}

export interface SlideImageChartWithText {
    template: SlideTemplate.ImageChartWithText
    media: SlideMedia | null
    text: MarkdownText
    sectionTitle?: string
    slideTitle?: string
}

export interface SlideTitleSlide {
    template: SlideTemplate.TitleSlide
    title: string
    subtitle?: string
    author?: string
    date?: string
}

export interface SlideBlank {
    template: SlideTemplate.Blank
}

export interface SlideTwoColumnText {
    template: SlideTemplate.TwoColumnText
    leftText: MarkdownText
    rightText: MarkdownText
    sectionTitle?: string
    slideTitle?: string
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

export interface SlideFullSlideImage {
    template: SlideTemplate.FullSlideImage
    media: SlideMedia | null
}

export type Slide =
    | SlideImageChartOnly
    | SlideSection
    | SlideImageChartWithText
    | SlideTitleSlide
    | SlideBlank
    | SlideTwoColumnText
    | SlideQuote
    | SlideBigNumber
    | SlideFullSlideImage

export interface SlideshowConfig {
    slides: Slide[]
}

// --- Zod schemas ---

const SlideMediaSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("image"), filename: z.string().min(1) }),
    z.object({ type: z.literal("grapher"), url: z.string().min(1) }),
])

const SlideImageChartOnlySchema = z.object({
    template: z.literal(SlideTemplate.ImageChartOnly),
    media: SlideMediaSchema.nullable(),
    sectionTitle: z.string().optional(),
    slideTitle: z.string().optional(),
})

const SlideSectionSchema = z.object({
    template: z.literal(SlideTemplate.Section),
    title: z.string(),
    subtitle: z.string().optional(),
})

const SlideImageChartWithTextSchema = z.object({
    template: z.literal(SlideTemplate.ImageChartWithText),
    media: SlideMediaSchema.nullable(),
    text: z.string(),
    sectionTitle: z.string().optional(),
    slideTitle: z.string().optional(),
})

const SlideTitleSlideSchema = z.object({
    template: z.literal(SlideTemplate.TitleSlide),
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    date: z.string().optional(),
})

const SlideBlankSchema = z.object({
    template: z.literal(SlideTemplate.Blank),
})

const SlideTwoColumnTextSchema = z.object({
    template: z.literal(SlideTemplate.TwoColumnText),
    leftText: z.string(),
    rightText: z.string(),
    sectionTitle: z.string().optional(),
    slideTitle: z.string().optional(),
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

const SlideFullSlideImageSchema = z.object({
    template: z.literal(SlideTemplate.FullSlideImage),
    media: SlideMediaSchema.nullable(),
})

export const SlideSchema = z.discriminatedUnion("template", [
    SlideImageChartOnlySchema,
    SlideSectionSchema,
    SlideImageChartWithTextSchema,
    SlideTitleSlideSchema,
    SlideBlankSchema,
    SlideTwoColumnTextSchema,
    SlideQuoteSchema,
    SlideBigNumberSchema,
    SlideFullSlideImageSchema,
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
