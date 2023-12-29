export const BLOCK_WRAPPER_DATATYPE = "block-wrapper"

export interface BreadcrumbItem {
    label: string
    href?: string
}

export interface KeyValueProps {
    [key: string]: string | boolean | undefined
}

export interface KeyInsight {
    title: string
    isTitleHidden?: boolean
    content: string
    slug: string
}
