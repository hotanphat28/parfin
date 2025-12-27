import urllib.request
import urllib.parse
import json
import time
import threading
import sys
import os
import random
import statistics
import sqlite3

# Ensure we can import backend code for fast seeding
sys.path.append(os.path.join(os.getcwd(), 'src'))
from backend.db import get_db_connection

BASE_URL = "http://127.0.0.1:8000/api"

class PerformanceTest:
    def __init__(self):
        self.results = {}

    def log(self, message):
        print(f"[PerfTest] {message}")

    def seed_data(self, count=1000):
        self.log(f"Seeding {count} transactions directly to DB...")
        conn = get_db_connection()
        c = conn.cursor()
        
        # Batch insert for speed
        params = []
        for i in range(count):
            params.append((
                1, # user_id
                random.uniform(10.0, 5000000.0),
                random.choice(['income', 'expense']),
                random.choice(['Food', 'Salary', 'Rent', 'Entertainment', 'Transport']),
                f"Mock Data {i}",
                'cash',
                '2023-10-27'
            ))
            
        c.executemany('''
            INSERT INTO transactions (user_id, amount, type, category, description, source, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', params)
        conn.commit()
        conn.close()
        self.log("Seeding complete.")

    def measure_request(self, method, endpoint, data=None):
        url = f"{BASE_URL}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        req_data = json.dumps(data).encode('utf-8') if data else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        
        start = time.time()
        try:
            with urllib.request.urlopen(req) as response:
                response.read() # Read body to ensure complete
                status = response.status
        except Exception as e:
            status = 'error'
            # self.log(f"Request failed: {e}")
        end = time.time()
        
        return end - start, status

    def test_load_latency(self):
        self.log("\n--- Testing Load Latency (/api/transactions) ---")
        
        # 1. Baseline (Empty or small DB)
        # Note: We append, so DB grows.
        
        sizes = [100, 1000] # reduced for speed, can increase
        for size in sizes:
            self.seed_data(size)
            
            latencies = []
            for _ in range(5): # 5 runs
                duration, status = self.measure_request('GET', '/transactions')
                if status == 200:
                    latencies.append(duration)
            
            if latencies:
                avg = statistics.mean(latencies)
                self.log(f"DB Size ~{size}+: Avg Latency = {avg:.4f}s")
            else:
                self.log(f"DB Size ~{size}+: All requests failed!")

    def test_concurrency(self, num_threads=10):
        self.log(f"\n--- Testing Concurrency ({num_threads} threads) ---")
        
        failed_count = 0
        latencies = []
        
        def worker():
            nonlocal failed_count
            # Mix of Login and Get Transactions
            ops = [
                ('POST', '/auth/login', {"username": "admin", "password": "admin123"}),
                ('GET', '/transactions', None)
            ]
            op = random.choice(ops)
            
            duration, status = self.measure_request(op[0], op[1], op[2])
            if status != 200:
                # Thread safe increment? simple int in callback is not thread safe conceptually 
                # but valid in CPython due to GIL for single opcode, still, let's just log failure.
                # Actually, for report, just append to list and process later
                latencies.append(-1)
            else:
                latencies.append(duration)

        threads = []
        start_global = time.time()
        for _ in range(num_threads):
            t = threading.Thread(target=worker)
            threads.append(t)
            t.start()
            
        for t in threads:
            t.join()
        end_global = time.time()
            
        successes = [l for l in latencies if l >= 0]
        fails = len(latencies) - len(successes)
        
        self.log(f"Total time: {end_global - start_global:.4f}s")
        self.log(f"Successful requests: {len(successes)}")
        self.log(f"Failed requests: {fails}")
        if successes:
            self.log(f"Avg Latency (concurrent): {statistics.mean(successes):.4f}s")

    def run(self):
        self.log("Starting Performance Tests...")
        
        # Ensure server is up (simple check)
        try:
            self.measure_request('GET', '/auth/check')
        except:
            self.log("Server not reachable at localhost:8000. Please start it.")
            return

        self.test_concurrency(num_threads=20) # Quick concurrency check
        self.test_load_latency()              # Data scaling check

if __name__ == "__main__":
    t = PerformanceTest()
    t.run()
