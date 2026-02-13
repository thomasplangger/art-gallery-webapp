from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Form, UploadFile, File, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from bson import ObjectId

from openai import OpenAI
from pydantic import BaseModel

from google import genai
from google.genai import types
import base64
import httpx
from PIL import Image
from io import BytesIO
import mimetypes
import random
import time
import jwt
from passlib.context import CryptContext


# ---------- Bootstrap & config ----------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')



GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

IMAGEN_MODEL = os.environ.get(
    "GOOGLE_IMAGE_MODEL",
    "imagen-4.0-generate-001"
)

MAKE_WEBHOOK_URL = (
    os.environ.get("MAKE_IG_WEBHOOK")
    or os.environ.get("MAKE_WEBHOOK_URL")
    or "https://hook.eu2.make.com/xxx"
)
IG_SECRET = os.environ.get("IG_SECRET") or "ig-very-secret"

PWD_CTX = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET must be set in the environment (Render/.env)")
JWT_ALG = "HS256"
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "43200"))
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")

try:
    import httpx
except Exception:
    httpx = None
import json
from urllib.request import Request as UrlRequest, urlopen
from starlette.concurrency import run_in_threadpool

try:
    import stripe
except Exception:
    stripe = None

mongo_url = os.getenv('MONGO_URL')
db = None
client = None
if mongo_url:
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.getenv('DB_NAME', 'app')]
    except Exception:
        logging.exception("Mongo connection failed")
        db = None

def require_db():
    if db is None:
        raise HTTPException(503, detail="Database not configured. Set MONGO_URL and DB_NAME.")
    return db

def _create_token(sub: str) -> str:
    now = int(time.time())
    payload = {"sub": sub, "role": "admin", "iat": now, "exp": now + JWT_EXPIRES_MIN * 60}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def _verify_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None

def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bool(hashed) and PWD_CTX.verify(plain, hashed)
    except Exception:
        return False

def _is_dev_origin(origin: str) -> bool:
    return origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1")

def set_session_cookie(resp: Response, token: str):
    resp.set_cookie(
        key="session",
        value=token,
        domain=".jpart.at",
        secure=True,
        httponly=True,
        samesite="none",
        max_age=60*60*24*7,
    )


def _clear_session_cookie(response: Response, origin: str):
    response.set_cookie(
        key="session",
        value="",
        domain=".jpart.at",
        secure=True,
        httponly=True,
        samesite="none",
        max_age=0,
        expires=0,
        path="/",
    )

def require_admin(request: Request):
    token = request.cookies.get("session")
    data = _verify_token(token) if token else None
    if not data or data.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Not authorized")
    return data

JWT_ALGO = os.environ.get('JWT_ALGO', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '60'))
pwd_context = PWD_CTX 


def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(p: str, h: str) -> bool:
    try:
        return pwd_context.verify(p, h)
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGO)

def _scene_prompt(scene: str, extra: Optional[str], lang: str) -> str:
    base = {
        "easel":  "Place the provided painting on a wooden artist easel in a modern, minimal room with natural window light and white curtains. the provided painting should fill out the main part of the image. DONT modify the provided Painting AT ALL. DO NOT change the dimensions of the painting",
        "wall":   "A photograph of a clean, modern living room with a prominent white wall, natural light, minimal furniture, gallery-like atmosphere.",
        "gallery":"A photograph of a contemporary art gallery interior, neutral walls, subtle shadows, professional lighting, polished floor, minimal decor.",
        "studio": "A photograph of an artist studio with natural light, white walls, tidy workspace, subtle props, calm mood.",
    }.get(scene, "A photograph of a clean, minimalist interior with natural light.")
    tail = (extra or "").strip()
    if tail:
        return f"{base} {tail}"
    return base

FIXED_HASHTAGS = [
    "#art","#painting","#originalart","#artcollectors","#artfromaustria",
]

ROTATING_HASHTAGS = [
    "#acrylicpainting","#modernart","#contemporaryart","#abstractart","#creativeexpression","#austrianartist","#viennaartist",
    "#grazartist","#artgalleryonline","#artforsale","#emergingartist","#cityscapeart","#natureart","#surrealart", "#colorfulart",
]

if stripe:
    stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY')

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

DEFAULT_HASHTAGS = os.environ.get(
    "DEFAULT_HASHTAGS",
    "#art #painting #acrylicpainting #modernart #expressionism #artwork #artoftheday #artistsoninstagram #artgallery #creative #contemporaryart"
)

DEFAULT_CAPTION_SYSTEM = os.environ.get(
    "CAPTION_SYSTEM_DEFAULT",
    "You are JPArt’s own social copywriter. Write in a natural, first-person tone as if the artist is speaking. "
    "Keep it concise (1–2 short sentences). Work the medium, year, and size in elegantly. No emojis. "
    "Language must follow the request ('de' German, 'en' English)."
)


# ---------- FastAPI app ----------
app = FastAPI()

@app.get("/", include_in_schema=False)
def root():
    return {"ok": True, "service": "api", "time": datetime.utcnow().isoformat(timespec="seconds") + "Z"}

@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}

from starlette.middleware.cors import CORSMiddleware

def _allowed_origins():
    raw = os.environ.get("CORS_ORIGINS", "")
    if raw.strip():
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "https://jpart.at",
        "https://www.jpart.at",
        "http://localhost:3000",
        "https://api.jpart.at",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)


# Router under /api
api_router = APIRouter(prefix="/api")

# ---------- Models ----------
class StageIn(BaseModel):
    imageUrl: Optional[str] = None
    imageData: Optional[str] = None
    scene: str = "easel"
    extraPrompt: Optional[str] = None
    lang: Optional[str] = "en"

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class User(BaseModel):
    id: Optional[str] = Field(default=None)
    email: EmailStr
    name: Optional[str] = None
    role: str = Field(default="user")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserInDB(User):
    hashed_password: str

class UserCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class Artwork(BaseModel):
    id: Optional[str] = None
    title: str
    priceCents: int = Field(ge=0)
    category: str
    imageUrl: Optional[str] = None
    year: Optional[int] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    status: str = Field(default="available")
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class ArtworkCreate(BaseModel):
    title: str
    priceCents: int
    category: str
    imageUrl: Optional[str] = None
    year: Optional[int] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    status: Optional[str] = "available"

class ArtworkUpdate(BaseModel):
    title: Optional[str] = None
    priceCents: Optional[int] = None
    category: Optional[str] = None
    imageUrl: Optional[str] = None
    year: Optional[int] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    status: Optional[str] = None

class Category(BaseModel):
    id: Optional[str] = None
    key: str
    label_en: Optional[str] = None
    label_de: Optional[str] = None

    # --- AI caption request/response ---
class AICaptionRequest(BaseModel):
    imageUrl: Optional[str] = None
    imageData: Optional[str] = None
    title: Optional[str] = None
    year: Optional[int] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    lang: Optional[str] = "en"
    style: Optional[str] = None
    system: Optional[str] = None
    hashtags: Optional[str] = None 

class AICaptionResponse(BaseModel):
    caption: str


class LoginBody(BaseModel):
    password: str


# ---------- Helpers ----------
async def get_user_by_email(email: str) -> Optional[UserInDB]:
    _db = require_db()
    row = await _db.users.find_one({"email": email})
    if not row:
        return None
    row['id'] = str(row.get('_id'))
    return UserInDB(**row)

async def require_user(token: Optional[str] = None, request: Request = None) -> User:
    auth_header = request.headers.get('Authorization') if request else None
    token_str = token
    if not token_str and auth_header and auth_header.lower().startswith('bearer '):
        token_str = auth_header.split(' ')[1]
    if not token_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token_str, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get('type') != 'access':
            raise JWTError('Invalid token')
        email = payload.get('sub')
        user = await get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid user")
        return User(**user.dict())
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")

async def require_admin(request: Request) -> User:
    user = await require_user(request=request)
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin privilege required")
    return user

# ---------- Basic Routes ----------
@api_router.get("/")
async def api_root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    _db = require_db()
    status_obj = StatusCheck(**input.dict())
    await _db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    _db = require_db()
    status_checks = await _db.status_checks.find().to_list(1000)
    return [StatusCheck(**{**s, 'id': s.get('id') or str(s.get('_id'))}) for s in status_checks]

# ---------- Auth Routes ----------
@api_router.post("/auth/register", response_model=User)
async def register(user_in: UserCreate):
    _db = require_db()
    existing = await get_user_by_email(user_in.email)
    if existing:
        raise HTTPException(400, detail="Email already registered")
    doc = {
        "email": user_in.email,
        "name": user_in.name,
        "role": "user",
        "hashed_password": hash_password(user_in.password),
        "created_at": datetime.utcnow(),
    }
    res = await _db.users.insert_one(doc)
    return User(id=str(res.inserted_id), email=user_in.email, name=user_in.name, role="user")

@api_router.post("/auth/login")
def auth_login(body: LoginBody, request: Request, response: Response):
    if not _verify_password(body.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_token("admin")
    origin = request.headers.get("origin", "")
    set_session_cookie(response, token)
    return {"ok": True}


@api_router.post("/auth/logout")
def auth_logout(request: Request, response: Response):
    origin = request.headers.get("origin", "")
    _clear_session_cookie(response, origin)
    return {"ok": True}

@api_router.get("/auth/me")
def auth_me(request: Request):
    token = request.cookies.get("session")
    data = _verify_token(token) if token else None
    return {"isAdmin": bool(data and data.get("role") == "admin")}

@api_router.post("/auth/bootstrap", response_model=User)
async def bootstrap_admin(email: EmailStr = Form(...), password: str = Form(...), secret: Optional[str] = Form(None)):
    _db = require_db()
    count = await _db.users.count_documents({})
    if count > 0:
        raise HTTPException(403, detail="Bootstrap not allowed after users exist")
    if secret and secret != os.environ.get('BOOTSTRAP_SECRET'):
        raise HTTPException(403, detail="Invalid bootstrap secret")
    doc = {
        "email": email,
        "name": "Admin",
        "role": "admin",
        "hashed_password": hash_password(password),
        "created_at": datetime.utcnow(),
    }
    res = await _db.users.insert_one(doc)
    return User(id=str(res.inserted_id), email=email, name="Admin", role="admin")

# ---------- Category Routes ----------
@api_router.get("/categories", response_model=List[Category])
async def list_categories():
    _db = require_db()
    rows = await _db.categories.find().to_list(100)
    items = []
    for r in rows:
        r['id'] = str(r.get('_id'))
        items.append(Category(**r))
    return items

@api_router.post("/categories", response_model=Category)
async def create_category(cat: Category, user: User = Depends(require_admin)):
    _db = require_db()
    doc = {
        "key": cat.key,
        "label_en": cat.label_en,
        "label_de": cat.label_de,
        "created_at": datetime.utcnow(),
    }
    res = await _db.categories.insert_one(doc)
    cat_dict = cat.dict()
    cat_dict['id'] = str(res.inserted_id)
    return Category(**cat_dict)

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user: User = Depends(require_admin)):
    _db = require_db()
    deleted = 0
    try:
        if ObjectId.is_valid(cat_id):
            res = await _db.categories.delete_one({"_id": ObjectId(cat_id)})
            deleted += res.deleted_count
    except Exception:
        pass
    if deleted == 0:
        res = await _db.categories.delete_one({"id": cat_id})
        deleted += res.deleted_count
    if deleted == 0:
        raise HTTPException(404, detail="Category not found")
    return {"ok": True}

# ---------- Artwork Routes ----------
@api_router.post("/artworks", response_model=Artwork)
async def create_artwork(body: ArtworkCreate, user: User = Depends(require_admin)):
    _db = require_db()
    now = datetime.utcnow()
    doc = {**body.dict(), "createdAt": now, "updatedAt": now}
    res = await _db.artworks.insert_one(doc)
    return Artwork(id=str(res.inserted_id), **doc)

@api_router.get("/artworks", response_model=List[Artwork])
async def list_artworks(query: Optional[str] = None, category: Optional[str] = None, year: Optional[int] = None, status_f: Optional[str] = None, sort: Optional[str] = "priceAsc"):
    _db = require_db()
    q: Dict[str, Any] = {}
    if query:
        q["title"] = {"$regex": query, "$options": "i"}
    if category:
        q["category"] = category
    if year is not None:
        q["year"] = year
    if status_f:
        q["status"] = status_f
    cursor = _db.artworks.find(q)
    if sort == "priceDesc":
        cursor = cursor.sort("priceCents", -1)
    elif sort == "categoryAZ":
        cursor = cursor.sort("category", 1)
    elif sort == "nameAZ":
        cursor = cursor.sort("title", 1)
    else:
        cursor = cursor.sort("priceCents", 1)
    rows = await cursor.to_list(500)
    items: List[Artwork] = []
    for r in rows:
        r['id'] = str(r.get('_id'))
        items.append(Artwork(**r))
    return items

@api_router.get("/artworks/{art_id}", response_model=Artwork)
async def get_artwork(art_id: str):
    _db = require_db()
    r = None
    try:
        if ObjectId.is_valid(art_id):
            r = await _db.artworks.find_one({"_id": ObjectId(art_id)})
    except Exception:
        r = None
    if not r:
        r = await _db.artworks.find_one({"id": art_id})
    if not r:
        raise HTTPException(404, detail="Artwork not found")
    r['id'] = str(r.get('_id')) if r.get('_id') else r.get('id')
    return Artwork(**r)

@api_router.put("/artworks/{art_id}", response_model=Artwork)
async def update_artwork(art_id: str, body: ArtworkUpdate, user: User = Depends(require_admin)):
    _db = require_db()
    upd = {k: v for k, v in body.dict().items() if v is not None}
    upd['updatedAt'] = datetime.utcnow()

    updated = 0
    try:
        if ObjectId.is_valid(art_id):
            res = await _db.artworks.update_one({"_id": ObjectId(art_id)}, {"$set": upd})
            updated += res.modified_count
    except Exception:
        pass
    if updated == 0:
        res = await _db.artworks.update_one({"id": art_id}, {"$set": upd})
        updated += res.modified_count

    if updated == 0:
        raise HTTPException(404, detail="Artwork not found")

    r = None
    try:
        if ObjectId.is_valid(art_id):
            r = await _db.artworks.find_one({"_id": ObjectId(art_id)})
    except Exception:
        pass
    if not r:
        r = await _db.artworks.find_one({"id": art_id})
    if not r:
        raise HTTPException(404, detail="Artwork not found")
    r['id'] = str(r.get('_id')) if r.get('_id') else r.get('id')
    return Artwork(**r)

@api_router.delete("/artworks/{art_id}")
async def delete_artwork(art_id: str, user: User = Depends(require_admin)):
    _db = require_db()
    deleted = 0
    try:
        if ObjectId.is_valid(art_id):
            res = await _db.artworks.delete_one({"_id": ObjectId(art_id)})
            deleted += res.deleted_count
    except Exception:
        pass
    if deleted == 0:
        res = await _db.artworks.delete_one({"id": art_id})
        deleted += res.deleted_count
    if deleted == 0:
        raise HTTPException(404, detail="Artwork not found")
    return {"ok": True}

# ---------- Uploads (R2 stubs) ----------
@api_router.post("/uploads/init")
async def uploads_init(filename: str = Form(...), size: int = Form(...), type: str = Form(...), user: User = Depends(require_admin)):
    if not os.environ.get('CLOUDFLARE_R2_ACCOUNT_ID'):
        raise HTTPException(503, detail="Storage not configured (R2). Add CLOUDFLARE_R2_* envs.")
    return {"uploadId": str(uuid.uuid4()), "partSize": int(os.environ.get('CHUNK_SIZE', '1048576'))}

@api_router.put("/uploads/{upload_id}/part")
async def uploads_part(upload_id: str, partNumber: int, file: UploadFile = File(...), user: User = Depends(require_admin)):
    if not os.environ.get('CLOUDFLARE_R2_ACCOUNT_ID'):
        raise HTTPException(503, detail="Storage not configured (R2)")
    _ = await file.read()
    return {"etag": f"etag-{partNumber}"}

@api_router.post("/uploads/{upload_id}/complete")
async def uploads_complete(upload_id: str, parts: List[Dict[str, Any]], user: User = Depends(require_admin)):
    if not os.environ.get('CLOUDFLARE_R2_ACCOUNT_ID'):
        raise HTTPException(503, detail="Storage not configured (R2)")
    return {"fileUrl": f"https://r2.mock/{upload_id}.jpg"}

# ---------- Checkout (Stripe) ----------
@api_router.post("/checkout/create-session")
async def create_checkout_session(artworkId: str = Form(...), buyerEmail: Optional[EmailStr] = Form(None)):
    _db = require_db()
    art = None
    try:
        if ObjectId.is_valid(artworkId):
            art = await _db.artworks.find_one({"_id": ObjectId(artworkId)})
    except Exception:
        pass
    if not art:
        art = await _db.artworks.find_one({"id": artworkId})
    if not art:
        raise HTTPException(404, detail="Artwork not found")
    if art.get('status') == 'sold':
        raise HTTPException(400, detail="Artwork already sold")

    if (stripe is None) or (not getattr(stripe, 'api_key', None)) or ('placeholder' in str(getattr(stripe, 'api_key', '')).lower()):
        raise HTTPException(503, detail="Stripe not configured. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY.")

    try:
        session = stripe.checkout.Session.create(
            mode='payment',
            payment_method_types=['card', 'sepa_debit'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': art.get('title', 'Artwork'),
                        'images': [art.get('imageUrl')] if art.get('imageUrl') else []
                    },
                    'unit_amount': int(art.get('priceCents', 0))
                },
                'quantity': 1
            }],
            success_url=os.environ.get('FRONTEND_URL', 'http://localhost:3000') + '/checkout-success?sid={CHECKOUT_SESSION_ID}',
            cancel_url=os.environ.get('FRONTEND_URL', 'http://localhost:3000') + '/checkout-cancel',
            customer_email=str(buyerEmail) if buyerEmail else None,
        )
        return {"id": session.id, "url": session.url}
    except Exception as e:
        logging.exception("Stripe session error")
        raise HTTPException(500, detail=str(e))

@api_router.post("/checkout/webhook")
async def stripe_webhook(request: Request):
    if (stripe is None) or (not os.environ.get('STRIPE_WEBHOOK_SECRET')):
        raise HTTPException(503, detail="Stripe webhook not configured. Add STRIPE_WEBHOOK_SECRET.")
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, os.environ['STRIPE_WEBHOOK_SECRET'])
    except Exception as e:
        raise HTTPException(400, detail=f"Webhook error: {e}")
    if event['type'] == 'checkout.session.completed':
        pass
    return {"received": True}


# ---------- AI Caption ----------
@api_router.post("/ai/caption", response_model=AICaptionResponse)
async def ai_caption(body: AICaptionRequest):
    """
    Builds an IG caption using the model for the short description + 5 fresh hashtags,
    then combines them with:
      - 5 fixed branding tags
      - 10 random rotating tags
    => total 20 tags. All tags are de-duped case-insensitively.
    """
    if openai_client is None:
        raise HTTPException(503, detail="AI not configured. Set OPENAI_API_KEY.")

    system_prompt = (body.system or DEFAULT_CAPTION_SYSTEM).strip()
    lang = (body.lang or "en").lower().strip()
    title = (body.title or "Untitled").strip()
    year = body.year
    medium = (body.medium or "").strip()
    dimensions = (body.dimensions or "").strip()

    user_text = (
        f"Language: {'German' if lang.startswith('de') else 'English'}.\n"
        f"Return EXACTLY two lines:\n"
        f"1) DESC: A short (1–2 sentences) natural description in the requested language, as if the artist is speaking. "
        f"Include medium, year{' ('+str(year)+')' if year else ''}, and size ('{dimensions}' if present) naturally. "
        f"No emojis. No hashtags in this line.\n"
        f"2) TAGS: exactly 5 additional, relevant hashtags (no spaces inside tags), space-separated, no explanations.\n\n"
        f"Title: {title}\n"
        f"{'Year: '+str(year)+'\\n' if year else ''}"
        f"{'Medium: '+medium+'\\n' if medium else ''}"
        f"{'Dimensions: '+dimensions+'\\n' if dimensions else ''}"
    )

    content = [{"type": "text", "text": user_text}]
    if body.imageData:
        content.append({"type": "image_url", "image_url": {"url": body.imageData}})
    elif body.imageUrl:
        content.append({"type": "image_url", "image_url": {"url": body.imageUrl}})

    try:
        resp = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.7,
            max_tokens=250,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ],
        )
        raw = (resp.choices[0].message.content or "").strip()
    except Exception as e:
        logging.exception("AI caption error")
        raise HTTPException(500, detail=f"AI error: {e}")

    desc_line, tags_line = "", ""
    for line in raw.splitlines():
        l = line.strip()
        if l.lower().startswith("desc:"):
            desc_line = l.split(":", 1)[1].strip()
        elif l.lower().startswith("tags:"):
            tags_line = l.split(":", 1)[1].strip()

    rotating = random.sample(ROTATING_HASHTAGS, k=min(10, len(ROTATING_HASHTAGS)))
    base_tags = FIXED_HASHTAGS + rotating

    ai_tags = [t for t in tags_line.split() if t.startswith("#")]
    seen = {t.lower() for t in base_tags}
    ai_tags = [t for t in ai_tags if t.lower() not in seen][:5]

    if len(ai_tags) < 5:
        pool = [t for t in ROTATING_HASHTAGS if t.lower() not in seen and t.lower() not in {x.lower() for x in ai_tags}]
        ai_tags += pool[: (5 - len(ai_tags))]

    final_tags = " ".join(base_tags + ai_tags)

    caption = f"{title}\n{desc_line}\n\n{final_tags}".strip()
    return AICaptionResponse(caption=caption)



@api_router.post("/ai/stage")
async def ai_stage(body: StageIn):
    """
    Uses Gemini 2.5 Flash Image (aka Nano Banana) to stage the provided painting
    in a scene (easel/wall/etc.). Returns a data: URL of the composed image.
    """
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(503, detail="GOOGLE_API_KEY is not configured on the server.")

    img_b64 = None
    mime = "image/jpeg"

    if body.imageData:
        if body.imageData.startswith("data:"):
            try:
                header, data = body.imageData.split(",", 1)
                if ";base64" in header:
                    mime = header.split("data:")[1].split(";")[0] or mime
                    img_b64 = data
                else:
                    raise ValueError("Expected base64 data URL")
            except Exception:
                raise HTTPException(400, detail="Invalid imageData data URL")
        else:
            img_b64 = body.imageData
    elif body.imageUrl:
        try:
            async with httpx.AsyncClient(timeout=60) as cx:
                r = await cx.get(body.imageUrl)
            if r.status_code != 200:
                raise HTTPException(400, detail=f"Failed to fetch imageUrl: {r.status_code}")
            mime = r.headers.get("content-type") or mimetypes.guess_type(body.imageUrl)[0] or "image/jpeg"
            img_b64 = base64.b64encode(r.content).decode("ascii")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, detail=f"Could not fetch imageUrl: {e}")
    else:
        raise HTTPException(400, detail="Provide imageUrl or imageData")

    scene = (body.scene or "easel").lower()
    if scene not in {"easel", "wall", "gallery", "studio"}:
        scene = "easel"

    scene_text = {
        "easel":  "Place the provided painting on a wooden artist easel in a modern, minimal room with natural window light and white curtains. the provided painting should fill out the main part of the image. DONT change the provided Painting AT ALL.",
        "wall":   "Hang the provided painting on a clean white wall in a bright modern interior with soft natural light.",
        "gallery":"Display the provided painting in a contemporary gallery setting with neutral walls and soft even lighting.",
        "studio": "Place the provided painting in an artist studio scene with soft natural light and tasteful minimal decor."
    }[scene]

    aspect_note = "Output must be a single photorealistic vertical image in 4:5 aspect ratio."
    safety_note = "Do not modify the painting’s content. Preserve its colors and proportions exactly; only compose the environment and placement realistically. The aspect ratio of the painting CANT NOT be altered and has to stay the same"

    extra = (body.extraPrompt or "").strip()
    lang = body.lang or "en"

    if lang.startswith("de"):
        base_prompt = (
            f"{scene_text} {aspect_note} {safety_note} "
            "Nutze realistische Schatten, Perspektive und korrekte Proportionen."
        )
    else:
        base_prompt = (
            f"{scene_text} {aspect_note} {safety_note} "
            "Use realistic shadows, perspective, and correct proportions."
        )
    full_prompt = (base_prompt + (" " + extra if extra else "")).strip()

    endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
    payload = {
        "contents": [{
            "parts": [
                {"text": full_prompt},
                {"inline_data": {"mime_type": mime, "data": img_b64}},
            ]
        }],
    }

    try:
        async with httpx.AsyncClient(timeout=90) as cx:
            r = await cx.post(
                endpoint,
                headers={
                    "x-goog-api-key": api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if r.status_code != 200:
            raise HTTPException(r.status_code, detail=(r.text or "Gemini request failed"))
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, detail=f"Gemini request error: {e}")
    try:
        parts = data["candidates"][0]["content"]["parts"]
        b64_out = None
        out_mime = "image/png"
        for p in parts:
            if "inline_data" in p and p["inline_data"].get("data"):
                b64_out = p["inline_data"]["data"]
                out_mime = p["inline_data"].get("mime_type") or out_mime
                break
            if "inlineData" in p and p["inlineData"].get("data"):
                b64_out = p["inlineData"]["data"]
                out_mime = p["inlineData"].get("mimeType") or out_mime
                break
        if not b64_out:
            raise KeyError("No inline image in response")
    except Exception as e:
        raise HTTPException(500, detail=f"Could not parse image from Gemini response: {e}")

    data_url = f"data:{out_mime};base64,{b64_out}"
    return {"ok": True, "dataUrl": data_url}



# ---------- Instagram → Make proxy ----------
MAKE_IG_WEBHOOK = os.getenv(
    "MAKE_IG_WEBHOOK",
    "https://hook.eu2.make.com/yaz168ucn77rb52yvc8ezis8wyx464tr",
)
MAKE_SIGNING_SECRET = os.getenv("MAKE_SIGNING_SECRET", "L2yaQw9B4cG4ngB")

@api_router.post("/instagram/queue")
async def instagram_queue(request: Request):
    ctype = (request.headers.get("content-type") or "").lower()

    if "application/json" in ctype:
        try:
            data = await request.json()
        except Exception:
            raise HTTPException(400, detail="Invalid JSON")
        images = data.get("images")
        caption = data.get("caption") or ""
        secret = data.get("secret")
        if secret and secret != IG_SECRET:
            raise HTTPException(401, detail="bad secret")
        if not images or not isinstance(images, list):
            raise HTTPException(400, detail="'images' must be a non-empty array")
        clean_images = [str(u).strip() for u in images if isinstance(u, str) and str(u).strip()]
        if len(clean_images) != len(images):
            raise HTTPException(400, detail="Each image must be a non-empty string URL.")
        if len(clean_images) < 2:
            raise HTTPException(400, detail="Carousel requires at least 2 images.")
        files = [{"image_url": u, "media_type": "IMAGE"} for u in clean_images]
        payload = {"images": clean_images, "files": files, "caption": caption, "secret": IG_SECRET}

    else:
        form = await request.form()
        image_url = form.get("image_url")
        caption = form.get("caption") or ""
        secret = form.get("secret")
        if secret and secret != IG_SECRET:
            raise HTTPException(401, detail="bad secret")
        if not image_url:
            raise HTTPException(400, detail="missing image_url")
        payload = {"images": [image_url], "files": [{"URL": image_url}], "caption": caption, "secret": IG_SECRET}

    # Forward to Make
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(MAKE_WEBHOOK_URL, json=payload)
    except Exception as e:
        raise HTTPException(502, detail=f"forward failed: {e!s}")
    if r.status_code >= 300:
        err_detail = r.text
        try:
            err_json = r.json()
            err_detail = err_json.get("error") if isinstance(err_json, dict) else err_json
        except Exception:
            pass
        raise HTTPException(r.status_code, detail=f"Make error ({r.status_code}): {err_detail}")
    return {"ok": True}
    
@app.get("/api/instagram/diag")
async def instagram_diag():
    hook = os.environ.get("MAKE_IG_WEBHOOK")
    secret = os.environ.get("MAKE_SIGNING_SECRET")
    if not hook or not secret:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "env": {"hook": bool(hook), "secret": bool(secret)}, "hint": "Missing envs"}
        )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(hook, json={"ping": True, "secret": secret})
        return {"ok": True, "status": r.status_code, "body": (r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:500])}
    except httpx.RequestError as e:
        return JSONResponse(
            status_code=502,
            content={"ok": False, "error": f"network: {str(e)}", "type": e.__class__.__name__}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": f"other: {str(e)}", "type": e.__class__.__name__}
        )

# ---------- Router mount ----------
app.include_router(api_router)

# ---------- Logging & shutdown ----------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
