import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectTrafficPoint, trafficIsFresh, recentNews} from '../live-updates.js';
const now = Date.parse('2026-11-04T10:00:00Z');
const iso = offset => new Date(now + offset).toISOString();
const traffic = () => ({status:'ok',sourceUpdatedAt:iso(-20000),expiresAt:iso(280000),jams:[]});
test('traffic projection matches the static map and rejects invalid geometry', () => {
  assert.deepEqual(projectTrafficPoint([3.2,53.65]),[540,65]);
  for (const p of [[0,0],[52,4],[NaN,52],[4],null,['4',52]]) assert.equal(projectTrafficPoint(p),null);
});
test('traffic cannot remain current after provider expiry or from an invalid response', () => {
  assert.equal(trafficIsFresh(traffic(),now),true);
  assert.equal(trafficIsFresh({...traffic(),sourceUpdatedAt:iso(-400000)},now),false);
  assert.equal(trafficIsFresh({...traffic(),expiresAt:iso(-1)},now),false);
  assert.equal(trafficIsFresh({...traffic(),sourceUpdatedAt:iso(200000)},now),false);
  assert.equal(trafficIsFresh({...traffic(),expiresAt:iso(900000)},now),false);
  assert.equal(trafficIsFresh({status:'unavailable'},now),false);
});
test('news keeps recent source headlines and rejects stale, hostile or duplicate links', () => {
  const article = {title:'Voorbeeld uitsluitend voor test',url:'https://www.nu.nl/auto/123/test',publishedAt:iso(-3600000)};
  const data={status:'ok',checkedAt:iso(-10000),expiresAt:iso(1000000),articles:[article,article,{...article,url:'javascript:alert(1)'},{...article,url:'https://other.example/x'},{...article,url:'https://www.nu.nl/auto/old',publishedAt:iso(-300000000)}]};
  assert.deepEqual(recentNews(data,now),[article]);
  assert.throws(()=>recentNews({...data,expiresAt:iso(-1)},now));
  assert.throws(()=>recentNews({...data,expiresAt:'invalid'},now));
  assert.throws(()=>recentNews({...data,checkedAt:iso(-2000000)},now));
});
