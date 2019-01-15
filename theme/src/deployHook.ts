import WordpressBaker from './BakeWordpress'
import * as parseArgs from 'minimist'
import * as os from 'os'
import * as path from 'path'
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