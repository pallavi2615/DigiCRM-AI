"""
Password utility — generate strong temporary passwords.
"""

import secrets
import string


LOWERCASE = string.ascii_lowercase
UPPERCASE = string.ascii_uppercase
DIGITS = string.digits
SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?"


def generate_temp_password(length: int = 12) -> str:
    """
    Generate a strong random password guaranteed to include:
      - at least one uppercase letter
      - at least one lowercase letter
      - at least one digit
      - at least one symbol
    """
    if length < 8:
        length = 8

    password_chars = [
        secrets.choice(LOWERCASE),
        secrets.choice(UPPERCASE),
        secrets.choice(DIGITS),
        secrets.choice(SYMBOLS),
    ]

    all_chars = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS
    for _ in range(length - len(password_chars)):
        password_chars.append(secrets.choice(all_chars))

    secrets.SystemRandom().shuffle(password_chars)

    return "".join(password_chars)


def check_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate a password:
      - >= 8 chars
      - at least one lowercase
      - at least one uppercase
      - at least one digit
      - at least one symbol
    Returns (is_valid, error_message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not any(c.islower() for c in password):
        return False, "Password must contain a lowercase letter"
    if not any(c.isupper() for c in password):
        return False, "Password must contain an uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain a digit"
    if not any(c in SYMBOLS for c in password):
        return False, "Password must contain a symbol (!@#$...)"
    return True, ""