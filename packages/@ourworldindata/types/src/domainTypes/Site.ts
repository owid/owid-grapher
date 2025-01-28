export interface BreadcrumbItem {
    label: string
    href?: string
}

export interface KeyValueProps {
    [key: string]: string | boolean | undefined
}

export type AssetMapEntry = Record<string, string>
export interface AssetMap {
    viteAssets: AssetMapEntry
    runtimeResources: AssetMapEntry
}
