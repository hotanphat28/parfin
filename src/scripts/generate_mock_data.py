import sqlite3
import os
import random
from datetime import datetime, timedelta

# Define database path relative to this script
# Script is in src/scripts/, db is in data/
# Go up two levels from src/scripts to root, then into data
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'data', 'parfin.db')

print(f"Target Database: {DB_PATH}")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def generate_mock_data():
    conn = get_db_connection()
    c = conn.cursor()

    # Get the first user ID (usually admin or the first user created)
    c.execute("SELECT id FROM users LIMIT 1")
    user_row = c.fetchone()
    if not user_row:
        print("No users found. Please create a user first.")
        return
    
    user_id = user_row['id']
    print(f"Generating data for User ID: {user_id}")

    categories = ['Food', 'Salary', 'Rent', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Health']
    types = ['income', 'expense']
    sources = ['cash', 'bank']
    
    transactions_count = 0

    # Generate for year 2025, months 1 to 12
    for month in range(1, 13):
        # Generate 5-10 transactions per month
        num_transactions = random.randint(5, 10)
        
        for _ in range(num_transactions):
            # Random day 1-28 using integer since it's safer for all months
            day = random.randint(1, 28)
            
            # Format date: YYYY-MM-DD
            date_str = f"2025-{month:02d}-{day:02d}"
            
            trans_type = random.choice(types)
            
            # Weight 'expense' more heavily than 'income' usually, but random is fine
            if trans_type == 'income':
                category = 'Salary' if random.random() > 0.3 else 'Other Income'
                amount = random.randint(1000000, 50000000) # 1M to 50M VND
            else:
                category = random.choice([c for c in categories if c != 'Salary'])
                amount = random.randint(20000, 2000000) # 20k to 2M VND
            
            source = random.choice(sources)
            description = f"Mock {category} transaction"

            c.execute('''
                INSERT INTO transactions (user_id, amount, type, category, description, source, date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, amount, trans_type, category, description, source, date_str))
            
            transactions_count += 1

    conn.commit()
    conn.close()
    print(f"Successfully inserted {transactions_count} mock transactions for 2025.")

if __name__ == "__main__":
    generate_mock_data()
