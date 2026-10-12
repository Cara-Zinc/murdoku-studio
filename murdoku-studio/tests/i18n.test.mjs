import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {t,setLanguage,preferredLanguage,serviceError} from '../public/i18n.js';
import {english} from '../public/translations.js';
import {demoText} from '../public/demo-i18n.js';
import {demoPuzzle} from '../public/demo.js';
import {makePuzzle,blankState,applyMove,assess,solve} from '../public/engine.js';
import {recognizeRoster,relabelPeople} from '../public/people.js';

const placeholders = text => [...text.matchAll(/\{\d+\}/g)].map(match=>match[0]).sort();
test('the English catalogue preserves every interpolation slot', () => {
  for(const [key,value] of Object.entries(english)) {
    assert.equal(typeof value,'string',key);
    assert.deepEqual(placeholders(value),placeholders(key),key);
  }
});
test('static labels, accessible attributes and escaped HTML text have English entries', () => {
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const decode=text=>text.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&quot;/g,'"').replace(/&amp;/g,'&');
  for(const [,key] of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) assert.ok(Object.hasOwn(english,decode(key)),decode(key));
});
test('saved language takes precedence and supported browser languages supply the default', () => {
  assert.equal(preferredLanguage('zh-CN',['en-US']),'zh-CN');
  assert.equal(preferredLanguage('en',['zh-TW']),'en');
  assert.equal(preferredLanguage(null,['fr-FR','en-GB']),'en');
  assert.equal(preferredLanguage('invalid',['zh-TW','en']),'zh-CN');
  assert.equal(preferredLanguage(null,['ja']),'zh-CN');
});
test('interpolation leaves user text intact and unknown diagnostics remain readable', () => {
  try {
    setLanguage('en');
    const name='安娜 <img src=x> {1}';
    assert.equal(t`选择 ${name}`,`Select ${name}`);
    assert.equal(t('用户填写的描述'),'用户填写的描述');
    assert.equal(t('toString'),'toString');
    assert.equal(serviceError('文件不是有效的 PDF。'),'The file is not a valid PDF.');
    assert.equal(serviceError(undefined),'');
    setLanguage('zh-CN');assert.equal(t`选择 ${name}`,`选择 ${name}`);
  } finally {setLanguage('zh-CN');}
});
test('bilingual placeholders preserve all 64 IDs when names are relabeled or extracted', () => {
  for (const label of ['Person','人物']) {
    const puzzle=makePuzzle(64,64,64), ids=puzzle.people.map(person=>person.id);
    for(const person of puzzle.people) person.name=`${person.id} · ${person.victim?'Victim':label}`;
    assert.deepEqual(relabelPeople(puzzle,null).puzzle.people.map(person=>person.id),ids);
    assert.deepEqual(recognizeRoster(puzzle.people,[]).map(person=>person.id),ids);
    const roster=recognizeRoster(puzzle.people,[{name:'Anna',clue:'A user-provided clue.'}]);
    assert.equal(roster.find(person=>person.name==='Anna').id,'A');
    assert.equal(roster.find(person=>person.name==='Anna').clue,'A user-provided clue.');
  }
});
test('switching language changes demo display and diagnostics without changing rules or progress', () => {
  const puzzle=demoPuzzle(), state=applyMove(puzzle,blankState(),'place',1,'A');
  const original=structuredClone({puzzle,state}), solution=solve(puzzle).solutions;
  try {
    setLanguage('en');
    assert.equal(demoText(puzzle,puzzle.title),'Rainy Night Archive');
    assert.equal(demoText(puzzle,puzzle.people[0].name),'Anna');
    assert.equal(demoText({...puzzle,source:'Imported file'},'安娜'),'安娜');
    assert.equal(demoText(puzzle,'我自己的线索'),'我自己的线索');
    assert.throws(()=>applyMove(puzzle,state,'place',0,'B'),/cannot hold a person/);
    const invalid=applyMove(puzzle,state,'place',2,'B');
    assert.ok(assess(puzzle,invalid).errors.some(error=>error.message.includes('share a row or column')));
    assert.deepEqual(solve(puzzle).solutions,solution);
    assert.deepEqual({puzzle,state},original);
    setLanguage('zh-CN');assert.equal(demoText(puzzle,puzzle.title),'雨夜档案室');
    assert.throws(()=>applyMove(puzzle,state,'place',0,'B'),/不能站人/);
  } finally {setLanguage('zh-CN');}
});
