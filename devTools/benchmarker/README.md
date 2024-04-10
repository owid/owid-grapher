A simple benchmarking utility (elbow grease required)

## Using this tool

1. Add this project to the tsconfig of the project you would like to benchmark e.g. the [baker](baker/tsconfig.json)
2. Import the Benchmarker class somewhere into that project and instantiate it
3. Create if-blocks around sections of code you would like to benchmark e.g. `if (benchmark.flags.validateGdoc) {  await this.validateGdoc()}` and the benchmarker tool will automatically add it to the list of flags to permutate through
4. Call `benchmarker.benchmark` with `{name, callback}` where `name` is a string and `callback` is the function that will call the code you're testing (all the references to `benchmark.flags` must be included in the callstack of this callback)
5. Run `yarn buildTsc` to build your code with the benchmarker
6. Run `node itsJustJavascript/path/to/benchmark/entry/point.js` and wait for the permutations to run
7. Review the results in `devTools/benchmarker/results`
