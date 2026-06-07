// ── Barbour ABI API integration ───────────────────────────────────────────────
// DORMANT — uncomment and supply your key when ready to activate live data.
// const BARBOUR_ABI_API_KEY = null; // Replace null with your key
// Endpoint: https://api.barbour-abi.com/v1/projects
// When active, pair with the opportunity research prompt below to query the
// Barbour ABI live project pipeline alongside the public sources.
// ─────────────────────────────────────────────────────────────────────────────

const DUE_DILIGENCE_RE = /\b(research\s+(this\s+)?(project|client|contractor|company|employer|developer)|do\s+some\s+digging(\s+on)?|look\s+into\s+(this|the\s+(client|contractor|company|employer|project|party|parties))|what\s+can\s+you\s+find\s+(on|about)|find\s+out\s+(what\s+you\s+can\s+)?(on|about)|investigate\s+(this|the)|background\s+(check|on)|due\s+diligence|check\s+them\s+out|dig\s+into|companies\s+house|who\s+are\s+(they|this\s+(client|company|contractor)))\b/i;

const OPPORTUNITY_RE = /\b(find\s+(me\s+)?(some\s+)?(new\s+)?(projects?|opportunities?|tenders?|contracts?|work\s+leads?)|look(ing)?\s+for\s+(new\s+)?(projects?|opportunities?|tenders?|work|contracts?)|any\s+(new\s+)?(opportunities?|tenders?|projects?|contracts?|work)|what('?s|\s+is)\s+out\s+there|search\s+for\s+(tenders?|projects?|opportunities?|contracts?)|anything\s+(out\s+there|available|going)|find\s+new\s+(work|projects?|tenders?|opportunities?))\b/i;

const WORK_TYPE_RE = /\b(demolition|civils?|civil\s+engineering|groundworks?|asbestos|rc\s+frame|reinforced\s+concrete|construction|refurb(ishment)?|fit[\s-]?out|cladding|roofing|piling|drainage|highways?|utilities?|infrastructure|remediation|structural|steel\s+frame|timber\s+frame|mep|mechanical\s+and\s+electrical|earthworks?)\b/i;

const REGION_RE = /\b(england|scotland|wales|northern\s+ireland|london|manchester|birmingham|glasgow|edinburgh|aberdeen|dundee|perth|inverness|uk|national|nationwide)\b/i;

const DUE_DILIGENCE_PROMPT = `

RESEARCH MODE — PROJECT DUE DILIGENCE ACTIVE:
The user has requested a due diligence investigation. Conduct thorough web research across all relevant areas and deliver a structured briefing. Run multiple web searches — do not rely on a single query. Search specifically for each area below.

INVESTIGATION SCOPE:
1. CLIENT / EMPLOYER: Companies House registration, filing history, latest accounts, directors and PSCs, any winding-up petitions, CCJs, insolvency notices, payment reputation in the industry.
2. CONTRACTOR / NAMED PARTIES (if mentioned): Track record, financial stability, past disputes, adjudication history, insolvency indicators, industry reputation.
3. SITE: Planning history and current applications on the local authority portal, any objections or conditions, flood risk zone, known ground conditions or contamination, previous use history.
4. RELEVANT CASE LAW: Recent TCC or Court of Appeal decisions relevant to the stated contract type (NEC4, JCT, SBCC, bespoke) — particularly on compensation events, payment notices, pay less notices, delay, or defects.
5. RISK FLAG SUMMARY: A clear executive summary of red flags found, unverified concerns, and recommended pre-contract actions.

DELIVERY STYLE:
- Address the user as "sir" throughout.
- Spoken prose with clear numbered section headings.
- Explicitly distinguish what was found and verified via search versus what could not be confirmed online.
- Cite Companies House numbers, court case references, or planning application numbers where found.
- Conclude with a Risk Rating (Low / Medium / High / Critical) and a clear recommended next action.
- If information is unavailable online, state this clearly and recommend the appropriate direct verification method.`;

const OPPORTUNITY_PROMPT_BASE = `

RESEARCH MODE — OPPORTUNITY RESEARCH ACTIVE:
The user is searching for new project opportunities. Search UK public tender and opportunity sources thoroughly — run multiple searches across different platforms and construction news sources. Do not stop after one search.

SOURCES TO SEARCH:
- Find a Tender Service (FTS): find-tender.service.gov.uk
- Contracts Finder: contractsfinder.service.gov.uk
- Public Contracts Scotland: publiccontractsscotland.gov.uk
- Sell2Wales: sell2wales.gov.wales
- Construction Enquirer: constructionenquirer.com
- Building magazine: building.co.uk
- Construction News: constructionnews.co.uk
- Scottish Futures Trust / Hub South West / Hub East Central (if Scotland)
- Local authority procurement portals for the specified region

FOR EACH OPPORTUNITY FOUND, PROVIDE:
- Name and brief description of the works
- Location
- Estimated contract value (if published)
- Client / Contracting Authority
- Key deadlines (expression of interest, ITT return, projected start)
- How to pursue it (registration portal, contact point, ITT process)
- Source URL

DELIVERY STYLE:
- Address the user as "sir" throughout.
- Lead with the opportunities that best match the stated work type and region.
- Clearly flag when a deadline has passed or information could not be verified.
- End with a recommendation on which 2–3 opportunities represent the best fit and why.
- If no live opportunities are found for the specific criteria, suggest adjacent opportunities or advise where to monitor for upcoming work.`;

export function detectResearchMode(text) {
  if (DUE_DILIGENCE_RE.test(text)) return 'due-diligence';
  if (OPPORTUNITY_RE.test(text))    return 'opportunity';
  return null;
}

export function getResearchPrompt(mode, text) {
  if (mode === 'due-diligence') return DUE_DILIGENCE_PROMPT;
  if (mode === 'opportunity') {
    const workMatch   = text.match(WORK_TYPE_RE);
    const regionMatch = text.match(REGION_RE);
    const workType    = workMatch   ? workMatch[0]   : 'construction';
    const region      = regionMatch ? regionMatch[0] : 'Scotland';
    return `${OPPORTUNITY_PROMPT_BASE}\n\nWORK TYPE FOCUS: ${workType}\nREGION: ${region} (default is Scotland unless the user specifies otherwise)`;
  }
  return '';
}
