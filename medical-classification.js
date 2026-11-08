// Classification of clinical subjects, not medical advice. Numbers below are
// independent UDC/DDC components; never infer DDC by converting UDC notation.
const SPECIES=[
 {id:'dogs',label:'Dogs',udc:'636.7',ddc:'636.7',re:/\b(dogs?|canine)\b|ਕੁੱਤ(?:ੇ|ਿਆਂ|ਾ)/i},
 {id:'cats',label:'Cats',udc:'636.8',ddc:'636.8',re:/\b(cats?|feline)\b|ਬਿੱਲ(?:ੀ|ੀਆਂ)/i},
 {id:'horses',label:'Horses',udc:'636.1',ddc:'636.1',re:/\b(horses?|equine)\b/i},
 {id:'cattle',label:'Cattle',udc:'636.2',ddc:'636.2',re:/\b(cattle|cows?|bovine)\b/i},
 {id:'pigs',label:'Pigs',udc:'636.4',ddc:'636.4',re:/\b(pigs?|swine|porcine)\b/i},
 {id:'sheep',label:'Sheep',udc:'636.3',ddc:'636.3',re:/\b(sheep|ovine)\b/i}
];
const ORGANS=[
 {id:'heart',label:'Heart',udc:'616.12',ddc:'616.12',anatomy:'611.12',re:/\b(hearts?|cardiac|cardiology|cardio)\b|ਦਿਲ/i,udcPage:190,ddcPage:91},
 {id:'lungs',label:'Lungs',udc:'616.24',ddc:'616.24',anatomy:'611.24',re:/\b(lungs?|pulmonary)\b/i,udcPage:84,ddcPage:95},
 {id:'liver',label:'Liver',udc:'616.36',ddc:'616.362',anatomy:'611.36',re:/\b(liver|hepatic)\b/i,udcPage:84,ddcPage:97},
 {id:'kidneys',label:'Kidneys',udc:'616.61',ddc:'616.61',anatomy:'611.61',re:/\b(kidneys?|renal)\b/i,udcPage:84,ddcPage:102},
 {id:'skin',label:'Skin',udc:'616.5',ddc:'616.5',anatomy:'611.77',re:/\b(skin|dermatology|dermatological)\b/i,udcPage:84,ddcPage:100}
];
export function medicalFacets(value){
 const text=String(value).normalize('NFKC');
 const species=SPECIES.filter(s=>s.re.test(text)),organs=ORGANS.filter(o=>o.re.test(text));
 const cancer=/\b(cancer|cancers|carcinoma|carcinomas|oncology|malignant neoplasms?)\b|ਕੈਂਸਰ/i.test(text);
 const unsupportedOrgans=[...new Set(text.match(/\b(?:brain|bones?|pancreas|prostate|breast|stomach|bladder|blood|colon|intestines?|eyes?|ears?|spleen)\b/gi)||[])];
 const disease=/\b(diseases?|disorders?|pathology|illness|infections?|diabetes|treatment|therapy)\b|ਬਿਮਾਰੀ|ਬਿਮਾਰੀਆਂ/i.test(text);
 const otherHosts=[...new Set(text.match(/\b(?:dolphins?|rabbits?|fish|bees?|insects?|birds?|goats?|chickens?|poultry|wildlife|animals?)\b/gi)||[])];
 const explicitHuman=/\b(humans?|people|men|women|children|adults?)\b/i.test(text);
 const nonClinical=/\b(novels?|fiction|poetry|social welfare|social services|economic|economics|insurance|fundraising|legislation|law|ethics|rights|statistics|incidence|epidemiology|public health|prevention|anatomy|physiology)\b/i.test(text);
 return {species:species.map(s=>({id:s.id,label:s.label})),organs:organs.map(o=>({id:o.id,label:o.label})),condition:cancer?'cancer':disease?'disease':null,veterinary:species.length>0&&(cancer||disease),mixed_hosts:species.length>1||(species.length>0&&explicitHuman),unknown_hosts:otherHosts,unsupported_organs:unsupportedOrgans,non_clinical:nonClinical};
}
export function classifyMedicalTitle(title,description='',analysis={}){
 const text=(title+' '+description).normalize('NFKC'),facets=medicalFacets(text);
 if(!facets.condition||facets.non_clinical||facets.mixed_hosts||facets.unknown_hosts.length||facets.unsupported_organs.length||facets.organs.length>1)return null;
 const species=SPECIES.find(s=>s.re.test(text));
 const organ=ORGANS.find(o=>o.re.test(text));
 // A generic disease title without organ or a known domestic animal is not enough.
 if(!organ&&!species&&!facets.condition.includes('cancer'))return null;
 if(/\b(benign|leukemia|lymphoma|diabetes|tuberculosis|metastatic|secondary|heart failure|heart attack|pneumonia|asthma|congenital)\b/i.test(text))return null;
 const cancer=facets.condition==='cancer';
 const coreU=organ?organ.udc:'616';
 const humanD=cancer?(organ?'616.994'+organ.anatomy.slice(4):'616.994'):(organ?organ.ddc:'616');
 const pathologyU=coreU+(cancer?'-006.6':'');
 const udc=species?'619:'+pathologyU+':'+species.udc:pathologyU;
 const vetD=species?species.ddc+'089':'';
 const diseaseDigits=humanD.replace(/\./g,'').slice(2);
 const ddc=species?vetD+diseaseDigits:humanD;
 const condition=cancer?'Cancer':'Disease';
 const name=[species?'Veterinary '+(cancer?'oncology':'medicine'):(cancer?'Oncology':'Clinical medicine'),organ?.label,species?.label].filter(Boolean).join(' / ');
 const udcSteps=[...(species?[{notation:'619',meaning:'Veterinary medicine',source:'UDC 1961, PDF page 85; permits relation to specific diseases and domesticated animals'}]:[]),{notation:coreU,meaning:organ?organ.label+' diseases':'Disease and pathology',source:`UDC 1961, PDF page ${organ?.udcPage||83}`},...(cancer?[{notation:'-006.6',meaning:'Carcinoma / cancer',source:'UDC 1961 alphabetical index, PDF page 160'}]:[]),...(species?[{notation:species.udc,meaning:species.label,source:'https://udcsummary.info/php/index.php?id=50820&lang=en'}]:[])];
 const ddcSteps=[{notation:humanD,meaning:organ?`${condition} of ${organ.label.toLowerCase()}`:condition,source:cancer?'DDC-23 Volume 3, PDF pages 126–127 (printed 124–125)':`DDC-23 Volume 3, PDF page ${organ?.ddcPage||81}`}];
 if(species)ddcSteps.push({notation:species.ddc+'0',meaning:`Base for specific topics in ${species.label.toLowerCase()}`,source:'DDC-23 Volume 3, animal-specific add instructions, PDF pages 335–346'}, {notation:'89',meaning:'Digits after 636.0 in 636.089: veterinary medicine',source:'DDC-23 Volume 3, PDF pages 334 and 343'}, {notation:diseaseDigits,meaning:`Digits after 61 in ${humanD}`,source:'DDC-23 Volume 3, PDF page 334: add numbers following 61 in 610–618'});
 const extra=[...(analysis.places||[]),...(analysis.periods||[]),...(analysis.forms||[])];
 if(/\b(diagnosis|diagnostic|treatment|therapy|surgery|surgical|radiotherapy|chemotherapy)\b/i.test(text))extra.push('diagnostic or treatment technique');
 const modifiers=text.match(/\b(?:valvular|hereditary|genetic|infectious|viral|bacterial|chronic|acute|rare|adult|juvenile|breed|pediatric|paediatric)\b/gi)||[];
 extra.push(...modifiers.map(m=>'clinical qualifier: '+m));
 const limitation=extra.length?'Additional facets not encoded: '+extra.join(', ')+'.':'The core host, organ (when supplied), and disease type are represented; review the constructed notation before cataloguing.';
 return {title,full_title:title,status:'classified',udc_number:udc,udc_answer:udc,ddc_number:ddc,ddc_answer:ddc,
  main_subject:name,sub_subject:title,ddc_title:name,
  breakdown:udcSteps.map(s=>s.notation+' = '+s.meaning).join('; ')+'. Result: '+udc+'.',
  ddc_breakdown:species?`${species.ddc}0 + 89 + ${diseaseDigits} = ${ddc}. The pathology component is ${humanD}; its digits after 61 are added to ${vetD}.`:`${humanD} = ${organ?condition+' of '+organ.label.toLowerCase():condition}.`,
  explanation:`${species?'This is a veterinary subject concerning '+species.label.toLowerCase():'This is a clinical subject'}. ${organ?'Affected organ: '+organ.label+'. ':''}Condition: ${condition}. ${limitation}`,
  ddc_explanation:cancer&&organ?'DDC organ cancer is built under 616.994; it is not made by appending cancer digits to the organ-disease class.':'DDC and UDC were built independently from their own components.',
  ddc_note:limitation,confidence:'REFERENCE-BASED SYNTHESIS — review combined construction',evidence_level:'Component entries and add instructions cited; constructed result is not an exact authority lookup',
  official_udc_match:false,grounded:false,verified_by_schedule:false,
  evidence_summary:'UDC 1961 veterinary relation instructions, organ index and carcinoma entry; DDC-23 veterinary add instructions and organ-cancer instruction.',
  sources:[...new Set([...udcSteps,...ddcSteps].map(s=>s.source))],component_evidence:{udc:udcSteps,ddc:ddcSteps},
  semantic_coverage:{host:species?.label||'No nonhuman host specified',organ:organ?.label||null,condition,represented:['condition',...(organ?['organ']:[]),...(species?['host']:[])],additional_facets_unencoded:extra,complete_core:true},
  notation_check:limitation,classification_scope:extra.length?'Core subject; additional facets pending':'Core subject synthesis',rule_id:'clinical-facet-synthesis-v149',engine:'V149 clinical facet synthesis',model:'offline'};
}
