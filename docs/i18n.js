const LOCALES_DIR = "./locales";
const FALLBACK = "en";

let langs = [{ code: FALLBACK, name: "English", short: "EN" }];
let currentLang = FALLBACK;
let strings = {};
let fallbackStrings = {};

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function detectLang() {
  const saved = localStorage.getItem("draw2_lang");
  return langs.some(l => l.code === saved) ? saved : FALLBACK;
}

function t(key, vars = {}) {
  let str = strings[key] || fallbackStrings[key] || key;
  for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v);
  return str;
}

function buildLangMenu() {
  const menu = document.getElementById("lang-menu");
  if (!menu) return;
  menu.replaceChildren(...langs.map(l => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.lang = l.code;
    btn.className = "lang-option btn flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm font-medium text-left hover:bg-black/5 dark:hover:bg-white/10";
    const short = document.createElement("span");
    short.className = "font-mono text-[10px] text-zinc-400 dark:text-white/40";
    short.textContent = l.short || l.code.toUpperCase();
    btn.append(l.name, short);
    return btn;
  }));
}

function applyI18n() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    let html = t(el.getAttribute("data-i18n-html"));
    el.querySelectorAll("[data-i18n-slot]").forEach(slot => {
      html = html.replace(`{${slot.getAttribute("data-i18n-slot")}}`, slot.outerHTML);
    });
    el.innerHTML = html;
  });
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    el.getAttribute("data-i18n-attr").split(",").forEach(pair => {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key));
    });
  });

  const langBtn = document.getElementById("lang-toggle-label");
  const active = langs.find(l => l.code === currentLang);
  if (langBtn) langBtn.textContent = active?.short || currentLang.toUpperCase();
}

async function loadLang(lang) {
  strings = lang === FALLBACK ? fallbackStrings : await loadJSON(`${LOCALES_DIR}/${lang}.json`);
  currentLang = lang;
}

async function setLang(lang) {
  if (!langs.some(l => l.code === lang)) lang = FALLBACK;
  await loadLang(lang);
  localStorage.setItem("draw2_lang", currentLang);
  applyI18n();
}

const ready = (async () => {
  try { langs = await loadJSON(`${LOCALES_DIR}/index.json`); } catch {}
  try { fallbackStrings = await loadJSON(`${LOCALES_DIR}/${FALLBACK}.json`); } catch {}
  try {
    await loadLang(detectLang());
  } catch {
    currentLang = FALLBACK;
    strings = fallbackStrings;
  }
})();

const domReady = document.readyState === "loading"
  ? new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true }))
  : Promise.resolve();

window.t = t;
window.setLang = setLang;
window.getLang = () => currentLang;
window.i18nReady = Promise.all([ready, domReady]).then(() => {
  buildLangMenu();
  applyI18n();
});
