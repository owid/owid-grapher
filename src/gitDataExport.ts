import { JsonError } from './admin/serverUtil'
import { Dataset } from './model/Dataset'
import { GIT_DATASETS_DIR, GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL, TMP_DIR } from './settings'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as shell from 'shelljs'

async function datasetToReadme(dataset: Dataset): Promise<string> {
    return `# ${dataset.name}\n\n${dataset.description}`
}

export async function syncDatasetToGitRepo(datasetId: number, options: { oldDatasetName?: string, commitName?: string, commitEmail?: string } = {}) {
    const { oldDatasetName, commitName, commitEmail } = options

    const exec = (cmd: string) => {
        console.log(cmd)
        shell.exec(cmd)
    }

    const dataset = await Dataset.findOne({ id: datasetId }, { relations: ['variables'] })
    if (!dataset)
        throw new JsonError(`No such dataset ${datasetId}`, 404)

    // Base repository directory for this dataspace
    const repoDir = path.join(GIT_DATASETS_DIR, dataset.namespace)

    if (!fs.existsSync(path.join(repoDir, '.git'))) {
        await fs.mkdirp(repoDir)
        exec(`cd ${repoDir} && git init && git config user.name "${GIT_DEFAULT_USERNAME}" && git config user.email "${GIT_DEFAULT_EMAIL}"`)
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
    exec(`cd ${repoDir} && rm -rf "${finalDatasetDir}" && mv "${tmpDatasetDir}" "${finalDatasetDir}" && git add -A "${finalDatasetDir}"`)

    if (oldDatasetName && oldDatasetName !== dataset.filename) {
        exec(`cd ${repoDir} && rm -rf "${repoDir}/${oldDatasetName}" && git add -A "${repoDir}/${oldDatasetName}"`)
    }

    const commitMsg = isNew ? `Adding ${dataset.filename}` : `Updating ${dataset.filename}`
    exec(`cd ${repoDir} && git commit -m "${commitMsg}" --quiet --author="${commitName||GIT_DEFAULT_USERNAME} <${commitEmail||GIT_DEFAULT_EMAIL}>" && git push`)
}