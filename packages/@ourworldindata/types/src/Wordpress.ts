export interface FormattingOptions {
    toc?: boolean
    hideAuthors?: boolean
    bodyClassName?: string
    subnavId?: SubNavId
    subnavCurrentId?: string
    raw?: boolean

    hideDonateFooter?: boolean
    footnotes?: boolean
}
export enum SubNavId {
    about = "about",
    biodiversity = "biodiversity",
    coronavirus = "coronavirus",
    co2 = "co2",
    energy = "energy",
    forests = "forests",
    water = "water",
    explorers = "explorers",
}
