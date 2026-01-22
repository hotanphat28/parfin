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

    # ==========================================
    # 1. Generate Transactions (Income/Expense)
    # ==========================================
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
            
    print(f"Inserted {transactions_count} mock transactions for 2025.")

    # ==========================================
    # 2. Generate Fixed Items
    # ==========================================
    # Fixed items are typically recurring setup. We'll add a few if they don't exist much.
    # We will just add a set of common fixed expenses/incomes.
    fixed_items_data = [
        {'amount': 5000000, 'type': 'expense', 'category': 'Rent', 'description': 'Monthly House Rent', 'source': 'bank'},
        {'amount': 300000, 'type': 'expense', 'category': 'Internet', 'description': 'Fiber Internet', 'source': 'bank'},
        {'amount': 20000000, 'type': 'income', 'category': 'Salary', 'description': 'Main Job Salary', 'source': 'bank'},
        {'amount': 100000, 'type': 'expense', 'category': 'Netflix', 'description': 'Streaming Subscription', 'source': 'cash'},
    ]
    
    fixed_items_count = 0
    for item in fixed_items_data:
        c.execute('''
            INSERT INTO fixed_items (user_id, amount, type, category, description, source)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, item['amount'], item['type'], item['category'], item['description'], item['source']))
        fixed_items_count += 1
        
    print(f"Inserted {fixed_items_count} mock fixed items.")

    # ==========================================
    # 3. Generate Investment Transactions
    # ==========================================
    investment_assets = [
        {'symbol': 'AAPL', 'asset_type': 'stock', 'price_range': (150, 200)},
        {'symbol': 'VN30', 'asset_type': 'fund', 'price_range': (20000, 25000)},
        {'symbol': 'BTC', 'asset_type': 'crypto', 'price_range': (40000, 60000)},
        {'symbol': 'GOVT-BOND', 'asset_type': 'bond', 'price_range': (100000, 100000)},
    ]
    
    inv_types = ['buy', 'buy', 'buy', 'sell'] # More buys than sells
    investment_count = 0
    
    for month in range(1, 13):
        # 1-3 investment transactions per month
        num_inv = random.randint(1, 3)
        for _ in range(num_inv):
            day = random.randint(1, 28)
            date_str = f"2025-{month:02d}-{day:02d}"
            
            asset = random.choice(investment_assets)
            inv_type = random.choice(inv_types)
            
            price = random.uniform(*asset['price_range'])
            quantity = random.randint(1, 10) if asset['asset_type'] != 'crypto' else random.uniform(0.01, 0.1)
            
            # Simple logic: avoid selling what we don't have? 
            # For mock data simplicity, just inserting. The app logic might calculate holdings later.
            
            fee = price * quantity * 0.001 # 0.1% fee
            tax = 0
            if inv_type == 'sell' or inv_type == 'dividend':
                tax = price * quantity * 0.001 # Mock tax
                
            c.execute('''
                INSERT INTO investment_transactions (
                    user_id, date, symbol, asset_type, type, quantity, price, fee, tax, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, date_str, asset['symbol'], asset['asset_type'], inv_type, quantity, price, fee, tax, 'Mock Investment'))
            
            investment_count += 1

    print(f"Inserted {investment_count} mock investment transactions for 2025.")

    conn.commit()
    conn.close()
    print("Mask data generation complete.")

if __name__ == "__main__":
    generate_mock_data()
