import datetime
from backend.db import query_db

def get_exchange_rate():
    # Fetch rate from DB, default to 25000 if not found
    row = query_db("SELECT value FROM settings WHERE key = ?", ('exchange_rate_usd_vnd',), one=True)
    if row:
        return float(row['value'])
    return 25000.0

def convert_amount(amount, from_currency, target_currency, rate):
    if from_currency == target_currency:
        return amount
    
    if from_currency == 'VND' and target_currency == 'USD':
        return amount / rate
    elif from_currency == 'USD' and target_currency == 'VND':
        return amount * rate
    
    return amount

def calculate_stats(user_id, start_date, end_date, target_currency='VND'):
    rate = get_exchange_rate()
    
    # 1. Fetch EVERYTHING for GLOBAL Balances
    all_transactions = query_db("SELECT * FROM transactions WHERE user_id = ?", (user_id,))
    # Investment transactions also affect Investment Balance (Cash/Bank)
    inv_transactions = query_db("SELECT * FROM investment_transactions WHERE user_id = ?", (user_id,))
    
    # Initialize Balances
    total = {'cash': 0.0, 'bank': 0.0}
    saving = {'cash': 0.0, 'bank': 0.0}
    support = {'cash': 0.0, 'bank': 0.0}
    investment = {'cash': 0.0, 'bank': 0.0}
    together = {'cash': 0.0, 'bank': 0.0}
    
    # Helper to map source string to key
    def get_source(s):
        return 'bank' if s == 'bank' else 'cash'
    
    fund_categories = ['Saving', 'Support', 'Investment', 'Together']

    # --- Calculate Global Balances ---
    for t in all_transactions:
        amount = convert_amount(t['amount'], t['currency'], target_currency, rate)
        source = get_source(t['source'])
        cat = t['category']
        typ = t['type']
        fund = t['fund']
        
        if typ == 'income':
            if cat in fund_categories:
                if cat == 'Saving': saving[source] += amount
                elif cat == 'Support': support[source] += amount
                elif cat == 'Investment': investment[source] += amount
                elif cat == 'Together': together[source] += amount
            else:
                total[source] += amount
                
        elif typ == 'expense':
            if fund:
                fund_source = source # Funds have their own source tracking?
                # Based on JS: if t.fund, we subtract from that fund's balance
                if fund == 'Saving': saving[fund_source] -= amount
                elif fund == 'Support': support[fund_source] -= amount
                elif fund == 'Investment': investment[fund_source] -= amount
                elif fund == 'Together': together[fund_source] -= amount
            else:
                total[source] -= amount
                # Legacy allocation via expense logic from JS
                if cat == 'Saving': saving[source] += amount
                elif cat == 'Support': support[source] += amount
                elif cat == 'Investment': investment[source] += amount
                elif cat == 'Together': together[source] += amount
                
        elif typ == 'allocation':
            # Allocation subtracts from source
            if cat in fund_categories:
                 if cat == 'Saving': saving[source] -= amount
                 elif cat == 'Support': support[source] -= amount
                 elif cat == 'Investment': investment[source] -= amount
                 elif cat == 'Together': together[source] -= amount
            else:
                 total[source] -= amount
            
            # And adds to destination
            dest_source = get_source(t['destination'])
            dest_cat = t['destination_category']
            
            if dest_cat == 'Saving': saving[dest_source] += amount
            elif dest_cat == 'Support': support[dest_source] += amount
            elif dest_cat == 'Investment': investment[dest_source] += amount
            elif dest_cat == 'Together': together[dest_source] += amount
            else:
                total[dest_source] += amount

    # Investment Ledger Impact
    # JS Logic:
    # buy -> impact = -1 * ((quantity * price) + fee)
    # sell -> impact = (quantity * price) - fee - tax
    # dividend -> impact = (quantity * price) - tax
    for inv in inv_transactions:
        # Investment transactions don't store currency, assuming they are in base currency or same as settings? 
        # JS `utils.js` convertAmount used convertAmount(inv.price, 'VND') so it assumes it needs conversion. 
        # But `investment_transactions` table doesn't have a currency column. 
        # We will assume they are in VND for simplicity or same logic as JS 'convertAmount(inv.price, 'VND')' 
        # effectively does nothing if fromCurrency defaults to VND. 
        # Let's check JS again.
        # JS: const price = convertAmount(inv.price, 'VND'); -> convertAmount(val, 'VND') returns val if target is VND.
        # So it implies Investment Transactions are recorded in VND? Or user just inputs numbers.
        # We will assume values are in system base currency (VND) effectively.
        
        # Wait, if target_currency is USD, we need to convert these values.
        # We treat input values as VND (Base)
        
        i_price = convert_amount(inv['price'], 'VND', target_currency, rate)
        i_fee = convert_amount(inv['fee'], 'VND', target_currency, rate)
        i_tax = convert_amount(inv['tax'], 'VND', target_currency, rate)
        qty = inv['quantity']
        
        impact = 0.0
        if inv['type'] == 'buy':
            impact = -1 * ((qty * i_price) + i_fee)
        elif inv['type'] == 'sell':
            impact = (qty * i_price) - i_fee - i_tax
        elif inv['type'] == 'dividend':
            impact = (qty * i_price) - i_tax
            
        # JS assumes bank for investments activity
        investment['bank'] += impact

    # --- Period Stats (Income/Expense for selected period) ---
    monthly_income = 0.0
    monthly_income_stats = {'cash': 0.0, 'bank': 0.0}
    monthly_expense = 0.0
    monthly_expense_stats = {'cash': 0.0, 'bank': 0.0}
    
    # Fetch Filtered Transactions
    sql = "SELECT * FROM transactions WHERE 1=1"
    args = []
    if start_date:
        sql += " AND date >= ?"
        args.append(start_date)
    if end_date:
        sql += " AND date <= ?"
        args.append(end_date)
    
    filtered_transactions = query_db(sql, args)
    
    # Chart Data Setup
    chart_data = {} # category -> {cash: 0, bank: 0}

    allocation_categories = ['Saving', 'Support', 'Investment', 'Together']

    for t in filtered_transactions:
        amount = convert_amount(t['amount'], t['currency'], target_currency, rate)
        source = get_source(t['source'])
        cat = t['category']
        typ = t['type']
        
        if typ == 'income':
            monthly_income += amount
            monthly_income_stats[source] += amount
        elif typ == 'expense':
            if cat not in allocation_categories:
                monthly_expense += amount
                monthly_expense_stats[source] += amount
                
                # Chart Data (Expenses only, excl allocations)
                if cat not in chart_data:
                    chart_data[cat] = {'cash': 0.0, 'bank': 0.0}
                chart_data[cat][source] += amount

    # Format Chart Data for Frontend
    # JS expects: labels, cashData, bankData
    chart_cats = list(chart_data.keys())
    chart_cash = [chart_data[c]['cash'] for c in chart_cats]
    chart_bank = [chart_data[c]['bank'] for c in chart_cats]

    return {
        "balances": {
            "total": total,
            "saving": saving,
            "support": support,
            "investment": investment,
            "together": together
        },
        "period_stats": {
            "income": {
                "total": monthly_income,
                "cash": monthly_income_stats['cash'],
                "bank": monthly_income_stats['bank']
            },
            "expense": {
                "total": monthly_expense,
                "cash": monthly_expense_stats['cash'],
                "bank": monthly_expense_stats['bank']
            }
        },
        "chart_data": {
            "labels": chart_cats,
            "datasets": {
                "cash": chart_cash,
                "bank": chart_bank
            }
        }
    }
