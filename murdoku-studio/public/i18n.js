import {english} from './translations.js';

export const LANGUAGES = ['zh-CN', 'en'];
const preferenceKey = 'murdoku-studio.language';
let language = 'zh-CN';
export const getLanguage = () => language;
export function preferredLanguage(saved, browserLanguages = []) {
  if (LANGUAGES.includes(saved)) return saved;
  for (const candidate of browserLanguages) {
    if (/^zh(?:-|$)/i.test(candidate)) return 'zh-CN';
    if (/^en(?:-|$)/i.test(candidate)) return 'en';
  }
  return 'zh-CN';
}
export function setLanguage(value) {
  language = LANGUAGES.includes(value) ? value : 'zh-CN';
}

// Chinese strings are stable catalogue keys. Template values are interpolated
// after lookup, so names, imported clues and other user content stay untouched.
export function t(key, ...values) {
  if (Array.isArray(key)) key = key.map((part, i) => part + (i < values.length ? `{${i}}` : '')).join('');
  const template = language === 'en' && Object.hasOwn(english, key) ? english[key] : key;
  return template.replace(/\{(\d+)\}/g, (match, index) => index < values.length ? String(values[index]) : match);
}
export const separator = () => language === 'en' ? ', ' : '、';

export function applyLanguage(root = document) {
  root.documentElement.lang = language;
  for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const attribute of ['aria-label', 'title', 'placeholder', 'alt', 'content']) {
    for (const node of root.querySelectorAll(`[data-i18n-${attribute}]`)) node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
  }
  root.getElementById('ui-language').value = language;
  for (const option of root.querySelectorAll('datalist option[data-i18n]')) option.value = t(option.dataset.i18n);
}
export function initializeLanguage() {
  let saved;
  try {saved = localStorage.getItem(preferenceKey);} catch {}
  setLanguage(preferredLanguage(saved, navigator.languages || [navigator.language]));
  applyLanguage();
}
export function rememberLanguage(value) {
  setLanguage(value);
  try {localStorage.setItem(preferenceKey, language);} catch {}
  applyLanguage();
}

// Backend messages are translated at the transport boundary, not by modifying
// the DOM or arbitrary user text. Unknown diagnostics remain available verbatim.
export const serviceError = text => typeof text === 'string' ? t(text) : '';
