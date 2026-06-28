import { getStore } from "@netlify/blobs";

const KEY        = "registros_v1";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "B@y3sp#F4lc0n26!";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const isAdmin = (req) => req.headers.get("x-admin-pass") === ADMIN_PASS;

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
      const nuevo = {
        id:          crypto.randomUUID(),
        nombre:      String(body.nombre).trim(),
        composicion,
        personas:    Object.values(composicion).reduce((a, v) => a + v, 0),
        telefono:    String(body.telefono  || "").trim(),
        destino:     String(body.destino   || "").trim(),
        necesidades: Array.isArray(body.necesidades) ? body.necesidades : [],
        notas:       String(body.notas     || "").trim(),
        verificado:  body.verificado === true,
        ayudado:     false,
        ayudadoPor:  "",
        ayudadoAt:   null,
        createdAt:   Date.now(),
      };
      registros.push(nuevo);
      await guardar(store, registros);
      return json(nuevo, 201);
    }

    // MARCAR / DESMARCAR — público
    if (body.action === "help") {
      const idx = registros.findIndex(r => r.id === body.id);
      if (idx === -1) return json({ error: "No encontrado" }, 404);
      const r = registros[idx];
      r.ayudado    = !r.ayudado;
      r.ayudadoPor = r.ayudado ? String(body.ayudadoPor || "").trim() : "";
      r.ayudadoAt  = r.ayudado ? Date.now() : null;
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
      if (body.destino     !== undefined) r.destino     = String(body.destino).trim();
      if (body.necesidades !== undefined) r.necesidades = Array.isArray(body.necesidades) ? body.necesidades : [];
      if (body.notas       !== undefined) r.notas       = String(body.notas).trim();
      if (body.verificado  !== undefined) r.verificado  = body.verificado === true;
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
