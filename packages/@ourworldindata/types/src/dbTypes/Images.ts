import { DbPlainUser } from "./Users.js"

export const ImagesTableName = "images"
export interface DbInsertImage {
    googleId: string | null
    defaultAlt: string
    filename: string
    id?: number
    originalWidth?: number | null
    originalHeight?: number | null
    updatedAt?: string | null // MySQL Date objects round to the nearest second, whereas Google includes milliseconds so we store as an epoch of type bigint to avoid any conversion issues
    cloudflareId?: string | null
    hash?: string | null
    userId?: number | null
    replacedBy?: number | null
    /**
     * Necessary to create a unique constraint with filename, so that we can have multiple versions of the same image,
     * but not multiple images with the same filename and version.
     * i.e. you can upload test.png and *replace* it with test.png, but you can't upload a *new* image named test.png,
     * because that would have a version of 0 and conflict with the first test.png that was uploaded
     */
    version?: number
}
export type DbRawImage = Required<DbInsertImage>

export type DbEnrichedImage = Omit<DbRawImage, "updatedAt"> & {
    updatedAt: number | null
}

export type DbEnrichedImageWithUserId = DbEnrichedImage & {
    userId: DbPlainUser["id"]
}

export function parseImageRow(row: DbRawImage): DbEnrichedImage {
    return { ...row, updatedAt: parseImageUpdatedAt(row.updatedAt) }
}

export function parseImageUpdatedAt(updatedAt: string | null): number | null {
    return updatedAt ? parseFloat(updatedAt) : null
}

export function serializeImageRow(row: DbEnrichedImage): DbRawImage {
    return {
        ...row,
        updatedAt: serializeImageUpdatedAt(row.updatedAt),
    }
}

export function serializeImageUpdatedAt(
    updatedAt: number | null
): string | null {
    return updatedAt ? updatedAt.toString() : null
}
