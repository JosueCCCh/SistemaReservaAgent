export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function aMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function aHHMM(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function validarHora(texto: any): number | null {
  try {
    if (!texto || typeof texto !== 'string') return null;
    const parts = texto.trim().split(":");
    if (parts.length !== 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : null;
  } catch {
    return null;
  }
}

export function validarFecha(fecha: any): Date | null {
  try {
    if (!fecha || typeof fecha !== 'string') return null;
    const trimmed = fecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const [y, m, d] = trimmed.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export type Intervalo = [number, number];

export function unirIntervalos(intervalos: Intervalo[]): Intervalo[] {
  if (intervalos.length === 0) return [];
  const ordenados = [...intervalos].sort((a, b) => a[0] - b[0]);
  const res: Intervalo[] = [];

  for (const [ini, fin] of ordenados) {
    if (res.length > 0 && ini <= res[res.length - 1][1]) {
      res[res.length - 1][1] = Math.max(res[res.length - 1][1], fin);
    } else {
      res.push([ini, fin]);
    }
  }
  return res;
}

export function restarIntervalos(base: Intervalo[], bloqueados: Intervalo[]): Intervalo[] {
  const libres: Intervalo[] = [];
  const bloqueadosUnidos = unirIntervalos(bloqueados);

  for (const [ini, fin] of base) {
    let actual = ini;
    for (const [bIni, bFin] of bloqueadosUnidos) {
      if (bFin <= actual || bIni >= fin) continue;
      if (bIni > actual) {
        libres.push([actual, bIni]);
      }
      actual = Math.max(actual, bFin);
    }
    if (actual < fin) {
      libres.push([actual, fin]);
    }
  }
  return libres;
}

export function chocaIntervalos(ini: number, fin: number, bloques: Intervalo[]): boolean {
  return bloques.some(([a, b]) => a < fin && ini < b);
}

export function formatearIntervalos(intervalos: Intervalo[]): string[] {
  return intervalos.map(([a, b]) => `${aHHMM(a)} a ${aHHMM(b)}`);
}
