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
        repoDir: path.join(os.homedir(), `${database}-static`),
        regenConfig: argv._.indexOf("config") !== -1,
        regenData: argv._.indexOf("data") !== -1,
        regenImages: argv._.indexOf("images") !== -1
    })

    try {
        await baker.bakeAll()
        if (argv._.indexOf("deploy") !== -1)
            await baker.deploy(`Manual static regeneration`)
    } catch (err) {
        console.error(err)
    } finally {
        baker.end()
    }
}

main(argv._[0])
