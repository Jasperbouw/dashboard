import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '../../../../../lib/supabase-server'
import fs from 'fs'
import path from 'path'

const TEMPLATE_PATH = path.join(process.cwd(), 'public', 'templates', 'samenwerkingsovereenkomst-standaard.html')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  const { data, error } = await db
    .from('contractor_contracts')
    .select('*')
    .eq('contractor_id', id)
    .order('generated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const contracts = await Promise.all(
    (data ?? []).map(async (c) => {
      const { data: urlData } = await db.storage
        .from('contractor-documents')
        .createSignedUrl(c.file_path, 3600)
      return { ...c, url: urlData?.signedUrl ?? null }
    }),
  )

  return NextResponse.json(contracts)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = serverClient()

  let body: {
    kvk_nummer?: string
    vestigingsadres?: string
    vertegenwoordiger_naam?: string
    vertegenwoordiger_functie?: string
    commissie_percentage?: number
    datum?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Fetch contractor name
  const { data: contractor } = await db
    .from('contractors')
    .select('name, commission_rate, commission_model')
    .eq('id', id)
    .single()

  if (!contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

  const bedrijfsnaam           = contractor.name
  const commissiePct           = body.commissie_percentage
    ?? (contractor.commission_model === 'percentage' && contractor.commission_rate
        ? Math.round(contractor.commission_rate * 100)
        : 5)
  const kvkNummer              = body.kvk_nummer               ?? ''
  const vestigingsadres        = body.vestigingsadres           ?? ''
  const vertegenwoordigerNaam  = body.vertegenwoordiger_naam    ?? ''
  const vertegenwoordigerFunctie = body.vertegenwoordiger_functie ?? ''
  const datum                  = body.datum ?? new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  let template: string
  try {
    template = fs.readFileSync(TEMPLATE_PATH, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'Template not found' }, { status: 500 })
  }

  const filled = template
    .replace(/\{\{BEDRIJFSNAAM\}\}/g, bedrijfsnaam)
    .replace(/\{\{KVK_NUMMER\}\}/g, kvkNummer)
    .replace(/\{\{VESTIGINGSADRES\}\}/g, vestigingsadres)
    .replace(/\{\{VERTEGENWOORDIGER_NAAM\}\}/g, vertegenwoordigerNaam)
    .replace(/\{\{VERTEGENWOORDIGER_FUNCTIE\}\}/g, vertegenwoordigerFunctie)
    .replace(/\{\{COMMISSIE_PERCENTAGE\}\}/g, String(commissiePct))
    .replace(/\{\{DATUM\}\}/g, datum)

  const iso      = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const filePath = `contractors/${id}/contracts/contract-${iso}.html`

  const { error: storageError } = await db.storage
    .from('contractor-documents')
    .upload(filePath, Buffer.from(filled, 'utf-8'), {
      contentType: 'text/html; charset=utf-8',
      upsert: false,
    })

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  const title = `Samenwerkingsovereenkomst – ${bedrijfsnaam} (${new Date().toLocaleDateString('nl-NL')})`

  const { data: record, error: dbError } = await db
    .from('contractor_contracts')
    .insert({
      contractor_id:             id,
      title,
      file_path:                 filePath,
      kvk_nummer:                kvkNummer || null,
      vestigingsadres:           vestigingsadres || null,
      vertegenwoordiger_naam:    vertegenwoordigerNaam || null,
      vertegenwoordiger_functie: vertegenwoordigerFunctie || null,
      commissie_percentage:      commissiePct,
      datum:                     body.datum ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  const { data: urlData } = await db.storage
    .from('contractor-documents')
    .createSignedUrl(filePath, 3600)

  return NextResponse.json({ ...record, url: urlData?.signedUrl ?? null }, { status: 201 })
}
