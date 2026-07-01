import { getStore } from "@netlify/blobs";

const KEY        = "registros_v1";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "B@y3sp#F4lc0n26!";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const isAdmin = (req) => req.headers.get("x-admin-pass") === ADMIN_PASS;

const ESPECIALIDADES_VALIDAS = ["psicologia", "psiquiatria"];

function parsarEspecialidades(val) {
  if (Array.isArray(val)) return val.filter(v => ESPECIALIDADES_VALIDAS.includes(v));
  // compatibilidad con registros viejos que tenían string
  if (typeof val === "string" && ESPECIALIDADES_VALIDAS.includes(val)) return [val];
  return [];
}

async function leer(store) {
  const data = await store.get(KEY, { type: "json" }).catch(() => null);
  return Array.isArray(data) ? data : [];
}
async function guardar(store, registros) {
  await store.setJSON(KEY, registros);
}

export default async (req) => {
  const store = getStore("registros");

  if (req.method === "GET") {
    const registros = await leer(store);
    registros.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return json(registros);
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

    const registros = await leer(store);

    // CREAR — público
    if (body.action === "create") {
      if (!body.nombre?.trim()) return json({ error: "El nombre es obligatorio" }, 400);
      const comp = body.composicion || {};
      const composicion = {
        hombres:      Math.max(0, Number(comp.hombres)      || 0),
        mujeres:      Math.max(0, Number(comp.mujeres)      || 0),
        ninos:        Math.max(0, Number(comp.ninos)        || 0),
        ninas:        Math.max(0, Number(comp.ninas)        || 0),
        adolescentes: Math.max(0, Number(comp.adolescentes) || 0),
      };
      const psico = body.psicologia && typeof body.psicologia === "object" ? {
        requiere:      body.psicologia.requiere === true,
        urgencia:      ["inmediata","diferida"].includes(body.psicologia.urgencia) ? body.psicologia.urgencia : "diferida",
        especialidades: parsarEspecialidades(body.psicologia.especialidades ?? body.psicologia.especialidad),
      } : { requiere: false, urgencia: "diferida", especialidades: [] };

      const nuevo = {
        id:             crypto.randomUUID(),
        nombre:         String(body.nombre).trim(),
        composicion,
        personas:       Object.values(composicion).reduce((a, v) => a + v, 0),
        telefono:       String(body.telefono  || "").trim(),
        edades:         String(body.edades    || "").trim(),
        destino:        String(body.destino   || "").trim(),
        necesidades:    Array.isArray(body.necesidades) ? body.necesidades : [],
        notas:          String(body.notas     || "").trim(),
        verificado:     body.verificado === true,
        psicologia:     psico,
        seguimiento:    { activo: false, entradas: [] },
        enProceso:      false,
        enProcesoNotas: "",
        enProcesoBy:    "",
        enProcesoAt:    null,
        ayudado:        false,
        ayudadoPor:     "",
        ayudadoAt:      null,
        createdAt:      Date.now(),
      };
      registros.push(nuevo);
      await guardar(store, registros);
      return json(nuevo, 201);
    }

    // MARCAR / DESMARCAR AYUDADO — solo admin
    if (body.action === "help") {
      if (!isAdmin(req)) return json({ error: "No autorizado" }, 403);
      const idx = registros.findIndex(r => r.id === body.id);
      if (idx === -1) return json({ error: "No encontrado" }, 404);
      const r = registros[idx];
      r.ayudado    = !r.ayudado;
      r.ayudadoPor = r.ayudado ? String(body.ayudadoPor || "").trim() : "";
      r.ayudadoAt  = r.ayudado ? Date.now() : null;
      if (r.ayudado) { r.enProceso = false; r.enProcesoNotas = ""; r.enProcesoBy = ""; r.enProcesoAt = null; }
      await guardar(store, registros);
      return json(r);
    }

    // MARCAR EN PROCESO — solo admin
    if (body.action === "en_proceso") {
      if (!isAdmin(req)) return json({ error: "No autorizado" }, 403);
      const idx = registros.findIndex(r => r.id === body.id);
      if (idx === -1) return json({ error: "No encontrado" }, 404);
      const r = registros[idx];
      r.enProceso      = !r.enProceso;
      r.enProcesoNotas = r.enProceso ? String(body.notas || "").trim() : "";
      r.enProcesoBy    = r.enProceso ? String(body.por   || "").trim() : "";
      r.enProcesoAt    = r.enProceso ? Date.now() : null;
      await guardar(store, registros);
      return json(r);
    }

    // AGREGAR ENTRADA DE SEGUIMIENTO — solo admin
    if (body.action === "seguimiento_add") {
      if (!isAdmin(req)) return json({ error: "No autorizado" }, 403);
      const idx = registros.findIndex(r => r.id === body.id);
      if (idx === -1) return json({ error: "No encontrado" }, 404);
      const texto = String(body.texto || "").trim();
      if (!texto) return json({ error: "El texto es obligatorio" }, 400);
      const r = registros[idx];
      if (!r.seguimiento || !Array.isArray(r.seguimiento.entradas)) {
        r.seguimiento = { activo: true, entradas: [] };
      }
      r.seguimiento.activo = true;
      r.seguimiento.entradas.push({ texto, creadoAt: Date.now() });
      await guardar(store, registros);
      return json(r);
    }

    // CERRAR / REABRIR SEGUIMIENTO — solo admin
    if (body.action === "seguimiento_toggle") {
      if (!isAdmin(req)) return json({ error: "No autorizado" }, 403);
      const idx = registros.findIndex(r => r.id === body.id);
      if (idx === -1) return json({ error: "No encontrado" }, 404);
      const r = registros[idx];
      if (!r.seguimiento) r.seguimiento = { activo: false, entradas: [] };
      r.seguimiento.activo = !r.seguimiento.activo;
      await guardar(store, registros);
      return json(r);
    }

    // VERIFICAR CONTRASEÑA — para login del cliente
    if (body.action === "verify") {
      if (!isAdmin(req)) return json({ error: "No autorizado" }, 403);
      return json({ ok: true });
    }

    // EDITAR — solo admin
    if (body.action === "edit") {
      if (!isAdmin(req)) return json({ error: "No autorizado" }, 403);
      const idx = registros.findIndex(r => r.id === body.id);
      if (idx === -1) return json({ error: "No encontrado" }, 404);
      const r = registros[idx];
      if (body.nombre      !== undefined) r.nombre      = String(body.nombre).trim();
      if (body.telefono    !== undefined) r.telefono    = String(body.telefono).trim();
      if (body.edades      !== undefined) r.edades      = String(body.edades).trim();
      if (body.destino     !== undefined) r.destino     = String(body.destino).trim();
      if (body.necesidades !== undefined) r.necesidades = Array.isArray(body.necesidades) ? body.necesidades : [];
      if (body.notas       !== undefined) r.notas       = String(body.notas).trim();
      if (body.verificado  !== undefined) r.verificado  = body.verificado === true;
      if (body.psicologia  !== undefined && typeof body.psicologia === "object") {
        if (!r.psicologia) r.psicologia = { requiere: false, urgencia: "diferida", especialidades: [] };
        if (body.psicologia.requiere      !== undefined) r.psicologia.requiere      = body.psicologia.requiere === true;
        if (body.psicologia.urgencia      !== undefined) r.psicologia.urgencia      = ["inmediata","diferida"].includes(body.psicologia.urgencia) ? body.psicologia.urgencia : "diferida";
        if (body.psicologia.especialidades !== undefined) r.psicologia.especialidades = parsarEspecialidades(body.psicologia.especialidades);
      }
      await guardar(store, registros);
      return json(r);
    }

    // ELIMINAR — solo admin
    if (body.action === "delete") {
      if (!isAdmin(req)) return json({ error: "No autorizado" }, 403);
      const filtrados = registros.filter(r => r.id !== body.id);
      await guardar(store, filtrados);
      return json({ ok: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = { path: "/api/registros" };
