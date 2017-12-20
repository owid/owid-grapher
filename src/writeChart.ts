import * as parseArgs from 'minimist'
import * as fs from 'fs-extra'
import {settings} from './settings'
import {writeChart} from './staticGen'
import {createConnection} from './database'
const argv = parseArgs(process.argv.slice(2))

function usage() {
    console.log(`Usage: ${process.argv[0]} <database> <chartId> <outDir>`)
}

async function main(database: string, chartId: number, baseDir: string) {
    if (!database || isNaN(chartId) || !baseDir)
        return usage()

    const db = createConnection({ database })

    const rows = await db.query(`SELECT config FROM charts WHERE id = ?`, [chartId])
    const chart = JSON.parse(rows[0].config)

    await writeChart(chart, baseDir, db)

    db.end()
}

main(argv._[0], parseInt(argv._[1]), argv._[2])


// TODO: redirects
