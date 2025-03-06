# Development setup options

We currently have several ways of running a local development setup. If you get stuck please [create a new discussion](https://github.com/owid/owid-grapher/discussions) and we'll try to help you with the setup.

Each option supports different features:

**TypeScript compilation** 🔨

At a minimum, all of the options will transpile and serve the Grapher code. This should be enough for simple bug fixes but a bit basic for more complex development.

**Grapher Admin UI** 🚜

This needs a working MySQL database and gives you an interactive admin UI for visually editing our charts as well as all our ~4000 charts and their data.

---

In increasing order of sophistication:

**[Visual Studio Code development containers](devcontainer-setup.md)** (🚜.)

This uses Visual Studio Code with the [remote containers extension](https://code.visualstudio.com/docs/remote/containers) and the [Docker runtime](https://www.docker.com/getting-started) installed. Everything else is automated to happen inside Docker containers so while you are developing locally, you do not have to install Node.js, MySQL, WordPress or any other dependencies on your main operating system. This also makes this setup easy to run on Windows if you are not familiar with using the Windows Subsystem for Linux.

**[Local setup without MySQL](local-typescript-setup.md)** (🔨)

Here you don't need Docker and you just set up node and yarn. This only gives you Typescript compilation, but there is no further overhead for your system.

**[Local setup with MySQL and Grapher admin](docker-compose-mysql.md)** (🚜)

Uses Docker to run the MySQL database alongside a local setup without MySQL. This setup the one used by a lot of the OWID staff and is recommended for bigger changes to Grapher.

**GitPod** (🚜.)

This is a contributed web-based setup that needs no local tools whatsoever, just a [web browser pointed at GitPod](https://gitpod.io/#https://github.com/owid/owid-grapher). This is an easy way to get started, but it is not actively maintained by the OWID team so it might not be working as well as the other options. This method takes around 30 minutes to initialize.
