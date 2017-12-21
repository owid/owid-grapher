import {ChartBaker} from './ChartBaker'
import * as parseArgs from 'minimist'
import * as os from 'os'
import * as path from 'path'
const argv = parseArgs(process.argv.slice(2))

async function main(database: string, email: string, name: string, slug: string) {
    console.log(database, email, name)
    const baker = new ChartBaker({
        database: database,
        canonicalRoot: 'https://ourworldindata.org',
        pathRoot: '/grapher',
        repoDir: path.join(os.homedir(), `${database}-static`)
    })

    try {
        await baker.bakeAll()
        await baker.deploy(email, name, `Updating ${slug}`)
    } catch (err) {
        console.error(err)
    } finally {
        baker.end()
    }
//        await baker.bakeAll()
//        await baker.deploy(email, name, `Updating ${chartSlug}`)
}

main(argv._[0], argv._[1], argv._[2], argv._[3])
