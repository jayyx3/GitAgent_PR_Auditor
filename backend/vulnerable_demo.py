import sqlite3

# ISSUE 1: Hardcoded sensitive secret (secrets / critical)
DATABASE_PASSWORD = "admin_super_secret_token_abc123!"

def get_user_data(username):
    # ISSUE 2: Classic SQL Injection vulnerability (security / critical)
    # Concatenating raw input into a database query string!
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    
    # ISSUE 3: Missing error handling and connection leak (error_handling / warning)
    # We do not close the database connection, and we lack a try/except safety block!
    return cursor.fetchall()

def process_calculation(value):
    # ISSUE 4: Unhandled edge case (bug / warning)
    # Potential ZeroDivisionError if value equals 10, causing a raw backend traceback!
    divisor = value - 10
    return 100 / divisor
