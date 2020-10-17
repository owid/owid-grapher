#! /usr/bin/env yarn tsn

import * as fs from "fs"
import * as db from "db/db"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { isPresent, mapToObjectLiteral } from "grapher/utils/Util"
import { getPublishedGraphersBySlug } from "site/server/bakeGraphersToImages"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import { CoreTable } from "coreTable/CoreTable"
import parseArgs from "minimist"
import { ChartTypeName } from "grapher/core/GrapherConstants"

const GRAPHER_DUMP_LOCATION = __dirname + "/graphers.json"
const GRAPHER_TRIMMED_LOCATION = __dirname + "/graphers-trimmed.json"
const GRAPHER_SELECTIONS_LOCATION = __dirname + "/graphers-selections.txt"

const rawGraphers = () =>
    Object.values(
        JSON.parse(fs.readFileSync(GRAPHER_DUMP_LOCATION, "utf8"))
    ) as GrapherProgrammaticInterface[]

const eachGrapher = (
    fn: (
        config: Partial<LegacyGrapherInterface & GrapherProgrammaticInterface>
    ) => any
) => {
    return rawGraphers()
        .map((config) => {
            try {
                return fn(config)
            } catch (err) {
                console.log(`Error for Grapher Id: ${config.id}`)
                console.log(err)
                return null
            }
        })
        .filter(isPresent)
}

const trimGraphers = async () => {
    const trimmedGraphers = eachGrapher((config) => {
        config.manuallyProvideData = true
        return new Grapher(config).toObject()
    })
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

// This spits out a report with the graphers where an entity is selected in one variable but not the other.
// Our new selection strategy doesn't yet allow a behavior like selecting an entity only for one variable.
const dumpComplexSelections = async () => {
    const graphers = eachGrapher((config) => {
        if (!config.selectedData || !config.selectedData.length) return null
        const selection = new CoreTable(config.selectedData)
        const dimensions = new CoreTable(config.dimensions)
        const dimensionVariableCount =
            dimensions.get("variableId")?.numUniqs ?? 0
        const actualSelectionCount = selection.numRows
        const selectionVariableCount = selection.get("index")!.numUniqs
        const selectedEntities = selection.get("entityId")!.numUniqs
        const expectedSelectionCount = selectionVariableCount * selectedEntities
        const fullSelectionCount = selectedEntities * dimensionVariableCount
        const couldBeAProblem =
            expectedSelectionCount !== actualSelectionCount ||
            fullSelectionCount !== actualSelectionCount
                ? 1
                : 0
        return {
            grapherId: config.id,
            type: config.type ?? ChartTypeName.LineChart,
            url: `https://ourworldindata.org/grapher/${config.slug}`,
            dimensionVariableCount,
            selectionVariableCount,
            selectedEntities,
            expectedSelectionCount,
            fullSelectionCount,
            actualSelectionCount,
            couldBeAProblem,
        }
    }).filter(isPresent)

    let table = new CoreTable(graphers)
    table = table
        .isGreaterThan("dimensionVariableCount", 1)
        .isGreaterThan("selectedEntities", 0)
        .where({ couldBeAProblem: 1 })

    fs.writeFileSync(
        GRAPHER_SELECTIONS_LOCATION,
        table.toAlignedTextTable({
            maxCharactersPerColumn: 200,
            maxCharactersPerLine: 500,
        }),
        "utf8"
    )
    db.end()
}

const getArgsOrErrorMessage = () => {
    const taskNames = tasks.map((fn) => fn.name)
    const args = parseArgs(process.argv.slice(2))
    const taskArgs = args._
    if (!taskArgs.length) return `Available tasks: ${taskNames.join(" and ")}`
    const unknownTasks = taskArgs.filter((name) => !taskNames.includes(name))
    if (unknownTasks.length) return `Unknown task names: ${unknownTasks}`
    return taskArgs
}

const main = async () => {
    const taskArgs = getArgsOrErrorMessage()
    if (typeof taskArgs === "string") {
        console.log(taskArgs)
        return
    }

    taskArgs.forEach(async (taskName) => {
        const fn = tasks.find((fn) => fn.name === taskName)!
        await fn()
    })
    return `Ran ${taskArgs.join(" and ")}`
}

const tasks = [trimGraphers, dumpGraphers, dumpComplexSelections]

main()
