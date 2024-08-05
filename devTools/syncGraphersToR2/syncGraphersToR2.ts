import fs from "fs-extra"
import parseArgs from "minimist"
import {
    DeleteObjectCommand,
    DeleteObjectCommandInput,
    ListObjectsCommand,
    ListObjectsV2Command,
    ListObjectsV2CommandOutput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3"
import {
    GRAPHER_CONFIG_R2_BUCKET,
    GRAPHER_CONFIG_R2_BUCKET_PATH,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"
import { R2GrapherConfigDirectory } from "../../adminSiteServer/chartConfigR2Helpers.js"
import { DbRawChartConfig, excludeUndefined } from "@ourworldindata/utils"
import { string } from "ts-pattern/dist/patterns.js"
import { take } from "lodash"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    if (
        GRAPHER_CONFIG_R2_BUCKET === undefined ||
        GRAPHER_CONFIG_R2_BUCKET_PATH === undefined
    ) {
        console.info("R2 bucket not configured, exiting")
        return
    }

    const s3Client = new S3Client({
        endpoint: R2_ENDPOINT,
        forcePathStyle: false,
        region: R2_REGION,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })

    await knexReadonlyTransaction(async (trx) => {
        const slugsAndHashesFromDb = await knexRaw<
            Pick<DbRawChartConfig, "slug" | "fullSha1Base64">
        >(
            trx,
            `select slug, fullSha1Base64 from chart_configs where slug is not null`
        )
        const hashesOfFilesToToUpsert = new Map<string, string>()
        const path = excludeUndefined([
            GRAPHER_CONFIG_R2_BUCKET_PATH,
            R2GrapherConfigDirectory.publishedGrapherBySlug,
        ]).join("/")

        slugsAndHashesFromDb.forEach((row) => {
            hashesOfFilesToToUpsert.set(
                `${path}/${row.slug}.json`,
                row.fullSha1Base64
            )
        })

        const hashesOfFilesToDelete = new Map<string, string>()

        // list the files in the R2 bucket. There may be more files in the
        // bucket than can be returned in one list operation so loop until
        // all files are listed
        let continuationToken: string | undefined = undefined
        do {
            const listObjectsCommandInput = {
                Bucket: GRAPHER_CONFIG_R2_BUCKET,
                Prefix: path,
                ContinuationToken: continuationToken,
            }
            const listObjectsCommandOutput: ListObjectsV2CommandOutput =
                await s3Client.send(
                    new ListObjectsV2Command(listObjectsCommandInput)
                )
            console.log(
                "Got next batch of objects",
                listObjectsCommandOutput.Contents
            )
            if (listObjectsCommandOutput.Contents) {
                listObjectsCommandOutput.Contents.forEach((object) => {
                    if (object.Key && object.ETag) {
                        hashesOfFilesToDelete.set(object.Key, object.ETag)
                    }
                })
            }
            continuationToken = listObjectsCommandOutput.NextContinuationToken
        } while (continuationToken)

        console.log("10 entries ", take(hashesOfFilesToDelete.entries(), 10))
    })
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`syncGraphersToR2.js - sync graphers to R2`)
} else {
    main(parsedArgs)
}
