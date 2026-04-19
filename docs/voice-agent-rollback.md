# Rollback del Voice Agent

Guía para revertir rápidamente el filtrado de ruido (commit `f6ec6ce`) **sin bajar el voice agent completo**. Cada capa puede desactivarse de forma independiente.

Si Henry o Diana reportan **"la IA no me escucha"** o **"responde a cosas raras del ambiente"**, usa esta guía.

---

## Diagnóstico rápido

Antes de rollback, abre `/admin/llamadas` y revisa el detalle de la llamada problemática. Busca el entry `gate_stats`:

- `open_pct < 0.1` → el noise gate es **demasiado agresivo**. Usa **Opción A**.
- `open_pct > 0.7` y la IA responde a ruido → el gate es **demasiado permisivo**. Usa **Opción B** (ajustar, no desactivar).
- La IA no responde y no hay stats → problema en la config de Gemini Live. Usa **Opción C**.

---

## Opción A — Desactivar noise gate (la IA no escucha)

**Archivo**: `src/app/consulta/voice-call.tsx`

Busca esta sección (cerca de la línea ~375, donde se crea el AudioWorkletNode):

```typescript
const worklet = new AudioWorkletNode(captureCtx, 'voice-capture-processor', {
  processorOptions: {
    calibrationMs: 1500,
    gateMultiplier: 2.5,
    holdMs: 400,
  },
})
```

Cambia `gateMultiplier: 2.5` a `gateMultiplier: 0`. Con multiplicador cero, el threshold se vuelve 0 y **todo el audio pasa** (comportamiento previo al commit).

Commit + push:
```bash
git add src/app/consulta/voice-call.tsx
git commit -m "rollback: desactiva noise gate hasta ajustar sensibilidad"
git push
```

---

## Opción B — Ajustar sensibilidad (gate muy permisivo)

Mismo archivo y sección que la Opción A. Prueba valores más altos:

| Ambiente típico del cliente | `gateMultiplier` recomendado |
|---|---|
| Casa silenciosa | 2.0 (menos agresivo) |
| Oficina con algo de ruido | 2.5 (default actual) |
| Lugar ruidoso (cocina, calle) | 3.5 |
| Muy ruidoso (carro, restaurante) | 5.0 + considerar activar PTT |

También puedes subir `minGateAbsolute` (default 0.012) a 0.02 para un piso más alto.

---

## Opción C — Desactivar turn detection estricto de Gemini

Si las llamadas no llegan a conectar, o Gemini responde errores en el handshake, sospecha que la config `realtimeInputConfig` está siendo rechazada por la API (ej: si Google cambia los enums en un modelo nuevo).

**Archivo**: `src/app/api/chatbot/token/route.ts`

Busca y **comenta** el bloque completo `realtimeInputConfig` (líneas ~82-92):

```typescript
// realtimeInputConfig: {
//   automaticActivityDetection: {
//     startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
//     endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
//     prefixPaddingMs: 200,
//     silenceDurationMs: 900,
//   },
// },
```

Con eso Gemini vuelve al turn detection default (más sensible). Commit + push.

---

## Opción D — Rollback total del commit

Si todas las capas fallan y queremos volver exactamente al estado anterior:

```bash
git revert f6ec6ce
git push
```

Esto crea un nuevo commit que deshace:
- El noise gate en el worklet
- La config de Gemini Live
- La sección de "Manejo de ruido" del prompt

**Importante**: el `git revert` preserva los commits posteriores (ej. `0ea7c8c` de CSP/CI/paginación, `0a7b059` de voice-call.tsx original). NO uses `git reset --hard` — perderías esos commits.

---

## Monitoreo post-rollback

Tras cualquier opción, ejecuta `docs/voice-agent-smoke-test.md` completo (5 escenarios, ~10 min) antes de confirmar que está estable.

Si el rollback en producción requiere urgencia y no puedes esperar el smoke test, al menos corre los escenarios 1 y 2.
