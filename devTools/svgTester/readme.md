# SVG Tester

This folder contains a set of tools to check the default svg output of all (or a subset of) graphers, mdims and explorers. The intended use is to easily check if a change you made to the grapher leads to any of the svg outputs to change (i.e. it tests all graphers svg output plus mdim and explorer views against a reference export). This is not perfect as it doesn't include any interaction but it's a nice sanity check to see if a change broke something.

## Overview

Initially you need to generate a data dump and a reference svg export that together comprises the reference set of inputs and outputs. This should then be regenerated periodically (e.g. monthly) from the production data or whenever important new data/config changes happen.

Whenever you want to check your current codebase's svg output you run the verify scripts that will compare the output with the reference set.

The SVG tester supports multiple test suites:

- **graphers**: Standalone grapher charts
- **grapher-views**: All possible chart configurations for each grapher (different tabs, etc.)
- **mdims**: Multi-dimensional data pages with multiple views
- **explorers**: Interactive data explorers. Both indicator-based and CSV-based (FromColumnSlugs) explorers are tested. Grapher ID-based explorers are skipped since they're already covered by the grapher tests.

## Make a reference set of SVGs

### 1. Generate a reference dataset

Use `dump-data.ts` to dump configuration and data files. It needs a running grapher MySQL database. The script supports multiple test suites:

#### Graphers

For every public and published grapher (~4,5000 at the time of writing), it creates one subdirectory with the grapher ID as the directory name containing:

- `config.json` - The grapher's JSON configuration
- `{variableId}.data.json` - Data file for each variable used in the grapher
- `{variableId}.metadata.json` - Metadata file for each variable used in the grapher

#### Multi-dimensional views

For published multi-dimensional data pages, creates subdirectories named `{slug}?{queryStr}` containing config and data for each view:

```bash
yarn tsx devTools/svgTester/dump-data.ts mdims
```

#### Explorers

For every published explorer, creates one subdirectory named after the explorer slug in the `explorers` test suite directory containing:

- `config.tsv` - The explorer's TSV configuration with URLs replaced by local file paths
- For **indicator-based explorers**: `{variableId}.data.json`, `{variableId}.metadata.json`, and `{variableId}.config.json` files for each variable referenced in the explorer
- For **CSV-based explorers**: CSV files are downloaded and saved as `{tableSlug}.csv`

The script automatically resolves catalog paths to indicator IDs and replaces remote URLs in the explorer tsv config with local file paths to the dumped data.

```bash
# Dump all published explorer configs and data
yarn tsx devTools/svgTester/dump-data.ts explorers
```

**Note on compression:** We use uncompressed files because gzipped files have legacy headers that indicate the OS they were generated on, leading to mass git diffs when dumps are made on different systems.

### 2. Generate reference SVGs

Use `export-graphs.ts` to generate reference SVG exports. The script uses parallel processing (workerpools) for efficient handling of large numbers of charts and explorers. For each item, it:

- Loads the config and data
- Initializes a grapher or explorer instance
- Generates SVG output
- Processes the SVG to remove non-deterministic elements
- Calculates an MD5 checksum
- Saves the SVG to a file
- Writes a CSV file containing MD5 hashes for verification

The script works with test suites stored in the directory structure:

```
{SVG_REPO_PATH}/{testSuite}/data/       # Input data (from dump-data.ts)
{SVG_REPO_PATH}/{testSuite}/references/ # Output SVG references
```

This script does NOT require database access - it uses the dumped data files from `dump-data.ts`.

## Check against reference SVGs

Use `verify-graphs.ts` to check SVG outputs against the reference export. The script uses parallel processing (workerpools) for efficient verification. For each item, it:

- Loads the config and data
- Initializes a grapher or explorer instance
- Generates SVG output
- Processes the SVG to remove non-deterministic elements
- Compares the MD5 hash with the reference
- If there's a difference, saves the new SVG to the differences directory and reports it
- Returns a non-zero exit code if any differences are found

The script works with test suites stored in the directory structure:

```
{SVG_REPO_PATH}/{testSuite}/data/        # Input data (from dump-data.ts)
{SVG_REPO_PATH}/{testSuite}/references/  # Reference SVGs (from export-graphs.ts)
{SVG_REPO_PATH}/{testSuite}/differences/ # Output differences (if any)
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
3. If there are differences, generates an HTML comparison report using `create-compare-view.ts`

### Generate full test report with all test suites

```bash
make svgtest.full
```

This command:

1. Resets `../owid-grapher-svgs` to `origin/master`
2. Runs `export-graphs.ts` for all test suites (graphers, grapher-views, mdims, explorers)
3. Generates HTML comparison reports for each test suite

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
2. For each test suite (graphers, grapher-views, mdims, explorers):
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

## Notes

For all tools use the verbose flag if you want to see what the tool is doing, otherwise there is no output to stdout except for failing graph ids in the verify-graphs script for easy bash collection of failing graphs.
