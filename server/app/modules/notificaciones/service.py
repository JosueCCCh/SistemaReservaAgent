import re
import smtplib
import socket
import ssl
import threading
from datetime import datetime
from email.message import EmailMessage


class _SMTP_SSL_IPv4(smtplib.SMTP_SSL):
    """Fuerza conexión IPv4 manteniendo server_hostname para validar el certificado TLS."""

    def _get_socket(self, host, port, timeout):
        ip = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
        sock = socket.create_connection((ip, port), timeout, self.source_address)
        return self.context.wrap_socket(sock, server_hostname=host)


class _SMTP_IPv4(smtplib.SMTP):
    """Fuerza conexión IPv4 para STARTTLS en puerto 587."""

    def _get_socket(self, host, port, timeout):
        ip = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
        return socket.create_connection((ip, port), timeout, self.source_address)
from app.config import (
    CORREO_CLAVE_APP,
    CORREO_REMITENTE,
    DOMINIOS_PERMITIDOS,
    ENVIO_REAL,
    ZONA_HORARIA,
)


def _validar_correo(correo: str) -> bool:
    """Formato válido y, si se configuró, dominio permitido"""
    if not re.fullmatch(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", correo):
        return False
    if DOMINIOS_PERMITIDOS:
        return correo.split("@")[1].lower() in [d.lower() for d in DOMINIOS_PERMITIDOS]
    return True


def _enviar_correo(conn, tipo: str, reserva_id: int) -> dict:
    """Arma el correo con una plantilla fija, lo envía (o lo simula) y lo guarda en la tabla correos.
    Lo llaman crear_reserva, cancelar_reserva, reservar_equipo y cancelar_reserva_equipo; el modelo no decide si se envía."""
    r = conn.execute(
        "SELECT r.*, l.nombre AS lab FROM reservas r JOIN laboratorios l ON l.id = r.laboratorio_id WHERE r.id=?",
        (reserva_id,),
    ).fetchone()
    if not r:
        return {"destinatario": "", "estado": "sin_correo"}

    destino = r["correo"]
    if not destino:
        return {"destinatario": "", "estado": "sin_correo"}

    detalle = (
        f"  - Laboratorio: {r['lab']}\n"
        f"  - Fecha: {r['fecha']}\n"
        f"  - Horario: {r['hora_inicio']} a {r['hora_fin']}\n"
        f"  - N.º de reserva: {r['id']}\n"
    )

    if tipo == "confirmacion":
        asunto = f"Confirmación de reserva n.º {r['id']} - {r['lab']}"
        cuerpo = (
            f"Hola {r['nombre']},\n\nTu reserva de hora libre fue registrada:\n{detalle}\n"
            "Recuerda:\n"
            "  - Dejar tu carné universitario vigente (Art. 28 a).\n"
            "  - Registrar el uso en la hoja de Control de Uso de los Ambientes (Horas Libres) (Art. 28 c).\n"
            "  - La hora libre puede cancelarse por razones académicas o de mantenimiento (Art. 28 b).\n"
            "  - Está prohibido ingresar alimentos y bebidas, y fumar (Art. 20).\n\n"
            f'Para cancelarla, escribe al asistente: "Cancela la reserva {r["id"]}, mi código es {r["codigo_estudiante"]}".\n\n'
            "Asistente de Laboratorios URP"
        )
    elif tipo == "cancelacion":
        asunto = f"Cancelación de reserva n.º {r['id']} - {r['lab']}"
        cuerpo = (
            f"Hola {r['nombre']},\n\nTu reserva fue cancelada:\n{detalle}\n"
            "El horario quedó libre nuevamente. Si lo necesitas, puedes hacer una nueva reserva con el asistente.\n\n"
            "Asistente de Laboratorios URP"
        )
    else:  # tipo == "equipos": lista actualizada de los equipos de la reserva
        eqs = conn.execute(
            """SELECT e.nombre, e.codigo FROM reservas_equipo re JOIN equipos e ON e.id = re.equipo_id
               WHERE re.reserva_id=? AND re.estado='activa' ORDER BY e.codigo""",
            (reserva_id,),
        ).fetchall()
        lista = "\n".join(f"  - {e['nombre']} ({e['codigo']})" for e in eqs) or "  (sin equipos asignados)"
        asunto = f"Equipos de tu reserva n.º {r['id']} - {r['lab']}"
        cuerpo = (
            f"Hola {r['nombre']},\n\nEstos son los equipos de tu reserva:\n{detalle}\nEquipos:\n{lista}\n\n"
            f'Para quitar un equipo, escribe al asistente: "Cancela el equipo de la reserva {r["id"]}, mi código es {r["codigo_estudiante"]}".\n\n'
            "Asistente de Laboratorios URP"
        )

    estado = "simulado"
    if ENVIO_REAL:
        resultado_smtp = {"estado": "error: TimeoutError"}

        def _enviar_smtp():
            msg = EmailMessage()
            msg["Subject"] = asunto
            msg["From"] = CORREO_REMITENTE
            msg["To"] = destino
            msg.set_content(cuerpo)
            ctx = ssl.create_default_context()
            clave = CORREO_CLAVE_APP.replace(" ", "")
            try:
                with _SMTP_SSL_IPv4("smtp.gmail.com", 465, context=ctx, timeout=3) as servidor:
                    servidor.login(CORREO_REMITENTE, clave)
                    servidor.send_message(msg)
                resultado_smtp["estado"] = "enviado"
                return
            except Exception as e465:
                try:
                    with _SMTP_IPv4("smtp.gmail.com", 587, timeout=3) as servidor:
                        servidor.ehlo()
                        servidor.starttls(context=ctx)
                        servidor.ehlo()
                        servidor.login(CORREO_REMITENTE, clave)
                        servidor.send_message(msg)
                    resultado_smtp["estado"] = "enviado"
                except Exception as e587:
                    resultado_smtp["estado"] = f"error: {type(e587).__name__} ({type(e465).__name__})"

        hilo = threading.Thread(target=_enviar_smtp, daemon=True)
        hilo.start()
        hilo.join(timeout=6)
        estado = resultado_smtp["estado"]

    conn.execute(
        "INSERT INTO correos (reserva_id,tipo,destinatario,asunto,cuerpo,estado,creado_en) VALUES (?,?,?,?,?,?,?)",
        (reserva_id, tipo, destino, asunto, cuerpo, estado, datetime.now(ZONA_HORARIA).isoformat()),
    )
    conn.commit()
    print(f"[CORREO {estado.upper()}] a {destino} | {asunto}")
    return {"destinatario": destino, "estado": estado}
