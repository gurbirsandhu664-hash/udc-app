import {checkResultNotation} from '../result-quality.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyseTitle} from '../subject-engine.js';
import {classifyMedicalTitle,medicalFacets} from '../medical-classification.js';
import {applyToolPolicy,isTopLevelComputingNumber} from '../provider-policy.js';
const classify=title=>classifyMedicalTitle(title,'',analyseTitle(title));
test('screenshot regression: canine heart cancer encodes host organ and condition',()=>{
 const j=classify('Heart Cancer in Dogs');assert.equal(j.udc_number,'619:616.12-006.6:636.7');assert.equal(j.ddc_number,'636.7089699412');assert.deepEqual(j.semantic_coverage.represented,['condition','organ','host']);assert.ok(j.sources.length);assert.equal(j.verified_by_schedule,false);
});
test('clinical synthesis is compositional across domestic hosts and organs',()=>{
 const species=[['dogs','636.7'],['cats','636.8'],['horses','636.1'],['cattle','636.2'],['pigs','636.4'],['sheep','636.3']];
 const organs=[['heart','616.12','12'],['lung','616.24','24'],['liver','616.36','36'],['kidney','616.61','61'],['skin','616.5','77']];
 for(const [animal,base] of species)for(const [organ,u,d] of organs){const title=`${organ} cancer in ${animal}`,j=classify(title);assert.equal(j.udc_number,`619:${u}-006.6:${base}`,title);assert.equal(j.ddc_number,base+'0896994'+d,title);assert.equal(j.full_title,title);}
});
test('human organ cancer remains separate from veterinary cancer',()=>{const j=classify('Heart cancer in humans');assert.equal(j.ddc_number,'616.99412');assert.equal(j.udc_number,'616.12-006.6');assert.equal(j.semantic_coverage.organ,'Heart');assert.equal(j.semantic_coverage.host,'No nonhuman host specified');});
test('animal organ diseases do not acquire cancer suffixes',()=>{const j=classify('Heart diseases in dogs');assert.equal(j.udc_number,'619:616.12:636.7');assert.equal(j.ddc_number,'636.7089612');});
test('clinical analysis recognizes medical synonyms and veterinary domain priority',()=>{for(const title of ['Canine cardiac oncology','Cancer of the heart in a dog','HEART CANCER IN DOGS','ਦਿਲ ਦਾ ਕੈਂਸਰ ਕੁੱਤਿਆਂ ਵਿੱਚ']){const j=classify(title);assert.equal(j.ddc_number,'636.7089699412',title);const a=analyseTitle(title);assert.equal(a.subjects[0].id,'veterinary');assert.ok(!a.subjects.some(s=>s.id==='medicine'))}});
test('mixed hosts and unrelated intent do not trigger a single-host clinical synthesis',()=>{for(const title of ['Heart cancer in dogs and cats','Heart cancer in dogs and children','Economic impact of cancer in dogs','A novel about heart cancer in dogs','Social welfare for cancer patients','Cancer prevention in dogs','Benign heart tumor in dogs','Lung cancer metastatic to heart in dogs','Cancer of liver and pancreas in dogs'])assert.equal(classify(title),null,title)});
test('extra geography and technique remain explicit, unencoded facets',()=>{const j=classify('Treatment of heart cancer in dogs in India, 2020');assert.ok(j.semantic_coverage.additional_facets_unencoded.includes('India'));assert.ok(j.semantic_coverage.additional_facets_unencoded.includes('2020'));assert.ok(j.semantic_coverage.additional_facets_unencoded.includes('diagnostic or treatment technique'));assert.match(j.classification_scope,/pending/)});
test('Gemini 2.5 structured request omits incompatible built-in search',()=>{const body={generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT'}}};assert.equal(applyToolPolicy(body,'gemini-2.5-flash',true),false);assert.equal(body.tools,undefined);assert.ok(body.generationConfig.responseSchema);assert.equal(applyToolPolicy(body,'gemini-3-pro-preview',true),true);assert.ok(body.tools);});
test('computing guard distinguishes 004 class from historical auxiliaries',()=>{assert.ok(isTopLevelComputingNumber('004.8'));assert.ok(isTopLevelComputingNumber('004:37'));assert.equal(isTopLevelComputingNumber('629.114.5.004.67'),false);});
test('cited DDC organ-cancer example and veterinary add instruction exist in supplied excerpts',()=>{const pages=JSON.parse(readFileSync('ddc-23-reference-index.json')).pages;const page=n=>pages.find(p=>p.page===n&&/vol 3/.test(p.volume)).text;assert.match(page(126),/cancer of heart 616\.99412/);assert.match(page(334),/following 61/);assert.match(page(343),/636\.70/);});

test('malformed DDC and prose values are withheld, never reconstructed from prose',()=>{for(const value of ['636.70896.99412','Not verified','616:636.7','61']){const j=checkResultNotation({ddc_number:value});assert.equal(j.ddc_number,'');assert.equal(j.notation_validation.ddc_format_valid,false)}assert.equal(checkResultNotation({ddc_number:'636.7089699412'}).ddc_number,'636.7089699412')});
test('unrecognized hosts cannot trigger a human clinical construction',()=>{for(const title of ['Heart cancer in dolphins','Cancer in fish','Cancer in rabbits'])assert.equal(classify(title),null,title)});
