import { ChartConfigProps } from '../js/charts/ChartConfig'
import { streamVariableData } from './models/Variable'
import { settings } from './settings'
import {uniq} from 'lodash'
import * as parseArgs from 'minimist'
import * as fs from 'fs-extra'
import { DatabaseConnection } from './database'
import { MysqlError } from 'mysql'
const argv = parseArgs(process.argv.slice(2))
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import {ChartPage} from './ChartPage'

export async function writeVariables(variableIds: number[], baseDir: string, db: DatabaseConnection) {
    await fs.mkdirp(`${baseDir}/data/variables/`)
    const output = fs.createWriteStream(`${baseDir}/data/variables/${variableIds.join("+")}`)
    streamVariableData(variableIds, output, db)
}

export function embedSnippet(basePath: string, chartsJs: string, chartsCss: string): string {
    return `
        window.App = {};
        window.Global = { rootUrl: '${basePath}' };

        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = '${chartsCss}';
        document.head.appendChild(link);

        var hasPolyfill = false;
        var hasGrapher = false;

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasPolyfill = true;
            if (hasGrapher)
                window.Grapher.embedAll();
        }
        script.src = "https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch"
        document.head.appendChild(script);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasGrapher = true;
            if (hasPolyfill)
                window.Grapher.embedAll();
        }
        script.src = '${chartsJs}';
        document.head.appendChild(script);
    `
}