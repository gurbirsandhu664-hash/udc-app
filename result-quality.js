// Structural checks do not certify subject accuracy. They prevent malformed or
// commentary-only values from being displayed as classification numbers.
export function checkResultNotation(payload){
 const out={...payload},notes=[];
 const udc=String(out.udc_number??out.udc_answer??'').trim();
 const ddc=String(out.ddc_number??out.ddc_answer??'').trim();
 const validU=!udc||(/^[0-9][0-9A-Za-z().,:=+\/\[\]"'’—–\-\s]*$/u.test(udc)&&!/\b(?:unknown|not verified|unavailable)\b/i.test(udc));
 const validD=!ddc||/^\d{3}(?:\.\d+)?$/.test(ddc);
 out.udc_number=out.udc_answer=validU?udc:'';
 out.ddc_number=out.ddc_answer=validD?ddc:'';
 if(!validU)notes.push('UDC candidate was not a numeric notation and was withheld.');
 if(!validD)notes.push('DDC candidate was malformed or contained commentary and was withheld.');
 out.notation_validation={udc_format_valid:validU,ddc_format_valid:validD,notes,proves_subject_accuracy:false};
 if(notes.length)out.notation_check=[out.notation_check,...notes].filter(Boolean).join(' ');
 return out;
}
