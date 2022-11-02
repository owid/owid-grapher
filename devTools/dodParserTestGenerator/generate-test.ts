import { mdParser } from "@ourworldindata/grapher"

import parseArgs from "minimist"
async function main(parsedArgs: parseArgs.ParsedArgs) {
    const parseString = parsedArgs._[0]
    const result = mdParser.markdown.parse(parseString)
    const description = parsedArgs["d"]
    if (parsedArgs["result-only"])
        console.log(JSON.stringify(result, undefined, 2))
    else
        console.log(`
 it(${description || "parses markdown correctly"}, () => {
        expect(mdParser.markdown.parse("${parseString}")).toEqual(
            ${JSON.stringify(result, undefined, 2)}
        )
    })
        `)
}

const parsedArgs = parseArgs(process.argv.slice(2), {
    boolean: true,
})

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`generate-tests.js - utility to generate tests for the DoD parser from an input text

Usage:
    dump-data.js (--result-only) (-d "Test description") '[test](hover::cat::term)'

Options:
    --result-only   Only output the parse result, not the test case chrome around it
    -d DESC         Use the given desription for the test
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
