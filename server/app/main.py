from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import PORT
from app.db.database import _conectar, init_schema
from app.db.seed import inicializar_bd
from app.routes.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema()
    with closing(_conectar()) as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM laboratorios").fetchone()["c"]
    if count == 0:
        print("Base de datos vacía. Ejecutando auto-seed inicial...")
        inicializar_bd()
    yield


app = FastAPI(title="Sistema de Reserva de Laboratorios URP API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "serverTime": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
