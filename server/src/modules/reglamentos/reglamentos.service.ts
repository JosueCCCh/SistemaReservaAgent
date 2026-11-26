import { db } from '../../db/index.js';
import { LaboratoriosService } from '../laboratorios/laboratorios.service.js';

export interface FragmentoResultado {
  cita: string;
  laboratorio: string;
  escuela: string;
  tipo: string;
  texto: string;
  relevancia?: number;
}

export class ReglamentosService {
  static buscarReglamentos(consulta: string, laboratorio?: string): { resultados: FragmentoResultado[]; nota?: string; error?: string } {
    if (!consulta || !consulta.trim()) {
      return { resultados: [], nota: "Ingresa una consulta para buscar." };
    }

    let labFiltrado: string | null = null;
    if (laboratorio && laboratorio.trim()) {
      const lab = LaboratoriosService.resolverLab(laboratorio);
      if (lab) {
        labFiltrado = lab.nombre;
      }
    }

    // Limpiar caracteres especiales de FTS5 para evitar errores sintácticos
    const sanitizedQuery = consulta
      .replace(/['"\\/*?^:;~()\-+]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(' OR ');

    if (!sanitizedQuery) {
      return { resultados: [], nota: "La consulta no contiene términos de búsqueda válidos." };
    }

    let sql = `
      SELECT documento, laboratorio, escuela, tipo, referencia, texto, rank
      FROM reglamento_fragmentos
      WHERE reglamento_fragmentos MATCH ?
    `;
    const params: any[] = [sanitizedQuery];

    if (labFiltrado) {
      sql += ' AND laboratorio = ?';
      params.push(labFiltrado);
    }

    sql += ' ORDER BY rank LIMIT 5';

    try {
      const rows = db.prepare(sql).all(...params) as any[];

      if (rows.length === 0) {
        // Búsqueda LIKE de respaldo por si FTS5 no encuentra coincidencias directas
        let likeSql = `
          SELECT documento, laboratorio, escuela, tipo, referencia, texto
          FROM reglamento_fragmentos
          WHERE texto LIKE ?
        `;
        const likeParams = [`%${consulta.trim()}%`];
        if (labFiltrado) {
          likeSql += ' AND laboratorio = ?';
          likeParams.push(labFiltrado);
        }
        likeSql += ' LIMIT 5';
        const likeRows = db.prepare(likeSql).all(...likeParams) as any[];

        if (likeRows.length === 0) {
          return { resultados: [], nota: "No se encontró información en los documentos." };
        }

        return {
          resultados: likeRows.map(r => ({
            cita: `${r.documento} (${r.referencia})`,
            laboratorio: r.laboratorio,
            escuela: r.escuela,
            tipo: r.tipo,
            texto: r.texto
          }))
        };
      }

      return {
        resultados: rows.map(r => ({
          cita: `${r.documento} (${r.referencia})`,
          laboratorio: r.laboratorio,
          escuela: r.escuela,
          tipo: r.tipo,
          texto: r.texto
        }))
      };
    } catch (err: any) {
      console.error('Error en búsqueda FTS5:', err);
      return { resultados: [], error: "Error al procesar la búsqueda en los reglamentos." };
    }
  }

  static listarDocumentos() {
    const docs = db.prepare(`
      SELECT DISTINCT documento, laboratorio, escuela, tipo
      FROM reglamento_fragmentos
      ORDER BY laboratorio, documento
    `).all() as any[];

    const labs = [...new Set(docs.map(d => d.laboratorio))].sort();

    return {
      laboratorios: labs,
      documentos: docs
    };
  }
}
