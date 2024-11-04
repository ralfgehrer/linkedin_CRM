import os
from dotenv import load_dotenv
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, text
from models import Base  # Only import Base from models

load_dotenv()

def run_migrations():
    try:
        # Create an Alembic configuration object
        alembic_cfg = Config("alembic.ini")
        
        # Create a new migration
        command.revision(alembic_cfg, 
                        message="Initial migration", 
                        autogenerate=True)
        
        # Apply the migration
        command.upgrade(alembic_cfg, "head")
        print("Migrations completed successfully!")
        
    except Exception as e:
        print(f"Migration error: {str(e)}")
        raise

def create_tables():
    """Create tables directly using SQLAlchemy if needed"""
    engine = create_engine(os.getenv('DATABASE_URL'))
    Base.metadata.create_all(engine)
    print("Tables created successfully!")

def check_database():
    engine = create_engine(os.getenv('DATABASE_URL'))
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'profiles'
                );
            """)
        )
        return result.scalar()

def init_db():
    try:
        if not check_database():
            print("Initializing database...")
            # First create tables using SQLAlchemy
            create_tables()
            # Then create and run migrations
            run_migrations()
            print("Database initialized successfully!")
        else:
            print("Database already initialized.")
            
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise

if __name__ == "__main__":
    init_db()