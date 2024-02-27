import path from "path"
import fs from "fs-extra"
import {
    datasetToCSV,
    datasetToDatapackage,
    getDatasetById,
} from "../db/model/Dataset.js"
import {
    GIT_DATASETS_DIR,
    TMP_DIR,
    GIT_DEFAULT_USERNAME,
    GIT_DEFAULT_EMAIL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import filenamify from "filenamify"
import { execFormatted } from "../db/execWrapper.js"
import { JsonError } from "@ourworldindata/utils"
import { DbPlainDataset } from "@ourworldindata/types"
import { Knex } from "knex"
import { getSourcesForDataset } from "../db/model/Source.js"

const datasetToReadme = async (
    knex: Knex<any, any[]>,
    dataset: DbPlainDataset
): Promise<string> => {
    // TODO: add origins here
    const source = (await getSourcesForDataset(knex, dataset.id))[0]
    return `# ${dataset.name}\n\n${
        (source && source.description && source.description.additionalInfo) ||
        ""
    }`
}

export async function removeDatasetFromGitRepo(
    datasetName: string,
    namespace: string,
    options: { commitName?: string; commitEmail?: string } = {}
) {
    const { commitName, commitEmail } = options

    const repoDir = path.join(GIT_DATASETS_DIR, namespace)

    if (!fs.existsSync(path.join(repoDir, ".git"))) {
        return
    }

    if (!fs.existsSync(`${repoDir}/datasets/${datasetName}`)) {
        return
    }

    await execFormatted(
        `cd %s && rm -rf %s && git add -A %s && (git diff-index --quiet HEAD || (git commit -m %s --quiet --author="${
            commitName || GIT_DEFAULT_USERNAME
        } <${commitEmail || GIT_DEFAULT_EMAIL}>" && git push))`,
        [
            repoDir,
            `${repoDir}/datasets/${datasetName}`,
            `${repoDir}/datasets/${datasetName}`,
            `Removing ${datasetName}`,
        ]
    )
}

export async function syncDatasetToGitRepo(
    knex: Knex<any, any[]>,
    datasetId: number,
    options: {
        transaction?: db.TransactionContext
        oldDatasetName?: string
        commitName?: string
        commitEmail?: string
        commitOnly?: boolean
    } = {}
) {
    const { oldDatasetName, commitName, commitEmail, commitOnly } = options

    const oldDatasetFilename = oldDatasetName
        ? filenamify(oldDatasetName)
        : undefined

    const dataset = await getDatasetById(knex, datasetId)

    if (!dataset) throw new JsonError(`No such dataset ${datasetId}`, 404)

    const datasetFilename = filenamify(dataset.name)

    if (dataset.isPrivate || dataset.nonRedistributable)
        // Private dataset doesn't go in git repo
        return removeDatasetFromGitRepo(
            oldDatasetName || dataset.name,
            dataset.namespace,
            options
        )

    // Not doing bulk imports for now
    if (dataset.namespace !== "owid") return

    // Base repository directory for this dataspace
    const repoDir = path.join(GIT_DATASETS_DIR, dataset.namespace)

    if (!fs.existsSync(path.join(repoDir, ".git"))) {
        await fs.mkdirp(repoDir)
        await execFormatted(
            `cd %s && git init && git config user.name %s && git config user.email %s`,
            [repoDir, GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL]
        )
    }

    // Output dataset to temporary directory
    const tmpDatasetDir = path.join(TMP_DIR, datasetFilename)
    await fs.mkdirp(tmpDatasetDir)

    await Promise.all([
        fs.writeFile(
            path.join(tmpDatasetDir, `${datasetFilename}.csv`),
            await datasetToCSV(knex, dataset.id)
        ),
        fs.writeFile(
            path.join(tmpDatasetDir, `datapackage.json`),
            JSON.stringify(
                await datasetToDatapackage(knex, dataset.id),
                null,
                2
            )
        ),
        fs.writeFile(
            path.join(tmpDatasetDir, `README.md`),
            await datasetToReadme(knex, dataset)
        ),
    ])

    const datasetsDir = path.join(repoDir, "datasets")
    await fs.mkdirp(datasetsDir)

    const finalDatasetDir = path.join(datasetsDir, datasetFilename || "")
    const isNew = !fs.existsSync(finalDatasetDir)
    await execFormatted(`cd %s && rm -rf %s && mv %s %s && git add -A %s`, [
        repoDir,
        finalDatasetDir,
        tmpDatasetDir,
        finalDatasetDir,
        finalDatasetDir,
    ])

    if (oldDatasetFilename && oldDatasetFilename !== datasetFilename) {
        const oldDatasetDir = path.join(datasetsDir, oldDatasetFilename)
        await execFormatted(`cd %s && rm -rf %s && git add -A %s`, [
            repoDir,
            oldDatasetDir,
            oldDatasetDir,
        ])
    }

    const commitMsg = isNew
        ? `Adding ${datasetFilename}`
        : `Updating ${datasetFilename}`
    await execFormatted(
        `cd %s && (git diff-index --quiet HEAD || (git commit -m %s --quiet --author="${
            commitName || GIT_DEFAULT_USERNAME
        } <${commitEmail || GIT_DEFAULT_EMAIL}>"${
            commitOnly ? "" : " && git push))"
        }`,
        [repoDir, commitMsg]
    )
}
