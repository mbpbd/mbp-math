/* MBP mobile menu: vanilla JS. Works with any framework or plain HTML. */
(function () {
  var burger = document.getElementById('mbpBurger');
  var menu = document.getElementById('mbpMenu');
  var sw = document.getElementById('mbpSw');
  if (!burger || !menu) return;

  function setOpen(open) {
    menu.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) {
      setTimeout(function () { var a = menu.querySelector('.mbp-list a'); if (a) a.focus({ preventScroll: true }); }, 450);
    }
  }

  burger.addEventListener('click', function () { setOpen(!menu.classList.contains('is-open')); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); burger.focus(); }
  });
  menu.querySelectorAll('.mbp-list a, .mbp-admin').forEach(function (a) {
    a.addEventListener('click', function () { setOpen(false); });
  });

  /* Mark the current page (amber bubble). Works for normal links; for SPA routers set aria-current yourself. */
  var path = location.pathname.replace(/\/+$/, '') || '/';
  menu.querySelectorAll('.mbp-list a').forEach(function (a) {
    var p = new URL(a.href, location.origin).pathname.replace(/\/+$/, '') || '/';
    if (p === path) a.setAttribute('aria-current', 'page');
  });

  /* Language switch: connect this event to your existing EN/বাংলা logic. */
  if (sw) {
    sw.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var lang = b.dataset.lang;
        sw.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        sw.classList.toggle('is-bn', lang === 'bn');
        menu.dataset.lang = lang;
        document.dispatchEvent(new CustomEvent('mbp:lang', { detail: { lang: lang } }));
      });
    });
  }
})();
