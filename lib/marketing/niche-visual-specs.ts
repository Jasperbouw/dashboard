export interface NicheVisualSpec {
  subject:      string
  must_include: string[]
  forbidden:    string[]
  style:        string
}

export const NICHE_VISUAL_SPECS: Record<string, NicheVisualSpec> = {
  bouw: {
    subject: 'modern Dutch ground-floor extension (aanbouw) attached to back or side of a residential brick house',
    must_include: [
      'the existing brick house clearly visible in frame',
      'the new extension structure showing brick or anthracite cladding',
      'large windows or sliding glass doors as the dominant feature of the extension',
      'flat roof OR slightly sloped modern roof on the extension',
      'Dutch garden setting (tiled patio, lawn, mature trees)',
    ],
    forbidden: [
      'people as the main subject (no portraits, no headshots)',
      'interior shots without exterior context',
      'American-style houses with siding',
      'isolated objects with no architectural context',
      'construction workers as focus (only acceptable as small background element)',
    ],
    style: 'architectural exterior photography, ground-level perspective, Dutch suburban context',
  },

  dakkapel: {
    subject: 'Dutch dormer (dakkapel) — a small box-shaped module sitting ON TOP of an existing sloped tile roof of a brick terraced house',
    must_include: [
      'the existing sloped tile roof of a Dutch terraced house clearly visible',
      'the dakkapel sitting on top of that sloped roof (not replacing it)',
      'the dakkapel has its own SMALL mono-pitched roof clad in anthracite zinc or dark metal, sloping forward at 15–20 degrees',
      'white or anthracite cladding on the sides of the dakkapel',
      'ONE large modern window in the front face of the dakkapel',
      'Dutch street context: row of brick terraced houses (rijtjeshuizen)',
    ],
    forbidden: [
      'the dakkapel replacing the entire roof',
      'any flat-roofed cube without the mono-pitched zinc top',
      'modern extensions (aanbouw) at ground level',
      'American dormers with shingles',
      'the dakkapel without the host house\'s existing sloped tile roof visible around it',
    ],
    style: 'exterior architectural photography focused on roofline, residential Dutch street setting',
  },

  daken: {
    subject: 'complete new roof installation on a Dutch detached or semi-detached brick house',
    must_include: [
      'the full house with its sloped roof clearly visible',
      'the entire roof surface dominant in the frame (not just a corner)',
      'fresh dark grey or anthracite roof tiles (not faded, not old)',
      'Dutch residential context: brick walls, residential garden or street setting',
      'clean roof edges, gutters, and ridge clearly visible',
    ],
    forbidden: [
      'close-ups of hands holding tools or laying individual tiles',
      'workers as main subject',
      'only fragments of roof without house context',
      'interior shots',
      'flat roofs (daken niche is for sloped tile roofs only)',
    ],
    style: 'exterior architectural photography, wide shot showing whole house, Dutch residential setting',
  },
}
