# Local development setup with MySQL and the Grapher admin

This page describes how to set up a MySQL database loaded with example charts so you can use the Admin UI to visually create and edit charts.

![admin-ui](./screenshots/admin-ui.png)

## Prerequisites

This option uses `make` to spin up all the services with a single command, but it requires a few utilities to be installed:

-   [Docker](https://www.docker.com/get-started)
-   [Node.js and Yarn](./local-typescript-setup.md)
-   [tmux](https://github.com/tmux/tmux/wiki/Installing#binary-packages)
-   [MySQL client tools](https://dev.mysql.com/doc/refman/8.0/en/mysql.html) (install it e.g. via [this brew package](https://formulae.brew.sh/formula/mysql-client) on MacOS)

If you're using Windows, we recommend you use the Windows Subsystem for Linux, where you'll require some additional utilities. Please also make sure to check out the [before you start on windows guide](before-you-start-on-windows.md). To install the additional tools, run the following in a WSL terminal:

```bash
apt install -y build-essential finger
```

## Optional prequisites

If you want to work with the explorer admin then you need to clone the "owid-content" folder as a **sibling** to the owid-grapher. Note that this is not required just to create or edit single charts which is normally sufficient for development of new features or bug fixes.

```bash
git clone https://github.com/owid/owid-content
```

## Starting our development environment

Make a copy of `.env.example-grapher` for the server to configure itself with.

```bash
cp .env.example-grapher .env
```

Then run:

```bash
make up
```

This should fire up a tmux console with 5 tabs:

0. A _docker_ tab that outputs the Docker compose container logs
1. An _admin_ tab which shiows the DB connection
2. A _vite_ tab which shows TypeScript watch results
3. A _lerna_ tab
4. A _welcome_ tab that gives a brief overview of how to use this tmux setup - text details of the welcome tab can be found under the image

The first time you run this it will take a while to download and set up the database (10-20 minutes is expected). Switch to the database tab and wait until you see this message:

```
✅ All done, grapher DB is loaded ✅
```

## Visual and text output after successful run

<img width="634" alt="a graphical output the expected result of running these steps" src="https://github.com/owid/owid-grapher/assets/10499070/b38ff245-f0e1-4eea-a0de-47d28cec2a75">

### The image above includes the important options and notes

* 0: move to pane numbered O
* n: make a new terminal pane
* R: restart a crashed pane
* X: kill and close a pane
* l: close all panes and exit tmux
  
**Note** the first time you run this, it can take 5-15 mins to create the db. You can watch its progress by switching to pane 1 (admin).

### And the following URLs

* http://Localhost:3030/<-- a basic version of Our World in Data
* http://localhost:3030/grapher/life-expectancy-an example chart
* http://Localhost:3030/admin/ *- an admin interface, **login with** "admin@example.com" / "admin"
* http://localhost:3030/admin/test <-- a list of all charts in the db
* http://localhost:8080/wp/wp-admin/ <-- the WordPress admin interface
* http://Localhost:8090/ <-- the vite dev server
* http://localhost:8788/ <-- the cloudflare functions dev server

Now you can open [http://localhost:3030/admin/charts](http://localhost:3030/admin/charts) and start creating charts. Any changes to the TypeScript code you make will be automatically compiled, but you will have to refresh your page to see the changes.

## Inspecting the databases

For all operating systems, we recommend using [DBeaver](https://dbeaver.io/).

The MySQL server is exposed on port **3307** as opposed to port 3306 to avoid port conflicts with any local SQL clients you may have running.

Use this connection configuration:
| key | value |
|---|---|
| host | `localhost` |
| port | `3307` |
| username | `root` |
| password | `weeniest-stretch-contaminate-gnarl` |

(The root development password is set in this [docker-compose file](https://github.com/owid/owid-grapher/blob/master/docker-compose.grapher.yml#L40))

We also have [a schema diagram for reference.](screenshots/er_diagram.png)

## Resetting your environment

If you've modified or broken your database and want to start over from scratch, you'll need to clear the docker volumes that the database persists on.

To do so, get their names

```bash
docker volume ls
```

and remove them with

```bash
docker volume rm volume_name
```

The names of the volumes should usually be something like `owid-grapher_mysql_data` and `owid-grapher_mysql_data_public`.

You can also remove your local copies of the database exports if you want to download the latest version. Skip this step if you want your database to be exactly the same as it was on your last setup.

```bash
rm tmp-downloads/*
```

With that done, the next time you run `make up`, the database files will be re-downloaded.

A new database will then be created (expect another 10-20 minutes.)

## Troubleshooting

-   For **MacOS** users: Ensure the Docker Desktop is installed and running. If you encounter the error `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?` then it's most likely that Docker is not running and you need to start (or restart) it
-   If you are blocked by a Docker session that won't delete then restart the machine, don't forget to start Docker for Desktop too.
-   If you see `error getting credentials - err: exec: "docker-credential-desktop": executable file not found in $PATH, out: ''` [see this forum answer](https://forums.docker.com/t/docker-credential-desktop-exe-executable-file-not-found-in-path-using-wsl2/100225/5) - `vim ~/.docker/config.json` then change `credsStore` into `credStore`.
