# owid-grapher

[![Actions Status](https://github.com/owid/owid-grapher/workflows/Continuous%20Integration/badge.svg)](https://github.com/owid/owid-grapher/actions)
[![Test coverage](https://owid.github.io/badges/coverage.svg)](https://owid.github.io/coverage/)
[![Storybook](https://raw.githubusercontent.com/storybookjs/brand/master/badge/badge-storybook.svg)](https://owid.github.io/stories/)

This is the project we use at [Our World in Data](https://ourworldindata.org) to create embeddable visualizations like this one (click for interactive):

[![Life expectancy at birth](https://ourworldindata.org/grapher/exports/life-expectancy.svg)](https://ourworldindata.org/grapher/life-expectancy)

---

### ⚠️ **This project is currently not well designed for immediate reuse as a visualization library, or for reproducing the full production environment we have at Our World in Data.**

The Grapher relies heavily on the current database structure, and there are some hard-to-reproduce dependencies in order to create a full production environment that supports publishing embeddable charts.

We're gradually making steps towards making our work more reusable, however we still prioritize [needs specific to our project](#why-did-we-start-this-project) that can be at odds with making our tools reusable.

You are still very welcome to reuse and adapt any of our code for your own purposes, and we welcome [contributions](CONTRIBUTING.md)!

---

### Overview of this repository

The [**Grapher**](grapher/) is the **client-side visualization library** that displays data interactively (almost every interactive chart on [Our World in Data](https://ourworldindata.org) uses this). It consumes a JSON file to configure it, and an additional JSON file that encodes the data. ⚠️ The Grapher is currently not well designed for immediate reuse as a standalone visualization library, it relies heavily on our database structure.

The **Grapher Admin** is both a [server-side](adminSiteServer/) and [client-side](adminSiteClient/) TypeScript project that:

-   provides a user interface for configuring interactive charts ("graphers"), managing and uploading data
-   manages the MySQL database that stores the data for all grapher instances.

[**Wordpress**](wordpress/) is used by authors to write the content published on [Our World in Data](https://ourworldindata.org). It is a relatively stock setup including a custom plugin to provide additional blocks for the Gutenberg editor. The Wordpress content and configuration is stored in a MySQL database, which currently isn't shared publicly.

The [**baker**](baker/) is used to build the full static [Our World in Data](https://ourworldindata.org) website by merging the content authored in Wordpress with the graphers created in Grapher Admin.

[**Explorers**](explorer/) are a relatively new addition. For readers, they provide a user interface around graphers. Under the hood, they use the Grapher as a visualization library. There is an [admin](explorerAdminServer/) to configure explorers. The config files end up in [a git repo](https://github.com/owid/owid-content/tree/master/explorers) (not MySQL as most of the other content).

## Initial development setup

We currently have several ways of running a local development setup. With any of these, if you get stuck please [create a new discussion](https://github.com/owid/owid-grapher/discussions) and we'll try to help you with the setup. They differ in what forms of development they support:

1. 🔨 **Typescript compilation**. All of the options below give you a way to compile our typescript compilation and a way to run our test suite and [Storybook](https://storybook.js.org/) for visual testing in a browser of predefined examples. This should be enough for simple bug fixes but a bit basic for more complex development.
2. 🚜 **Admin UI**. This needs a working MySQL database and gives you an interactive admin UI for visually editing our charts as well as all our ~4000 charts and their data. This is what most developers at Our World In Data use day to day while working on grapher.
3. 🌟 The **full Wordpress setup**. This version needs a copy of our wordpress content that is currently only available for Our World In Data team members. With this you can test all parts of the publishing flow including site baking, full page previews for all content etc.

The currently available ways of using grapher are listed below in increasing order of sophistication.

-   **VS Code Devcontainers** - this is a setup that needs VS Code with the [remote containers extension](https://code.visualstudio.com/docs/remote/containers) and the [docker runtime](https://www.docker.com/) installed. Everything else is automated to happen inside docker containers so while you are developing locally, you do not have to install node, mysql, wordpress or any other parts on your main operating system. This also makes this setup easy to run on Windows if you are not familiar with using the Windows Subsystem for Linux. This setup gives you the Admin UI 🚜. A detailed description can be found [here](docs/devcontainer-setup.md)

-   **Local setup without mysql** - here you don't need docker and you just set up node and yarn. This only gives you Typescript compilation 🔨 but there is no further overhead for your system. It is described in more detail [here](docs/local-typescript-setup.md)

-   **Local setup with mysql and grapher admin** - here you use docker to run the mysql database and otherwise use a similar setup to the `local setup without mysql`. This setup gives you the Admin UI 🚜. This setup the one used by a lot of the OWID staff and is recommended for bigger changes to Grapher. It is described in more detail [here](docs/docker-compose-mysql.md)

-   **Full setup with wordpress** - for this setup you need a wordpress database dump which is only available for OWID team members. As the name implies this gives you the full wordpress setup 🌟 and allows work on all parts of our site publishing locally. It is described in more detail [here](docs/full-wordpress-setup.md)

Bonus setup alternative:

-   **GitPod** - this is a contributed web-based setup that needs no local tools whatsoever, just a [web browser](https://gitpod.io/#https://github.com/owid/owid-grapher). This is an easy way to get started but it is not actively maintained by the OWID team so it might not be working as well as the other options. In theory it supports the Admin UI 🚜.

## Architecture notes

Our implementation is based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using [React](https://reactjs.org/) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do client-side data processing efficiently. New code should be written in [TypeScript](https://www.typescriptlang.org/). [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

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
