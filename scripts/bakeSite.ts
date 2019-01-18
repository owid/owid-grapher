import { WordpressBaker } from 'site/server/WordpressBaker'
import * as parseArgs from 'minimist'
const argv = parseArgs(process.argv.slice(2))

async function main() {
    const baker = new WordpressBaker({})

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