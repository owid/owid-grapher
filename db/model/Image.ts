import { Entity, Column, BaseEntity, PrimaryGeneratedColumn } from "typeorm"
import { drive_v3, google } from "googleapis"
import {
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3"
import { keyBy } from "@ourworldindata/utils"
import { Gdoc } from "./Gdoc/Gdoc.js"
import {
    IMAGE_HOSTING_SPACE_URL,
    IMAGE_HOSTING_SPACE_ACCESS_KEY_ID,
    IMAGE_HOSTING_SPACE_SECRET_ACCESS_KEY,
    IMAGE_HOSTING_BUCKET_PATH,
    GDOCS_CLIENT_EMAIL,
} from "../../settings/serverSettings.js"

export interface ImageMetadata {
    googleId: string
    filename: string
    defaultAlt: string
    // MySQL Date objects round to the nearest second, whereas Google includes milliseconds
    // so we store as an epoch to avoid any conversion issues
    updatedAt: number
    description?: string
}

interface GDriveImageMetadata {
    name: string
    modifiedTime: string
    id: string // Google Drive ID
    description?: string // to be used as alt text
}

// Trying this to share the Google Drive image directory throughout the codebase
class ImageStore {
    images: Record<string, ImageMetadata> | undefined

    async fetchImageMetadata(): Promise<void> {
        console.log("Fetching all image metadata from Google Drive")
        const driveClient = google.drive({
            version: "v3",
            auth: Gdoc.getGoogleAuth(),
        })
        try {
            // TODO: fetch all pages (current limit = 1000)
            const res = await driveClient.files.list({
                // modifiedTime format: "2023-01-11T19:45:27.000Z"
                fields: "nextPageToken, files(id, name, description, modifiedTime)",
                q: `'${GDOCS_CLIENT_EMAIL}' in writers and mimeType contains 'image/'`,
            })

            const files = res.data.files ?? []

            function validateImage(
                image: drive_v3.Schema$File
            ): image is GDriveImageMetadata {
                // image.description can be undefined or "", which we should handle
                return Boolean(image.id && image.name && image.modifiedTime)
            }

            const images: ImageMetadata[] = files
                .filter(validateImage)
                .map((google: GDriveImageMetadata) => ({
                    googleId: google.id,
                    filename: google.name,
                    defaultAlt: google.description ?? "",
                    updatedAt: new Date(google.modifiedTime).getTime(),
                }))

            this.images = keyBy(images, "filename")
        } catch (e) {
            console.log("Error fetching image list from Google Drive", e)
        }
    }

    async syncImagesToS3(filenames: string[]): Promise<(Image | undefined)[]> {
        await this.fetchImageMetadata()
        return Promise.all(
            filenames.map((filename) => {
                const imageMetadata = this.images?.[filename]
                if (imageMetadata) {
                    return Image.syncImage(imageMetadata!)
                } else {
                    // TODO: if we're baking for prod, log error to slack
                    console.error(
                        `Error: ${filename} could not be found in Google Drive`
                    )
                    return
                }
            })
        )
    }
}

export const imageStore = new ImageStore()

const s3Client = new S3Client({
    endpoint: IMAGE_HOSTING_SPACE_URL,
    forcePathStyle: false,
    region: "nyc3",
    credentials: {
        accessKeyId: IMAGE_HOSTING_SPACE_ACCESS_KEY_ID,
        secretAccessKey: IMAGE_HOSTING_SPACE_SECRET_ACCESS_KEY,
    },
})

@Entity("images")
export class Image extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() googleId: string
    @Column() filename: string
    @Column() defaultAlt: string
    @Column() updatedAt: number

    constructor(filename = "", description = "", updatedAt = 0, googleId = "") {
        super()
        this.googleId = googleId
        this.filename = filename
        // we're storing the alt text in the GDrive description field
        this.defaultAlt = description
        this.updatedAt = updatedAt
    }

    static async syncImage(fresh: ImageMetadata): Promise<Image | undefined> {
        const results = await Image.findBy({ googleId: fresh.googleId })
        const stored = results[0]

        try {
            if (stored) {
                if (stored.updatedAt != fresh.updatedAt) {
                    await Image.fetchFromDriveAndUploadToS3(fresh)
                    stored.updatedAt = fresh.updatedAt
                    stored.defaultAlt = fresh.defaultAlt
                    await stored.save()
                }
                return stored
            } else {
                await Image.fetchFromDriveAndUploadToS3(fresh)
                return new Image(
                    fresh.filename,
                    fresh.defaultAlt,
                    fresh.updatedAt,
                    fresh.googleId
                ).save()
            }
        } catch (e) {
            console.error(`Error syncing ${fresh.filename}`, e)
        }
        return
    }

    static async fetchFromDriveAndUploadToS3(
        image: Image | ImageMetadata
    ): Promise<void> {
        const driveClient = google.drive({
            version: "v3",
            auth: Gdoc.getGoogleAuth(), // TODO: extract auth from Gdoc
        })

        const file = await driveClient.files.get(
            {
                fileId: image.googleId,
                alt: "media",
            },
            {
                responseType: "arraybuffer",
            }
        )

        const imageArrayBuffer = file.data as Buffer

        const indexOfFirstSlash = IMAGE_HOSTING_BUCKET_PATH.indexOf("/")
        const bucket = IMAGE_HOSTING_BUCKET_PATH.slice(0, indexOfFirstSlash)
        const directory = IMAGE_HOSTING_BUCKET_PATH.slice(indexOfFirstSlash + 1)

        const params: PutObjectCommandInput = {
            Bucket: bucket,
            Key: `${directory}/${image.filename}`,
            Body: imageArrayBuffer,
            ACL: "public-read",
        }
        await s3Client.send(new PutObjectCommand(params))
        console.log(
            `Successfully uploaded object: ${params.Bucket}/${params.Key}`
        )
    }
}
