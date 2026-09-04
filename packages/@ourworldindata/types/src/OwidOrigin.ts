import { z } from "zod/mini"
import { OwidLicenseSchema, type OwidLicense } from "./OwidVariable.js"
import type { SchemaFor } from "./domainTypes/Various.js"

export interface OwidOrigin {
    id?: number
    title?: string
    titleSnapshot?: string
    attribution?: string
    attributionShort?: string
    versionProducer?: string
    license?: OwidLicense
    descriptionSnapshot?: string
    description?: string
    producer?: string
    citationFull?: string
    urlMain?: string
    urlDownload?: string
    dateAccessed?: string
    datePublished?: string
}

export const OwidOriginSchema = z.object({
    id: z.optional(z.number()),
    title: z.optional(z.string()),
    titleSnapshot: z.optional(z.string()),
    attribution: z.optional(z.string()),
    attributionShort: z.optional(z.string()),
    versionProducer: z.optional(z.string()),
    license: z.optional(OwidLicenseSchema),
    descriptionSnapshot: z.optional(z.string()),
    description: z.optional(z.string()),
    producer: z.optional(z.string()),
    citationFull: z.optional(z.string()),
    urlMain: z.optional(z.string()),
    urlDownload: z.optional(z.string()),
    dateAccessed: z.optional(z.string()),
    datePublished: z.optional(z.string()),
} satisfies SchemaFor<OwidOrigin>)
