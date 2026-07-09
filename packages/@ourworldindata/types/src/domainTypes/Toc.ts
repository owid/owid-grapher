export interface TocHeading {
    title: string
    slug: string
    isSubheading: boolean
}

export interface TocHeadingWithSupertitle extends TocHeading {
    supertitle?: string
}
