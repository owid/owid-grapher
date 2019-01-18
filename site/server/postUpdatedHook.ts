import { WordpressBaker } from './WordpressBaker'
import * as parseArgs from 'minimist'
const argv = parseArgs(process.argv.slice(2))

async function main(database: string, wordpressUrl: string, wordpressDir: string, email: string, name: string, postSlug: string) {
    try {
        console.log(database, wordpressUrl, wordpressDir, email, name, postSlug)
        const baker = new WordpressBaker({})

        await baker.bakeAll()
        await baker.deploy(`Updating ${postSlug}`, email, name)
        baker.end()
    } catch (err) {
        console.error(err)
    }
}

main(argv._[0], argv._[1], argv._[2], argv._[3], argv._[4], argv._[5])