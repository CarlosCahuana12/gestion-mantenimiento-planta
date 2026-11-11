// =========================================================
// DATOS DE EJEMPLO: MANTENIMIENTO DE PLANTA (MAQUETA)
// Planta de fabricación de productos de limpieza:
// detergentes, lejía, lavavajillas y desinfectantes.
// Todo se guarda en el navegador (localStorage).
// =========================================================

const CLAVE_DB = "mantenimientoPlanta_demo_v2";
const NOMBRE_SISTEMA = "Mantenimiento de Planta";
const TARIFA_HORA = 25;          // S/ por hora de mano de obra interna
const HORAS_TURNO_DIA = 16;      // 2 turnos de 8 h
const DIAS_PRODUCCION_MES = 26;

const LINEAS = [
  "Línea 1 · Detergente líquido",
  "Línea 2 · Lejía",
  "Línea 3 · Lavavajillas y desinfectantes",
  "Envasado y etiquetado",
  "Servicios generales"
];

const ESTADOS_MAQUINA = ["Operativa", "En mantenimiento", "Parada", "Fuera de servicio"];
const TIPOS_OT = ["Correctivo", "Preventivo", "Mejora"];
const ESTADOS_OT = ["Pendiente", "Programada", "En ejecución", "Esperando repuesto", "Terminada"];
const PRIORIDADES = ["Alta", "Media", "Baja"];
const CAUSAS = ["Desgaste normal", "Falta de lubricación", "Falla eléctrica", "Corrosión por químicos",
  "Mala operación", "Fin de vida útil", "Obstrucción o suciedad", "Ajuste o calibración"];

const PERSONAS = [
  { id: 1, nombre: "Raúl Paredes", cargo: "Jefe de Mantenimiento", rol: "jefe" },
  { id: 2, nombre: "Jorge Salinas", cargo: "Técnico mecánico", rol: "tecnico" },
  { id: 3, nombre: "Pedro Ccori", cargo: "Técnico electricista", rol: "tecnico" },
  { id: 4, nombre: "Miguel Torres", cargo: "Mecánico soldador", rol: "tecnico" },
  { id: 5, nombre: "Luis Arce", cargo: "Técnico instrumentista", rol: "tecnico" },
  { id: 10, nombre: "Rosa Quispe", cargo: "Operadora · Línea 1", rol: "operador" },
  { id: 11, nombre: "Juan Mamani", cargo: "Operador · Envasado", rol: "operador" },
  { id: 12, nombre: "Carmen Huamán", cargo: "Operadora · Línea 2", rol: "operador" }
];

const MAQUINAS = [
  { codigo: "MZ-01", nombre: "Tanque mezclador 5 000 L con agitador", linea: 0, marca: "Inoxpa", modelo: "TM-5000", anio: 2018, criticidad: "A", horometro: 18420 },
  { codigo: "MZ-02", nombre: "Tanque mezclador 3 000 L con agitador", linea: 2, marca: "Inoxpa", modelo: "TM-3000", anio: 2020, criticidad: "A", horometro: 11260 },
  { codigo: "RX-01", nombre: "Tanque de dilución de hipoclorito 4 000 L", linea: 1, marca: "Rotoplas Industrial", modelo: "TQ-4000", anio: 2019, criticidad: "A", horometro: 15030 },
  { codigo: "BT-01", nombre: "Bomba neumática de diafragma 1½\"", linea: 0, marca: "Graco", modelo: "Husky 1590", anio: 2021, criticidad: "B", horometro: 9120 },
  { codigo: "BT-02", nombre: "Bomba centrífuga de transferencia de químicos", linea: 1, marca: "Pedrollo", modelo: "CPm 620", anio: 2019, criticidad: "B", horometro: 14210 },
  { codigo: "LL-01", nombre: "Llenadora volumétrica de 6 boquillas", linea: 3, marca: "Fillmatic", modelo: "FV-6", anio: 2020, criticidad: "A", horometro: 12880 },
  { codigo: "LL-02", nombre: "Llenadora por gravedad de 8 boquillas (lejía)", linea: 1, marca: "Fillmatic", modelo: "FG-8", anio: 2018, criticidad: "A", horometro: 17650 },
  { codigo: "TP-01", nombre: "Taponadora automática", linea: 3, marca: "Capmatic", modelo: "CT-200", anio: 2020, criticidad: "B", horometro: 12010 },
  { codigo: "ET-01", nombre: "Etiquetadora autoadhesiva", linea: 3, marca: "Herma", modelo: "H-400", anio: 2021, criticidad: "B", horometro: 9880 },
  { codigo: "CD-01", nombre: "Codificadora inkjet (lote y vencimiento)", linea: 3, marca: "Videojet", modelo: "1580", anio: 2022, criticidad: "B", horometro: 7420 },
  { codigo: "TE-01", nombre: "Túnel termoencogible", linea: 3, marca: "Plastipack", modelo: "TT-450", anio: 2019, criticidad: "C", horometro: 10340 },
  { codigo: "FJ-01", nombre: "Faja transportadora de envasado 12 m", linea: 3, marca: "Fabricación local", modelo: "FT-12", anio: 2018, criticidad: "B", horometro: 18900 },
  { codigo: "SP-01", nombre: "Sopladora de botellas PET", linea: 3, marca: "Chumpower", modelo: "CPSB-LS", anio: 2021, criticidad: "A", horometro: 8960 },
  { codigo: "CP-01", nombre: "Compresor de aire de tornillo 30 HP", linea: 4, marca: "Atlas Copco", modelo: "GA 22", anio: 2019, criticidad: "A", horometro: 21540 },
  { codigo: "OS-01", nombre: "Planta de agua por ósmosis inversa 2 m³/h", linea: 4, marca: "Hydrus", modelo: "OI-2000", anio: 2020, criticidad: "A", horometro: 16220 },
  { codigo: "CL-01", nombre: "Caldero 30 BHP", linea: 4, marca: "Intesa", modelo: "VE-30", anio: 2017, criticidad: "B", horometro: 23110 },
  { codigo: "MC-01", nombre: "Montacargas eléctrico 2,5 t", linea: 4, marca: "Toyota", modelo: "8FBE25", anio: 2020, criticidad: "B", horometro: 6830 },
  { codigo: "BL-01", nombre: "Balanza de plataforma 1 t", linea: 0, marca: "Ohaus", modelo: "D52P", anio: 2021, criticidad: "C", horometro: 0 }
];

const REPUESTOS = [
  { codigo: "R-001", nombre: "Rodamiento 6205-2RS", unidad: "und", stock: 12, minimo: 6, costo: 18, ubicacion: "Estante A1" },
  { codigo: "R-002", nombre: "Rodamiento 6308-2RS", unidad: "und", stock: 3, minimo: 4, costo: 46, ubicacion: "Estante A1" },
  { codigo: "R-003", nombre: "Sello mecánico 1¼\" para bomba centrífuga", unidad: "und", stock: 1, minimo: 2, costo: 185, ubicacion: "Estante A2" },
  { codigo: "R-004", nombre: "Kit de diafragmas bomba neumática 1½\"", unidad: "kit", stock: 2, minimo: 1, costo: 420, ubicacion: "Estante A2" },
  { codigo: "R-005", nombre: "Correa en V tipo A-48", unidad: "und", stock: 8, minimo: 4, costo: 22, ubicacion: "Estante B1" },
  { codigo: "R-006", nombre: "Filtro de aire del compresor", unidad: "und", stock: 1, minimo: 2, costo: 160, ubicacion: "Estante B2" },
  { codigo: "R-007", nombre: "Filtro de aceite del compresor", unidad: "und", stock: 2, minimo: 2, costo: 135, ubicacion: "Estante B2" },
  { codigo: "R-008", nombre: "Aceite para compresor de tornillo (20 L)", unidad: "balde", stock: 1, minimo: 1, costo: 690, ubicacion: "Zona de aceites" },
  { codigo: "R-009", nombre: "Boquilla de llenado de acero inoxidable", unidad: "und", stock: 10, minimo: 6, costo: 95, ubicacion: "Estante C1" },
  { codigo: "R-010", nombre: "Kit de o-rings Viton (resistente a cloro)", unidad: "kit", stock: 4, minimo: 3, costo: 140, ubicacion: "Estante C1" },
  { codigo: "R-011", nombre: "Membrana de ósmosis 4040", unidad: "und", stock: 0, minimo: 1, costo: 980, ubicacion: "Almacén principal" },
  { codigo: "R-012", nombre: "Cartucho filtro de sedimentos 5 µm", unidad: "und", stock: 14, minimo: 10, costo: 16, ubicacion: "Estante C2" },
  { codigo: "R-013", nombre: "Tinta para codificadora inkjet", unidad: "frasco", stock: 4, minimo: 3, costo: 310, ubicacion: "Estante D1" },
  { codigo: "R-014", nombre: "Solvente (make-up) para codificadora", unidad: "frasco", stock: 2, minimo: 3, costo: 240, ubicacion: "Estante D1" },
  { codigo: "R-015", nombre: "Resistencia de 2 kW para túnel termoencogible", unidad: "und", stock: 3, minimo: 2, costo: 145, ubicacion: "Estante D2" },
  { codigo: "R-016", nombre: "Contactor tripolar 25 A", unidad: "und", stock: 4, minimo: 2, costo: 120, ubicacion: "Tablero de repuestos" },
  { codigo: "R-017", nombre: "Relé térmico 10–16 A", unidad: "und", stock: 2, minimo: 2, costo: 95, ubicacion: "Tablero de repuestos" },
  { codigo: "R-018", nombre: "Sensor fotoeléctrico de detección de envase", unidad: "und", stock: 3, minimo: 2, costo: 210, ubicacion: "Tablero de repuestos" },
  { codigo: "R-019", nombre: "Banda modular de faja (por metro)", unidad: "m", stock: 6, minimo: 4, costo: 165, ubicacion: "Zona de fajas" },
  { codigo: "R-020", nombre: "Grasa EP2 multipropósito", unidad: "kg", stock: 9, minimo: 5, costo: 28, ubicacion: "Zona de aceites" },
  { codigo: "R-021", nombre: "Aceite hidráulico ISO 68", unidad: "gal", stock: 7, minimo: 4, costo: 62, ubicacion: "Zona de aceites" },
  { codigo: "R-022", nombre: "Válvula solenoide ½\" 24 V", unidad: "und", stock: 2, minimo: 2, costo: 175, ubicacion: "Tablero de repuestos" },
  { codigo: "R-023", nombre: "Molde de preforma (cavidad) de sopladora", unidad: "und", stock: 1, minimo: 1, costo: 1850, ubicacion: "Almacén principal" },
  { codigo: "R-024", nombre: "Fusible NH 63 A", unidad: "und", stock: 6, minimo: 4, costo: 34, ubicacion: "Tablero de repuestos" },
  { codigo: "R-025", nombre: "Guantes de nitrilo resistentes a químicos", unidad: "par", stock: 26, minimo: 20, costo: 9, ubicacion: "Armario de EPP" },
  { codigo: "R-026", nombre: "Lentes de seguridad antiempañantes", unidad: "und", stock: 7, minimo: 10, costo: 12, ubicacion: "Armario de EPP" },
  { codigo: "R-027", nombre: "Respirador media cara con filtros para vapores", unidad: "und", stock: 4, minimo: 4, costo: 95, ubicacion: "Armario de EPP" },
  { codigo: "R-028", nombre: "Cinta teflón ¾\"", unidad: "rollo", stock: 25, minimo: 10, costo: 3, ubicacion: "Estante E1" },
  { codigo: "R-029", nombre: "Trapo industrial", unidad: "kg", stock: 12, minimo: 10, costo: 6, ubicacion: "Estante E1" },
  { codigo: "R-030", nombre: "Electrodo E6011 1/8\"", unidad: "kg", stock: 5, minimo: 5, costo: 18, ubicacion: "Estante E2" },
  { codigo: "R-031", nombre: "Limpiador dieléctrico en spray", unidad: "und", stock: 3, minimo: 4, costo: 32, ubicacion: "Estante E2" },
  { codigo: "R-032", nombre: "Pernos de acero inoxidable M10 (caja x50)", unidad: "caja", stock: 2, minimo: 2, costo: 85, ubicacion: "Estante A3" }
];

// Familias del inventario de mantenimiento
const CATEGORIAS = ["Mecánicos", "Eléctricos", "Filtros y sellos", "Lubricantes", "Consumibles", "EPP"];
const CATEGORIA_DE = {
  "R-001": 0, "R-002": 0, "R-004": 0, "R-005": 0, "R-009": 0, "R-019": 0, "R-023": 0, "R-032": 0,
  "R-015": 1, "R-016": 1, "R-017": 1, "R-018": 1, "R-022": 1, "R-024": 1,
  "R-003": 2, "R-006": 2, "R-007": 2, "R-010": 2, "R-011": 2, "R-012": 2,
  "R-008": 3, "R-020": 3, "R-021": 3,
  "R-013": 4, "R-014": 4, "R-028": 4, "R-029": 4, "R-030": 4, "R-031": 4,
  "R-025": 5, "R-026": 5, "R-027": 5
};
const PROVEEDORES = ["Rodamientos del Perú SAC", "Electro Industrial Lima", "Lubricantes Andinos", "Hydrus Perú", "Suministros Industriales Callao", "Seguridad Total EIRL"];
const PROVEEDOR_DE_CATEGORIA = [0, 1, 4, 2, 4, 5];

const HERRAMIENTAS = [
  { codigo: "H-01", nombre: "Multímetro digital", estado: "Disponible" },
  { codigo: "H-02", nombre: "Pinza amperimétrica", estado: "Prestada", prestadaA: 3 },
  { codigo: "H-03", nombre: "Megóhmetro (prueba de aislamiento)", estado: "Disponible" },
  { codigo: "H-04", nombre: "Juego de llaves mixtas 6–32 mm", estado: "Prestada", prestadaA: 2 },
  { codigo: "H-05", nombre: "Torquímetro 20–200 N·m", estado: "Disponible" },
  { codigo: "H-06", nombre: "Extractor de rodamientos", estado: "Disponible" },
  { codigo: "H-07", nombre: "Máquina de soldar inverter", estado: "En reparación" },
  { codigo: "H-08", nombre: "Esmeril angular 4½\"", estado: "Disponible" },
  { codigo: "H-09", nombre: "Taladro percutor", estado: "Prestada", prestadaA: 4 },
  { codigo: "H-10", nombre: "Pistola de grasa neumática", estado: "Disponible" },
  { codigo: "H-11", nombre: "Termómetro infrarrojo", estado: "Disponible" },
  { codigo: "H-12", nombre: "Analizador de vibraciones portátil", estado: "Disponible" }
];

// Tareas del plan preventivo: [máquina, tarea, cada cuántos días, técnico, horas, repuestos]
const PLAN = [
  ["MZ-01", "Lubricar rodamientos del agitador y revisar reductor", 15, 2, 1.5, [["R-020", 0.5]]],
  ["MZ-01", "Revisar sellos y empaquetadura del eje", 60, 2, 2, [["R-010", 1]]],
  ["MZ-02", "Lubricar rodamientos del agitador y revisar reductor", 15, 2, 1.5, [["R-020", 0.5]]],
  ["RX-01", "Inspección de corrosión y revestimiento interno", 90, 4, 4, []],
  ["RX-01", "Cambio de o-rings de válvulas de descarga", 60, 2, 2, [["R-010", 1]]],
  ["BT-01", "Inspección de diafragmas y válvulas de bola", 45, 2, 2, []],
  ["BT-02", "Revisar sello mecánico y alineamiento", 30, 2, 1.5, []],
  ["LL-01", "Limpieza y calibración de boquillas", 7, 5, 1, []],
  ["LL-01", "Revisión de pistones y o-rings dosificadores", 30, 2, 3, [["R-010", 1]]],
  ["LL-02", "Limpieza de boquillas y cambio de o-rings Viton", 14, 2, 2, [["R-010", 1]]],
  ["TP-01", "Ajuste de torque de cabezales y lubricación", 15, 2, 1, [["R-020", 0.2]]],
  ["ET-01", "Limpieza de rodillos y calibración de sensor", 15, 5, 1, []],
  ["CD-01", "Limpieza de cabezal y cambio de filtro de tinta", 30, 5, 1, [["R-014", 1]]],
  ["TE-01", "Revisión de resistencias y ventiladores", 30, 3, 1.5, []],
  ["FJ-01", "Tensado de banda, lubricación de cadenas y chumaceras", 15, 2, 1.5, [["R-020", 0.5]]],
  ["SP-01", "Limpieza de moldes y revisión de lámparas de calentamiento", 30, 5, 3, []],
  ["CP-01", "Purga de condensado y revisión de nivel de aceite", 7, 2, 0.5, []],
  ["CP-01", "Cambio de filtros de aire y aceite", 90, 2, 2, [["R-006", 1], ["R-007", 1]]],
  ["CP-01", "Cambio de aceite (4 000 h)", 180, 2, 3, [["R-008", 1]]],
  ["OS-01", "Cambio de cartuchos de sedimento", 30, 5, 1, [["R-012", 2]]],
  ["OS-01", "Limpieza química de membranas (CIP)", 90, 5, 4, []],
  ["CL-01", "Purga de fondo y revisión de quemador", 7, 3, 1, []],
  ["CL-01", "Inspección de tubos y prueba hidrostática", 180, 4, 6, []],
  ["MC-01", "Revisión de batería, frenos y aceite hidráulico", 30, 3, 1.5, [["R-021", 0.5]]],
  ["BL-01", "Verificación de calibración con pesas patrón", 90, 5, 1, []],
  ["Tableros", "Ajuste de borneras y termografía de tableros eléctricos", 90, 3, 4, []]
];

// ---------- Utilidades de fechas ----------
const DIA = 86400000;
function haceDias(d, hora = 9) {
  const f = new Date(Date.now() - d * DIA);
  f.setHours(hora, 0, 0, 0);
  return f.toISOString();
}

// ---------- Historial de órdenes de trabajo ----------
function generarDatos() {
  let semilla = 2026;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  const elegir = (l) => l[Math.floor(azar() * l.length)];
  const entre = (a, b) => Math.round(a + azar() * (b - a));

  const maquinas = MAQUINAS.map(m => ({ ...m, linea: LINEAS[m.linea], estado: "Operativa",
    ubicacion: m.linea === 4 ? "Sala de servicios" : m.linea === 3 ? "Nave de envasado" : "Nave de preparación" }));
  const repuestos = REPUESTOS.map(r => ({ ...r, categoria: CATEGORIAS[CATEGORIA_DE[r.codigo] ?? 4] }));
  const plan = PLAN.map(([maquina, tarea, frecuenciaDias, tecnicoId, horas, rep], i) => ({
    id: i + 1, maquina, tarea, frecuenciaDias, tecnicoId, horas,
    repuestos: rep.map(([codigo, cantidad]) => ({ codigo, cantidad })),
    // Algunas tareas quedan vencidas o próximas para que el panel tenga avisos
    ultima: haceDias(i % 6 === 0 ? frecuenciaDias + entre(2, 9) : entre(1, Math.max(1, frecuenciaDias - 1)))
  }));

  const fallas = {
    "MZ-01": [["Agitador vibra y hace ruido", "Desgaste normal", "Cambio de rodamientos del agitador", [["R-002", 2]]]],
    "MZ-02": [["Motor del agitador se calienta", "Falta de lubricación", "Lubricación y cambio de rodamiento", [["R-001", 1]]]],
    "RX-01": [["Fuga en válvula de descarga", "Corrosión por químicos", "Cambio de o-rings Viton", [["R-010", 1]]]],
    "BT-01": [["Bomba pierde caudal", "Desgaste normal", "Cambio de diafragmas", [["R-004", 1]]]],
    "BT-02": [["Goteo por el sello de la bomba", "Corrosión por químicos", "Cambio de sello mecánico", [["R-003", 1]]]],
    "LL-01": [["Boquilla dosifica de menos", "Obstrucción o suciedad", "Limpieza y cambio de boquilla", [["R-009", 1]]],
              ["Sensor no detecta envases", "Ajuste o calibración", "Calibración de sensor fotoeléctrico", []]],
    "LL-02": [["Fuga de lejía en boquillas", "Corrosión por químicos", "Cambio de o-rings y boquillas", [["R-010", 1], ["R-009", 2]]]],
    "TP-01": [["Tapas quedan flojas", "Ajuste o calibración", "Ajuste de torque de cabezales", []]],
    "ET-01": [["Etiquetas salen torcidas", "Ajuste o calibración", "Alineamiento de rodillos", []],
              ["Etiquetadora se detiene sola", "Falla eléctrica", "Cambio de sensor fotoeléctrico", [["R-018", 1]]]],
    "CD-01": [["Impresión de lote borrosa", "Obstrucción o suciedad", "Limpieza de cabezal", [["R-014", 1]]]],
    "TE-01": [["No calienta parejo", "Fin de vida útil", "Cambio de resistencia", [["R-015", 1]]]],
    "FJ-01": [["Faja patina y se detiene", "Desgaste normal", "Tensado y cambio de correa", [["R-005", 2]]],
              ["Motor de faja se dispara", "Falla eléctrica", "Cambio de relé térmico", [["R-017", 1]]]],
    "SP-01": [["Botellas salen deformes", "Ajuste o calibración", "Ajuste de temperatura de hornos", []]],
    "CP-01": [["Compresor se apaga por alta temperatura", "Obstrucción o suciedad", "Limpieza de radiador y cambio de filtro de aire", [["R-006", 1]]]],
    "OS-01": [["Baja producción de agua", "Obstrucción o suciedad", "Cambio de cartuchos y limpieza de membrana", [["R-012", 4]]]],
    "CL-01": [["Caldero no enciende", "Falla eléctrica", "Cambio de contactor del quemador", [["R-016", 1]]]],
    "MC-01": [["Montacargas no levanta carga", "Falta de lubricación", "Completar aceite hidráulico", [["R-021", 2]]]]
  };
  // Las máquinas críticas o más exigidas fallan más
  const peso = ["LL-02", "LL-02", "LL-01", "LL-01", "FJ-01", "FJ-01", "ET-01", "BT-02", "MZ-01", "CP-01", "TP-01",
    "CD-01", "OS-01", "SP-01", "TE-01", "BT-01", "MZ-02", "RX-01", "CL-01", "MC-01"];

  const ordenes = [];
  let n = 0;
  const nueva = (o) => { n += 1; ordenes.push({ id: n, codigo: "OT-" + String(n).padStart(4, "0"), repuestos: [], ...o }); };

  // Correctivos de los últimos 90 días
  for (let i = 0; i < 46; i++) {
    const maquina = elegir(peso);
    const [titulo, causa, solucion, rep] = elegir(fallas[maquina]);
    const dias = entre(3, 89);
    const horaInicio = entre(7, 20);
    const espera = entre(0, 90) / 60;
    const trabajo = Math.max(0.5, entre(5, 50) / 10);
    const critica = MAQUINAS.find(m => m.codigo === maquina).criticidad === "A";
    const inicio = new Date(haceDias(dias, horaInicio));
    const creada = new Date(inicio - espera * 3600000);
    const fin = new Date(+inicio + trabajo * 3600000);
    nueva({
      tipo: "Correctivo", maquina, titulo, descripcion: titulo + ".", prioridad: critica ? elegir(["Alta", "Alta", "Media"]) : elegir(["Media", "Baja"]),
      estado: "Terminada", solicitanteId: elegir([10, 11, 12]), tecnicoId: elegir([2, 2, 3, 4, 5]),
      creada: creada.toISOString(), programada: null, inicio: inicio.toISOString(), fin: fin.toISOString(),
      horasTrabajo: trabajo, horasParada: +(espera + trabajo).toFixed(1),
      repuestos: rep.map(([codigo, cantidad]) => ({ codigo, cantidad })), causa, solucion
    });
  }
  // Preventivos ejecutados (según el plan)
  plan.forEach(p => {
    const veces = Math.min(6, Math.floor(90 / p.frecuenciaDias));
    for (let k = 1; k <= veces; k++) {
      const dias = Math.round((Date.now() - new Date(p.ultima)) / DIA) + (k - 1) * p.frecuenciaDias;
      if (dias > 89) break;
      const inicio = new Date(haceDias(dias, 7));
      nueva({
        tipo: "Preventivo", maquina: p.maquina, titulo: p.tarea, descripcion: "Tarea del plan preventivo.", prioridad: "Media",
        estado: "Terminada", solicitanteId: 1, tecnicoId: p.tecnicoId, planId: p.id,
        creada: haceDias(dias + 2, 8), programada: haceDias(dias, 7), inicio: inicio.toISOString(),
        fin: new Date(+inicio + p.horas * 3600000).toISOString(),
        horasTrabajo: p.horas, horasParada: p.maquina === "Tableros" ? 0 : p.horas,
        repuestos: p.repuestos.map(r => ({ ...r })), causa: "", solucion: "Tarea completada según checklist."
      });
    }
  });
  // Mejoras
  nueva({ tipo: "Mejora", maquina: "FJ-01", titulo: "Instalar guardas de seguridad en transmisión de la faja", descripcion: "Cubrir cadenas y piñones expuestos.",
    prioridad: "Media", estado: "Terminada", solicitanteId: 1, tecnicoId: 4, creada: haceDias(40), programada: haceDias(35), inicio: haceDias(35, 8), fin: haceDias(35, 14),
    horasTrabajo: 6, horasParada: 0, repuestos: [], causa: "", solucion: "Guardas de plancha perforada instaladas." });

  ordenes.sort((a, b) => new Date(a.creada) - new Date(b.creada));
  ordenes.forEach((o, i) => { o.id = i + 1; o.codigo = "OT-" + String(i + 1).padStart(4, "0"); });
  n = ordenes.length;

  // Órdenes abiertas ahora mismo
  const ahora = Date.now();
  const iso = (msAtras) => new Date(ahora - msAtras).toISOString();
  nueva({ tipo: "Correctivo", maquina: "LL-02", titulo: "Fuga de lejía en 3 boquillas, línea detenida", descripcion: "Las boquillas 2, 5 y 7 gotean lejía al envase y al piso. Se detuvo la línea por seguridad.",
    prioridad: "Alta", estado: "En ejecución", solicitanteId: 12, tecnicoId: 2, creada: iso(150 * 60000), inicio: iso(120 * 60000),
    paradaDesde: iso(150 * 60000), horasTrabajo: 0, horasParada: 0, repuestos: [{ codigo: "R-010", cantidad: 1 }], causa: "", solucion: "" });
  nueva({ tipo: "Correctivo", maquina: "OS-01", titulo: "Baja producción de agua tratada (0,8 m³/h)", descripcion: "Conductividad alta y caudal bajo. Se requiere cambio de membrana.",
    prioridad: "Alta", estado: "Esperando repuesto", solicitanteId: 10, tecnicoId: 5, creada: iso(26 * 3600000), inicio: iso(25 * 3600000),
    paradaDesde: null, horasTrabajo: 2, horasParada: 0, repuestos: [], causa: "Fin de vida útil", solucion: "", esperaRepuesto: "R-011" });
  nueva({ tipo: "Correctivo", maquina: "ET-01", titulo: "Etiquetas salen arrugadas en botella de 1 L", descripcion: "Pasa en el 10% de las botellas desde el turno noche.",
    prioridad: null, estado: "Pendiente", solicitanteId: 11, tecnicoId: null, creada: iso(40 * 60000), horasTrabajo: 0, horasParada: 0, causa: "", solucion: "" });
  nueva({ tipo: "Correctivo", maquina: "CP-01", titulo: "Ruido metálico al arrancar el compresor", descripcion: "Se escucha un golpe al arrancar en la mañana.",
    prioridad: "Media", estado: "Programada", solicitanteId: 11, tecnicoId: 2, creada: iso(20 * 3600000), programada: new Date(ahora + 1 * DIA).toISOString(),
    horasTrabajo: 0, horasParada: 0, causa: "", solucion: "" });
  nueva({ tipo: "Mejora", maquina: "LL-01", titulo: "Cambiar mangueras de PVC por mangueras resistentes a químicos", descripcion: "Las mangueras actuales se endurecen cada 2 meses.",
    prioridad: "Baja", estado: "Programada", solicitanteId: 1, tecnicoId: 4, creada: iso(3 * DIA), programada: new Date(ahora + 3 * DIA).toISOString(),
    horasTrabajo: 0, horasParada: 0, causa: "", solucion: "" });

  maquinas.find(m => m.codigo === "LL-02").estado = "Parada";
  maquinas.find(m => m.codigo === "OS-01").estado = "En mantenimiento";

  // Movimientos de almacén que no salen de una orden: compras, entregas de EPP y consumibles
  const movimientos = [];
  repuestos.forEach((r, i) => {
    if (i % 3 === 0) movimientos.push({ fecha: haceDias(entre(40, 75), 11), tipo: "Ingreso", codigo: r.codigo,
      cantidad: Math.max(1, r.minimo), nota: `OC-2026-0${300 + i} · ${PROVEEDORES[PROVEEDOR_DE_CATEGORIA[CATEGORIAS.indexOf(r.categoria)]]}` });
  });
  [["R-025", 4], ["R-026", 2], ["R-025", 6], ["R-029", 3], ["R-028", 4], ["R-027", 1], ["R-025", 4], ["R-031", 1], ["R-030", 2], ["R-029", 2]]
    .forEach(([codigo, cantidad], i) => movimientos.push({ fecha: haceDias(3 + i * 7, 8), tipo: "Salida", codigo, cantidad,
      nota: `Entrega a ${PERSONAS[1 + (i % 4)].nombre}` }));
  movimientos.push({ fecha: haceDias(3, 15), tipo: "Ingreso", codigo: "R-020", cantidad: 5, nota: "SC-0001 · Lubricantes Andinos" });
  movimientos.push({ fecha: haceDias(3, 15), tipo: "Ingreso", codigo: "R-012", cantidad: 10, nota: "SC-0001 · Hydrus Perú" });
  movimientos.push({ fecha: haceDias(32, 17), tipo: "Ajuste", codigo: "R-005", cantidad: -1, nota: "Conteo físico: faltante" });

  const compras = [
    { id: 1, codigo: "SC-0001", fecha: haceDias(9, 10), estado: "Recibida", solicitanteId: 1, recibida: haceDias(3, 15),
      nota: "Reposición mensual", items: [{ codigo: "R-020", cantidad: 5 }, { codigo: "R-012", cantidad: 10 }] },
    { id: 2, codigo: "SC-0002", fecha: haceDias(1, 9), estado: "Aprobada", solicitanteId: 1,
      nota: "Urgente: la planta de ósmosis está esperando la membrana", items: [{ codigo: "R-011", cantidad: 2 }] }
  ];
  const conteos = [{ fecha: haceDias(32, 17), articulos: 24, diferencias: 1, exactitud: 0.958, valorDiferencia: -22, por: 1 }];

  return {
    maquinas, repuestos, plan, ordenes,
    herramientas: HERRAMIENTAS.map(h => ({ ...h })),
    personas: PERSONAS.map(p => ({ ...p })),
    movimientos, compras, conteos,
    contador: ordenes.length
  };
}

// ---------- Guardar y leer ----------
function cargarDB() {
  try {
    const texto = localStorage.getItem(CLAVE_DB);
    if (texto) return JSON.parse(texto);
  } catch (e) { /* sin almacenamiento: usamos los datos de ejemplo */ }
  const db = generarDatos();
  guardarDB(db);
  return db;
}
function guardarDB(db) {
  try { localStorage.setItem(CLAVE_DB, JSON.stringify(db)); } catch (e) { /* modo privado */ }
}
function reiniciarDB() {
  try { localStorage.removeItem(CLAVE_DB); } catch (e) { /* nada */ }
}
