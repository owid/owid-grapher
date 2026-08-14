# SVG Tester

This folder contains a set of tools to check the default svg output of all (or a subset of) graphers and mdims. The intended use is to easily check if a change you made to the grapher leads to any of the svg outputs to change (i.e. it tests all graphers svg output plus mdim views against a reference export). This is not perfect as it doesn't include any interaction but it's a nice sanity check to see if a change broke something.

## Overview

Initially you need to generate a data dump and a reference svg export that together comprises the reference set of inputs and outputs. This should then be regenerated periodically (e.g. monthly) from the production data or whenever important new data/config changes happen.

Whenever you want to check your current codebase's svg output you run the verify scripts that will compare the output with the reference set.

The SVG tester supports multiple test suites:

- **graphers**: Standalone grapher charts
- **grapher-views**: All possible chart configurations for each grapher (different tabs, etc.)
- **mdims**: Multi-dimensional data pages with multiple views
- **thumbnails**: Thumbnail versions of the most viewed graphers. For each chart, all available tabs are tested.

## Make a reference set of SVGs

### 1. Generate a reference dataset

Use `dump-data.ts` to dump configuration and data files. It needs a running grapher MySQL database. The script supports multiple test suites:

#### Graphers

For every public and published grapher (~4,500 at the time of writing), it writes one config file per chart, `{SVG_TESTER_REPO_PATH}/graphers/configs/{slug}.json`.

The data itself goes into `{SVG_TESTER_REPO_PATH}/variables/`, shared by every test suite:

- `{variableId}.data.json` - Data file for the variable
- `{variableId}.metadata.json` - Metadata file for the variable

**Careful with partial refreshes:** because the directory is shared, dumping a single suite rewrites variable files that the other suites also read, which can shift their reference SVGs even though you never touched them. `refresh.sh` dumps all four suites, so the normal path is safe; if you dump one suite by hand and see diffs somewhere unexpected, re-run the full refresh.

#### Grapher-views

For the most-viewed graphers (subset of all charts), creates a manifest file listing which charts to test. The actual data is read from the graphers suite.

**Important:** For the grapher-views test suite, the manifest is **required by default**. When you run export or verify, the scripts automatically load `top.manifest.json`. This prevents accidentally processing all ~4,000 charts with all view combinations. To override this behavior and process specific charts, explicitly use `--viewIds`.

#### Multi-dimensional views

For published multi-dimensional data pages, writes one config per view, named `{slug}?{queryStr}.json`. Those names carry the view's query string, so they are long (152 bytes at most today, against a 255-byte limit) and contain `?` and `&`, which means they need quoting in the shell and cannot be checked out on Windows:

```bash
yarn tsx devTools/svgTester/dump-data.ts mdims
```

**Note on compression:** We use uncompressed files because gzipped files have legacy headers that indicate the OS they were generated on, leading to mass git diffs when dumps are made on different systems.

#### Thumbnails

For the most-viewed graphers, creates a manifest file listing which charts to test. The actual data is read from the graphers suite. During SVG generation, all available tabs for each chart are rendered as thumbnails.

**Important:** For the thumbnails test suite, the manifest is **required by default**. When you run export or verify without `--viewIds`, the scripts automatically load `top.manifest.json`. This prevents accidentally processing all ~4,000 charts.

### 2. Generate reference SVGs

Use `export-graphs.ts` to generate reference SVG exports. The script uses parallel processing (workerpools) for efficient handling of large numbers of charts. For each item, it:

- Loads the config and data
- Initializes a grapher instance
- Generates SVG output
- Processes the SVG to remove non-deterministic elements
- Calculates an MD5 checksum
- Saves the SVG to a file
- Writes a CSV file containing MD5 hashes for verification

The script works with test suites stored in the directory structure:

```
{SVG_TESTER_REPO_PATH}/variables/              # Variable data, shared by all suites
{SVG_TESTER_REPO_PATH}/{testSuite}/configs/    # Chart configs (from dump-data.ts)
{SVG_TESTER_REPO_PATH}/{testSuite}/references/ # Output SVG references
```

This script does NOT require database access - it uses the dumped data files from `dump-data.ts`.

## Check against reference SVGs

Use `verify-graphs.ts` to check SVG outputs against the reference export. The script uses parallel processing (workerpools) for efficient verification. For each item, it:

- Loads the config and data
- Initializes a grapher instance
- Generates SVG output
- Processes the SVG to remove non-deterministic elements
- Compares the MD5 hash with the reference
- If there's a difference, saves the new SVG to the differences directory
- Writes `verify-results.json` recording the outcome: status, counts, which views differed and which errored
- Rewrites that file every 5 seconds while it runs, so the admin report can follow along: `status` stays `running`, `counts.total` is the whole run and `ok + differences + errors` is how far it has got, and `updatedAt` is a heartbeat — if it stops moving, so did the run
- Logs counts only — which views differed is in `verify-results.json`, the `differences/` directory, and the admin report at `/admin/svgtester/<suite>`
- Exits 0 when everything matched, 2 when it found differences, and 1 if the tester itself malfunctioned (a render crashed, a reference was missing, a job timed out)

The script works with test suites stored in the directory structure:

```
{SVG_TESTER_REPO_PATH}/variables/               # Variable data, shared by all suites
{SVG_TESTER_REPO_PATH}/{testSuite}/configs/     # Chart configs (from dump-data.ts)
{SVG_TESTER_REPO_PATH}/{testSuite}/references/  # Reference SVGs (from export-graphs.ts)
{SVG_TESTER_REPO_PATH}/{testSuite}/differences/ # Output differences (if any)
```

This script does NOT require database access - it uses the dumped data files from `dump-data.ts`.

## Convenience Commands

For common workflows, you can use the Makefile targets:

### Quick verification against references

```bash
make svgtest
```

This command:

1. Resets `../owid-grapher-svgs` to `origin/master`
2. Runs `verify-graphs.ts` against the reference SVGs
3. Reports how many views differed; inspect them at `/admin/svgtester/graphers` in the admin

### Run all test suites

```bash
make svgtest.full
```

This command:

1. Resets `../owid-grapher-svgs` to `origin/master`
2. Runs `verify-graphs.ts` for all test suites (graphers, grapher-views, mdims, thumbnails)
3. Reports how many views differed per suite; inspect them at `/admin/svgtester/<suite>` in the admin

### Resync the reference md5 index

```bash
make svgtest.md5s
```

`references/results.csv` indexes each reference SVG by md5, and verify uses it as a
fast path: equal hash means no difference, skip reading the file. If reference SVGs
are ever replaced without the CSV being rewritten, the index describes the previous
references and the fast path stops working. This recomputes the column from the
files on disk for all four suites; re-running it is a no-op. CI does this
automatically whenever it commits new references.

## Refreshing Reference Data

To generate a fresh reference dataset from production data, use the `refresh.sh` script:

```bash
# First ensure the database has the latest data
make refresh.full    # Refresh the database and analytics from production

# Then run the refresh script
./devTools/svgTester/refresh.sh
```

The `refresh.sh` script will:

1. Reset `../owid-grapher-svgs` to `origin/master`
2. For each test suite (graphers, grapher-views, mdims, thumbnails):
    - Dump configs and data using `dump-data.ts`
    - Commit the configs and data
    - Generate reference SVGs using `export-graphs.ts`
    - Commit the reference SVGs

**Manual alternative:** If you want to refresh only specific test suites or have more control:

```bash
# Dump configs and data for a specific test suite
yarn tsx devTools/svgTester/dump-data.ts mdims

# Generate reference SVGs
yarn tsx devTools/svgTester/export-graphs.ts mdims

# Commit the changes to the owid-grapher-svgs repository
cd ../owid-grapher-svgs
git add --all
git commit -m "chore: update reference data"
```

This should be done periodically (e.g., monthly) or when significant data/config changes occur.
