import {
    GRAPHER_CONFIG_R2_BUCKET,
    GRAPHER_CONFIG_R2_BUCKET_PATH,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../settings/serverSettings.js"
import {
    DeleteObjectCommand,
    DeleteObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3"
import {
    Base64String,
    excludeUndefined,
    JsonError,
    getMd5HashBase64,
} from "@ourworldindata/utils"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import { createHash } from "crypto"

export function getMd5HashBase64(data: string): Base64String {
    // I would have liked to create a function in utils that can compute a varienty of hashes
    // in both the browser, CF workers and node but unfortunately this isn't easily possible
    // for md5 - so here we just special case for md5, node and base64 encoding for now.
    return createHash("md5")
        .update(data, "utf-8")
        .digest("base64") as Base64String
}
export enum R2GrapherConfigDirectory {
    byUUID = "config/by-uuid",
    publishedGrapherBySlug = "grapher/by-slug",
}

let s3Client: S3Client | undefined = undefined

export async function saveGrapherConfigToR2ByUUID(
    id: string,
    chartConfigStringified: string
) {
    const configMd5 = await getMd5HashBase64(chartConfigStringified)

    await saveGrapherConfigToR2(
        chartConfigStringified,
        R2GrapherConfigDirectory.byUUID,
        `${id}.json`,
        configMd5
    )
}

export async function deleteGrapherConfigFromR2ByUUID(id: string) {
    await deleteGrapherConfigFromR2(
        R2GrapherConfigDirectory.byUUID,
        `${id}.json`
    )
}

export async function saveGrapherConfigToR2(
    config_stringified: string,
    directory: R2GrapherConfigDirectory,
    filename: string,
    configMd5: Base64String
) {
    if (
        GRAPHER_CONFIG_R2_BUCKET === undefined ||
        GRAPHER_CONFIG_R2_BUCKET_PATH === undefined
    ) {
        console.info(
            "R2 bucket not configured, not storing grapher config to R2"
        )
        return
    }
    try {
        if (!s3Client) {
            s3Client = new S3Client({
                endpoint: R2_ENDPOINT,
                forcePathStyle: false,
                region: R2_REGION,
                credentials: {
                    accessKeyId: R2_ACCESS_KEY_ID,
                    secretAccessKey: R2_SECRET_ACCESS_KEY,
                },
            })
        }

        if (!GRAPHER_CONFIG_R2_BUCKET || !GRAPHER_CONFIG_R2_BUCKET_PATH) {
            throw new Error("R2 bucket not configured")
        }

        const bucket = GRAPHER_CONFIG_R2_BUCKET
        // On prod, GRAPHER_CONFIG_R2_BUCKET_PATH might be an empty string and in this case we need to exclude it
        const path = excludeUndefined([
            GRAPHER_CONFIG_R2_BUCKET_PATH,
            directory,
        ]).join("/")

        const MIMEType = "application/json"

        const params: PutObjectCommandInput = {
            Bucket: bucket,
            Key: `${path}/${filename}`,
            Body: config_stringified,
            ContentType: MIMEType,
            ContentMD5: configMd5,
        }

        await s3Client.send(new PutObjectCommand(params))
        console.log(
            `Successfully uploaded object: ${params.Bucket}/${params.Key}`
        )
    } catch (err) {
        await logErrorAndMaybeSendToBugsnag(err)
        throw new JsonError(
            `Failed to save the grapher config to R2. Inner error: ${err}`
        )
    }
}

export async function deleteGrapherConfigFromR2(
    directory: R2GrapherConfigDirectory,
    filename: string
) {
    if (
        GRAPHER_CONFIG_R2_BUCKET === undefined ||
        GRAPHER_CONFIG_R2_BUCKET_PATH === undefined
    ) {
        console.info(
            "R2 bucket not configured, not deleting grapher config to R2"
        )
        return
    }
    try {
        if (!s3Client) {
            s3Client = new S3Client({
                endpoint: R2_ENDPOINT,
                forcePathStyle: false,
                region: R2_REGION,
                credentials: {
                    accessKeyId: R2_ACCESS_KEY_ID,
                    secretAccessKey: R2_SECRET_ACCESS_KEY,
                },
            })
        }

        if (!GRAPHER_CONFIG_R2_BUCKET || !GRAPHER_CONFIG_R2_BUCKET_PATH) {
            throw new Error("R2 bucket not configured")
        }

        const bucket = GRAPHER_CONFIG_R2_BUCKET
        // On prod, GRAPHER_CONFIG_R2_BUCKET_PATH might be an empty string and in this case we need to exclude it
        const path = excludeUndefined([
            GRAPHER_CONFIG_R2_BUCKET_PATH,
            directory,
        ]).join("/")

        const params: DeleteObjectCommandInput = {
            Bucket: bucket,
            Key: `${path}/${filename}`,
        }

        await s3Client.send(new DeleteObjectCommand(params))
        console.log(
            `Successfully deleted object: ${params.Bucket}/${params.Key}`
        )
    } catch (err) {
        await logErrorAndMaybeSendToBugsnag(err)
        throw new JsonError(
            `Failed to delete the grapher config to R2 at ${directory}/${filename}. Inner error: ${err}`
        )
    }
}
