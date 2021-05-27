# SVG Tester

This folder contains a set of tools to check the default svg output of all (or a subset of) graphers. The intended use is to easily check if a change you made to the grapher leads to any of the svg outputs to change. This is not perfect as it doesn't include any interaction but it's a nice sanity check to see if a change broke something.

The tools in this folders are the following:

### dump-data.js

This tool needs a running grapher mysql database (in contrast to the other tools). For every public and published grapher (~3200 at the time of writing) it creates one subdirectoy with the id of the grapher as the directory name and inside it creates config.json.gz containing the grapher json config and data.json.gz containing the data for this grapher in the form that is also transmitted over the wire when the grapher is embedded.

### export-graphs.js

This tool iterates over all (or a subset of) directories created by dump-data and creates the reference svgs. For each dir it sees it loads the config and data, initializes a new grapher instance and runs the svg export into a string. The svg is slightly processed to remove non-deterministic elements (some ids can differ between runs). It calculates an md5 checksum of the svg, saves the svg into a file. When all folders are done it writes a csv file that contains the md5 hashes of each grapher.

### verify-graphs.js

This tool iterates over all (or a subset of) directories created by dump-data and checks the svgs against the reference export. To do so it loads the config and data, initializes a new grapher and runs the svg export and svg postprocessing like the export-graphs script. In contrast to it it then does not immediately write the svg somewhere but instead checks if the md5 hash is the same as the one in the csv exported by export-graphs. If there is no difference nothing further happens. If there is a difference it writes the svg with the difference to a file and outputs the id of the grapher to stdout. If there were any differences the return code is non-zero.

### How to use this all

Steps to do rarely (once a month or if important configs/data are updated/added):

-   The idea is to use dump-data to create an authorative data dump to be used by many verify runs. It should be done from a current production database if possible and is the only step that needs a database connection.

-   Then export-graphs should be run to create the reference svgs and the csv with the md5 hashes.

Steps to do on every PR etc:

-   Run verify-graphs to check if there are any differences to the reference export. You can use partitioning to run this only on a subset of graphs and you can run multiple verification processes in parallel to get better cpu/io utilization.

For all tools use the verbose flag if you want to see what the tool is doing, otherwise there is no output to stdout except for failing graph ids in the verify-graphs script for easy bash collection of failing graphs across multiple parallel verify-graphs runs
