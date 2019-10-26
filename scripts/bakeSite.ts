import * as parseArgs from 'minimist'
import { deploy } from 'deploy/deploy'
const argv = parseArgs(process.argv.slice(2))

deploy(argv._[2], argv._[0], argv._[1])
