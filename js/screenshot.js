const chrome = require('chrome-remote-interface');
const argv = require('minimist')(process.argv.slice(2));
const file = require('fs');
const viewportWidth = 1030, viewportHeight = 730
// CLI Args
const url = argv.url || 'https://www.google.com';
const output = argv.output || "output.png"

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
      '--window-size=1920,1080',
      '--disable-gpu',
      '--hide-scrollbars',
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

// Start the Chrome Debugging Protocol
launchChrome().then((launcher) => {
  chrome(function(protocol) {
    // Extract used DevTools domains.
    const {Emulation, Page, Runtime} = protocol;

    const deviceMetrics = {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 0,
      mobile: false,
      fitWindow: false,
    };
    
    // Enable events on domains we are interested in.
    Promise.all([
        Page.enable(),
        Runtime.enable(),
        Emulation.setDeviceMetricsOverride(deviceMetrics),
        Emulation.setVisibleSize({width: viewportWidth, height: viewportHeight})
    ]).then(() => {
        // Set up handler to await page rendering
        let isCapturing = false      
        Runtime.consoleAPICalled((result) => {
          if (isCapturing) return
          isCapturing = true
          console.log("Capturing screenshot")

          const svgData = result.args[0].value
          file.writeFile(output.replace(".png", ".svg"), svgData, function(err) {
            if (err) {
              console.error(err);
            }
          })

          Page.captureScreenshot({fromSurface: true, format: 'png'}).then((screenshot) => {
            const buffer = new Buffer(screenshot.data, 'base64');
            file.writeFile(output, buffer, 'base64', function(err) {
              if (err) {
                console.error(err);
              } else {
                console.log('Screenshot saved');
              }
              protocol.close();
              launcher.kill();
              process.exit(0);
            });
          });
        });

        /// In case the chart never loads, have a timeout
        setTimeout(function() {
            console.log("Timeout!");
            protocol.close();
            launcher.kill();
            process.exit(1);
        }, 30000);

        // Navigate to target page
        return Page.navigate({url});
    })
  }).on('error', err => {
    console.error('Cannot connect to browser:', err);
  });
});
