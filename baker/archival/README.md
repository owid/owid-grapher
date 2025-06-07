# Archiving content

The code in this directory is used to archive some of our content, powering https://archive.ourworldindata.org.

## Archived assets

The below diagram contains all the various pages and assets that are created/updated as part of each archival build.

```mermaid
flowchart TD
 subgraph static["Static assets"]
        assets["JS & CSS files<br><br><code>/assets/owid.HASH.mjs</code><br><code>/assets/owid.HASH.css</code>"]
  end
 subgraph runtime["Runtime assets"]
        configs["Mdim grapher configs<br><br><code>/grapher/by-uuid/UUID.HASH.config.json</code>"]
        vars["Variable data &amp; metadata files<br><br><code>/api/v1/indicators/VARID.HASH.data.json</code><br><code>/api/v1/indicators/VARID.HASH.metadata.json</code>"]
        dods["Details on demand<br><br><code>/assets/dods.HASH.json</code>"]
        versions["Versions files<br><br><code>/versions/charts/CHARTID.json</code>"]
  end
  subgraph other["Other files"]
    manifests["Archived grapher page<br><br><code>/DATE-TIME/grapher/SLUG.manifest.json</code><br><code>/latest/grapher/SLUG.manifest.json</code>"]
  end
    page["Archived grapher page<br><br><code>/DATE-TIME/grapher/SLUG.html</code><br><code>/latest/grapher/SLUG.html</code>"]
    page -- bakes into HTML --> static
    page -- loads at runtime --> runtime
    page ~~~ other
```

Legend:

- all routes are relative to origin, i.e. `/api/v1/indicators` would be archive.ourworldindata.org/api/v1/indicators
- `UUID` is a chart config UUID, e.g. 019542db-2a01-77c3-9f7c-5dfd23e39454
- `VARID` is a variable ID, e.g. 953899
- `CHARTID` is a chart ID, e.g. 64
- `HASH` is always a content hash, i.e. it is a hash of the file content
    - in our case, it is the 10-character prefix of a sha256 hash in [base36 representation](https://en.wikipedia.org/wiki/Base36)
    - an example hash is `2e98tbpu0i`
- `DATE-TIME` is a UTC date string in the format `YYYYMMDD-HHmmss`, e.g. `20250414-074331`
- `SLUG` is a grapher slug, e.g. `life-expectancy`

### Description of assets

- Static assets are those where the path _only_ needs to be known at bake-time, but not at runtime. Those are the JS & CSS files, where we need to put the correct path into the `<script>` and `<link rel="stylesheet">` tags, so they can be loaded correctly.
    - In code, search for `staticAssetMap`.
- Runtime assets are those that are fetched dynamically somewhere in our code. This includes mdim grapher configs, variable files, and DoDs. It also includes a special kind of file only generated for archived pages, the version file.
    - Here, it's important that all calling sites in our code know that they need to alter their fetch requests to get the correct, archived runtime asset.
    - In code, search for `runtimeAssetMap` or `readFromAssetMap`.
- The special versions file contains all the archived versions for a single grapher chart. It is mainly used to power the "Go to next version" button in the archive navigation bar, which we need to resolve at runtime because we're not aware of the next version at bake time (because the next version doesn't exist yet at bake time).
    - The file is named after the chart id and not the chart slug such that we can also follow chart versions across slug changes.
- There's also a manifest file generated alongside every archived grapher. It is not used in code, but can be useful to find out information about the chart, the checksums of the various variables and grapher configs, and tracking down why a chart was re-archived, for example.
- There are archival pages both under `/DATE-TIME/grapher` and under `/latest/grapher`. `/latest` is special, because it contains the latest archived version of every chart that has ever been archived - even if the original chart has been deleted in the meantime.

### Asset maps

Asset maps are what's being used in code to know how to resolve an asset, for example a variable file. They look like this:

```json
{
    "541219.data.json": "/api/v1/indicators/541219.69npjw5u22.data.json",
    "541219.metadata.json": "/api/v1/indicators/541219.3ip7h74wix.metadata.json",
    "dods.json": "/assets/dods.25l08xug89.json"
}
```

## How changes are detected

Obviously, we only want to re-archive a page when its content has been changed in some way - and we also want detecting these changes to be as quick as possible.

We only **consider a grapher page changed** when one of these things happens:

- Its grapher config checksum has been updated (DB: `chart_configs.fullMd5`)
- At least one of its variables has been updated in some way (DB: `variables.dataChecksum` & `variables.metadataChecksum`)

We only **consider a multi-dimensional data page (mdim) changed** when one of these things happens:

- Its multi-dim config checksum has been updated (DB: `multi_dim_data_pages.configMd5`)
- Any of its associated chart config checksums have been updated (DB: `chart_configs.fullMd5`)
- At least one of its variables has been updated in some way (DB: `variables.dataChecksum` & `variables.metadataChecksum`)

Every time the `archiveChangedPages` script is run, we fetch these checksums for each published grapher chart and multi-dim page, and generate a `hashOfInputs` hash. This hash combines all of these hashes for each page.
We then match these with the `archived_chart_versions` and `archived_multi_dim_versions` DB tables respectively, and find any hashes that are not present in those tables yet.
These pages are then the ones that will be re-archived.

The `archiveChangedPages` then takes care of re-archiving only the grapher pages and multi-dimensional data pages that have changed since the last archival run.

The script is run in Buildkite as part of every content deploy.

## Env variables

There are two env variables relevant to archiving:

- `ARCHIVE_BASE_URL`: This env var is used both in _live_ and in the _archive_ environment.
    - In _live_, when it is set, it will provide archived URLs in the citation blocks of data pages, and also in the embed modal.
    - In _archive_, it is used to determine the base URL of the archive, which are again used for citations, the embed modal, and for the "Copy link" button in grapher.
- `IS_ARCHIVE` should _only_ be set for the `archive` environment. It makes some links point to `https://ourworldindata.org` instead of them being relative, and it also enables the `REDUCE_TRACKING` env variable, which in turn disables Sentry and doesn't show the cookie notice.
    - The JS bundle that is going to be built should always be built with the `IS_ARCHIVE` flag set. This, in turn, also means that the archived JS bundle is going to be different from the live JS bundle.

## Staging servers

> [!NOTE]  
> The links in this section lead to a private repo, and are only accessible to the OWID team.

A staging server automatically creates and serves an archive, on port 8789.
This works as follows:

1. As part of the staging server build, [the `create-archive.sh` script](https://github.com/owid/ops/blob/cc00c3a4d91a5895e4a48bde51153f65bd0b9049/templates/owid-site-staging/create-archive.sh) is run.
2. It first truncates / empties the `archived_chart_versions` table.
    - This is done so we only link to archived pages for the few charts for which we actually create an archived version, see below.
3. It then runs Vite to build the JS assets needed for the archive.
4. Next, it runs the `yarn buildArchive` command _for just [a few, specified chart and multiDim IDs](https://github.com/owid/ops/blob/cc00c3a4d91a5895e4a48bde51153f65bd0b9049/templates/owid-site-staging/create-archive.sh#L9)_.
    - This is done to keep the staging server build time down.
    - These charts include one data page, one grapher page, and one multidimensional data page.
5. We run step (4) again once more, so we have a second copy of the archived pages, and can test both backward and forward navigation.
6. Lastly, after the staging server build is completed, we [serve the archive on port 8789](https://github.com/owid/ops/blob/cc00c3a4d91a5895e4a48bde51153f65bd0b9049/templates/owid-site-staging/serve-archive.sh).
    - We also link to archived pages from the auto-generated comment that `owidbot` puts on the PR.

## Providing citations

When `ARCHIVE_BASE_URL` is set, we provide information about the latest archived version (if any) to the data page / grapher page.

This information is of the type `ArchivedChartOrArchivePageMeta`, which can be one of two things:

- When in a normal (_live_) bake, this is going to be basic information about the last archived version, like its URL and date. The object has `{ type: "archived-page-version" }`.
- When in an archival bake, there is extended information relevant for rendering the archived page, like the previous archived version (for backwards navigation), and also the runtime and static asset maps. The object has `{ type: "archive-page" }`.
    - In this case, you can also conveniently access this information through the `window._OWID_ARCHIVE_INFO` variable.

This information is then used to compute the citation text, and in the latter case also for other considerations like the archive navigation bar.

## Other changes between live and archived pages

Aside from the behind-the-scenes changes, like how variables and other files are loaded, there are also a bunch of user-facing changes to (grapher pages and especially) data pages:

- A changed header, with reduced options (basically only the various OWID logos).
- An added archive navigation bar, which allows the user to navigate between the various archived versions of a page.
- Reduced data page content:
    - No "Explore charts that include this data" section
    - No "Related research and writing" section
    - No fallback image for the chart
    - No dynamic social media preview image
- A changed footer, with fewer options than the live footer.

## Deployment

The archive is built as part of every `deploy-content` step in Buildkite. This is done by running [the `deploy-archive` script](https://github.com/owid/owid-grapher/blob/f939ba985e4159f1dcd98d33802aae78a0c7b8a3/ops/buildkite/deploy-archive).
It runs Vite to build the JS assets, and then runs the `yarn buildArchive` command to create the archive.
After that, it sends the changed archive files to R2 (bucket `owid-archive`) using `rclone`.

### Append-only nature of the archive

Overall, the archive is essentially append-only. We don't delete any archived pages, any archived versions of a page, or any assets or variables that were ever created as part of an archive. This is important for the integrity of the archive, for the integrity of past citations, and to ensure that the JS code of past archived pages keeps working.
