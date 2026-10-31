# Brightloop API

FastAPI + SQLAlchemy + SQLite. See the [project README](../README.md) for setup, accounts, configuration, and test commands, and the [demo guide](../DEMO.md) for the judging walkthrough.

```sh
source venv/bin/activate
python run.py
```

API: http://localhost:8000 · Docs: http://localhost:8000/docs

The server uses the database at `backend/brightloop.db` unless `DATABASE_URL` is provided. The database is seeded only if it is empty. Local email messages and the generated authentication secret are excluded from version control.
