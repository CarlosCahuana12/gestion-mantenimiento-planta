// =========================================================
// GESTIÓN DE MANTENIMIENTO · lógica de la maqueta
// Vistas: panel del jefe, planta, órdenes de trabajo,
// preventivo, taller (repuestos y herramientas), técnicos,
// reportar falla. Todo se guarda en el navegador.
// =========================================================

let db = cargarDB();
normalizar();

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const vista = $("#vista");
let periodo = "30";
let filtrosOT = { estado: "abiertas", tipo: "", maquina: "", tecnico: "", texto: "" };
let maquinaSugerida = "";

// ---------- Utilidades ----------
function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const ahoraISO = () => new Date().toISOString();
const fmtNum = (n, d = 0) => Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
const soles = (n) => "S/ " + fmtNum(n, 0);
function fmtHoras(h) {
  if (!h) return "0 h";
  return h < 1 ? Math.round(h * 60) + " min" : fmtNum(h, 1) + " h";
}
function fmtFecha(iso, conHora = true) {
  if (!iso) return "—";
  const f = new Date(iso);
  const opc = { day: "2-digit", month: "short" };
  if (f.getFullYear() !== new Date().getFullYear()) opc.year = "numeric";
  if (conHora) Object.assign(opc, { hour: "2-digit", minute: "2-digit", hour12: false });
  return f.toLocaleString("es-PE", opc).replace(".", "");
}
function haceTexto(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h ${min % 60 ? (min % 60) + " min" : ""}`.trim();
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}
function guardar() { guardarDB(db); }
function aviso(texto) {
  const a = $("#aviso");
  a.textContent = texto;
  a.classList.add("visible");
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => a.classList.remove("visible"), 3200);
}

const persona = (id) => db.personas.find(p => p.id === Number(id));
const nombre = (id) => persona(id)?.nombre || "—";
const maquina = (cod) => db.maquinas.find(m => m.codigo === cod);
const nombreMaquina = (cod) => maquina(cod)?.nombre || (cod === "Tableros" ? "Tableros eléctricos (general)" : cod);
const repuesto = (cod) => db.repuestos.find(r => r.codigo === cod);
const tecnicos = () => db.personas.filter(p => p.rol === "tecnico");
const abiertas = () => db.ordenes.filter(o => o.estado !== "Terminada");

function yo() {
  let id = 1;
  try { id = Number(localStorage.getItem("persona-mant")) || 1; } catch (e) { /* nada */ }
  return persona(id) || persona(1);
}
const esJefe = () => yo().rol === "jefe";
const puedeActuar = (o) => esJefe() || (yo().rol === "tecnico" && o.tecnicoId === yo().id);

// Historial legible para órdenes que vienen de los datos de ejemplo
function normalizar() {
  db.ordenes.forEach(o => {
    if (o.historial) return;
    const h = [{ fecha: o.creada, texto: o.solicitanteId === 1 ? "Orden creada por el jefe" : `Falla reportada por ${nombreSimple(o.solicitanteId)}` }];
    if (o.tecnicoId) h.push({ fecha: o.programada || o.creada, texto: `Asignada a ${nombreSimple(o.tecnicoId)}` });
    if (o.inicio) h.push({ fecha: o.inicio, texto: "Trabajo iniciado" });
    if (o.estado === "Esperando repuesto") h.push({ fecha: o.inicio, texto: `En espera del repuesto ${o.esperaRepuesto}` });
    if (o.fin) h.push({ fecha: o.fin, texto: "Trabajo terminado" });
    o.historial = h;
  });
  db.compras = db.compras || [];
  db.conteos = db.conteos || [];
  db.repuestos.forEach(r => { r.categoria = r.categoria || "Consumibles"; });
  function nombreSimple(id) { return (PERSONAS.find(p => p.id === id) || {}).nombre || "—"; }
}

function costoOT(o) {
  const rep = (o.repuestos || []).reduce((s, r) => s + (repuesto(r.codigo)?.costo || 0) * r.cantidad, 0);
  const mo = (o.horasTrabajo || 0) * TARIFA_HORA;
  return { rep, mo, total: rep + mo };
}
function proximaFecha(p) { return new Date(+new Date(p.ultima) + p.frecuenciaDias * DIA); }
function diasPara(fecha) { return Math.floor((new Date(fecha).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DIA); }
function otAbiertaDePlan(p) { return db.ordenes.find(o => o.planId === p.id && o.estado !== "Terminada"); }
function estadoPlan(p) {
  const d = diasPara(proximaFecha(p));
  if (d < 0) return { txt: `Vencida hace ${-d} d`, cls: "c-mal", orden: 0 };
  if (d === 0) return { txt: "Toca hoy", cls: "c-alerta", orden: 1 };
  if (d <= 7) return { txt: `En ${d} día${d === 1 ? "" : "s"}`, cls: "c-alerta", orden: 2 };
  return { txt: `En ${d} días`, cls: "c-ok", orden: 3 };
}

// ---------- Etiquetas ----------
const CLS_MAQ = { "Operativa": "c-ok", "En mantenimiento": "c-alerta", "Parada": "c-mal", "Fuera de servicio": "c-gris" };
const CLS_OT = { "Pendiente": "c-alerta", "Programada": "c-gris", "En ejecución": "c-info", "Esperando repuesto": "c-mal", "Terminada": "c-ok" };
const CLS_PRI = { "Alta": "c-mal", "Media": "c-alerta", "Baja": "c-gris" };
const ICONO_TIPO = { "Correctivo": "🔧", "Preventivo": "🗓️", "Mejora": "💡" };
const chipMaq = (e) => `<span class="chip ${CLS_MAQ[e] || "c-gris"}">${esc(e)}</span>`;
const chipOT = (e) => `<span class="chip ${CLS_OT[e] || "c-gris"}">${esc(e)}</span>`;
const chipPri = (p) => p ? `<span class="chip sin-punto ${CLS_PRI[p]}">${esc(p)}</span>` : `<span class="tenue">Sin definir</span>`;
const crit = (c) => `<span class="crit crit-${c}" title="Criticidad ${c}">${c}</span>`;

// ---------- Indicadores ----------
function rangoPeriodo() {
  const hasta = new Date();
  let desde;
  if (periodo === "mes") desde = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  else desde = new Date(Date.now() - Number(periodo) * DIA);
  return { desde, hasta };
}
function textoPeriodo() {
  return { "7": "Últimos 7 días", "30": "Últimos 30 días", "mes": "Este mes", "90": "Últimos 90 días" }[periodo];
}

function indicadores(desde, hasta, codigoMaquina) {
  const maqs = codigoMaquina ? db.maquinas.filter(m => m.codigo === codigoMaquina) : db.maquinas;
  const dias = Math.max(1, (hasta - desde) / DIA);
  const horasProg = maqs.length * dias * (DIAS_PRODUCCION_MES / 30) * HORAS_TURNO_DIA;
  const r = { horasProg, horasParada: 0, fallas: 0, reparadas: 0, sumaReparacion: 0, costoRep: 0, costoMO: 0,
    porTipo: {}, paradaPorMaquina: {}, costoPorLinea: {}, causas: {}, ordenes: 0 };
  TIPOS_OT.forEach(t => r.porTipo[t] = { cantidad: 0, horas: 0, costo: 0 });

  db.ordenes.forEach(o => {
    if (codigoMaquina && o.maquina !== codigoMaquina) return;
    const creada = new Date(o.creada);
    if (o.tipo === "Correctivo" && creada >= desde && creada <= hasta) r.fallas++;

    // Horas de parada no programada (correctivos)
    if (o.tipo === "Correctivo") {
      let horas = 0;
      if (o.estado === "Terminada" && new Date(o.fin) >= desde) horas = o.horasParada || 0;
      else if (o.estado !== "Terminada" && o.paradaDesde) horas = (hasta - Math.max(+new Date(o.paradaDesde), +desde)) / 3600000;
      if (horas > 0) {
        r.horasParada += horas;
        r.paradaPorMaquina[o.maquina] = (r.paradaPorMaquina[o.maquina] || 0) + horas;
      }
      if (o.estado === "Terminada" && new Date(o.fin) >= desde) {
        r.reparadas++;
        r.sumaReparacion += o.horasParada || 0;
        if (o.causa) r.causas[o.causa] = (r.causas[o.causa] || 0) + 1;
      }
    }
    // Costos y reparto por tipo (según fecha de cierre o de inicio)
    const ref = new Date(o.fin || o.inicio || o.creada);
    if (ref >= desde && ref <= hasta && (o.inicio || o.fin)) {
      const c = costoOT(o);
      r.costoRep += c.rep;
      r.costoMO += c.mo;
      r.ordenes++;
      const t = r.porTipo[o.tipo];
      t.cantidad++; t.horas += o.horasTrabajo || 0; t.costo += c.total;
      const linea = maquina(o.maquina)?.linea || "Servicios generales";
      r.costoPorLinea[linea] = (r.costoPorLinea[linea] || 0) + c.total;
    }
  });
  r.costoTotal = r.costoRep + r.costoMO;
  r.disponibilidad = horasProg ? Math.max(0, 1 - r.horasParada / horasProg) : 1;
  r.mttr = r.reparadas ? r.sumaReparacion / r.reparadas : 0;
  r.mtbf = r.fallas ? (horasProg - r.horasParada) / r.fallas : null;
  return r;
}

// ---------- Cabecera, pestañas y navegación ----------
const PESTANAS = {
  jefe: [["panel", "📊 Panel"], ["planta", "🏭 Planta"], ["ordenes", "🛠️ Órdenes de trabajo"], ["preventivo", "🗓️ Preventivo"],
    ["inventario", "📦 Inventario"], ["taller", "🧰 Taller"], ["tecnicos", "👷 Técnicos"], ["reportar", "⚠️ Reportar falla"]],
  tecnico: [["ordenes", "🛠️ Mis órdenes"], ["planta", "🏭 Planta"], ["inventario", "📦 Inventario"], ["taller", "🧰 Taller"], ["reportar", "⚠️ Reportar falla"]],
  operador: [["reportar", "⚠️ Reportar falla"], ["ordenes", "📋 Mis reportes"], ["planta", "🏭 Planta"]]
};

// ---------- Selector "Ver como" (propio, sigue el tema claro/oscuro) ----------
const GRUPOS_ROL = [["jefe", "Jefatura", "Ve todo el sistema"], ["tecnico", "Técnicos del taller", "Ejecutan las órdenes"], ["operador", "Operadores de producción", "Reportan fallas"]];
const iniciales = (n) => n.split(" ").slice(0, 2).map(x => x[0]).join("").toUpperCase();
const avatar = (p, grande = false) => `<span class="avatar av-${p.rol}${grande ? " av-grande" : ""}" aria-hidden="true">${iniciales(p.nombre)}</span>`;

function pintarSelectorPersona() {
  const p = yo();
  const caja = $("#selectorPersona");
  caja.innerHTML = `
    <button class="persona-btn" id="btnPersona" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Cambiar de persona">
      <span class="persona-etq">Ver como</span>
      ${avatar(p)}
      <span class="persona-txt"><b>${esc(p.nombre)}</b><small>${esc(p.cargo)}</small></span>
      <span class="persona-flecha" aria-hidden="true">▾</span>
    </button>
    <div class="persona-menu" id="menuPersona" role="menu" hidden>
      <p class="persona-menu-titulo">Probar la maqueta como…</p>
      ${GRUPOS_ROL.map(([rol, titulo, sub]) => `
        <div class="persona-grupo">
          <div class="persona-grupo-cab"><span>${titulo}</span><small>${sub}</small></div>
          ${db.personas.filter(x => x.rol === rol).map(x => `
            <button class="persona-opcion ${x.id === p.id ? "actual" : ""}" role="menuitemradio" aria-checked="${x.id === p.id}" data-persona="${x.id}" type="button">
              ${avatar(x)}
              <span class="persona-txt"><b>${esc(x.nombre)}</b><small>${esc(x.cargo)}</small></span>
              <span class="persona-check" aria-hidden="true">${x.id === p.id ? "✓" : ""}</span>
            </button>`).join("")}
        </div>`).join("")}
    </div>`;
  const btn = $("#btnPersona"), menu = $("#menuPersona");
  const abrir = (si) => {
    menu.hidden = !si;
    btn.setAttribute("aria-expanded", si);
    if (si) (menu.querySelector(".actual") || menu.querySelector("button")).focus();
  };
  btn.onclick = (e) => { e.stopPropagation(); abrir(menu.hidden); };
  menu.onclick = (e) => e.stopPropagation();
  menu.onkeydown = (e) => {
    const ops = $$(".persona-opcion", menu);
    const i = ops.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); ops[(i + 1) % ops.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); ops[(i - 1 + ops.length) % ops.length].focus(); }
    if (e.key === "Escape") { abrir(false); btn.focus(); }
  };
  $$("[data-persona]", menu).forEach(o => o.onclick = () => cambiarPersona(Number(o.dataset.persona)));
}
document.addEventListener("click", () => { const m = $("#menuPersona"); if (m && !m.hidden) { m.hidden = true; $("#btnPersona").setAttribute("aria-expanded", "false"); } });

function cambiarPersona(id) {
  try { localStorage.setItem("persona-mant", id); } catch (e) { /* nada */ }
  filtrosOT = { estado: "abiertas", tipo: "", maquina: "", tecnico: "", texto: "" };
  pestanaInv = "stock";
  cerrarModal();
  pintarSelectorPersona();
  location.hash = PESTANAS[yo().rol][0][0];
  render();
  aviso(`Ahora ves la maqueta como ${yo().nombre}`);
}

function prepararCabecera() {
  pintarSelectorPersona();
  $("#btnTema").onclick = () => {
    const nuevo = document.documentElement.dataset.tema === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = nuevo;
    try { localStorage.setItem("tema-mant", nuevo); } catch (e) { /* nada */ }
    $("#btnTema").textContent = nuevo === "oscuro" ? "☀️" : "🌙";
  };
  $("#btnTema").textContent = document.documentElement.dataset.tema === "oscuro" ? "☀️" : "🌙";
  $("#btnReiniciar").onclick = () => {
    if (!confirm("¿Volver a los datos de ejemplo? Se perderán los cambios que hiciste en la maqueta.")) return;
    reiniciarDB();
    db = cargarDB();
    normalizar();
    pintarSelectorPersona();
    render();
    aviso("Datos de ejemplo restablecidos");
  };
  const reloj = () => { $("#reloj").textContent = new Date().toLocaleString("es-PE", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }); };
  reloj();
  setInterval(reloj, 30000);
}

function pintarPestanas(actual) {
  const rol = yo().rol;
  const burbuja = (id) => {
    let n = 0;
    if (id === "ordenes" && rol === "jefe") n = db.ordenes.filter(o => o.estado === "Pendiente").length;
    if (id === "ordenes" && rol === "tecnico") n = abiertas().filter(o => o.tecnicoId === yo().id).length;
    if (id === "preventivo") n = db.plan.filter(p => diasPara(proximaFecha(p)) < 0 && !otAbiertaDePlan(p)).length;
    if (id === "inventario" && rol === "jefe") n = db.repuestos.filter(r => r.stock < r.minimo).length;
    return n ? `<span class="burbuja">${n}</span>` : "";
  };
  $("#pestanas").innerHTML = PESTANAS[rol].map(([id, txt]) =>
    `<a href="#${id}" ${id === actual ? 'aria-current="page"' : ""}>${txt}${burbuja(id)}</a>`).join("");
}

function render() {
  const rol = yo().rol;
  const permitidas = PESTANAS[rol].map(p => p[0]);
  let actual = location.hash.replace("#", "");
  if (!permitidas.includes(actual)) actual = permitidas[0];
  pintarPestanas(actual);
  ({ panel: vistaPanel, planta: vistaPlanta, ordenes: vistaOrdenes, preventivo: vistaPreventivo,
     taller: vistaTaller, inventario: vistaInventario, tecnicos: vistaTecnicos, reportar: vistaReportar })[actual]();
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

// =========================================================
// PANEL DEL JEFE
// =========================================================
function selectorPeriodo() {
  return `<select id="selPeriodo" aria-label="Periodo">
    ${[["7", "Últimos 7 días"], ["30", "Últimos 30 días"], ["mes", "Este mes"], ["90", "Últimos 90 días"]]
      .map(([v, t]) => `<option value="${v}" ${v === periodo ? "selected" : ""}>${t}</option>`).join("")}
  </select>`;
}
function conectarPeriodo() {
  const s = $("#selPeriodo");
  if (s) s.onchange = () => { periodo = s.value; render(); };
}

function kpi(valor, etiqueta, nota, tono = "") {
  return `<div class="kpi ${tono}"><span>${etiqueta}</span><b>${valor}</b>${nota ? `<small>${nota}</small>` : ""}</div>`;
}
function barras(filas, { formato = (v) => fmtNum(v), clase = () => "", vacio = "Sin datos en el periodo" } = {}) {
  if (!filas.length) return `<p class="vacio">${vacio}</p>`;
  const max = Math.max(...filas.map(f => f[1]), 0.0001);
  return `<div class="barras">${filas.map(([etq, v, titulo]) => `
    <div class="barra-fila" title="${esc(titulo || etq)}">
      <span class="etq">${esc(etq)}</span>
      <div class="barra-pista"><div class="barra-relleno ${clase(v, etq)}" style="width:${Math.max(2, v / max * 100)}%"></div></div>
      <span class="val">${formato(v)}</span>
    </div>`).join("")}</div>`;
}

function alertasPlanta() {
  const lista = [];
  db.maquinas.filter(m => m.estado === "Parada").forEach(m => {
    const o = abiertas().find(x => x.maquina === m.codigo && x.paradaDesde);
    lista.push({ nivel: "mal", icono: "⛔", txt: `<b>${m.codigo}</b> ${esc(m.nombre)} está parada`,
      sub: o ? `${o.codigo} · ${o.estado} · ${o.tecnicoId ? "atiende " + esc(nombre(o.tecnicoId)) : "sin técnico"} · parada ${haceTexto(o.paradaDesde)}` : "Sin orden de trabajo abierta", ot: o?.id });
  });
  db.ordenes.filter(o => o.estado === "Pendiente").forEach(o => lista.push({ nivel: "alerta", icono: "📥",
    txt: `<b>${o.codigo}</b> sin asignar: ${esc(o.titulo)}`, sub: `${o.maquina} · reportada por ${esc(nombre(o.solicitanteId))} ${haceTexto(o.creada)}`, ot: o.id }));
  db.ordenes.filter(o => o.estado === "Esperando repuesto").forEach(o => {
    const r = repuesto(o.esperaRepuesto);
    lista.push({ nivel: "mal", icono: "📦", txt: `<b>${o.codigo}</b> espera repuesto: ${esc(r?.nombre || o.esperaRepuesto)}`,
      sub: `${o.maquina} · stock actual ${r ? r.stock : 0} ${r?.unidad || ""}`, ot: o.id });
  });
  const vencidas = db.plan.filter(p => diasPara(proximaFecha(p)) < 0 && !otAbiertaDePlan(p));
  if (vencidas.length) lista.push({ nivel: "alerta", icono: "🗓️", txt: `<b>${vencidas.length}</b> tarea${vencidas.length === 1 ? "" : "s"} preventiva${vencidas.length === 1 ? "" : "s"} vencida${vencidas.length === 1 ? "" : "s"} sin orden`,
    sub: vencidas.slice(0, 3).map(p => p.maquina).join(", ") + (vencidas.length > 3 ? "…" : ""), ir: "preventivo" });
  const sinStock = db.repuestos.filter(r => r.stock < r.minimo);
  if (sinStock.length) lista.push({ nivel: "alerta", icono: "🧰", txt: `<b>${sinStock.length}</b> repuestos bajo el stock mínimo`,
    sub: sinStock.slice(0, 3).map(r => r.nombre).join(" · ") + (sinStock.length > 3 ? "…" : ""), ir: "inventario" });
  const enReparacion = db.herramientas.filter(h => h.estado === "En reparación");
  if (enReparacion.length) lista.push({ nivel: "alerta", icono: "🔩", txt: `${enReparacion.length} herramienta${enReparacion.length === 1 ? "" : "s"} en reparación`,
    sub: enReparacion.map(h => h.nombre).join(" · "), ir: "taller" });
  return lista;
}

function vistaPanel() {
  const { desde, hasta } = rangoPeriodo();
  const k = indicadores(desde, hasta);
  const total = db.maquinas.length;
  const cuenta = (e) => db.maquinas.filter(m => m.estado === e).length;
  const operativas = cuenta("Operativa");
  const abiertasOT = abiertas();
  const vencidas = db.plan.filter(p => diasPara(proximaFecha(p)) < 0).length;
  const semana = db.plan.filter(p => { const d = diasPara(proximaFecha(p)); return d >= 0 && d <= 7; }).length;
  const prev = k.porTipo.Preventivo, corr = k.porTipo.Correctivo, mej = k.porTipo.Mejora;
  const horasTot = prev.horas + corr.horas + mej.horas || 1;
  const pctPrev = prev.horas / horasTot;
  const alertas = alertasPlanta();

  const top = Object.entries(k.paradaPorMaquina).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([c, h]) => [c + " · " + nombreMaquina(c), h, nombreMaquina(c)]);
  const lineas = Object.entries(k.costoPorLinea).sort((a, b) => b[1] - a[1]);
  const causas = Object.entries(k.causas).sort((a, b) => b[1] - a[1]);
  const criticos = db.repuestos.filter(r => r.stock < r.minimo).sort((a, b) => a.stock / a.minimo - b.stock / b.minimo);

  vista.innerHTML = `
    <div class="tarjeta-cab">
      <div><h2>Buen día, ${esc(yo().nombre.split(" ")[0])}</h2><p class="tenue">Así está la planta ahora y cómo fue el periodo elegido.</p></div>
      <div class="filtros">${selectorPeriodo()}<button class="btn" id="btnExportar">📥 Exportar a Excel</button></div>
    </div>

    <div class="kpis">
      ${kpi(`${operativas}<span class="tenue" style="font-size:15px"> / ${total}</span>`, "Máquinas operativas",
        `${cuenta("Parada")} parada${cuenta("Parada") === 1 ? "" : "s"} · ${cuenta("En mantenimiento")} en mantenimiento`, cuenta("Parada") ? "k-mal" : "k-ok")}
      ${kpi(abiertasOT.length, "Órdenes abiertas", `${abiertasOT.filter(o => o.estado === "Pendiente").length} sin asignar · ${abiertasOT.filter(o => o.estado === "Esperando repuesto").length} esperando repuesto`, "k-info")}
      ${kpi(fmtNum(k.disponibilidad * 100, 1) + "%", "Disponibilidad de planta", `${textoPeriodo()} · meta 98%`, k.disponibilidad >= .98 ? "k-ok" : "k-alerta")}
      ${kpi(vencidas, "Preventivos vencidos", `${semana} tocan en los próximos 7 días`, vencidas ? "k-alerta" : "k-ok")}
    </div>
    <div class="kpis">
      ${kpi(fmtHoras(k.mttr), "MTTR · tiempo medio para reparar", `${k.reparadas} reparaciones en el periodo`, "k-info")}
      ${kpi(k.mtbf ? fmtNum(k.mtbf, 0) + " h" : "—", "MTBF · tiempo medio entre fallas", `${k.fallas} fallas reportadas`, "k-info")}
      ${kpi(fmtHoras(k.horasParada), "Horas de parada no programada", "Suma de todas las máquinas", k.horasParada > 40 ? "k-mal" : "k-alerta")}
      ${kpi(soles(k.costoTotal), "Costo de mantenimiento", `Repuestos ${soles(k.costoRep)} · mano de obra ${soles(k.costoMO)}`, "k-info")}
    </div>

    <div class="rejilla-2">
      <section class="tarjeta">
        <div class="tarjeta-cab"><h2>🔔 Requiere tu atención</h2><span class="tenue">${alertas.length} aviso${alertas.length === 1 ? "" : "s"}</span></div>
        ${alertas.length ? `<div class="alertas">${alertas.map((a, i) => `
          <div class="alerta ${a.nivel === "mal" ? "a-mal" : ""}">
            <span class="icono">${a.icono}</span>
            <div><div>${a.txt}</div><small class="tenue">${a.sub}</small></div>
            ${a.ot ? `<button class="btn btn-chico" data-ot="${a.ot}">Ver</button>` : `<a class="btn btn-chico" href="#${a.ir}">Ir</a>`}
          </div>`).join("")}</div>` : `<p class="vacio">Todo en orden 👍</p>`}
      </section>
      <section class="tarjeta">
        <div class="tarjeta-cab"><h2>🛠️ Órdenes en curso</h2><a href="#ordenes" class="enlace">Ver todas →</a></div>
        ${tablaOrdenes(abiertasOT.sort(ordenarAbiertas).slice(0, 8), true)}
      </section>
    </div>

    <section class="tarjeta">
      <div class="tarjeta-cab"><h2>🏭 Estado de la planta en este momento</h2>
        <div class="leyenda"><span><i style="background:var(--ok)"></i>Operativa</span><span><i style="background:var(--alerta)"></i>En mantenimiento</span><span><i style="background:var(--mal)"></i>Parada</span></div></div>
      ${tablero(db.maquinas)}
    </section>

    <div class="rejilla-3">
      <section class="tarjeta">
        <h2>Horas de parada por máquina</h2>
        <p class="tenue">Paradas no programadas · ${textoPeriodo().toLowerCase()}</p>
        ${barras(top, { formato: fmtHoras, clase: () => "r-mal" })}
      </section>
      <section class="tarjeta">
        <h2>Preventivo vs. correctivo</h2>
        <p class="tenue">Horas de trabajo del taller · meta: 70% preventivo</p>
        <div class="reparto" role="img" aria-label="Reparto de horas">
          <span style="width:${prev.horas / horasTot * 100}%;background:var(--ok)"></span>
          <span style="width:${corr.horas / horasTot * 100}%;background:var(--mal)"></span>
          <span style="width:${mej.horas / horasTot * 100}%;background:var(--info)"></span>
        </div>
        <div class="leyenda"><span><i style="background:var(--ok)"></i>Preventivo ${fmtNum(prev.horas / horasTot * 100)}%</span>
          <span><i style="background:var(--mal)"></i>Correctivo ${fmtNum(corr.horas / horasTot * 100)}%</span>
          <span><i style="background:var(--info)"></i>Mejora ${fmtNum(mej.horas / horasTot * 100)}%</span></div>
        <table><thead><tr><th>Tipo</th><th class="numero">Órdenes</th><th class="numero">Horas</th><th class="numero">Costo</th></tr></thead><tbody>
          ${TIPOS_OT.map(t => `<tr><td>${ICONO_TIPO[t]} ${t}</td><td class="numero">${k.porTipo[t].cantidad}</td><td class="numero">${fmtNum(k.porTipo[t].horas, 1)}</td><td class="numero">${soles(k.porTipo[t].costo)}</td></tr>`).join("")}
        </tbody></table>
        <p class="tenue">${pctPrev >= .7 ? "✅ Buen balance: la mayor parte del trabajo es planificado." : "⚠️ Mucho trabajo correctivo: conviene reforzar el plan preventivo."}</p>
      </section>
      <section class="tarjeta">
        <h2>Costo por línea</h2>
        <p class="tenue">Repuestos + mano de obra (S/ ${TARIFA_HORA}/h)</p>
        ${barras(lineas, { formato: soles })}
      </section>
    </div>

    <div class="rejilla-2">
      <section class="tarjeta">
        <h2>Causas de falla más frecuentes</h2>
        ${barras(causas, { formato: (v) => v + (v === 1 ? " falla" : " fallas"), clase: () => "r-alerta" })}
      </section>
      <section class="tarjeta">
        <div class="tarjeta-cab"><h2>📦 Repuestos por reponer</h2><a href="#inventario" class="enlace">Ir al inventario →</a></div>
        ${criticos.length ? `<div class="tabla-caja"><table><thead><tr><th>Repuesto</th><th class="numero">Stock</th><th class="numero">Mínimo</th><th class="numero">Comprar</th></tr></thead><tbody>
          ${criticos.map(r => `<tr><td>${esc(r.nombre)}<small>${r.codigo} · ${esc(r.ubicacion)}</small></td>
            <td class="numero"><span class="chip ${r.stock === 0 ? "c-mal" : "c-alerta"}">${fmtNum(r.stock)} ${esc(r.unidad)}</span></td>
            <td class="numero">${fmtNum(r.minimo)}</td><td class="numero">${fmtNum(r.minimo * 2 - r.stock)} ${esc(r.unidad)}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="vacio">Todo el stock está sobre el mínimo</p>`}
      </section>
    </div>`;

  conectarPeriodo();
  conectarTablero();
  conectarFilasOT();
  $$("[data-ot]").forEach(b => b.onclick = () => abrirOT(Number(b.dataset.ot)));
  $("#btnExportar").onclick = exportarExcel;
}

// ---------- Tablero de máquinas ----------
function tablero(maquinas) {
  const porLinea = LINEAS.map(l => [l, maquinas.filter(m => m.linea === l)]).filter(([, ms]) => ms.length);
  if (!porLinea.length) return `<p class="vacio">No hay máquinas con ese filtro</p>`;
  return `<div class="planta">${porLinea.map(([linea, ms]) => `
    <div class="linea-planta"><h3>${esc(linea)}</h3><div class="tiles">
      ${ms.map(m => {
        const o = abiertas().filter(x => x.maquina === m.codigo).sort(ordenarAbiertas)[0];
        return `<button class="tile t-${m.estado.split(" ")[0]}" data-maquina="${m.codigo}" type="button">
          <span class="fila-tile"><span class="codigo">${m.codigo}</span>${crit(m.criticidad)}</span>
          <strong>${esc(m.nombre)}</strong>
          <span class="fila-tile">${chipMaq(m.estado)}</span>
          ${o ? `<small class="tenue">${o.codigo} · ${esc(o.estado)}</small>` : ""}
        </button>`;
      }).join("")}
    </div></div>`).join("")}</div>`;
}
function conectarTablero() { $$("[data-maquina]").forEach(b => b.onclick = () => fichaMaquina(b.dataset.maquina)); }

// =========================================================
// PLANTA (máquinas)
// =========================================================
let filtroPlanta = { linea: "", estado: "", texto: "", modo: "tablero" };
function vistaPlanta() {
  const f = filtroPlanta;
  const lista = db.maquinas.filter(m => (!f.linea || m.linea === f.linea) && (!f.estado || m.estado === f.estado) &&
    (!f.texto || (m.codigo + " " + m.nombre + " " + m.marca).toLowerCase().includes(f.texto.toLowerCase())));
  const desde = new Date(Date.now() - 90 * DIA), hasta = new Date();
  vista.innerHTML = `
    <section class="tarjeta">
      <div class="tarjeta-cab"><div><h2>🏭 Máquinas instaladas en planta</h2><p class="tenue">${db.maquinas.length} equipos en ${LINEAS.length} áreas. Toca una máquina para ver su ficha e historial.</p></div>
        <div class="segmentos"><button class="${f.modo === "tablero" ? "activo" : ""}" data-modo="tablero">▦ Tablero</button><button class="${f.modo === "lista" ? "activo" : ""}" data-modo="lista">☰ Lista</button></div></div>
      <div class="filtros">
        <input type="search" id="fTexto" placeholder="🔍 Buscar código, nombre o marca" value="${esc(f.texto)}" aria-label="Buscar máquina">
        <select id="fLinea" aria-label="Línea"><option value="">Todas las líneas</option>${LINEAS.map(l => `<option ${l === f.linea ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <select id="fEstado" aria-label="Estado"><option value="">Todos los estados</option>${ESTADOS_MAQUINA.map(e => `<option ${e === f.estado ? "selected" : ""}>${e}</option>`).join("")}</select>
      </div>
      ${f.modo === "tablero" ? tablero(lista) : `<div class="tabla-caja"><table>
        <thead><tr><th>Código</th><th>Máquina</th><th>Línea</th><th>Crit.</th><th>Estado</th><th class="numero">Disp. 90 d</th><th class="numero">Fallas 90 d</th><th class="numero">Costo 90 d</th></tr></thead>
        <tbody>${lista.map(m => { const k = indicadores(desde, hasta, m.codigo); return `<tr class="clic" data-maquina="${m.codigo}">
          <td class="codigo">${m.codigo}</td><td>${esc(m.nombre)}<small>${esc(m.marca)} ${esc(m.modelo)} · ${m.anio}</small></td>
          <td>${esc(m.linea)}</td><td>${crit(m.criticidad)}</td><td>${chipMaq(m.estado)}</td>
          <td class="numero">${fmtNum(k.disponibilidad * 100, 1)}%</td><td class="numero">${k.fallas}</td><td class="numero">${soles(k.costoTotal)}</td></tr>`; }).join("")
          || `<tr><td colspan="8" class="vacio">No hay máquinas con ese filtro</td></tr>`}</tbody></table></div>`}
    </section>`;
  $("#fTexto").oninput = (e) => { f.texto = e.target.value; const pos = e.target.selectionStart; vistaPlanta(); const i = $("#fTexto"); i.focus(); i.setSelectionRange(pos, pos); };
  $("#fLinea").onchange = (e) => { f.linea = e.target.value; vistaPlanta(); };
  $("#fEstado").onchange = (e) => { f.estado = e.target.value; vistaPlanta(); };
  $$("[data-modo]").forEach(b => b.onclick = () => { f.modo = b.dataset.modo; vistaPlanta(); });
  conectarTablero();
}

function fichaMaquina(cod) {
  const m = maquina(cod);
  if (!m) return;
  const desde = new Date(Date.now() - 90 * DIA), hasta = new Date();
  const k = indicadores(desde, hasta, cod);
  const historial = db.ordenes.filter(o => o.maquina === cod).sort((a, b) => new Date(b.creada) - new Date(a.creada));
  const tareas = db.plan.filter(p => p.maquina === cod);
  abrirModal({
    titulo: `${m.codigo} · ${m.nombre}`,
    subtitulo: `${chipMaq(m.estado)} ${crit(m.criticidad)} <span class="tenue">${esc(m.linea)}</span>`,
    cuerpo: `
      <div class="datos">
        <div class="dato"><span>Marca y modelo</span><b>${esc(m.marca)} ${esc(m.modelo)}</b></div>
        <div class="dato"><span>Año</span><b>${m.anio}</b></div>
        <div class="dato"><span>Ubicación</span><b>${esc(m.ubicacion)}</b></div>
        <div class="dato"><span>Horómetro</span><b>${m.horometro ? fmtNum(m.horometro) + " h" : "No aplica"}</b></div>
        <div class="dato"><span>Criticidad</span><b>${{ A: "A · detiene la producción", B: "B · afecta la producción", C: "C · bajo impacto" }[m.criticidad]}</b></div>
        <div class="dato"><span>Órdenes registradas</span><b>${historial.length}</b></div>
      </div>
      <div class="kpis">
        ${kpi(fmtNum(k.disponibilidad * 100, 1) + "%", "Disponibilidad 90 d", "", k.disponibilidad >= .98 ? "k-ok" : "k-alerta")}
        ${kpi(k.fallas, "Fallas 90 d", "", k.fallas > 4 ? "k-mal" : "k-info")}
        ${kpi(fmtHoras(k.mttr), "MTTR", "", "k-info")}
        ${kpi(soles(k.costoTotal), "Costo 90 d", "", "k-info")}
      </div>
      ${esJefe() ? `<div class="acciones"><label for="selEstadoMaq"><b>Cambiar estado:</b></label>
        <select id="selEstadoMaq" class="campo">${ESTADOS_MAQUINA.map(e => `<option ${e === m.estado ? "selected" : ""}>${e}</option>`).join("")}</select>
        <button class="btn btn-chico" id="btnEstadoMaq">Guardar</button></div>` : ""}
      <div><h3>Plan preventivo</h3>
        ${tareas.length ? `<div class="tabla-caja"><table><thead><tr><th>Tarea</th><th>Cada</th><th>Próxima</th></tr></thead><tbody>
          ${tareas.map(p => { const e = estadoPlan(p); return `<tr><td>${esc(p.tarea)}<small>${esc(nombre(p.tecnicoId))}</small></td><td>${p.frecuenciaDias} días</td>
            <td>${fmtFecha(proximaFecha(p).toISOString(), false)} <span class="chip ${e.cls}">${e.txt}</span></td></tr>`; }).join("")}
        </tbody></table></div>` : `<p class="tenue">Esta máquina no tiene tareas preventivas.</p>`}
      </div>
      <div><h3>Historial de órdenes</h3>
        ${tablaOrdenes(historial.slice(0, 12), true)}
        ${historial.length > 12 ? `<p class="tenue">Mostrando las 12 más recientes de ${historial.length}.</p>` : ""}
      </div>`,
    pie: `<button class="btn" data-cerrar>Cerrar</button>
      <button class="btn" id="btnReportarMaq">⚠️ Reportar falla</button>
      ${esJefe() ? `<button class="btn btn-primario" id="btnNuevaOTMaq">➕ Nueva orden</button>` : ""}`
  });
  conectarFilasOT();
  $("#btnReportarMaq").onclick = () => { cerrarModal(); maquinaSugerida = cod; location.hash = "reportar"; render(); };
  if (esJefe()) {
    $("#btnNuevaOTMaq").onclick = () => formNuevaOT(cod);
    $("#btnEstadoMaq").onclick = () => {
      m.estado = $("#selEstadoMaq").value;
      guardar(); render(); fichaMaquina(cod);
      aviso(`${cod} ahora figura como "${m.estado}"`);
    };
  }
}

// =========================================================
// ÓRDENES DE TRABAJO
// =========================================================
const PESO_ESTADO = { "Pendiente": 0, "En ejecución": 1, "Esperando repuesto": 2, "Programada": 3, "Terminada": 4 };
const PESO_PRI = { "Alta": 0, "Media": 1, "Baja": 2 };
function ordenarAbiertas(a, b) {
  return (PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado]) || ((PESO_PRI[a.prioridad] ?? -1) - (PESO_PRI[b.prioridad] ?? -1)) || (new Date(b.creada) - new Date(a.creada));
}

function tablaOrdenes(lista, compacta = false) {
  if (!lista.length) return `<p class="vacio">No hay órdenes</p>`;
  return `<div class="tabla-caja"><table>
    <thead><tr><th>Orden</th><th>Trabajo</th>${compacta ? "" : "<th>Máquina</th>"}<th>Prioridad</th><th>Técnico</th><th>Estado</th>${compacta ? "" : '<th class="numero">Costo</th>'}</tr></thead>
    <tbody>${lista.map(o => `<tr class="clic" data-fila-ot="${o.id}">
      <td class="codigo">${o.codigo}<small>${fmtFecha(o.creada)}</small></td>
      <td>${ICONO_TIPO[o.tipo]} ${esc(o.titulo)}<small>${compacta ? `${o.maquina} · ` : ""}${o.tipo}</small></td>
      ${compacta ? "" : `<td><span class="codigo">${o.maquina}</span><small>${esc(nombreMaquina(o.maquina))}</small></td>`}
      <td>${chipPri(o.prioridad)}</td>
      <td>${o.tecnicoId ? esc(nombre(o.tecnicoId)) : '<span class="tenue">Sin asignar</span>'}</td>
      <td>${chipOT(o.estado)}</td>
      ${compacta ? "" : `<td class="numero">${o.estado === "Terminada" || o.repuestos?.length ? soles(costoOT(o).total) : "—"}</td>`}
    </tr>`).join("")}</tbody></table></div>`;
}
function conectarFilasOT() { $$("[data-fila-ot]").forEach(f => f.onclick = () => abrirOT(Number(f.dataset.filaOt))); }

function vistaOrdenes() {
  const rol = yo().rol;
  const f = filtrosOT;
  let base = db.ordenes;
  if (rol === "tecnico") base = base.filter(o => o.tecnicoId === yo().id);
  if (rol === "operador") base = base.filter(o => o.solicitanteId === yo().id);
  const lista = base.filter(o =>
    (f.estado === "" || (f.estado === "abiertas" ? o.estado !== "Terminada" : o.estado === f.estado)) &&
    (!f.tipo || o.tipo === f.tipo) && (!f.maquina || o.maquina === f.maquina) &&
    (!f.tecnico || String(o.tecnicoId) === f.tecnico) &&
    (!f.texto || (o.codigo + " " + o.titulo + " " + o.maquina + " " + nombreMaquina(o.maquina)).toLowerCase().includes(f.texto.toLowerCase()))
  ).sort((a, b) => f.estado === "Terminada" || f.estado === "" ? (new Date(b.creada) - new Date(a.creada)) : ordenarAbiertas(a, b));

  const misAbiertas = base.filter(o => o.estado !== "Terminada");
  const titulo = { jefe: "🛠️ Órdenes de trabajo", tecnico: "🛠️ Mis órdenes de trabajo", operador: "📋 Mis reportes de falla" }[rol];
  const resumen = rol === "jefe" ? "" : `<div class="kpis">
    ${kpi(misAbiertas.length, rol === "tecnico" ? "Asignadas abiertas" : "Reportes abiertos", "", "k-info")}
    ${kpi(misAbiertas.filter(o => o.estado === "En ejecución").length, "En ejecución", "", "k-alerta")}
    ${kpi(base.filter(o => o.estado === "Terminada" && new Date(o.fin) > Date.now() - 30 * DIA).length, "Terminadas en 30 días", "", "k-ok")}
    ${rol === "tecnico" ? kpi(fmtNum(base.filter(o => o.fin && new Date(o.fin) > Date.now() - 30 * DIA).reduce((s, o) => s + (o.horasTrabajo || 0), 0), 1) + " h", "Horas trabajadas 30 d", "", "k-info")
      : kpi(base.length, "Reportes en total", "", "")}
  </div>`;

  vista.innerHTML = `${resumen}
    <section class="tarjeta">
      <div class="tarjeta-cab"><h2>${titulo}</h2>
        <div class="acciones">
          ${rol === "jefe" ? `<button class="btn" id="btnExportar">📥 Excel</button><button class="btn btn-primario" id="btnNuevaOT">➕ Nueva orden</button>` : ""}
          ${rol === "operador" ? `<a class="btn btn-primario" href="#reportar">⚠️ Reportar otra falla</a>` : ""}
        </div></div>
      <div class="filtros">
        <input type="search" id="fTexto" placeholder="🔍 Buscar" value="${esc(f.texto)}" aria-label="Buscar orden">
        <select id="fEstado" aria-label="Estado">
          <option value="abiertas" ${f.estado === "abiertas" ? "selected" : ""}>Abiertas</option>
          <option value="" ${f.estado === "" ? "selected" : ""}>Todas</option>
          ${ESTADOS_OT.map(e => `<option ${e === f.estado ? "selected" : ""}>${e}</option>`).join("")}
        </select>
        <select id="fTipo" aria-label="Tipo"><option value="">Todos los tipos</option>${TIPOS_OT.map(t => `<option ${t === f.tipo ? "selected" : ""}>${t}</option>`).join("")}</select>
        <select id="fMaquina" aria-label="Máquina"><option value="">Todas las máquinas</option>${db.maquinas.map(m => `<option value="${m.codigo}" ${m.codigo === f.maquina ? "selected" : ""}>${m.codigo} · ${esc(m.nombre)}</option>`).join("")}</select>
        ${rol === "jefe" ? `<select id="fTecnico" aria-label="Técnico"><option value="">Todos los técnicos</option>${tecnicos().map(t => `<option value="${t.id}" ${String(t.id) === f.tecnico ? "selected" : ""}>${esc(t.nombre)}</option>`).join("")}</select>` : ""}
      </div>
      <p class="tenue">${lista.length} orden${lista.length === 1 ? "" : "es"}${lista.length > 150 ? " · se muestran las 150 primeras" : ""}</p>
      ${tablaOrdenes(lista.slice(0, 150))}
    </section>`;

  $("#fTexto").oninput = (e) => { f.texto = e.target.value; const pos = e.target.selectionStart; vistaOrdenes(); const i = $("#fTexto"); i.focus(); i.setSelectionRange(pos, pos); };
  $("#fEstado").onchange = (e) => { f.estado = e.target.value; vistaOrdenes(); };
  $("#fTipo").onchange = (e) => { f.tipo = e.target.value; vistaOrdenes(); };
  $("#fMaquina").onchange = (e) => { f.maquina = e.target.value; vistaOrdenes(); };
  if ($("#fTecnico")) $("#fTecnico").onchange = (e) => { f.tecnico = e.target.value; vistaOrdenes(); };
  if ($("#btnNuevaOT")) $("#btnNuevaOT").onclick = () => formNuevaOT("");
  if ($("#btnExportar")) $("#btnExportar").onclick = exportarExcel;
  conectarFilasOT();
}

function crearOT(datos) {
  db.contador += 1;
  const id = Math.max(db.contador, ...db.ordenes.map(o => o.id + 1));
  db.contador = id;
  const o = { id, codigo: "OT-" + String(id).padStart(4, "0"), repuestos: [], horasTrabajo: 0, horasParada: 0, causa: "", solucion: "",
    creada: ahoraISO(), historial: [], ...datos };
  db.ordenes.push(o);
  return o;
}
function anotar(o, texto) { (o.historial = o.historial || []).push({ fecha: ahoraISO(), texto: `${texto} (${yo().nombre})` }); }

function formNuevaOT(codMaquina) {
  const hoy = new Date().toISOString().slice(0, 10);
  abrirModal({
    titulo: "➕ Nueva orden de trabajo",
    cuerpo: `<form id="formOT" class="modal-cuerpo" style="padding:0">
      <div class="fila-campos">
        <div class="campo"><label for="oMaquina">Máquina</label><select id="oMaquina" required>${opcionesMaquinas(codMaquina)}</select></div>
        <div class="campo"><label for="oTipo">Tipo</label><select id="oTipo">${TIPOS_OT.map(t => `<option>${t}</option>`).join("")}</select></div>
        <div class="campo"><label for="oPrioridad">Prioridad</label><select id="oPrioridad">${PRIORIDADES.map(p => `<option ${p === "Media" ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="campo"><label for="oTecnico">Técnico</label><select id="oTecnico">${tecnicos().map(t => `<option value="${t.id}">${esc(t.nombre)} · ${esc(t.cargo)}</option>`).join("")}</select></div>
        <div class="campo"><label for="oFecha">Fecha programada</label><input type="date" id="oFecha" value="${hoy}" required></div>
      </div>
      <div class="campo"><label for="oTitulo">Trabajo a realizar</label><input id="oTitulo" maxlength="120" required placeholder="Ej.: Cambiar rodamientos del motor del agitador"></div>
      <div class="campo"><label for="oDesc">Detalle (opcional)</label><textarea id="oDesc" maxlength="1000"></textarea></div>
    </form>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario" type="submit" form="formOT">Crear orden</button>`
  });
  $("#formOT").onsubmit = (e) => {
    e.preventDefault();
    const fecha = new Date($("#oFecha").value + "T08:00:00");
    const o = crearOT({ tipo: $("#oTipo").value, maquina: $("#oMaquina").value, titulo: $("#oTitulo").value.trim(), descripcion: $("#oDesc").value.trim(),
      prioridad: $("#oPrioridad").value, estado: "Programada", solicitanteId: yo().id, tecnicoId: Number($("#oTecnico").value), programada: fecha.toISOString() });
    anotar(o, "Orden creada");
    anotar(o, `Asignada a ${nombre(o.tecnicoId)} para el ${fmtFecha(o.programada, false)}`);
    guardar(); render(); abrirOT(o.id);
    aviso(`${o.codigo} creada y asignada a ${nombre(o.tecnicoId)}`);
  };
}
function opcionesMaquinas(sel) {
  return LINEAS.map(l => `<optgroup label="${esc(l)}">${db.maquinas.filter(m => m.linea === l)
    .map(m => `<option value="${m.codigo}" ${m.codigo === sel ? "selected" : ""}>${m.codigo} · ${esc(m.nombre)}</option>`).join("")}</optgroup>`).join("");
}

// ---------- Detalle de una orden ----------
function abrirOT(id) {
  const o = db.ordenes.find(x => x.id === id);
  if (!o) return;
  const m = maquina(o.maquina);
  const c = costoOT(o);
  const actua = puedeActuar(o);
  const plan = o.planId ? db.plan.find(p => p.id === o.planId) : null;
  const disponibles = db.repuestos.filter(r => r.stock > 0);

  let acciones = "", pie = `<button class="btn" data-cerrar>Cerrar</button>`;
  if (o.estado === "Pendiente" || (o.estado === "Programada" && esJefe())) {
    if (esJefe()) {
      const fecha = (o.programada ? new Date(o.programada) : new Date()).toISOString().slice(0, 10);
      acciones += `<div class="tarjeta" style="box-shadow:none"><h3>${o.estado === "Pendiente" ? "📥 Asignar esta orden" : "Cambiar asignación"}</h3>
        <div class="fila-campos">
          <div class="campo"><label for="aTecnico">Técnico</label><select id="aTecnico">${tecnicos().map(t => `<option value="${t.id}" ${t.id === o.tecnicoId ? "selected" : ""}>${esc(t.nombre)} · ${esc(t.cargo)} (${abiertas().filter(x => x.tecnicoId === t.id).length} abiertas)</option>`).join("")}</select></div>
          <div class="campo"><label for="aPrioridad">Prioridad</label><select id="aPrioridad">${PRIORIDADES.map(p => `<option ${p === (o.prioridad || "Media") ? "selected" : ""}>${p}</option>`).join("")}</select></div>
          <div class="campo"><label for="aTipo">Tipo</label><select id="aTipo">${TIPOS_OT.map(t => `<option ${t === o.tipo ? "selected" : ""}>${t}</option>`).join("")}</select></div>
          <div class="campo"><label for="aFecha">Fecha programada</label><input type="date" id="aFecha" value="${fecha}"></div>
        </div></div>`;
      pie += `<button class="btn btn-primario" id="btnAsignar">${o.estado === "Pendiente" ? "Asignar" : "Guardar cambios"}</button>`;
    } else {
      acciones += `<p class="tenue">El jefe de mantenimiento asignará un técnico a esta orden.</p>`;
    }
  }
  if (o.estado === "Programada" && actua) pie += `<button class="btn btn-ok" id="btnIniciar">▶ Iniciar trabajo</button>`;
  if (o.estado === "En ejecución" && actua) {
    acciones += `<div class="tarjeta" style="box-shadow:none"><h3>🧰 Usar repuesto del taller</h3>
      ${plan && plan.repuestos.length ? `<p class="tenue">Previstos por el plan: ${plan.repuestos.map(r => `${fmtNum(r.cantidad, r.cantidad % 1 ? 1 : 0)} × ${esc(repuesto(r.codigo)?.nombre)}`).join(" · ")}
        <button class="enlace" id="btnPrevistos">Usar los previstos</button></p>` : ""}
      <div class="acciones">
        <select id="uRepuesto" aria-label="Repuesto" style="flex:1;min-width:200px">${db.repuestos.map(r => `<option value="${r.codigo}">${r.codigo} · ${esc(r.nombre)} (stock ${fmtNum(r.stock, r.stock % 1 ? 1 : 0)} ${esc(r.unidad)})</option>`).join("")}</select>
        <input type="number" id="uCantidad" value="1" min="0.1" step="0.1" style="width:80px" aria-label="Cantidad">
        <button class="btn btn-chico" id="btnUsarRep">Descontar</button>
        <button class="btn btn-chico btn-peligro" id="btnFalta">No hay: esperar repuesto</button>
      </div></div>`;
    pie += `<button class="btn btn-ok" id="btnTerminar">✔ Terminar trabajo</button>`;
  }
  if (o.estado === "Esperando repuesto" && actua) {
    const r = repuesto(o.esperaRepuesto);
    acciones += `<p>📦 Esperando <b>${esc(r?.nombre || o.esperaRepuesto)}</b> · stock actual: <b>${r ? fmtNum(r.stock) : 0} ${esc(r?.unidad || "")}</b>${r && r.stock > 0 ? " ✅ ya llegó" : ""}</p>`;
    pie += `<button class="btn btn-ok" id="btnReanudar">▶ Reanudar trabajo</button>`;
  }
  void disponibles;

  abrirModal({
    titulo: `${o.codigo} · ${esc(o.titulo)}`,
    subtitulo: `${chipOT(o.estado)} ${chipPri(o.prioridad)} <span class="tenue">${ICONO_TIPO[o.tipo]} ${o.tipo}</span>`,
    cuerpo: `
      <div class="datos">
        <div class="dato"><span>Máquina</span><b><button class="enlace" data-maquina="${o.maquina}">${o.maquina}</button> ${esc(nombreMaquina(o.maquina))}</b></div>
        <div class="dato"><span>Estado de la máquina</span><b>${m ? chipMaq(m.estado) : "—"}</b></div>
        <div class="dato"><span>Línea</span><b>${esc(m?.linea || "Servicios generales")}</b></div>
        <div class="dato"><span>Reportó / creó</span><b>${esc(nombre(o.solicitanteId))}</b></div>
        <div class="dato"><span>Técnico</span><b>${o.tecnicoId ? esc(nombre(o.tecnicoId)) : "Sin asignar"}</b></div>
        <div class="dato"><span>${o.estado === "Terminada" ? "Tiempo de parada" : "Parada desde"}</span><b>${o.estado === "Terminada" ? fmtHoras(o.horasParada) : o.paradaDesde ? haceTexto(o.paradaDesde) : "No está parada"}</b></div>
      </div>
      ${o.descripcion ? `<div><h3>Descripción</h3><p>${esc(o.descripcion)}</p></div>` : ""}
      ${o.estado === "Terminada" ? `<div class="datos">
        <div class="dato"><span>Causa</span><b>${esc(o.causa || "—")}</b></div>
        <div class="dato"><span>Horas de trabajo</span><b>${fmtHoras(o.horasTrabajo)}</b></div>
        <div class="dato"><span>Costo total</span><b>${soles(c.total)}</b></div>
      </div><div><h3>Solución aplicada</h3><p>${esc(o.solucion || "—")}</p></div>` : ""}
      ${acciones}
      <div><h3>Repuestos usados</h3>
        ${o.repuestos?.length ? `<div class="tabla-caja"><table><thead><tr><th>Repuesto</th><th class="numero">Cant.</th><th class="numero">Costo</th></tr></thead><tbody>
          ${o.repuestos.map(r => { const rp = repuesto(r.codigo); return `<tr><td>${esc(rp?.nombre || r.codigo)}<small>${r.codigo}</small></td><td class="numero">${fmtNum(r.cantidad, r.cantidad % 1 ? 1 : 0)} ${esc(rp?.unidad || "")}</td><td class="numero">${soles((rp?.costo || 0) * r.cantidad)}</td></tr>`; }).join("")}
          <tr><td><b>Mano de obra</b><small>${fmtHoras(o.horasTrabajo)} × S/ ${TARIFA_HORA}</small></td><td></td><td class="numero">${soles(c.mo)}</td></tr>
          <tr><td><b>Total</b></td><td></td><td class="numero"><b>${soles(c.total)}</b></td></tr>
        </tbody></table></div>` : `<p class="tenue">Todavía no se usaron repuestos.</p>`}
      </div>
      <div><h3>Seguimiento</h3><div class="linea-tiempo">
        ${(o.historial || []).slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).map(h => `<div><time>${fmtFecha(h.fecha)}</time><span>${esc(h.texto)}</span></div>`).join("")}
      </div></div>`,
    pie
  });

  $$("#capaModal [data-maquina]").forEach(b => b.onclick = () => fichaMaquina(b.dataset.maquina));
  if ($("#btnAsignar")) $("#btnAsignar").onclick = () => {
    const antes = o.estado;
    o.tecnicoId = Number($("#aTecnico").value);
    o.prioridad = $("#aPrioridad").value;
    o.tipo = $("#aTipo").value;
    o.programada = new Date($("#aFecha").value + "T08:00:00").toISOString();
    o.estado = "Programada";
    anotar(o, antes === "Pendiente" ? `Asignada a ${nombre(o.tecnicoId)}, prioridad ${o.prioridad}` : `Reasignada a ${nombre(o.tecnicoId)}, prioridad ${o.prioridad}`);
    guardar(); render(); abrirOT(o.id);
    aviso(`${o.codigo} asignada a ${nombre(o.tecnicoId)}`);
  };
  if ($("#btnIniciar")) $("#btnIniciar").onclick = () => {
    o.estado = "En ejecución";
    o.inicio = ahoraISO();
    if (!o.paradaDesde && o.tipo !== "Mejora") o.paradaDesde = o.inicio;
    if (m) m.estado = "En mantenimiento";
    anotar(o, "Trabajo iniciado");
    guardar(); render(); abrirOT(o.id);
    aviso(`${o.codigo} en ejecución · ${o.maquina} pasa a "En mantenimiento"`);
  };
  if ($("#btnUsarRep")) $("#btnUsarRep").onclick = () => usarRepuesto(o, $("#uRepuesto").value, Number($("#uCantidad").value));
  if ($("#btnPrevistos")) $("#btnPrevistos").onclick = () => {
    for (const r of plan.repuestos) if (!usarRepuesto(o, r.codigo, r.cantidad, true)) return;
    abrirOT(o.id);
  };
  if ($("#btnFalta")) $("#btnFalta").onclick = () => {
    const cod = $("#uRepuesto").value;
    o.estado = "Esperando repuesto";
    o.esperaRepuesto = cod;
    anotar(o, `En espera del repuesto ${cod} · ${repuesto(cod).nombre}`);
    guardar(); render(); abrirOT(o.id);
    aviso(`${o.codigo} queda esperando ${repuesto(cod).nombre}. El jefe lo verá en sus avisos.`);
  };
  if ($("#btnReanudar")) $("#btnReanudar").onclick = () => {
    o.estado = "En ejecución";
    anotar(o, "Llegó el repuesto, se reanuda el trabajo");
    delete o.esperaRepuesto;
    guardar(); render(); abrirOT(o.id);
  };
  if ($("#btnTerminar")) $("#btnTerminar").onclick = () => formTerminar(o);
}

function usarRepuesto(o, cod, cantidad, silencioso = false) {
  const r = repuesto(cod);
  if (!r || !(cantidad > 0)) { aviso("Indica una cantidad válida"); return false; }
  if (cantidad > r.stock) {
    aviso(`No alcanza: hay ${fmtNum(r.stock, r.stock % 1 ? 1 : 0)} ${r.unidad} de ${r.nombre}. Puedes marcar "esperar repuesto".`);
    return false;
  }
  r.stock = Math.round((r.stock - cantidad) * 100) / 100;
  const ya = o.repuestos.find(x => x.codigo === cod);
  if (ya) ya.cantidad = Math.round((ya.cantidad + cantidad) * 100) / 100; else o.repuestos.push({ codigo: cod, cantidad });
  anotar(o, `Usó ${fmtNum(cantidad, cantidad % 1 ? 1 : 0)} ${r.unidad} de ${r.nombre}`);
  guardar(); render();
  if (!silencioso) { abrirOT(o.id); aviso(`Descontado del taller · quedan ${fmtNum(r.stock, r.stock % 1 ? 1 : 0)} ${r.unidad}${r.stock < r.minimo ? " ⚠️ bajo el mínimo" : ""}`); }
  return true;
}

function formTerminar(o) {
  const horasSugeridas = o.inicio ? Math.max(0.5, Math.round((Date.now() - new Date(o.inicio)) / 3600000 * 2) / 2) : 1;
  abrirModal({
    titulo: `✔ Terminar ${o.codigo}`,
    subtitulo: `<span class="tenue">${esc(o.titulo)}</span>`,
    cuerpo: `<form id="formFin" class="modal-cuerpo" style="padding:0">
      <div class="fila-campos">
        ${o.tipo === "Correctivo" ? `<div class="campo"><label for="tCausa">Causa de la falla</label><select id="tCausa" required><option value="">Elige…</option>${CAUSAS.map(c => `<option ${c === o.causa ? "selected" : ""}>${c}</option>`).join("")}</select></div>` : ""}
        <div class="campo"><label for="tHoras">Horas de trabajo (taller)</label><input type="number" id="tHoras" min="0.1" step="0.1" value="${horasSugeridas}" required></div>
      </div>
      <div class="campo"><label for="tSolucion">¿Qué se hizo?</label><textarea id="tSolucion" required placeholder="Ej.: Se cambiaron los o-rings de las boquillas 2, 5 y 7 y se probó la línea 15 minutos.">${esc(o.solucion || "")}</textarea></div>
      <label class="casilla"><input type="checkbox" id="tOperativa" checked> La máquina queda <b>operativa</b> y lista para producir</label>
    </form>`,
    pie: `<button class="btn" id="btnVolver" type="button">Volver</button><button class="btn btn-ok" type="submit" form="formFin">Cerrar orden</button>`
  });
  $("#btnVolver").onclick = () => abrirOT(o.id);
  $("#formFin").onsubmit = (e) => {
    e.preventDefault();
    const fin = ahoraISO();
    o.estado = "Terminada";
    o.fin = fin;
    o.horasTrabajo = Number($("#tHoras").value);
    o.solucion = $("#tSolucion").value.trim();
    if ($("#tCausa")) o.causa = $("#tCausa").value;
    o.horasParada = o.paradaDesde ? Math.round((Date.now() - new Date(o.paradaDesde)) / 360000) / 10 : 0;
    const m = maquina(o.maquina);
    const otrasAbiertas = abiertas().filter(x => x.maquina === o.maquina && x.id !== o.id && x.estado === "En ejecución");
    if (m) m.estado = $("#tOperativa").checked ? (otrasAbiertas.length ? "En mantenimiento" : "Operativa") : "Parada";
    if (o.planId) { const p = db.plan.find(x => x.id === o.planId); if (p) p.ultima = fin; }
    anotar(o, `Trabajo terminado${m ? ` · máquina ${m.estado.toLowerCase()}` : ""}`);
    guardar(); render(); abrirOT(o.id);
    aviso(`${o.codigo} cerrada · costo ${soles(costoOT(o).total)}`);
  };
}

// =========================================================
// PLAN PREVENTIVO
// =========================================================
let filtroPrev = "todas";
function vistaPreventivo() {
  const filas = db.plan.map(p => ({ p, e: estadoPlan(p), prox: proximaFecha(p), ot: otAbiertaDePlan(p) }))
    .filter(x => filtroPrev === "todas" || (filtroPrev === "vencidas" && x.e.orden === 0) || (filtroPrev === "semana" && x.e.orden <= 2))
    .sort((a, b) => a.prox - b.prox);
  const vencidas = db.plan.filter(p => estadoPlan(p).orden === 0);
  const sinOT = db.plan.filter(p => estadoPlan(p).orden <= 2 && !otAbiertaDePlan(p));
  const cumplimiento = 1 - vencidas.length / db.plan.length;
  const horasMes = db.plan.reduce((s, p) => s + p.horas * 30 / p.frecuenciaDias, 0);

  // Agenda de los próximos 14 días
  const agenda = [];
  for (let d = 0; d < 14; d++) {
    const dia = new Date(); dia.setHours(0, 0, 0, 0); dia.setDate(dia.getDate() + d);
    const tareas = db.plan.filter(p => {
      const prox = proximaFecha(p); prox.setHours(0, 0, 0, 0);
      return d === 0 ? prox <= dia : +prox === +dia;
    });
    const ots = abiertas().filter(o => o.programada && !o.planId && new Date(o.programada).toDateString() === dia.toDateString());
    if (tareas.length || ots.length) agenda.push({ dia, tareas, ots });
  }

  vista.innerHTML = `
    <div class="kpis">
      ${kpi(fmtNum(cumplimiento * 100) + "%", "Cumplimiento del plan", "Tareas al día sobre el total", cumplimiento >= .9 ? "k-ok" : "k-alerta")}
      ${kpi(vencidas.length, "Tareas vencidas", "", vencidas.length ? "k-mal" : "k-ok")}
      ${kpi(db.plan.length, "Tareas en el plan", `${new Set(db.plan.map(p => p.maquina)).size} equipos cubiertos`, "k-info")}
      ${kpi(fmtNum(horasMes, 0) + " h", "Carga preventiva al mes", "Horas de taller estimadas", "k-info")}
    </div>
    <div class="rejilla-2 r-21">
      <section class="tarjeta">
        <div class="tarjeta-cab"><h2>🗓️ Plan de mantenimiento preventivo</h2>
          <div class="acciones">
            <select id="fPrev" aria-label="Filtrar"><option value="todas">Todas las tareas</option><option value="semana" ${filtroPrev === "semana" ? "selected" : ""}>Vencidas y próximos 7 días</option><option value="vencidas" ${filtroPrev === "vencidas" ? "selected" : ""}>Solo vencidas</option></select>
            ${esJefe() ? `<button class="btn btn-primario" id="btnGenerarSemana" ${sinOT.length ? "" : "disabled"}>Generar ${sinOT.length} orden${sinOT.length === 1 ? "" : "es"} de la semana</button>` : ""}
          </div></div>
        <div class="tabla-caja"><table>
          <thead><tr><th>Máquina</th><th>Tarea</th><th>Cada</th><th>Responsable</th><th>Última</th><th>Próxima</th><th></th></tr></thead>
          <tbody>${filas.map(({ p, e, prox, ot }) => `<tr>
            <td><span class="codigo">${p.maquina}</span><small>${esc(nombreMaquina(p.maquina))}</small></td>
            <td>${esc(p.tarea)}<small>${fmtHoras(p.horas)}${p.repuestos.length ? " · " + p.repuestos.map(r => esc(repuesto(r.codigo)?.nombre)).join(", ") : ""}</small></td>
            <td>${p.frecuenciaDias} d</td>
            <td>${esc(nombre(p.tecnicoId))}</td>
            <td>${fmtFecha(p.ultima, false)}</td>
            <td>${fmtFecha(prox.toISOString(), false)}<br><span class="chip ${e.cls}">${e.txt}</span></td>
            <td>${ot ? `<button class="btn btn-chico" data-fila-ot="${ot.id}">${ot.codigo}</button>` : esJefe() ? `<button class="btn btn-chico" data-generar="${p.id}">Generar OT</button>` : ""}</td>
          </tr>`).join("")}</tbody></table></div>
      </section>
      <section class="tarjeta">
        <h2>📅 Próximos 14 días</h2>
        ${agenda.length ? agenda.map(({ dia, tareas, ots }) => `<div>
          <h3 style="font-size:13px;margin-bottom:4px">${dia.toDateString() === new Date().toDateString() ? "Hoy (y vencidas)" : dia.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "short" })}</h3>
          ${tareas.map(p => `<div class="tenue" style="font-size:13px">🗓️ <b class="codigo">${p.maquina}</b> ${esc(p.tarea)}</div>`).join("")}
          ${ots.map(o => `<div class="tenue" style="font-size:13px">${ICONO_TIPO[o.tipo]} <b class="codigo">${o.maquina}</b> ${esc(o.titulo)}</div>`).join("")}
        </div>`).join("") : `<p class="vacio">Nada programado</p>`}
      </section>
    </div>`;

  $("#fPrev").onchange = (e) => { filtroPrev = e.target.value; vistaPreventivo(); };
  conectarFilasOT();
  $$("[data-generar]").forEach(b => b.onclick = () => {
    const o = generarDesdePlan(db.plan.find(p => p.id === Number(b.dataset.generar)));
    guardar(); render(); aviso(`${o.codigo} generada para ${nombre(o.tecnicoId)}`);
  });
  if ($("#btnGenerarSemana")) $("#btnGenerarSemana").onclick = () => {
    const nuevas = sinOT.map(generarDesdePlan);
    guardar(); render(); aviso(`${nuevas.length} órdenes preventivas generadas y asignadas`);
  };
}
function generarDesdePlan(p) {
  const prox = proximaFecha(p);
  const fecha = prox < new Date() ? new Date() : prox;
  fecha.setHours(8, 0, 0, 0);
  const o = crearOT({ tipo: "Preventivo", maquina: p.maquina, titulo: p.tarea, descripcion: `Tarea del plan preventivo (cada ${p.frecuenciaDias} días).`,
    prioridad: estadoPlan(p).orden === 0 ? "Alta" : "Media", estado: "Programada", solicitanteId: yo().id, tecnicoId: p.tecnicoId,
    programada: fecha.toISOString(), planId: p.id });
  anotar(o, `Generada desde el plan preventivo y asignada a ${nombre(p.tecnicoId)}`);
  return o;
}

// =========================================================
// TÉCNICOS
// =========================================================
function vistaTecnicos() {
  const { desde, hasta } = rangoPeriodo();
  const datos = tecnicos().map(t => {
    const suyas = db.ordenes.filter(o => o.tecnicoId === t.id);
    const enPeriodo = suyas.filter(o => o.fin && new Date(o.fin) >= desde && new Date(o.fin) <= hasta);
    return { t, abiertas: suyas.filter(o => o.estado !== "Terminada").sort(ordenarAbiertas), terminadas: enPeriodo.length,
      horas: enPeriodo.reduce((s, o) => s + (o.horasTrabajo || 0), 0),
      correctivas: enPeriodo.filter(o => o.tipo === "Correctivo").length,
      herramientas: db.herramientas.filter(h => h.estado === "Prestada" && h.prestadaA === t.id) };
  });
  const dias = (hasta - desde) / DIA;
  const capacidad = dias * (DIAS_PRODUCCION_MES / 30) * 8;

  vista.innerHTML = `
    <div class="tarjeta-cab"><div><h2>👷 Equipo técnico del taller</h2><p class="tenue">Carga de trabajo y horas registradas en órdenes. Capacidad de referencia: ${fmtNum(capacidad)} h por técnico (turno de 8 h).</p></div>
      <div class="filtros">${selectorPeriodo()}</div></div>
    <div class="rejilla-2">
      ${datos.map(d => `<section class="tarjeta">
        <div class="tarjeta-cab"><div><h3>${esc(d.t.nombre)}</h3><span class="tenue">${esc(d.t.cargo)}</span></div>
          <span class="chip ${d.abiertas.some(o => o.estado === "En ejecución") ? "c-info" : "c-ok"}">${d.abiertas.some(o => o.estado === "En ejecución") ? "Trabajando ahora" : "Disponible"}</span></div>
        <div class="datos">
          <div class="dato"><span>Abiertas</span><b>${d.abiertas.length}</b></div>
          <div class="dato"><span>Terminadas</span><b>${d.terminadas}</b></div>
          <div class="dato"><span>Horas</span><b>${fmtNum(d.horas, 1)} h</b></div>
        </div>
        <div><div class="barra-pista" title="Ocupación"><div class="barra-relleno" style="width:${Math.min(100, d.horas / capacidad * 100)}%"></div></div>
          <small class="tenue">Ocupación registrada: ${fmtNum(d.horas / capacidad * 100)}% · ${d.correctivas} correctivos</small></div>
        ${d.abiertas.length ? `<div class="linea-tiempo">${d.abiertas.map(o => `<div><button class="enlace codigo" data-fila-ot="${o.id}">${o.codigo}</button><span>${chipOT(o.estado)} ${o.maquina} · ${esc(o.titulo)}</span></div>`).join("")}</div>` : `<p class="tenue">Sin órdenes abiertas.</p>`}
        ${d.herramientas.length ? `<small class="tenue">🔧 Tiene: ${d.herramientas.map(h => esc(h.nombre)).join(", ")}</small>` : ""}
      </section>`).join("")}
    </div>`;
  conectarPeriodo();
  conectarFilasOT();
}

// =========================================================
// REPORTAR FALLA (operadores y cualquiera)
// =========================================================
function vistaReportar() {
  const recientes = db.ordenes.filter(o => o.solicitanteId === yo().id).sort((a, b) => new Date(b.creada) - new Date(a.creada)).slice(0, 5);
  vista.innerHTML = `
    <div class="rejilla-2 r-32">
      <section class="tarjeta">
        <div><h2>⚠️ Reportar una falla</h2><p class="tenue">El jefe de mantenimiento recibe el aviso al instante y asigna un técnico.</p></div>
        <form id="formFalla" class="modal-cuerpo" style="padding:0">
          <div class="campo"><label for="rMaquina">¿Qué máquina?</label><select id="rMaquina" required><option value="">Elige la máquina…</option>${opcionesMaquinas(maquinaSugerida)}</select></div>
          <div class="campo"><label>¿La máquina está parada?</label>
            <div class="acciones">
              <label class="casilla"><input type="radio" name="rParada" value="si"> Sí, está detenida</label>
              <label class="casilla"><input type="radio" name="rParada" value="no" checked> No, sigue funcionando</label>
            </div></div>
          <div class="campo"><label for="rTitulo">¿Qué pasa? (en pocas palabras)</label><input id="rTitulo" required maxlength="120" placeholder="Ej.: La faja patina y se detiene"></div>
          <div class="campo"><label for="rDesc">Más detalle (opcional)</label><textarea id="rDesc" maxlength="1000" placeholder="Desde cuándo pasa, en qué turno, ruidos, olores, fugas…"></textarea></div>
          <div class="acciones"><button class="btn btn-peligro" type="submit">Enviar reporte</button></div>
        </form>
      </section>
      <section class="tarjeta">
        <h2>Mis últimos reportes</h2>
        ${recientes.length ? `<div class="linea-tiempo">${recientes.map(o => `<div><button class="enlace codigo" data-fila-ot="${o.id}">${o.codigo}</button><span>${chipOT(o.estado)} ${o.maquina} · ${esc(o.titulo)}<br><small class="tenue">${haceTexto(o.creada)}</small></span></div>`).join("")}</div>`
          : `<p class="tenue">Aún no has reportado fallas.</p>`}
        <p class="tenue">💡 Si hay riesgo para las personas (fuga de químicos, chispas, humo), primero detén la máquina y avisa a tu supervisor.</p>
      </section>
    </div>`;
  maquinaSugerida = "";
  conectarFilasOT();
  $("#formFalla").onsubmit = (e) => {
    e.preventDefault();
    const cod = $("#rMaquina").value;
    const parada = $("input[name=rParada]:checked").value === "si";
    const m = maquina(cod);
    const o = crearOT({ tipo: "Correctivo", maquina: cod, titulo: $("#rTitulo").value.trim(), descripcion: $("#rDesc").value.trim(),
      prioridad: parada && m.criticidad === "A" ? "Alta" : null, estado: "Pendiente", solicitanteId: yo().id, tecnicoId: null,
      paradaDesde: parada ? ahoraISO() : null });
    anotar(o, parada ? "Falla reportada · máquina detenida" : "Falla reportada");
    if (parada) m.estado = "Parada";
    guardar();
    location.hash = yo().rol === "jefe" ? "panel" : "ordenes";
    render();
    abrirOT(o.id);
    aviso(`Reporte ${o.codigo} enviado al jefe de mantenimiento`);
  };
}

// =========================================================
// EXPORTAR A EXCEL
// =========================================================
function exportarExcel() {
  if (typeof XLSX === "undefined") { aviso("No se pudo cargar el generador de Excel"); return; }
  const { desde, hasta } = rangoPeriodo();
  const k = indicadores(desde, hasta);
  const libro = XLSX.utils.book_new();
  const hoja = (nombreHoja, filas) => XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), nombreHoja);
  hoja("Indicadores", [
    { Indicador: "Periodo", Valor: textoPeriodo() },
    { Indicador: "Disponibilidad de planta (%)", Valor: +(k.disponibilidad * 100).toFixed(2) },
    { Indicador: "MTTR (h)", Valor: +k.mttr.toFixed(2) },
    { Indicador: "MTBF (h)", Valor: k.mtbf ? +k.mtbf.toFixed(0) : "" },
    { Indicador: "Fallas reportadas", Valor: k.fallas },
    { Indicador: "Horas de parada no programada", Valor: +k.horasParada.toFixed(1) },
    { Indicador: "Costo repuestos (S/)", Valor: Math.round(k.costoRep) },
    { Indicador: "Costo mano de obra (S/)", Valor: Math.round(k.costoMO) },
    { Indicador: "Costo total (S/)", Valor: Math.round(k.costoTotal) }
  ]);
  hoja("Ordenes", db.ordenes.slice().sort((a, b) => b.id - a.id).map(o => ({
    Orden: o.codigo, Tipo: o.tipo, Maquina: o.maquina, Equipo: nombreMaquina(o.maquina), Trabajo: o.titulo, Prioridad: o.prioridad || "",
    Estado: o.estado, Reporto: nombre(o.solicitanteId), Tecnico: o.tecnicoId ? nombre(o.tecnicoId) : "",
    Creada: fmtFecha(o.creada), Inicio: o.inicio ? fmtFecha(o.inicio) : "", Fin: o.fin ? fmtFecha(o.fin) : "",
    "Horas trabajo": o.horasTrabajo || 0, "Horas parada": o.horasParada || 0, Causa: o.causa || "", Solucion: o.solucion || "",
    "Costo repuestos": Math.round(costoOT(o).rep), "Costo total": Math.round(costoOT(o).total) })));
  hoja("Maquinas", db.maquinas.map(m => ({ Codigo: m.codigo, Maquina: m.nombre, Linea: m.linea, Marca: m.marca, Modelo: m.modelo, Anio: m.anio,
    Criticidad: m.criticidad, Estado: m.estado, Horometro: m.horometro })));
  hoja("Plan preventivo", db.plan.map(p => ({ Maquina: p.maquina, Tarea: p.tarea, "Cada (dias)": p.frecuenciaDias, Responsable: nombre(p.tecnicoId),
    Horas: p.horas, Ultima: fmtFecha(p.ultima, false), Proxima: fmtFecha(proximaFecha(p).toISOString(), false), Estado: estadoPlan(p).txt })));
  hoja("Repuestos", db.repuestos.map(r => ({ Codigo: r.codigo, Repuesto: r.nombre, Unidad: r.unidad, Stock: r.stock, Minimo: r.minimo,
    "Costo unit.": r.costo, Valor: Math.round(r.stock * r.costo), Ubicacion: r.ubicacion, Alerta: r.stock < r.minimo ? "Reponer" : "" })));
  XLSX.writeFile(libro, `mantenimiento-${new Date().toISOString().slice(0, 10)}.xlsx`);
  aviso("Excel descargado");
}

// =========================================================
// MODAL
// =========================================================
function abrirModal({ titulo, subtitulo = "", cuerpo, pie }) {
  $("#capaModal").innerHTML = `<div class="modal-fondo"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="tituloModal">
    <div class="modal-cab"><div><h2 id="tituloModal">${titulo}</h2>${subtitulo ? `<div class="acciones" style="margin-top:6px">${subtitulo}</div>` : ""}</div>
      <button class="cerrar" data-cerrar aria-label="Cerrar">✕</button></div>
    <div class="modal-cuerpo">${cuerpo}</div>
    ${pie ? `<div class="modal-pie">${pie}</div>` : ""}
  </div></div>`;
  document.body.style.overflow = "hidden";
  $$("#capaModal [data-cerrar]").forEach(b => b.onclick = cerrarModal);
  $("#capaModal .modal-fondo").onclick = (e) => { if (e.target.classList.contains("modal-fondo")) cerrarModal(); };
  const primero = $("#capaModal input, #capaModal select, #capaModal textarea");
  if (primero && window.innerWidth > 700) primero.focus();
}
function cerrarModal() { $("#capaModal").innerHTML = ""; document.body.style.overflow = ""; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#capaModal").innerHTML) cerrarModal(); });

// ---------- Inicio ----------
prepararCabecera();
render();
// Refresca contadores y tiempos de parada cada minuto si no hay un formulario abierto
setInterval(() => { if (!$("#capaModal").innerHTML && !document.activeElement?.matches("input,textarea,select")) render(); }, 60000);
