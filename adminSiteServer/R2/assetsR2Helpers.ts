import {
    R2_ENDPOINT,
    OWID_ASSETS_R2_ACCESS_KEY,
    OWID_ASSETS_R2_SECRET_KEY,
    OWID_ASSETS_R2_BUCKET,
} from "../../settings/serverSettings.js"
import { lazy } from "@ourworldindata/utils"
import { createS3ClientForConfig, saveObjectToR2 } from "./R2Helpers.js"
import { _Object, ListObjectsV2Command } from "@aws-sdk/client-s3"

const getAssetsS3Client = lazy(() =>
    createS3ClientForConfig({
        endpoint: R2_ENDPOINT,
        accessKeyId: OWID_ASSETS_R2_ACCESS_KEY,
        secretAccessKey: OWID_ASSETS_R2_SECRET_KEY,
    })
)

export async function listAllFilesInAssetsR2(): Promise<_Object[]> {
    if (
        !OWID_ASSETS_R2_BUCKET ||
        !OWID_ASSETS_R2_ACCESS_KEY ||
        !OWID_ASSETS_R2_SECRET_KEY
    ) {
        console.info("OWID Assets R2 not configured, cannot list files")
        return []
    }

    const s3Client = getAssetsS3Client()
    const objects = []
    let continuationToken: string | undefined = undefined

    do {
        const command: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: OWID_ASSETS_R2_BUCKET,
            ContinuationToken: continuationToken,
        })

        const response = await s3Client.send(command)
        if (response.Contents) {
            objects.push(...response.Contents)
        }
        continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return objects
}

export async function saveFileToAssetsR2(
    content: string | Buffer,
    key: string,
    contentType: string = "application/octet-stream"
) {
    if (
        !OWID_ASSETS_R2_BUCKET ||
        !OWID_ASSETS_R2_ACCESS_KEY ||
        !OWID_ASSETS_R2_SECRET_KEY
    ) {
        console.info("OWID Assets R2 not configured, not storing file to R2")
        return
    }

    const s3Client = getAssetsS3Client()
    return saveObjectToR2(
        content,
        OWID_ASSETS_R2_BUCKET,
        key,
        contentType,
        undefined, // No MD5 hash for general assets
        s3Client
    )
}
