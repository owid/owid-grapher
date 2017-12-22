import {ChartBaker} from './ChartBaker'
import * as parseArgs from 'minimist'
import * as os from 'os'
import * as path from 'path'
const argv = parseArgs(process.argv.slice(2))

async function main(database: string) {
    const baker = new ChartBaker({
        database: database,
        canonicalRoot: 'https://static.ourworldindata.org',
        pathRoot: '/grapher',
        repoDir: path.join(os.homedir(), `${database}-static`)
    })

    try {
        await baker.bakeAll()
        await baker.deploy(`Code deployment update`)
    } catch (err) {
        console.error(err)
    } finally {
        baker.end()
    }
}

main(argv._[0])
