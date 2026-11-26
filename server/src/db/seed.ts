import { db, initSchema } from './index.js';

export function seedDatabase() {
  console.log('Inicializando esquema...');
  initSchema();

  // Limpiar tablas para evitar duplicados en re-seed
  db.exec(`
    DELETE FROM correos;
    DELETE FROM reservas;
    DELETE FROM bloques_clase;
    DELETE FROM horario_atencion;
    DELETE FROM equipos;
    DELETE FROM laboratorios;
  `);

  console.log('Insertando laboratorios...');
  const insertLab = db.prepare('INSERT INTO laboratorios (id, nombre, escuela, permite_reserva) VALUES (?, ?, ?, ?)');
  const labs = [
    [1, "Circuitos y Dispositivos", "Electrónica", 1],
    [2, "Sistemas Digitales", "Electrónica", 1],
    [3, "Telecomunicaciones", "Electrónica", 0],
    [4, "CIM", "Industrial", 0],
    [5, "Metal Mecánica", "Industrial", 0],
  ];
  for (const lab of labs) insertLab.run(...lab);

  console.log('Insertando horarios reales...');
  const insertHorario = db.prepare(`
    INSERT INTO horario_atencion (laboratorio_id, dia_semana, hora_inicio, hora_fin, refrigerio_inicio, refrigerio_fin) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Circuitos: Lun a Vie de 08:00 a 17:00 (ref 13:00 - 14:00)
  for (let d = 0; d < 5; d++) {
    insertHorario.run(1, d, "08:00", "17:00", "13:00", "14:00");
  }
  // Circuitos: Sábado de 07:30 a 16:30 (ref 13:00 - 14:00)
  insertHorario.run(1, 5, "07:30", "16:30", "13:00", "14:00");

  // Sistemas Digitales: Lun a Vie - dos turnos
  for (let d = 0; d < 5; d++) {
    insertHorario.run(2, d, "08:00", "15:30", "13:00", "13:30");
    insertHorario.run(2, d, "14:30", "22:00", "18:00", "18:30");
  }

  console.log('Insertando bloques de clase...');
  const insertClase = db.prepare(`
    INSERT INTO bloques_clase (laboratorio_id, dia_semana, hora_inicio, hora_fin)
    VALUES (?, ?, ?, ?)
  `);

  // Circuitos: lun(0), mié(2), vie(4)
  for (const d of [0, 2, 4]) {
    insertClase.run(1, d, "08:00", "10:00");
    insertClase.run(1, d, "14:00", "16:00");
  }
  // Circuitos: mar(1), jue(3)
  for (const d of [1, 3]) {
    insertClase.run(1, d, "10:00", "12:00");
    insertClase.run(1, d, "15:00", "17:00");
  }
  // Circuitos: sáb(5)
  insertClase.run(1, 5, "07:30", "09:30");

  // Sistemas Digitales: lun(0), mié(2)
  for (const d of [0, 2]) {
    insertClase.run(2, d, "08:00", "10:00");
    insertClase.run(2, d, "18:30", "20:30");
  }
  // Sistemas Digitales: mar(1), jue(3)
  for (const d of [1, 3]) {
    insertClase.run(2, d, "10:00", "12:00");
    insertClase.run(2, d, "16:00", "18:00");
  }
  // Sistemas Digitales: vie(4)
  insertClase.run(2, 4, "08:00", "10:00");

  console.log('Insertando equipos...');
  const insertEquipo = db.prepare(`
    INSERT INTO equipos (laboratorio_id, codigo, nombre, estado)
    VALUES (?, ?, ?, ?)
  `);
  const equipos = [
    [1, "CIR-OSC-01", "Osciloscopio digital 100MHz", "operativo"],
    [1, "CIR-GEN-01", "Generador de funciones arbitrarias", "operativo"],
    [1, "CIR-FUE-01", "Fuente DC regulable triple salida", "operativo"],
    [1, "CIR-MUL-01", "Multímetro digital de banco", "operativo"],
    [2, "SD-PRO-01", "Kit de desarrollo FPGA Cyclone IV", "operativo"],
    [2, "SD-ANA-01", "Analizador lógico 16 canales", "operativo"],
    [2, "SD-FUE-01", "Fuente DC regulable dual", "operativo"],
    [2, "SD-ENT-01", "Entrenador para microcontroladores ARM", "operativo"],
    [3, "TEL-ESP-01", "Analizador de espectro 3GHz", "operativo"],
    [4, "CIM-CNC-01", "Fresadora CNC didáctica", "mantenimiento"],
    [5, "MET-TOR-01", "Torno paralelo universal", "operativo"]
  ];
  for (const eq of equipos) insertEquipo.run(...eq);

  // Inyectar fragmentos esenciales de reglamento para FTS5
  console.log('Poblando fragmentos de reglamentos (RAG FTS5)...');
  const checkCount = db.prepare('SELECT count(*) as count FROM reglamento_fragmentos').get() as { count: number };
  if (checkCount.count === 0) {
    const insertReg = db.prepare(`
      INSERT INTO reglamento_fragmentos (documento, laboratorio, escuela, tipo, referencia, texto)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const reglamentos = [
      [
        "Reglamento del Laboratorio de Circuitos y Dispositivos",
        "Circuitos y Dispositivos",
        "Electrónica",
        "reglamento",
        "Art. 17",
        "Los alumnos tienen una tolerancia máxima de 15 minutos para ingresar a las prácticas de laboratorio. Pasado ese tiempo se considerará inasistencia."
      ],
      [
        "Reglamento del Laboratorio de Circuitos y Dispositivos",
        "Circuitos y Dispositivos",
        "Electrónica",
        "reglamento",
        "Art. 20",
        "Queda terminantemente prohibido ingerir alimentos, bebidas y fumar dentro de las instalaciones del laboratorio. Quien infrinja será retirado del ambiente."
      ],
      [
        "Reglamento del Laboratorio de Circuitos y Dispositivos",
        "Circuitos y Dispositivos",
        "Electrónica",
        "reglamento",
        "Art. 28",
        "El uso de horas libres para prácticas libres de estudiantes requiere: a) Dejar el carné universitario vigente. b) Las horas libres pueden cancelarse por razones académicas o de mantenimiento imprevisto. c) Registrar el uso en la hoja de Control de Uso de los Ambientes."
      ],
      [
        "Reglamento del Laboratorio de Circuitos y Dispositivos",
        "Circuitos y Dispositivos",
        "Electrónica",
        "reglamento",
        "Art. 31",
        "Para solicitar componentes y equipos, el alumno debe presentar su carné universitario y llenar la ficha de requerimiento correspondiente ante el jefe de prácticas o encargado."
      ],
      [
        "Reglamento del Laboratorio de Sistemas Digitales",
        "Sistemas Digitales",
        "Electrónica",
        "reglamento",
        "Art. 17",
        "La tolerancia de ingreso al laboratorio es de 10 minutos. Es obligatorio el uso de guardapolvo blanco."
      ],
      [
        "Reglamento del Laboratorio de Sistemas Digitales",
        "Sistemas Digitales",
        "Electrónica",
        "reglamento",
        "Art. 28",
        "El préstamo de estaciones de trabajo y módulos FPGA durante horas libres se realiza previa reserva registrada y presentación del carné universitario."
      ],
      [
        "Reglamento Interno del Laboratorio de Telecomunicaciones",
        "Telecomunicaciones",
        "Electrónica",
        "reglamento",
        "Art. 12",
        "El Laboratorio de Telecomunicaciones está reservado para sesiones de clase y proyectos de investigación asesorados. No contempla horas libres de reserva individual para estudiantes."
      ],
      [
        "Reglamento de Seguridad e Higiene Ocupacional del Laboratorio CIM",
        "CIM",
        "Industrial",
        "seguridad",
        "Art. 15",
        "El ingreso a la celda de manufactura y robots solo está permitido con calzado de seguridad y previa autorización del docente responsable. Acceso restringido."
      ],
      [
        "Reglamento Interno y Protocolos de Seguridad del Taller de Metal Mecánica",
        "Metal Mecánica",
        "Industrial",
        "seguridad",
        "Art. 4",
        "Es obligatorio el uso de Equipos de Protección Personal (EPP): lentes de policarbonato, botas con punta de acero, overol de trabajo y protección auditiva en zonas de mecanizado."
      ],
      [
        "Reglamento Interno y Protocolos de Seguridad del Taller de Metal Mecánica",
        "Metal Mecánica",
        "Industrial",
        "seguridad",
        "Art. 28",
        "Los equipos y máquinas herramientas solo pueden ser operados bajo la supervisión directa del docente o técnico del taller. No se admiten reservas autónomas."
      ]
    ];

    for (const r of reglamentos) insertReg.run(...r);
  }

  console.log('✅ Base de datos inicializada y poblada con éxito.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}
