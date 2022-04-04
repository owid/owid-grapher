# Setting up a local typescript environment

This page describes how to set up the typescript and javascript tooling to build the Grapher component from source and test it in your browser on your local machine. If you also want to be able to use the admin UI to graphically configure grapher charts you will need to set up the mysql database, by using our [docker compose mysql setup](docker-compose-mysql.md).

This local environment requires some manual setup. For a faster way to get started have a look at the [VS Code devcontainer setup](devcontainer-setup.md).

You need the following to be able to compile the grapher project and run the tests or use our Storybook:

-   [Node 16](https://nodejs.org/en/)
-   [Yarn](https://yarnpkg.com/)

All further dependencies will be automatically installed by the yarn package manager.

We recommend using the [nvm Node Version manager](https://github.com/nvm-sh/nvm) and [Visual Studio Code](https://code.visualstudio.com/) as the editor.

Below are steps to set up nvm and yarn. Further down are the steps to run the tests and use the storybook for development.

## Setting up Node and Yarn

### MacOS specific first steps

1. Install Homebrew first, follow the instructions here: <https://brew.sh/>
2. Install nvm:

    ```sh
    brew update
    brew install nvm
    source $(brew --prefix nvm)/nvm.sh
    ```

### Linux/Windows specific first steps

Note: on Windows we strongly recommend using the [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about) for development as all our utility scripts are written in bash.

1. Run the following install script to set up NVM (from a WSL terminal when on windows):

    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
    ```

### Further steps for all OSs

3. Clone this project if you haven't already, and switch to the project directory

4. Install Node:

    ```sh
    nvm install
    ```

    (this will pick up the right version from `.nvmrc`)

5. Install yarn:

    ```sh
    npm install -g yarn
    ```

6. Run yarn inside the repo folder to install dependencies:

    ```sh
    yarn
    ```

## Running tests

To run our test suite you first need to build the typescript files into javascript and then run jest:

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
