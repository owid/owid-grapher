import * as z from "zod/mini"

export const BreadcrumbItemSchema = z.object({
    label: z.string(),
    href: z.optional(z.string()),
})

export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>

export interface KeyValueProps {
    [key: string]: string | boolean | undefined
}
