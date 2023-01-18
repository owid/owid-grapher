import { Entity, Column, BaseEntity, PrimaryGeneratedColumn } from "typeorm"
import {
    IMAGE_HOSTING_SPACE_URL,
    IMAGE_HOSTING_SPACE_ACCESS_KEY_ID,
    IMAGE_HOSTING_SPACE_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { google } from "googleapis"

import {
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3"
import { Gdoc } from "./Gdoc/Gdoc.js"

export interface ImageMeta {
    googleId: string
    filename: string
    defaultAlt: string
    // Storing as epoch to circumvent timezone issues with Google
    // MySQL Dates strip milliseconds which was making it hard to compare with the date from Google
    updatedAt: number
}

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
    @PrimaryGeneratedColumn() id!: string
    @Column() googleId: string
    @Column() filename: string
    @Column() defaultAlt: string
    @Column() updatedAt: number

    constructor(
        filename: string = "",
        description: string = "",
        updatedAt: number = 0,
        googleId: string = ""
    ) {
        super()
        this.googleId = googleId
        this.filename = filename
        // we're storing the alt text in the GDrive description field
        this.defaultAlt = description
        this.updatedAt = updatedAt
    }

    static async syncImage(fresh: ImageMeta): Promise<void> {
        const results = await Image.findBy({ googleId: fresh.googleId })
        const stored = results[0]

        if (stored) {
            if (stored.updatedAt != fresh.updatedAt) {
                // TODO: handle errors - we shouldn't update the DB if this fails
                await Image.fetchFromDriveAndUploadToS3(fresh)
                stored.updatedAt = fresh.updatedAt
                await stored.save()
            }
        } else {
            await Image.fetchFromDriveAndUploadToS3(fresh)
            await new Image(
                fresh.filename,
                fresh.defaultAlt,
                fresh.updatedAt,
                fresh.googleId
            ).save()
        }
    }

    static async fetchFromDriveAndUploadToS3(
        image: Image | ImageMeta
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

        const params: PutObjectCommandInput = {
            Bucket: `owid-image-upload`, // TODO: directories per environment? How to tell which staging environment we're on?
            Key: image.filename,
            Body: imageArrayBuffer,
            ACL: "public-read",
        }
        try {
            await s3Client.send(new PutObjectCommand(params))
            console.log(
                `Successfully uploaded object: ${params.Bucket}/${params.Key}`
            )
        } catch (err) {
            console.log(`Error uploading ${params.Key} to S3`, err)
        }
    }
}
