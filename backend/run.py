import sys
import os
import uvicorn

# Ensure the current directory (backend) is on the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import engine, Base, SessionLocal
from app.models.user import User
from seed_data import seed_database


def init_db():
    print("[INIT] Ensuring database tables are created...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    user_count = db.query(User).count()
    db.close()
    
    if user_count == 0:
        print("[INIT] Database is empty. Running initial seeding...")
        seed_database()
        print("[INIT] Seeding complete.")
    else:
        print(f"[INIT] Database already contains {user_count} users. Ready.")


if __name__ == "__main__":
    init_db()
    print("[SERVER] Starting BrightLoop API server on http://0.0.0.0:8000 ...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
