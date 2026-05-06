export const REJECTION_REASONS = [
  { value: 'boring',          label: 'Saai / geen trigger'           },
  { value: 'off_brand',       label: 'Niet passend bij merk'         },
  { value: 'wrong_text',      label: 'Tekst overlay klopt niet'      },
  { value: 'wrong_niche',     label: 'Verkeerde niche / context'     },
  { value: 'fluff',           label: 'Te vaag / fluff copy'          },
  { value: 'unrealistic',     label: 'Onrealistisch beeld'           },
  { value: 'wrong_overlay',   label: 'Overlay slecht geplaatst'      },
  { value: 'other',           label: 'Anders'                        },
] as const

export type RejectionReason = typeof REJECTION_REASONS[number]['value']
