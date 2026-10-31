def lock_write(db):
    """SQLite reserves its writer before check-then-write financial operations.

    This also coordinates the scheduler and HTTP requests across processes.
    Other database dialects should use row-level locks when deployed there.
    """
    if db.bind.dialect.name == "sqlite":
        connection = db.connection()
        if not connection.connection.driver_connection.in_transaction:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
