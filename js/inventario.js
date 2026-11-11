// =========================================================
// GESTIÓN DE MANTENIMIENTO · Inventario y Taller
// Inventario: stock por familia, kardex, solicitudes de compra
// y conteo físico. Taller: herramientas y trabajos en curso.
// (Usa las utilidades de app.js; se carga antes que app.js.)
// =========================================================

let pestanaInv = "stock";
let filtroInv = { texto: "", categoria: "", estado: "" };
let kardexCodigo = "";
let conteoEnCurso = null;

const CLS_SC = { "Solicitada": "c-alerta", "Aprobada": "c-info", "Recibida": "c-ok", "Anulada": "c-gris" };
const cant = (n) => fmtNum(n, n % 1 ? 1 : 0);

// ---------- Movimientos del almacén ----------
// Ingresos, salidas sin orden y ajustes están en db.movimientos;
// las salidas por orden de trabajo se leen de cada orden.
function movimientosInventario() {
  const deOrdenes = [];
  db.ordenes.forEach(o => (o.repuestos || []).forEach(r => deOrdenes.push({
    fecha: o.fin || o.inicio || o.creada, tipo: "Salida", codigo: r.codigo, cantidad: r.cantidad, nota: `${o.codigo} · ${o.maquina}`, ot: o.id })));
  return [...db.movimientos, ...deOrdenes].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
const variacion = (m) => m.tipo === "Ingreso" ? m.cantidad : m.tipo === "Salida" ? -m.cantidad : m.cantidad;

function consumoDias(codigo, dias) {
  const desde = Date.now() - dias * DIA;
  return movimientosInventario().filter(m => m.codigo === codigo && m.tipo === "Salida" && new Date(m.fecha) >= desde)
    .reduce((s, m) => s + m.cantidad, 0);
}
function cobertura(r) {
  const diario = consumoDias(r.codigo, 90) / 90;
  if (!diario) return null;
  return r.stock / diario;
}
function enCamino(codigo) {
  return db.compras.filter(c => c.estado === "Solicitada" || c.estado === "Aprobada")
    .reduce((s, c) => s + c.items.filter(i => i.codigo === codigo).reduce((t, i) => t + i.cantidad, 0), 0);
}
function avisarOTsEsperando(codigo, cantidad) {
  const r = repuesto(codigo);
  const esperando = db.ordenes.filter(o => o.estado === "Esperando repuesto" && o.esperaRepuesto === codigo);
  esperando.forEach(o => anotar(o, `Ingresó ${cant(cantidad)} ${r.unidad} de ${r.nombre} al almacén`));
  return esperando;
}

// =========================================================
// INVENTARIO
// =========================================================
function vistaInventario() {
  const jefe = esJefe();
  if (!jefe && (pestanaInv === "compras" || pestanaInv === "conteo")) pestanaInv = "stock";
  const valor = db.repuestos.reduce((s, r) => s + r.stock * r.costo, 0);
  const bajo = db.repuestos.filter(r => r.stock < r.minimo);
  const consumo30 = movimientosInventario().filter(m => m.tipo === "Salida" && new Date(m.fecha) >= Date.now() - 30 * DIA)
    .reduce((s, m) => s + (repuesto(m.codigo)?.costo || 0) * m.cantidad, 0);
  const ultimo = db.conteos.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
  const abiertasSC = db.compras.filter(c => c.estado === "Solicitada" || c.estado === "Aprobada");

  const sub = [["stock", "📦 Stock"], ["kardex", "📒 Kardex"]];
  if (jefe) sub.push(["compras", `🧾 Compras${abiertasSC.length ? ` <span class="burbuja">${abiertasSC.length}</span>` : ""}`], ["conteo", "✅ Conteo físico"]);

  vista.innerHTML = `
    <div class="kpis">
      ${kpi(soles(valor), "Valor del inventario", `${db.repuestos.length} artículos en ${CATEGORIAS.length} familias`, "k-info")}
      ${kpi(bajo.length, "Bajo stock mínimo", `${bajo.filter(r => r.stock === 0).length} sin stock · ${abiertasSC.length} compra${abiertasSC.length === 1 ? "" : "s"} en curso`, bajo.length ? "k-alerta" : "k-ok")}
      ${kpi(soles(consumo30), "Consumo últimos 30 días", "Órdenes de trabajo + entregas", "k-info")}
      ${kpi(ultimo ? fmtNum(ultimo.exactitud * 100, 1) + "%" : "—", "Exactitud del último conteo", ultimo ? `${fmtFecha(ultimo.fecha, false)} · ${haceTexto(ultimo.fecha)}` : "Aún no hay conteos", ultimo && ultimo.exactitud >= .95 ? "k-ok" : "k-alerta")}
    </div>
    <section class="tarjeta">
      <div class="tarjeta-cab">
        <div><h2>📦 Inventario de mantenimiento</h2><p class="tenue">Repuestos, lubricantes, consumibles y EPP del almacén de mantenimiento.</p></div>
        <div class="segmentos" role="tablist">${sub.map(([id, t]) => `<button role="tab" aria-selected="${pestanaInv === id}" class="${pestanaInv === id ? "activo" : ""}" data-inv="${id}">${t}</button>`).join("")}</div>
      </div>
      <div id="contenidoInv"></div>
    </section>`;

  $$("[data-inv]").forEach(b => b.onclick = () => { pestanaInv = b.dataset.inv; vistaInventario(); });
  ({ stock: invStock, kardex: invKardex, compras: invCompras, conteo: invConteo })[pestanaInv]($("#contenidoInv"));
}

// ---------- Stock ----------
function invStock(caja) {
  const jefe = esJefe();
  const f = filtroInv;
  const lista = db.repuestos.filter(r => (!f.categoria || r.categoria === f.categoria) &&
    (!f.estado || (f.estado === "bajo" ? r.stock < r.minimo : f.estado === "cero" ? r.stock === 0 : r.stock >= r.minimo)) &&
    (!f.texto || (r.codigo + " " + r.nombre + " " + r.ubicacion).toLowerCase().includes(f.texto.toLowerCase())));
  const porFamilia = CATEGORIAS.map(c => [c, db.repuestos.filter(r => r.categoria === c).reduce((s, r) => s + r.stock * r.costo, 0)]).sort((a, b) => b[1] - a[1]);
  const masUsados = db.repuestos.map(r => [r.nombre, consumoDias(r.codigo, 90) * r.costo]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 7);

  caja.innerHTML = `
    <div class="barra-herramientas">
      <div class="filtros">
        <input type="search" id="iTexto" placeholder="🔍 Buscar código, artículo o ubicación" value="${esc(f.texto)}" aria-label="Buscar artículo">
        <select id="iCategoria" aria-label="Familia"><option value="">Todas las familias</option>${CATEGORIAS.map(c => `<option ${c === f.categoria ? "selected" : ""}>${c}</option>`).join("")}</select>
        <select id="iEstado" aria-label="Estado del stock">
          <option value="">Todo el stock</option>
          <option value="bajo" ${f.estado === "bajo" ? "selected" : ""}>Bajo el mínimo</option>
          <option value="cero" ${f.estado === "cero" ? "selected" : ""}>Sin stock</option>
          <option value="ok" ${f.estado === "ok" ? "selected" : ""}>Stock suficiente</option>
        </select>
      </div>
      <div class="acciones">
        <button class="btn" id="btnExcelInv">📥 Excel</button>
        ${jefe ? `<button class="btn btn-primario" id="btnNuevoArt">➕ Nuevo artículo</button>` : ""}
      </div>
    </div>
    <p class="tenue">${lista.length} artículo${lista.length === 1 ? "" : "s"}</p>
    <div class="tabla-caja"><table>
      <thead><tr><th>Código</th><th>Artículo</th><th>Ubicación</th><th>Stock</th><th class="numero">Mín.</th><th class="numero">Costo unit.</th><th class="numero">Valor</th><th class="numero" title="Días que alcanza el stock al ritmo de consumo de los últimos 90 días">Alcanza</th><th></th></tr></thead>
      <tbody>${lista.map(r => {
        const pct = Math.min(100, r.stock / Math.max(1, r.minimo * 2) * 100);
        const color = r.stock === 0 ? "var(--mal)" : r.stock < r.minimo ? "var(--alerta)" : "var(--ok)";
        const dias = cobertura(r);
        const camino = enCamino(r.codigo);
        return `<tr>
          <td class="codigo">${r.codigo}</td>
          <td>${esc(r.nombre)}<small>${esc(r.categoria)}</small></td>
          <td>${esc(r.ubicacion)}</td>
          <td style="white-space:nowrap"><span class="stock-pista"><span style="width:${pct}%;background:${color}"></span></span><b>${cant(r.stock)}</b> ${esc(r.unidad)}
            ${r.stock === 0 ? '<span class="chip c-mal">Sin stock</span>' : r.stock < r.minimo ? '<span class="chip c-alerta">Reponer</span>' : ""}
            ${camino ? `<small>🚚 ${cant(camino)} en camino</small>` : ""}</td>
          <td class="numero">${cant(r.minimo)}</td>
          <td class="numero">${soles(r.costo)}</td>
          <td class="numero">${soles(r.stock * r.costo)}</td>
          <td class="numero">${dias === null ? '<span class="tenue">Sin consumo</span>' : `<span class="${dias < 15 ? "texto-mal" : dias < 45 ? "texto-alerta" : ""}">${fmtNum(dias)} días</span>`}</td>
          <td><div class="acciones acciones-fila">
            <button class="btn btn-chico" data-kardex="${r.codigo}" title="Ver kardex">📒</button>
            ${jefe ? `<button class="btn btn-chico" data-ingreso="${r.codigo}" title="Registrar ingreso">＋</button>` : ""}
            <button class="btn btn-chico" data-salida="${r.codigo}" title="Registrar salida sin orden (EPP, consumibles)">−</button>
          </div></td></tr>`;
      }).join("") || `<tr><td colspan="9" class="vacio">No hay artículos con ese filtro</td></tr>`}</tbody>
    </table></div>
    <div class="rejilla-2">
      <div class="tarjeta tarjeta-plana"><h3>Valor del stock por familia</h3>${barras(porFamilia, { formato: soles })}</div>
      <div class="tarjeta tarjeta-plana"><h3>Lo que más se consume</h3><p class="tenue">Costo de lo usado en los últimos 90 días</p>${barras(masUsados, { formato: soles, clase: () => "r-alerta" })}</div>
    </div>`;

  $("#iTexto").oninput = (e) => { f.texto = e.target.value; const pos = e.target.selectionStart; invStock(caja); const i = $("#iTexto"); i.focus(); i.setSelectionRange(pos, pos); };
  $("#iCategoria").onchange = (e) => { f.categoria = e.target.value; invStock(caja); };
  $("#iEstado").onchange = (e) => { f.estado = e.target.value; invStock(caja); };
  $$("[data-kardex]").forEach(b => b.onclick = () => { kardexCodigo = b.dataset.kardex; pestanaInv = "kardex"; vistaInventario(); });
  $$("[data-ingreso]").forEach(b => b.onclick = () => formIngreso(b.dataset.ingreso));
  $$("[data-salida]").forEach(b => b.onclick = () => formSalida(b.dataset.salida));
  $("#btnExcelInv").onclick = exportarInventario;
  if ($("#btnNuevoArt")) $("#btnNuevoArt").onclick = formNuevoRepuesto;
}

// ---------- Kardex ----------
function invKardex(caja) {
  if (!repuesto(kardexCodigo)) kardexCodigo = db.repuestos[0].codigo;
  const r = repuesto(kardexCodigo);
  const movs = movimientosInventario().filter(m => m.codigo === r.codigo).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const inicial = Math.round((r.stock - movs.reduce((s, m) => s + variacion(m), 0)) * 100) / 100;
  let saldo = inicial;
  const filas = movs.map(m => { saldo = Math.round((saldo + variacion(m)) * 100) / 100; return { m, saldo }; }).reverse();
  const entradas = movs.filter(m => variacion(m) > 0).reduce((s, m) => s + variacion(m), 0);
  const salidas = movs.filter(m => variacion(m) < 0).reduce((s, m) => s - variacion(m), 0);
  const dias = cobertura(r);

  caja.innerHTML = `
    <div class="barra-herramientas">
      <div class="filtros"><select id="kArticulo" aria-label="Artículo">${CATEGORIAS.map(c => `<optgroup label="${c}">${db.repuestos.filter(x => x.categoria === c)
        .map(x => `<option value="${x.codigo}" ${x.codigo === r.codigo ? "selected" : ""}>${x.codigo} · ${esc(x.nombre)}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <div class="acciones">
        ${esJefe() ? `<button class="btn" id="kIngreso">＋ Ingreso</button>` : ""}
        <button class="btn" id="kSalida">− Salida</button>
      </div>
    </div>
    <div class="ficha-articulo">
      <div><span class="codigo">${r.codigo}</span><h3>${esc(r.nombre)}</h3><small class="tenue">${esc(r.categoria)} · ${esc(r.ubicacion)}</small></div>
      <div class="datos">
        <div class="dato"><span>Stock actual</span><b>${cant(r.stock)} ${esc(r.unidad)}</b></div>
        <div class="dato"><span>Mínimo</span><b>${cant(r.minimo)} ${esc(r.unidad)}</b></div>
        <div class="dato"><span>Costo unitario</span><b>${soles(r.costo)}</b></div>
        <div class="dato"><span>Entradas</span><b class="texto-ok">+${cant(entradas)}</b></div>
        <div class="dato"><span>Salidas</span><b class="texto-mal">−${cant(salidas)}</b></div>
        <div class="dato"><span>Alcanza para</span><b>${dias === null ? "Sin consumo" : fmtNum(dias) + " días"}</b></div>
      </div>
    </div>
    <div class="tabla-caja"><table>
      <thead><tr><th>Fecha</th><th>Movimiento</th><th>Detalle</th><th class="numero">Entrada</th><th class="numero">Salida</th><th class="numero">Saldo</th></tr></thead>
      <tbody>
        ${filas.map(({ m, saldo }) => { const v = variacion(m); return `<tr>
          <td>${fmtFecha(m.fecha)}</td>
          <td><span class="chip ${m.tipo === "Ingreso" ? "c-ok" : m.tipo === "Ajuste" ? "c-alerta" : "c-info"}">${m.tipo}</span></td>
          <td>${m.ot ? `<button class="enlace" data-fila-ot="${m.ot}">${esc(m.nota)}</button>` : esc(m.nota || "")}</td>
          <td class="numero texto-ok">${v > 0 ? "+" + cant(v) : ""}</td>
          <td class="numero texto-mal">${v < 0 ? "−" + cant(-v) : ""}</td>
          <td class="numero"><b>${cant(saldo)}</b></td></tr>`; }).join("")}
        <tr><td colspan="5" class="tenue">Saldo al inicio del registro</td><td class="numero"><b>${cant(inicial)}</b></td></tr>
      </tbody></table></div>`;
  $("#kArticulo").onchange = (e) => { kardexCodigo = e.target.value; invKardex(caja); };
  if ($("#kIngreso")) $("#kIngreso").onclick = () => formIngreso(r.codigo);
  $("#kSalida").onclick = () => formSalida(r.codigo);
  conectarFilasOT();
}

// ---------- Compras ----------
function articulosPorReponer() {
  return db.repuestos.filter(r => r.stock < r.minimo && !enCamino(r.codigo))
    .map(r => ({ codigo: r.codigo, cantidad: Math.max(1, Math.ceil(r.minimo * 2 - r.stock)) }));
}
function totalSC(c) { return c.items.reduce((s, i) => s + (repuesto(i.codigo)?.costo || 0) * i.cantidad, 0); }

function invCompras(caja) {
  const porReponer = articulosPorReponer();
  const lista = db.compras.slice().sort((a, b) => b.id - a.id);
  caja.innerHTML = `
    <div class="barra-herramientas">
      <p class="tenue">Solicitudes de compra del área. Al registrar la recepción, el stock sube solo y se avisa a las órdenes que esperaban ese repuesto.</p>
      <button class="btn btn-primario" id="btnGenerarSC" ${porReponer.length ? "" : "disabled"}>🧾 Solicitar lo que está bajo el mínimo (${porReponer.length})</button>
    </div>
    ${lista.length ? `<div class="lista-sc">${lista.map(c => `
      <article class="sc">
        <div class="sc-cab">
          <div><span class="codigo">${c.codigo}</span> ${`<span class="chip ${CLS_SC[c.estado]}">${c.estado}</span>`}
            <small class="tenue">${fmtFecha(c.fecha)} · ${esc(nombre(c.solicitanteId))}${c.recibida ? ` · recibida ${fmtFecha(c.recibida)}` : ""}</small></div>
          <b>${soles(totalSC(c))}</b>
        </div>
        ${c.nota ? `<p class="tenue">${esc(c.nota)}</p>` : ""}
        <div class="tabla-caja"><table><thead><tr><th>Artículo</th><th class="numero">Cantidad</th><th class="numero">Stock hoy</th><th class="numero">Subtotal</th></tr></thead><tbody>
          ${c.items.map(i => { const r = repuesto(i.codigo); return `<tr><td>${esc(r?.nombre || i.codigo)}<small>${i.codigo} · ${esc(r?.categoria || "")}</small></td>
            <td class="numero">${cant(i.cantidad)} ${esc(r?.unidad || "")}</td><td class="numero">${r ? cant(r.stock) : "—"}</td><td class="numero">${soles((r?.costo || 0) * i.cantidad)}</td></tr>`; }).join("")}
        </tbody></table></div>
        ${c.estado === "Solicitada" || c.estado === "Aprobada" ? `<div class="acciones">
          ${c.estado === "Solicitada" ? `<button class="btn btn-primario btn-chico" data-sc-aprobar="${c.id}">✔ Aprobar</button>` : ""}
          ${c.estado === "Aprobada" ? `<button class="btn btn-ok btn-chico" data-sc-recibir="${c.id}">📦 Registrar recepción</button>` : ""}
          <button class="btn btn-chico" data-sc-anular="${c.id}">Anular</button>
        </div>` : ""}
      </article>`).join("")}</div>` : `<p class="vacio">Aún no hay solicitudes de compra</p>`}`;

  $("#btnGenerarSC").onclick = () => {
    const id = Math.max(0, ...db.compras.map(c => c.id)) + 1;
    const c = { id, codigo: "SC-" + String(id).padStart(4, "0"), fecha: ahoraISO(), estado: "Solicitada", solicitanteId: yo().id,
      nota: "Reposición de artículos bajo el stock mínimo", items: articulosPorReponer() };
    db.compras.push(c);
    guardar(); render(); aviso(`${c.codigo} creada con ${c.items.length} artículos · ${soles(totalSC(c))}`);
  };
  const sc = (id) => db.compras.find(c => c.id === Number(id));
  $$("[data-sc-aprobar]").forEach(b => b.onclick = () => { const c = sc(b.dataset.scAprobar); c.estado = "Aprobada"; guardar(); render(); aviso(`${c.codigo} aprobada`); });
  $$("[data-sc-anular]").forEach(b => b.onclick = () => {
    const c = sc(b.dataset.scAnular);
    if (!confirm(`¿Anular ${c.codigo}?`)) return;
    c.estado = "Anulada"; guardar(); render();
  });
  $$("[data-sc-recibir]").forEach(b => b.onclick = () => {
    const c = sc(b.dataset.scRecibir);
    c.estado = "Recibida"; c.recibida = ahoraISO();
    const desbloqueadas = [];
    c.items.forEach(i => {
      const r = repuesto(i.codigo);
      r.stock = Math.round((r.stock + i.cantidad) * 100) / 100;
      db.movimientos.push({ fecha: c.recibida, tipo: "Ingreso", codigo: i.codigo, cantidad: i.cantidad, nota: `${c.codigo} · recepción` });
      desbloqueadas.push(...avisarOTsEsperando(i.codigo, i.cantidad));
    });
    guardar(); render();
    aviso(desbloqueadas.length ? `Stock actualizado. ${desbloqueadas.map(o => o.codigo).join(", ")} ya puede reanudarse.` : `${c.codigo} recibida · stock actualizado`);
  });
}

// ---------- Conteo físico ----------
function invConteo(caja) {
  if (!conteoEnCurso) {
    const hist = db.conteos.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    caja.innerHTML = `
      <div class="barra-herramientas">
        <p class="tenue">Cuenta lo que hay físicamente en el almacén. Las diferencias se ajustan solas y quedan en el kardex.</p>
        <div class="acciones">
          <select id="cFamilia" aria-label="Qué contar"><option value="">Contar todo el almacén</option>${CATEGORIAS.map(c => `<option>${c}</option>`).join("")}</select>
          <button class="btn btn-primario" id="btnIniciarConteo">✅ Iniciar conteo</button>
        </div>
      </div>
      <h3>Conteos anteriores</h3>
      ${hist.length ? `<div class="tabla-caja"><table><thead><tr><th>Fecha</th><th>Alcance</th><th class="numero">Artículos</th><th class="numero">Con diferencia</th><th class="numero">Exactitud</th><th class="numero">Diferencia en S/</th><th>Responsable</th></tr></thead><tbody>
        ${hist.map(h => `<tr><td>${fmtFecha(h.fecha)}</td><td>${esc(h.alcance || "Todo el almacén")}</td><td class="numero">${h.articulos}</td><td class="numero">${h.diferencias}</td>
          <td class="numero"><span class="chip ${h.exactitud >= .95 ? "c-ok" : "c-alerta"}">${fmtNum(h.exactitud * 100, 1)}%</span></td>
          <td class="numero ${h.valorDiferencia < 0 ? "texto-mal" : ""}">${soles(h.valorDiferencia)}</td><td>${esc(nombre(h.por))}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="vacio">Aún no hay conteos</p>`}`;
    $("#btnIniciarConteo").onclick = () => { conteoEnCurso = { familia: $("#cFamilia").value, valores: {} }; invConteo(caja); };
    return;
  }
  const items = db.repuestos.filter(r => !conteoEnCurso.familia || r.categoria === conteoEnCurso.familia)
    .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion) || a.codigo.localeCompare(b.codigo));
  const v = conteoEnCurso.valores;
  caja.innerHTML = `
    <div class="barra-herramientas">
      <p><b>Conteo en curso:</b> ${esc(conteoEnCurso.familia || "todo el almacén")} · ${items.length} artículos, ordenados por ubicación.
        <span class="tenue">Si dejas una casilla vacía, se toma como igual al sistema.</span></p>
      <div class="acciones"><button class="btn" id="btnCancelarConteo">Cancelar</button><button class="btn btn-ok" id="btnCerrarConteo">Cerrar conteo y ajustar</button></div>
    </div>
    <div class="tabla-caja"><table>
      <thead><tr><th>Ubicación</th><th>Artículo</th><th class="numero">Sistema</th><th class="numero">Contado</th><th class="numero">Diferencia</th></tr></thead>
      <tbody>${items.map(r => `<tr>
        <td>${esc(r.ubicacion)}</td><td>${esc(r.nombre)}<small>${r.codigo}</small></td>
        <td class="numero">${cant(r.stock)} ${esc(r.unidad)}</td>
        <td class="numero"><input class="entrada-conteo" type="number" min="0" step="0.1" data-contado="${r.codigo}" value="${v[r.codigo] ?? ""}" placeholder="${cant(r.stock)}" aria-label="Contado de ${esc(r.nombre)}"></td>
        <td class="numero" id="dif-${r.codigo}"></td></tr>`).join("")}</tbody>
    </table></div>`;
  const pintarDif = (cod) => {
    const r = repuesto(cod), celda = $("#dif-" + cod);
    if (v[cod] === undefined || v[cod] === "") { celda.innerHTML = ""; return; }
    const d = Math.round((Number(v[cod]) - r.stock) * 100) / 100;
    celda.innerHTML = d === 0 ? '<span class="texto-ok">✓</span>' : `<span class="${d < 0 ? "texto-mal" : "texto-ok"}">${d > 0 ? "+" : "−"}${cant(Math.abs(d))}</span>`;
  };
  $$("[data-contado]").forEach(i => {
    pintarDif(i.dataset.contado);
    i.oninput = () => { v[i.dataset.contado] = i.value; pintarDif(i.dataset.contado); };
  });
  $("#btnCancelarConteo").onclick = () => { conteoEnCurso = null; invConteo(caja); };
  $("#btnCerrarConteo").onclick = () => {
    const fecha = ahoraISO();
    let diferencias = 0, valorDif = 0;
    items.forEach(r => {
      if (v[r.codigo] === undefined || v[r.codigo] === "") return;
      const d = Math.round((Number(v[r.codigo]) - r.stock) * 100) / 100;
      if (!d) return;
      diferencias++;
      valorDif += d * r.costo;
      r.stock = Number(v[r.codigo]);
      db.movimientos.push({ fecha, tipo: "Ajuste", codigo: r.codigo, cantidad: d, nota: `Conteo físico: ${d > 0 ? "sobrante" : "faltante"}` });
    });
    db.conteos.push({ fecha, alcance: conteoEnCurso.familia || "Todo el almacén", articulos: items.length, diferencias,
      exactitud: (items.length - diferencias) / items.length, valorDiferencia: Math.round(valorDif), por: yo().id });
    conteoEnCurso = null;
    guardar(); render();
    aviso(diferencias ? `Conteo cerrado · ${diferencias} ajuste${diferencias === 1 ? "" : "s"} (${soles(valorDif)})` : "Conteo cerrado · sin diferencias 👍");
  };
}

// ---------- Formularios de almacén ----------
function formIngreso(cod) {
  const r = repuesto(cod);
  abrirModal({
    titulo: "＋ Ingreso al almacén",
    subtitulo: `<span class="tenue">${r.codigo} · ${esc(r.nombre)} · stock actual ${cant(r.stock)} ${esc(r.unidad)}</span>`,
    cuerpo: `<form id="formIng" class="modal-cuerpo" style="padding:0"><div class="fila-campos">
      <div class="campo"><label for="iCant">Cantidad que llegó (${esc(r.unidad)})</label><input type="number" id="iCant" min="0.1" step="0.1" value="${Math.max(1, Math.ceil(r.minimo * 2 - r.stock))}" required></div>
      <div class="campo"><label for="iNota">Guía / orden de compra</label><input id="iNota" maxlength="80" placeholder="Ej.: OC-2026-0412"></div>
    </div></form>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario" type="submit" form="formIng">Registrar ingreso</button>`
  });
  $("#formIng").onsubmit = (e) => {
    e.preventDefault();
    const c = Number($("#iCant").value);
    r.stock = Math.round((r.stock + c) * 100) / 100;
    db.movimientos.push({ fecha: ahoraISO(), tipo: "Ingreso", codigo: cod, cantidad: c, nota: $("#iNota").value.trim() || "Ingreso al almacén" });
    const esperando = avisarOTsEsperando(cod, c);
    guardar(); cerrarModal(); render();
    aviso(esperando.length ? `Stock actualizado. ${esperando.map(o => o.codigo).join(", ")} ya puede reanudarse.` : `Stock de ${r.nombre}: ${cant(r.stock)} ${r.unidad}`);
  };
}

function formSalida(cod) {
  const r = repuesto(cod);
  const motivos = r.categoria === "EPP" ? ["Entrega de EPP", "Reposición por desgaste", "Merma o dañado"] : ["Consumo en el taller", "Préstamo a producción", "Merma o dañado"];
  abrirModal({
    titulo: "− Salida sin orden de trabajo",
    subtitulo: `<span class="tenue">${r.codigo} · ${esc(r.nombre)} · stock ${cant(r.stock)} ${esc(r.unidad)}</span>`,
    cuerpo: `<form id="formSal" class="modal-cuerpo" style="padding:0">
      <p class="tenue">Para repuestos que se usan en una reparación, descuéntalos desde la orden de trabajo: así queda el costo en la máquina.</p>
      <div class="fila-campos">
        <div class="campo"><label for="sCant">Cantidad (${esc(r.unidad)})</label><input type="number" id="sCant" min="0.1" step="0.1" max="${r.stock}" value="1" required></div>
        <div class="campo"><label for="sMotivo">Motivo</label><select id="sMotivo">${motivos.map(m => `<option>${m}</option>`).join("")}</select></div>
        <div class="campo"><label for="sPersona">Entregado a</label><select id="sPersona">${db.personas.map(p => `<option value="${p.id}" ${p.id === yo().id ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></div>
      </div></form>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario" type="submit" form="formSal" ${r.stock > 0 ? "" : "disabled"}>Registrar salida</button>`
  });
  $("#formSal").onsubmit = (e) => {
    e.preventDefault();
    const c = Number($("#sCant").value);
    if (c > r.stock) { aviso(`Solo hay ${cant(r.stock)} ${r.unidad}`); return; }
    r.stock = Math.round((r.stock - c) * 100) / 100;
    db.movimientos.push({ fecha: ahoraISO(), tipo: "Salida", codigo: cod, cantidad: c, nota: `${$("#sMotivo").value} · ${nombre($("#sPersona").value)}` });
    guardar(); cerrarModal(); render();
    aviso(`Salida registrada · quedan ${cant(r.stock)} ${r.unidad}${r.stock < r.minimo ? " ⚠️ bajo el mínimo" : ""}`);
  };
}

function formNuevoRepuesto() {
  const sig = "R-" + String(Math.max(...db.repuestos.map(r => Number(r.codigo.slice(2)) || 0)) + 1).padStart(3, "0");
  abrirModal({
    titulo: "➕ Nuevo artículo de inventario",
    cuerpo: `<form id="formRep" class="modal-cuerpo" style="padding:0">
      <div class="campo"><label for="nNombre">Nombre</label><input id="nNombre" required maxlength="100" placeholder="Ej.: Rodamiento 6206-2RS"></div>
      <div class="fila-campos">
        <div class="campo"><label for="nCat">Familia</label><select id="nCat">${CATEGORIAS.map(c => `<option>${c}</option>`).join("")}</select></div>
        <div class="campo"><label for="nUnidad">Unidad</label><select id="nUnidad">${["und", "kit", "par", "m", "kg", "gal", "balde", "frasco", "rollo", "caja"].map(u => `<option>${u}</option>`).join("")}</select></div>
        <div class="campo"><label for="nUbic">Ubicación</label><input id="nUbic" required maxlength="40" placeholder="Estante A1"></div>
        <div class="campo"><label for="nCosto">Costo unitario (S/)</label><input type="number" id="nCosto" min="0" step="0.1" value="0" required></div>
        <div class="campo"><label for="nStock">Stock inicial</label><input type="number" id="nStock" min="0" step="0.1" value="0" required></div>
        <div class="campo"><label for="nMin">Stock mínimo</label><input type="number" id="nMin" min="0" step="1" value="2" required></div>
      </div></form>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario" type="submit" form="formRep">Guardar ${sig}</button>`
  });
  $("#formRep").onsubmit = (e) => {
    e.preventDefault();
    const stock = Number($("#nStock").value);
    db.repuestos.push({ codigo: sig, nombre: $("#nNombre").value.trim(), categoria: $("#nCat").value, unidad: $("#nUnidad").value,
      ubicacion: $("#nUbic").value.trim(), stock, minimo: Number($("#nMin").value), costo: Number($("#nCosto").value) });
    if (stock) db.movimientos.push({ fecha: ahoraISO(), tipo: "Ingreso", codigo: sig, cantidad: stock, nota: "Stock inicial" });
    guardar(); cerrarModal(); render(); aviso(`${sig} agregado al inventario`);
  };
}

function exportarInventario() {
  if (typeof XLSX === "undefined") { aviso("No se pudo cargar el generador de Excel"); return; }
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(db.repuestos.map(r => ({
    Codigo: r.codigo, Articulo: r.nombre, Familia: r.categoria, Unidad: r.unidad, Ubicacion: r.ubicacion, Stock: r.stock, Minimo: r.minimo,
    "Costo unit.": r.costo, Valor: Math.round(r.stock * r.costo), "Consumo 90 dias": consumoDias(r.codigo, 90),
    "Alcanza (dias)": cobertura(r) === null ? "" : Math.round(cobertura(r)), "En camino": enCamino(r.codigo), Alerta: r.stock < r.minimo ? "Reponer" : "" }))), "Inventario");
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(movimientosInventario().map(m => ({
    Fecha: fmtFecha(m.fecha), Movimiento: m.tipo, Codigo: m.codigo, Articulo: repuesto(m.codigo)?.nombre || "", Cantidad: variacion(m), Detalle: m.nota || "" }))), "Movimientos");
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(db.compras.flatMap(c => c.items.map(i => ({
    Solicitud: c.codigo, Fecha: fmtFecha(c.fecha), Estado: c.estado, Codigo: i.codigo, Articulo: repuesto(i.codigo)?.nombre || "", Cantidad: i.cantidad,
    Subtotal: Math.round((repuesto(i.codigo)?.costo || 0) * i.cantidad) })))), "Compras");
  XLSX.writeFile(libro, `inventario-mantenimiento-${new Date().toISOString().slice(0, 10)}.xlsx`);
  aviso("Excel del inventario descargado");
}

// =========================================================
// TALLER: herramientas y trabajos en curso
// =========================================================
function vistaTaller() {
  const jefe = esJefe();
  const h = db.herramientas;
  const enCurso = abiertas().filter(o => o.estado === "En ejecución" || o.estado === "Esperando repuesto").sort(ordenarAbiertas);
  const cls = { "Disponible": "c-ok", "Prestada": "c-info", "En reparación": "c-alerta" };

  vista.innerHTML = `
    <div class="kpis">
      ${kpi(h.filter(x => x.estado === "Disponible").length, "Herramientas disponibles", `de ${h.length} registradas`, "k-ok")}
      ${kpi(h.filter(x => x.estado === "Prestada").length, "Prestadas ahora", "En manos de los técnicos", "k-info")}
      ${kpi(h.filter(x => x.estado === "En reparación").length, "En reparación", "", h.some(x => x.estado === "En reparación") ? "k-alerta" : "k-ok")}
      ${kpi(enCurso.length, "Trabajos en curso", `${enCurso.filter(o => o.estado === "Esperando repuesto").length} esperando repuesto`, "k-info")}
    </div>
    <div class="rejilla-2 r-21">
      <section class="tarjeta">
        <div class="tarjeta-cab"><div><h2>🔧 Herramientas del taller</h2><p class="tenue">Quién tiene cada herramienta y desde cuándo.</p></div>
          ${jefe ? `<button class="btn" id="btnNuevaHerr">➕ Nueva herramienta</button>` : ""}</div>
        <div class="tabla-caja"><table>
          <thead><tr><th>Código</th><th>Herramienta</th><th>Estado</th><th>La tiene</th><th></th></tr></thead>
          <tbody>${h.map(x => {
            let botones = "";
            if (x.estado === "Disponible") botones = jefe
              ? `<select data-prestar-a="${x.codigo}" aria-label="Prestar a"><option value="">Prestar a…</option>${tecnicos().map(t => `<option value="${t.id}">${esc(t.nombre)}</option>`).join("")}</select><button class="btn btn-chico" data-reparar="${x.codigo}">A reparación</button>`
              : yo().rol === "tecnico" ? `<button class="btn btn-chico btn-primario" data-tomar="${x.codigo}">Tomar</button>` : "";
            if (x.estado === "Prestada" && (jefe || x.prestadaA === yo().id)) botones = `<button class="btn btn-chico" data-devolver="${x.codigo}">Devolver</button>`;
            if (x.estado === "En reparación" && jefe) botones = `<button class="btn btn-chico" data-devolver="${x.codigo}">Ya está reparada</button>`;
            return `<tr><td class="codigo">${x.codigo}</td><td>${esc(x.nombre)}</td><td><span class="chip ${cls[x.estado]}">${x.estado}</span></td>
              <td>${x.estado === "Prestada" ? `<span class="con-avatar">${avatar(persona(x.prestadaA))}<span>${esc(nombre(x.prestadaA))}${x.desde ? `<small>${haceTexto(x.desde)}</small>` : ""}</span></span>` : '<span class="tenue">—</span>'}</td>
              <td><div class="acciones acciones-fila">${botones}</div></td></tr>`;
          }).join("")}</tbody></table></div>
      </section>
      <section class="tarjeta">
        <h2>🛠️ En el taller ahora</h2>
        ${enCurso.length ? `<div class="alertas">${enCurso.map(o => `<div class="alerta ${o.estado === "Esperando repuesto" ? "a-mal" : "a-info"}">
          ${avatar(persona(o.tecnicoId) || persona(1))}
          <div><div><b class="codigo">${o.maquina}</b> ${esc(o.titulo)}</div><small class="tenue">${o.codigo} · ${esc(nombre(o.tecnicoId))} · ${o.estado}${o.inicio ? " · desde " + haceTexto(o.inicio).replace("hace ", "hace ") : ""}</small></div>
          <button class="btn btn-chico" data-fila-ot="${o.id}">Ver</button></div>`).join("")}</div>` : `<p class="vacio">Nadie está trabajando en este momento</p>`}
        <a class="enlace" href="#inventario">📦 Ver repuestos e inventario →</a>
      </section>
    </div>`;

  const herr = (cod) => db.herramientas.find(x => x.codigo === cod);
  $$("[data-prestar-a]").forEach(s => s.onchange = () => {
    if (!s.value) return;
    Object.assign(herr(s.dataset.prestarA), { estado: "Prestada", prestadaA: Number(s.value), desde: ahoraISO() });
    guardar(); render(); aviso(`${herr(s.dataset.prestarA).nombre} prestada a ${nombre(s.value)}`);
  });
  $$("[data-tomar]").forEach(b => b.onclick = () => {
    Object.assign(herr(b.dataset.tomar), { estado: "Prestada", prestadaA: yo().id, desde: ahoraISO() });
    guardar(); render(); aviso(`Registrado: tienes ${herr(b.dataset.tomar).nombre}`);
  });
  $$("[data-devolver]").forEach(b => b.onclick = () => {
    const x = herr(b.dataset.devolver);
    Object.assign(x, { estado: "Disponible", prestadaA: null, desde: null });
    guardar(); render(); aviso(`${x.nombre} disponible en el taller`);
  });
  $$("[data-reparar]").forEach(b => b.onclick = () => { herr(b.dataset.reparar).estado = "En reparación"; guardar(); render(); });
  if ($("#btnNuevaHerr")) $("#btnNuevaHerr").onclick = () => {
    abrirModal({
      titulo: "➕ Nueva herramienta",
      cuerpo: `<form id="formHerr" class="modal-cuerpo" style="padding:0"><div class="campo"><label for="hNombre">Nombre</label><input id="hNombre" required maxlength="80" placeholder="Ej.: Alineador láser de ejes"></div></form>`,
      pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario" type="submit" form="formHerr">Guardar</button>`
    });
    $("#formHerr").onsubmit = (e) => {
      e.preventDefault();
      const codigo = "H-" + String(Math.max(...db.herramientas.map(x => Number(x.codigo.slice(2)) || 0)) + 1).padStart(2, "0");
      db.herramientas.push({ codigo, nombre: $("#hNombre").value.trim(), estado: "Disponible" });
      guardar(); cerrarModal(); render(); aviso(`${codigo} agregada al taller`);
    };
  };
  conectarFilasOT();
}
