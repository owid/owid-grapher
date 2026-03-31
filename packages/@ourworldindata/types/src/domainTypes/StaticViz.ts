import { z } from "zod/mini"

export const StaticVizTableName = "static_viz"

export interface DbRawStaticViz {
    id: number
    name: string
    description: string | null
    grapherSlug: string | null
    sourceUrl: string | null
    imageId: number
    mobileImageId: number | null
    createdBy: number | null
    updatedBy: number | null
    createdAt: Date
    updatedAt: Date
}

type StaticVizImage = {
    id: number
    cloudflareId: string
    filename: string
    originalHeight: number
    originalWidth: number
}

// A type for rendering the static viz admin, with images resolved and user names instead of numeric IDs
export type DbEnrichedStaticViz = Omit<
    DbRawStaticViz,
    "createdBy" | "updatedBy" | "imageId" | "mobileImageId"
> & {
    desktop?: StaticVizImage
    mobile?: StaticVizImage
    name: string
    grapherSlug?: string
    chartId?: number
    sourceUrl?: string
    description?: string
    createdBy: string
    updatedBy: string
}

export const StaticVizInsertSchema = z.object({
    name: z.string().check(z.minLength(1)),
    description: z.nullable(z.optional(z.string())),
    grapherSlug: z.nullable(z.optional(z.string())),
    sourceUrl: z.nullable(z.optional(z.string())),
    imageId: z.number().check(z.minimum(1)),
    mobileImageId: z.optional(z.nullable(z.number().check(z.minimum(1)))),
    createdBy: z.optional(z.nullable(z.number().check(z.minimum(1)))),
    updatedBy: z.optional(z.nullable(z.number().check(z.minimum(1)))),
})

export const StaticVizUpdateSchema = z.object({
    name: z.optional(z.string().check(z.minLength(1))),
    description: z.nullable(z.optional(z.string())),
    grapherSlug: z.nullable(z.optional(z.string())),
    sourceUrl: z.nullable(z.optional(z.string())),
    imageId: z.optional(z.number().check(z.minimum(1))),
    mobileImageId: z.optional(z.nullable(z.number().check(z.minimum(1)))),
    updatedBy: z.optional(z.nullable(z.number().check(z.minimum(1)))),
})

export type StaticVizUpdate = z.infer<typeof StaticVizUpdateSchema>
