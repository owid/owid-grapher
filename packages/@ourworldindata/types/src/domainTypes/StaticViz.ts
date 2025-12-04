import { z } from "zod"

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
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    grapherSlug: z.string().nullable().optional(),
    sourceUrl: z.string().nullable().optional(),
    imageId: z.number().min(1),
    mobileImageId: z.number().min(1).nullable().optional(),
    createdBy: z.number().min(1).nullable().optional(),
    updatedBy: z.number().min(1).nullable().optional(),
})

export const StaticVizUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    grapherSlug: z.string().nullable().optional(),
    sourceUrl: z.string().nullable().optional(),
    imageId: z.number().min(1).optional(),
    mobileImageId: z.number().min(1).nullable().optional(),
    updatedBy: z.number().min(1).nullable().optional(),
})

export type StaticVizUpdate = z.infer<typeof StaticVizUpdateSchema>
