export interface TocHeading {
    title: string
    slug: string
    isSubheading: boolean
}

export interface TocHeadingWithSupertitle extends TocHeading {
    supertitle?: string
}

// A top-level (h1) heading together with the h2 subheadings nested beneath it,
// as displayed in the sidebar TOC.
export interface TocSidebarSection {
    heading: TocHeadingWithSupertitle
    subheadings: TocHeadingWithSupertitle[]
}
