# Local Docker Setup

This is intended as a full clean docker setup instruction set.

It is aimed at people coming to the project who may be using machines from previous projects - in my own case, the machine I am using was last used to do contract work and that had left a couple of containers active which seems to be causing the problems that people have been seeing.

# Steps

* Stop everything in Docker for Desktop - all containers, images, volumes and builds
* Close/quit that software
* $ `docker stop $(docker ps -a -q)` <-- stop everything in the command line [1]
* $ `docker rm $(docker ps -a -q)` <-- remove everything in the command line [1]
* Remove owid directories 
* Restart machine
* `vim ~/.docker/config.json` and change `credsStore` into `credStore` if you need to
* Restart Docker for Desktop
* Re-clone owid
* `cd owid-grapher`
* Follow [the setup instructions](https://github.com/toni-sharpe/owid-grapher/blob/docker-for-3rd-party-contributors/docs/docker-compose-mysql.md#starting-our-development-environment)
* Go to Docker Desktop and make sure the container `db-load-data-1` has been started, it's nested under `owid-grapher` and has a play button ready to press. It will also exit once done
* Follow [the DB instructions](https://github.com/toni-sharpe/owid-grapher/blob/docker-for-3rd-party-contributors/docs/docker-compose-mysql.md#inspecting-the-databases). There's also a [Troubleshooting section](https://github.com/toni-sharpe/owid-grapher/blob/docker-for-3rd-party-contributors/docs/docker-compose-mysql.md#troubleshooting) to checkout where some basics are mentioned, we do these things rarely, even the best of us forget to switch it on now and then.
* Run `yarn startAdminServer` in a separate window [credit](https://github.com/owid/owid-grapher/discussions/3122#discussioncomment-8200683).

# Expected Conclusion

The following is based on the state apr-2024, bear in mind the software screen-shots, UI styling, running containers etc. may have changed.

* note the message "All done, ..." is _not_ preceded by `A database with the name "grapher" already exists. exiting`.

# And when it crashes and you restart

Docker will persist!

* run `make up` in the Tmux screen
* `yarn startAdminServer` in the screen for that

## Docker [0]
```
db-load-data-1  | ==> ✅ Grapher DB refresh complete
db-load-data-1  | ++ echo '==> ✅ Grapher DB refresh complete'
db-load-data-1  | + return 0
db-load-data-1  | + echo '✅ All done, grapher DB is loaded ✅'
db-load-data-1  | ✅ All done, grapher DB is loaded ✅
db-load-data-1 exited with code 0
```

## Admin [1]

* Announces it's present then pings repeatedly.

```
Waiting for MySQL to come up.................................................................................................................
```

## Vite [2]

* Display ready messages and wait

```
Starting Vite in dev mode

  VITE v4.5.3  ready in 584 ms

  ➜  Local:   http://localhost:8090/
  ➜  Network: use --host to expose
  ➜  press h to show help
Browserslist: caniuse-lite is outdated. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme

[TypeScript] Found 0 errors. Watching for file changes.
```

## Lerna [3]

```
lerna notice cli v7.4.2                                                                                                                                         [0/0]
lerna notice filter including "@ourworldindata/*"
lerna info filter [ '@ourworldindata/*' ]
lerna info watch Executing command "lerna run build --scope=$LERNA_PACKAGE_NAME --include-dependents" on changes in 5 packages.
```

## Welcome [4]

```
                        _                                                                                                                                       [0/0]
                       | |
  __,  ,_    __,    _  | |     _   ,_
 /  | /  |  /  |  |/ \_|/ \   |/  /  |
 \_/|/   |_/\_/|_/|__/ |   |_/|__/   |_/
   /|            /|
   \|            \|

You are now running the grapher dev environment using tmux!

A quick tmux cheatsheet:
    <C-b>, 0       move to pane numbered 0
    <C-b>, n       make a new terminal pane
    <C-b>, R       restart a crashed pane
    <C-b>, X       kill and close a pane
    <C-b>, Q       close all panes and exit tmux

The first time you run this, it can take 5-15 mins to create the db. You
can watch its progress by switching to pane 0 (docker).

Try these URLs to see if your environment is working:

    http://localhost:3030/  <-- a basic version of Our World in Data
    http://localhost:3030/grapher/life-expectancy  <-- an example chart
    http://localhost:3030/admin/  <-- an admin interface, login with
                                      "admin@example.com" / "admin"
    http://localhost:3030/admin/test  <-- a list of all charts in the db
    http://localhost:8080/wp/wp-admin/  <-- the WordPress admin interface
    http://localhost:8090/  <-- the vite dev server
    http://localhost:8788/  <-- the cloudflare functions dev server

Happy hacking!
➜  owid-grapher git:(master)
```

Using just the port `:3030` URLs the site with DB is accessible and visiting [http://localhost:3030/admin/test](http://localhost:3030/admin/test) and doing things will reveal SQL appearing in the terminal where `yarn startAdminServer` was run. Note the [Knex tool](https://knexjs.org/) being used:

```
{
  method: 'select',
  options: {},
  timeout: false,
  cancelOnTimeout: false,
  bindings: [ 'Marimekko', 20 ],
  __knexQueryUid: 'i0CRlkWgkHyWLiQrouXAz',
  sql: 'select `id`, `slug` from `charts` where publishedAt IS NOT NULL and config->"$.type" = ? AND COALESCE(config->>"$.hasChartTab", "true") = "true" and COALESCE(config->>"$.hasChartTab", "true") = "true" order by `id` DESC limit ?'
}
```

# Screen shot examples

Below is a working example. Containers with finite life-spans, such as data loaders may need starting and may differ from the screen shots.

## Docker for Desktop state

* note: my containers are captured while the `db-load-data-1` container is running, I had to manually click this to get it started. It then ran as described elsewhere (for roughly 10 mins).

### Text description 

There are four screen-shots, showing Docker for Desktop screens for containers, images, volumes and builds in that order.

**Containers** shows a simple heirarchy, `owid-grapher` is the parent and two children, `db-1` and `db-load-data-1` can be seen. `db-1` reports that it is running and this should be indefinite. `db-load-data-1` should report it is running until it's data seeding task is complete then report "exited"

**Images** shows `owid-grapher-db-load-data` and `mysql/mysql-server` both reporting they are "in use".

**Volumes** shows `owid-grapher_mysql_data_public`, reporting it is "in use".

**Builds** shows `mysql-init-docker` and that it is completed with a green tick indicating success.

### Screen shots

![Screenshot 2024-04-21 at 00 35 07](https://github.com/owid/owid-grapher/assets/10499070/8c7df1ba-3216-465e-949f-bc5ca5e7b0a4)
![Screenshot 2024-04-21 at 00 35 15](https://github.com/owid/owid-grapher/assets/10499070/173ab0c4-cd98-4574-9644-00e4163739f3)
![Screenshot 2024-04-21 at 00 35 37](https://github.com/owid/owid-grapher/assets/10499070/e2cb9480-b245-4660-9bf9-3ae51523eb3a)
![Screenshot 2024-04-21 at 00 35 46](https://github.com/owid/owid-grapher/assets/10499070/a5460bc7-8d45-4248-9de2-9b5e559ada62)

## DBeaver state

The screenshot shows the successful access to the database including `localhost` and port `3307`. The hierarchy is open to show Databases, `grapher` then Tables and other standard database tools and options are shown too. In the right panel, the selected table `datasets` is displayed. This is all standard RDBS UI layout and functionality.

![Screenshot 2024-04-21 at 01 39 43](https://github.com/toni-sharpe/owid-grapher/assets/10499070/f5e948a3-f60e-4299-bd97-399f0196a011)

## TMux

* note: this is just an image of the section "Expected Conclusion" above.

![image](https://github.com/toni-sharpe/owid-grapher/assets/10499070/2b5c03be-5456-4e7a-9d9b-b5ca91f1d4c8)
