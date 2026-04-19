# Smoke Test del Voice Agent

Checklist manual para ejecutar **antes de cada deploy grande** del agente de voz, o cuando Henry/Diana reporten comportamiento raro.

Cada escenario toma menos de 2 minutos. En total ~10 minutos.

---

## Requisitos previos

- Acceso a `/consulta` (sitio público — no requiere login).
- Acceso a `/admin/llamadas` (login como `henryorellanad@gmail.com` o `dianaulp@gmail.com`).
- Un celular y un computador, idealmente en la misma red.

---

## Escenario 1 — Silencio total

**Setup**: ambiente silencioso, sin TV, sin conversaciones cercanas.

**Pasos**:
1. Abre `/consulta` en el celular
2. Toca el botón de llamar y acepta permiso de micrófono
3. Espera sin hablar 3 segundos
4. Di "Hola, me llamo [tu nombre]"

**Criterio de éxito**:
- La IA saluda al conectar (no tarda más de 3s)
- Al decir tu nombre, responde reconociéndolo
- La consola del navegador muestra `[voice-call] Noise gate calibrated at 0.0XX` en el primer segundo

---

## Escenario 2 — TV de fondo

**Setup**: prende una TV a volumen medio con alguien hablando (noticias, serie, podcast).

**Pasos**:
1. Inicia la llamada desde el celular (micrófono a 1-2m de la TV)
2. Quédate callado 10 segundos
3. Di "Hola, puedes escucharme?"

**Criterio de éxito**:
- Durante los 10s de silencio, la IA **no responde** a los diálogos de la TV
- Al hablar tú, la IA te responde a ti
- Al abrir el detalle de la llamada en `/admin/llamadas`, el `gate_stats.open_pct` debe ser bajo (< 0.3)

---

## Escenario 3 — Memoria post-reconexión (CRÍTICO)

**Setup**: llamada normal, prueba que la IA no pierde contexto al reconectar.

**Pasos**:
1. Inicia la llamada
2. Dile tu nombre: "Hola, me llamo Juan"
3. Cuando te pregunte el estado, responde: "Estoy en Utah"
4. Abre DevTools → Network → marca "offline" por 3 segundos
5. Desmarca "offline"

**Criterio de éxito**:
- Aparece "Reconectando... (1/2)" brevemente
- Al reconectar, la IA dice algo como "Te escucho de nuevo" o "Continuamos, Juan, ¿cuántos hijos tienes?"
- **NO** dice "Hola, ¿cómo te llamas?" ni vuelve a pedir el estado
- En la consola se ve `[voice-call] Reinjected context with N turns`

Si la IA vuelve al paso 1, es regresión — revisa el prompt y la lógica de reinject en `voice-call.tsx`.

---

## Escenario 4 — Reconexión de red

**Setup**: celular con datos móviles y WiFi disponibles.

**Pasos**:
1. Inicia la llamada con WiFi
2. A los 20 segundos, apaga el WiFi (el celular baja a 4G)
3. Observa la pantalla

**Criterio de éxito**:
- El orbe muestra "Reconectando... (1/2)" brevemente
- La llamada continúa sin que tengas que tocar nada
- La duración total en `/admin/llamadas` refleja los 20s iniciales + lo que haya durado después de reconectar

---

## Escenario 5 — Agendar una cita de prueba

**Setup**: llamada normal en horario de atención (L–S 8am–8pm MT).

**Pasos**:
1. Inicia la llamada
2. Cuando la IA te pregunte si quieres agendar, di que sí
3. Confirma tu nombre y teléfono cuando la IA te los repita
4. Elige uno de los slots que te ofrezca
5. Confirma la cita
6. Cuelga

**Criterio de éxito**:
- La IA repite tu teléfono dígito por dígito antes de avanzar
- La IA usa `get_available_slots` y te lee horarios reales
- Al colgar, la cita aparece en `/admin/citas` con:
  - `guest_name` = tu nombre
  - `guest_phone` = tu teléfono
  - `source` = `voice-agent`
  - `scheduled_at` = el slot que elegiste
- En `/admin/llamadas` la llamada muestra "Cita agendada" (verde) y las tools `get_available_slots` + `book_appointment` con ✓

---

## Escenario 6 — Registro en `/admin/llamadas`

**Setup**: tras ejecutar los escenarios anteriores.

**Pasos**:
1. Abre `/admin/llamadas`
2. Verifica que cada llamada aparece con duración correcta
3. Abre el detalle de al menos una llamada

**Criterio de éxito**:
- Cada llamada tiene `duration_seconds` > 0
- El `end_reason` coincide con cómo cortaste (user-hangup, timeout, etc.)
- Si la llamada tuvo recolección de datos, aparece `lead_id` o `appointment_id` vinculado
- Las tools invocadas aparecen con ✓ (ok) o ✗ (error)
- El entry `gate_stats` aparece con `open_pct` entre 0.2 y 0.7 para una conversación normal

---

## Interpretación de `gate_stats`

El noise gate decide qué audio enviar a Gemini. `open_pct` es la fracción de frames que pasaron (se enviaron).

| `open_pct` | Interpretación | Acción |
|---|---|---|
| < 0.1 | El gate bloquea casi todo. La IA "no escucha" al cliente. | Bajar `gateMultiplier` o aumentar `minGateAbsolute` |
| 0.1 – 0.3 | Ambiente silencioso, conversación normal. | OK |
| 0.3 – 0.7 | Conversación activa con algo de ruido ambiente. | OK |
| > 0.7 | El gate casi no bloquea. Puede estar dejando pasar ruido. | Subir `gateMultiplier` |

Los parámetros se configuran en `src/app/consulta/voice-call.tsx` donde se instancia el `AudioWorkletNode`.

---

## Si algún escenario falla

1. Revisa `docs/voice-agent-rollback.md` para desactivar la capa específica que falla
2. Abre un issue en GitHub con:
   - Qué escenario falló
   - Screenshot de la consola del navegador
   - `id` de la llamada (visible en `/admin/llamadas`)
   - Dispositivo y navegador usados
