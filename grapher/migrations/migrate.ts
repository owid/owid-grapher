import * as fs from "fs"
import { Grapher } from "grapher/core/Grapher"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"

// yarn tsn migrate.ts

declare type Json = string

interface GrapherFromDb {
    id: string
    config: Json
}

const dbExport = fs.readFileSync(__dirname + "/raw-graphers.json", "utf8")
const dbRows = JSON.parse(dbExport) as GrapherFromDb[]

const graphers = dbRows.map((row) => {
    const grapher = JSON.parse(row.config) as LegacyGrapherInterface
    grapher.id = parseInt(row.id)
    delete grapher.data
    grapher.manuallyProvideData = true

    const g = new Grapher(grapher)
    return g.toObject()
})

fs.writeFileSync(
    __dirname + "/graphers.json",
    JSON.stringify(graphers, null, 2),
    "utf8"
)
