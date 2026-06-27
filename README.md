# 🫶 Registro de Ayuda · Brigada Caracas

Página para registrar a las personas que llegan desde Caracas, ver qué necesitan,
dónde van a llegar, y coordinar la ayuda marcando a quién ya se ayudó, con conteo en tiempo real.

Los datos se guardan de forma **compartida** usando **Netlify Blobs** (incluido y gratis en Netlify),
así que todas las personas que abran el link ven y actualizan la misma información.

## Estructura

```
public/index.html            → La página (formulario, lista, contadores)
netlify/functions/registros.mjs → El servidor que guarda y comparte los datos
netlify.toml                 → Configuración de Netlify
package.json                 → Dependencia @netlify/blobs
```

## Cómo publicarlo en Netlify (la forma más fácil, sin programar)

### Opción A — Arrastrar y soltar
1. Comprime esta carpeta en un `.zip`.
2. Entra a https://app.netlify.com → inicia sesión.
3. Ve a **Add new site → Deploy manually** y arrastra la carpeta/zip.
4. Listo: Netlify te da un link público (ej: `https://tu-sitio.netlify.app`) para compartir.

> Nota: Netlify Blobs y las funciones se activan solas al desplegar. No hay que configurar nada más.

### Opción B — Con la línea de comandos (Netlify CLI)
```bash
npm install -g netlify-cli   # solo la primera vez
npm install                  # instala @netlify/blobs
netlify deploy --prod        # te pedirá iniciar sesión y crear el sitio
```

## Probarlo en tu computador antes de publicar
```bash
npm install -g netlify-cli
npm install
netlify dev
```
Luego abre http://localhost:8888

## Cómo se usa
- **Registrar:** llena el formulario de la izquierda con nombre, nº de personas,
  teléfono, dónde van a llegar y qué necesitan. Pulsa *Guardar registro*.
- **Ver y buscar:** la lista de la derecha muestra todos los registros. Puedes
  filtrar por *Pendientes / Ayudados* y buscar por nombre, zona o necesidad.
- **Marcar ayuda:** pulsa *Marcar como ayudado* (te pide tu nombre/brigada).
  El conteo de arriba se actualiza solo.
- La lista se refresca automáticamente cada 15 segundos para ver lo que registran otros.
