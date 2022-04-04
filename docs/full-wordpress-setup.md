# Full wordpress setup

This page describes how to get the full setup of our site running locally including wordpress (and thus also allowing running the baking etc). Note that this setup requires pullung a database dump from our live server which only OWID staff can do. This setup thus only works for OWID staff.

This setup is very similar to the [Local setup with MySQL and grapher admin](docker-compose-mysql.md). Go to that document and make sure that the prerequisites are met.

## Running the full setup

One quick thing to check is if you are already running MySQL on your computer at port 3306 and if so to stop this service while running the Docker setup. Our Docker based setup tries to expose the MySQL Docker container at port 3306 of your computer for easy interaction with other tools (e.g. a SQL editor). If this port is already taken then starting this container will fail.

All you need to do now is to open a terminal and run

```bash
make up.full
```

The full setup includes an nginx server exposed at http://localhost:8080 that does some basic routing (/admin goes to the grapher admin running on your host, /wp/ goes to the php container running wordpress).

The most important URLs:
http://localhost:8080/admin - the grapher admin
http://localhost:8080/wp/wp-admin - the wordpress admin

Note that in the MySQL database that was set up, the `data_values` table will be incomplete – it will only contain data used in charts. In production, this table is >30GB (uncompressed) and contains unreviewed and undocumented data, so we currently don't offer a full export of it.
