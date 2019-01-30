import { SiteBaker } from 'site/server/SiteBaker'
import * as parseArgs from 'minimist'
import { log } from 'utils/server/log'
const argv = parseArgs(process.argv.slice(2))

async function main(email: string, name: string, message: string) {
    const baker = new SiteBaker({})

    try {
        throw new Error("test error logging")
        await baker.bakeAll()
        await baker.deploy(message || "Automated update", email, name)
    } catch (err) {
        log.error(err)
    } finally {
        baker.end()
    }
}

main(argv._[0], argv._[1], argv._[2])