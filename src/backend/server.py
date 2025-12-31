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
             # Mock: Fetch all for now, filter logic can be added to SQL later
             
             # In a real app we would get user_id from session
             # For this prototype we will fetch all or filtered by date if time permits
             
             month = query_params.get('month', [None])[0]
             
             sql = "SELECT * FROM transactions"
             args = []
             
             if month:
                 # Filter by month prefix (YYYY-MM)
                 sql += " WHERE date LIKE ?"
                 args.append(f"{month}%")
                 
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
                     "source": row['source']
                 })
                 
             self._set_headers(200)
             self.wfile.write(json.dumps(result).encode())
             
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
                      "source": row['source']
                 })
             
             if export_format == 'csv':
                 import csv
                 import io
                 
                 output = io.StringIO()
                 # Define CSV columns
                 fieldnames = ['id', 'date', 'type', 'category', 'amount', 'currency', 'source', 'description']
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
        
        elif path == '/api/transactions/create':
            user_id = data.get('user_id', 1) # Default to 1 (admin) if not provided
            amount = float(data.get('amount'))
            trans_type = data.get('type')
            category = data.get('category')
            description = data.get('description', '')
            date = data.get('date')
            
            source = data.get('source', 'cash')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('''
                INSERT INTO transactions (user_id, amount, type, category, description, source, date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, amount, trans_type, category, description, source, date))
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
            date = data.get('date')
            
            conn = get_db_connection()
            c = conn.cursor()
            c.execute('''
                UPDATE transactions 
                SET amount = ?, type = ?, category = ?, description = ?, source = ?, date = ?
                WHERE id = ?
            ''', (amount, trans_type, category, description, source, date, trans_id))
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
                            INSERT INTO transactions (user_id, amount, type, category, description, source, date)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (user_id, t.get('amount'), t.get('type'), t.get('category'), 
                              t.get('description', ''), t.get('source', 'cash'), t.get('date')))
                        
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
                            INSERT INTO transactions (user_id, amount, type, category, description, source, date)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (user_id, row['amount'], row['type'], row['category'], 
                              row['description'], row.get('source', 'cash'), row['date']))
                
                conn.commit()
                conn.close()
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode())
                
            except Exception as e:
                print(f"Import error: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": f"Import failed: {str(e)}"}).encode())

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
