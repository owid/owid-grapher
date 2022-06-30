import { mdParser } from "../../grapher/text/parser.js"

import parseArgs from "minimist"
async function main(parsedArgs: parseArgs.ParsedArgs) {
    const parseString = parsedArgs._[0]
    const result = mdParser.markupTokens.parse(parseString)
    const description = parsedArgs["-d"]
    if (parsedArgs["result-only"]) console.log(result)
    else
        console.log(`
 it("PARSER TEST DESCRIPTION TEXT", () => {
        expect(mdParser.markupTokens.parse("${parseString}")).toEqual(
            ${JSON.stringify(result, undefined, 2)}
        )
    })
        `)
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`generate-tests.js - utility to generate tests for the DoD parser from an input text

Usage:
    dump-data.js (-d "Test description") '[test](hover::cat::term)'

Options:
    --result-only   Only output the parse result, not the test case chrome around it
    -d DESC         Use the given desription for the test
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
