import * as path from "path"
import * as fs from "fs-extra"
import {
    JsonError,
    filenamify,
    exec,
    execFormatted
} from "utils/server/serverUtil"
import { Dataset } from "db/model/Dataset"
import { Source } from "db/model/Source"
import { GIT_DATASETS_DIR, TMP_DIR } from "serverSettings"
import { GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL } from "settings"
import * as db from "db/db"

async function datasetToReadme(dataset: Dataset): Promise<string> {
    const source = await Source.findOne({ datasetId: dataset.id })
    return `# ${dataset.name}\n\n${(source &&
        source.description &&
        source.description.additionalInfo) ||
        ""}`
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
        `cd %s && rm -rf %s && git add -A %s && (git diff-index --quiet HEAD || (git commit -m %s --quiet --author="${commitName ||
            GIT_DEFAULT_USERNAME} <${commitEmail ||
            GIT_DEFAULT_EMAIL}>" && git push))`,
        [
            repoDir,
            `${repoDir}/datasets/${datasetName}`,
            `${repoDir}/datasets/${datasetName}`,
            `Removing ${datasetName}`
        ]
    )
}

export async function syncDatasetToGitRepo(
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

    const datasetRepo = options.transaction
        ? options.transaction.manager.getRepository(Dataset)
        : Dataset.getRepository()

    const dataset = await datasetRepo.findOne({ id: datasetId })
    if (!dataset) {
        throw new JsonError(`No such dataset ${datasetId}`, 404)
    }

    if (dataset.isPrivate) {
        // Private dataset doesn't go in git repo
        return removeDatasetFromGitRepo(
            oldDatasetName || dataset.name,
            dataset.namespace,
            options
        )
    }

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
    const tmpDatasetDir = path.join(TMP_DIR, dataset.filename)
    await fs.mkdirp(tmpDatasetDir)

    await Promise.all([
        fs.writeFile(
            path.join(tmpDatasetDir, `${dataset.filename}.csv`),
            await dataset.toCSV()
        ),
        fs.writeFile(
            path.join(tmpDatasetDir, `datapackage.json`),
            JSON.stringify(await dataset.toDatapackage(), null, 2)
        ),
        fs.writeFile(
            path.join(tmpDatasetDir, `README.md`),
            await datasetToReadme(dataset)
        )
    ])

    const datasetsDir = path.join(repoDir, "datasets")
    await fs.mkdirp(datasetsDir)

    const finalDatasetDir = path.join(datasetsDir, dataset.filename)
    const isNew = !fs.existsSync(finalDatasetDir)
    await execFormatted(`cd %s && rm -rf %s && mv %s %s && git add -A %s`, [
        repoDir,
        finalDatasetDir,
        tmpDatasetDir,
        finalDatasetDir,
        finalDatasetDir
    ])

    if (oldDatasetFilename && oldDatasetFilename !== dataset.filename) {
        const oldDatasetDir = path.join(datasetsDir, oldDatasetFilename)
        await execFormatted(`cd %s && rm -rf %s && git add -A %s`, [
            repoDir,
            oldDatasetDir,
            oldDatasetDir
        ])
    }

    const commitMsg = isNew
        ? `Adding ${dataset.filename}`
        : `Updating ${dataset.filename}`
    await execFormatted(
        `cd %s && (git diff-index --quiet HEAD || (git commit -m %s --quiet --author="${commitName ||
            GIT_DEFAULT_USERNAME} <${commitEmail || GIT_DEFAULT_EMAIL}>"${
            commitOnly ? "" : " && git push))"
        }`,
        [repoDir, commitMsg]
    )
}
