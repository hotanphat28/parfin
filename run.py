import sys
import os

# Ensure src is in pythonpath
sys.path.append(os.path.join(os.getcwd(), 'src'))

from backend.server import run_server

if __name__ == '__main__':
    run_server()
