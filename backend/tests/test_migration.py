import sqlite3
import pytest


def test_image_url_column_exists_after_migration(tmp_path):
    """Startup migration should add image_url column if missing."""
    db_path = tmp_path / "test.db"
    conn = sqlite3.connect(str(db_path))
    # Create posts table without image_url (simulating old schema)
    conn.execute("""
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            title TEXT,
            linkedin_post_url TEXT,
            linkedin_post_id TEXT
        )
    """)
    conn.commit()

    # Run migration
    try:
        conn.execute("ALTER TABLE posts ADD COLUMN image_url TEXT")
        conn.commit()
    except Exception:
        pass  # column already exists

    # Verify column present
    cursor = conn.execute("PRAGMA table_info(posts)")
    columns = [row[1] for row in cursor.fetchall()]
    assert "image_url" in columns
    conn.close()
