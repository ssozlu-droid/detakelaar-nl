import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlate,validPlate,formatRdwDate,lookupRdw,buildMessage,amsterdamToday,transportTimingLabel} from '../vehicle.js';
test('normalizes plates and rejects malformed input',()=>{assert.equal(normalizePlate(' ab-12 cd '),'AB12CD');for(const input of ['','123456','ABCDEF',"AB12'X",'AB<12'])assert.equal(validPlate(input),false);assert.equal(validPlate('AB12CD'),true);});
test('dates handle unavailable and invalid RDW values',()=>{assert.equal(formatRdwDate('20240229'),'29-02-2024');for(const date of ['',null,'20230229','20241301'])assert.equal(formatRdwDate(date),'Niet beschikbaar');});
test('provider requests exact normalized plate and maps only real response fields',async()=>{const car=await lookupRdw('ab-12-cd',{fetcher:async(url)=>{assert.equal(url.hostname,'opendata.rdw.nl');assert.equal(url.searchParams.get('kenteken'),'AB12CD');return{ok:true,json:async()=>[{kenteken:'AB12CD',merk:'TEST',handelsbenaming:'Model',datum_eerste_toelating:'20000102'}]};}});assert.equal(car.brand,'TEST');assert.equal(car.emptyMass,'');assert.equal(car.date,'02-01-2000');});
test('missing vehicle, HTTP failure, malformed payload and invalid plate fail clearly',async()=>{for(const response of [{ok:true,json:async()=>[]},{ok:false},{ok:true,json:async()=>({})}])await assert.rejects(lookupRdw('AB12CD',{fetcher:async()=>response}));await assert.rejects(lookupRdw('<script>',{fetcher:()=>assert.fail('must not fetch')}));});
test('different returned plate cannot fill wrong vehicle',async()=>{await assert.rejects(lookupRdw('AB12CD',{fetcher:async()=>({ok:true,json:async()=>[{kenteken:'XY99ZZ'}]})}));});
test('transport message includes every provided field and preserves special characters',()=>{const data={plate:'AB12CD',vehicle:'Citroën C3',pickup:'Den Haag & Leiden',delivery:'Utrecht',type:'Schadevervoer',name:'Jo',phone:'0612345678',notes:'Rolt niet'};const message=buildMessage(data);for(const value of Object.values(data))assert.ok(message.includes(value));assert.equal(decodeURIComponent(encodeURIComponent(message)),message);assert.ok(buildMessage({}).includes('Niet opgegeven'));});

test('transport preferences format urgency, week and calendar dates without stale custom dates',()=>{
 assert.equal(transportTimingLabel({timing:'asap',transportDate:'2020-01-01'},'2026-11-04'),'Zo snel mogelijk');
 assert.equal(transportTimingLabel({timing:'week'},'2026-11-04'),'Deze week');
 assert.equal(transportTimingLabel({timing:'date',transportDate:'2026-11-04'},'2026-11-04'),'04-11-2026');
 assert.equal(transportTimingLabel({timing:'date',transportDate:'2028-02-29'},'2026-11-04'),'29-02-2028');
 for(const data of [{timing:''},{timing:'other'},{timing:'date'},{timing:'date',transportDate:'2026-02-30'},{timing:'date',transportDate:'2026-11-03'}]) assert.throws(()=>transportTimingLabel(data,'2026-11-04'));
 assert.ok(buildMessage({timing:'asap'}).includes('Gewenste planning: Zo snel mogelijk'));
});
test('minimum calendar day follows Amsterdam across UTC midnight',()=>{
 assert.equal(amsterdamToday(new Date('2026-11-03T23:30:00Z')),'2026-11-04');
 assert.equal(amsterdamToday(new Date('2026-07-01T22:30:00Z')),'2026-07-02');
});
