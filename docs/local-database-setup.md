# Local database setup.

If you want to develop on your local system without any docker containers then you'll need to set up mysql on your host OS and run the steps below.

### Remove the password

Remove the password for root by opening the MySQL shell with `mysql` and running:

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
```

We do this for convenience so we can run `mysql` commands without providing a password each time. You can also set a password, just make sure you include it in your `.env` file later.

### Import the latest data extract

Daily exports from the live OWID database are published here and can be used for testing:

| File                                                                            | Description                                                   | Size (compressed) |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------- |
| [owid_metadata.sql.gz](https://files.ourworldindata.org/owid_metadata.sql.gz)   | Table structure and metadata, everything except `data_values` | ~15 MB            |
| [owid_chartdata.sql.gz](https://files.ourworldindata.org/owid_chartdata.sql.gz) | All data values used by published visualizations              | >200MB            |

This script will create a database, then download and import all OWID charts and their data (might take a while!):

```bash
./db/downloadAndCreateDatabase.sh
```

Note that the `data_values` table will be incomplete – it will only contain data used in charts. In production, this table is >20GB (uncompressed) and contains unreviewed and undocumented data, so we currently don't offer a full export of it.

### Inspecting the database

On macOS, we recommend using [Sequel Ace](https://github.com/Sequel-Ace/Sequel-Ace) (it's free). [DBeaver](https://dbeaver.io/) is also free, works well also and is available on more operating systems.

We also have [**a rough sketch of the schema**](https://user-images.githubusercontent.com/1308115/64631358-d920e680-d3ee-11e9-90a7-b45d942a7259.png) as it was on November 2019 (there may be slight changes).
