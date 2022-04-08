# owid-grapher

[![Actions Status](https://github.com/owid/owid-grapher/workflows/Continuous%20Integration/badge.svg)](https://github.com/owid/owid-grapher/actions)
[![Test coverage](https://owid.github.io/badges/coverage.svg)](https://owid.github.io/coverage/)
[![Storybook](https://raw.githubusercontent.com/storybookjs/brand/master/badge/badge-storybook.svg)](https://owid.github.io/stories/)

> The monorepo we use at [Our World in Data](https://ourworldindata.org) to create and publish embeddable, interactive visualizations like this one:

[![A Grapher chart showing world-wide life expectancy at birth. Click for interactive.](https://ourworldindata.org/grapher/exports/life-expectancy.svg)](https://ourworldindata.org/grapher/life-expectancy)

---

This repo is currently not well-designed for reuse as a visualization library, nor for reproducing the full production environment we have at Our World in Data, as our tools are tightly coupled with our database structure.

⚠️

**Note: As of April 5th 2022, we have [changed](https://github.com/owid/owid-grapher/pull/1359) the environment variable naming and MySQL port used by the database. If you've been running this project since before then, please update your `.env` and MySQL client accordingly.**

⚠️

We're gradually making steps towards making our work more reusable, however we still prioritize [needs specific to our project](#why-did-we-start-this-project) that can be at odds with making our tools reusable.

You are still very welcome to reuse and adapt any of our code for your own purposes, and we welcome [contributions](CONTRIBUTING.md)!

---

## Overview

Multiple projects are maintained in this repo:

### [Grapher](grapher/)

A client-side interactive data visualization library used by almost every chart on Our World in Data.

All grapher data is stored in a MySQL database that contains both JSON configuration objects for individual charts as well as the data values that they ingest.

### [Explorer](explorer/)

A Grapher-based tool that creates more complex [data visualization user interfaces](https://ourworldindata.org/explorers/migration).

Each explorer can be configured via a [panel](explorerAdminServer/) in the admin client. Their config files are stored in [a separate repository](https://github.com/owid/owid-content/tree/master/explorers).

### Grapher Admin

-   A [client-side](adminSiteClient/) project that provides a user interface for configuring graphers, explorers, and managing and uploading data.

-   A [server-side](adminSiteServer/) project that manages the MySQL database used by graphers.

### [WordPress](wordpress/)

The CMS we use to manage articles published on Our World in Data. It's a relatively stock setup, with a custom plugin to provide additional blocks for the Gutenberg editor.

Our Wordpress content and configuration is stored in a MySQL database, which currently isn't shared publicly.

### [Baker](baker/)

A [PM2](https://github.com/Unitech/pm2) project that builds a static copy of the Our World in Data website by merging the content authored in Wordpress with the grapher charts created in Grapher Admin.

## Usage

To quickly get a version of the site running for developing Grapher features, we recommend following the [local development setup](docs/docker-compose-mysql.md) guide.

[Additional setup options](docs/setup-options-overview.md) are also available for other use cases.

## Tooling

Much of our code is based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using [React](https://reactjs.org/) and [Mobx](http://github.com/mobxjs/mobx).

All non-WordPress code is written in [TypeScript](https://www.typescriptlang.org/).

[Visual Studio Code](https://code.visualstudio.com/) is recommended for autocompletion and other awesome editor analysis features enabled by static typing.

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

Client-side bug tracking provided by <a href="http://www.bugsnag.com/"><img width="110" src="https://images.typeform.com/images/QKuaAssrFCq7/image/default" /></a>
