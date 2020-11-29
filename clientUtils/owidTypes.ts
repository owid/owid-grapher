// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export type Integer = number
export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export type Year = Integer
export type Color = string

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeRange = [Time, Time]

export type PrimitiveType = number | string | boolean
export type ValueRange = [number, number]

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export interface RelatedChart {
    title: string
    slug: string
    variantName?: string | null
}

export type LegacyVariableId = Integer // remove.

export interface FormattedPost {
    id: number
    postId?: number
    type: "post" | "page"
    slug: string
    path: string
    title: string
    subtitle?: string | null
    date: Date
    modifiedDate: Date
    lastUpdated?: string | null
    authors: string[]
    byline?: string | null
    info?: string | null
    html: string
    footnotes: string[]
    references: Record<string, unknown>[]
    excerpt: string
    imageUrl?: string
    tocHeadings: { text: string; slug: string; isSubheading: boolean }[]
    relatedCharts?: RelatedChart[]
}

export enum SubNavId {
    about = "about",
    coronavirus = "coronavirus",
    co2 = "co2",
    energy = "energy",
}

export interface GitCommit {
    author_email: string
    author_name: string
    body: string
    date: string
    hash: string
    message: string
}

export interface SerializedGridProgram {
    slug: string
    program: string
    lastCommit?: GitCommit
}
