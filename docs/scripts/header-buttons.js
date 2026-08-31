document.getElementById('theme-toggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
});
const langToggle = document.getElementById('lang-toggle');
const langMenu = document.getElementById('lang-menu');
function closeLangMenu() { langMenu.hidden = true; }
function markActiveLang() {
  langMenu.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.toggle('bg-black/5', opt.dataset.lang === window.getLang());
    opt.classList.toggle('dark:bg-white/10', opt.dataset.lang === window.getLang());
  });
}
langToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  markActiveLang();
  langMenu.hidden = !langMenu.hidden;
});
langMenu.addEventListener('click', (e) => {
  const opt = e.target.closest('.lang-option');
  if (!opt) return;
  window.setLang(opt.dataset.lang);
  closeLangMenu();
});
document.addEventListener('click', (e) => {
  if (!langMenu.hidden && !langMenu.contains(e.target) && e.target !== langToggle) closeLangMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLangMenu(); });