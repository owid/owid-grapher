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
    IMAGE_HOSTING_R2_ENDPOINT,
    IMAGE_HOSTING_R2_ACCESS_KEY_ID,
    IMAGE_HOSTING_R2_SECRET_ACCESS_KEY,
    IMAGE_HOSTING_R2_REGION,
    IMAGE_HOSTING_R2_BUCKET_PATH,
    GDOCS_CLIENT_EMAIL,
    GDOCS_SHARED_DRIVE_ID,
} from "../../settings/serverSettings.js"
import { KnexReadonlyTransaction } from "../db.js"

class ImageStore {
    images: Record<string, ImageMetadata> | undefined

    async fetchImageMetadata(filenames: string[]): Promise<void> {
        console.log(
            `Fetching image metadata from Google Drive ${
                filenames.length ? `for ${filenames.join(", ")}` : ""
            }`
        )
        const driveClient = google.drive({
            version: "v3",
            auth: OwidGoogleAuth.getGoogleReadonlyAuth(),
        })
        // e.g. `and (name="example.png" or name="image.svg")`
        // https://developers.google.com/drive/api/guides/search-files#examples
        const filenamesFilter = filenames.length
            ? `and (${filenames
                  .map((filename) => `name='${filename}'`)
                  .join(" or ")})`
            : ""

        const listParams: drive_v3.Params$Resource$Files$List = {
            fields: "nextPageToken, files(id, name, description, modifiedTime, imageMediaMetadata, trashed)",
            q: `'${GDOCS_CLIENT_EMAIL}' in readers and mimeType contains 'image/' ${filenamesFilter}`,
            driveId: GDOCS_SHARED_DRIVE_ID,
            corpora: "drive",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageSize: 1000,
        }

        let files: drive_v3.Schema$File[] = []
        let nextPageToken: drive_v3.Schema$FileList["nextPageToken"] = undefined
        let isInitialQuery = true

        while (nextPageToken || isInitialQuery) {
            await driveClient.files
                .list({
                    ...listParams,
                    pageToken: nextPageToken,
                })
                // chaining this so that reassigning nextPageToken doesn't trip up TypeScript
                .then((res) => {
                    const nextFiles = res.data.files ?? []
                    nextPageToken = res.data.nextPageToken
                    files = [...files, ...nextFiles]
                })
            isInitialQuery = false
        }

        function validateImage(
            image: drive_v3.Schema$File
        ): image is GDriveImageMetadata {
            return Boolean(
                image.id && image.name && image.modifiedTime && !image.trashed
            )
        }

        const images: ImageMetadata[] = files
            .filter(validateImage)
            .map((google: GDriveImageMetadata) => ({
                googleId: google.id,
                filename: google.name,
                defaultAlt: google.description ?? "",
                updatedAt: new Date(google.modifiedTime).getTime(),
                originalWidth: google.imageMediaMetadata?.width,
                originalHeight: google.imageMediaMetadata?.height,
            }))

        const duplicateFilenames = findDuplicates(
            images.map((image) => image.filename)
        )

        if (duplicateFilenames.length) {
            throw new Error(
                `Multiple images are named ${duplicateFilenames.join(", ")}`
            )
        }

        this.images = keyBy(images, "filename")
    }

    async syncImagesToS3(
        knex: KnexReadonlyTransaction
    ): Promise<(Image | undefined)[]> {
        const images = this.images
        if (!images) return []
        return Promise.all(
            Object.keys(images).map((filename) =>
                Image.syncImage(knex, images[filename])
            )
        )
    }
}

export const imageStore = new ImageStore()

export const s3Client = new S3Client({
    endpoint: IMAGE_HOSTING_R2_ENDPOINT,
    forcePathStyle: false,
    region: IMAGE_HOSTING_R2_REGION,
    credentials: {
        accessKeyId: IMAGE_HOSTING_R2_ACCESS_KEY_ID,
        secretAccessKey: IMAGE_HOSTING_R2_SECRET_ACCESS_KEY,
    },
})
export class Image implements ImageMetadata {
    id!: number
    googleId!: string
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

    // Given a record from Drive, see if we're already aware of it
    // If we are, see if Drive's version is different from the one we have stored
    // If it is, upload it and update our record
    // If we're not aware of it, upload and record it
    static async syncImage(
        knex: KnexReadonlyTransaction,
        metadata: ImageMetadata
    ): Promise<Image | undefined> {
        const fresh = new Image(metadata)
        const stored = await getImageByFilename(knex, metadata.filename)

        try {
            if (stored) {
                if (
                    stored.updatedAt !== fresh.updatedAt ||
                    stored.defaultAlt !== fresh.defaultAlt ||
                    stored.originalWidth !== fresh.originalWidth
                ) {
                    await fresh.fetchFromDriveAndUploadToS3()
                    stored.updatedAt = fresh.updatedAt
                    stored.defaultAlt = fresh.defaultAlt
                    stored.originalWidth = fresh.originalWidth
                    await updateImage(knex, stored.id, {
                        updatedAt: fresh.updatedAt,
                        defaultAlt: fresh.defaultAlt,
                        originalWidth: fresh.originalWidth,
                        originalHeight: fresh.originalHeight,
                    })
                }
                return stored
            } else {
                await fresh.fetchFromDriveAndUploadToS3()
                const id = await insertImageClass(knex, fresh)
                fresh.id = id
                return fresh
            }
        } catch (e) {
            console.error(`Error syncing ${fresh.filename}`, e)
        }
        return
    }

    async fetchFromDriveAndUploadToS3(): Promise<void> {
        const driveClient = google.drive({
            version: "v3",
            auth: OwidGoogleAuth.getGoogleReadonlyAuth(),
        })

        const file = await driveClient.files.get(
            {
                fileId: this.googleId,
                alt: "media",
            },
            {
                responseType: "arraybuffer",
            }
        )

        const imageArrayBuffer = file.data as Buffer

        const indexOfFirstSlash = IMAGE_HOSTING_R2_BUCKET_PATH.indexOf("/")
        const bucket = IMAGE_HOSTING_R2_BUCKET_PATH.slice(0, indexOfFirstSlash)
        const directory = IMAGE_HOSTING_R2_BUCKET_PATH.slice(
            indexOfFirstSlash + 1
        )

        const MIMEType = getFilenameMIMEType(this.filename)

        if (!MIMEType) {
            throw new Error(
                `Error uploading image "${this.filename}": unsupported file extension`
            )
        }

        const params: PutObjectCommandInput = {
            Bucket: bucket,
            Key: `${directory}/${this.filename}`,
            Body: imageArrayBuffer,
            ACL: "public-read",
            ContentType: MIMEType,
        }
        await s3Client.send(new PutObjectCommand(params))
        console.log(
            `Successfully uploaded object: ${params.Bucket}/${params.Key}`
        )
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
    knex: KnexReadonlyTransaction,
    id: number,
    updates: Partial<DbEnrichedImage>
): Promise<void> {
    await knex.table("images").where({ id }).update(updates)
}

export async function insertImageClass(
    knex: KnexReadonlyTransaction,
    image: Image
): Promise<number> {
    return insertImageObject(knex, serializeImageRow({ ...image }))
}

export async function insertImageObject(
    knex: KnexReadonlyTransaction,
    image: DbInsertImage
): Promise<number> {
    const [id] = await knex.table("images").insert(image)
    return id
}
