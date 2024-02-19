export interface EntryMeta {
    slug: string
    title: string
}

export interface CategoryWithEntries {
    name: string
    slug: string
    entries: EntryMeta[]
    subcategories?: CategoryWithEntries[]
}

export interface PostReference {
    id: number | string
    title: string
    slug: string
}
