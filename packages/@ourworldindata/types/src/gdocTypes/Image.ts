import { DbEnrichedImage } from "../dbTypes/Images.js"

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
