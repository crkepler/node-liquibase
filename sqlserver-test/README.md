Yiou can ignore this folder completely.

It's here so that you can start your own instance of MS SQL Server locally, in a Docker container to test things locally if you wish.

This folder should not be part of any build.

To startr SQL Server locally:

``
docker compose up
``

Then:

``
docker compose down
``

All all DB files are saved under the ``./volumes`` directory.




