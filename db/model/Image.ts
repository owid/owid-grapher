import {
    Entity,
    Column,
    BaseEntity,
    PrimaryGeneratedColumn,
    ValueTransformer,
} from "typeorm"
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
} from "@ourworldindata/utils"
import { OwidGoogleAuth } from "../OwidGoogleAuth.js"
import {
    IMAGE_HOSTING_SPACE_URL,
    IMAGE_HOSTING_SPACE_ACCESS_KEY_ID,
    IMAGE_HOSTING_SPACE_SECRET_ACCESS_KEY,
    IMAGE_HOSTING_BUCKET_PATH,
    GDOCS_CLIENT_EMAIL,
    GDOCS_SHARED_DRIVE_ID,
} from "../../settings/serverSettings.js"

class ImageStore {
    images: Record<string, ImageMetadata> | undefined

    async fetchImageMetadata(filesnames: string[]): Promise<void> {
        console.log(
            `Fetching image metadata from Google Drive for ${filesnames.join(
                ", "
            )}`
        )
        const driveClient = google.drive({
            version: "v3",
            auth: OwidGoogleAuth.getGoogleReadonlyAuth(),
        })
        // e.g. `and (name="example.png" or name="image.svg")`
        // https://developers.google.com/drive/api/guides/search-files#examples
        const filenamesFilter = filesnames.length
            ? `and (${filesnames
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

    async syncImagesToS3(): Promise<(Image | undefined)[]> {
        const images = this.images
        if (!images) return []
        return Promise.all(
            Object.keys(images).map((filename) =>
                Image.syncImage(images[filename])
            )
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

// https://github.com/typeorm/typeorm/issues/873#issuecomment-424643086
// otherwise epochs are retrieved as string instead of number
export class ColumnNumericTransformer implements ValueTransformer {
    to(data: number): number {
        return data
    }
    from(data: string): number {
        return parseFloat(data)
    }
}

@Entity("images")
export class Image extends BaseEntity implements ImageMetadata {
    @PrimaryGeneratedColumn() id!: number
    @Column() googleId!: string
    @Column() filename!: string
    @Column() defaultAlt!: string
    @Column({
        transformer: new ColumnNumericTransformer(),
    })
    updatedAt!: number
    @Column({
        transformer: new ColumnNumericTransformer(),
        nullable: true,
    })
    originalWidth?: number

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

    // Given a record from Drive, see if we're already aware of it
    // If we are, see if Drive's version is different from the one we have stored
    // If it is, upload it and update our record
    // If we're not aware of it, upload and record it
    static async syncImage(
        metadata: ImageMetadata
    ): Promise<Image | undefined> {
        const fresh = Image.create<Image>(metadata)
        const stored = await Image.findOneBy({ filename: metadata.filename })

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
                    await stored.save()
                }
                return stored
            } else {
                await fresh.fetchFromDriveAndUploadToS3()
                return fresh.save()
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

        const indexOfFirstSlash = IMAGE_HOSTING_BUCKET_PATH.indexOf("/")
        const bucket = IMAGE_HOSTING_BUCKET_PATH.slice(0, indexOfFirstSlash)
        const directory = IMAGE_HOSTING_BUCKET_PATH.slice(indexOfFirstSlash + 1)

        const fileExtension = this.fileExtension
        const MIMEType = {
            png: "image/png",
            svg: "image/svg+xml",
            jpg: "image/jpg",
            jpeg: "image/jpeg",
            webp: "image/webp",
        }[fileExtension]

        if (!MIMEType) {
            throw new Error(
                `Error uploading image: unsupported file extension ${fileExtension}`
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
