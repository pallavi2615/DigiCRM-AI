import getpass
import uuid
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
import bcrypt
import os

load_dotenv()

# def main():
#     print("=== Create Super Admin ===")

#     email = input("Email: ").strip()
#     full_name = input("Full name: ").strip()

#     password = getpass.getpass("Password: ")
#     confirm_password = getpass.getpass("Confirm password: ")

#     if password != confirm_password:
#         print("ERROR: Passwords do not match.")
#         return

#     if len(password) < 8:
#         print("ERROR: Password must be at least 8 characters.")
#         return

#     if len(password.encode("utf-8")) > 72:
#         print("ERROR: Password cannot be longer than 72 bytes.")
#         return

#     try:
#         conn = psycopg2.connect(
#             host=os.getenv("host"),
#             port=os.getenv("port"),
#             dbname=os.getenv("dbname"),
#             user=os.getenv("user"),
#             password=os.getenv("password")
#         )
#         print("Database connected successfully!")

#     except Exception as e:
#         print(f"Error connecting to database: {e}")

#     cur = conn.cursor()

#     try:
#         cur.execute(
#             """
#             SELECT id
#             FROM auth.users
#             WHERE email = %s
#             """,
#             (email,),
#         )

#         if cur.fetchone():
#             print("ERROR: A user with this email already exists.")
#             return

#         # Hash password using bcrypt.
#         # Plain password is never stored in PostgreSQL.
#         password_hash = bcrypt.hashpw(
#             password.encode("utf-8"),
#             bcrypt.gensalt(),
#         ).decode("utf-8")

#         # Convert UUID to string for psycopg2.
#         user_id = str(uuid.uuid4())

#         cur.execute(
#             """
#             INSERT INTO auth.users
#                 (
#                     id,
#                     email,
#                     password_hash,
#                     full_name,
#                     role,
#                     is_active
#                 )
#             VALUES
#                 (%s, %s, %s, %s, %s, %s)
#             RETURNING id
#             """,
#             (
#                 user_id,
#                 email,
#                 password_hash,
#                 full_name,
#                 "superadmin",
#                 True,
#             ),
#         )

#         created_id = cur.fetchone()[0]

#         conn.commit()

#         print()
#         print("Super Admin created successfully.")
#         print("ID   :", created_id)
#         print("Email:", email)
#         print("Role :", "superadmin")

#     except Exception:
#         conn.rollback()
#         raise

#     finally:
#         cur.close()
#         conn.close()

load_dotenv(dotenv_path=Path(__file__).parent / ".env")


def get_connection():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set in .env")
    url = url.replace("postgresql+psycopg://", "postgresql://")
    url = url.replace("postgresql+psycopg2://", "postgresql://")
    return psycopg2.connect(url)


def main():
    print("=== Create Super Admin ===")

    email = input("Email: ").strip()
    full_name = input("Full name: ").strip()

    password = getpass.getpass("Password: ")
    confirm_password = getpass.getpass("Confirm password: ")

    if password != confirm_password:
        print("ERROR: Passwords do not match.")
        return
    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters.")
        return
    if len(password.encode("utf-8")) > 72:
        print("ERROR: Password cannot be longer than 72 bytes.")
        return

    try:
        conn = get_connection()
        print("Database connected successfully!")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT id FROM "users" WHERE email = %s',
                    (email,),
                )
                if cur.fetchone():
                    print("ERROR: A user with this email already exists.")
                    return

                password_hash = bcrypt.hashpw(
                    password.encode("utf-8"),
                    bcrypt.gensalt(),
                ).decode("utf-8")

                cur.execute(
                    """
                    INSERT INTO users
                        (id, email, password_hash, full_name, role, is_active)
                    VALUES
                        (DEFAULT, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (email, password_hash, full_name, "superadmin", True),
                )
                created_id = cur.fetchone()[0]

        print()
        print("Super Admin created successfully.")
        print("ID   :", created_id)
        print("Email:", email)
        print("Role :", "superadmin")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()