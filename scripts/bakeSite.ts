import { SiteBaker } from 'site/server/SiteBaker'
import * as parseArgs from 'minimist'
const argv = parseArgs(process.argv.slice(2))

async function main() {
    const baker = new SiteBaker({})

    try {
        await baker.bakeAll()
        await baker.deploy(`Code deployment update`)
    } catch (err) {
        console.error(err)
    } finally {
        baker.end()
    }
}

main()