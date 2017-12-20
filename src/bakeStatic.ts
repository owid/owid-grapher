import {ChartBaker} from './ChartBaker'
import * as parseArgs from 'minimist'
const argv = parseArgs(process.argv.slice(2))

async function main() {
    const baker = new ChartBaker({
        database: 'dev_grapher',
        canonicalRoot: 'https://ourworldindata.org/grapher',
        pathRoot: '/grapher',
        outDir: '/Users/mispy/static-owid/grapher/'
    })

    if (argv._[0] === "redirects")
        await baker.bakeRedirects()
    else if (argv._[0] === "all")
        await baker.bakeAll()

    await baker.end()
}

main()