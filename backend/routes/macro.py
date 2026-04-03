from fastapi import APIRouter

from backend.services.macro_service import get_macro_data

router = APIRouter()


@router.get("/indicators")
def macro():
    return get_macro_data()
