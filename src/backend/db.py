import sqlite3
import os
import hashlib
import json
from datetime import datetime

DB_PATH = os.path.join('data', 'parfin.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Create Users Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create Transactions Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'VND',
            type TEXT NOT NULL, -- 'income' or 'expense'
            category TEXT NOT NULL,
            description TEXT,
            source TEXT DEFAULT 'cash', -- 'cash' or 'bank'
            destination TEXT DEFAULT NULL, -- 'cash' or 'bank' (for transfers)
            fund TEXT, -- 'Saving', 'Support', 'Investment', 'Together'
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Check if admin exists, if not create default admin
    c.execute('SELECT * FROM users WHERE role = ?', ('admin',))
    if not c.fetchone():
        # Default admin: admin / admin123
        # In a real app, use a proper salt and hashing library like bcrypt. 
        # For "No frameworks" constraint, we'll use sha256.
        pw_hash = hashlib.sha256('admin123'.encode()).hexdigest()
        c.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', 
                  ('admin', pw_hash, 'admin'))
        print("Default admin user created (admin/admin123)")
        
    # Migration: Add source column if it doesn't exist (for existing databases)
    try:
        c.execute('SELECT source FROM transactions LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding source column to transactions table...")
        c.execute("ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'cash'")

    # Migration: Add destination column to transactions if it doesn't exist
    try:
        c.execute('SELECT destination FROM transactions LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding destination column to transactions table...")
        c.execute("ALTER TABLE transactions ADD COLUMN destination TEXT DEFAULT NULL")

    # Migration: Add fund column if it doesn't exist

    # Migration: Add fund column if it doesn't exist
    try:
        c.execute('SELECT fund FROM transactions LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding fund column to transactions table...")
        c.execute("ALTER TABLE transactions ADD COLUMN fund TEXT DEFAULT NULL")

    # Create Fixed Items Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS fixed_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL, -- 'income' or 'expense'
            category TEXT NOT NULL,
            description TEXT,
            source TEXT DEFAULT 'cash', -- 'cash' or 'bank'
            fund TEXT, -- 'Saving', 'Support', 'Investment', 'Together'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Migration: Add fund column to fixed_items if it doesn't exist
    try:
        c.execute('SELECT fund FROM fixed_items LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding fund column to fixed_items table...")
        c.execute("ALTER TABLE fixed_items ADD COLUMN fund TEXT DEFAULT NULL")

    conn.commit()
    conn.close()

def query_db(query, args=(), one=False):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    conn.commit()
    conn.close()
    return (rv[0] if rv else None) if one else rv
