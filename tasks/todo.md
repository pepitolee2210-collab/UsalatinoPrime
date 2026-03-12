# Plan XL: Chatbot Público con Voz Nativa — Filtro de Prospectos

## Status: APROBADO — EN PROGRESO

## Modelos
- Chat texto: `gemini-3.1-pro-preview-customtools`
- Voz nativa + audio: `gemini-2.5-flash-native-audio-preview-12-2025`
- Live API: ephemeral tokens (cliente conecta directo a Gemini, sin proxy)

## Fases
- [x] Fase 1: Backend (system prompt + API chat + API lead + API ephemeral token)
- [ ] Fase 2: Frontend modo chat (WhatsApp-like + grabador audio)
- [ ] Fase 3: Frontend modo llamada voz (Live API + ephemeral token)
- [ ] Fase 4: Conexión con agenda + migración source column
