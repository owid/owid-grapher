import { DbEnrichedImage } from "../dbTypes/Images.js"

// This is the JSON we get from Google's API before remapping the keys to be consistent with the rest of our interfaces
export interface GDriveImageMetadata {
    name: string // -> filename
    modifiedTime: string // -> updatedAt e.g. "2023-01-11T19:45:27.000Z"
    id: string // -> googleId e.g. "1dfArzg3JrAJupVl4YyJpb2FOnBn4irPX"
    description?: string // -> defaultAlt
    imageMediaMetadata?: {
        width?: number // -> originalWidth
        height?: number // -> originalHeight
    }
}

// All the data we use in the client to render images
// everything except the ID, effectively
export type ImageMetadata = Pick<
    DbEnrichedImage,
    | "defaultAlt"
    | "filename"
    | "cloudflareId"
    | "originalHeight"
    | "originalWidth"
    | "updatedAt"
>
