import { DbPlainUser } from "./Users.js"

export const ImagesTableName = "images"
export interface DbInsertImage {
    googleId?: string | null
    defaultAlt?: string | null
    extractedText?: string | null
    filename: string
    id?: number
    originalWidth: number
    originalHeight: number
    updatedAt?: number | null // MySQL Date objects round to the nearest second, whereas Google includes milliseconds so we store as an epoch of type bigint to avoid any conversion issues
    cloudflareId: string
    hash: string
    userId?: number | null
    replacedBy?: number | null
    /**
     * Necessary to create a unique constraint with filename, so that we can have multiple versions of the same image,
     * but not multiple images with the same filename and version.
     * i.e.
     * You can upload test.png and *replace* it with test.png, but you can't upload a *new* image named test.png,
     * because that would have a version of 0 and conflict with the first test.png that was uploaded
     * This was done because MySQL 8 doesn't support partial unique indexes (e.g. "UNIQUE(filename) WHERE replacedBy IS NULL")
     * Nor a unique constraint when the column is nullable (e.g. "UNIQUE(filename, replacedBy)" would allow multiple rows with ["test.png", null])
     */
    version?: number
}
export type DbRawImage = Required<DbInsertImage>

export type DbEnrichedImage = DbRawImage

export type DbEnrichedImageWithUserId = DbEnrichedImage & {
    userId: DbPlainUser["id"]
}

export type DbEnrichedImageWithPageviews = DbEnrichedImageWithUserId & {
    views_365d: number
    isFeaturedImage: number
    isBodyContent: number
    isInResearchAndWriting: number
}
