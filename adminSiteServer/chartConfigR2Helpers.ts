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
import { JsonError, lazy } from "@ourworldindata/utils"
import { Base64String, R2GrapherConfigDirectory } from "@ourworldindata/types"

const getS3Client: () => S3Client = lazy(
    () =>
        new S3Client({
            endpoint: R2_ENDPOINT,
            forcePathStyle: false,
            region: R2_REGION,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
            },
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED",
        })
)

export async function saveGrapherConfigToR2ByUUID(
    uuid: string,
    chartConfigStringified: string,
    configMd5FromDb: Base64String
) {
    await saveGrapherConfigToR2(
        chartConfigStringified,
        R2GrapherConfigDirectory.byUUID,
        `${uuid}.json`,
        configMd5FromDb
    )
}

export async function deleteGrapherConfigFromR2ByUUID(id: string) {
    await deleteGrapherConfigFromR2(
        R2GrapherConfigDirectory.byUUID,
        `${id}.json`
    )
}

export async function saveGrapherConfigToR2(
    config: string,
    directory: R2GrapherConfigDirectory,
    filename: string,
    configMd5FromDb: Base64String
) {
    await saveConfigToR2(config, directory, filename, configMd5FromDb)
}

export async function saveMultiDimConfigToR2(
    config: string,
    slug: string,
    configMd5FromDb: Base64String
) {
    await saveConfigToR2(
        config,
        R2GrapherConfigDirectory.multiDim,
        `${slug}.json`,
        configMd5FromDb
    )
}

async function saveConfigToR2(
    config: string,
    directory: string,
    filename: string,
    configMd5FromDb: Base64String
) {
    if (process.env.NODE_ENV === "test") {
        console.log("Skipping saving config to R2 in test environment")
        return
    }
    if (
        GRAPHER_CONFIG_R2_BUCKET === undefined ||
        GRAPHER_CONFIG_R2_BUCKET_PATH === undefined
    ) {
        console.info("R2 bucket not configured, not storing config to R2")
        return
    }
    try {
        const s3Client = getS3Client()

        if (!GRAPHER_CONFIG_R2_BUCKET || !GRAPHER_CONFIG_R2_BUCKET_PATH) {
            throw new Error("R2 bucket not configured")
        }

        const bucket = GRAPHER_CONFIG_R2_BUCKET
        const path = [GRAPHER_CONFIG_R2_BUCKET_PATH, directory, filename].join(
            "/"
        )

        const MIMEType = "application/json"

        const params: PutObjectCommandInput = {
            Bucket: bucket,
            Key: path,
            Body: config,
            ContentType: MIMEType,
            ContentMD5: configMd5FromDb,
        }

        await s3Client.send(new PutObjectCommand(params))
        console.log(
            `Successfully uploaded object: ${params.Bucket}/${params.Key}`
        )
    } catch (err) {
        throw new JsonError(
            `Failed to save the config to R2. Inner error: ${err}`,
            500
        )
    }
}

export async function deleteGrapherConfigFromR2(
    directory: R2GrapherConfigDirectory,
    filename: string
) {
    if (process.env.NODE_ENV === "test") {
        console.log("Skipping saving grapher config to R2 in test environment")
        return
    }
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
        const s3Client = getS3Client()

        if (!GRAPHER_CONFIG_R2_BUCKET || !GRAPHER_CONFIG_R2_BUCKET_PATH) {
            throw new Error("R2 bucket not configured")
        }

        const bucket = GRAPHER_CONFIG_R2_BUCKET
        const path = [GRAPHER_CONFIG_R2_BUCKET_PATH, directory, filename].join(
            "/"
        )

        const params: DeleteObjectCommandInput = {
            Bucket: bucket,
            Key: path,
        }

        await s3Client.send(new DeleteObjectCommand(params))
        console.log(
            `Successfully deleted object: ${params.Bucket}/${params.Key}`
        )
    } catch (err) {
        throw new JsonError(
            `Failed to delete the grapher config to R2 at ${directory}/${filename}. Inner error: ${err}`,
            500
        )
    }
}
