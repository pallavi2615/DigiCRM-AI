# schemas/base.py
from decimal import Decimal, ROUND_HALF_UP
from pydantic import BaseModel, ConfigDict, model_serializer


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @model_serializer(mode="wrap")
    def _ser(self, handler):
        return _fix(handler(self))


def _fix(obj):
    if isinstance(obj, Decimal):
        return f"{obj.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"
    if isinstance(obj, dict):
        return {k: _fix(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_fix(v) for v in obj]
    return obj