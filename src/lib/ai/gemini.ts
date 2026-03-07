import { GoogleGenAI } from '@google/genai'

export const GEMINI_MODEL = 'gemini-3.1-pro-preview-customtools'

let _client: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables')
    }
    _client = new GoogleGenAI({ apiKey })
  }
  return _client
}
