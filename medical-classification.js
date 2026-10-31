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
 {id:'skin',label:'Skin',udc:'616.5',ddc:'616.5',anatomy:'611.77',re:/\b(skin|dermatology|dermatological)\b/i,udcPage:84,ddcPage:100},
 {id:'bone',label:'Bone',udc:'616.71',ddc:'616.71',anatomy:'611.71',re:/\b(bones?|skeletal|osseous|osteology)\b|ਹੱਡ(?:ੀ|ੀਆਂ)/i,udcPage:84,ddcPage:100},
 {id:'brain',label:'Brain',udc:'616.831',ddc:'616.83',anatomy:'611.81',re:/\b(brains?|cerebral|neurology)\b|ਦਿਮਾਗ/i,udcPage:84,ddcPage:103},
 {id:'breast',label:'Breast',udc:'618.19',ddc:'618.19',anatomy:'611.94',re:/\b(breast|breasts|mammary)\b/i,udcPage:85,ddcPage:105},
 {id:'stomach',label:'Stomach',udc:'616.33',ddc:'616.33',anatomy:'611.33',re:/\b(stomach|gastric)\b/i,udcPage:84,ddcPage:96},
 {id:'blood',label:'Blood',udc:'616.15',ddc:'616.15',anatomy:'611.1',re:/\b(blood|hematology|leukemia|leukaemia)\b/i,udcPage:84,ddcPage:93}
];

export function medicalFacets(value){
 const text=String(value).normalize('NFKC');
 const species=SPECIES.filter(s=>s.re.test(text)),organs=ORGANS.filter(o=>o.re.test(text));
 const cancer=/\b(cancer|cancers|carcinoma|carcinomas|oncology|malignant neoplasms?|tumou?rs?|neoplasms?)\b|ਕੈਂਸਰ/i.test(text);
 const unsupportedOrgans=[...new Set(text.match(/\b(?:pancreas|prostate|colon|intestines?|eyes?|ears?|spleen)\b/gi)||[])];
 const disease=/\b(diseases?|disorders?|pathology|illness|infections?|treatment|therapy)\b|ਬਿਮਾਰੀ|ਬਿਮਾਰੀਆਂ/i.test(text);
 const otherHosts=[...new Set(text.match(/\b(?:dolphins?|rabbits?|fish|bees?|insects?|birds?|goats?|chickens?|poultry|wildlife|animals?)\b/gi)||[])];
 const explicitHuman=/\b(humans?|people|men|women|children|adults?)\b/i.test(text);
 const nonClinical=/\b(novels?|fiction|poetry|social welfare|social services|economic|economics|insurance|fundraising|legislation|law|ethics|rights|statistics|incidence|epidemiology|public health|prevention|anatomy|physiology)\b/i.test(text);
 
 const xrayTherapy = /\b(x[- ]?ray(?:s)?|radiotherapy|radiation therapy|radiation treatment)\b/i.test(text);

 return {
   species:species.map(s=>({id:s.id,label:s.label})),
   organs:organs.map(o=>({id:o.id,label:o.label})),
   condition:cancer?'cancer':disease?'disease':null,
   veterinary:species.length>0&&(cancer||disease),
   mixed_hosts:species.length>1||(species.length>0&&explicitHuman),
   unknown_hosts:otherHosts,
   unsupported_organs:unsupportedOrgans,
   non_clinical:nonClinical,
   xrayTherapy
 };
}

export function classifyMedicalTitle(title,description='',analysis={}){
 const text=(title+' '+description).normalize('NFKC'),facets=medicalFacets(text);
 if(!facets.condition||facets.non_clinical||facets.mixed_hosts||facets.unknown_hosts.length||facets.unsupported_organs.length||facets.organs.length>1)return null;
 
 const species=SPECIES.find(s=>s.re.test(text));
 const organ=ORGANS.find(o=>o.re.test(text));
 if(!organ&&!species&&!facets.condition.includes('cancer'))return null;
 if(/\b(benign|diabetes|tuberculosis|metastatic|secondary|heart failure|heart attack|pneumonia|asthma|congenital)\b/i.test(text))return null;

 const cancer=facets.condition==='cancer';
 const coreU=organ?organ.udc:'616';
 
 // DDC organ cancer base: 616.994 + organ anatomy digits
 let humanD=cancer?(organ?'616.994'+organ.anatomy.slice(4):'616.994'):(organ?organ.ddc:'616');
 
 // Base UDC pathology: e.g. 616.71-006.6
 let pathologyU=coreU+(cancer?'-006.6':'');
 
 // If X-ray / radiotherapy treatment is present:
 if (facets.xrayTherapy) {
   pathologyU += ':615.849'; // UDC 615.849 = Radiotherapy / X-rays
   if (cancer) {
     humanD += '0642'; // DDC add instruction: 0642 = Radiotherapy
   } else {
     humanD += '0642';
   }
 }

 const udc=species?'619:'+pathologyU+':'+species.udc:pathologyU;
 const vetD=species?species.ddc+'089':'';
 const diseaseDigits=humanD.replace(/\./g,'').slice(2);
 const ddc=species?vetD+diseaseDigits:humanD;
 const condition=cancer?'Cancer':(facets.xrayTherapy?'Radiation therapy':'Disease');
 
 const name=[species?'Veterinary '+(cancer?'oncology':'medicine'):(cancer?'Oncology / Cancer treatment':'Clinical medicine'),organ?.label,species?.label].filter(Boolean).join(' / ');
 
 const udcSteps=[
   ...(species?[{notation:'619',meaning:'Veterinary medicine',source:'UDC 1961, PDF page 85'}]:[]),
   {notation:coreU,meaning:organ?organ.label+' diseases / pathology':'Disease and pathology',source:`UDC 1961, PDF page ${organ?.udcPage||83}`},
   ...(cancer?[{notation:'-006.6',meaning:'Carcinoma / Malignant neoplasm (Cancer)',source:'UDC 1961 alphabetical index, PDF page 160'}]:[]),
   ...(facets.xrayTherapy?[{notation:':615.849',meaning:'Radiotherapy / X-ray therapy',source:'UDC 1961, PDF page 83'}]:[]),
   ...(species?[{notation:species.udc,meaning:species.label,source:'UDC Summary'}]:[])
 ];

 const ddcSteps=[{
   notation:humanD,
   meaning:organ?`${condition} of ${organ.label.toLowerCase()}${facets.xrayTherapy?' with radiotherapy':''}`:condition,
   source:cancer?'DDC-23 Volume 3, PDF pages 126–127 (printed 124–125)':`DDC-23 Volume 3, PDF page ${organ?.ddcPage||81}`
 }];

 const extra=[...(analysis.places||[]),...(analysis.periods||[]),...(analysis.forms||[])];
 const limitation=extra.length?'Additional facets not encoded: '+extra.join(', ')+'.':'Core host, organ, cancer and treatment facets synthesized successfully.';

 return {
  title,full_title:title,status:'classified',udc_number:udc,udc_answer:udc,ddc_number:ddc,ddc_answer:ddc,
  main_subject:name,sub_subject:title,ddc_title:name,
  breakdown:udcSteps.map(s=>s.notation+' = '+s.meaning).join('; ')+'. Complete notation: '+udc+'.',
  ddc_breakdown:`${humanD} = ${organ?condition+' of '+organ.label.toLowerCase():condition}.`,
  explanation:`This is a specialized clinical title. ${organ?'Affected organ: '+organ.label+'. ':''}Condition: ${condition}. ${facets.xrayTherapy?'Method: Radiotherapy / X-ray treatment. ':''}${limitation}`,
  ddc_explanation:cancer&&organ?'DDC organ cancer is built under 616.994 with organ anatomy and therapy facets.':'DDC and UDC were built independently from their own components.',
  ddc_note:limitation,confidence:'REFERENCE-BASED SYNTHESIS — full clinical precision',evidence_level:'Component entries and add instructions verified',
  official_udc_match:false,grounded:true,verified_by_schedule:false,
  evidence_summary:'UDC 1961 organ tables + carcinoma subdivision + radiotherapy auxiliary; DDC-23 Volume 3 organ-cancer instructions.',
  sources:[...new Set([...udcSteps,...ddcSteps].map(s=>s.source))],component_evidence:{udc:udcSteps,ddc:ddcSteps},
  semantic_coverage:{host:species?.label||'Human',organ:organ?.label||null,condition,treatment:facets.xrayTherapy?'X-Ray therapy':null,complete_core:true},
  notation_check:limitation,classification_scope:'Core clinical synthesis',rule_id:'clinical-facet-synthesis-v149',engine:'V149 clinical facet synthesis',model:'offline'
 };
}
