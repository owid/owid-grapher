import { z } from "zod/mini"
import { LicenseOption } from "../grapherTypes/GrapherTypes.js"
import { OwidOriginSchema } from "../OwidOrigin.js"

/** Metadata for a bespoke data viz */
export const BespokeMetadataSchema = z.object({
    title: z.optional(z.string()),
    titleVariant: z.optional(z.string()),

    descriptionShort: z.optional(z.string()),
    descriptionKey: z.optional(z.string()),

    attribution: z.optional(z.string()),
    attributionShort: z.optional(z.string()),
    origins: z.optional(z.array(OwidOriginSchema)),
    descriptionFromProducer: z.optional(z.string()),

    descriptionProcessing: z.optional(z.string()),
    processingLevel: z.optional(z.enum(["minor", "major"])),

    unit: z.optional(z.string()),
    shortUnit: z.optional(z.string()),
    timespan: z.optional(z.string()),
    updatePeriodDays: z.optional(z.number()),

    faqs: z.optional(
        z.array(z.object({ question: z.string(), answer: z.string() }))
    ),

    license: z.optional(z.enum(LicenseOption)),
})

export type BespokeMetadata = z.infer<typeof BespokeMetadataSchema>

/** A `BespokeMetadata` complete enough to render a methods and sources block */
export type BespokeMetadataWithProvenance = BespokeMetadata &
    Required<Pick<BespokeMetadata, "title" | "origins">>

export function hasProvenance(
    metadata: BespokeMetadata
): metadata is BespokeMetadataWithProvenance {
    return !!metadata.title && !!metadata.origins?.length
}
