## Docker Container with NodeJS and Liquibase

NodeJS is used to remove the complexity of using Liquibase with several
databases and custom configurations.

## 1. Options to Run this App

Development Mode:
* It can be run locally on your computer
* It can run locally interacting with a Docker Container (preferred)

Production Mode
* It can run on an EC2 in AWS (production)

All code pertinent to the application is in the ``/app`` folder.

## 2. Setting up the Development Environment

1. You must have the [Docker Engine](https://docs.docker.com/engine/install/) installed on your computer.

2. ``git clone`` this project

3. `cd ./app` 
4. Edit both the ``docker-compose-dev.yml`` and ``docker-compose.yml`` and change the ``image`` property (~line 5) with your Dockerhub ID. For example, change from ``crkepler/app-node-liquibase`` to ``<your id>/app-node-liquibase``
5. ``docker compose -f docker-compose-dev.yml up --build`` Use ``--build`` for the first time only or when you add a new ``npm`` package. This will download all the necessary images and start the NodeJS + Liquibase container.
6. From this point forward, every time you want to start the container you can just type ``npm run start:docker-dev``. Look at the ``scripts`` section of the ``package.json`` file for details.
7. Run ``docker compose down`` from another terminal to stop the container or ``npm run stop:docker-dev``.

#### Setup a Local Test Database

For this task you can open your SQL Editor of choice (e.g. [Dbeaver](https://dbeaver.io/)) and use the GUI to connect
to the MSSQL instance running on a Docker container:
- host: `localhost`
- port: `1433`
- user name: `sa`
- password: `Harr1s0n!`  -- It can be anything, but it must match the password used when we defined the container. See `./sqlserver-test/docker-compose.yml`

1. From the project root, where you cloned it: ``cd ./sqlserver-test``
2. ``docker compose up``
3. This will start a container with MS-SQL Server running.
4. Connect to this DB with your SQL Editor using the information above.
5. Now, from the GUI, manually create two databases. The steps for this varies, but usually it's as simple as right-clicking on the
   master DB and selecting "Create Database".
- `test_1`
- `test_2`

Alternatively, you can execute this script:

``` sql
USE master;  
GO

CREATE DATABASE test_1;
GO

USE master;  
GO

CREATE DATABASE test_2;
GO
```
<br/>

#### Create the Tables in the Containerized Database

Docker Compose should have downloaded and created an image for you 
called ``<your Docker ID>/app-node-liquibase `` 

* Verify this by typing ``docker images`` in the command line (from any folder).

* You should also have a container running named ``app-node-liquibase``. You
can verify this by typing ``docker ps`` 

Now we will run commands from your laptop (host) into this container.
This is exactly how it'll work with the container is running on an EC2
in AWS. To execute commands in an existing container:

``docker exec <container name> <commands>``

So, we will create the tables in ``test_1`` and ``test_2`` with the first
command:

``docker exec app-node-liquibase node index update``

* ``app-node-liquibase`` is the name of the container ``docker compose`` started
* ``node index`` is the program to run in the container. More about it in the next section.
* ``update`` is the command passed to the program. It can be ``update | status | diff``. 

After the command runs, you can see the created tables with your SQL Editor.

## 3. About the Application

It's a NodeJS app that can be run from the command line only, in this case from inside the 
container ``bash shell``, or terminal. Once a command is executed, the NodeJS application stops and
waits for another command -- but the Docker container keeps running.

This is the application command line syntax:

``node index <command> <options>``

* ``command`` - it can only be 3 at this time: ``update``, ``diff``, or ``status``. ``status`` is for testing connections only.
* ``options`` 
  * ``--databases``: a list of databases to use: ``--databases db1 db2 dbn`` or ``-d`` for short. If no databases are passed, the default is ``all``
  * ``--chanlogFileSuffix``: applies to ``diff`` only. An optional suffix to the file name the ``diff`` command outputs. The default is an empty string (no suffix)

### Inputs
Everything related to Liquibase and database operations is configured in the ``./config`` and ``./liquibase`` 
directories.

1. ``./config`` - there's one config file per environment. Before running this app, ``NODE_ENV`` must be set to ``dev`` or ``production``.
For local development, these required environment variables are read from the `.env` file, but this file can't be present during
a production build. If present, it'll connect to the local dev databases and it won't work.


2. ``./liquibase`` - create here a folder for each database name defined in the ``./config`` file. In each folder
create a ``.yaml`` changelog file to update each database. See the [Liquibase Documentation](https://docs.liquibase.com/home.html)
on how to structure these files. Liquibase is quite powerful and there are many features available. All files defined
in each folder, must match the definitions in the ``./config`` files.

### Outputs

1. ``liquibase`` - the only database output at this release is what is produced by the ``diff`` command. The file format
is as follows:

    ``<database-name-in-the-config-file>_changelog_diff<optional-suffix>.yaml``

    Example:
``test_1_changelog_diff_sunday.yaml`` if ``-c sunday`` is passed with the ``diff`` command.
</br>
</br>

2. ``logs`` - there are 2 log files: activity and error. Winston logger is used the the max size of the log files
is specified in the ``./app/controller/logConfig.js`` file.

## 3. To-Do

1. Create Terraform scrips to:
   1. provision EC2 in AWS with Docker: Security groups, permissions
   2. EC2 volume for `./liquibase` and `./logs`
   3. RDS instance for testing, add permissions
   4. Send logs to CloudWatch - configure agent in EC2, add permissions
2. Read secrets from AWS Secrets Manager.
3. Instructions on how to deploy the app in production (AWS).

### Not Planning on Doing Just Yet

* Create a build pipeline with Github Actions. This may come later.