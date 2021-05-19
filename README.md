# owid-grapher

[![Actions Status](https://github.com/owid/owid-grapher/workflows/Continuous%20Integration/badge.svg)](https://github.com/owid/owid-grapher/actions)
[![Test coverage](https://owid.github.io/badges/coverage.svg)](https://owid.github.io/coverage/)
[![Storybook](https://raw.githubusercontent.com/storybookjs/brand/master/badge/badge-storybook.svg)](https://owid.github.io/stories/)

This is the project we use at the University of Oxford to create embeddable visualizations for [Our World in Data](https://ourworldindata.org). It's not currently designed for immediate reuse as a full library, but you are very welcome to adapt any of our code or to send pull requests.

An example of what this can make (click for interactive):

[![Life expectancy at birth](https://ourworldindata.org/grapher/exports/life-expectancy.svg)](https://ourworldindata.org/grapher/life-expectancy)

The owid-grapher visualization frontend code can run isomorphically under node to render data directly to an SVG string, which is how the above image works!

### Overview of this repository

[The Grapher](grapher/) is the central visualization component that displays data interactively (almost every interactive chart on [Our World in Data](https://ourworldindata.org) uses this). It can fetch data either encoded as a JSON file or is sometimes also used with JSON embedded in the HTML document for faster loading. Every grapher needs one JSON config file that configures it.

The [Grapher Admin](adminSiteServer/) is both a server side and client side typescript project that allows interactive configuration of graphers and manages the MySQL database that stores all the data for all grapher instances. The data model is roughly: one variable is a series of observations of 4-tuples of [`variable id`, `entity` (e.g. country), `time point` (e.g. year), `data value`].Several variables are grouped together into one data set. Datasets can be grouped into namespaces which is usually done for groups of datasets that are bulk imported from a specific upstream provider like the World Bank.

The [Wordpress admin](wordpress/) is used by authors to write the content published on [Our World in Data](https://ourworldindata.org). It is a relatively stock setup including a custom plugin to provide additional blocks for the editor. The Wordpress content and configuration is stored in a MySQL database.

The [baker](baker/) is the tool that is used to build the static [Our World in Data](https://ourworldindata.org) website by merging the content authored in the headless Wordpress admin with the graphers.

[Explorers](explorer/) are a relatively new addition that visually show some chrome for data selection and one grapher at a time. Under the hood this uses the Grapher and manages configuration and data fetching based on the selection of variables to show. There is an [admin](explorerAdmin/) to configure explorers. The config files end up in [a git repo](https://github.com/owid/owid-content/tree/master/explorers).

## Development

### Full stack (OWID staff only)

Instructions are for MacOS, please adapt for your platform.

1. Install Homebrew first, follow the instructions here: <https://brew.sh/>

2. Install nvm:

    ```sh
    brew update
    brew install nvm
    source $(brew --prefix nvm)/nvm.sh
    ```

3. Install Node 12.13.1+:

    ```sh
    nvm install 12.13.1
    ```

4. Install lando:

    ```sh
    brew install lando
    ```

    For other platforms: https://docs.lando.dev/basics/installation.html

5. Submit your ssh public key:

    Generate an SSH keypair and submit your key to existing developers for access to production servers. This will be used
    to pull a database snapshot.

6. Spin up the environment:

   You now have everything you need! You can spin up your environment with:

    ```sh
    make start
    ```

    This will leave you with a partial DB import, background services running (nginx, MySQL) and foreground services (admin, webpack) in tmux.

Once your server is running, head to `localhost:3030/admin`. If everything is going to plan, you should see a login screen! The default user account is `admin@example.com` with a password of `admin`.

To shut down your server, kill the foreground services, then run:

```sh
make stop
```

To fully clean up your environment, run:

```sh
make destroy
```

### Grapher only (general public)

These instructions are a little experimental, please give us feedback if they don't work for you:

1. Install node 12.13.1 and yarn
2. Install MySQL 5.7 and configure credentials
3. Make a `.env` file with MySQL credentials for grapher (copy `.env.example`)
4. Run `make import-grapher` (you may need to edit db credentials in `./db/downloadAndCreateDatabase.sh`, or remove your MySQL root password temporarily)
5. Run `yarn startAdminServer`

You should then be able to browse to http://localhost:3030/admin/charts

### Other platforms

You will need: [MySQL 5.7](https://www.mysql.com/), [Node 12.13.1+](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/en/). Running `yarn` in the repo root will grab the remaining dependencies.

### Inspecting the database

- Command-line: `make mysql`
- MacOS: [Sequel Ace](https://apps.apple.com/us/app/sequel-ace/id1518036000?mt=12) is our recommended free client

We also have [**a rough sketch of the schema**](https://user-images.githubusercontent.com/1308115/64631358-d920e680-d3ee-11e9-90a7-b45d942a7259.png) as it was on November 2019 (there may be slight changes).

This development server will rebuild the site upon changes, so you can just make changes to the code, and reload the browser to see the changes.

## Architecture notes

Our implementation is based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using [React](https://reactjs.org/) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do client-side data processing efficiently. New code should be written in [TypeScript](https://www.typescriptlang.org/). [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

## package.json style guide

We follow some conventions:

1. **camelCase the command names**. This ensures that these command names are also valid identifiers and consistent with our TypeScript code.
2. **Use longer unique names like `buildSiteCss` instead of `style`**. We have to rely on global string matches for finding uses in code, making them unique helps.
3. Identify what "kind" of command your script is and choose an existing decorator, unless it's of a new kind. Think of the "build" and "start" prefixes as function decorators and choose an appropriate one. For example, if your script starts a long lived process, it should be named something like `startXXXServer`; if it generates output to disk, something like `buildXXX`.

## Why did we start this project?

The following is an excerpt explaining the origin of this repo and what the alternatives tried were (source: [Max Roser's Reddit AMA on Oct 17, 2017](https://www.reddit.com/r/dataisbeautiful/comments/76yknx/hi_reddit_i_am_max_roser_founder_of_the_online/doicj1j?utm_source=share&utm_medium=web2x&context=3))

> We built the Grapher because there is no similar external tool available. Datawrapper, Tableau, Plotly, various libraries based on d3 are out there but nothing is similar to what the Grapher does for our project.
>
> Before we developed this tool, we built interactive web visualizations by hand through a difficult process of preparing individual spreadsheets of data and then writing custom HTML and JavaScript code to process the contents for each individual visualization. That was pretty painful and it took me hours sometimes to built a chart.
>
> The owid-grapher solves this problem by using a single visualization codebase and crucially a single database into which all of our data is placed. Once the data has been imported, the process of creating a visualization is reduced to simply choosing what kind of visualization is needed and then selecting the relevant variables in the Grapher user interface. The result may then be customized, and is published to the web with the press of a button.
>
> Using our own system has very important advantages:
>
> -   **Integration with our global development database**: Our database of global development metrics is integrated into our visualization tool so that when we add and update empirical data the visualizations are all updated. (In contrast to this, a pre-existing tool would make the exploration of a database impossible and would require the preparation of each dataset separately for each visualisation.)
>
> -   **Flexibility**: We can use automation to change our entire system all at once. For example, if we decide we want to use a different source referencing style, we could easily update this across hundreds of charts. This makes it possible to scale our publication and to sustainably improve our work without starting from scratch at each round.
>
> -   **Risk mitigation**: We hope(!) that Our World in Data is a long-term project and we want the visualizations we produce to continue to be useful and available years from now. An external web service may be shut down or change for reasons we cannot control. We have had this experience in the past and learned our lesson from it.
>
> -   **Keeping everything up-to-date**: Because we want to be a useful resource for some time we make sure that we have a technology in place that allows us to keep all of our work up-to-date without starting from scratch each time. We have our global development database directly integrated in the Grapher and as soon as new data becomes available (for example from a UN agency) we can run a script that pulls in that data and updates all the visualizations that present that data.

---

Cross-browser testing provided by <a href="https://www.browserstack.com"><img src="https://3fxtqy18kygf3on3bu39kh93-wpengine.netdna-ssl.com/wp-content/themes/browserstack/img/bs-logo.svg" /> BrowserStack</a>
