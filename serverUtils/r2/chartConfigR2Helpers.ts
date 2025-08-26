import {
    GRAPHER_CONFIG_R2_BUCKET,
    GRAPHER_CONFIG_R2_BUCKET_PATH,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { Base64String, R2GrapherConfigDirectory } from "@ourworldindata/types"
import { lazy } from "@ourworldindata/utils"
import {
    createR2Key,
    deleteObjectFromR2,
    createS3Client,
    saveObjectToR2,
} from "./R2Helpers.js"

const getChartConfigS3Client = lazy(() =>
    createS3Client({
        endpoint: R2_ENDPOINT,
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    })
)

export async function saveGrapherConfigToR2ByUUID(
    uuid: string,
    chartConfigStringified: string,
    configMd5FromDb: Base64String
) {
    console.log("Saving grapher config to R2 by UUID:", uuid)
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
    if (
        GRAPHER_CONFIG_R2_BUCKET === undefined ||
        GRAPHER_CONFIG_R2_BUCKET_PATH === undefined
    ) {
        console.info("R2 bucket not configured, not storing config to R2")
        return
    }

    const s3Client = getChartConfigS3Client()
    const key = createR2Key(GRAPHER_CONFIG_R2_BUCKET_PATH, directory, filename)

    await saveObjectToR2(
        config,
        GRAPHER_CONFIG_R2_BUCKET,
        key,
        "application/json",
        configMd5FromDb,
        s3Client
    )
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
            "R2 bucket not configured, not deleting grapher config from R2"
        )
        return
    }

    const s3Client = getChartConfigS3Client()
    const key = createR2Key(GRAPHER_CONFIG_R2_BUCKET_PATH, directory, filename)

    await deleteObjectFromR2(GRAPHER_CONFIG_R2_BUCKET, key, s3Client)
}
