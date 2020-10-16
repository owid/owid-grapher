#! /usr/bin/env yarn tsn

import { tasks } from "./tasks"
import parseArgs from "minimist"

const taskNames = tasks.map((fn) => fn.name)

const getArgsOrErrorMessage = () => {
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

main()
