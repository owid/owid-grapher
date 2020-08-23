import parseArgs from "minimist"
import { tryDeployAndTerminate } from "baker/baker/deploy/deploy"
const argv = parseArgs(process.argv.slice(2))

tryDeployAndTerminate(argv._[2], argv._[0], argv._[1])
