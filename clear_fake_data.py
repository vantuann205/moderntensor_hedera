#!/usr/bin/env python3
"""
Clear all fake/mock data and ensure only real Hedera HCS data is used.
"""

import os
import json
from pathlib import Path

def main():
    print("🗑️  Clearing all fake/mock data...")
    
    data_dir = Path(__file__).parent / "data"
    
    # List of data files to clear
    files_to_clear = [
        "miner_registry.json",
        "validator_registry.json", 
        "task_manager.json",
        "emissions.json",
        "treasury_state.json",
        "network_stats.json",
        "activity_feed.json"
    ]
    
    for filename in files_to_clear:
        filepath = data_dir / filename
        if filepath.exists():
            filepath.unlink()
            print(f"  ✓ Deleted {filename}")
    
    # Create empty structure files
    print("\n📝 Creating empty data structure files...")
    
    data_dir.mkdir(exist_ok=True)
    
    # Empty miner registry
    (data_dir / "miner_registry.json").write_text(json.dumps({
        "miners": {},
        "meta": {
            "source": "hedera_hcs_only",
            "note": "All data synced from Hedera HCS. No mock data."
        }
    }, indent=2))
    print("  ✓ Created empty miner_registry.json")
    
    # Empty validator registry
    (data_dir / "validator_registry.json").write_text(json.dumps({
        "validators": {},
        "meta": {
            "source": "hedera_hcs_only",
            "note": "All data synced from Hedera HCS. No mock data."
        }
    }, indent=2))
    print("  ✓ Created empty validator_registry.json")
    
    # Empty task manager
    (data_dir / "task_manager.json").write_text(json.dumps({
        "tasks": {},
        "assignments": {},
        "metrics": {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "total_volume": 0
        },
        "meta": {
            "source": "hedera_hcs_only",
            "note": "All data synced from Hedera HCS. No mock data."
        }
    }, indent=2))
    print("  ✓ Created empty task_manager.json")
    
    # Empty emissions
    (data_dir / "emissions.json").write_text(json.dumps({
        "start_timestamp": 0,
        "total_distributed": 0,
        "epochs": {},
        "meta": {
            "source": "hedera_hcs_only",
            "note": "All data synced from Hedera HCS. No mock data."
        }
    }, indent=2))
    print("  ✓ Created empty emissions.json")
    
    print("\n✅ All fake data cleared!")
    print("\n📌 Next steps:")
    print("   1. Run: python sync_real_data.py")
    print("   2. Or register nodes via dashboard UI")
    print("   3. All data will be 100% from Hedera HCS")

if __name__ == "__main__":
    main()
