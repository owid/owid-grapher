import fs from "fs-extra"

import { SiteBaker } from "site/server/SiteBaker"
import { log } from "utils/server/log"

export async function tryDeployAndTerminate(
    message?: string,
    email?: string,
    name?: string
) {
    message = message ?? (await defaultCommitMessage())

    const baker = new SiteBaker({})

    try {
        await baker.bakeAll()
        await baker.deploy(message, email, name)
    } catch (err) {
        log.error(err)
    } finally {
        baker.end()
    }
}

export async function deploy(message?: string, email?: string, name?: string) {
    message = message ?? (await defaultCommitMessage())

    const baker = new SiteBaker({})

    try {
        await baker.bakeAll()
        await baker.deploy(message, email, name)
    } catch (err) {
        log.error(err)
        throw err
    }
}

async function defaultCommitMessage(): Promise<string> {
    let message = "Automated update"

    // In the deploy.sh script, we write the current git rev to 'public/head.txt'
    // and want to include it in the deploy commit message
    await fs
        .readFile("public/head.txt")
        .then(sha => {
            message += `\nowid/owid-grapher@${sha}`
        })
        .catch(err => log.warn(err))
    return message
}
