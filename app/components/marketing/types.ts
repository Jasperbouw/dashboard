export const CPL_WINNER_THRESHOLD = 12

export interface Winner {
  id:            string
  niche:         string
  image_url:     string
  thumbnail_url: string | null
  overlay_text:  string | null
  notes:         string | null
  spend:         number | null
  impressions:   number | null
  ctr:           number | null
  cpl:           number | null
  leads:         number | null
  is_winner:     boolean
  uploaded_at:   string
  created_at:    string
  updated_at:    string
}

export const MARKETING_NICHES = [
  { value: 'bouw',     label: 'Bouw'     },
  { value: 'daken',    label: 'Daken'    },
  { value: 'dakkapel', label: 'Dakkapel' },
] as const

export const NICHE_ORDER = ['bouw', 'dakkapel', 'daken'] as const

export const NICHE_COLOR: Record<string, { color: string; bg: string }> = {
  bouw:     { color: 'var(--color-info)',    bg: 'var(--color-info-subtle)'    },
  daken:    { color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
  dakkapel: { color: 'var(--color-quote)',   bg: 'var(--color-quote-subtle)'   },
}

export const NICHE_LABEL: Record<string, string> = {
  bouw: 'Bouw', daken: 'Daken', dakkapel: 'Dakkapel',
}
