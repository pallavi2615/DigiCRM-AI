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
            <p>If the button above does not work, please copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; color: #666;">{reset_link}</p>
            <p><strong>Note:</strong> This link will expire in {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
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
            <p>Your company, <strong>{company_name}</strong>, has been successfully onboarded.</p>
            <p>You can now log in to your dashboard to manage leads, proposals, and webhooks.</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{settings.FRONTEND_URL}/login"
                style="background: #4F46E5; color: white; padding: 12px 30px;
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                    Go to Dashboard
                </a>
            </p>
            <p>Regards,<br>DigiCRM AI Team</p>
        </body>
    </html>
    """

    return send_email(to_email, subject, html_body)

def send_tenant_welcome_with_credentials(
    to_email: str,
    admin_name: str,
    tenant_name: str,
    temp_password: str,
    login_url: Optional[str] = None,
) -> bool:
    """
    Send welcome email to newly onboarded tenant admin with credentials.
    """
    if not login_url:
        login_url = f"{settings.FRONTEND_URL}/auth"

    subject = f"Welcome to DigiCRM — Your {tenant_name} Workspace is Ready"

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
            <h2 style="color: #4F46E5;">Welcome to DigiCRM! 🎉</h2>
            <p>Hi <strong>{admin_name}</strong>,</p>
            <p>
                Your workspace <strong>{tenant_name}</strong> has been
                successfully created. You can now log in and start
                using your CRM.
            </p>

            <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;
                        padding: 20px; margin: 24px 0;">
                <h3 style="margin-top: 0; color: #111827;">Your Login Credentials</h3>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 4px 0; color: #6B7280; width: 120px;">Login URL:</td>
                        <td style="padding: 4px 0;"><a href="{login_url}" style="color: #4F46E5;">{login_url}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #6B7280;">Email:</td>
                        <td style="padding: 4px 0;"><strong>{to_email}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #6B7280;">Temp Password:</td>
                        <td style="padding: 4px 0;">
                            <code style="background: #E5E7EB; padding: 4px 8px;
                                         border-radius: 4px; font-size: 14px;">
                                {temp_password}
                            </code>
                        </td>
                    </tr>
                </table>
            </div>

            <p style="text-align: center; margin: 30px 0;">
                <a href="{login_url}"
                   style="background: #4F46E5; color: white; padding: 12px 30px;
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Login to Your Workspace
                </a>
            </p>

            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B;
                        padding: 12px 16px; margin: 24px 0; border-radius: 4px;">
                <strong>⚠️ Important:</strong> For security, you'll be asked
                to set a new password on your first login.
            </div>

            <p style="color: #6B7280; font-size: 13px;">
                If you did not expect this email or have any questions,
                please contact our support team.
            </p>

            <br>
            <p>Regards,<br><strong>DigiCRM AI Team</strong></p>
        </body>
    </html>
    """

    text_body = f"""
Welcome to DigiCRM!

Hi {admin_name},

Your workspace "{tenant_name}" has been created.

LOGIN CREDENTIALS
-----------------
Login URL:    {login_url}
Email:        {to_email}
Temp Password: {temp_password}

For security, you'll be asked to set a new password on first login.

— DigiCRM AI Team
"""

    return send_email(to_email, subject, html_body, text_body)


def send_proposal_email(
    to_email: str,
    client_name: str,
    proposal_title: str,
    proposal_amount: float,
    proposal_currency: str,
    company_name: str,
    sender_name: str,
    public_url: str,
    valid_until: str = None,
    message: str = None,
) -> bool:
    """
    Send a proposal to the client via email.
    """
    subject = f"Proposal: {proposal_title} from {company_name}"

    amount_str = f"₹{proposal_amount:,.0f}" if proposal_amount else ""

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
        <h2 style="color: #4F46E5;">Proposal: {proposal_title}</h2>

        <p>Hi {client_name or 'there'},</p>

        <p>{message or f'Please find our proposal for <strong>{proposal_title}</strong>.'}</p>

        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;">
            <tr>
              <td style="padding:4px 0;color:#6B7280;width:140px;">Proposal:</td>
              <td style="padding:4px 0;"><strong>{proposal_title}</strong></td>
            </tr>
            {'<tr><td style="padding:4px 0;color:#6B7280;">Amount:</td><td style="padding:4px 0;"><strong>' + amount_str + ' ' + proposal_currency + '</strong></td></tr>' if proposal_amount else ''}
            {'<tr><td style="padding:4px 0;color:#6B7280;">Valid until:</td><td style="padding:4px 0;">' + valid_until + '</td></tr>' if valid_until else ''}
          </table>
        </div>

        <p style="text-align:center;margin:30px 0;">
          <a href="{public_url}" style="background:#4F46E5;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;display:inline-block;">
            View Proposal Online
          </a>
        </p>

        <p style="color:#6B7280;font-size:13px;">
          Or copy this link: <a href="{public_url}">{public_url}</a>
        </p>

        <br>
        <p>Regards,<br><strong>{sender_name}</strong><br>{company_name}</p>
      </body>
    </html>
    """

    text_body = f"""
    Proposal: {proposal_title}

    Hi {client_name or 'there'},

    {message or f'Please find our proposal.'}

    Amount: {amount_str} {proposal_currency}
    View online: {public_url}

    Regards,
    {sender_name}
    {company_name}
    """

    return send_email(to_email, subject, html_body, text_body)