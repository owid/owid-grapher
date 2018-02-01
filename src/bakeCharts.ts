import {ChartBaker} from './ChartBaker'
import * as parseArgs from 'minimist'
import * as os from 'os'
import * as path from 'path'
const argv = parseArgs(process.argv.slice(2))

async function main(email: string, name: string, slug: string) {
    const baker = new ChartBaker({
        canonicalRoot: 'https://ourworldindata.org',
        pathRoot: '/grapher',
        repoDir: path.join(__dirname, `../../public`),
        regenConfig: argv.regenConfig
    })

    try {
        await baker.bakeAll()
        if (email && name && slug)
            await baker.deploy(email, name, `Updating ${slug}`)
        else
            await baker.deploy("Code deployment update")
    } catch (err) {
        console.error(err)
    } finally {
        baker.end()
    }
}

main(argv._[0], argv._[1], argv._[2])
