import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default async (req) => {
  const store = getStore("registros");

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    items.sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
    return json(items.filter(Boolean));
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

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
      const personas = Object.values(composicion).reduce((a, v) => a + v, 0);
      const id = crypto.randomUUID();
      const registro = {
        id,
        nombre:       String(body.nombre).trim(),
        composicion,
        personas,
        telefono:     String(body.telefono  || "").trim(),
        destino:      String(body.destino   || "").trim(),
        necesidades:  Array.isArray(body.necesidades) ? body.necesidades : [],
        notas:        String(body.notas     || "").trim(),
        ayudado:      false,
        ayudadoPor:   "",
        ayudadoAt:    null,
        createdAt:    Date.now(),
      };
      await store.setJSON(id, registro);
      return json(registro, 201);
    }

    if (body.action === "help") {
      const r = await store.get(body.id, { type: "json" });
      if (!r) return json({ error: "No encontrado" }, 404);
      r.ayudado    = !r.ayudado;
      r.ayudadoPor = r.ayudado ? String(body.ayudadoPor || "").trim() : "";
      r.ayudadoAt  = r.ayudado ? Date.now() : null;
      await store.setJSON(body.id, r);
      return json(r);
    }

    if (body.action === "delete") {
      await store.delete(body.id);
      return json({ ok: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = { path: "/api/registros" };
