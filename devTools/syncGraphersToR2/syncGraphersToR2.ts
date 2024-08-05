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
import {
    knexRaw,
    KnexReadonlyTransaction,
    knexReadonlyTransaction,
} from "../../db/db.js"
import { R2GrapherConfigDirectory } from "../../adminSiteServer/chartConfigR2Helpers.js"
import {
    base64ToBytes,
    bytesToBase64,
    DbRawChartConfig,
    differenceOfSets,
    excludeUndefined,
    HexString,
    hexToBytes,
} from "@ourworldindata/utils"
import { string } from "ts-pattern/dist/patterns.js"
import { chunk, take } from "lodash"
import ProgressBar from "progress"

type HashAndId = Pick<DbRawChartConfig, "fullMd5" | "id">

async function syncWithR2(
    s3Client: S3Client,
    pathPrefix: string,
    hashesOfFilesToToUpsert: Map<string, HashAndId>,
    trx: KnexReadonlyTransaction,
    dryRun: boolean = false
) {
    const hashesOfFilesToDelete = new Map<string, string>()

    // list the files in the R2 bucket. There may be more files in the
    // bucket than can be returned in one list operation so loop until
    // all files are listed
    let continuationToken: string | undefined = undefined
    do {
        const listObjectsCommandInput = {
            Bucket: GRAPHER_CONFIG_R2_BUCKET,
            Prefix: pathPrefix,
            ContinuationToken: continuationToken,
        }
        const listObjectsCommandOutput: ListObjectsV2CommandOutput =
            await s3Client.send(
                new ListObjectsV2Command(listObjectsCommandInput)
            )
        if ((listObjectsCommandOutput.Contents?.length ?? 0) > 0) {
            listObjectsCommandOutput.Contents!.forEach((object) => {
                if (object.Key && object.ETag) {
                    // For some reason the etag has quotes around it, strip those
                    const md5 = object.ETag.replace(/"/g, "") as HexString
                    const md5Base64 = bytesToBase64(hexToBytes(md5))

                    if (
                        hashesOfFilesToToUpsert.has(object.Key) &&
                        hashesOfFilesToToUpsert.get(object.Key)?.fullMd5 ===
                            md5Base64
                    ) {
                        hashesOfFilesToToUpsert.delete(object.Key)
                    } else {
                        hashesOfFilesToDelete.set(object.Key, md5Base64)
                    }
                }
            })
        }
        continuationToken = listObjectsCommandOutput.NextContinuationToken
    } while (continuationToken)

    console.log("Number of files to upsert", hashesOfFilesToToUpsert.size)
    console.log("Number of files to delete", hashesOfFilesToDelete.size)

    let progressBar = new ProgressBar(
        "--- Deleting obsolote configs [:bar] :current/:total :elapseds\n",
        {
            total: hashesOfFilesToDelete.size,
        }
    )

    for (const [key, _] of hashesOfFilesToDelete.entries()) {
        const deleteObjectCommandInput: DeleteObjectCommandInput = {
            Bucket: GRAPHER_CONFIG_R2_BUCKET,
            Key: key,
        }
        if (!dryRun)
            await s3Client.send(
                new DeleteObjectCommand(deleteObjectCommandInput)
            )
        else console.log("Would have deleted", key)
        progressBar.tick()
    }

    console.log("Finished deletes")

    progressBar = new ProgressBar(
        "--- Storing missing configs [:bar] :current/:total :elapseds\n",
        {
            total: hashesOfFilesToToUpsert.size,
        }
    )

    const errors = []

    // Chunk the inserts so that we don't need to keep all the full configs in memory
    for (const batch of chunk([...hashesOfFilesToToUpsert.entries()], 100)) {
        const fullConfigs = await knexRaw<
            Pick<DbRawChartConfig, "id" | "full">
        >(trx, `select id, full from chart_configs where id in (?)`, [
            batch.map((entry) => entry[1].id),
        ])
        const fullConfigMap = new Map<string, string>(
            fullConfigs.map(({ id, full }) => [id, full])
        )
        const uploadPromises = batch.map(async ([key, val]) => {
            const id = val.id
            const fullMd5 = val.fullMd5
            const full = fullConfigMap.get(id)
            if (full === undefined) {
                console.error(`Full config not found for id ${id}`)
                return
            }
            try {
                const putObjectCommandInput: PutObjectCommandInput = {
                    Bucket: GRAPHER_CONFIG_R2_BUCKET,
                    Key: key,
                    Body: full,
                    ContentMD5: fullMd5,
                }
                if (!dryRun)
                    await s3Client.send(
                        new PutObjectCommand(putObjectCommandInput)
                    )
                else console.log("Would have upserted", key)
            } catch (err) {
                return err
            }
            progressBar.tick()
        })
        const promiseResults = await Promise.allSettled(uploadPromises)
        const batchErrors = promiseResults
            .filter((result) => result.status === "rejected")
            .map((result) => result.reason)
        errors.push(...batchErrors)
    }

    console.log("Finished upserts")
    if (errors.length > 0) {
        console.error("Errors during upserts", errors)
    }
}

async function main(parsedArgs: parseArgs.ParsedArgs, dryRun: boolean) {
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

    const hashesOfFilesToToUpsertBySlug = new Map<string, HashAndId>()
    const hashesOfFilesToToUpsertByUuid = new Map<string, HashAndId>()
    const pathPrefixBySlug = excludeUndefined([
        GRAPHER_CONFIG_R2_BUCKET_PATH,
        R2GrapherConfigDirectory.publishedGrapherBySlug,
    ]).join("/")

    const pathPrefixByUuid = excludeUndefined([
        GRAPHER_CONFIG_R2_BUCKET_PATH,
        R2GrapherConfigDirectory.byUUID,
    ]).join("/")

    await knexReadonlyTransaction(async (trx) => {
        // Ensure that the published charts exist by slug
        const slugsAndHashesFromDb = await knexRaw<
            Pick<DbRawChartConfig, "slug" | "fullMd5" | "id">
        >(
            trx,
            `select slug, fullMd5, id from chart_configs where slug is not null`
        )

        slugsAndHashesFromDb.forEach((row) => {
            hashesOfFilesToToUpsertBySlug.set(
                `${pathPrefixBySlug}/${row.slug}.json`,
                {
                    fullMd5: row.fullMd5,
                    id: row.id,
                }
            )
        })

        await syncWithR2(
            s3Client,
            pathPrefixBySlug,
            hashesOfFilesToToUpsertBySlug,
            trx,
            dryRun
        )

        // Ensure that all chart configs exist by id
        const slugsAndHashesFromDbByUuid = await knexRaw<
            Pick<DbRawChartConfig, "fullMd5" | "id">
        >(trx, `select fullMd5, id from chart_configs`)

        slugsAndHashesFromDbByUuid.forEach((row) => {
            hashesOfFilesToToUpsertByUuid.set(
                `${pathPrefixByUuid}/${row.id}.json`,
                {
                    fullMd5: row.fullMd5,
                    id: row.id,
                }
            )
        })

        await syncWithR2(
            s3Client,
            pathPrefixByUuid,
            hashesOfFilesToToUpsertByUuid,
            trx,
            dryRun
        )
    })
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`syncGraphersToR2.js - sync graphers to R2`)
} else {
    main(parsedArgs, parsedArgs["dry-run"])
}
