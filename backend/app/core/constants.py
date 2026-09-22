"""
Application-wide constants.

Centralizes magic strings used across the codebase
to prevent typos and improve maintainability.
"""

# Role identifiers
SUPER_ADMIN_ROLE = "super_admin"
ADMIN_ROLE = "admin"
MANAGER_ROLE = "manager"
EXECUTIVE_ROLE = "executive"
AGENT_ROLE = "agent"
CLIENT_ROLE = "client"

# All valid roles
ALL_ROLES = [
    SUPER_ADMIN_ROLE,
    ADMIN_ROLE,
    MANAGER_ROLE,
    EXECUTIVE_ROLE,
    AGENT_ROLE,
    CLIENT_ROLE,
]

# Lead statuses
LEAD_STATUS_NEW = "new"
LEAD_STATUS_CONTACTED = "contacted"
LEAD_STATUS_QUALIFIED = "qualified"
LEAD_STATUS_PROPOSAL_SENT = "proposal_sent"
LEAD_STATUS_WON = "won"
LEAD_STATUS_LOST = "lost"

# Proposal statuses
PROPOSAL_STATUS_DRAFT = "draft"
PROPOSAL_STATUS_SENT = "sent"
PROPOSAL_STATUS_VIEWED = "viewed"
PROPOSAL_STATUS_ACCEPTED = "accepted"
PROPOSAL_STATUS_DECLINED = "declined"
PROPOSAL_STATUS_EXPIRED = "expired"