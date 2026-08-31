// Speech-bubble tooltip, appended to <body> (fixed position) so it can
// float above a card without being clipped by its overflow-hidden.
let cardTooltip = null;
function getCardTooltip() {
  if (cardTooltip) return cardTooltip;
  cardTooltip = document.createElement('div');
  cardTooltip.className = 'fixed z-50 bg-zinc-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-lg opacity-0 pointer-events-none transition-opacity duration-150 max-w-[180px] text-center';
  cardTooltip.innerHTML = '<span class="tooltip-text"></span><span class="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900"></span>';
  document.body.appendChild(cardTooltip);
  return cardTooltip;
}
function showCardTooltip(el, text) {
  const tip = getCardTooltip();
  tip.querySelector('.tooltip-text').textContent = text;
  const rect = el.getBoundingClientRect();
  tip.style.left = (rect.left + rect.width / 2) + 'px';
  tip.style.top = (rect.top - 8) + 'px';
  tip.style.transform = 'translate(-50%, -100%)';
  tip.style.opacity = '1';
}
function hideCardTooltip() {
  if (cardTooltip) cardTooltip.style.opacity = '0';
}

const observer = new MutationObserver(() => {
  hideCardTooltip();
  const grid = document.getElementById('cards-grid');
  Array.from(grid.children).forEach(el => {
    if(!el.classList.contains('polished')) {
      const meta = el.children[1];
      const nameEl = meta.children[0];
      const scoreEl = meta.children[1];
      const cardName = nameEl.textContent;

      // Master container: clean borderless rectangle, forced aspect ratio
      el.className = 'relative polished opacity-0 hover:z-10 cursor-pointer overflow-hidden rounded shadow-sm border border-black/5 dark:border-white/10 group w-full aspect-[59/86] shrink-0';
      el.animate([
        { opacity: 0, transform: 'scale(0.9)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: 250, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });

      // Image crop (stretched back to physical card ratio)
      const canvas = el.children[0];
      canvas.className = 'absolute inset-0 w-full h-full object-fill transition-transform duration-500 group-hover:scale-110';

      // Hide original meta container
      meta.style.display = 'none';

      // Overlapping score
      const badge = document.createElement('div');
      badge.className = 'absolute top-0 left-0 bg-black/80 backdrop-blur text-emerald-400 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-br pointer-events-none';
      badge.textContent = scoreEl.textContent;
      el.appendChild(badge);

      el.addEventListener('mouseenter', () => showCardTooltip(el, cardName));
      el.addEventListener('mouseleave', hideCardTooltip);
    }
  });
});
observer.observe(document.getElementById('cards-grid'), { childList: true });