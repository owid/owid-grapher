from os import environ
import json
import MySQLdb
from typing import List
import pprint

JUPYTER_MYSQL_USER = environ.get("JUPYTER_MYSQL_USER", "grapher")
JUPYTER_MYSQL_DB = environ.get("JUPYTER_MYSQL_DB", "grapher")
JUPYTER_MYSQL_HOST = environ.get("JUPYTER_MYSQL_HOST", "localhost")
JUPYTER_MYSQL_PASSWORD = environ.get("JUPYTER_MYSQL_PASSWORD", "grapher")
JUPYTER_MYSQL_PORT = environ.get("JUPYTER_MYSQL_PORT", 3307)

def remove_key_in_dimension(ks: List[str], d: dict):
    for k in ks:
        if k in d:
            del d[k]
    return d

def migrate_remove_obsolete_dimension_fields():
    """This function fetches all charts config json fields where inside the json any dimension
    has one of the fields "order", "id", "chartId" or "numDecimalPlaces". It then removes these
    and saves back the chart config json. If any
    """
    conn = None
    cursor = None
    try:
        conn = MySQLdb.connect(
                            host=JUPYTER_MYSQL_HOST,
                            user=JUPYTER_MYSQL_USER,
                            passwd=JUPYTER_MYSQL_PASSWORD,
                            db=JUPYTER_MYSQL_DB,
                            port=JUPYTER_MYSQL_PORT,
                        )
        cursor = conn.cursor()
        cursor.execute("""select id, config
        from charts
        where JSON_CONTAINS_PATH(config, 'one', '$.dimensions[*].order') = 1
        or JSON_CONTAINS_PATH(config, 'one', '$.dimensions[*].id') = 1
        or JSON_CONTAINS_PATH(config, 'one', '$.dimensions[*].chartId') = 1
        or JSON_CONTAINS_PATH(config, 'one', '$.dimensions[*].numDecimalPlaces') = 1
        """)

        result = cursor.fetchall()
        print(f"Migrating {len(result)} rows")

        for row in result:
            id = row[0]
            config_json = json.loads(row[1])
            config_json["dimensions"] = [
                remove_key_in_dimension(["order", "id", "chartId", "numDecimalPlaces"], d) for d in config_json["dimensions"]
            ]
            cursor.execute("""update charts set config = %s where id=%s""", (json.dumps(config_json), id))
        conn.commit()
        print("Done")

    except BaseException as e:
        print(f"An error occured! {e}")
        if conn is not None:
            print("Trying to roll back changes now")
            conn.rollback()
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()

# main method
if __name__ == "__main__":
    migrate_remove_obsolete_dimension_fields()
