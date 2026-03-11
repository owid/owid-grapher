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
