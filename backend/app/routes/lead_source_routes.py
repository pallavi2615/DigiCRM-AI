"""Lead Sources + Affiliates API — replaces Supabase."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
import re
from datetime import datetime
from uuid import UUID

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_feature_permission
from app.core.constants import SUPER_ADMIN_ROLE as SA_CONST
from app.models.user import User
from app.models.lead_source import (
    LeadChannel, LeadCampaign, LeadConversion,
    Affiliate, AffiliatePayoutRequest, AffiliateSettings,
)
from app.schemas.lead_source import (
    LeadChannelCreate, LeadChannelResponse,
    LeadCampaignCreate, LeadCampaignResponse,
    LeadConversionResponse,
    AffiliateResponse, AffiliateUpdate,
    AffiliatePayoutResponse, AffiliatePayoutUpdate,
    AffiliateSettingsResponse, AffiliateSettingsUpdate,
)

router = APIRouter(prefix="/lead-sources", tags=["Lead Sources"])


def _tenant_filter(query, model, user: User):
    if user.role != SA_CONST:
        query = query.filter(model.tenant_id == user.tenant_id)
    return query


def _slugify(s: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower().strip()))


# ═══════════════════════════════════════════════════════
# CHANNELS
# ═══════════════════════════════════════════════════════

@router.get("/channels", response_model=List[LeadChannelResponse])
def list_channels(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(LeadChannel), LeadChannel, user)
    return query.order_by(LeadChannel.name).all()


@router.post("/channels", response_model=LeadChannelResponse, status_code=201)
def create_channel(
    payload: LeadChannelCreate,
    user: User = Depends(require_feature_permission("leads", "create")),
    db: Session = Depends(get_db),
):
    if user.role == SA_CONST:
        pass
    elif not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    channel = LeadChannel(
        tenant_id=user.tenant_id,
        name=payload.name,
        slug=payload.slug or _slugify(payload.name),
        kind=payload.kind,
        default_group_slug=payload.default_group_slug,
        default_pack_slug=payload.default_pack_slug,
        monthly_cost=payload.monthly_cost,
        is_active=payload.is_active,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


@router.put("/channels/{channel_id}", response_model=LeadChannelResponse)
def update_channel(
    channel_id: UUID,
    payload: LeadChannelCreate,
    user: User = Depends(require_feature_permission("leads", "edit")),
    db: Session = Depends(get_db),
):
    channel = _tenant_filter(db.query(LeadChannel), LeadChannel, user).filter(LeadChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(404, "Channel not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(channel, k, v)

    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/channels/{channel_id}", status_code=204)
def delete_channel(
    channel_id: UUID,
    user: User = Depends(require_feature_permission("leads", "delete")),
    db: Session = Depends(get_db),
):
    channel = _tenant_filter(db.query(LeadChannel), LeadChannel, user).filter(LeadChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(404, "Channel not found")
    db.delete(channel)
    db.commit()


# ═══════════════════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════════════════

@router.get("/campaigns", response_model=List[LeadCampaignResponse])
def list_campaigns(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(LeadCampaign), LeadCampaign, user)
    return query.order_by(desc(LeadCampaign.created_at)).all()


@router.post("/campaigns", response_model=LeadCampaignResponse, status_code=201)
def create_campaign(
    payload: LeadCampaignCreate,
    user: User = Depends(require_feature_permission("leads", "create")),
    db: Session = Depends(get_db),
):
    if user.role == SA_CONST:
        pass
    elif not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    campaign = LeadCampaign(
        tenant_id=user.tenant_id,
        name=payload.name,
        code=payload.code or _slugify(payload.name),
        channel_id=payload.channel_id,
        budget=payload.budget,
        is_active=payload.is_active,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


# ═══════════════════════════════════════════════════════
# CONVERSIONS
# ═══════════════════════════════════════════════════════

@router.get("/conversions", response_model=List[LeadConversionResponse])
def list_conversions(
    limit: int = Query(2000, ge=1, le=5000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(LeadConversion), LeadConversion, user)
    return query.order_by(desc(LeadConversion.occurred_at)).limit(limit).all()


# ═══════════════════════════════════════════════════════
# AFFILIATES — STATIC routes first
# ═══════════════════════════════════════════════════════

@router.get("/affiliates", response_model=List[AffiliateResponse])
def list_affiliates(
    user: User = Depends(require_feature_permission("affiliates", "view")),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(Affiliate), Affiliate, user)
    return query.order_by(desc(Affiliate.created_at)).all()


# ═══════════════════════════════════════════════════════
# AFFILIATE SETTINGS — static (MUST be before /{affiliate_id})
# ═══════════════════════════════════════════════════════

@router.get("/affiliates/settings", response_model=AffiliateSettingsResponse)
def get_affiliate_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(AffiliateSettings).filter(AffiliateSettings.id == "default").first()
    if not settings:
        return AffiliateSettingsResponse(
            default_commission_pct=20,
            cookie_days=60,
            payout_terms=None,
        )
    return AffiliateSettingsResponse.model_validate(settings)


@router.put("/affiliates/settings", response_model=AffiliateSettingsResponse)
def update_affiliate_settings(
    payload: AffiliateSettingsUpdate,
    user: User = Depends(require_feature_permission("affiliates", "edit")),
    db: Session = Depends(get_db),
):
    settings = db.query(AffiliateSettings).filter(AffiliateSettings.id == "default").first()
    if not settings:
        settings = AffiliateSettings(id="default", tenant_id=user.tenant_id)
        db.add(settings)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(settings, k, v)

    db.commit()
    db.refresh(settings)
    return AffiliateSettingsResponse.model_validate(settings)


# ═══════════════════════════════════════════════════════
# AFFILIATE PAYOUTS — static subpath (MUST be before /{affiliate_id})
# ═══════════════════════════════════════════════════════

@router.get("/affiliates/payouts", response_model=List[AffiliatePayoutResponse])
def list_payouts(
    user: User = Depends(require_feature_permission("affiliates", "view")),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(
        db.query(AffiliatePayoutRequest),
        AffiliatePayoutRequest,
        user,
    )
    rows = query.order_by(desc(AffiliatePayoutRequest.created_at)).limit(200).all()

    result = []
    for r in rows:
        d = AffiliatePayoutResponse.model_validate(r).model_dump()
        if r.affiliate_id:
            aff = db.query(Affiliate).filter(Affiliate.id == r.affiliate_id).first()
            if aff:
                d["affiliate_name"] = aff.name
                d["affiliate_email"] = aff.email
        result.append(AffiliatePayoutResponse(**d))
    return result


@router.put("/affiliates/payouts/{payout_id}", response_model=AffiliatePayoutResponse)
def update_payout(
    payout_id: UUID,
    payload: AffiliatePayoutUpdate,
    user: User = Depends(require_feature_permission("affiliates", "edit")),
    db: Session = Depends(get_db),
):
    payout = _tenant_filter(
        db.query(AffiliatePayoutRequest),
        AffiliatePayoutRequest,
        user,
    ).filter(AffiliatePayoutRequest.id == payout_id).first()

    if not payout:
        raise HTTPException(404, "Payout request not found")

    data = payload.model_dump(exclude_unset=True)

    if data.get("status") == "approved":
        data["approved_at"] = datetime.utcnow()
    if data.get("status") == "paid":
        data["paid_at"] = datetime.utcnow()

    data["processed_by"] = user.id
    data["processed_at"] = datetime.utcnow()

    for k, v in data.items():
        setattr(payout, k, v)

    db.commit()
    db.refresh(payout)
    return AffiliatePayoutResponse.model_validate(payout)


# ═══════════════════════════════════════════════════════
# AFFILIATE DYNAMIC — MUST be LAST
# ═══════════════════════════════════════════════════════

@router.put("/affiliates/{affiliate_id}", response_model=AffiliateResponse)
def update_affiliate(
    affiliate_id: UUID,
    payload: AffiliateUpdate,
    user: User = Depends(require_feature_permission("affiliates", "edit")),
    db: Session = Depends(get_db),
):
    affiliate = _tenant_filter(db.query(Affiliate), Affiliate, user).filter(Affiliate.id == affiliate_id).first()
    if not affiliate:
        raise HTTPException(404, "Affiliate not found")

    data = payload.model_dump(exclude_unset=True)

    if data.get("status") == "approved":
        data["approved_at"] = datetime.utcnow()
        if not affiliate.referral_code and not data.get("referral_code"):
            base = re.sub(r"[^A-Z0-9]", "", (affiliate.name or affiliate.email or "REF").upper())[:6]
            data["referral_code"] = f"{base}{datetime.utcnow().strftime('%H%M')}"

    for k, v in data.items():
        setattr(affiliate, k, v)

    db.commit()
    db.refresh(affiliate)
    return affiliate


@router.delete("/affiliates/{affiliate_id}", status_code=204)
def delete_affiliate(
    affiliate_id: UUID,
    user: User = Depends(require_feature_permission("affiliates", "delete")),
    db: Session = Depends(get_db),
):
    affiliate = _tenant_filter(db.query(Affiliate), Affiliate, user).filter(Affiliate.id == affiliate_id).first()
    if not affiliate:
        raise HTTPException(404, "Affiliate not found")
    db.delete(affiliate)
    db.commit()