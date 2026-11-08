// Gemini 2.x structured JSON output cannot be combined with built-in search.
// Keep the schema and omit search for those models instead of failing every call.
export function applyToolPolicy(body,model,requestSearch){
 const enabled=!!requestSearch&&/^gemini-[3-9](?:[.-]|$)/i.test(model);
 if(enabled)body.tools=[{googleSearch:{}}];else delete body.tools;
 return enabled;
}
export function isTopLevelComputingNumber(number){return /^004(?:\.|$|[(:])/u.test(String(number).trim());}
