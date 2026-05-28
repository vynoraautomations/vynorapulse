#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

try:
    from backend.app.api import admin
    print("✓ admin.py imports successfully")
    print(f"✓ Router found: {admin.router}")
    print(f"✓ admin_connect_whatsapp endpoint exists: {hasattr(admin, 'admin_connect_whatsapp')}")
except Exception as e:
    print(f"✗ Import failed: {e}")
    import traceback
    traceback.print_exc()
