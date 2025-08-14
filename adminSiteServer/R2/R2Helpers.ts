import {
    DeleteObjectCommand,
    DeleteObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3"
import { JsonError } from "@ourworldindata/utils"
import { Base64String } from "@ourworldindata/types"
import { R2_REGION } from "../../settings/serverSettings.js"

export interface R2Config {
    endpoint: string
    region: string
    accessKeyId: string
    secretAccessKey: string
    bucket?: string
    bucketPath?: string
}

export interface R2ClientConfig {
    endpoint: string
    region?: string
    accessKeyId: string
    secretAccessKey: string
}

const createS3Client = ({
    endpoint,
    region = R2_REGION,
    accessKeyId,
    secretAccessKey,
}: R2ClientConfig): S3Client => {
    return new S3Client({
        endpoint,
        forcePathStyle: false,
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
    })
}

export const createS3ClientForConfig = (config: R2ClientConfig): S3Client => {
    return createS3Client(config)
}

export async function saveObjectToR2(
    content: string | Buffer,
    bucket: string,
    key: string,
    contentType: string = "application/json",
    contentMD5?: Base64String,
    s3Client?: S3Client
) {
    if (process.env.NODE_ENV === "test") {
        console.log("Skipping saving object to R2 in test environment")
        return
    }

    if (!bucket) {
        console.info("R2 bucket not configured, not storing object to R2")
        return
    }

    if (!s3Client) {
        throw new Error("S3 client not provided")
    }

    try {
        const params: PutObjectCommandInput = {
            Bucket: bucket,
            Key: key,
            Body: content,
            ContentType: contentType,
            ...(contentMD5 && { ContentMD5: contentMD5 }),
        }

        console.log(
            `Saving object to R2: ${params.Bucket}/${params.Key} with content type ${params.ContentType}`
        )
        const result = await s3Client.send(new PutObjectCommand(params))
        console.log(
            `Successfully uploaded object: ${params.Bucket}/${params.Key}`
        )
        return result
    } catch (err) {
        console.log("err", err)
        throw new JsonError(
            `Failed to save object to R2. Inner error: ${err}`,
            500
        )
    }
}

export async function deleteObjectFromR2(
    bucket: string,
    key: string,
    s3Client?: S3Client
): Promise<void> {
    if (process.env.NODE_ENV === "test") {
        console.log("Skipping deleting object from R2 in test environment")
        return
    }

    if (!bucket) {
        console.info("R2 bucket not configured, not deleting object from R2")
        return
    }

    if (!s3Client) {
        throw new Error("S3 client not provided")
    }

    try {
        const params: DeleteObjectCommandInput = {
            Bucket: bucket,
            Key: key,
        }

        await s3Client.send(new DeleteObjectCommand(params))
        console.log(
            `Successfully deleted object: ${params.Bucket}/${params.Key}`
        )
    } catch (err) {
        throw new JsonError(
            `Failed to delete object from R2 at ${key}. Inner error: ${err}`,
            500
        )
    }
}

export function createR2Key(
    basePath: string | undefined,
    directory: string,
    filename: string
): string {
    const parts = [basePath, directory, filename].filter(Boolean)
    return parts.join("/")
}
