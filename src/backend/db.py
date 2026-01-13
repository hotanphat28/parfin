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

    # Migration: Add destination_category column to transactions if it doesn't exist
    try:
        c.execute('SELECT destination_category FROM transactions LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding destination_category column to transactions table...")
        c.execute("ALTER TABLE transactions ADD COLUMN destination_category TEXT DEFAULT NULL")

    # Migration: Add fund column if it doesn't exist
    try:
        c.execute('SELECT fund FROM transactions LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding fund column to transactions table...")
        c.execute("ALTER TABLE transactions ADD COLUMN fund TEXT DEFAULT NULL")

    # Migration: Add currency column if it doesn't exist
    try:
        c.execute('SELECT currency FROM transactions LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding currency column to transactions table...")
        c.execute("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'VND'")

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
            destination TEXT DEFAULT NULL, -- 'cash' or 'bank' (for transfers)
            destination_category TEXT DEFAULT NULL, -- 'Saving', etc.
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

    # Migration: Add destination column to fixed_items if it doesn't exist
    try:
        c.execute('SELECT destination FROM fixed_items LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding destination column to fixed_items table...")
        c.execute("ALTER TABLE fixed_items ADD COLUMN destination TEXT DEFAULT NULL")

    # Migration: Add destination_category column to fixed_items if it doesn't exist
    try:
        c.execute('SELECT destination_category FROM fixed_items LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding destination_category column to fixed_items table...")
        c.execute("ALTER TABLE fixed_items ADD COLUMN destination_category TEXT DEFAULT NULL")

    # Create Settings Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')

    # Create Investment Transactions Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS investment_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            symbol TEXT NOT NULL,
            asset_type TEXT DEFAULT 'stock', -- 'stock', 'bond', 'crypto', 'fund'
            type TEXT NOT NULL, -- 'buy', 'sell', 'dividend'
            quantity REAL DEFAULT 0,
            price REAL DEFAULT 0,
            fee REAL DEFAULT 0,
            tax REAL DEFAULT 0, -- TNCN for dividends/selling
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Migration: Add asset_type column to investment_transactions if it doesn't exist
    try:
        c.execute('SELECT asset_type FROM investment_transactions LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating database: Adding asset_type column to investment_transactions table...")
        c.execute("ALTER TABLE investment_transactions ADD COLUMN asset_type TEXT DEFAULT 'stock'")

    # Initialize default exchange rate if not exists
    c.execute('SELECT value FROM settings WHERE key = ?', ('exchange_rate_usd_vnd',))
    if not c.fetchone():
        c.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('exchange_rate_usd_vnd', '25000'))
        print("Initialized default exchange rate: 1 USD = 25000 VND")

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
