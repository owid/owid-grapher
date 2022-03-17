# Full wordpress setup

This page describes how to get the full setup of our site running locally including wordpress (and thus also allowing running the baking etc). Note that this setup requires pullung a database dump from our live server which only OWID staff can do. This setup thus only works for OWID staff.

This setup is very similar to the [Local setup with mysql and grapher admin](docker-compose-mysql.md). Go to that document and make sure that the prerequisites are met. Then there are two additional setup steps before you can run `make up-full` to get a setup running with wordpress included.

## Additional prequisites

1. Clone the "owid-content" folder as a **sibling** to the owid-grapher. This is required so that you can use the explorer admin features (i.e. most operations also work if this step is skipped)

    ```bash
    git clone https://github.com/owid/owid-content
    ```

2. Download the wordpress database dump and (optionally) pull the wordpress file uploads by running the two scripts below from a terminal at the root of this repository.

    ```bash
    ./devTools/docker/download-wordpress-mysql.sh
    ./devTools/docker/download-wordpress-uploads.sh
    ```

## Running the full setup

All you need to do now is to open a terminal and run

```bash
make up.full
```

The full setup includes an nginx server exposed at http://localhost:8080 that does some basic routing (/admin goes to the grapher admin running on your host, /wp/ goes to the php container running wordpress).

The most important URLs:
http://localhost:8080/admin - the grapher admin
http://localhost:8080/wp/wp-admin - the wordpress admin

Note that in the MySQL database that was set up, the `data_values` table will be incomplete – it will only contain data used in charts. In production, this table is >30GB (uncompressed) and contains unreviewed and undocumented data, so we currently don't offer a full export of it.
