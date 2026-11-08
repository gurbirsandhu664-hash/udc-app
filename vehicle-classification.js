// Narrow, compositional road-vehicle rules. Unrecognized qualifiers must not be discarded.
const vehicles = [
 {pattern:'(?:buses|bus|motor buses|motor bus)',udc:'629.114.5',ddc:'629.22233',label:'Buses'},
 {pattern:'(?:cars|car|motorcars|motor cars|passenger cars|private passenger automobiles)',udc:'629.114.6',ddc:'629.222',label:'Passenger cars'},
 {pattern:'(?:trucks|truck|lorries|lorry)',udc:'629.114.4',ddc:'629.224',label:'Trucks'}
];
export function classifyVehicleTitle(title){
 const text=title.normalize('NFKC').toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();
 const operation='(?:repair(?:s)?(?: and maintenance)?|maintenance(?: and repair(?:s)?)?|servicing)';
 for(const v of vehicles){
  const patterns=[new RegExp(`^(?:the )?${operation} of (?:the )?${v.pattern}$`),new RegExp(`^(?:the )?${v.pattern} ${operation}$`)];
  if(!patterns.some(re=>re.test(text)))continue;
  const repair=/\brepairs?\b/.test(text),maintenance=/\bmaintenance\b|\bservicing\b/.test(text);
  const udc=v.udc+(repair?'.004.67':'.004.5');
  // DDC 629.287: append the digits following 629.22 in 629.222–629.229.
  const suffix=v.ddc.slice('629.22'.length),ddc='629.287'+suffix;
  return {status:'classified',title,full_title:title,udc_number:udc,udc_answer:udc,ddc_number:ddc,ddc_answer:ddc,
   main_subject:`Road-vehicle engineering / ${v.label}`,sub_subject:title,
   breakdown:`Historical UDC: ${v.udc} = ${v.label}; ${repair?'.004.67 = repair and reconditioning':'.004.5 = upkeep and maintenance'}. Complete notation: ${udc}.`,
   explanation:`The title concerns ${v.label.toLowerCase()} ${repair?'repair':''}${repair&&maintenance?' and ':''}${maintenance?'maintenance':''}. The vehicle and operation are both represented. This is a historical UDC construction for the configured 1961 edition; the old .004 auxiliaries were subsequently withdrawn.`,
   ddc_title:`${v.label} — maintenance and repair`,ddc_breakdown:`DDC-23: 629.287 = maintenance and repair. ${v.ddc} = ${v.label}. Append ${suffix}, the digits following 629.22, giving ${ddc}.`,
   ddc_explanation:'The DDC number is built from its own add instruction, independently of UDC.',
   ddc_note:'DDC-23 Volume 3, printed pages 281 and 286 (bundled PDF pages 283 and 288).',
   confidence:'REFERENCE-BASED HISTORICAL SYNTHESIS — review combined UDC construction',
   official_udc_match:false,grounded:false,verified_by_schedule:false,
   evidence_summary:'Bundled UDC 1961 PDF page 103 supplies vehicle classes. UDC Consortium relocation table confirms the meanings and withdrawal of the historical .004.5 and .004.67 auxiliaries. Bundled DDC-23 Volume 3 PDF pages 283 and 288 supply vehicle numbers and the maintenance/repair add instruction. The complete UDC synthesis is a rule-based construction, not a verbatim schedule entry.',
   sources:['Bundled UDC B.S. 1000A:1961, PDF page 103 — road-vehicle classes','https://udcc.org/relocation.htm','Bundled DDC-23 Volume 3, printed page 281 (PDF page 283) — vehicle types','Bundled DDC-23 Volume 3, printed page 286 (PDF page 288) — maintenance and repair add instruction'],
   notation_check:`UDC ${udc} and DDC ${ddc} are independent constructions. Both vehicle type and operation are retained.`,
   rule_id:'road-vehicle-maintenance-v147',engine:'V147 evidence-based vehicle repair rules',model:'offline'};
 }
 return null;
}
