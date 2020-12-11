#! /usr/bin/env node

import parseArgs from "minimist"
import { SiteBaker } from "./SiteBaker"

const bakeDomainToFolder = async (baseUrl: string, dir: string) => {
    const baker = new SiteBaker(dir, baseUrl)
    console.log(`Baking site with baseUrl '${baseUrl}' to dir '${dir}'`)
    await baker.bakeAll()
}

const args = parseArgs(process.argv.slice(2))
const theArgs = args._
if (theArgs.length !== 2) {
    console.error(
        `Usage: yarn buildLocalBake http://owid.org /home/user/owid.org`
    )
    process.exit()
}

bakeDomainToFolder(theArgs[0], theArgs[1])
