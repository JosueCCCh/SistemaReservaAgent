from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.db.seed import inicializar_bd
from app.main import app
from app.modules.disponibilidad.service import calcular_disponibilidad
from app.modules.reglamentos.service import buscar_reglamento
from app.modules.reservas.service import (
    cancelar_reserva,
    cancelar_reserva_equipo,
    consultar_equipos,
    crear_reserva,
    listar_reservas,
    reservar_equipo,
)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    inicializar_bd()
    with patch(
        "app.modules.reservas.service._enviar_correo",
        return_value={"destinatario": "cordovachavezjosueluis@gmail.com", "estado": "simulado"},
    ):
        yield


def test_disponibilidad_circuitos():
    disp = calcular_disponibilidad("Circuitos y Dispositivos", "2026-11-30")
    assert disp["laboratorio"] == "Circuitos y Dispositivos"
    assert "10:00 a 13:00" in disp["horas_libres"]
    assert "16:00 a 17:00" in disp["horas_libres"]


def test_buscar_reglamento_rag():
    res = buscar_reglamento("minutos de tolerancia", "Circuitos y Dispositivos")
    assert len(res["resultados"]) > 0
    assert "Art. 17" in res["resultados"][0]["cita"]
    assert "15 minutos" in res["resultados"][0]["texto"]


def test_crear_y_duplicar_y_equipos_y_cancelar_reserva():
    res = crear_reserva(
        laboratorio="Circuitos y Dispositivos",
        fecha="2026-11-30",
        hora_inicio="10:00",
        hora_fin="12:00",
        codigo_estudiante="202311373",
        nombre="Josue Cordova",
        correo="cordovachavezjosueluis@gmail.com",
    )
    assert res["ok"] is True
    reserva_id = res["reserva_id"]

    # Duplicado
    dup = crear_reserva(
        laboratorio="Circuitos y Dispositivos",
        fecha="2026-11-30",
        hora_inicio="10:00",
        hora_fin="12:00",
        codigo_estudiante="202311373",
        nombre="Josue Cordova",
        correo="cordovachavezjosueluis@gmail.com",
    )
    assert dup["ok"] is False
    assert "Ya tienes registrada la reserva" in dup["motivo"]

    # Equipos
    eq_info = consultar_equipos("Circuitos", "osciloscopio")
    assert eq_info["tipos"][0]["total"] == 4
    assert eq_info["tipos"][0]["en_mantenimiento"] == 1

    eq_res = reservar_equipo(reserva_id, "202311373", "osciloscopio", 2)
    assert eq_res["ok"] is True
    assert len(eq_res["equipos_reservados"]) == 2

    eq_cancel = cancelar_reserva_equipo(reserva_id, "202311373", "osciloscopio", 1)
    assert eq_cancel["ok"] is True
    assert len(eq_cancel["equipos_cancelados"]) == 1

    # Cancelación con código incorrecto
    fail_cancel = cancelar_reserva(reserva_id, "999999999")
    assert fail_cancel["ok"] is False

    # Cancelación con código correcto
    ok_cancel = cancelar_reserva(reserva_id, "202311373")
    assert ok_cancel["ok"] is True
    reservas = listar_reservas(codigo_estudiante="202311373")
    assert any(r["id"] == reserva_id and r["estado"] == "cancelada" for r in reservas)


def test_telecomunicaciones_sin_reservas():
    disp = calcular_disponibilidad("Telecomunicaciones", "2026-11-30")
    assert "no contempla reservas" in disp["error"]
    assert "horas_libres" not in disp


def test_fastapi_endpoints():
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    labs = client.get("/api/laboratorios").json()
    assert len(labs) == 5
    equipos = client.get("/api/equipos?laboratorioId=1").json()
    assert len(equipos) > 0
    docs = client.get("/api/reglamentos/documentos").json()
    assert len(docs["laboratorios"]) == 5
