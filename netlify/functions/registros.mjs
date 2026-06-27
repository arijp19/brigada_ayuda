import { getStore } from "@netlify/blobs";

// Todos los registros se guardan en UN solo blob como array JSON.
// Esto reduce cada lectura a 1 sola petición en lugar de N+1.
const KEY = "registros_v1";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

async function leer(store) {
  const data = await store.get(KEY, { type: "json" }).catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function guardar(store, registros) {
  await store.setJSON(KEY, registros);
}

export default async (req) => {
  const store = getStore("registros");

  // GET — devuelve todos los registros ordenados del más reciente al más antiguo
  if (req.method === "GET") {
    const registros = await leer(store);
    registros.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return json(registros);
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

    const registros = await leer(store);

    // CREAR registro
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
        ayudado:     false,
        ayudadoPor:  "",
        ayudadoAt:   null,
        createdAt:   Date.now(),
      };
      registros.push(nuevo);
      await guardar(store, registros);
      return json(nuevo, 201);
    }

    // MARCAR / DESMARCAR ayudado
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

    // ELIMINAR
    if (body.action === "delete") {
      const filtrados = registros.filter(r => r.id !== body.id);
      await guardar(store, filtrados);
      return json({ ok: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = { path: "/api/registros" };
