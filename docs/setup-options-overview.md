# Development setup options

We currently have several ways of running a local development setup. With any of these, if you get stuck please [create a new discussion](https://github.com/owid/owid-grapher/discussions) and we'll try to help you with the setup. They differ in what forms of development they support:

1. 🔨 **Typescript compilation**. All of the options below give you a way to compile our typescript compilation and a way to run our test suite and [Storybook](https://storybook.js.org/) for visual testing in a browser of predefined examples. This should be enough for simple bug fixes but a bit basic for more complex development.
2. 🚜 **Admin UI**. This needs a working MySQL database and gives you an interactive admin UI for visually editing our charts as well as all our ~4000 charts and their data. This is what most developers at Our World In Data use day to day while working on grapher.
3. 🌟 The **full Wordpress setup**. This version needs a copy of our wordpress content that is currently only available for Our World In Data team members. With this you can test all parts of the publishing flow including site baking, full page previews for all content etc.

The currently available ways of using grapher are listed below in increasing order of sophistication.

-   **[VS Code Devcontainers](docs/devcontainer-setup.md)** - this is a setup that needs VS Code with the [remote containers extension](https://code.visualstudio.com/docs/remote/containers) and the [docker runtime](https://www.docker.com/) installed. Everything else is automated to happen inside docker containers so while you are developing locally, you do not have to install node, mysql, wordpress or any other parts on your main operating system. This also makes this setup easy to run on Windows if you are not familiar with using the Windows Subsystem for Linux. This setup gives you the Admin UI 🚜. A detailed description can be found [here](docs/devcontainer-setup.md)

-   **[Local setup without mysql](docs/local-typescript-setup.md)** - here you don't need docker and you just set up node and yarn. This only gives you Typescript compilation 🔨 but there is no further overhead for your system. It is described in more detail [here](docs/local-typescript-setup.md)

-   **[Local setup with mysql and grapher admin](docs/docker-compose-mysql.md)** - here you use docker to run the mysql database and otherwise use a similar setup to the `local setup without mysql`. This setup gives you the Admin UI 🚜. This setup the one used by a lot of the OWID staff and is recommended for bigger changes to Grapher. It is described in more detail [here](docs/docker-compose-mysql.md)

-   **[Full setup with wordpress](docs/full-wordpress-setup.md)** - for this setup you need a wordpress database dump which is only available for OWID team members. As the name implies this gives you the full wordpress setup 🌟 and allows work on all parts of our site publishing locally. It is described in more detail [here](docs/full-wordpress-setup.md)

Bonus setup alternative:

-   **GitPod** - this is a contributed web-based setup that needs no local tools whatsoever, just a [web browser pointed at GitPod](https://gitpod.io/#https://github.com/owid/owid-grapher). This is an easy way to get started but it is not actively maintained by the OWID team so it might not be working as well as the other options. It supports the Admin UI 🚜. The first start takes a rather long time to start (~30 minutes).
