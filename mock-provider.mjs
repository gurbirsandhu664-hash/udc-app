// Test-only network fixture. Never reads or logs a real API key.
const actualFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=String(input);
 if(!url.startsWith('https://generativelanguage.googleapis.com/'))return actualFetch(input,init);
 const body=JSON.parse(init.body);
 if(body.tools||!body.generationConfig?.responseSchema)return new Response(JSON.stringify({error:{message:'Incompatible request fixture'}}),{status:400});
 if(process.env.MOCK_PROVIDER_FAIL==='1')return new Response(JSON.stringify({error:{message:'Simulated outage'}}),{status:503});
 const result={udc_number:'611.12',ddc_number:'611.12',main_subject:'Heart anatomy',sub_subject:'Human anatomy',breakdown:'611.12 = anatomy of the heart in UDC.',ddc_breakdown:'611.12 = heart anatomy in DDC.',explanation:'Independent anatomy entries in each system.',confidence:'Component match',sources:['Test fixture — not a live authority lookup'],official_udc_match:false};
 return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]}),{headers:{'Content-Type':'application/json'}});
};
