# Visual Studio Code Devcontainer setup

This page describes how to run our develpment environment entirely within a VS Code devcontainer setup - i.e. without instally NodeJS, Mysql etc locally. All that is required is to have needs [VS Code](https://code.visualstudio.com/) with the [remote containers extension](https://code.visualstudio.com/docs/remote/containers) and the [docker runtime](https://www.docker.com/) installed.

Once you have the tools mentioned above installed, just open this repository in VS Code. You should see a notice in the lower left that asks if you want to open this again inside a devcontainer. Answer yes and it will spin that up. Note that the first time you run this it needs to download and ingest the database which takes a few minutes.

If you had the devcontainer setup running previously and get a message on the lower right asking to rebuild the devcontainer then confirm this to apply any changes to the configuration that have been made.

Once the database has been loaded run the following steps in VS Code's terminal (i.e. the terminal running inside the devcontainer):

```bash
make up.devcontainer
```

This will run [tmux](https://github.com/tmux/tmux/wiki/Getting-Started) and create 3 panels that you can switch between with `<C-b>, n` (i.e. press `CTLR` (on PC)/`CMD` (on Mac) and `b`, then release and press `n`). Mouse support is enabled so you should be able to scroll through the panels and click them in the bottom row. A short welcome message is printed on the initial pane - if you scroll up here you will see a quick cheatsheet with various commands.

Now navigate to http://localhost:3030/admin/charts and have a look at the admin interface. The default user account is `admin@example.com` with a password of `admin`

Press `<C-b>, Q` to kill the window and end all 3 processes when you are done. Close VS Code to shut down all docker containers and free up the resources of running the MySQL docker container.

## Accessing Mysql

If you want to access mysql you have two options. ⚠ Note that depending on which one you choose, you will have to use different ports!

1. From the terminal

    In the VS Code terminal that executes inside the devcontainer, run the mysql command line client:

    ```bash
    mysql -h db -u grapher -p grapher
    ```

    This will ask you for the password (enter `grapher`) and then show a prompt. See the https://dev.mysql.com/doc/refman/8.0/en/getting-information.html for how to query the database in this interface.

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
