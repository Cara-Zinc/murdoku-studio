import {t} from './i18n.js';

const demoStrings = new Set([
  '雨夜档案室', '原创入门练习 · 非官方题目',
  '办公室', '会客室', '档案室', '阅览室', '储藏室',
  '桌子', '文件柜', '椅子', '地毯', '架子', '植物', '箱子',
  '安娜', '柏文', '程远', '黛宁', '恩哲', '维安',
  '她在办公室，与桌子相邻。', '他坐在椅子上。', '他在第三行的档案室。',
  '她站在阅览室的地毯上。', '他在储藏室，与架子相邻。',
  '受害者。他与凶手在同一区域，那里没有第三人。',
]);
// Display-only translation also works for saved practice cases and their forks.
// Custom content and the canonical object strings used by rules are preserved.
export function demoText(puzzle, text) {
  return puzzle.source === '原创入门练习 · 非官方题目' && demoStrings.has(text) ? t(text) : text;
}
