# owid-grapher

[![Actions Status](https://github.com/owid/owid-grapher/workflows/Continuous%20Integration/badge.svg)](https://github.com/owid/owid-grapher/actions)
[![Netlify Status](https://api.netlify.com/api/v1/badges/4ab2047d-8fa1-4f00-b91d-cb3dcd0df113/deploy-status)](https://app.netlify.com/sites/owid/deploys)
[![Test coverage](https://owid.github.io/badges/coverage.svg)](https://owid.github.io/coverage/)
[![Storybook](https://raw.githubusercontent.com/storybookjs/brand/master/badge/badge-storybook.svg)](https://owid.github.io/stories/)

This is the project we use at the University of Oxford to create embeddable visualizations for [Our World in Data](https://ourworldindata.org). It's not currently designed for immediate reuse as a full library, but you are very welcome to adapt any of our code or to send pull requests.

An example of what this can make (click for interactive):

[![Life expectancy at birth](https://ourworldindata.org/grapher/exports/life-expectancy.svg)](https://ourworldindata.org/grapher/life-expectancy)

The owid-grapher visualization frontend code can run isomorphically under node to render data directly to an SVG string, which is how the above image works!

## Initial development setup

### macOS

1. Install Homebrew first, follow the instructions here: <https://brew.sh/>

2. Install Homebrew services:

    ```sh
    brew tap homebrew/services
    ```

3. Install nvm:

    ```sh
    brew update
    brew install nvm
    source $(brew --prefix nvm)/nvm.sh
    ```

4. Install Node 12.13.1+:

    ```sh
    nvm install 12.13.1
    ```

5. Install MySQL 5.7:

    ```sh
    brew install mysql@5.7
    ```

6. Start the MySQL service:

    ```sh
    brew services start mysql@5.7
    ```

7. Install yarn:

    ```sh
    npm install -g yarn
    ```

8. Git clone the "owid-content" folder as a sibling to owid-grapher:

    ```bash
    git clone https://github.com/owid/owid-content
    ```

9. Inside the repo folder, install all dependencies by running:

    ```sh
    yarn
    ```

### Other platforms

You will need: [MySQL 5.7](https://www.mysql.com/), [Node 12.13.1+](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/en/). Running `yarn` in the repo root will grab the remaining dependencies.

## Database setup

### Remove the password

Remove the password for root by opening the MySQL shell with `mysql` and running:

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY ''
```

We do this for convenience so we can run `mysql` commands without providing a password each time. You can also set a password, just make sure you include it in your settings file later.

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

Since the full `data_values` table (including everything we haven't visualized yet) is really big (>10GB uncompressed), we don't currently have an export for it. If you'd like a copy please [contact us](mailto:tech@ourworldindata.org).

### Inspecting the database

On macOS, we recommend using [Sequel Pro](http://www.sequelpro.com/) (it's free).

We also have [**a rough sketch of the schema**](https://user-images.githubusercontent.com/1308115/64631358-d920e680-d3ee-11e9-90a7-b45d942a7259.png) as it was on November 2019 (there may be slight changes).

## Development server

Setup your settings file.

Finally, run `yarn startAdminServer` and head to `localhost:3030/admin`. If everything is going to plan, you should see a login screen! The default user account is "admin@example.com" with a password of "admin".

This development server will rebuild and live-reload the site upon changes, so you can just make changes to the code, save the file and see the result in the browser right away.

## Architecture notes

owid-grapher is based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using [React](https://reactjs.org/) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do client-side data processing efficiently. New code should be written in [TypeScript](https://www.typescriptlang.org/). [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

The OWID tech stack has evolved over time as we've found different ways to solve our problems. We're happy with the combination of React + Mobx + TypeScript + node and expect to be using these core tools for the foreseeable future. The MySQL database and data structure however is much older and we're interested in exploring alternatives that might allow us to work with large amounts of data more quickly and with more flexibility.

---

Cross-browser testing provided by <a href="https://www.browserstack.com"><img src="https://3fxtqy18kygf3on3bu39kh93-wpengine.netdna-ssl.com/wp-content/themes/browserstack/img/bs-logo.svg" /> BrowserStack</a>

## Recommended Dev Tools

Everyone use VS Code and it seems the key extensions are:

-   ESLint
-   Prettier
-   GitLens

Additionally, here are some other tools people like:

Novelty/Fun to try:

-   breck: SandDance, Rainbow CSV

Other Recommended apps:

-   breck: Sublime Merge 2, Sublime Text 3, tldr, tmux

## Package.json style guide

Like most Javascript projects, we currently have dozens of scripts in `package.json`. Untyped javascript strings are not the ideal programming language, but for now we can make do like everyone else. Until we move those commands to a language that provides better typing and organization, here are some suggested conventions:

1. camelCase the command names. This ensures that these command names are also valid identifiers in TypeScript and will allow us to do cool things later on when we strengthen the typings.
2. Use longer unique names like "buildSiteCss" instead of "style". With untyped languages we have to rely on global string matches for finding uses, so command names should be unique.
3. Identify what "kind" of command your script is and choose an existing decorator, unless it's of a new kind. Think of the "build" and "start" prefixes as function decorators and choose an appropriate one. For example, if your script starts a long lived process, it should be named something like "startXXXServer"; if it generates output to disk, something like "buildXXX".

## Alternatives Considered

The following is an excerpt explaining the origin of this repo and what the alternatives tried were (source: https://www.reddit.com/r/dataisbeautiful/comments/76yknx/hi_reddit_i_am_max_roser_founder_of_the_online/doicj1j?utm_source=share&utm_medium=web2x&context=3)

We built the Grapher because there is no similar external tool available. Datawrapper, Tableau, Plotly, various libraries based on d3 are out there but nothing is similar to what the Grapher does for our project.

Before we developed this tool, we built interactive web visualizations by hand through a difficult process of preparing individual spreadsheets of data and then writing custom HTML and JavaScript code to process the contents for each individual visualization. That was pretty painful and it took me hours sometimes to built a chart.

The owid-grapher solves this problem by using a single visualization codebase and crucially a single database into which all of our data is placed. Once the data has been imported, the process of creating a visualization is reduced to simply choosing what kind of visualization is needed and then selecting the relevant variables in the Grapher user interface. The result may then be customized, and is published to the web with the press of a button.

Using our own system has very important advantages:

• Integration with our global development database: Our database of global development metrics is integrated into our visualization tool so that when we add and update empirical data the visualizations are all updated. (In contrast to this, a pre-existing tool would make the exploration of a database impossible and would require the preparation of each dataset separately for each visualisation.)

• Flexibility: We can use automation to change our entire system all at once. For example, if we decide we want to use a different source referencing style, we could easily update this across hundreds of charts. This makes it possible to scale our publication and to sustainably improve our work without starting from scratch at each round.

• Risk mitigation: We hope(!) that Our World in Data is a long-term project and we want the visualizations we produce to continue to be useful and available years from now. An external web service may be shut down or change for reasons we cannot control. We have had this experience in the past and learned our lesson from it.

• Keeping everything up-to-date: Because we want to be a useful resource for some time we make sure that we have a technology in place that allows us to keep all of our work up-to-date without starting from scratch each time. We have our global development database directly integrated in the Grapher and as soon as new data becomes available (for example from a UN agency) we can run a script that pulls in that data and updates all the visualizations that present that data.
