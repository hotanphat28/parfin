import urllib.request
import urllib.parse
import json
import datetime

BASE_URL = "http://localhost:8000/api"

def make_request(method, endpoint, data=None):
    url = f"{BASE_URL}{endpoint}"
    if data:
        data_bytes = json.dumps(data).encode('utf-8')
    else:
        data_bytes = None
        
    req = urllib.request.Request(url, data=data_bytes, method=method)
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def test_investment_flow():
    print("--- Testing Investment API ---")
    
    # 1. CREATE BUY
    print("\n1. Creating Buy Transaction...")
    payload_buy = {
        "user_id": 1,
        "date": datetime.date.today().isoformat(),
        "symbol": "TESTAPI",
        "type": "buy",
        "quantity": 100,
        "price": 10.5,
        "fee": 1.0,
        "tax": 0,
        "notes": "API Test Buy"
    }
    status, resp = make_request("POST", "/investments/create", payload_buy)
    print(f"Status: {status}, Response: {resp}")
    assert status == 201
    
    # 2. GET LIST
    print("\n2. Fetching Investments...")
    status, investments = make_request("GET", "/investments")
    print(f"Status: {status}")
    print(f"Type: {type(investments)}")
    print(f"Content: {investments}")
    print(f"Found {len(investments)} investments")
    
    my_inv = next((i for i in investments if i['symbol'] == 'TESTAPI'), None)
    assert my_inv is not None
    print("Found created transaction:", my_inv)
    
    # 3. DELETE
    print("\n3. Deleting Transaction...")
    status, resp = make_request("POST", "/investments/delete", {"id": my_inv['id']})
    print(f"Status: {status}, Response: {resp}")
    assert status == 200
    
    # 4. VERIFY DELETE
    status, investments = make_request("GET", "/investments")
    my_inv = next((i for i in investments if i['symbol'] == 'TESTAPI'), None)
    assert my_inv is None
    print("Transaction successfully deleted.")
    
    print("\n--- API Tests Passed ---")

if __name__ == "__main__":
    try:
        test_investment_flow()
    except Exception as e:
        print(f"\nFAILED: {e}")
