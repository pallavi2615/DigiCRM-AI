from app.database import SessionLocal
from app.models import User
from app.auth import verify_password, get_password_hash

db = SessionLocal()

print("=" * 70)
print("LOGIN DEBUG V2")
print("=" * 70)

# Users count
total = db.query(User).count()
print(f"\n[1] Total users in 'users_details': {total}")

if total == 0:
    print("\n❌ Table is EMPTY — need to create users")
    db.close()
    exit()

# List all users
print(f"\n[2] All users:")
users = db.query(User).all()
for u in users:
    print(f"    ID: {u.id} | Email: {u.email} | Role: {u.role}")

# Test login
print(f"\n[3] Testing login:")
email = "superadmin@digicrm.demo"
password = "DigiCRM@2025"

print(f"    Email: '{email}'")
print(f"    Password: '{password}'")

user = db.query(User).filter(User.email == email).first()

if not user:
    print(f"\n❌ User NOT FOUND with email: '{email}'")
    print(f"\n    Available emails:")
    for u in users:
        print(f"    - '{u.email}'")
else:
    print(f"\n✅ User found: {user.email}")
    print(f"    Hash: {user.password_hash[:50]}...")
    
    try:
        is_valid = verify_password(password, user.password_hash)
        print(f"    Password valid? {is_valid}")
        
        if is_valid:
            print(f"\n    ✅ LOGIN SHOULD WORK")
        else:
            print(f"\n    ❌ PASSWORD MISMATCH")
            print(f"\n    Fix: Run set_test_users.py to reset password")
    except Exception as e:
        print(f"\n    ❌ Error: {type(e).__name__}: {e}")

db.close()
print("\n" + "=" * 70)