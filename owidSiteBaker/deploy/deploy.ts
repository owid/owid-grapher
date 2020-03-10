import { SiteBaker } from "site/server/SiteBaker"
import { log } from "utils/server/log"

export async function tryDeployAndTerminate(
    message: string = "Automated update",
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
    message: string = "Automated update",
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
