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

def calculate_date_range(period, custom_start=None, custom_end=None):
    today = datetime.date.today()
    start_date = None
    end_date = None

    if period == 'this_month':
        start_date = today.replace(day=1)
        # End of this month = Start of next month - 1 day
        next_month = today.replace(day=28) + datetime.timedelta(days=4)
        end_date = next_month.replace(day=1) - datetime.timedelta(days=1)
    elif period == 'last_month':
        last_month_end = today.replace(day=1) - datetime.timedelta(days=1)
        start_date = last_month_end.replace(day=1)
        end_date = last_month_end
    elif period == 'this_year':
        start_date = today.replace(month=1, day=1)
        end_date = today.replace(month=12, day=31)
    elif period == 'last_year':
        start_date = today.replace(year=today.year - 1, month=1, day=1)
        end_date = today.replace(year=today.year - 1, month=12, day=31)
    elif period == 'custom':
        return custom_start, custom_end
    
    # Format as string YYYY-MM-DD if dates are computed
    if start_date:
        start_date = start_date.isoformat()
    if end_date:
        end_date = end_date.isoformat()
        
    return start_date, end_date

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
    for inv in inv_transactions:
        # Assuming investment activity (buy/sell) happens via Bank usually, or we need source column in Inv table
        # JS impl assumed 'bank' impact for investment transactions logic implicitly in 'calculate_stats' earlier?
        # Actually in JS 'logic.py' previously: investment['bank'] += impact. 
        # So we keep that assumption that investment operations hit the Investment Fund Bank Balance.
        
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
            # Dividend: Price treated as Total Amount usually in simple UI, or Price * Qty.
            # Let's stick to (Price * Qty) - Tax for consistency.
            impact = (qty * i_price) - i_tax
            
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
    chart_cats = list(chart_data.keys())
    chart_cash = [chart_data[c]['cash'] for c in chart_cats]
    chart_bank = [chart_data[c]['bank'] for c in chart_cats]
    
    # Aggregates for Frontend Convenience
    total_balance_all = (total['cash'] + total['bank'] + 
                         saving['cash'] + saving['bank'] + 
                         support['cash'] + support['bank'] + 
                         investment['cash'] + investment['bank'] + 
                         together['cash'] + together['bank'])

    return {
        "balances": {
            "total": total,
            "saving": saving,
            "support": support,
            "investment": investment,
            "together": together,
            "grand_total": total_balance_all
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

def calculate_portfolio(user_id, target_currency='VND'):
    rate = get_exchange_rate()
    rows = query_db('SELECT * FROM investment_transactions WHERE user_id = ? ORDER BY date ASC', (user_id,))
    
    holdings = {} # symbol -> { quantity, total_cost, asset_type }
    net_cash_flow = 0.0
    
    for row in rows:
        price = convert_amount(row['price'], 'VND', target_currency, rate)
        fee = convert_amount(row['fee'], 'VND', target_currency, rate)
        tax = convert_amount(row['tax'], 'VND', target_currency, rate)
        qty = row['quantity']
        typ = row['type']
        symbol = row['symbol']
        # sqlite3.Row might not have .get(), use standard access or check keys
        asset_type = row['asset_type'] if 'asset_type' in row.keys() else 'stock'
        
        if symbol not in holdings:
            holdings[symbol] = {'quantity': 0.0, 'total_cost': 0.0, 'asset_type': asset_type}
            
        if typ == 'buy':
            cost = (qty * price) + fee
            holdings[symbol]['quantity'] += qty
            holdings[symbol]['total_cost'] += cost
            net_cash_flow -= cost
        elif typ == 'sell':
            # Average Cost logic
            current_qty = holdings[symbol]['quantity']
            current_cost = holdings[symbol]['total_cost']
            avg_cost = (current_cost / current_qty) if current_qty > 0 else 0
            
            holdings[symbol]['quantity'] -= qty
            holdings[symbol]['total_cost'] -= (avg_cost * qty)
            
            revenue = (qty * price) - fee - tax
            net_cash_flow += revenue
        elif typ == 'dividend':
            income = (qty * price) - tax
            net_cash_flow += income
            
    # Calculate Summary
    active_holdings = []
    total_invested = 0.0
    total_current_value = 0.0
    
    for symbol, data in holdings.items():
        if data['quantity'] > 0.0001:
            avg_price = data['total_cost'] / data['quantity']
            # MOCK: Market Price = Avg Price (since we don't have live API)
            market_price = avg_price 
            current_value = market_price * data['quantity']
            
            total_invested += data['total_cost']
            total_current_value += current_value
            
            active_holdings.append({
                "symbol": symbol,
                "asset_type": data['asset_type'],
                "quantity": round(data['quantity'], 4),
                "avg_price": avg_price,
                "market_price": market_price,
                "total_value": current_value,
                "pl_percent": 0.0 # Mock
            })
            
    total_pl = total_current_value - total_invested
    total_pl_percent = (total_pl / total_invested * 100) if total_invested > 0 else 0.0
    
    return {
        "holdings": active_holdings,
        "summary": {
            "total_invested": total_invested,
            "total_current_value": total_current_value,
            "total_pl_percent": total_pl_percent,
            "net_cash_flow": net_cash_flow
        }
    }
