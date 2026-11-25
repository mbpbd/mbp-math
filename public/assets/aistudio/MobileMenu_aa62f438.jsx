// React version (Vite). Import "./mobile-menu.css" once. Keep <MobileMenu/> mounted at all times,
// because the closing animation needs the element to stay in the DOM.
import { useEffect, useRef, useState } from 'react';
import './mobile-menu.css';

const ITEMS = [
  { to: '/', en: 'Home', bn: 'হোম' },
  { to: '/register', en: 'Register', bn: 'নিবন্ধন' },
  { to: '/events', en: 'Events', bn: 'ইভেন্ট' },
  { to: '/notices', en: 'Notices', bn: 'নোটিশ' },
  { to: '/mbp-life', en: 'MBP Life', bn: 'এমবিপি জীবন' },
  { to: '/trainings', en: 'Trainings', bn: 'প্রশিক্ষণ' },
  { to: '/gallery', en: 'Gallery', bn: 'গ্যালারি' },
  { to: '/contact', en: 'Contact', bn: 'যোগাযোগ' },
];

export function MenuBurger({ open, onToggle }) {
  return (
    <button
      className={`mbp-burger${open ? ' is-open' : ''}`}
      type="button"
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="mbpMenu"
      onClick={onToggle}
    >
      <span /><span />
    </button>
  );
}

/* Props: open/onClose from the parent, lang ('en'|'bn') and onLang from your i18n,
   currentPath from your router (e.g. useLocation().pathname), isAdmin from your auth state,
   Link = your router's Link component (e.g. react-router-dom). */
export default function MobileMenu({ open, onClose, lang, onLang, currentPath, isAdmin, Link = 'a' }) {
  const ref = useRef(null);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && open && onClose();
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; };
  }, [open, onClose]);

  const linkProps = (to) => (Link === 'a' ? { href: to } : { to });

  return (
    <nav ref={ref} id="mbpMenu" className={`mbp-menu${open ? ' is-open' : ''}`} aria-label="Main menu" aria-hidden={!open} data-lang={lang}>
      <div className="mbp-bd" />
      {[0, 1, 2, 3, 4].map((i) => <i key={i} className="mbp-tb" />)}
      <div className="mbp-pn">
        <div className="mbp-lang">
          <span>{lang === 'bn' ? 'ভাষা' : 'Language'}</span>
          <div className={`mbp-sw${lang === 'bn' ? ' is-bn' : ''}`} role="group" aria-label="Language">
            <i />
            <button type="button" aria-pressed={lang === 'en'} onClick={() => onLang('en')}>English</button>
            <button type="button" aria-pressed={lang === 'bn'} onClick={() => onLang('bn')}>বাংলা</button>
          </div>
        </div>

        <ul className="mbp-list">
          {ITEMS.map((it) => (
            <li key={it.to}>
              <Link {...linkProps(it.to)} onClick={onClose} aria-current={currentPath === it.to ? 'page' : undefined}>
                {lang === 'bn' ? it.bn : it.en}
              </Link>
            </li>
          ))}
        </ul>

        {isAdmin && (
          <Link {...linkProps('/admin')} className="mbp-admin" onClick={onClose}>
            <span className="mbp-ic">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06" /><path d="M15 19l2 2l4 -4" /></svg>
            </span>
            <span className="mbp-tx">{lang === 'bn' ? 'অ্যাডমিন প্যানেল খুলুন' : 'Open admin panel'}</span>
            <span className="mbp-ar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}

/* Usage in your header component:
   const [open, setOpen] = useState(false);
   <header style={{ position: 'sticky', top: 0, zIndex: 50 }}> ... <MenuBurger open={open} onToggle={() => setOpen(o => !o)} /> </header>
   <MobileMenu open={open} onClose={() => setOpen(false)} lang={lang} onLang={setLang}
               currentPath={location.pathname} isAdmin={user?.isAdmin} Link={RouterLink} />
   Show both only on mobile, for example with a media query: @media (min-width: 768px) { .mbp-burger, .mbp-menu { display: none } } */
