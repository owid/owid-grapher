import * as path from 'path'
import * as fs from 'fs-extra'
import * as shell from 'shelljs'
import {quote} from 'shell-quote'
import * as util from 'util'

import { JsonError } from './admin/serverUtil'
import { Dataset } from './model/Dataset'
import { Source } from './model/Source'
import { GIT_DATASETS_DIR, GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL, TMP_DIR } from './settings'
import * as db from './db'

async function datasetToReadme(dataset: Dataset): Promise<string> {
    const source = await Source.findOne({ datasetId: dataset.id })
    return `# ${dataset.name}\n\n${(source && source.description && source.description.additionalInfo)||""}`
}

function exec(cmd: string, args: string[]) {
    const formatCmd = util.format(cmd, ...args.map(s => quote([s])))
    console.log(formatCmd)
    shell.exec(formatCmd)
}

export async function removeDatasetFromGitRepo(datasetName: string, namespace: string, options: { commitName?: string, commitEmail?: string } = {}) {
    const {commitName, commitEmail } = options

    const repoDir = path.join(GIT_DATASETS_DIR, namespace)

    if (!fs.existsSync(path.join(repoDir, '.git'))) {
        return
    }

    exec(`cd %s && rm -rf %s && git add -A %s && git commit -m %s --quiet --author="${commitName||GIT_DEFAULT_USERNAME} <${commitEmail||GIT_DEFAULT_EMAIL}>" && git push`, [repoDir, `${repoDir}/${datasetName}`, `${repoDir}/${datasetName}`, `Removing ${datasetName}`])
}

export async function syncDatasetToGitRepo(datasetId: number, options: { transaction?: db.TransactionContext, oldDatasetName?: string, commitName?: string, commitEmail?: string, commitOnly?: boolean } = {}) {
    const { oldDatasetName, commitName, commitEmail, commitOnly } = options

    const datasetRepo = options.transaction ? options.transaction.manager.getRepository(Dataset) : Dataset.getRepository()

    const dataset = await datasetRepo.findOne({ id: datasetId }, { relations: ['variables'] })
    if (!dataset) {
        throw new JsonError(`No such dataset ${datasetId}`, 404)
    }

    // Not doing bulk imports for now
    if (dataset.namespace !== 'owid')
        return

    // Base repository directory for this dataspace
    const repoDir = path.join(GIT_DATASETS_DIR, dataset.namespace)

    if (!fs.existsSync(path.join(repoDir, '.git'))) {
        await fs.mkdirp(repoDir)
        exec(`cd %s && git init && git config user.name %s && git config user.email %s`, [repoDir, GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL])
    }

    // Output dataset to temporary directory
    const tmpDatasetDir = path.join(TMP_DIR, dataset.filename)
    await fs.mkdirp(tmpDatasetDir)

    await Promise.all([
        fs.writeFile(path.join(tmpDatasetDir, `${dataset.filename}.csv`), await dataset.toCSV()),
        fs.writeFile(path.join(tmpDatasetDir, `datapackage.json`), JSON.stringify(await dataset.toDatapackage(), null, 2)),
        fs.writeFile(path.join(tmpDatasetDir, `README.md`), await datasetToReadme(dataset))
    ])

    const finalDatasetDir = path.join(repoDir, dataset.filename)
    const isNew = !fs.existsSync(finalDatasetDir)
    exec(`cd %s && rm -rf %s && mv %s %s && git add -A %s`, [repoDir, finalDatasetDir, tmpDatasetDir, finalDatasetDir, finalDatasetDir])

    if (oldDatasetName && oldDatasetName !== dataset.filename) {
        exec(`cd %s && rm -rf %s && git add -A %s`, [repoDir, `${repoDir}/${oldDatasetName}`, `${repoDir}/${oldDatasetName}`])
    }

    const commitMsg = isNew ? `Adding ${dataset.filename}` : `Updating ${dataset.filename}`
    exec(`cd %s && git commit -m %s --quiet --author="${commitName||GIT_DEFAULT_USERNAME} <${commitEmail||GIT_DEFAULT_EMAIL}>"${commitOnly ? "" : " && git push"}`, [repoDir, commitMsg])
}