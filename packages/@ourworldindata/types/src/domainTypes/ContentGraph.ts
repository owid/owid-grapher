import { DbPlainTag } from "../dbTypes/Tags.js"

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

export const TagGraphTableName = "tag_graph"

export type DbInsertTagGraphNode = {
    parentId: number
    childId: number
    weight?: number
    updatedAt?: string
}

export type DbPlainTagGraphNode = Required<DbInsertTagGraphNode>

export const TagGraphRootName = "tag-graph-root" as const

export type FlatTagGraphNode = Pick<DbPlainTag, "name" | "slug"> & {
    weight: number
    isTopic: boolean
    parentId: number
    childId: number
    slug: string | null
}

export type FlatTagGraph = Record<number, FlatTagGraphNode[]>

export interface TagGraphNode {
    children: TagGraphNode[]
    id: number
    isTopic: boolean
    name: string
    path: number[]
    slug: string | null
    weight: number
}

export type TagGraphRoot = TagGraphNode & {
    children: TagGraphNode[]
    id: number
    isTopic: false
    name: typeof TagGraphRootName
    path: [number]
    slug: null
    weight: 0
}

export interface PostReference {
    id: string
    title: string
    slug: string
    url: string
}

export enum ContentGraphLinkType {
    Gdoc = "gdoc",
    Url = "url",
    Grapher = "grapher",
    Explorer = "explorer",
    ChartView = "chart-view",
}

export interface DbInsertContentGraphLink {
    componentType: string
    hash: string
    id?: number
    linkType?: ContentGraphLinkType | null
    queryString: string
    // string for gdocs, number for dods
    sourceId?: string | number | null
    target: string
    text: string
}

export type DbPlainContentGraphLink = Required<DbInsertContentGraphLink>
