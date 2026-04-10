'use client'

import { useState, useEffect, useCallback } from 'react'
import { dbGet, dbSet, dbSubscribe } from '../../lib/db'

/* ════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════ */
type Question = { id: string; text: string; order: number }

type MeetingAnswer = { questionId: string; answer: string }

type Meeting = {
  id: string
  companyId: string
  date: string          // "YYYY-MM-DD"
  answers: MeetingAnswer[]
  notes: string
}

// Intake checklist — one per company
type IntakeData = {
  companyId: string
  completedAt: string
  regio: string
  ervaringExterneLeads: 'ja' | 'nee' | ''
  ervaringWelke: string
  offerteSnel: string          // bijv. "binnen 24 uur"
  bellendivisie: string        // naam/afdeling verantwoordelijk
  werkzaamheden: string[]      // multi-select
  carVerzekering: 'ja' | 'nee' | 'onbekend' | ''
  aantalAanvragen: string
  salesOndersteuning: 'ja' | 'nee' | 'misschien' | ''
  crmErvaring: 'ja' | 'nee' | ''
  crmWelk: string
  klantprofiel: string
  doorlooptijd: string
  factureringSnelheid: string   // hoe snel factuur na akkoord
  betaaltermijn: string         // bijv. 14 dagen, 30 dagen
  extraNotities: string
}

const WERKZAAMHEDEN_OPTIES = ['Aanbouw', 'Opbouw', 'Renovatie', 'Nieuwbouw', 'Dakkapel', 'Dak', 'Airco', 'Vloeren', 'Schilderwerk']

const EMPTY_INTAKE = (companyId: string): IntakeData => ({
  companyId, completedAt: '',
  regio: '', ervaringExterneLeads: '', ervaringWelke: '',
  offerteSnel: '', bellendivisie: '',
  werkzaamheden: [], carVerzekering: '',
  aantalAanvragen: '', salesOndersteuning: '',
  crmErvaring: '', crmWelk: '',
  klantprofiel: '', doorlooptijd: '', factureringSnelheid: '', betaaltermijn: '', extraNotities: '',
})

type Document = {
  id: string
  title: string
  url: string
  description: string
  category: string
  companyId: string   // '' = algemeen
  addedAt: string
}

type Company = { id: string; name: string; division: string }

type ContractStatus = 'concept' | 'verstuurd' | 'ondertekend'

type ContractData = {
  companyId: string
  // Aannemer details (to fill in)
  aannemerKvk: string
  aannemerAdres: string
  aannemerContactpersoon: string
  // Batch details
  batchOmschrijving: string   // bijv. "10 dakkapel leads, regio Noord-Holland"
  batchPrijs: string          // bijv. "€ 2.500,–"
  // Meta
  status: ContractStatus
  conceptDate: string         // YYYY-MM-DD
  sentDate: string
  signedDate: string
  signedFileData: string      // base64 of signed PDF
  signedFileName: string
  plaats: string
  datum: string               // signing date on document
  customBetalingsregeling: string  // overschrijft standaard art. 4 lid 2 & 3 indien ingevuld
}

type SOP = {
  id: string
  title: string
  category: string
  trigger: string         // wat start het proces objectief?
  outcome: string         // welk concreet, observeerbaar resultaat?
  owner: string           // één persoon verantwoordelijk
  steps: string[]         // herhaalbare volgorde van stappen
  escalation: string      // wanneer is het mislukt, wat gebeurt er dan?
  updatedAt: string
}

type IcpStatus = 'niet gebeld' | 'voicemail' | 'terugbellen' | 'gesprek gehad' | 'geïnteresseerd' | 'niet geïnteresseerd'

type IcpCallLog = {
  id: string
  date: string
  notes: string
  outcome: IcpStatus
}

type ICP = {
  id: string
  bedrijfsnaam: string
  contactpersoon: string
  telefoon: string
  website: string
  regio: string
  type: string
  status: IcpStatus
  callLogs: IcpCallLog[]
  addedAt: string
}

const ICP_STATUSES: IcpStatus[] = ['niet gebeld', 'voicemail', 'terugbellen', 'gesprek gehad', 'geïnteresseerd', 'niet geïnteresseerd']

const ICP_STATUS_COLORS: Record<IcpStatus, { bg: string; color: string; border: string }> = {
  'niet gebeld':       { bg: '#1a1a2e', color: '#4a5568', border: '#252540' },
  'voicemail':         { bg: '#2d1f0a', color: '#f59e0b', border: '#92400e' },
  'terugbellen':       { bg: '#0a1f2d', color: '#38bdf8', border: '#0e4763' },
  'gesprek gehad':     { bg: '#0a2d1f', color: '#10b981', border: '#065f46' },
  'geïnteresseerd':    { bg: '#1a0a2e', color: '#a78bfa', border: '#5b21b6' },
  'niet geïnteresseerd': { bg: '#2d0a0a', color: '#ef4444', border: '#7f1d1d' },
}

const SOP_CATEGORIES = ['Marketing', 'Sales', 'Delivery', 'Finance', 'Decision-making']

const DEFAULT_SOPS: SOP[] = [
  {
    id: 'sop_onboarding',
    title: 'Onboarding nieuwe klant',
    category: 'Delivery',
    trigger: 'Contract is ondertekend én eerste betaling is ontvangen.',
    outcome: 'Klant ontvangt binnen 7 werkdagen de eerste leads op het afgesproken volume. Intake is ingevuld, campagne staat live, lead-flow is getest.',
    owner: 'Jasper van Heyningen',
    steps: [
      'Stuur ontvangstbevestiging binnen 2 uur na betaling — inclusief verwacht startdatum.',
      'Plan intakegesprek in binnen 48 uur (max 45 min) — gebruik intakechecklist in dit dashboard.',
      'Loop tijdens intakegesprek het CRM door met de klant: hoe leads binnenkomen, hoe op te volgen, velden uitleggen — zorg dat dit 100% helder is voor ze.',
      'Verwerk intake: regio, werkzaamheden, doorlooptijd, factuursnelheid vastleggen.',
      'Maak campagnestructuur aan in Meta Ads Manager op basis van intakedata.',
      'Stel targeting in: regio, doelgroep, leadformulier met kwalificatievragen.',
      'Activeer campagne met testbudget (€5-10/dag) — controleer of leadformulier correct doorkomt.',
      'Stuur eerste testlead handmatig door aan klant — bevestig dat ze hem ontvangen hebben.',
      'Schaal naar afgesproken budget zodra lead-flow bevestigd is.',
      'Voeg klant toe in Finance tab met correcte targets en adbudget.',
      'Maak WhatsApp-groep aan met Philip, klant en Jasper — introduceer jezelf kort en bevestig het startpunt.',
    ],
    escalation: 'Als klant na 7 werkdagen nog geen leads heeft ontvangen, of als leadformulier niet correct doorkomt binnen 24 uur na activatie: campagne pauzeren, oorzaak identificeren, klant proactief informeren binnen 2 uur. Founder lost dit zelf op — niet delegeren.',
    updatedAt: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'sop_finance',
    title: 'Financieel beheer — weekly & monthly',
    category: 'Finance',
    trigger: 'Elke zondag (wekelijkse review) of de eerste werkdag van een nieuwe maand (maandafsluiting).',
    outcome: 'Alle commissies en leads zijn verwerkt in het dashboard. Targets zijn actueel. Bij maandafsluiting is een volledig profit-overzicht beschikbaar: inkomsten − kosten = netto winst.',
    owner: 'Jasper van Heyningen',
    steps: [
      '── WEKELIJKS (elke zondag) ──',
      'Open Finance tab → navigeer naar de huidige maand.',
      'Verwerk per actieve klant: ontvangen leads deze week invoeren onder "Leads ontvangen".',
      'Verwerk ontvangen commissiebetalingen onder "Gerealiseerde commissie".',
      'Check of alle klanten op koers liggen t.o.v. hun target — noteer afwijkingen.',
      'Check contractstatus: wie zit boven 80% van het leadstarget en moet hernieuwd worden?',
      'Open AI Agents → Weekly Digest — lees de briefing door en noteer maximaal 1 prioriteit voor de week.',
      '── MAANDAFSLUITING (1e werkdag nieuwe maand) ──',
      'Controleer of alle commissies van de afgelopen maand zijn ingevoerd.',
      'Verwerk alle kosten van de afgelopen maand in het kostenoverzicht (vaste lasten + losse posten).',
      'Bekijk de automatische profit sheet: totale inkomsten − totale kosten = netto winst.',
      'Was de maand boven of onder target? Noteer de oorzaak — niet overslaan.',
      'Stel eventueel nieuwe targets bij voor de nieuwe maand op basis van pipeline.',
    ],
    escalation: 'Als commissie meer dan 7 dagen uitstaat na afgesproken betaaldatum: klant direct aanspreken, niet wachten. Als kosten de inkomsten overstijgen in een maand: direct analyseren welke kostenpost of klant de oorzaak is — niet doorschuiven naar volgende maand.',
    updatedAt: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'sop_decision_making',
    title: 'Decision-making — hoe beslissingen worden genomen',
    category: 'Decision-making',
    trigger: 'Elke situatie waarbij een keuze gemaakt moet worden die invloed heeft op een actieve klant, nieuwe samenwerking, budget, campagne of interne werkwijze.',
    outcome: 'Er is één duidelijke beslissing, eigenaar is bekend, beslissing staat vast en hoeft niet opnieuw besproken te worden. Geen open eindjes.',
    owner: 'Jasper van Heyningen',
    steps: [
      '── STANDAARD: BESLISSING NEMEN ──',
      'Stel de vraag: "Moet hier écht een beslissing worden genomen, of is dit al duidelijk op basis van een bestaand proces?" Als het antwoord ja is op het tweede → uitvoeren, niet bespreken.',
      'Lever de input gestructureerd aan (1-3-1 formaat): (1) Context — wat speelt er en waarom is er een beslissing nodig? (2) Opties — minimaal 2 concrete opties met voor- en nadelen. (3) Aanbeveling — wat stel jij voor en waarom? Lever dit schriftelijk aan via WhatsApp of notitie, niet mondeling.',
      'Beslissing wordt genomen op basis van de aangeleverde input. Als input onvolledig is, gaat hij terug — geen beslissing op halve informatie.',
      'Zodra de beslissing is genomen: vastleggen wie de eigenaar is van de uitvoering en voor wanneer.',
      'Beslissing staat vast. Geen heroverweging tenzij er objectief nieuwe informatie is die er eerder niet was.',
      '── TERUGKERENDE BESLISSINGEN (wekelijks) ──',
      'Maandagmorgen: loop samen de open actiepunten door — max 15 minuten. Welke beslissingen staan nog open? Wie heeft input nodig?',
      'Is een beslissing al twee weken open zonder voortgang? Dan is er een eigenaarsprobleem — direct benoemen en oplossen.',
      '── NIEUWE KLANT ACCEPTEREN ──',
      'Accepteer een nieuwe aannemer alleen als aan alle drie voldaan is: (1) er is capaciteit om leads te leveren op het afgesproken volume, (2) de intake is ingevuld en de klant begrijpt het systeem, (3) het contract is ondertekend én de eerste betaling is ontvangen. Ontbreekt één van de drie → niet starten.',
      '── CAMPAGNE PAUZEREN OF STOPPEN ──',
      'Pauzeer een campagne alleen als: leadkwaliteit structureel slecht is (>3 klachten in 2 weken), of de klant zijn betalingsverplichting niet nakomt. Beslissing hierover altijd binnen 24 uur nemen — niet laten hangen.',
      '── STRUCTUREEL PROBLEEM HERKENNEN ──',
      'Als hetzelfde probleem voor de tweede keer opduikt: stop met het opnieuw oplossen. Stel jezelf de vraag — "wat ontbreekt er in het systeem waardoor dit kan blijven terugkomen?" Pas de SOP of werkwijze aan vóór je verder gaat. Een probleem twee keer oplossen zonder structuurwijziging is een systeemfout, geen pech.',
      '── OPRICHTERS GEDRAGSNORMEN ──',
      'Jasper beslist snel op goede input — geen stilte, geen uitstellen. Als input onduidelijk is: terugsturen met specifieke vraag, niet wachten.',
      'Philip voert uit op basis van heldere opdrachten — geen losse mondelinge afspraken, altijd schriftelijk bevestigd.',
      'Geen van beiden omzeilt een bestaand proces "voor één keer". Uitzonderingen bestaan niet — ze ondermijnen alle andere afspraken.',
    ],
    escalation: 'Als een beslissing langer dan 48 uur openstaat zonder actie: eigenaar benoemen en direct doorpakken, niet opnieuw bespreken. Als Jasper merkt dat hij steeds teruggetrokken wordt in operationele beslissingen die Philip zelf kan nemen: dit is een signaal dat de werkwijze of verantwoordelijkheidsverdeling niet helder genoeg is — de SOP aanpassen, niet harder werken.',
    updatedAt: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'sop_marketing',
    title: 'Marketing — campagnebeheer & leadkwaliteit',
    category: 'Marketing',
    trigger: 'Continu actief voor alle lopende campagnes. Specifiek: elke maandag bij de wekelijkse review, én direct wanneer een vroeg-waarschuwingssignaal zichtbaar is.',
    outcome: 'Elke actieve campagne levert leads op het afgesproken volume en de afgesproken kwaliteit. Afwijkingen zijn zichtbaar vóórdat de klant ze meldt. Er is altijd één eigenaar per campagne die zonder overleg kan ingrijpen.',
    owner: 'Jasper van Heyningen',
    steps: [
      '── WEKELIJKSE CAMPAGNE REVIEW (elke maandag) ──',
      'Open Meta Ads Manager — bekijk per actieve campagne: kosten per lead, volume afgelopen week, leadformulier voltooiingspercentage.',
      'Vergelijk met de afgesproken targets per klant in het Finance-dashboard. Zit een klant onder 70% van het weekvolume? Dan is er een actiesignaal — niet afwachten.',
      'Check klachten: heeft een klant afgelopen week gemeld dat leads slecht waren? Noteer dit per campagne.',
      '── VROEG-WAARSCHUWINGSSIGNALEN (direct handelen) ──',
      'Kosten per lead stijgen meer dan 30% in 3 dagen → targeting of advertentie refreshen.',
      'Leadvolume daalt meer dan 40% t.o.v. vorige week zonder budgetwijziging → campagnestructuur controleren, niet wachten op weekreview.',
      'Klant meldt 2+ slechte leads in één week → leadformulier en kwalificatievragen herzien vóór nieuwe leads doorsturen.',
      'Leadformulier geeft geen notificaties meer → direct testen met handmatige testlead.',
      '── CAMPAGNE OPSCHALEN ──',
      'Schaal alleen op als de afgelopen 7 dagen consistent boven het afgesproken volume zit én de kwaliteitsklachten onder 1 per 10 leads liggen.',
      'Verhoog budget maximaal 20% per stap — nooit verdubbelen in één keer, dit reset de leerfase van Meta.',
      'Na elke opschaling: 48 uur monitoren vóór volgende stap.',
      '── CAMPAGNE AFSCHALEN OF PAUZEREN ──',
      'Pauzeer een campagne alleen als: (1) leadkwaliteit structureel slecht is (>3 klachten in 2 weken), of (2) klant heeft betalingsachterstand. Geen uitzonderingen.',
      'Pauzering altijd binnen 24 uur beslissen — nooit laten hangen.',
      'Klant informeren binnen 2 uur na pauzering met korte uitleg en verwachte hersteldatum.',
      '── NIEUWE CAMPAGNE STARTEN ──',
      'Intake volledig ingevuld? Regio, doelgroep, werkzaamheden, klantprofiel, doorlooptijd — alles vastgelegd.',
      'Advertentie gebouwd op basis van intakedata: specifieke regio, specifieke dienst, kwalificatievragen in leadformulier.',
      'Eerst testbudget (€5-10/dag), testlead handmatig doorgestuurd en bevestigd door klant — dan pas opschalen.',
      '── STRUCTUREEL PROBLEEM ──',
      'Als dezelfde campagnefout of hetzelfde kwaliteitsprobleem een tweede keer voorkomt: niet opnieuw oplossen — de campagnestructuur of het intakeproces aanpassen zodat het structureel opgelost is.',
    ],
    escalation: 'Als een campagne meer dan 5 werkdagen geen leads levert ondanks actief budget: campagne pauzeren, oorzaak identificeren (Meta-probleem, targeting, formulier), klant proactief informeren. Niet afwachten tot de klant belt. Als leadkwaliteitsklachten aanhouden na aanpassing van het formulier: herintake plannen met de klant om doelgroep te herijken.',
    updatedAt: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'sop_sales',
    title: 'Sales — van eerste contact tot ondertekend contract',
    category: 'Sales',
    trigger: 'Zodra een aannemer interesse toont via welk kanaal dan ook: referral, inbound, outreach, beurs of netwerkcontact.',
    outcome: 'Binnen 5 werkdagen na eerste contact is duidelijk of deze aannemer een klant wordt of niet. Er is een getekend contract en een eerste betaling ontvangen, of het contact is bewust afgesloten. Geen open eindjes.',
    owner: 'Jasper van Heyningen',
    steps: [
      '── STAP 1 — KWALIFICATIE (binnen 24 uur na eerste contact) ──',
      'Beantwoord drie vragen vóór je tijd investeert: (1) Heeft deze aannemer voldoende capaciteit om leads op te pakken (actief bedrijf, bereikbaar, responssnel)? (2) Werkt hij in een regio en dienst waar wij leads kunnen leveren? (3) Is er geen bestaande klant in dezelfde regio/niche die dit conflicteert?',
      'Als één antwoord nee is: eerlijk en direct afsluiten. Geen "misschien later". Tijd is schaars.',
      'Als alle drie ja: plan een kennismakingsgesprek in, max 20 minuten, binnen 48 uur.',
      '── STAP 2 — KENNISMAKINGSGESPREK (max 20 min) ──',
      'Doel van dit gesprek: begrijpen wat zij nodig hebben én beslissen of wij de juiste partij zijn. Niet pitchen — luisteren.',
      'Stel minimaal: hoeveel opdrachten kunnen ze per maand aan? Hoe snel bellen ze een lead terug? Hebben ze ervaring met externe leads? Hoe verloopt hun facturatie?',
      'Aan het einde van het gesprek: of je maakt een concreet voorstel (volume, prijs, startdatum), of je sluit af. Geen "ik stuur je iets op en we kijken". Beslissing in het gesprek.',
      '── STAP 3 — VOORSTEL & CONTRACT (binnen 24 uur na gesprek) ──',
      'Stuur het voorstel binnen 24 uur na het gesprek. Niet na 3 dagen. Als je het niet snel stuurt, was het geen prioriteit — en zo ziet de aannemer het ook.',
      'Voorstel bevat: leadvolume per maand, regio, type leads, vergoeding (5%), betalingsmoment, opzegtermijn (geen).',
      'Gebruik het standaardcontract in het Contracten-tabblad. Vul alle velden in vóór je verstuurt — geen lege velden.',
      'Stuur contract via e-mail of WhatsApp met een korte begeleidende tekst. Vraag om bevestiging van ontvangst.',
      '── STAP 4 — OPVOLGING (als geen reactie binnen 48 uur) ──',
      'Eén follow-up na 48 uur stilte — kort, direct, geen druk. Vraag of er vragen zijn of dat ze er nog naar kijken.',
      'Geen reactie na tweede contact? Dan is het antwoord nee. Afsluiten, niet blijven achtervolgen.',
      'Als er twijfel is over de prijs of voorwaarden: niet onderhandelen op de 5%. De vergoeding is niet onderhandelbaar. Je kunt wel flexibel zijn op volume of startdatum.',
      '── STAP 5 — AKKOORD & START ──',
      'Contract ondertekend én eerste betaling ontvangen? Dan en alleen dan start de onboarding (zie Onboarding SOP).',
      'Voeg de klant toe in het Finance-dashboard met correcte targets en adbudget.',
      'Zet de campagne klaar maar activeer hem pas na voltooide intake.',
      '── STANDAARD: WAT NIET WERKT ──',
      'Mondeling akkoord zonder contract = geen akkoord. Niet starten.',
      'Aannemer vraagt om "eerst een paar gratis testleads" → dit is geen samenwerking. Niet op ingaan.',
      'Als je een klant accepteert die niet door de kwalificatie komt "omdat hij vriendelijk is", is dat een systeemdoorbraak — niet een uitzondering.',
    ],
    escalation: 'Als een salesgesprek langer dan 5 werkdagen open staat zonder beslissing: afsluiten. Een prospect die niet beslist, is een nee. Als er twijfel is of een aannemer kwalitatief goed genoeg is: liever één klant minder dan één klant die later klachten geeft of niet betaalt. Bij twijfel: niet accepteren.',
    updatedAt: new Date().toISOString().slice(0, 10),
  },
]

/* ════════════════════════════════════════════════════════
   DEFAULTS
════════════════════════════════════════════════════════ */
const DEFAULT_QUESTIONS: Question[] = [
  { id: 'q1',  order: 1,  text: 'Hoeveel leads hebben ze ontvangen afgelopen periode?' },
  { id: 'q2',  order: 2,  text: 'Wat is de conversieratio van lead naar offerte?' },
  { id: 'q3',  order: 3,  text: 'Wat is de gemiddelde projectwaarde?' },
  { id: 'q4',  order: 4,  text: 'Zijn er klachten over leadkwaliteit?' },
  { id: 'q5',  order: 5,  text: 'Worden leads snel genoeg opgevolgd (<1 uur)?' },
  { id: 'q6',  order: 6,  text: 'Hoeveel projecten zijn er gewonnen uit onze leads?' },
  { id: 'q7',  order: 7,  text: 'Zijn ze tevreden met de huidige targeting/regio?' },
  { id: 'q8',  order: 8,  text: 'Willen ze het volume verhogen of verlagen?' },
  { id: 'q9',  order: 9,  text: 'Zijn er nieuwe diensten of specialisaties te toevoegen?' },
  { id: 'q10', order: 10, text: 'Hoe verloopt de facturatie en betaling?' },
  { id: 'q11', order: 11, text: 'Zijn ze actief op andere leadplatforms?' },
  { id: 'q12', order: 12, text: 'Wat zijn hun plannen voor de komende 3 maanden?' },
]

const DOC_CATEGORIES = ['Contract', 'Offerte', 'Strategie', 'Rapportage', 'Overig']

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */
const CARD = { background: '#111118', border: '1px solid #1a1a2e', borderRadius: 12, padding: '16px 20px' } as const
const INPUT = { width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, background: '#0a0a0f', border: '1px solid #252540', color: '#e2e8f0', outline: 'none' } as const
const LABEL = { fontSize: 11, color: '#4a5568', marginBottom: 4, display: 'block' as const }

function today() {
  return new Date().toISOString().slice(0, 10)
}
function fmtDate(d: string) {
  const [y, m, dd] = d.split('-')
  return `${dd}-${m}-${y}`
}

/* ════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════ */
export default function DocsTab() {
  const [sub, setSub] = useState<'intake' | 'evaluatie' | 'sops' | 'contracten' | 'icps'>('intake')
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [intakes, setIntakes] = useState<Record<string, IntakeData>>({})
  const [documents, setDocuments] = useState<Document[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [icps, setIcps] = useState<ICP[]>([])

  // Shared state
  const [selectedCompany, setSelectedCompany] = useState<string>('')

  // Evaluatie state
  const [meetingModal, setMeetingModal] = useState<Meeting | null>(null)
  const [editingQ, setEditingQ] = useState<string | null>(null)
  const [editQText, setEditQText] = useState('')
  const [showQEditor, setShowQEditor] = useState(false)
  const [newQText, setNewQText] = useState('')

  // Intake state
  const [intakeModal, setIntakeModal] = useState<IntakeData | null>(null)

  // Docs state
  const [docModal, setDocModal] = useState<Partial<Document> | null>(null)

  // Contracts state
  const [contracts, setContracts] = useState<Record<string, ContractData>>({})
  const [contractModal, setContractModal] = useState<ContractData | null>(null)

  // SOPs state
  const [sops, setSops] = useState<SOP[]>([])
  const [sopModal, setSopModal] = useState<Partial<SOP> & { stepDraft?: string } | null>(null)

  /* ── Load ── */
  useEffect(() => {
    async function load() {
      try {
        const q = await dbGet('bouwcheck_questions')
        if (q) setQuestions(q)
        const m = await dbGet('bouwcheck_meetings')
        if (m) setMeetings(m)
        const i = await dbGet('bouwcheck_intakes')
        if (i) setIntakes(i)
        const d = await dbGet('bouwcheck_documents')
        if (d) setDocuments(d)
        const s = await dbGet('bouwcheck_sops')
        setSops(s ?? DEFAULT_SOPS)
        const ct = await dbGet('bouwcheck_contracts')
        if (ct) setContracts(ct)
        const c = await dbGet('bouwcheck_companies_v3')
        if (c) setCompanies(c)
        const ip = await dbGet('bouwcheck_icps')
        if (ip) setIcps(ip)
      } catch {}
    }
    load()

    // ── Realtime sync ──
    const channel = dbSubscribe(
      ['bouwcheck_questions', 'bouwcheck_meetings', 'bouwcheck_intakes',
       'bouwcheck_documents', 'bouwcheck_sops', 'bouwcheck_contracts', 'bouwcheck_companies_v3', 'bouwcheck_icps'],
      (key, value) => {
        if (key === 'bouwcheck_questions') setQuestions(value)
        if (key === 'bouwcheck_meetings') setMeetings(value)
        if (key === 'bouwcheck_intakes') setIntakes(value)
        if (key === 'bouwcheck_documents') setDocuments(value)
        if (key === 'bouwcheck_sops') setSops(value)
        if (key === 'bouwcheck_contracts') setContracts(value)
        if (key === 'bouwcheck_companies_v3') setCompanies(value)
        if (key === 'bouwcheck_icps') setIcps(value)
      }
    )
    return () => { channel.unsubscribe() }
  }, [])

  const saveQuestions = useCallback((next: Question[]) => {
    setQuestions(next)
    dbSet('bouwcheck_questions', next)
  }, [])
  const saveMeetings = useCallback((next: Meeting[]) => {
    setMeetings(next)
    dbSet('bouwcheck_meetings', next)
  }, [])
  const saveIntakes = useCallback((next: Record<string, IntakeData>) => {
    setIntakes(next)
    dbSet('bouwcheck_intakes', next)
  }, [])
  const saveDocuments = useCallback((next: Document[]) => {
    setDocuments(next)
    dbSet('bouwcheck_documents', next)
  }, [])
  const saveSops = useCallback((next: SOP[]) => {
    setSops(next)
    dbSet('bouwcheck_sops', next)
  }, [])
  const saveContracts = useCallback((next: Record<string, ContractData>) => {
    setContracts(next)
    dbSet('bouwcheck_contracts', next)
  }, [])
  const saveIcps = useCallback((next: ICP[]) => {
    setIcps(next)
    dbSet('bouwcheck_icps', next)
  }, [])

  /* ── Intake ── */
  const openIntake = (companyId: string) => {
    setIntakeModal(intakes[companyId] ? { ...intakes[companyId] } : EMPTY_INTAKE(companyId))
  }
  const submitIntake = () => {
    if (!intakeModal) return
    const next = { ...intakes, [intakeModal.companyId]: { ...intakeModal, completedAt: today() } }
    saveIntakes(next)
    setIntakeModal(null)
  }

  /* ── New evaluatie meeting ── */
  const startMeeting = (companyId: string) => {
    setMeetingModal({
      id: Date.now().toString(),
      companyId,
      date: today(),
      answers: questions.map(q => ({ questionId: q.id, answer: '' })),
      notes: '',
    })
  }

  const submitMeeting = () => {
    if (!meetingModal) return
    saveMeetings([...meetings, meetingModal])
    setMeetingModal(null)
  }

  /* ── Question editor ── */
  const saveQEdit = (id: string) => {
    saveQuestions(questions.map(q => q.id === id ? { ...q, text: editQText } : q))
    setEditingQ(null)
  }
  const addQuestion = () => {
    if (!newQText.trim()) return
    const next: Question = { id: Date.now().toString(), text: newQText.trim(), order: questions.length + 1 }
    saveQuestions([...questions, next])
    setNewQText('')
  }
  const removeQuestion = (id: string) => {
    saveQuestions(questions.filter(q => q.id !== id))
  }

  /* ── Document modal ── */
  const submitDoc = () => {
    if (!docModal?.title) return
    const doc: Document = {
      id: docModal.id ?? Date.now().toString(),
      title: docModal.title,
      url: docModal.url ?? '',
      description: docModal.description ?? '',
      category: docModal.category ?? 'Overig',
      companyId: docModal.companyId ?? '',
      addedAt: today(),
    }
    if (docModal.id) {
      saveDocuments(documents.map(d => d.id === docModal.id ? doc : d))
    } else {
      saveDocuments([...documents, doc])
    }
    setDocModal(null)
  }

  const companyMeetings = (cId: string) => meetings.filter(m => m.companyId === cId).sort((a, b) => b.date.localeCompare(a.date))

  const submitSop = () => {
    if (!sopModal?.title) return
    const sop: SOP = {
      id: sopModal.id ?? Date.now().toString(),
      title: sopModal.title,
      category: sopModal.category ?? 'Delivery',
      trigger: sopModal.trigger ?? '',
      outcome: sopModal.outcome ?? '',
      owner: sopModal.owner ?? '',
      steps: sopModal.steps ?? [],
      escalation: sopModal.escalation ?? '',
      updatedAt: today(),
    }
    if (sopModal.id) {
      saveSops(sops.map(s => s.id === sopModal.id ? sop : s))
    } else {
      saveSops([...sops, sop])
    }
    setSopModal(null)
  }

  return (
    <div>
      {/* Header + sub-nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Docs & Checklist</h1>
          <p style={{ fontSize: 12, color: '#4a5568', marginTop: 4 }}>Meeting checklists per bedrijf & belangrijke documenten</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['intake', 'Intake'], ['evaluatie', 'Evaluatie'], ['sops', "SOP's"], ['contracten', 'Contracten'], ['icps', 'ICP\'s']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setSub(id)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: sub === id ? '#6366f120' : 'transparent',
                border: `1px solid ${sub === id ? '#6366f1' : '#1a1a2e'}`,
                color: sub === id ? '#6366f1' : '#4a5568',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {sub === 'intake' && (
        <IntakeSub
          companies={companies}
          intakes={intakes}
          selectedCompany={selectedCompany}
          setSelectedCompany={setSelectedCompany}
          onOpen={openIntake}
        />
      )}

      {sub === 'evaluatie' && (
        <EvaluatieSub
          companies={companies} questions={questions} meetings={meetings}
          selectedCompany={selectedCompany} setSelectedCompany={setSelectedCompany}
          showQEditor={showQEditor} setShowQEditor={setShowQEditor}
          editingQ={editingQ} setEditingQ={setEditingQ}
          editQText={editQText} setEditQText={setEditQText}
          newQText={newQText} setNewQText={setNewQText}
          onStartMeeting={startMeeting}
          onSaveQEdit={saveQEdit}
          onAddQuestion={addQuestion}
          onRemoveQuestion={removeQuestion}
          companyMeetings={companyMeetings}
        />
      )}

      {sub === 'sops' && (
        <SopsSub
          sops={sops}
          onAdd={() => setSopModal({ category: 'Overig', steps: [] })}
          onEdit={s => setSopModal({ ...s })}
          onDelete={id => saveSops(sops.filter(s => s.id !== id))}
        />
      )}

      {sub === 'icps' && (
        <IcpSub
          icps={icps}
          onSave={saveIcps}
        />
      )}

      {sub === 'contracten' && (
        <ContractenSub
          companies={companies}
          contracts={contracts}
          onOpen={c => {
            const existing = contracts[c.id]
            setContractModal(existing ?? {
              companyId: c.id,
              aannemerKvk: '', aannemerAdres: '', aannemerContactpersoon: '',
              batchOmschrijving: '', batchPrijs: '',
              status: 'concept',
              conceptDate: today(), sentDate: '', signedDate: '',
              signedFileData: '', signedFileName: '',
              plaats: '', datum: '',
              customBetalingsregeling: '',
            })
          }}
          onUpdateStatus={(cId, status) => {
            const next = { ...contracts, [cId]: { ...contracts[cId], status, ...(status === 'verstuurd' ? { sentDate: today() } : status === 'ondertekend' ? { signedDate: today() } : {}) } }
            saveContracts(next)
          }}
        />
      )}

      {/* Contract modal */}
      {contractModal && (
        <ContractModal
          contract={contractModal}
          companyName={companies.find(c => c.id === contractModal.companyId)?.name ?? ''}
          onChange={setContractModal}
          onSave={() => {
            const next = { ...contracts, [contractModal.companyId]: contractModal }
            saveContracts(next)
            setContractModal(null)
          }}
          onClose={() => setContractModal(null)}
        />
      )}

      {/* Intake modal */}
      {intakeModal && (
        <Modal onClose={() => setIntakeModal(null)} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                Intake — {companies.find(c => c.id === intakeModal.companyId)?.name}
              </h2>
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>Intakegesprek checklist</div>
            </div>
            <button onClick={() => setIntakeModal(null)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* 1. Regio */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>1. Regio / werkgebied</label>
              <input style={INPUT} placeholder="bijv. Noord-Holland, Utrecht, landelijk..." value={intakeModal.regio}
                onChange={e => setIntakeModal(m => m && { ...m, regio: e.target.value })} />
            </div>

            {/* 2. Werkzaamheden */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>2. Werkzaamheden (meerdere mogelijk)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WERKZAAMHEDEN_OPTIES.map(opt => {
                  const checked = intakeModal.werkzaamheden.includes(opt)
                  return (
                    <button key={opt} onClick={() => {
                      const next = checked
                        ? intakeModal.werkzaamheden.filter(w => w !== opt)
                        : [...intakeModal.werkzaamheden, opt]
                      setIntakeModal(m => m && { ...m, werkzaamheden: next })
                    }}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                        background: checked ? '#6366f1' : 'transparent',
                        border: `1px solid ${checked ? '#6366f1' : '#252540'}`,
                        color: checked ? '#fff' : '#4a5568',
                      }}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. Ervaring externe leads */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>3. Ervaring met externe leads?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['ja', 'nee'] as const).map(v => (
                  <button key={v} onClick={() => setIntakeModal(m => m && { ...m, ervaringExterneLeads: v })}
                    style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      background: intakeModal.ervaringExterneLeads === v ? '#6366f1' : 'transparent',
                      border: `1px solid ${intakeModal.ervaringExterneLeads === v ? '#6366f1' : '#252540'}`,
                      color: intakeModal.ervaringExterneLeads === v ? '#fff' : '#4a5568' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Welke platforms */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>Zo ja, welke platforms?</label>
              <input style={INPUT} placeholder="bijv. Werkspot, Offertes.nl..." value={intakeModal.ervaringWelke}
                disabled={intakeModal.ervaringExterneLeads !== 'ja'}
                onChange={e => setIntakeModal(m => m && { ...m, ervaringWelke: e.target.value })} />
            </div>

            {/* 4. Hoeveel aanvragen */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>4. Hoeveel aanvragen willen ze ontvangen?</label>
              <input style={INPUT} placeholder="bijv. 10-15 per maand" value={intakeModal.aantalAanvragen}
                onChange={e => setIntakeModal(m => m && { ...m, aantalAanvragen: e.target.value })} />
            </div>

            {/* 5. Snelheid offerte */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>5. Hoe snel offerte na inspectie?</label>
              <input style={INPUT} placeholder="bijv. binnen 24 uur, zelfde dag..." value={intakeModal.offerteSnel}
                onChange={e => setIntakeModal(m => m && { ...m, offerteSnel: e.target.value })} />
            </div>

            {/* 6. Verantwoordelijk bellen */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>6. Wie belt de leads? (divisie / naam)</label>
              <input style={INPUT} placeholder="bijv. Binnendienst, Jan de Vries..." value={intakeModal.bellendivisie}
                onChange={e => setIntakeModal(m => m && { ...m, bellendivisie: e.target.value })} />
            </div>

            {/* 7. Doorlooptijd */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>7. Doorlooptijd akkoord → uitvoering</label>
              <input style={INPUT} placeholder="bijv. 2-4 weken, direct..." value={intakeModal.doorlooptijd}
                onChange={e => setIntakeModal(m => m && { ...m, doorlooptijd: e.target.value })} />
            </div>

            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>8. Hoe snel factureren na akkoord?</label>
              <input style={INPUT} placeholder="bijv. dezelfde dag, binnen 48 uur..." value={intakeModal.factureringSnelheid}
                onChange={e => setIntakeModal(m => m && { ...m, factureringSnelheid: e.target.value })} />
            </div>

            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>9. Betaaltermijn</label>
              <input style={INPUT} placeholder="bijv. 14 dagen, 30 dagen..." value={intakeModal.betaaltermijn}
                onChange={e => setIntakeModal(m => m && { ...m, betaaltermijn: e.target.value })} />
            </div>

            {/* 8. CAR verzekering */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>8. CAR verzekering?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['ja', 'nee', 'onbekend'] as const).map(v => (
                  <button key={v} onClick={() => setIntakeModal(m => m && { ...m, carVerzekering: v })}
                    style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      background: intakeModal.carVerzekering === v ? '#6366f1' : 'transparent',
                      border: `1px solid ${intakeModal.carVerzekering === v ? '#6366f1' : '#252540'}`,
                      color: intakeModal.carVerzekering === v ? '#fff' : '#4a5568' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* 9. Sales ondersteuning */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>9. Ondersteuning in sales gewenst?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['ja', 'nee', 'misschien'] as const).map(v => (
                  <button key={v} onClick={() => setIntakeModal(m => m && { ...m, salesOndersteuning: v })}
                    style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      background: intakeModal.salesOndersteuning === v ? '#6366f1' : 'transparent',
                      border: `1px solid ${intakeModal.salesOndersteuning === v ? '#6366f1' : '#252540'}`,
                      color: intakeModal.salesOndersteuning === v ? '#fff' : '#4a5568' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* 10. CRM ervaring */}
            <div>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>10. Ervaring met CRM systeem?</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {(['ja', 'nee'] as const).map(v => (
                  <button key={v} onClick={() => setIntakeModal(m => m && { ...m, crmErvaring: v })}
                    style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      background: intakeModal.crmErvaring === v ? '#6366f1' : 'transparent',
                      border: `1px solid ${intakeModal.crmErvaring === v ? '#6366f1' : '#252540'}`,
                      color: intakeModal.crmErvaring === v ? '#fff' : '#4a5568' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              <input style={INPUT} placeholder="Welk systeem? bijv. HubSpot, Salesforce..." value={intakeModal.crmWelk}
                disabled={intakeModal.crmErvaring !== 'ja'}
                onChange={e => setIntakeModal(m => m && { ...m, crmWelk: e.target.value })} />
            </div>

            {/* 11. Klantprofiel */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>11. Voorkeur klantprofiel</label>
              <textarea rows={2} style={{ ...INPUT, resize: 'vertical', fontSize: 12 }}
                placeholder="bijv. particulieren met woning 10+ jaar oud, regio Amsterdam, budget €50k+..."
                value={intakeModal.klantprofiel}
                onChange={e => setIntakeModal(m => m && { ...m, klantprofiel: e.target.value })} />
            </div>

            {/* Extra notities */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>Overige notities / afspraken</label>
              <textarea rows={2} style={{ ...INPUT, resize: 'vertical', fontSize: 12 }}
                placeholder="Aanvullende opmerkingen, afspraken, aandachtspunten..."
                value={intakeModal.extraNotities}
                onChange={e => setIntakeModal(m => m && { ...m, extraNotities: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button onClick={() => setIntakeModal(null)}
              style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #252540', borderRadius: 8, color: '#8896a8', fontSize: 13, cursor: 'pointer' }}>
              Annuleren
            </button>
            <button onClick={submitIntake}
              style={{ padding: '9px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Intake opslaan
            </button>
          </div>
        </Modal>
      )}

      {/* Evaluatie meeting modal */}
      {meetingModal && (
        <Modal onClose={() => setMeetingModal(null)} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                Meeting — {companies.find(c => c.id === meetingModal.companyId)?.name}
              </h2>
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>Vul de antwoorden in tijdens of na de meeting</div>
            </div>
            <button onClick={() => setMeetingModal(null)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          {/* Date */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#4a5568', whiteSpace: 'nowrap' }}>Datum meeting:</label>
            <input type="date" value={meetingModal.date}
              onChange={e => setMeetingModal(m => m && { ...m, date: e.target.value })}
              style={{ ...INPUT, width: 160 }} />
          </div>

          {/* Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            {questions.map((q, i) => {
              const ans = meetingModal.answers.find(a => a.questionId === q.id)?.answer ?? ''
              return (
                <div key={q.id}>
                  <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>
                    <span style={{ color: '#374151', marginRight: 6 }}>{i + 1}.</span>{q.text}
                  </label>
                  <textarea
                    value={ans}
                    onChange={e => {
                      const val = e.target.value
                      setMeetingModal(m => {
                        if (!m) return m
                        const answers = m.answers.some(a => a.questionId === q.id)
                          ? m.answers.map(a => a.questionId === q.id ? { ...a, answer: val } : a)
                          : [...m.answers, { questionId: q.id, answer: val }]
                        return { ...m, answers }
                      })
                    }}
                    rows={2}
                    placeholder="Antwoord..."
                    style={{ ...INPUT, resize: 'vertical', fontSize: 12 }}
                  />
                </div>
              )
            })}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...LABEL, fontSize: 12, color: '#8896a8' }}>Algemene notities / actiepunten</label>
            <textarea value={meetingModal.notes} rows={3} placeholder="Actiepunten, afspraken, follow-up..."
              onChange={e => setMeetingModal(m => m && { ...m, notes: e.target.value })}
              style={{ ...INPUT, resize: 'vertical', fontSize: 12 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setMeetingModal(null)}
              style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #252540', borderRadius: 8, color: '#8896a8', fontSize: 13, cursor: 'pointer' }}>
              Annuleren
            </button>
            <button onClick={submitMeeting}
              style={{ padding: '9px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Meeting opslaan
            </button>
          </div>
        </Modal>
      )}

      {/* Doc modal */}
      {docModal !== null && (
        <Modal onClose={() => setDocModal(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              {docModal.id ? 'Document bewerken' : 'Document toevoegen'}
            </h2>
            <button onClick={() => setDocModal(null)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL}>Titel</label>
              <input style={INPUT} value={docModal.title ?? ''}
                onChange={e => setDocModal(d => d && { ...d, title: e.target.value })} />
            </div>
            <div>
              <label style={LABEL}>Categorie</label>
              <select style={INPUT} value={docModal.category ?? 'Overig'}
                onChange={e => setDocModal(d => d && { ...d, category: e.target.value })}>
                {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Bedrijf (optioneel)</label>
              <select style={INPUT} value={docModal.companyId ?? ''}
                onChange={e => setDocModal(d => d && { ...d, companyId: e.target.value })}>
                <option value=''>— Algemeen (niet gekoppeld) —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>URL / link (optioneel)</label>
              <input style={INPUT} value={docModal.url ?? ''} placeholder="https://..."
                onChange={e => setDocModal(d => d && { ...d, url: e.target.value })} />
            </div>
            <div>
              <label style={LABEL}>Omschrijving</label>
              <textarea rows={3} style={{ ...INPUT, resize: 'vertical' }} value={docModal.description ?? ''}
                onChange={e => setDocModal(d => d && { ...d, description: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={() => setDocModal(null)}
              style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #252540', borderRadius: 8, color: '#8896a8', fontSize: 13, cursor: 'pointer' }}>
              Annuleren
            </button>
            <button onClick={submitDoc} disabled={!docModal.title?.trim()}
              style={{ padding: '9px 20px', background: docModal.title?.trim() ? '#6366f1' : '#252540', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Opslaan
            </button>
          </div>
        </Modal>
      )}

      {/* SOP modal */}
      {sopModal !== null && (
        <Modal onClose={() => setSopModal(null)} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              {sopModal.id ? 'SOP bewerken' : 'Nieuwe SOP'}
            </h2>
            <button onClick={() => setSopModal(null)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Title + category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
              <div>
                <label style={LABEL}>Titel</label>
                <input style={INPUT} placeholder="bijv. Onboarding nieuwe klant" value={sopModal.title ?? ''}
                  onChange={e => setSopModal(m => m && { ...m, title: e.target.value })} />
              </div>
              <div>
                <label style={LABEL}>Categorie</label>
                <select style={INPUT} value={sopModal.category ?? 'Delivery'}
                  onChange={e => setSopModal(m => m && { ...m, category: e.target.value })}>
                  {SOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* 5 Criteria */}
            <div style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: 2 }}>DE 5 CRITERIA</div>

              <div>
                <label style={{ ...LABEL, color: '#8896a8' }}>1. Trigger — wat start het proces objectief?</label>
                <input style={INPUT} placeholder="bijv. Contract ondertekend én betaling ontvangen"
                  value={sopModal.trigger ?? ''}
                  onChange={e => setSopModal(m => m && { ...m, trigger: e.target.value })} />
              </div>
              <div>
                <label style={{ ...LABEL, color: '#8896a8' }}>2. Outcome — welk concreet, observeerbaar resultaat?</label>
                <input style={INPUT} placeholder="bijv. Klant ontvangt eerste leads binnen 7 werkdagen"
                  value={sopModal.outcome ?? ''}
                  onChange={e => setSopModal(m => m && { ...m, outcome: e.target.value })} />
              </div>
              <div>
                <label style={{ ...LABEL, color: '#8896a8' }}>3. Owner — één persoon verantwoordelijk</label>
                <input style={INPUT} placeholder="bijv. Jasper van Heyningen"
                  value={sopModal.owner ?? ''}
                  onChange={e => setSopModal(m => m && { ...m, owner: e.target.value })} />
              </div>
            </div>

            {/* Steps */}
            <div>
              <label style={LABEL}>4. Stappen — herhaalbare volgorde</label>
              {(sopModal.steps ?? []).map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#4a5568', minWidth: 20 }}>{i + 1}.</span>
                  <input style={{ ...INPUT, flex: 1 }} value={step}
                    onChange={e => setSopModal(m => {
                      if (!m) return m
                      const steps = [...(m.steps ?? [])]
                      steps[i] = e.target.value
                      return { ...m, steps }
                    })} />
                  <button onClick={() => setSopModal(m => m && { ...m, steps: (m.steps ?? []).filter((_, j) => j !== i) })}
                    style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input style={{ ...INPUT, flex: 1 }} placeholder="Nieuwe stap — druk Enter om toe te voegen"
                  value={sopModal.stepDraft ?? ''}
                  onChange={e => setSopModal(m => m && { ...m, stepDraft: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && sopModal.stepDraft?.trim()) {
                      setSopModal(m => m && { ...m, steps: [...(m.steps ?? []), m.stepDraft!.trim()], stepDraft: '' })
                    }
                  }} />
                <button
                  onClick={() => { if (sopModal.stepDraft?.trim()) setSopModal(m => m && { ...m, steps: [...(m.steps ?? []), m.stepDraft!.trim()], stepDraft: '' }) }}
                  style={{ padding: '8px 14px', background: '#252540', border: 'none', borderRadius: 8, color: '#e2e8f0', fontSize: 13, cursor: 'pointer' }}>
                  + Voeg toe
                </button>
              </div>
            </div>

            {/* Escalation */}
            <div>
              <label style={LABEL}>5. Escalatie — wanneer is het mislukt en wat gebeurt er dan?</label>
              <textarea rows={2} style={{ ...INPUT, resize: 'vertical' }}
                placeholder="bijv. Als na 7 werkdagen geen leads → campagne pauzeren, klant informeren binnen 2 uur, founder lost op"
                value={sopModal.escalation ?? ''}
                onChange={e => setSopModal(m => m && { ...m, escalation: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setSopModal(null)}
                style={{ padding: '9px 20px', background: 'transparent', border: '1px solid #252540', borderRadius: 8, color: '#718096', fontSize: 13, cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={submitSop} disabled={!sopModal.title?.trim()}
                style={{ padding: '9px 20px', background: sopModal.title?.trim() ? '#6366f1' : '#252540', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   SOPS SUB-TAB
════════════════════════════════════════════════════════ */
function SopsSub({ sops, onAdd, onEdit, onDelete }: {
  sops: SOP[]
  onAdd: () => void
  onEdit: (s: SOP) => void
  onDelete: (id: string) => void
}) {
  const [filter, setFilter] = useState('Alle')
  const categories = ['Alle', ...SOP_CATEGORIES]
  const visible = filter === 'Alle' ? sops : sops.filter(s => s.category === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: filter === c ? '#6366f120' : 'transparent',
                border: `1px solid ${filter === c ? '#6366f1' : '#1a1a2e'}`,
                color: filter === c ? '#6366f1' : '#4a5568',
              }}>{c}</button>
          ))}
        </div>
        <button onClick={onAdd}
          style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nieuwe SOP
        </button>
      </div>

      {visible.length === 0 && (
        <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
          <div style={{ color: '#4a5568', fontSize: 13 }}>Nog geen SOP's aangemaakt.</div>
          <div style={{ color: '#2d3748', fontSize: 12, marginTop: 4 }}>Klik op "+ Nieuwe SOP" om te beginnen.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visible.map(sop => (
          <div key={sop.id} style={{ ...CARD }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{sop.title}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#6366f115', color: '#6366f1', border: '1px solid #6366f130' }}>{sop.category}</span>
                  {sop.owner && <span style={{ fontSize: 10, color: '#4a5568' }}>Owner: {sop.owner}</span>}
                  <span style={{ fontSize: 10, color: '#2d3748' }}>bijgewerkt {fmtDate(sop.updatedAt)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onEdit(sop)}
                  style={{ padding: '6px 12px', background: '#1a1a2e', border: '1px solid #252540', borderRadius: 6, color: '#a0aec0', fontSize: 12, cursor: 'pointer' }}>
                  Bewerken
                </button>
                <button onClick={() => { if (confirm(`"${sop.title}" verwijderen?`)) onDelete(sop.id) }}
                  style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #2d1515', borderRadius: 6, color: '#7f1d1d', fontSize: 12, cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Trigger + Outcome */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {sop.trigger && (
                <div style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', letterSpacing: 1.5, marginBottom: 4 }}>TRIGGER</div>
                  <div style={{ fontSize: 12, color: '#a0aec0', lineHeight: 1.5 }}>{sop.trigger}</div>
                </div>
              )}
              {sop.outcome && (
                <div style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', letterSpacing: 1.5, marginBottom: 4 }}>OUTCOME</div>
                  <div style={{ fontSize: 12, color: '#a0aec0', lineHeight: 1.5 }}>{sop.outcome}</div>
                </div>
              )}
            </div>

            {/* Steps */}
            {sop.steps.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', letterSpacing: 1.5, marginBottom: 8 }}>STAPPEN</div>
                <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {sop.steps.map((step, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#8896a8', lineHeight: 1.5 }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Escalation */}
            {sop.escalation && (
              <div style={{ background: '#1a0a0a', border: '1px solid #3d1515', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: 1.5, marginBottom: 4 }}>ESCALATIE</div>
                <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{sop.escalation}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   CONTRACTEN SUB-TAB
════════════════════════════════════════════════════════ */
const STATUS_LABELS: Record<ContractStatus, { label: string; color: string }> = {
  concept:     { label: 'Concept',     color: '#f59e0b' },
  verstuurd:   { label: 'Verstuurd',   color: '#38bdf8' },
  ondertekend: { label: 'Ondertekend', color: '#10b981' },
}

function ContractenSub({ companies, contracts, onOpen, onUpdateStatus }: {
  companies: Company[]
  contracts: Record<string, ContractData>
  onOpen: (c: Company) => void
  onUpdateStatus: (cId: string, status: ContractStatus) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {companies.length === 0 && (
        <div style={{ ...CARD, textAlign: 'center', padding: 40, color: '#4a5568', fontSize: 13 }}>
          Geen bedrijven — voeg ze toe in Finance.
        </div>
      )}
      {companies.map(c => {
        const ct = contracts[c.id]
        const st = ct ? STATUS_LABELS[ct.status] : null
        return (
          <div key={c.id} style={{ ...CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{c.name}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 5, alignItems: 'center' }}>
                {st ? (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: st.color + '15', color: st.color, border: `1px solid ${st.color}30` }}>{st.label}</span>
                ) : (
                  <span style={{ fontSize: 10, color: '#2d3748' }}>Nog geen contract aangemaakt</span>
                )}
                {ct?.conceptDate && <span style={{ fontSize: 10, color: '#2d3748' }}>Aangemaakt: {fmtDate(ct.conceptDate)}</span>}
                {ct?.signedDate && <span style={{ fontSize: 10, color: '#10b981' }}>Ondertekend: {fmtDate(ct.signedDate)}</span>}
                {ct?.signedFileName && <span style={{ fontSize: 10, color: '#10b981' }}>📎 {ct.signedFileName}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {ct && ct.status === 'concept' && (
                <button onClick={() => onUpdateStatus(c.id, 'verstuurd')}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #38bdf830', borderRadius: 6, color: '#38bdf8', fontSize: 11, cursor: 'pointer' }}>
                  Markeer verstuurd
                </button>
              )}
              {ct && ct.status === 'verstuurd' && (
                <button onClick={() => onUpdateStatus(c.id, 'ondertekend')}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #10b98130', borderRadius: 6, color: '#10b981', fontSize: 11, cursor: 'pointer' }}>
                  Markeer ondertekend
                </button>
              )}
              <button onClick={() => onOpen(c)}
                style={{ padding: '6px 14px', background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {ct ? '✎ Bewerken' : '+ Contract'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ContractModal({ contract: ct, companyName, onChange, onSave, onClose }: {
  contract: ContractData
  companyName: string
  onChange: (c: ContractData) => void
  onSave: () => void
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'bewerken' | 'preview'>('bewerken')
  const set = (key: keyof ContractData, val: string) => onChange({ ...ct, [key]: val })

  const handleSignedUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      onChange({ ...ct, signedFileData: e.target?.result as string, signedFileName: file.name, status: 'ondertekend', signedDate: today() })
    }
    reader.readAsDataURL(file)
  }

  const previewHtml = generateContractHtml(ct, companyName)

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(previewHtml)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <Modal onClose={onClose} wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Contract — {companyName}</h2>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>Samenwerkingsovereenkomst Bouw Check</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['bewerken', 'preview'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: activeTab === t ? '#6366f120' : 'transparent',
              border: `1px solid ${activeTab === t ? '#6366f1' : '#252540'}`,
              color: activeTab === t ? '#6366f1' : '#4a5568' }}>
            {t === 'bewerken' ? 'Invullen' : 'Preview / Print'}
          </button>
        ))}
      </div>

      {activeTab === 'bewerken' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: 1.5, marginBottom: 10 }}>AANNEMER GEGEVENS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Naam onderneming</label>
                <input style={INPUT} value={companyName} disabled placeholder={companyName}
                  onChange={() => {}} />
              </div>
              <div>
                <label style={LABEL}>KvK nummer</label>
                <input style={INPUT} value={ct.aannemerKvk} placeholder="12345678"
                  onChange={e => set('aannemerKvk', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={LABEL}>Adres (vestigingsadres)</label>
                <input style={INPUT} value={ct.aannemerAdres} placeholder="Straatnaam 1, 1234 AB Plaatsnaam"
                  onChange={e => set('aannemerAdres', e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Contactpersoon / ondertekenaar</label>
                <input style={INPUT} value={ct.aannemerContactpersoon} placeholder="Voornaam Achternaam"
                  onChange={e => set('aannemerContactpersoon', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: 1.5, marginBottom: 10 }}>BATCHAFSPRAKEN</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={LABEL}>Omschrijving batch</label>
                <input style={INPUT} value={ct.batchOmschrijving} placeholder="bijv. 10 dakkapel leads, regio Noord-Holland"
                  onChange={e => set('batchOmschrijving', e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Batchprijs</label>
                <input style={INPUT} value={ct.batchPrijs} placeholder="bijv. € 2.500,–"
                  onChange={e => set('batchPrijs', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={LABEL}>Plaats (ondertekening)</label>
              <input style={INPUT} value={ct.plaats} placeholder="bijv. Amsterdam"
                onChange={e => set('plaats', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Datum (op document)</label>
              <input style={INPUT} type="date" value={ct.datum || today()}
                onChange={e => set('datum', e.target.value)} />
            </div>
          </div>

          {/* Custom payment terms */}
          <div>
            <label style={LABEL}>Aangepaste betalingsregeling (optioneel — overschrijft standaard 5%)</label>
            <textarea style={{ ...INPUT, height: 64, resize: 'vertical' } as React.CSSProperties}
              value={ct.customBetalingsregeling}
              placeholder="bijv. 4% bij aanbetaling klant, overige 1% bij start werkzaamheden in loods — laat leeg voor standaard 5% regeling"
              onChange={e => set('customBetalingsregeling', e.target.value)} />
          </div>

          {/* Signed version upload */}
          <div style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: 1.5, marginBottom: 10 }}>GETEKENDE VERSIE UPLOADEN</div>
            {ct.signedFileName ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#10b981' }}>📎 {ct.signedFileName}</div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>Ondertekend op {ct.signedDate ? fmtDate(ct.signedDate) : '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={ct.signedFileData} download={ct.signedFileName}
                    style={{ padding: '6px 12px', background: '#10b98120', border: '1px solid #10b98140', borderRadius: 6, color: '#10b981', fontSize: 11, cursor: 'pointer', textDecoration: 'none' }}>
                    Download
                  </a>
                  <button onClick={() => onChange({ ...ct, signedFileData: '', signedFileName: '', status: 'verstuurd', signedDate: '' })}
                    style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #2d1515', borderRadius: 6, color: '#7f1d1d', fontSize: 11, cursor: 'pointer' }}>
                    Verwijder
                  </button>
                </div>
              </div>
            ) : (
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <div style={{ border: '1px dashed #252540', borderRadius: 8, padding: '16px', textAlign: 'center', color: '#4a5568', fontSize: 12 }}>
                  Klik om getekend document te uploaden (PDF)
                </div>
                <input type="file" accept=".pdf,.png,.jpg" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleSignedUpload(f) }} />
              </label>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button onClick={onClose}
              style={{ padding: '9px 20px', background: 'transparent', border: '1px solid #252540', borderRadius: 8, color: '#718096', fontSize: 13, cursor: 'pointer' }}>
              Annuleren
            </button>
            <button onClick={onSave}
              style={{ padding: '9px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Opslaan
            </button>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint}
              style={{ padding: '8px 18px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🖨 Afdrukken / Opslaan als PDF
            </button>
          </div>
          <div style={{ background: '#fff', borderRadius: 8, overflow: 'auto', maxHeight: 520, border: '1px solid #e2e8f0' }}>
            <iframe
              srcDoc={previewHtml}
              style={{ width: '100%', height: 500, border: 'none' }}
              title="Contract preview"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

function generateContractHtml(ct: ContractData, companyName: string): string {
  const d = ct.datum || today()
  const datumFormatted = d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '__________'
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8"/>
<style>
body{font-family:'Times New Roman',Times,serif;font-size:11pt;line-height:1.6;color:#000;max-width:780px;margin:40px auto;padding:0 32px;}
h1{font-size:13pt;font-weight:bold;text-align:center;margin-bottom:6px;}
h2{font-size:11pt;font-weight:bold;margin-top:22px;margin-bottom:4px;}
p{margin:6px 0;}
ol{margin:4px 0;padding-left:20px;}
ol li{margin-bottom:5px;}
hr{border:none;border-top:1px solid #000;margin:28px 0;}
.sig{display:flex;gap:80px;margin-top:60px;}
.sigcol{flex:1;}
.sigline{border-top:1px solid #000;width:220px;margin-top:38px;}
@media print{body{margin:20px auto;} @page{margin:1.5cm; size:A4;}}
</style>
</head>
<body>
<h1>SAMENWERKINGSOVEREENKOMST<br>LEADGENERATIE – BOUW CHECK</h1>
<p>De ondergetekenden:</p>
<p>1. <strong>Bouw Check</strong>, hierna: <strong>"Bouw Check"</strong>;</p>
<p>2. <strong>${companyName}</strong>${ct.aannemerAdres ? ', gevestigd te ' + ct.aannemerAdres : ''}${ct.aannemerKvk ? ', KvK ' + ct.aannemerKvk : ''}, hierna: <strong>"Aannemer"</strong>.</p>
<p><em>Samen: "Partijen".</em></p>
<p><strong>Overwegingen</strong><br>Bouw Check is een leadgeneratiebedrijf dat via digitale marketingkanalen consumentenaanvragen (leads) genereert voor aannemers actief in de Nederlandse bouwmarkt. Aannemer wenst gebruik te maken van de door Bouw Check aangeboden leads teneinde zijn klantenportefeuille uit te breiden. Partijen leggen hierbij de voorwaarden van hun samenwerking schriftelijk vast.</p>
<hr>
<h2>Artikel 1 – Doel en aard van de samenwerking</h2>
<ol>
<li>Deze overeenkomst regelt de samenwerking waarbij Bouw Check tegen een resultaatafhankelijke vergoeding leads faciliteert ten behoeve van Aannemer, en Aannemer zich verplicht de daaraan verbonden verplichtingen na te leven zoals in deze overeenkomst vastgelegd.</li>
<li>Partijen werken ieder als zelfstandige onderneming en op basis van gelijkwaardigheid. Deze overeenkomst kwalificeert uitdrukkelijk niet als arbeidsovereenkomst, agentuurovereenkomst of aannemingsovereenkomst in juridische zin.</li>
<li>Bouw Check verricht haar diensten als onafhankelijke derde en treedt te allen tijde op in eigen naam. Bouw Check is geen partij bij de overeenkomst die Aannemer met de eindklant sluit.</li>
<li>Alle leads en daarmee samenhangende persoonsgegevens die door Bouw Check worden gegenereerd of gedeeld, zijn en blijven het exclusieve eigendom van Bouw Check. Gebruik is uitsluitend toegestaan voor de uitvoering van de opdracht waarvoor de lead is verstrekt.</li>
</ol>
<h2>Artikel 2 – Leadlevering en batchafspraken</h2>
<ol>
<li>Bouw Check levert leads aan Aannemer op basis van vooraf overeengekomen batches. ${ct.batchOmschrijving ? 'De eerste batch betreft: <strong>' + ct.batchOmschrijving + '</strong>' + (ct.batchPrijs ? ' voor een totaalbedrag van <strong>' + ct.batchPrijs + '</strong>' : '') + '.' : 'De omvang, het type, de regio en de prijs per batch worden schriftelijk vastgelegd in een batchbevestiging, die als integraal onderdeel van deze overeenkomst geldt.'}</li>
<li>Bouw Check streeft naar levering van leads die voldoen aan de overeengekomen kwalificatiecriteria. Bouw Check geeft evenwel geen garantie op een minimale conversie, omzet of resultaat.</li>
<li>Een lead geldt als geleverd op het moment dat de contactgegevens van de consument aan Aannemer worden verstrekt.</li>
<li>Reclames over de kwaliteit van een lead dienen uiterlijk binnen vijf (5) werkdagen na levering schriftelijk en gemotiveerd bij Bouw Check te worden ingediend. Na het verstrijken van deze termijn geldt de lead als onherroepelijk aanvaard.</li>
</ol>
<h2>Artikel 3 – Meldplicht bij akkoord</h2>
<ol>
<li>Aannemer is verplicht Bouw Check schriftelijk te informeren zodra een door Bouw Check aangedragen lead resulteert in een akkoord op een opdracht of offerte door de eindklant. Deze melding dient te geschieden uiterlijk binnen <strong>twee (2) werkdagen</strong> na het bereiken van het akkoord.</li>
<li>De melding dient ten minste te bevatten: (i) de naam en het referentienummer van de lead; (ii) de overeengekomen opdrachtsom inclusief eventueel meerwerk; (iii) de getekende offerte of opdrachtbevestiging; (iv) de datum en het bedrag van de aanbetaling door de eindklant, voor zover reeds bekend.</li>
<li>Aannemer is eveneens verplicht Bouw Check te informeren indien een lead expliciet heeft afgezien van een opdracht, met vermelding van de reden voor zover bekend, binnen vijf (5) werkdagen.</li>
<li>Bij schending van de meldplicht als bedoeld in lid 1 is Aannemer – zonder dat nadere ingebrekestelling vereist is – een direct opeisbare boete verschuldigd van <strong>€ 500,– per niet of niet tijdig gemelde akkoord</strong>, onverminderd het recht van Bouw Check op aanvullende schadevergoeding.</li>
</ol>
<h2>Artikel 4 – Vergoeding en betalingsvoorwaarden</h2>
<ol>
<li>Voor iedere opdracht die voortvloeit uit een door Bouw Check aangedragen lead, is Aannemer aan Bouw Check een vergoeding verschuldigd ter hoogte van <strong>vijf procent (5%)</strong> van de totale opdrachtsom, inclusief eventueel overeengekomen meerwerk, exclusief BTW.</li>
${ct.customBetalingsregeling
  ? `<li>${ct.customBetalingsregeling} Aannemer draagt elk deelbedrag uiterlijk <strong>vijf (5) werkdagen</strong> na ontvangst van de betreffende betaling over aan Bouw Check.</li>`
  : `<li>De vergoeding is verschuldigd op het moment dat de eindklant een aanbetaling of eerste termijnbetaling aan Aannemer heeft voldaan. Aannemer draagt het verschuldigde bedrag uiterlijk <strong>vijf (5) werkdagen</strong> na ontvangst van die betaling over aan Bouw Check.</li>`
}
<li>Indien de opdrachtsom na akkoord wordt verhoogd door meerwerk, is over het meerwerkbedrag eveneens de vergoeding van vijf procent (5%) verschuldigd.</li>
<li>Indien Aannemer de vergoeding niet binnen de gestelde termijn heeft voldaan, is Aannemer van rechtswege in verzuim. Vanaf de dag van verzuim is Aannemer – zonder dat nadere ingebrekestelling vereist is – een direct opeisbare boete verschuldigd van <strong>€ 500,– per kalenderdag</strong> dat de betaling uitblijft, met een maximum van <strong>€ 15.000,– per openstaand bedrag</strong>, onverminderd het recht van Bouw Check op volledige schadevergoeding en de wettelijke handelsrente als bedoeld in artikel 6:119a BW. De boete laat de verschuldigdheid van het oorspronkelijke bedrag inclusief rente onverlet.</li>
<li>Bouw Check behoudt zich het recht voor de leadlevering met onmiddellijke ingang op te schorten zolang een verschuldigd bedrag onbetaald blijft.</li>
<li>Alle buitengerechtelijke incassokosten komen volledig voor rekening van Aannemer, met een minimum van € 250,– per vordering.</li>
</ol>
<h2>Artikel 5 – Duur en beëindiging</h2>
<ol>
<li>Deze overeenkomst wordt aangegaan voor onbepaalde tijd en vangt aan op de datum van ondertekening.</li>
<li>Ieder der Partijen kan deze overeenkomst te allen tijde schriftelijk beëindigen, zonder opgave van reden en zonder inachtneming van een opzegtermijn.</li>
<li>Beëindiging laat de meldplicht (artikel 3) en betalingsverplichting (artikel 4) ten aanzien van vóór beëindiging geleverde leads onverminderd in stand, alsmede de geheimhouding (artikel 12) en het non-concurrentiebeding (artikel 11).</li>
<li>Bouw Check is gerechtigd de overeenkomst met onmiddellijke ingang te ontbinden bij: (i) herhaalde of ernstige schending van de meld- of betalingsverplichting; (ii) faillissement van Aannemer; (iii) overtreding van artikel 11 of 12.</li>
</ol>
<h2>Artikel 6 – Verplichtingen van Aannemer</h2>
<ol>
<li>Aannemer handelt jegens de eindklant professioneel en in overeenstemming met de toepasselijke wet- en regelgeving.</li>
<li>Aannemer is volledig aansprakelijk voor de uitvoering van de opdracht en vrijwaart Bouw Check voor alle aanspraken van eindklanten of derden in verband met de kwaliteit, veiligheid of uitvoering van de werkzaamheden.</li>
</ol>
<h2>Artikel 7 – Aansprakelijkheid Bouw Check</h2>
<ol>
<li>Bouw Check treedt uitsluitend op als leadgenerator en is geen partij bij de overeenkomst tussen Aannemer en de eindklant. Bouw Check is niet aansprakelijk voor de uitvoering, kwaliteit, veiligheid of het resultaat van de door Aannemer verrichte werkzaamheden.</li>
<li>Bouw Check is evenmin aansprakelijk voor schade die voortvloeit uit het niet opvolgen van leads, het afzeggen van een opdracht door de eindklant, of enige andere omstandigheid gelegen aan de zijde van Aannemer of eindklant.</li>
<li>Indien Bouw Check toch aansprakelijk zou zijn, is die aansprakelijkheid beperkt tot het bedrag dat Bouw Check in de drie (3) kalendermaanden voorafgaand aan het schadeveroorzakende feit van Aannemer heeft ontvangen.</li>
<li>Bouw Check is in geen geval aansprakelijk voor indirecte schade, gevolgschade of gederfde omzet.</li>
</ol>
<h2>Artikel 8 – Verzekeringen</h2>
<ol>
<li>Aannemer houdt gedurende de looptijd ten minste een AVB-verzekering in stand met een minimale dekking van € 1.000.000,– per gebeurtenis en verstrekt op eerste verzoek een bewijs van verzekering.</li>
</ol>
<h2>Artikel 9 – Tarieven en indexering</h2>
<ol>
<li>Het percentage van vijf procent (5%) geldt voor de duur van de overeenkomst, tenzij Partijen schriftelijk anders overeenkomen.</li>
<li>Bouw Check behoudt zich het recht voor het percentage jaarlijks aan te passen, mits schriftelijk aangekondigd met een termijn van ten minste dertig (30) dagen.</li>
</ol>
<h2>Artikel 10 – Kwaliteitsstandaard en klachten</h2>
<ol>
<li>Aannemer voert opdrachten vakkundig en professioneel uit conform de in de branche geldende normen.</li>
<li>Aannemer meldt klachten of geschillen met eindklanten die betrekking hebben op een via Bouw Check aangedragen lead onverwijld en schriftelijk aan Bouw Check.</li>
</ol>
<h2>Artikel 11 – Herhaalopdrachten en informatieplicht</h2>
<ol>
<li>Het staat Aannemer te allen tijde vrij om eindklanten die via Bouw Check zijn aangedragen opnieuw te benaderen voor een nieuwe opdracht, mits Aannemer Bouw Check hiervan vooraf schriftelijk op de hoogte stelt.</li>
<li>Over de opdrachtsom van een herhaalopdracht als bedoeld in lid 1 is de vergoeding als bepaald in artikel 4 verschuldigd, tenzij Partijen schriftelijk anders overeenkomen.</li>
<li>Na beëindiging van de overeenkomst geldt de informatieplicht als bedoeld in lid 1 voor een periode van zes (6) maanden. Na het verstrijken van die periode staat het Aannemer vrij eindklanten zonder melding aan Bouw Check te benaderen en is geen vergoeding meer verschuldigd.</li>
<li>Bij het achterwege laten van de in lid 1 of lid 2 bedoelde melding verbeurt Aannemer, na schriftelijke ingebrekestelling met een hersteltermijn van vijf (5) werkdagen, een direct opeisbare boete van <strong>€ 5.000,– per overtreding</strong>.</li>
</ol>
<h2>Artikel 12 – Geheimhouding en gegevensbescherming</h2>
<ol>
<li>Aannemer behandelt alle informatie die hij van Bouw Check ontvangt strikt vertrouwelijk en verstrekt deze niet aan derden.</li>
<li>Aannemer verwerkt persoonsgegevens van eindklanten uitsluitend voor de uitvoering van de betreffende opdracht conform de AVG.</li>
<li>Bij schending verbeurt Aannemer, na ingebrekestelling, een boete van <strong>€ 10.000,– per overtreding</strong>, te vermeerderen met <strong>€ 250,– per dag</strong>.</li>
</ol>
<h2>Artikel 13 – Slotbepalingen</h2>
<ol>
<li>Op deze overeenkomst is uitsluitend Nederlands recht van toepassing.</li>
<li>Geschillen worden voorgelegd aan de bevoegde rechter.</li>
<li>Wijzigingen zijn slechts geldig indien schriftelijk overeengekomen.</li>
<li>Elektronische ondertekening via een erkend platform geldt als originele handtekening.</li>
</ol>
<hr>
<p>Aldus overeengekomen en ondertekend:</p>
<p>Plaats: ${ct.plaats || '__________'} &nbsp;|&nbsp; Datum: ${datumFormatted}</p>
<div class="sig">
<div class="sigcol">
<p><strong>Bouw Check</strong></p>
<p>Naam: Jasper van Heyningen</p>
<p>Functie: Directeur</p>
<div class="sigline"></div>
<p style="font-size:9pt;margin-top:4px;">Handtekening</p>
</div>
<div class="sigcol">
<p><strong>${companyName}</strong></p>
<p>Naam: ${ct.aannemerContactpersoon || '__________'}</p>
<p>Functie: __________</p>
<div class="sigline"></div>
<p style="font-size:9pt;margin-top:4px;">Handtekening</p>
</div>
</div>
</body>
</html>`
}

/* ════════════════════════════════════════════════════════
   INTAKE SUB-TAB
════════════════════════════════════════════════════════ */
function IntakeSub({ companies, intakes, selectedCompany, setSelectedCompany, onOpen }: {
  companies: Company[]; intakes: Record<string, IntakeData>
  selectedCompany: string; setSelectedCompany: (id: string) => void
  onOpen: (id: string) => void
}) {
  const company = companies.find(c => c.id === selectedCompany)
  const intake = selectedCompany ? intakes[selectedCompany] : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Company list */}
      <div style={{ ...CARD, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', letterSpacing: 1, marginBottom: 12 }}>BEDRIJVEN</div>
        {companies.length === 0 && <div style={{ fontSize: 12, color: '#374151' }}>Geen bedrijven — voeg ze toe in Finance.</div>}
        {companies.map((c: Company) => {
          const done = !!intakes[c.id]?.completedAt
          return (
            <button key={c.id} onClick={() => setSelectedCompany(c.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, marginBottom: 4,
                background: selectedCompany === c.id ? '#1a1a2e' : 'transparent',
                border: `1px solid ${selectedCompany === c.id ? '#252540' : 'transparent'}`,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <span style={{ fontSize: 13, color: selectedCompany === c.id ? '#e2e8f0' : '#8896a8' }}>{c.name}</span>
              {done
                ? <span style={{ fontSize: 10, color: '#10b981' }}>✓</span>
                : <span style={{ fontSize: 10, color: '#374151' }}>—</span>
              }
            </button>
          )
        })}
      </div>

      {/* Detail */}
      <div>
        {!selectedCompany ? (
          <div style={{ ...CARD, textAlign: 'center', padding: 48, color: '#374151', fontSize: 13 }}>
            Selecteer een bedrijf om de intake in te zien of in te vullen
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{company?.name}</div>
                <div style={{ fontSize: 11, color: intake?.completedAt ? '#10b981' : '#4a5568', marginTop: 2 }}>
                  {intake?.completedAt ? `Intake voltooid op ${fmtDate(intake.completedAt)}` : 'Intake nog niet ingevuld'}
                </div>
              </div>
              <button onClick={() => onOpen(selectedCompany)}
                style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {intake?.completedAt ? '✎ Bewerken' : '+ Intake invullen'}
              </button>
            </div>

            {!intake?.completedAt ? (
              <div style={{ ...CARD, textAlign: 'center', padding: 40, color: '#374151', fontSize: 13 }}>
                Nog geen intake — klik "+ Intake invullen"
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <IntakeField label="Regio / werkgebied" value={intake.regio} />
                <IntakeField label="Werkzaamheden" value={intake.werkzaamheden.join(', ') || '—'} />
                <IntakeField label="Ervaring externe leads" value={intake.ervaringExterneLeads || '—'} tag={intake.ervaringWelke || undefined} />
                <IntakeField label="Gewenst aantal aanvragen" value={intake.aantalAanvragen || '—'} />
                <IntakeField label="Snelheid offerte na inspectie" value={intake.offerteSnel || '—'} />
                <IntakeField label="Verantwoordelijk voor bellen" value={intake.bellendivisie || '—'} />
                <IntakeField label="Doorlooptijd akkoord → uitvoering" value={intake.doorlooptijd || '—'} />
                <IntakeField label="Factureren na akkoord" value={intake.factureringSnelheid || '—'} />
                <IntakeField label="Betaaltermijn" value={intake.betaaltermijn || '—'} />
                <IntakeField label="CAR verzekering" value={intake.carVerzekering || '—'} />
                <IntakeField label="Sales ondersteuning gewenst" value={intake.salesOndersteuning || '—'} />
                <IntakeField label="CRM ervaring" value={intake.crmErvaring || '—'} tag={intake.crmWelk || undefined} />
                {intake.klantprofiel && (
                  <div style={{ gridColumn: '1/-1', background: '#111118', border: '1px solid #1a1a2e', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 4 }}>Klantprofiel voorkeur</div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{intake.klantprofiel}</div>
                  </div>
                )}
                {intake.extraNotities && (
                  <div style={{ gridColumn: '1/-1', background: '#6366f110', border: '1px solid #6366f130', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, marginBottom: 4, letterSpacing: 1 }}>NOTITIES</div>
                    <div style={{ fontSize: 12, color: '#8896a8', lineHeight: 1.6 }}>{intake.extraNotities}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function IntakeField({ label, value, tag }: { label: string; value: string; tag?: string }) {
  return (
    <div style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: value === '—' ? '#374151' : '#e2e8f0', fontStyle: value === '—' ? 'italic' : 'normal' }}>{value}</div>
      {tag && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 3 }}>{tag}</div>}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   EVALUATIE SUB-TAB
════════════════════════════════════════════════════════ */
function EvaluatieSub({ companies, questions, meetings, selectedCompany, setSelectedCompany, showQEditor, setShowQEditor, editingQ, setEditingQ, editQText, setEditQText, newQText, setNewQText, onStartMeeting, onSaveQEdit, onAddQuestion, onRemoveQuestion, companyMeetings }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Left: company list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...CARD, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', letterSpacing: 1, marginBottom: 12 }}>BEDRIJVEN</div>
          {companies.length === 0 && (
            <div style={{ fontSize: 12, color: '#374151' }}>Geen bedrijven — voeg ze toe in Finance.</div>
          )}
          {companies.map((c: Company) => {
            const count = meetings.filter((m: Meeting) => m.companyId === c.id).length
            const isSelected = selectedCompany === c.id
            return (
              <button key={c.id}
                onClick={() => setSelectedCompany(c.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, marginBottom: 4,
                  background: isSelected ? '#1a1a2e' : 'transparent',
                  border: `1px solid ${isSelected ? '#252540' : 'transparent'}`,
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <span style={{ fontSize: 13, color: isSelected ? '#e2e8f0' : '#8896a8', fontWeight: isSelected ? 600 : 400 }}>{c.name}</span>
                {count > 0 && <span style={{ fontSize: 10, color: '#4a5568', background: '#1a1a2e', padding: '2px 7px', borderRadius: 10 }}>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Question template editor */}
        <div style={CARD}>
          <button onClick={() => setShowQEditor(!showQEditor)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', letterSpacing: 1 }}>VRAGENLIJST ({questions.length})</span>
            <span style={{ fontSize: 11, color: '#4a5568' }}>{showQEditor ? '▲' : '▼'}</span>
          </button>
          {showQEditor && (
            <div style={{ marginTop: 12 }}>
              {questions.map((q: Question, i: number) => (
                <div key={q.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: '#374151', marginTop: 9, width: 14, flexShrink: 0 }}>{i + 1}.</span>
                  {editingQ === q.id ? (
                    <input autoFocus value={editQText}
                      onChange={e => setEditQText(e.target.value)}
                      onBlur={() => onSaveQEdit(q.id)}
                      onKeyDown={(e: any) => { if (e.key === 'Enter') onSaveQEdit(q.id) }}
                      style={{ ...INPUT, fontSize: 11, padding: '4px 7px', flex: 1 }} />
                  ) : (
                    <span style={{ fontSize: 11, color: '#8896a8', flex: 1, lineHeight: 1.4, cursor: 'pointer', paddingTop: 6 }}
                      onClick={() => { setEditingQ(q.id); setEditQText(q.text) }}>{q.text}</span>
                  )}
                  <button onClick={() => onRemoveQuestion(q.id)}
                    style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 14, padding: '4px 2px', flexShrink: 0 }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={newQText} onChange={(e: any) => setNewQText(e.target.value)}
                  onKeyDown={(e: any) => { if (e.key === 'Enter') onAddQuestion() }}
                  placeholder="Nieuwe vraag..."
                  style={{ ...INPUT, fontSize: 11, padding: '5px 8px', flex: 1 }} />
                <button onClick={onAddQuestion}
                  style={{ padding: '5px 10px', background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>+</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: selected company detail */}
      <div>
        {!selectedCompany ? (
          <div style={{ ...CARD, textAlign: 'center', padding: 48, color: '#374151', fontSize: 13 }}>
            Selecteer een bedrijf om meetings te starten of te bekijken
          </div>
        ) : (
          <CompanyChecklistView
            company={companies.find((c: Company) => c.id === selectedCompany)}
            questions={questions}
            meetings={companyMeetings(selectedCompany)}
            onNewMeeting={() => onStartMeeting(selectedCompany)}
          />
        )}
      </div>
    </div>
  )
}

function CompanyChecklistView({ company, questions, meetings, onNewMeeting }: {
  company: Company; questions: Question[]; meetings: Meeting[]; onNewMeeting: () => void
}) {
  const [openMeeting, setOpenMeeting] = useState<string | null>(meetings[0]?.id ?? null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{company.name}</div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>{meetings.length} meetings opgeslagen</div>
        </div>
        <button onClick={onNewMeeting}
          style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nieuwe meeting
        </button>
      </div>

      {meetings.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 40, color: '#374151', fontSize: 13 }}>
          Nog geen meetings — klik "+ Nieuwe meeting" om te starten
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {meetings.map(m => {
            const isOpen = openMeeting === m.id
            const filled = m.answers.filter(a => a.answer.trim()).length
            return (
              <div key={m.id} style={{ background: '#111118', border: '1px solid #1a1a2e', borderRadius: 12, overflow: 'hidden' }}>
                {/* Meeting header */}
                <button onClick={() => setOpenMeeting(isOpen ? null : m.id)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{fmtDate(m.date)}</span>
                    <span style={{ fontSize: 11, color: filled === questions.length ? '#10b981' : '#f59e0b' }}>
                      {filled}/{questions.length} vragen beantwoord
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: '#4a5568' }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Meeting answers */}
                {isOpen && (
                  <div style={{ padding: '0 18px 16px', borderTop: '1px solid #1a1a2e' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                      {questions.map((q, i) => {
                        const ans = m.answers.find(a => a.questionId === q.id)?.answer ?? ''
                        return (
                          <div key={q.id}>
                            <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 3 }}>
                              <span style={{ color: '#374151', marginRight: 6 }}>{i + 1}.</span>{q.text}
                            </div>
                            <div style={{
                              fontSize: 12, color: ans ? '#e2e8f0' : '#374151',
                              background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: 6,
                              padding: '7px 10px', lineHeight: 1.5, fontStyle: ans ? 'normal' : 'italic',
                            }}>
                              {ans || 'Niet beantwoord'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {m.notes && (
                      <div style={{ marginTop: 14, padding: '10px 12px', background: '#6366f110', border: '1px solid #6366f130', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, marginBottom: 4, letterSpacing: 1 }}>NOTITIES</div>
                        <div style={{ fontSize: 12, color: '#8896a8', lineHeight: 1.6 }}>{m.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   DOCUMENTS SUB-TAB
════════════════════════════════════════════════════════ */
function DocumentsSub({ documents, companies, onAdd, onEdit, onDelete }: {
  documents: Document[]
  companies: Company[]
  onAdd: (companyId?: string) => void
  onEdit: (d: Document) => void
  onDelete: (id: string) => void
}) {
  const [selectedCompany, setSelectedCompany] = useState<string>('__all__')

  const filtered = selectedCompany === '__all__'
    ? documents
    : selectedCompany === '__general__'
      ? documents.filter(d => !d.companyId)
      : documents.filter(d => d.companyId === selectedCompany)

  const grouped = DOC_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filtered.filter(d => d.category === cat)
    return acc
  }, {} as Record<string, Document[]>)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Company list */}
      <div style={{ ...CARD, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', letterSpacing: 1, marginBottom: 12 }}>FILTER</div>

        {[
          { id: '__all__', name: 'Alle documenten' },
          { id: '__general__', name: 'Algemeen' },
          ...companies,
        ].map(c => {
          const count = c.id === '__all__'
            ? documents.length
            : c.id === '__general__'
              ? documents.filter(d => !d.companyId).length
              : documents.filter(d => d.companyId === c.id).length
          return (
            <button key={c.id} onClick={() => setSelectedCompany(c.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, marginBottom: 4,
                background: selectedCompany === c.id ? '#1a1a2e' : 'transparent',
                border: `1px solid ${selectedCompany === c.id ? '#252540' : 'transparent'}`,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <span style={{ fontSize: 13, color: selectedCompany === c.id ? '#e2e8f0' : '#8896a8' }}>{c.name}</span>
              {count > 0 && <span style={{ fontSize: 10, color: '#4a5568', background: '#1a1a2e', padding: '2px 7px', borderRadius: 10 }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Documents */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => onAdd(selectedCompany === '__all__' || selectedCompany === '__general__' ? undefined : selectedCompany)}
            style={{ padding: '9px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Document toevoegen
          </button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ ...CARD, textAlign: 'center', padding: 48, color: '#374151', fontSize: 13 }}>
            Geen documenten — klik "+ Document toevoegen"
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {DOC_CATEGORIES.map(cat => {
              const docs = grouped[cat]
              if (docs.length === 0) return null
              return (
                <div key={cat}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', letterSpacing: 1, marginBottom: 10 }}>{cat.toUpperCase()}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {docs.map(d => {
                      const co = companies.find(c => c.id === d.companyId)
                      return (
                        <div key={d.id} style={CARD}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', flex: 1, paddingRight: 8 }}>{d.title}</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => onEdit(d)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 13 }}>✎</button>
                              <button onClick={() => window.confirm('Verwijderen?') && onDelete(d.id)} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 14 }}>×</button>
                            </div>
                          </div>
                          {co && <div style={{ fontSize: 11, color: '#6366f1', marginBottom: 6 }}>{co.name}</div>}
                          {d.description && <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 8, lineHeight: 1.5 }}>{d.description}</div>}
                          {d.url && (
                            <a href={d.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                              ↗ Openen
                            </a>
                          )}
                          <div style={{ fontSize: 10, color: '#252540', marginTop: 8 }}>{fmtDate(d.addedAt)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   ICP'S
════════════════════════════════════════════════════════ */
function IcpSub({ icps, onSave }: { icps: ICP[]; onSave: (next: ICP[]) => void }) {
  const [filter, setFilter] = useState<'alle' | IcpStatus>('alle')
  const [modal, setModal] = useState<ICP | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [draft, setDraft] = useState<Partial<ICP>>({})
  const [logDraft, setLogDraft] = useState<{ notes: string; outcome: IcpStatus }>({ notes: '', outcome: 'gesprek gehad' })

  const visible = filter === 'alle' ? icps : icps.filter(i => i.status === filter)

  const openAdd = () => {
    setDraft({ status: 'niet gebeld', callLogs: [] })
    setAddModal(true)
  }

  const submitAdd = () => {
    if (!draft.bedrijfsnaam?.trim()) return
    const icp: ICP = {
      id: Date.now().toString(),
      bedrijfsnaam: draft.bedrijfsnaam ?? '',
      contactpersoon: draft.contactpersoon ?? '',
      telefoon: draft.telefoon ?? '',
      website: draft.website ?? '',
      regio: draft.regio ?? '',
      type: draft.type ?? '',
      status: draft.status ?? 'niet gebeld',
      callLogs: [],
      addedAt: today(),
    }
    onSave([...icps, icp])
    setAddModal(false)
    setDraft({})
  }

  const submitLog = (icp: ICP) => {
    if (!logDraft.notes.trim()) return
    const log: IcpCallLog = {
      id: Date.now().toString(),
      date: today(),
      notes: logDraft.notes.trim(),
      outcome: logDraft.outcome,
    }
    const updated: ICP = { ...icp, callLogs: [...icp.callLogs, log], status: logDraft.outcome }
    onSave(icps.map(i => i.id === icp.id ? updated : i))
    setModal(updated)
    setLogDraft({ notes: '', outcome: 'gesprek gehad' })
  }

  const deleteIcp = (id: string) => {
    if (!confirm('Dit bedrijf verwijderen uit de ICP-lijst?')) return
    onSave(icps.filter(i => i.id !== id))
    setModal(null)
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['alle', ...ICP_STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize',
                background: filter === s ? '#6366f120' : 'transparent',
                border: `1px solid ${filter === s ? '#6366f1' : '#1a1a2e'}`,
                color: filter === s ? '#6366f1' : '#4a5568',
              }}>{s === 'alle' ? `Alle (${icps.length})` : s}</button>
          ))}
        </div>
        <button onClick={openAdd}
          style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nieuw bedrijf
        </button>
      </div>

      {visible.length === 0 && (
        <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📞</div>
          <div style={{ color: '#4a5568', fontSize: 13 }}>Geen bedrijven gevonden.</div>
          <div style={{ color: '#2d3748', fontSize: 12, marginTop: 4 }}>Voeg een bedrijf toe om je cold call lijst op te bouwen.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {visible.map(icp => {
          const sc = ICP_STATUS_COLORS[icp.status]
          const lastLog = icp.callLogs[icp.callLogs.length - 1]
          return (
            <div key={icp.id} onClick={() => { setModal(icp); setLogDraft({ notes: '', outcome: 'gesprek gehad' }) }}
              style={{ ...CARD, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#252540')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a2e')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{icp.bedrijfsnaam}</div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {icp.status}
                </span>
              </div>
              {icp.contactpersoon && <div style={{ fontSize: 12, color: '#a0aec0', marginBottom: 4 }}>{icp.contactpersoon}</div>}
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#4a5568' }}>
                {icp.telefoon && <span>{icp.telefoon}</span>}
                {icp.regio && <span>{icp.regio}</span>}
                {icp.type && <span>{icp.type}</span>}
              </div>
              {lastLog && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#0a0a0f', borderRadius: 6, fontSize: 11, color: '#4a5568', borderLeft: `2px solid ${ICP_STATUS_COLORS[lastLog.outcome].border}` }}>
                  <span style={{ color: '#2d3748' }}>{fmtDate(lastLog.date)}: </span>{lastLog.notes}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 10, color: '#2d3748' }}>{icp.callLogs.length} gesprekken gelogd</div>
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: 16, padding: 28, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{modal.bedrijfsnaam}</h2>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {modal.contactpersoon && <span style={{ fontSize: 11, color: '#a0aec0' }}>{modal.contactpersoon}</span>}
                  {modal.telefoon && <span style={{ fontSize: 11, color: '#4a5568' }}>{modal.telefoon}</span>}
                  {modal.regio && <span style={{ fontSize: 11, color: '#4a5568' }}>{modal.regio}</span>}
                  {modal.type && <span style={{ fontSize: 11, color: '#4a5568' }}>{modal.type}</span>}
                  {modal.website && <a href={modal.website.startsWith('http') ? modal.website : `https://${modal.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#6366f1' }} onClick={e => e.stopPropagation()}>{modal.website}</a>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => deleteIcp(modal.id)}
                  style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #2d1515', borderRadius: 6, color: '#7f1d1d', fontSize: 12, cursor: 'pointer' }}>✕</button>
                <button onClick={() => setModal(null)}
                  style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
            </div>

            {/* Call log history */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', marginBottom: 10, letterSpacing: 1 }}>GESPREKKEN</div>
              {modal.callLogs.length === 0 && (
                <div style={{ fontSize: 12, color: '#2d3748', padding: '10px 0' }}>Nog geen gesprekken gelogd.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...modal.callLogs].reverse().map(log => {
                  const sc = ICP_STATUS_COLORS[log.outcome]
                  return (
                    <div key={log.id} style={{ padding: '10px 12px', background: '#111118', borderRadius: 8, borderLeft: `3px solid ${sc.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{log.outcome}</span>
                        <span style={{ fontSize: 10, color: '#2d3748' }}>{fmtDate(log.date)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#a0aec0', lineHeight: 1.5 }}>{log.notes}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Add feedback */}
            <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', marginBottom: 12, letterSpacing: 1 }}>FEEDBACK TOEVOEGEN</div>
              <div style={{ marginBottom: 10 }}>
                <label style={LABEL}>Uitkomst</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ICP_STATUSES.map(s => {
                    const sc = ICP_STATUS_COLORS[s]
                    const active = logDraft.outcome === s
                    return (
                      <button key={s} onClick={() => setLogDraft(d => ({ ...d, outcome: s }))}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize',
                          background: active ? sc.bg : 'transparent',
                          border: `1px solid ${active ? sc.border : '#1a1a2e'}`,
                          color: active ? sc.color : '#4a5568',
                        }}>{s}</button>
                    )
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={LABEL}>Notities</label>
                <textarea style={{ ...INPUT, minHeight: 80, resize: 'vertical' as const, fontFamily: 'inherit' }}
                  placeholder="Wat is er besproken? Wat was de reactie?"
                  value={logDraft.notes}
                  onChange={e => setLogDraft(d => ({ ...d, notes: e.target.value }))} />
              </div>
              <button onClick={() => submitLog(modal)}
                style={{ padding: '8px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setAddModal(false)}>
          <div style={{ background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: 16, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Nieuw bedrijf toevoegen</h2>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={LABEL}>Bedrijfsnaam *</label>
                <input style={INPUT} placeholder="Dakdekker BV" value={draft.bedrijfsnaam ?? ''}
                  onChange={e => setDraft(d => ({ ...d, bedrijfsnaam: e.target.value }))} />
              </div>
              <div>
                <label style={LABEL}>Contactpersoon</label>
                <input style={INPUT} placeholder="Jan de Vries" value={draft.contactpersoon ?? ''}
                  onChange={e => setDraft(d => ({ ...d, contactpersoon: e.target.value }))} />
              </div>
              <div>
                <label style={LABEL}>Telefoonnummer</label>
                <input style={INPUT} placeholder="+31 6 12345678" value={draft.telefoon ?? ''}
                  onChange={e => setDraft(d => ({ ...d, telefoon: e.target.value }))} />
              </div>
              <div>
                <label style={LABEL}>Website</label>
                <input style={INPUT} placeholder="www.bedrijf.nl" value={draft.website ?? ''}
                  onChange={e => setDraft(d => ({ ...d, website: e.target.value }))} />
              </div>
              <div>
                <label style={LABEL}>Regio</label>
                <input style={INPUT} placeholder="Noord-Holland" value={draft.regio ?? ''}
                  onChange={e => setDraft(d => ({ ...d, regio: e.target.value }))} />
              </div>
              <div>
                <label style={LABEL}>Type bedrijf</label>
                <input style={INPUT} placeholder="Dakdekker, Aannemer, Loodgieter..." value={draft.type ?? ''}
                  onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={submitAdd}
                style={{ flex: 1, padding: '10px 0', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Toevoegen
              </button>
              <button onClick={() => setAddModal(false)}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #1a1a2e', borderRadius: 8, color: '#4a5568', fontSize: 13, cursor: 'pointer' }}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   SHARED
════════════════════════════════════════════════════════ */
function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: 16, padding: 28, width: wide ? 680 : 500, maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
