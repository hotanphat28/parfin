import unittest
import urllib.request
import json
import time
import sys
import os
import threading
from http.server import HTTPServer

# Helper to import backend modules
sys.path.append(os.path.join(os.getcwd(), 'src'))
from backend.db import get_db_connection, init_db

BASE_URL = "http://127.0.0.1:8000/api"

class TestImportExport(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # We assume server is running on port 8000
        pass

    def request(self, method, endpoint, data=None):
        url = f"{BASE_URL}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        req_data = json.dumps(data).encode('utf-8') if data else None
        
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, response.read().decode('utf-8'), response.getheader('Content-Disposition')
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode('utf-8'), None

    def test_01_export_json(self):
        print("\nTesting JSON Export...")
        status, body, content_disp = self.request('GET', '/export?format=json&month=all')
        self.assertEqual(status, 200)
        self.assertIn('attachment', content_disp) # Just check attachment presence
        data = json.loads(body)
        self.assertIsInstance(data, list)
        print(f"Exported {len(data)} transactions")

    def test_02_export_csv(self):
        print("\nTesting CSV Export...")
        status, body, content_disp = self.request('GET', '/export?format=csv&month=all')
        self.assertEqual(status, 200)
        self.assertIn('attachment', content_disp)
        lines = body.strip().split('\n')
        self.assertGreater(len(lines), 0)
        # Check headers
        headers = lines[0].split(',')
        self.assertIn('amount', headers)
        self.assertIn('date', headers)
        print("CSV Headers verified")

    def test_03_import_json(self):
        print("\nTesting JSON Import...")
        new_tx = [{
            "amount": 500000,
            "type": "income",
            "category": "Salary",
            "description": "Test Import JSON",
            "date": "2023-12-01",
            "source": "bank"
        }]
        
        status, body, _ = self.request('POST', '/import', {
            "format": "json",
            "data": new_tx
        })
        self.assertEqual(status, 200)
        
        # Verify it exists
        status, body, _ = self.request('GET', '/export?format=json&month=all')
        data = json.loads(body)
        found = any(t['description'] == "Test Import JSON" for t in data)
        self.assertTrue(found)
        print("JSON Import Verified")

    def test_04_import_csv(self):
        print("\nTesting CSV Import...")
        csv_data = "amount,type,category,description,source,date\n150000,expense,Food,Test Import CSV,cash,2023-12-02"
        
        status, body, _ = self.request('POST', '/import', {
            "format": "csv",
            "data": csv_data
        })
        self.assertEqual(status, 200)
        
        # Verify it exists
        status, body, _ = self.request('GET', '/export?format=json&month=all')
        data = json.loads(body)
        found = any(t['description'] == "Test Import CSV" for t in data)
        self.assertTrue(found)
        print("CSV Import Verified")

if __name__ == '__main__':
    unittest.main()
