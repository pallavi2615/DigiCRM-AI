from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash, verify_password

db = SessionLocal()

PASSWORD = "DigiCRM@2025"

users = db.query(User).all()
print(f"Found {len(users)} users. Resetting passwords to '{PASSWORD}'...\n")

for user in users:
    new_hash = get_password_hash(PASSWORD)
    user.password_hash = new_hash
    
    is_valid = verify_password(PASSWORD, new_hash)
    print(f"{'✅' if is_valid else '❌'} {user.email}")
    print(f"   Role: {user.role}")
    print(f"   New hash: {new_hash[:50]}...")

db.commit()
db.close()

print(f"\n🎉 All passwords set to: {PASSWORD}")
print(f"\nNow login with:")
print(f"  Email: superadmin@digicrm.demo")
print(f"  Password: {PASSWORD}")