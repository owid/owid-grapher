import { drive_v3, google } from "googleapis"
import {
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3"
import {
    getFilenameWithoutExtension,
    getSizes,
    keyBy,
    GDriveImageMetadata,
    ImageMetadata,
    findDuplicates,
    getFilenameMIMEType,
    DbRawImage,
    DbEnrichedImage,
    parseImageRow,
    DbInsertImage,
    serializeImageRow,
    ImagesTableName,
} from "@ourworldindata/utils"
import { OwidGoogleAuth } from "../OwidGoogleAuth.js"
import {
    R2_ENDPOINT,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_REGION,
    IMAGE_HOSTING_R2_BUCKET_PATH,
    GDOCS_CLIENT_EMAIL,
    GDOCS_SHARED_DRIVE_ID,
} from "../../settings/serverSettings.js"
import { KnexReadWriteTransaction, KnexReadonlyTransaction } from "../db.js"

export const s3Client = new S3Client({
    endpoint: R2_ENDPOINT,
    forcePathStyle: false,
    region: R2_REGION,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

export class Image implements ImageMetadata {
    id!: number
    cloudflareId!: string
    filename!: string
    defaultAlt!: string
    updatedAt!: number | null
    originalWidth!: number | null
    originalHeight!: number | null

    get isSvg(): boolean {
        return this.fileExtension === "svg"
    }

    get sizes(): number[] | undefined {
        if (this.isSvg) return
        return getSizes(this.originalWidth)
    }

    get filenameWithoutExtension(): string {
        return getFilenameWithoutExtension(this.filename)
    }

    get fileExtension(): string {
        return this.filename.slice(this.filename.indexOf(".") + 1)
    }

    constructor(metadata: ImageMetadata) {
        Object.assign(this, metadata)
    }
}

export async function getImageByFilename(
    knex: KnexReadonlyTransaction,
    filename: string
): Promise<Image | undefined> {
    const image = await knex
        .table(ImagesTableName)
        .where({ filename })
        .first<DbRawImage | undefined>()
    if (!image) return undefined
    const enrichedImage = parseImageRow(image)
    return new Image(enrichedImage)
}

export async function getAllImages(
    knex: KnexReadonlyTransaction
): Promise<Image[]> {
    const images = await knex.table("images").select<DbRawImage[]>()
    return images.map(parseImageRow).map((row) => new Image(row))
}

export async function updateImage(
    knex: KnexReadWriteTransaction,
    id: number,
    updates: Partial<DbEnrichedImage>
): Promise<void> {
    await knex.table("images").where({ id }).update(updates)
}

export async function insertImageClass(
    knex: KnexReadWriteTransaction,
    image: Image
): Promise<number> {
    return insertImageObject(knex, serializeImageRow({ ...image }))
}

export async function insertImageObject(
    knex: KnexReadWriteTransaction,
    image: DbInsertImage
): Promise<number> {
    const [id] = await knex.table("images").insert(image)
    return id
}
