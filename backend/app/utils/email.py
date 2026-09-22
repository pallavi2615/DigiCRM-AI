import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from app.core.config import settings


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """SMTP se email bhejo."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        # Plain text version
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))

        # HTML version
        msg.attach(MIMEText(html_body, "html"))

        # Send
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False


def send_reset_password_email(to_email: str, reset_token: str, user_name: str = "User") -> bool:
    """Password reset email bhejo."""
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    subject = "Reset Your Password - DigiCRM AI"

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2 style="color: #4F46E5;">Password Reset Request</h2>
            <p>Hi {user_name},</p>
            <p>We received a request to reset your DigiCRM account password. Click the button below to create a new password.
                    </p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}"
                   style="background: #4F46E5; color: white; padding: 12px 30px;
                          text-decoration: none; border-radius: 6px;">
                    Reset Password
                </a>
            </p>
            <p>Ya ye link copy karo:</p>
            <p style="word-break: break-all; color: #666;">{reset_link}</p>
            <p><strong>Ye link {settings.RESET_TOKEN_EXPIRE_MINUTES} minute me expire ho jayega.</strong></p>
            <p>If you did not request a password reset, you can safely ignore this email.</p>
            <br>
            <p>Regards,<br>DigiCRM AI Team</p>
        </body>
    </html>
    """

    text_body = f"""
    Password Reset Request

    Hi {user_name},

    Reset your password: {reset_link}

    This link will expire in {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes.

    If you didn't request this, ignore this email.

    - DigiCRM AI
    """

    return send_email(to_email, subject, html_body, text_body)


def send_welcome_email(to_email: str, user_name: str, company_name: str) -> bool:
    """Welcome email after signup."""
    subject = "Welcome to DigiCRM AI"

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2 style="color: #4F46E5;">Welcome to DigiCRM AI! 🎉</h2>
            <p>Hi {user_name},</p>
            <p>Aapki company <strong>{company_name}</strong> successfully onboard ho gayi hai.</p>
            <p>Ab aap apne dashboard me login karke leads, proposals aur webhook manage kar sakte ho.</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{settings.FRONTEND_URL}/login"
                   style="background: #4F46E5; color: white; padding: 12px 30px;
                          text-decoration: none; border-radius: 6px;">
                    Go to Dashboard
                </a>
            </p>
            <p>Regards,<br>DigiCRM AI Team</p>
        </body>
    </html>
    """

    return send_email(to_email, subject, html_body)