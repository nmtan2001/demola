import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from feedback.dashboard import run_dashboard

if __name__ == "__main__":
    run_dashboard()
