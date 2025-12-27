import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://localhost:8000/api"

def run_test(name, func):
    print(f"Running {name}...", end=" ")
    try:
        func()
        print("PASSED")
    except Exception as e:
        print(f"FAILED: {e}")
        # print details
        import traceback
        traceback.print_exc()

def test_login():
    url = f"{BASE_URL}/auth/login"
    data = json.dumps({"username": "admin", "password": "admin123"}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    
    with urllib.request.urlopen(req) as response:
        if response.status != 200:
            raise Exception(f"Status code {response.status}")
        res_json = json.load(response)
        if not res_json.get("success"):
            raise Exception("Login returned success=False")
        if res_json["user"]["username"] != "admin":
            raise Exception("Wrong username returned")

def test_create_transaction():
    url = f"{BASE_URL}/transactions/create"
    data = json.dumps({
        "user_id": 1,
        "amount": 50000,
        "type": "expense",
        "category": "Food",
        "description": "Test Lunch",
        "date": "2023-10-27"
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    
    with urllib.request.urlopen(req) as response:
        if response.status != 201:
            raise Exception(f"Status code {response.status}")
        res_json = json.load(response)
        if not res_json.get("success"):
            raise Exception("Create transaction failed")

def test_get_transactions():
    url = f"{BASE_URL}/transactions"
    with urllib.request.urlopen(url) as response:
        if response.status != 200:
            raise Exception(f"Status code {response.status}")
        transactions = json.load(response)
        if not isinstance(transactions, list):
            raise Exception("Did not return a list")
        
        # Check if our test transaction is there
        found = False
        for t in transactions:
            if t["description"] == "Test Lunch" and t["amount"] == 50000:
                found = True
                break
        if not found:
            raise Exception("Created transaction not found in list")

if __name__ == "__main__":
    run_test("Login", test_login)
    run_test("Create Transaction", test_create_transaction)
    run_test("Get Transactions", test_get_transactions)
