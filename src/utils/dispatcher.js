import { AGENTS } from './constants.js';

const RULES = [
  { re: /payment|application for payment|valuation|boq|bill of quantities|schedule of rates|interim|final account|daywork/i,        agents: ['qs-cost','payment-evidence'] },
  { re: /delay|programme|critical path|eot|extension of time|float|lookahead|planned vs actual|baseline/i,                          agents: ['programme-delay','contract-law'] },
  { re: /dispute|claim|adjudicat|arbitrat|evidence schedule|position statement|referral|without prejudice/i,                         agents: ['dispute-claims','contract-law','document-control','qs-cost'] },
  { re: /asbestos|acm|licensed work|nnlw|non.licensed|dcu|npu|four.stage|reoccupation|air monitoring|consignment/i,                  agents: ['asbestos','compliance-hs','document-control'] },
  { re: /demolish|demolition|soft strip|high.reach|cut and lift|exclusion zone|drop zone/i,                                          agents: ['demolition','temporary-works','programme-delay'] },
  { re: /temporary works|propping|needling|façade|crash deck|excavation support|permit to load|tw register/i,                        agents: ['temporary-works','structural'] },
  { re: /contract|nec3|nec4|jct|sbcc|compensation event|early warning|pay.less|time.bar|relevant event/i,                           agents: ['contract-law'] },
  { re: /risk|what.*missing|what am i missing|gap|exposure|overdue|outstanding|alert/i,                                              agents: ['risk','director-intelligence'] },
  { re: /daily report|site report|labour record|plant record|waste record|daily diary/i,                                             agents: ['site-reporting','payment-evidence'] },
  { re: /rams|method statement|permit to work|toolbox|induction|competency|incident|near miss|h&s|health and safety/i,               agents: ['compliance-hs'] },
  { re: /geotech|ground condition|bearing|pile|piling|earthwork|cut and fill|settlement|groundwater|retaining/i,                     agents: ['geotechnical','civil-engineering'] },
  { re: /contaminated|remediation|validation|waste classification|hydrocarbon|heavy metal|soil sample/i,                             agents: ['remediation','geotechnical'] },
  { re: /drainage|civil|groundwork|road|hardstanding|utilities|external works/i,                                                     agents: ['civil-engineering'] },
  { re: /structural|load path|steel frame|masonry|reinforced concrete|rc slab|progressive collapse/i,                               agents: ['structural','temporary-works'] },
  { re: /plant|hired plant|off.hire|loler|puwer|havs|calibrat/i,                                                                    agents: ['plant-equipment','qs-cost'] },
  { re: /tender|bid|enquiry|scope review|exclusion|qualification|pre.construction|estimat/i,                                        agents: ['tender-preconstruction'] },
  { re: /drawing|document|revision|drawing register|superseded|handover pack/i,                                                     agents: ['document-control'] },
  { re: /meeting|agenda|minutes|action tracker|attendance|decision|governance/i,                                                    agents: ['meeting-chair'] },
  { re: /handover|close.out|snag|snagging|completion|archive/i,                                                                     agents: ['handover-closeout','qs-cost'] },
  { re: /email|correspond|instruction.*letter|notification|notice.*sent/i,                                                          agents: ['email-correspondence','document-control'] },
  { re: /asta|gantt|programme.*export|task.*duration|milestone|logic link/i,                                                        agents: ['asta-programme','programme-delay'] },
  { re: /director|business.*summary|whole.*business|portfolio|executive.*report/i,                                                  agents: ['director-intelligence'] },
  { re: /variation|v\.?o\b|change.*instruction|additional work|extra work|scope change/i,                                           agents: ['qs-cost','contract-law'] },
  { re: /labour|workforce|resource|timesheet|productivity|agency/i,                                                                 agents: ['labour-productivity'] },
];

const STAGE_DEFAULTS = {
  'disputes-claims':      ['dispute-claims','contract-law','qs-cost'],
  'payment-applications': ['qs-cost','payment-evidence'],
  'tender-review':        ['tender-preconstruction'],
  'contract-review':      ['contract-law'],
  'variations':           ['qs-cost','contract-law'],
  'meetings-governance':  ['meeting-chair'],
  'handover':             ['handover-closeout','document-control'],
  'final-account':        ['qs-cost','handover-closeout'],
};

export function dispatchAgents(text, stage = '') {
  const matched = new Set();
  for (const { re, agents } of RULES) {
    if (re.test(text)) agents.forEach(a => matched.add(a));
  }
  if (matched.size === 0) {
    (STAGE_DEFAULTS[stage] || []).forEach(a => matched.add(a));
  }
  return Array.from(matched).slice(0, 5);
}

export function getAgentById(id) {
  return AGENTS.find(a => a.id === id) || null;
}
