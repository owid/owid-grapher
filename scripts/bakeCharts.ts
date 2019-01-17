import {ChartBaker} from 'site/server/ChartBaker'
import * as db from 'db/db'
import * as parseArgs from 'minimist'
import * as path from 'path'
const argv = parseArgs(process.argv.slice(2))

async function main(email: string, name: string, message: string) {
    const baker = new ChartBaker({
        repoDir: path.join(__dirname, `../../public`)
    })

    try {
        await db.connect()
        await baker.bakeAll()
        await baker.deploy(message || "Automated update", email, name)
    } catch (err) {
        console.error(err)
    } finally {
        baker.end()
    }
}

main(argv._[0], argv._[1], argv._[2])
