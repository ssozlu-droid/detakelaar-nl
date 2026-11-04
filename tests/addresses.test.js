import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addressSuggestions,confirmedAddress} from '../addresses.js';
const id='adr-'+ 'a'.repeat(32);
const address={id,type:'adres',bron:'BAG',nummeraanduiding_id:'0344200000128086',huisnummer:93,straatnaam:'Europalaan',woonplaatsnaam:'Utrecht',weergavenaam:'Europalaan 93, 3526KP Utrecht'};
test('suggestions accept only address objects, deduplicate IDs and preserve labels as text',()=>{
  const result=addressSuggestions({response:{docs:[address,address,{...address,type:'weg'},{...address,id:'bad'},{...address,id:'adr-'+ 'b'.repeat(32),weergavenaam:'<img src=x>'}]}});
  assert.equal(result.length,2);assert.equal(result[0].id,id);assert.equal(result[1].label,'<img src=x>');
  assert.throws(()=>addressSuggestions({response:{docs:null}}));
});
test('selection requires an exact lookup match for a full registered BAG address',()=>{
  assert.equal(confirmedAddress({response:{docs:[address]}},id).label,address.weergavenaam);
  for(const doc of [{...address,id:'adr-'+ 'b'.repeat(32)},{...address,type:'weg'},{...address,bron:'NWB'},{...address,huisnummer:''},{...address,nummeraanduiding_id:''},{...address,straatnaam:''},{...address,woonplaatsnaam:''}]){
    assert.throws(()=>confirmedAddress({response:{docs:[doc]}},id));
  }
  assert.throws(()=>confirmedAddress({response:{docs:[]}},id));
  assert.throws(()=>confirmedAddress({response:{docs:[address,address]}},id));
});
