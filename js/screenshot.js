const CDP = require('chrome-remote-interface');
const argv = require('minimist')(process.argv.slice(2));
const file = require('fs');
const lockfile = require('lockfile')
const viewportWidth = 1030, viewportHeight = 730
// CLI Args
const url = argv.url || 'https://www.google.com';
const output = argv.output || "output.png"
const timeout = 30000

async function run() {
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

  const client = await CDP()

  const {Emulation, Page, Runtime} = client;

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
    Emulation.setVisibleSize({width: viewportWidth, height: viewportHeight})
  ])

  // Set up handler to await page rendering
  let isCapturing = false      
  Runtime.consoleAPICalled(async (result) => {
    if (isCapturing) return
    isCapturing = true
    console.log("Capturing screenshot")

    const svgData = result.args[0].value
    file.writeFile(output.replace(".png", ".svg"), svgData, async function(err) {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      const screenshot = await Page.captureScreenshot({format: 'png', fromSurface: true})
      const buffer = new Buffer(screenshot.data, 'base64');
      file.writeFile(output, buffer, 'base64', function(err) {
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

  /// In case the chart never loads, have a timeout
  setTimeout(function() {
      console.log("Timeout!");
      client.close();
      process.exit(1);
  }, timeout);

  console.log("Navigating");
  // Navigate to target page
  await Page.navigate({url});
}

const {ChromeLauncher} = require('lighthouse/lighthouse-cli/chrome-launcher');

/**
 * Launches a debugging instance of Chrome on port 9222.
 * @param {boolean=} headless True (default) to launch Chrome in headless mode.
 *     Set to false to launch Chrome normally.
 * @return {Promise<ChromeLauncher>}
 */
function launchChrome(headless = true) {
  const launcher = new ChromeLauncher({
    port: 9222,
    autoSelectChrome: true, // False to manually select which Chrome install.
    additionalFlags: [
      '--window-size=1020,720',
      '--disable-gpu',
      '--headless'
    ]
  });

  return launcher.run().then(() => launcher)
    .catch(err => {
      return launcher.kill().then(() => { // Kill Chrome if there's an error.
        throw err;
      }, console.error);
    });
}

lockfile.lock(output+'.lock', function(err) {
  if (err) {
    // Another process is already working on this. Just wait until it's finished.
    console.log("Waiting for other process")
    lockfile.lock(output+'.lock', { wait: timeout }, function(err) {
        process.exit(0)
    })
  } else {
    run().catch(e => {
      if (e.code == "ECONNREFUSED") {
        launchChrome().then(run).catch(e => {
          console.error(e);
          process.exit(1);
        })
      } else {
        console.error(e);
        process.exit(1);
      }
    })  
  }
})
