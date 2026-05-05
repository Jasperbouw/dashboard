import Anthropic from '@anthropic-ai/sdk'

// Lazy factory — reads env var at call time, not at module-load time.
// A module-level singleton captures undefined if the var wasn't present
// at cold-start; that value is then stuck for the lifetime of the module.
export function getAnthropic(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in this environment')
  return new Anthropic({ apiKey: key })
}
