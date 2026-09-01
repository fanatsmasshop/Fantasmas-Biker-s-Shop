(() => {
  'use strict';
  const body = document.body;
  const now = Date.now();
  const fallbackEvent = new Date('2026-08-24T11:00:00-06:00').getTime();
  const qs = s => document.querySelector(s);

  body.classList.add('fbs-ui-2026');
  if (now > fallbackEvent) body.classList.add('fbs-postevent');

  const alliesNotice = qs('#aliados .proximamente');
  if (alliesNotice && /pr[oó]xim/i.test(alliesNotice.textContent || '')) {
    alliesNotice.textContent = 'ALIADOS FANTASMA YA ESTÁ ACTIVO';
    const link = document.createElement('a');
    link.className = 'fbs-allies-link';
    link.href = 'https://aliados-fantasma.pages.dev/';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Explorar Aliados Fantasma →';
    alliesNotice.after(link);
  }

  const raffleSection = qs('#rifas');
  const raffleGrid = qs('#listaRifas');
  const syncRaffles = () => {
    if (!raffleSection || !raffleGrid) return;
    const count = raffleGrid.querySelectorAll('.rifa').length;
    const loaded = window.FANTASMAS_PUBLIC_READY || raffleGrid.children.length > 0;
    if (count > 0) {
      body.classList.remove('fbs-no-raffles');
      raffleSection.hidden = false;
    } else if (loaded) {
      body.classList.add('fbs-no-raffles');
      raffleSection.hidden = true;
    }
  };
  if (raffleGrid) new MutationObserver(syncRaffles).observe(raffleGrid,{childList:true,subtree:true});
  window.addEventListener('fantasmas:public-ready', syncRaffles);
  window.addEventListener('load', () => { setTimeout(syncRaffles,700); setTimeout(syncRaffles,2500); }, {once:true});

  const revealTargets = [...document.querySelectorAll('main > section, main > .franja')].filter(el => !el.hidden && el.id !== 'inicio');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('fbs-visible');
      io.unobserve(entry.target);
    }),{threshold:.06,rootMargin:'0px 0px -35px'});
    revealTargets.forEach(el => { el.classList.add('fbs-section-reveal'); io.observe(el); });
  } else revealTargets.forEach(el => el.classList.add('fbs-visible'));

  const productSection = qs('#productosPublicos');
  if (productSection) new MutationObserver(() => {
    if (!productSection.hidden) requestAnimationFrame(() => productSection.classList.add('fbs-visible'));
  }).observe(productSection,{attributes:true,attributeFilter:['hidden']});

  // El contador heredado no debe volver a mostrar 00:00:00:00 después del evento.
  const countdown = qs('#countdown');
  if (countdown) {
    const cleanExpired = () => {
      const values = [...countdown.querySelectorAll('strong')].map(el => (el.textContent || '').trim());
      if (body.classList.contains('fbs-postevent') || (values.length && values.every(v => v === '00'))) countdown.hidden = true;
    };
    new MutationObserver(cleanExpired).observe(countdown,{childList:true,subtree:true,characterData:true});
    cleanExpired();
  }
})();
