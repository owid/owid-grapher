# Visual Studio Code Devcontainer setup

This page describes how to run our develpment environment entirely within a VS Code devcontainer setup - i.e. without instally NodeJS, Mysql etc locally. All that is required is to have needs [VS Code](https://code.visualstudio.com/) with the [remote containers extension](https://code.visualstudio.com/docs/remote/containers) and the [docker runtime](https://www.docker.com/) installed.

⚠ If you are on Windows, make sure that you configure git to use linux line ending (LF) instead of windows line endings (CRLR) before checking out this repository on your local machine. Follow the [Set up git on windows](./before-you-start-on-windows.md) instructions.

Once you have the tools mentioned above installed, just open this repository in VS Code. You should see a notice in the lower left that asks if you want to open this again inside a devcontainer. Answer yes and it will spin that up. Note that the first time you run this it needs to download and ingest the database which takes 5-20 minutes. To see if the database loading has finished refer to the [Checking the docker compose logs](#checking-the-docker-compose-logs) section.

If you had the devcontainer setup running previously and get a message on the lower right asking to rebuild the devcontainer then confirm this to apply any changes to the configuration that have been made.

Once the database has been loaded run the following steps in VS Code's terminal (i.e. the terminal running inside the devcontainer). On MacOS, the first run of this can be slow due to an issue with yarn and docker - if so just be patient.

```bash
make up.devcontainer
```

This will run [tmux](https://github.com/tmux/tmux/wiki/Getting-Started) and create 3 panels that you can switch between with `<C-b>, n` (i.e. press `CTLR` (on PC)/`CMD` (on Mac) and `b`, then release and press `n`). Mouse support is enabled so you should be able to scroll through the panels and click them in the bottom row. A short welcome message is printed on the initial pane - if you scroll up here you will see a quick cheatsheet with various commands.

Now navigate to http://localhost:3030/admin/charts in a browser and have a look at the admin interface. The default user account is `admin@example.com` with a password of `admin`

To stop the admin servers, press `<C-b>, Q` in the terminal to kill the window and end all 3 processes when you are done. Close VS Code to shut down all docker containers and free up the resources of running the MySQL docker container.

## Accessing MySQL

If you want to access MySQL you have two options. ⚠ Note that depending on which one you choose, you will have to use different ports!

1. From the terminal

    In the VS Code terminal that executes inside the devcontainer, run the MySQL command line client:

    ```bash
    mysql -h db -u grapher -pgrapher grapher
    ```

    This will show a MySQL prompt. See the https://dev.mysql.com/doc/refman/8.0/en/getting-information.html for how to query the database in this interface.

2. From a desktop application

    For more complex interactions it can be useful to run a program like the free [DBeaver](https://dbeaver.io/) database manager. When you install this on your system, enter the following information when creating a connection to the database:

    | Setting       | Value                                                           |
    | ------------- | --------------------------------------------------------------- |
    | Database type | MySQL                                                           |
    | Server        | localhost                                                       |
    | User          | grapher                                                         |
    | Password      | grapher                                                         |
    | Port          | 3307 (<- this is different than the default to avoid conflicts) |
    | Database      | grapher                                                         |

## Running tests

To run our test suite you first need to build the TypeScript files into JavaScript and then run jest:

1. Run buildTsc

    ```sh
    yarn buildTsc
    ```

2. Run jest

    ```sh
    yarn testJest
    ```

## Using storybook

Storybook allows you to interact with our Grapher and Explorer components visually in a browser and can be a great way to debug or to test new features.

1. Run buildTsc

    ```sh
    yarn buildTsc
    ```

2. Run Storybook Server

    ```sh
    yarn startStorybookServer
    ```

![Storybook](screenshots/storybook.png)

## Checking the docker compose logs

This section explains how to check the logs for the database loading script that runs the first time you use this setup.

An important note first: when using the VS Code Devcontainers extension, there is difference between the terminal in VS Code and a normal terminal that you open on your computer (i.e. your normal Windows or Mac terminal). The VS Code terminal gives you a shell running **inside** the development container. It has access to all the tools like node, yarn etc that you need to compile and run the codebase. It does not have access to the docker runtime though wich is running the container. A normal terminal is the opposite, it operates **outside** the container - it has access to the docker command line tools but not all the tools running inside the development container.

To check the status, make sure you run the following commands in a terminal **outside** your devcontainer, in the working directory root of this repository:

```bash
docker-compose -f docker-compose.devcontainer.yml logs -f
```

This will follow all log entries (i.e. it will print log statements while they happen) of all three containers: the app-1 container (your devcontainer with node, yarn etc), the db-1 container (MySQL), and the db-load-data container (that loads the data and then stops). On the first run of the devcontainer setup, this last container will download two gz files into the tmp-downloads folder and then ingest them into the MySQL database. This whole process can take between 5 and 20 minutes. When it is done you should see this message:

✅ All done, grapher DB is loaded ✅
