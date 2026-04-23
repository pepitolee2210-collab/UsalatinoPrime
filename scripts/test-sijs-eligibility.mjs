#!/usr/bin/env node
/**
 * Smoke tests for the SIJS eligibility filter, timezone mapping, and state
 * machine. Runs with `node scripts/test-sijs-eligibility.mjs` — no extra
 * test runner required. Uses Node 20's built-in `node:test`.
 *
 * Keep this short and readable: these are guardrails around the rules that
 * shape what the WhatsApp bot tells prospective clients. Breaking them by
 * accident could mean telling someone they qualify when they do not.
 */

import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  evaluateEligibility,
  getStateAgeLimit,
  FEDERAL_SIJS_AGE_CAP,
} from '../src/lib/chatbot/sijs-eligibility.ts'
import {
  normalizeStateCode,
  tzForState,
  STATE_TIMEZONE,
} from '../src/lib/timezones/us-states.ts'

// ─── Eligibility ────────────────────────────────────────────────

test('getStateAgeLimit: TX=18, AL=19, NE=19, default 21', () => {
  assert.equal(getStateAgeLimit('TX'), 18)
  assert.equal(getStateAgeLimit('AL'), 19)
  assert.equal(getStateAgeLimit('NE'), 19)
  assert.equal(getStateAgeLimit('FL'), 21)
  assert.equal(getStateAgeLimit('CA'), 21)
  assert.equal(getStateAgeLimit('NY'), 21)
  assert.equal(getStateAgeLimit(''), FEDERAL_SIJS_AGE_CAP)
})

test('evaluateEligibility: 17 in FL with abuse → eligible', () => {
  const v = evaluateEligibility({
    lives_in_usa: true, age: 17, state_us: 'FL', suffered_abuse: true,
  })
  assert.equal(v.verdict, 'eligible')
  assert.equal(v.state_age_limit, 21)
})

test('evaluateEligibility: 19 in AL → requires_review (state cap hit but <21 federal)', () => {
  const v = evaluateEligibility({
    lives_in_usa: true, age: 19, state_us: 'AL', suffered_abuse: true,
  })
  // Alabama cap is 19. Client is OUT of AL juvenile jurisdiction but still
  // <21 federally, so relocating to a 21-cap state could work → human review.
  assert.equal(v.verdict, 'requires_review')
  assert.equal(v.state_age_limit, 19)
})

test('evaluateEligibility: 21 in AL → not_eligible (both caps blown)', () => {
  const v = evaluateEligibility({
    lives_in_usa: true, age: 21, state_us: 'AL', suffered_abuse: true,
  })
  assert.equal(v.verdict, 'not_eligible')
})

test('evaluateEligibility: 20 in TX → requires_review (under 21 but over TX cap of 18)', () => {
  const v = evaluateEligibility({
    lives_in_usa: true, age: 20, state_us: 'TX', suffered_abuse: true,
  })
  assert.equal(v.verdict, 'requires_review')
})

test('evaluateEligibility: 22 in FL → not_eligible (federal cap)', () => {
  const v = evaluateEligibility({
    lives_in_usa: true, age: 22, state_us: 'FL', suffered_abuse: true,
  })
  assert.equal(v.verdict, 'not_eligible')
})

test('evaluateEligibility: lives_in_usa=false → not_eligible', () => {
  const v = evaluateEligibility({
    lives_in_usa: false, age: 15, state_us: 'CA', suffered_abuse: true,
  })
  assert.equal(v.verdict, 'not_eligible')
})

test('evaluateEligibility: suffered_abuse=false → not_eligible', () => {
  const v = evaluateEligibility({
    lives_in_usa: true, age: 15, state_us: 'CA', suffered_abuse: false,
  })
  assert.equal(v.verdict, 'not_eligible')
})

test('evaluateEligibility: unknowns → requires_review', () => {
  const v = evaluateEligibility({
    lives_in_usa: true, age: null, state_us: 'NY', suffered_abuse: true,
  })
  assert.equal(v.verdict, 'requires_review')
  assert.ok(v.reasons.some(r => r.includes('age')))
})

// ─── Timezones ──────────────────────────────────────────────────

test('normalizeStateCode: accepts codes and names', () => {
  assert.equal(normalizeStateCode('TX'), 'TX')
  assert.equal(normalizeStateCode('texas'), 'TX')
  assert.equal(normalizeStateCode('California'), 'CA')
  assert.equal(normalizeStateCode('new york'), 'NY')
  assert.equal(normalizeStateCode('xx'), null)
  assert.equal(normalizeStateCode(''), null)
})

test('tzForState: known zones', () => {
  assert.equal(tzForState('NY'), 'America/New_York')
  assert.equal(tzForState('CA'), 'America/Los_Angeles')
  assert.equal(tzForState('TX'), 'America/Chicago')
  assert.equal(tzForState('UT'), 'America/Denver')
  assert.equal(tzForState('AZ'), 'America/Phoenix') // no DST
  assert.equal(tzForState('HI'), 'Pacific/Honolulu')
})

test('STATE_TIMEZONE has 50 states + DC = 51 entries', () => {
  assert.equal(Object.keys(STATE_TIMEZONE).length, 51)
})

// State machine tests live in `tests/e2e/state-machine.spec.ts` via Playwright
// because they transitively import the `@/lib/timezones/us-states` alias which
// only Next.js resolves. Running Playwright is outside this smoke check.
