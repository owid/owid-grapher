export interface TocHeading {
    text: string
    html?: string // used by SectionHeading toc. Excluded from LongFormPage toc.
    slug: string
    isSubheading: boolean
}

export interface TocHeadingWithTitleSupertitle extends TocHeading {
    title: string
    supertitle?: string
}
