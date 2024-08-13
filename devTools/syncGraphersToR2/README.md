# syncGraphersToR2

This script, `syncGraphersToR2.ts`, is used to sync grapher configurations from the `chart_configs` table to R2 storage. It supports different commands to perform specific tasks.

## Available Commands

-   `sync`: Sync all grapher configs from the DB to R2 buckets, both upserting into R2 and deleting obsolete ones from R2. This command is useful for production if the R2 storage should get out of sync with the database and/or to initially fill R2. It can't be used to fill local development R2 buckets.
-   `store-dev-by-slug`: Fetch a grapher config by slug from the `chart_configs` table and store it in the local dev R2 storage. This is useful for your local dev environment when you want to test the CF Pages Functions that need R2 files to exist. CF Pages Functions using R2 bindings can (as of 2024-08-13) not access real remote R2 buckets.

## Usage

To run the script, use the following command:

```sh
yarn syncGraphersToR2 [command] [options]
```

Options
--dry-run: Don't make any actual changes to R2.
