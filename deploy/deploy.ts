import * as git from "git-rev-sync"

import { SiteBaker } from "site/server/SiteBaker"
import { log } from "utils/server/log"

export async function tryDeployAndTerminate(
    message: string = defaultCommitMessage(),
    email?: string,
    name?: string
) {
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

export async function deploy(
    message: string = defaultCommitMessage(),
    email?: string,
    name?: string
) {
    const baker = new SiteBaker({})

    try {
        await baker.bakeAll()
        await baker.deploy(message, email, name)
    } catch (err) {
        log.error(err)
        throw err
    }
}

function defaultCommitMessage(): string {
    let message = "Automated update"
    try {
        const sha = git.long()
        message += `\nowid/owid-grapher@${sha}`
    } catch (err) {
        log.warn(err)
    }
    return message
}
