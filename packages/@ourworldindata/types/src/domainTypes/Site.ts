export interface BreadcrumbItem {
    label: string
    href?: string
}

export interface KeyValueProps {
    [key: string]: string | boolean | undefined
}

export type AssetMap = Record<string, string>
