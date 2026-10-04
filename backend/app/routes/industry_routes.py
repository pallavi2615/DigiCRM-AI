"""
Public Industries catalog.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.db.database import get_db
from app.models.industry import Industry
from app.schemas.industry import IndustryResponse

router = APIRouter(prefix="/industries", tags=["Industries"])


@router.get("", response_model=List[IndustryResponse])
def list_public_industries(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="available | coming_soon | deprecated"),
    db: Session = Depends(get_db),
):
    """Public catalog. Filters by category and status optionally."""
    query = db.query(Industry).filter(
        Industry.is_active == True,
        Industry.is_public == True,
    )
    if category:
        query = query.filter(Industry.category == category)
    if status:
        query = query.filter(Industry.status == status)

    return query.order_by(Industry.order_index).all()


@router.get("/grouped")
def list_industries_grouped(db: Session = Depends(get_db)):
    """
    Return industries grouped by category — used in the marketing
    dropdown on the header. Only shows public+active industries.
    """
    rows = (
        db.query(Industry)
        .filter(Industry.is_active == True, Industry.is_public == True)
        .order_by(Industry.category, Industry.order_index)
        .all()
    )

    grouped = {}
    for r in rows:
        cat = r.category or "other"
        grouped.setdefault(cat, []).append({
            "id": r.id,
            "key": r.key,
            "name": r.name,
            "status": r.status,
            "price": float(r.price or 0),
        })

    return grouped