import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoadIndex, roadDataFromPaths, matchTrafficGeometry} from '../traffic-map.js';
import {projectTrafficPoint} from '../live-updates.js';
const routeData = {version: 1, routes: {
 A12: [[[0,0],[.5,.3],[1,0]], [[1,0],[1.5,.4],[2,0]], [[3,0],[4,0]]],
 A4: [[[0,.05],[2,.05]]]
}};
const identity = p => p;
const line = coords => ({type: 'MultiLineString', coordinates: [coords]});
test('reported endpoints follow road bends and connected links rather than a straight chord', () => {
 const index = createRoadIndex(routeData);
 const match = matchTrafficGeometry(index, 'A12', line([[.1,.06],[1.9,.08]]), identity);
 assert.equal(match.type,'MultiLineString');
 assert.ok(match.coordinates[0].some(p=>p[0]===.5 && p[1]===.3));
 assert.ok(match.coordinates[0].some(p=>p[0]===1.5 && p[1]===.4));
 assert.ok(Math.abs(match.coordinates[0][0][0]-.1)<.00001);
 assert.ok(Math.abs(match.coordinates[0].at(-1)[0]-1.9)<.00001);
});
test('a closer crossing motorway cannot steal a report from its declared road', () => {
 const result = matchTrafficGeometry(createRoadIndex(routeData),'A12',line([[.1,.06],[.9,.06]]),identity);
 assert.equal(result.type,'MultiLineString');
 assert.ok(result.coordinates[0].some(p=>p[1]===.3));
});
test('gaps, unknown roads and distant coordinates do not create red road stretches', () => {
 const index = createRoadIndex(routeData);
 for (const [road,geometry] of [['A12',line([[.1,.06],[3.5,0]])],['A99',line([[.1,.06],[.9,.06]])],['A12',line([[20,20],[21,21]])]]) {
  assert.equal(matchTrafficGeometry(index,road,geometry,identity).type,'Point');
 }
 const point = matchTrafficGeometry(index,'A12',{type:'Point',coordinates:[.4,.2]},identity);
 assert.equal(point.type,'Point');assert.equal(point.locationOnly,true);assert.deepEqual(point.coordinates,[.4,.2]);
 assert.equal(matchTrafficGeometry(index,'A12',line([[NaN,0],[1,0]]),p=>p.every(Number.isFinite)?p:null),null);
});
const svg=readFileSync(new URL('../assets/netherlands-roads.svg',import.meta.url),'utf8');
const paths=[...svg.matchAll(/<path data-road="([AN]\d+)" d="([^"]+)"/g)].map(m=>({road:m[1],d:m[2]}));
const data=roadDataFromPaths(paths);
test('the actual asset contains hundreds of genuine numbered routes, without duplicate highlight edges', () => {
 assert.ok(Object.keys(data.routes).length>=500);
 assert.equal(data.routes.A12.length,441);
 assert.ok(data.routes.N11.length>0); assert.ok(data.routes.A4.length>0);
});
test('real A12 geometry shares exact SVG vertices and retains curves between sparse endpoints', () => {
 const coords=data.routes.A12.find(line=>line.length>=8 && line.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-line[i][0],p[1]-line[i][1]),0)<1.5*Math.hypot(line[0][0]-line.at(-1)[0],line[0][1]-line.at(-1)[1]));
 const index=createRoadIndex(data);
 // Invert only for this fixture so the production projection round-trips the actual asset.
 const geographic=([x,y])=>[3.2+(x-540)/175,Math.atan(Math.exp((Math.log(Math.tan(Math.PI/4+53.65*Math.PI/360))*180/Math.PI-(y-65)/175)*Math.PI/180))*360/Math.PI-90];
 const geometry=line([geographic(coords[0]),geographic(coords.at(-1))]);
 const match=matchTrafficGeometry(index,'A12',geometry,projectTrafficPoint);
 assert.equal(match.type,'MultiLineString');assert.ok(match.coordinates[0].length>=8);
 for(const point of coords.slice(1,-1)) assert.ok(match.coordinates[0].some(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<.0001));
});
