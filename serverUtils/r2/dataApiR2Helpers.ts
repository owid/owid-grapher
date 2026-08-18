import { gzipSync } from "zlib"
import {
    DATA_API_R2_BUCKET,
    DATA_API_R2_BUCKET_PATH,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { lazy } from "@ourworldindata/utils"
import { IS_RUNNING_INSIDE_VITEST } from "../../settings/clientSettings.js"
import { createR2Key, createS3Client } from "./R2Helpers.js"
import { PutObjectCommand } from "@aws-sdk/client-s3"

const getDataApiS3Client = lazy(() =>
    createS3Client({
        endpoint: R2_ENDPOINT,
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    })
)

/** Where a variable's data file lives. Handed to ETL, which uploads it; we never write it. */
export function indicatorDataPath(variableId: number): string {
    return `s3://${DATA_API_R2_BUCKET}/${DATA_API_R2_BUCKET_PATH}/${variableId}.data.json`
}

/**
 * Publish a variable's rendered metadata.
 *
 * Gzipped with `ContentEncoding: gzip` to match what ETL has always written — consumers read
 * these files expecting that, so the encoding is part of the contract, not an optimisation.
 */
export async function publishIndicatorMetadata(
    variableId: number,
    metadata: unknown
): Promise<void> {
    if (IS_RUNNING_INSIDE_VITEST) return
    if (!DATA_API_R2_BUCKET || DATA_API_R2_BUCKET_PATH === undefined) {
        console.info("Data API R2 bucket not configured, not publishing metadata")
        return
    }

    const body = gzipSync(Buffer.from(JSON.stringify(metadata)))
    const key = createR2Key(
        DATA_API_R2_BUCKET_PATH,
        "",
        `${variableId}.metadata.json`
    )

    await getDataApiS3Client().send(
        new PutObjectCommand({
            Bucket: DATA_API_R2_BUCKET,
            Key: key,
            Body: body,
            ContentType: "application/json",
            ContentEncoding: "gzip",
        })
    )
}
