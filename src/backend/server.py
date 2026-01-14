import http.server
import socketserver
import json
import os
import sys
import mimetypes
from urllib.parse import urlparse, parse_qs
from backend.db import init_db, query_db, get_db_connection
import hashlib
import uuid

# Helper to handle paths relative to the run.py
PORT = 8000
WEB_ROOT = os.path.join(os.getcwd(), 'src', 'frontend')

class ParFinHandler(http.server.BaseHTTPRequestHandler):
    
    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-type', content_type)
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # API Routes
        if path.startswith('/api/'):
            self.handle_api_get(path, parse_qs(parsed_path.query))
            return

        # Static File Serving
        if path == '/':
            path = '/index.html'
            
        # Security: prevent traversing up directories
        safe_path = os.path.normpath(path).lstrip(os.sep)
        file_path = os.path.join(WEB_ROOT, safe_path)
        
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            with open(file_path, 'rb') as f:
                content = f.read()
            self._set_headers(200, mime_type or 'application/octet-stream')
            self.wfile.write(content)
        else:
            self._set_headers(404, 'text/plain')
            self.wfile.write(b'Not Found')

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode())
            return

        parsed_path = urlparse(self.path)
        if parsed_path.path.startswith('/api/'):
            self.handle_api_post(parsed_path.path, data)
        else:
            self._set_headers(404)
            self.wfile.write(b'Not Found')

    # API Handlers
    def handle_api_get(self, path, query_params):
        if path == '/api/auth/check':
             self._set_headers(200)
             self.wfile.write(json.dumps({"status": "ok"}).encode())
        elif path == '/api/transactions':
             # Query params handling
             query = query_params
             
             start_date = query.get('start_date', [None])[0]
             end_date = query.get('end_date', [None])[0]
             category = query.get('category', [None])[0]
             trans_type = query.get('type', [None])[0]
             
             sql = "SELECT * FROM transactions WHERE 1=1"
             args = []
             
             if start_date:
                 sql += " AND date >= ?"
                 args.append(start_date)
             if end_date:
                 sql += " AND date <= ?"
                 args.append(end_date)
             if category and category != 'all':
                 sql += " AND category = ?"
                 args.append(category)
             if trans_type and trans_type != 'all':
                 sql += " AND type = ?"
                 args.append(trans_type)
                 
             sql += " ORDER BY date DESC"
             rows = query_db(sql, args)
             
             # Convert rows to info dicts
             result = []
             for row in rows:
                 result.append({
                     "id": row['id'],
                     "amount": row['amount'],
                     "type": row['type'],
                     "category": row['category'],
                     "description": row['description'],
                     "date": row['date'],
                     "currency": row['currency'],
                     "source": row['source'],
                     "destination": row['destination'] if 'destination' in row.keys() else None,
                     "destination_category": row['destination_category'] if 'destination_category' in row.keys() else None,
                     "fund": row['fund'] if 'fund' in row.keys() else None
                 })
                 
             self._set_headers(200)
             self.wfile.write(json.dumps(result).encode())

        elif path == '/api/users':
             # Admin check should be here ideally
             rows = query_db('SELECT id, username, role, created_at FROM users')
             users = []
             for row in rows:
                 users.append({
                     "id": row['id'],
                     "username": row['username'],
                     "role": row['role'],
                     "created_at": row['created_at']
                 })
             self._set_headers(200)
             self.wfile.write(json.dumps(users).encode())
             
        elif path == '/api/export':
             # Query params: month (YYYY-MM), format (json|csv)
             month = query_params.get('month', [None])[0]
             export_format = query_params.get('format', ['json'])[0]
             
             sql = "SELECT * FROM transactions"
             args = []
             if month and month != 'all':
                 sql += " WHERE date LIKE ?"
                 args.append(f"{month}%")
             
             sql += " ORDER BY date DESC"
             rows = query_db(sql, args)
             
             export_data = []
             for row in rows:
                  export_data.append({
                     "id": row['id'],
                      "amount": row['amount'],
                      "type": row['type'],
                      "category": row['category'],
                      "description": row['description'],
                      "date": row['date'],
                      "currency": row['currency'],
                      "source": row['source'],
                      "source": row['source'],
                      "destination": row['destination'] if 'destination' in row.keys() else None,
                      "destination_category": row['destination_category'] if 'destination_category' in row.keys() else None,
                      "fund": row['fund'] if 'fund' in row.keys() else None
                 })
             
             if export_format == 'csv':
                 import csv
                 import io
                 
                 output = io.StringIO()
                 # Define CSV columns
                 fieldnames = ['id', 'date', 'type', 'category', 'amount', 'currency', 'source', 'fund', 'description']
                 writer = csv.DictWriter(output, fieldnames=fieldnames)
                 
                 writer.writeheader()
                 for row in export_data:
                     writer.writerow(row)
                 
                 csv_content = output.getvalue()
                 
                 self.send_response(200)
                 self.send_header('Content-type', 'text/csv')
                 self.send_header('Content-Disposition', f'attachment; filename="transactions_{month or "all"}.csv"')
                 self.end_headers()
                 self.wfile.write(csv_content.encode('utf-8'))
                 
             else:
                 # Default JSON
                 self.send_response(200)
                 self.send_header('Content-type', 'application/json')
                 self.send_header('Content-Disposition', f'attachment; filename="transactions_{month or "all"}.json"')
                 self.end_headers()
                 self.wfile.write(json.dumps(export_data, indent=2).encode('utf-8'))

        elif path == '/api/fixed_items':
             # Fetch all fixed items for user (default 1 for now)
             user_id = 1
             items = query_db('SELECT * FROM fixed_items WHERE user_id = ?', (user_id,))
             
             result = []
             for item in items:
                 result.append({
                     "id": item['id'],
                     "amount": item['amount'],
                     "type": item['type'],
                     "category": item['category'],
                     "description": item['description'],
                     "source": item['source'],
                     "destination": item['destination'] if 'destination' in item.keys() else None,
                     "destination_category": item['destination_category'] if 'destination_category' in item.keys() else None,
                     "fund": item['fund'] if 'fund' in item.keys() else None
                 })
             
             self._set_headers(200)
             self.wfile.write(json.dumps(result).encode())

        elif path == '/api/settings':
             # Fetch all settings
             rows = query_db('SELECT * FROM settings')
             settings = {row['key']: row['value'] for row in rows}
             
             self._set_headers(200)
             self.wfile.write(json.dumps(settings).encode())


        elif path == '/api/investments':
             # Fetch all investment transactions
             # In a real app we would get user_id from session
             user_id = 1
             
             rows = query_db('SELECT * FROM investment_transactions WHERE user_id = ? ORDER BY date DESC', (user_id,))
             
             result = []
             for row in rows:
                 result.append({
                     "id": row['id'],
                     "date": row['date'],
                     "symbol": row['symbol'],
                     "asset_type": row['asset_type'] if 'asset_type' in row.keys() else 'stock',
                     "type": row['type'],
                     "quantity": row['quantity'],
                     "price": row['price'],
                     "fee": row['fee'],
                     "tax": row['tax'],
                     "notes": row['notes']
                 })
             
             self._set_headers(200)
             self.wfile.write(json.dumps(result).encode())

        else:
             self._set_headers(404)
             self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())

    def handle_api_post(self, path, data):
        if path == '/api/auth/login':
            username = data.get('username')
            password = data.get('password')
            
            # Hash generic
            pw_hash = hashlib.sha256(password.encode()).hexdigest()
            
            user = query_db('SELECT * FROM users WHERE username = ? AND password_hash = ?', 
                            (username, pw_hash), one=True)
            
            if user:
                self._set_headers(200)
                # In real app, set Set-Cookie header here
                self.wfile.write(json.dumps({
                    "success": True, 
                    "user": {"username": user['username'], "role": user['role']}
                }).encode())
            else:
                self._set_headers(401)
                self.wfile.write(json.dumps({"success": False, "error": "Invalid credentials"}).encode())
                
        elif path == '/api/users/create':
            # Check for admin role (mock logic for now, implementing session later)
            # if not is_admin: return 403
            username = data.get('username')
            password = data.get('password')
            role = data.get('role', 'user')
            
            try:
                pw_hash = hashlib.sha256(password.encode()).hexdigest()
                conn = get_db_connection()
                c = conn.cursor()
                c.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                          (username, pw_hash, role))
                conn.commit()
                conn.close()
                self._set_headers(201)
                self.wfile.write(json.dumps({"success": True}).encode())
            except sqlite3.IntegrityError:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "User already exists"}).encode())

        elif path == '/api/users/delete':
            user_id = data.get('id')
            if not user_id:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "User ID required"}).encode())
                return
                
            # Prevent deleting the main admin for safety
            # In a real app, strict permission checks needed
            if user_id == 1: 
                 self._set_headers(403)
                 self.wfile.write(json.dumps({"error": "Cannot delete root admin"}).encode())
                 return

            conn = get_db_connection()
            c = conn.cursor()
            c.execute('DELETE FROM users WHERE id = ?', (user_id,))
            conn.commit()
            conn.close()
            
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True}).encode())
        
        elif path == '/api/transactions/create':
            user_id = data.get('user_id', 1) # Default to 1 (admin) if not provided
            amount = float(data.get('amount'))
            trans_type = data.get('type')
            category = data.get('category')
            description = data.get('description', '')
            date = data.get('date')
            currency = data.get('currency', 'VND')
            
            source = data.get('source', 'cash')
            destination = data.get('destination')
            destination_category = data.get('destination_category')
            fund = data.get('fund')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('''
                INSERT INTO transactions (user_id, amount, currency, type, category, description, source, destination, destination_category, fund, date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, amount, currency, trans_type, category, description, source, destination, destination_category, fund, date))
            conn.commit()
            conn.close()
            
            self._set_headers(201)
            self.wfile.write(json.dumps({"success": True}).encode())

        elif path == '/api/transactions/update':
            # Check owner in real app
            trans_id = data.get('id')
            amount = float(data.get('amount'))
            trans_type = data.get('type')
            category = data.get('category')
            description = data.get('description', '')
            source = data.get('source', 'cash')
            destination = data.get('destination')
            destination_category = data.get('destination_category')
            fund = data.get('fund')
            date = data.get('date')
            currency = data.get('currency', 'VND')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('''
                UPDATE transactions 
                SET amount = ?, currency = ?, type = ?, category = ?, description = ?, source = ?, destination = ?, destination_category = ?, fund = ?, date = ?
                WHERE id = ?
            ''', (amount, currency, trans_type, category, description, source, destination, destination_category, fund, date, trans_id))
            conn.commit()
            conn.close()
            
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True}).encode())

        elif path == '/api/transactions/delete':
            trans_id = data.get('id')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('DELETE FROM transactions WHERE id = ?', (trans_id,))
            conn.commit()
            conn.close()
            
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True}).encode())

        elif path == '/api/import':
            # Data format: { "format": "csv"|"json", "data": "..." }
            import_format = data.get('format')
            import_data = data.get('data')
            
            if not import_format or not import_data:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Missing format or data"}).encode())
                return

            try:
                conn = get_db_connection()
                c = conn.cursor()
                
                # Assume user_id = 1 for now
                user_id = 1
                
                if import_format == 'json':
                    # Expecting import_data to be a list of dicts or a JSON string representing list of dicts
                    # If it came from client as object, standard use case.
                    transactions = import_data if isinstance(import_data, list) else json.loads(import_data)
                    
                    for t in transactions:
                        # minimal validation
                         c.execute('''
                            INSERT INTO transactions (user_id, amount, type, category, description, source, fund, date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (user_id, t.get('amount'), t.get('type'), t.get('category'), 
                              t.get('description', ''), t.get('source', 'cash'), t.get('fund'), t.get('date')))
                        
                elif import_format == 'csv':
                    # Parse CSV string
                    import csv
                    import io
                    
                    # Fix: Handle potential variation in line endings or quotes
                    f = io.StringIO(import_data)
                    reader = csv.DictReader(f)
                    
                    # Expected CSV headers: amount,type,category,description,source,date
                    for row in reader:
                        c.execute('''
                            INSERT INTO transactions (user_id, amount, type, category, description, source, fund, date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (user_id, row['amount'], row['type'], row['category'], 
                              row['description'], row.get('source', 'cash'), row.get('fund'), row['date']))
                
                conn.commit()
                conn.close()
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode())
                
            except Exception as e:
                print(f"Import error: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": f"Import failed: {str(e)}"}).encode())

        elif path == '/api/fixed_items/create':
            user_id = data.get('user_id', 1)
            amount = float(data.get('amount'))
            item_type = data.get('type')
            category = data.get('category')
            description = data.get('description', '')
            source = data.get('source', 'cash')
            destination = data.get('destination')
            destination_category = data.get('destination_category')
            fund = data.get('fund')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('''
                INSERT INTO fixed_items (user_id, amount, type, category, description, source, destination, destination_category, fund)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, amount, item_type, category, description, source, destination, destination_category, fund))
            conn.commit()
            conn.close()
            
            self._set_headers(201)
            self.wfile.write(json.dumps({"success": True}).encode())

        elif path == '/api/fixed_items/update':
            item_id = data.get('id')
            amount = float(data.get('amount'))
            item_type = data.get('type')
            category = data.get('category')
            description = data.get('description', '')
            source = data.get('source', 'cash')
            destination = data.get('destination')
            destination_category = data.get('destination_category')
            fund = data.get('fund')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('''
                UPDATE fixed_items 
                SET amount = ?, type = ?, category = ?, description = ?, source = ?, destination = ?, destination_category = ?, fund = ?
                WHERE id = ?
            ''', (amount, item_type, category, description, source, destination, destination_category, fund, item_id))
            conn.commit()
            conn.close()
            
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True}).encode())

        elif path == '/api/fixed_items/delete':
            item_id = data.get('id')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('DELETE FROM fixed_items WHERE id = ?', (item_id,))
            conn.commit()
            conn.close()
            
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True}).encode())

        elif path == '/api/fixed_items/generate':
            # Generate transactions from fixed items for a specific month/date
            user_id = data.get('user_id', 1)
            target_date = data.get('date') # Format: YYYY-MM-DD
            
            if not target_date:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Date is required"}).encode())
                return

            conn = get_db_connection()
            c = conn.cursor()
            
            # Get all fixed items
            c.execute('SELECT * FROM fixed_items WHERE user_id = ?', (user_id,))
            items = c.fetchall()
            
            if not items:
                conn.close()
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True, "count": 0, "message": "No fixed items found"}).encode())
                return

            count = 0
            for item in items:
                c.execute('''
                    INSERT INTO transactions (user_id, amount, type, category, description, source, destination, destination_category, fund, date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, item['amount'], item['type'], item['category'], 
                      item['description'], item['source'], 
                      item['destination'] if 'destination' in item.keys() else None,
                      item['destination_category'] if 'destination_category' in item.keys() else None,
                      item['fund'] if 'fund' in item.keys() else None, target_date))
                count += 1
                
            conn.commit()
            conn.close()
            
            self._set_headers(201)
            self.wfile.write(json.dumps({"success": True, "count": count}).encode())

        elif path == '/api/settings/update':
            # Update settings. Expects data to be a dict of key-value pairs
            # e.g. { "exchange_rate_usd_vnd": "24500" }
            
            try:
                conn = get_db_connection()
                c = conn.cursor()
                
                for key, value in data.items():
                    # Upsert logic
                    c.execute('''
                        INSERT INTO settings (key, value) VALUES (?, ?)
                        ON CONFLICT(key) DO UPDATE SET value=excluded.value
                    ''', (key, str(value)))
                    
                conn.commit()
                conn.close()
                
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode())
            except Exception as e:
                print(f"Settings update error: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif path == '/api/investments/create':
            user_id = data.get('user_id', 1)
            date = data.get('date')
            symbol = data.get('symbol')
            asset_type = data.get('asset_type', 'stock')
            trans_type = data.get('type')
            quantity = float(data.get('quantity', 0))
            price = float(data.get('price', 0))
            fee = float(data.get('fee', 0))
            tax = float(data.get('tax', 0))
            notes = data.get('notes', '')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('''
                INSERT INTO investment_transactions (user_id, date, symbol, asset_type, type, quantity, price, fee, tax, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, date, symbol, asset_type, trans_type, quantity, price, fee, tax, notes))
            conn.commit()
            conn.close()
            
            self._set_headers(201)
            self.wfile.write(json.dumps({"success": True}).encode())

        elif path == '/api/investments/delete':
            trans_id = data.get('id')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('DELETE FROM investment_transactions WHERE id = ?', (trans_id,))
            conn.commit()
            conn.close()
            
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True}).encode())

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def run_server():
    init_db()
    # Change to root dir so imports work correctly from src/backend if needed, 
    # but we are running from root using run.py, so we should be good.
    
    with ReusableTCPServer(("", PORT), ParFinHandler) as httpd:
        print(f"ParFin serving at port {PORT}")
        httpd.serve_forever()
