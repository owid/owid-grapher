"use strict";
var page = require('webpage').create(),
    system = require('system'),
    fs = require('fs'),
    address, output, size;


if (system.args.length < 3 || system.args.length > 5) {
    console.log('Usage: rasterize.js URL filename [paperwidth*paperheight|paperformat] [zoom]');
    console.log('  paper (pdf output) examples: "5in*7.5in", "10cm*20cm", "A4", "Letter"');
    console.log('  image (png/jpg output) examples: "1920px" entire page, window width 1920px');
    console.log('                                   "800px*600px" window, clipped to 800x600');
    phantom.exit(1);
} else {
    address = system.args[1];
    output = system.args[2];
    page.viewportSize = { width: 600, height: 600 };
    if (system.args.length > 3 && system.args[2].substr(-4) === ".pdf") {
        size = system.args[3].split('*');
        page.paperSize = size.length === 2 ? { width: size[0], height: size[1], margin: '0px' }
                                           : { format: system.args[3], orientation: 'portrait', margin: '1cm' };
    } else if (system.args.length > 3 && system.args[3].substr(-2) === "px") {
        size = system.args[3].split('*');
        var targetWidth = parseInt(size[0], 10);
        var targetHeight = parseInt(size[1], 10);
        page.viewportSize = { width: targetWidth+200, height: targetHeight+200 };
        page.clipRect = { top: 0, left: 0, width: targetWidth, height: targetHeight };
    }

    page.onCallback = function(data) {
        window.setTimeout(function() {
            try {
                if (data && data.svg) {
                    var target = output.replace(".png", ".svg");
                    fs.write(target, data.svg, 'w');
                    phantom.exit();
                } else {
                    page.render(output, { format: 'png' });
                }
            } catch (e) {
                console.log(e);
            }
        }, 100);
    }
    page.open(address, function (status) {
        if (status !== 'success') {
            console.log('Unable to load the address!');
            phantom.exit(1);
        } else {
            /// In case the chart never loads, have a timeout
            window.setTimeout(function() {
                console.log("Timeout!");
                phantom.exit(1);
            }, 5000);
        }
    });
}
