The tests here are supposed to be run via `make dbtest`. This will bootstrap an empty test database, initialize a base schema and run the migrations. Then the tests are run. The make setup drops the database at the beginning so that tests always start from an empty base state.

The idea for these tests is to test the interaction with the database. This is slower than tests that just work within code so the logic that doesn't need to concern itself with the database and just needs a store for values and a way to retrieve them is probably better done another way. But code that includes some non-trivial work inside the database (with functions, triggers or complex views) should use tests here to validate that things work correctly.

It can be useful to fetch segments from the prod or a staging database for testing. The nicest way to do this is to write a where clause that selects the right rows from the table you are interested in and then run a mysqldump command to create insert statements for these rows, like so:

```bash
mysqldump -h $HOST -u $USER -p --no-create-info --no-tablespaces --single-transaction live_grapher charts --where "id=3963" > grapher3963.sql
```

This SQL can then be specified in the code that sets up the database.

It is good practice to be deliberate about how your tests leave the database behind for the next test file. By default the teardown of a file should remove any rows that were created, but it can also make sense to build up a set of state that is shared across tests. Communicating either clearly is key.
