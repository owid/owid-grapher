import * as fs from "fs"
import * as db from "db/db"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { isPresent, mapToObjectLiteral } from "grapher/utils/Util"
import { getPublishedGraphersBySlug } from "site/server/bakeGraphersToImages"

const GRAPHER_DUMP_LOCATION = __dirname + "/graphers.json"
const GRAPHER_TRIMMED_LOCATION = __dirname + "/graphers-trimmed.json"

const trimGraphers = async () => {
    const grapherDump = fs.readFileSync(GRAPHER_DUMP_LOCATION, "utf8")
    const graphers = Object.values(
        JSON.parse(grapherDump)
    ) as GrapherProgrammaticInterface[]

    const trimmedGraphers = graphers
        .map((grapher) => {
            // delete (grapher as any).data
            grapher.manuallyProvideData = true
            try {
                return new Grapher(grapher).toObject()
            } catch {
                console.log(`Error for Grapher Id: ${grapher.id}`)
                return null
            }
        })
        .filter(isPresent)

    fs.writeFileSync(
        GRAPHER_TRIMMED_LOCATION,
        JSON.stringify(trimmedGraphers, null, 2),
        "utf8"
    )
}

const dumpGraphers = async () => {
    const { graphersById } = await getPublishedGraphersBySlug()
    fs.writeFileSync(
        GRAPHER_DUMP_LOCATION,
        JSON.stringify(mapToObjectLiteral(graphersById), null, 2),
        "utf8"
    )
    db.end()
}

export const tasks = [trimGraphers, dumpGraphers]
