export interface TocHeading {
    text: string
    slug: string
    isSubheading: boolean
}

export interface TocHeadingWithTitleSupertitle extends TocHeading {
    title: string
    supertitle?: string
}
