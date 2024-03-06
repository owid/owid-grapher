export const ImagesTableName = "images"
export interface DbInsertImage {
    defaultAlt: string
    filename: string
    googleId: string
    id?: number
    originalWidth?: number | null
    originalHeight?: number | null
    updatedAt?: string | null // MySQL Date objects round to the nearest second, whereas Google includes milliseconds so we store as an epoch of type bigint to avoid any conversion issues
}
export type DbRawImage = Required<DbInsertImage>
export type DbEnrichedImage = Omit<DbRawImage, "updatedAt"> & {
    updatedAt: number | null
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
