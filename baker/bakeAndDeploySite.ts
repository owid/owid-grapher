import parseArgs from "minimist"
import { tryBakeDeployAndTerminate } from "baker/DeployUtils"
const argv = parseArgs(process.argv.slice(2))

tryBakeDeployAndTerminate(argv._[2], argv._[0], argv._[1])
