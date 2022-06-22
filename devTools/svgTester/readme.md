# SVG Tester

This folder contains a set of tools to check the default svg output of all (or a subset of) graphers. The intended use is to easily check if a change you made to the grapher leads to any of the svg outputs to change (i.e. it tests all ~3500 graphers svg output against a reference export). This is not perfect as it doesn't include any interaction but it's a nice sanity check to see if a change broke something.

# Overview

Initially you need to generate a data dump and a reference svg export that together comprises the reference set of grapher inputs and outputs. This should then be regenerated periodically (e.g. monthly) from the production data or whenever important new data/config changes happen.

Whenever you want to check your current codebase's svg output you run the verify-graphs script that will compare the output with the reference set.

## Make a reference set of SVGs

### 1. Generate a reference dataset

`dump-data.js` is used to dump the config and data json files. It needs a running grapher MySQL database (in contrast to the other tools). For every public and published grapher (~3200 at the time of writing) it creates one subdirectory with the id of the grapher as the directory name and inside it creates config.json containing the grapher json config and data.json containing the data for this grapher in the form that is also transmitted over the wire when the grapher is embedded.

We used to have both the grapher json config and the data.json gzipped. The reason we switched to uncompressed for this is that the .gz files that we used before have a legacy header that indicates the os the file was generated on. This led to mass git diffs whenever you would to a data-dump on a different os. I discussed this with Lars and we think it might be useful to have the plaintext version of configs and data available in this way so for now we do no compression at all for grapher configs and data. In the future we might use brotli compression or a similar scheme that doesn't have weird legacy headers

### 2. Generate reference SVGs

`export-graphs.js` is used to iterate over all directories created by dump-data and creates the reference svgs. For each dir it sees it loads the config and data, initializes a new grapher instance and runs the svg export into a string. The svg is slightly processed to remove non-deterministic elements (some ids can differ between runs). It calculates an md5 checksum of the svg, saves the svg into a file. When all folders are done it writes a csv file that contains the md5 hashes of each grapher.

## Check against reference SVGs

`verify-graphs.js` iterates over all directories created by dump-data and checks the svgs against the reference export. To do so it loads the config and data, initializes a new grapher and runs the svg export and svg postprocessing like the export-graphs script. In contrast to it it then does not immediately write the svg somewhere but instead checks if the md5 hash is the same as the one in the csv exported by export-graphs. If there is no difference nothing further happens. If there is a difference it writes the svg with the difference to a file and outputs the id of the grapher to stdout. If there were any differences the return code is non-zero.

## Notes

For all tools use the verbose flag if you want to see what the tool is doing, otherwise there is no output to stdout except for failing graph ids in the verify-graphs script for easy bash collection of failing graphs.
