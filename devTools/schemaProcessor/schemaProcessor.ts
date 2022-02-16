import fs from "fs-extra"
import * as path from "path"
import {
    extractFieldDescriptionsFromSchema,
    FieldDescription,
} from "../../clientUtils/schemaProcessing.js"
import parseArgs from "minimist"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    const schema = await fs.readJson("schema.json")

    const fields: FieldDescription[] =
        extractFieldDescriptionsFromSchema(schema)
    console.log(JSON.stringify(fields, undefined, 2))
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`schemaProcessor.js - extract schema info`)
} else {
    main(parsedArgs)
}
