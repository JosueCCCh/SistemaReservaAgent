import { db } from '../../db/index.js';
import { normalizar } from '../../utils/intervalos.js';
import { Laboratorio } from '../../../../shared/types.js';

export class LaboratoriosService {
  static listarTodos(): Laboratorio[] {
    return db.prepare('SELECT * FROM laboratorios ORDER BY id').all() as Laboratorio[];
  }

  static obtenerPorId(id: number): Laboratorio | undefined {
    return db.prepare('SELECT * FROM laboratorios WHERE id = ?').get(id) as Laboratorio | undefined;
  }

  static resolverLab(nombreOQuery: string): Laboratorio | null {
    const q = normalizar(nombreOQuery);
    if (q.length < 3) return null;

    const labs = this.listarTodos();
    for (const lab of labs) {
      const n = normalizar(lab.nombre);
      const palabras = n.split(' ').filter(w => w.length > 3);
      if (q === n || q.includes(n) || n.includes(q) || palabras.some(w => q.includes(w))) {
        return lab;
      }
    }
    return null;
  }
}
