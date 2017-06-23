const CDP = require('chrome-remote-interface');
const argv = require('minimist')(process.argv.slice(2));
const file = require('fs');
const lockfile = require('lockfile')
const viewportWidth = 1030, viewportHeight = 730
// CLI Args
const url = argv.url || 'https://www.google.com';
const output = argv.output || "output.png"
const chromeLauncher = require('chrome-launcher')
const nodeCleanup = require('node-cleanup')
const {exec} = require('child_process')

// Maximum time to wait for an image export
const timeout = 30000
// Maximum number of simultaneous exports
const maxWorkers = 10
// Hard max on number of screenshot.js processes before they start erroring out
const hardMaxWorkers = 100

let chromeProcess = null
nodeCleanup((exitCode, signal) => {
    if (chromeProcess) chromeProcess.kill()
})

async function run(chrome) {
    chromeProcess = chrome
    // Start the Chrome Debugging browser
    /*const browser = await CDP({target: 'ws://localhost:9222/devtools/browser'})
  
    const {Target} = browser;
    const {browserContextId} = await Target.createBrowserContext();
    const {targetId} = await Target.createTarget({
        url: 'about:blank',
        browserContextId
    });
  
    function findTargetById(id) {
        return (targets) => {
            return targets.find((target) => target.id === id);
        };
    }
  
    const client = await CDP({target: findTargetById(targetId)});*/

    /* let tabMeta = await CDP.New({ remote : true });
     let client = await CDP({ tab : tabMeta})
     client._target = tabMeta;
   
     process.on('exit', async () => {
       return await client.Target.closeTarget(client._target.id);
     })*/

    const client = await CDP({ port: chrome.port })

    const { Emulation, Page, Runtime } = client;

    const deviceMetrics = {
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: 0,
        mobile: false,
        fitWindow: false,
    };

    // Enable events on domains we are interested in.
    await Promise.all([
        Page.enable(),
        Runtime.enable(),
        Emulation.setDeviceMetricsOverride(deviceMetrics),
        Emulation.setVisibleSize({ width: viewportWidth, height: viewportHeight })
    ])

    // Set up handler to await page rendering
    let isCapturing = false
    Runtime.consoleAPICalled(async (result) => {
        if (isCapturing) return
        isCapturing = true
        console.log("Capturing screenshot")

        const svgData = result.args[0].value
        file.writeFile(output.replace(".png", ".svg"), svgData, async function (err) {
            if (err) {
                console.error(err);
                process.exit(1);
            }

            const screenshot = await Page.captureScreenshot({ format: 'png', fromSurface: true })
            const buffer = new Buffer(screenshot.data, 'base64');
            file.writeFile(output, buffer, 'base64', function (err) {
                if (err) {
                    console.error(err);
                    process.exit(1);
                } else {
                    console.log('Screenshot saved');
                }
                client.close();
                process.exit(0);
            });
        })
    });

    console.log("Navigating");
    // Navigate to target page
    await Page.navigate({ url });
}


/// In case something goes wrong or the chart never loads, have a timeout
setTimeout(function () {
    console.error("Timeout!");
    process.exit(1);
}, timeout);


function tryLaunch() {
    exec('ps x|grep screenshot.js', (err, stdout, stderr) => {
        const pids = stdout.split("\n").map(l => parseInt(l.trim().split(/\s+/)[0]))
        const numPriorityPids = pids.filter(pid => !isNaN(pid) && pid < process.pid).length

        if (numPriorityPids >= maxWorkers) {
            console.error("Too many screenshot.js workers ("+numPriorityPids+"/"+maxWorkers+"). Waiting...")
            setTimeout(tryLaunch, 1000)
            return
        }

        if (numPriorityPids >= hardMaxWorkers) {
            console.error("Way too many screenshot.js workers ("+numPriorityPids+"/"+maxWorkers+"). Exiting!")
            process.exit(1)
        }

        lockfile.lock(output + '.lock', function (err) {
            if (err) {
                // Another process is already working on this. Just wait until it's finished.
                console.log("Waiting for other process")
                lockfile.lock(output + '.lock', { wait: timeout }, function (err) {
                    process.exit(0)
                })
            } else {
                chromeLauncher.launch({
                    chromeFlags: [
                        '--window-size=1020,720',
                        '--disable-gpu',
                        '--headless'
                    ]
                }).then(run).catch(e => {
                    console.error(e);
                    process.exit(1);
                })
            }
        })
    })
}

tryLaunch()

