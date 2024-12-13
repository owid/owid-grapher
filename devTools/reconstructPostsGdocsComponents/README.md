This script synchronizes the chart configs in the chart_configs table into the R2 bucket. The R2 bucket information is taken from the server settings, i.e. they come from the .env file.

Your R2 access key needs permission to access the right bucket (`owid-grapher-configs-staging`) and the following .env settings should be set for the sync script to work :

```
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
GRAPHER_CONFIG_R2_BUCKET
GRAPHER_CONFIG_R2_BUCKET_PATH
```
