/**
 * Oblure animations: one shared script for the site's motion. Loaded once in layout/theme.liquid.
 *
 * 1. Reveal on scroll
 *    - <oblure-reveal>: its [data-oblure-reveal-item] children rise in, one after the other
 *      (styles in assets/oblure-animations.css). Used by the Oblure hero and rich text.
 *    - [data-oblure-reveal="<threshold>"] on any element: gets `.is-visible` once that share of it
 *      is on screen; the section styles the rest (image banner "featured-image", custom video,
 *      Stories gallery, side-by-side image). The threshold is capped for elements taller than the
 *      screen, so they always reveal.
 * 2. Lamp glow: [data-oblure-glow] gets a soft warm light that follows the pointer.
 *    Desktop pointers only.
 * 3. Rolling text on hover (Theme settings > Oblure animations): button and footer link labels
 *    are wrapped so they roll up to a copy of themselves (styles in oblure-animations.css).
 *    Only plain-text labels are wrapped; buttons whose content scripts update are left alone.
 * 4. Background videos: video[data-oblure-autoplay] plays only while on or near the screen and
 *    pauses otherwise (not at all for reduced motion), so off-screen videos cost nothing.
 * 5. Smooth scrolling (same settings group): Lenis (assets/lenis.min.js) on desktop pointers.
 *    It pauses while Dawn locks the page scroll (drawers, modals, the full page menu), and
 *    scrollable panels inside the page keep their own native scrolling.
 *
 * Reduced motion: everything is revealed at once and there is no glow.
 * Content is only hidden while this runs (`oblure-js` on <html>, set inline in theme.liquid; a
 * <noscript> style there shows it otherwise). Re-rendered sections in the theme editor are picked up.
 */
(() => {
  if (window.OblureAnimations) return;

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const ROLL_SELECTOR = [
    'a.button',
    '.oblure-hero__cta',
    '.oblure-rich-text__button',
    '.footer-block__details-content a.list-menu__item--link',
    '.image-gallery .text-container a',
  ].join(',');

  // Panels that scroll on their own; Lenis leaves wheel/touch there to the browser.
  const SMOOTH_SCROLL_PREVENT = [
    '[data-lenis-prevent]',
    '.oblure-fpm__panel',
    '.oblure-predictive-search__results',
    'cart-drawer',
    '.menu-drawer',
    '.mobile-facets__wrapper',
    '.predictive-search',
    '.disclosure__list-wrapper',
    'details[open] > .search-modal',
  ].join(',');

  // Classes Dawn (and the full page menu) put on <body> to lock page scrolling.
  const SCROLL_LOCK_CLASSES = ['overflow-hidden', 'overflow-hidden-mobile', 'overflow-hidden-tablet', 'overflow-hidden-desktop'];
  const DEFAULT_THRESHOLD = 0.2;
  const observers = new Map();

  const reveal = (element) => element.classList.add('is-visible');

  const getObserver = (threshold) => {
    if (!observers.has(threshold)) {
      observers.set(
        threshold,
        new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              reveal(entry.target);
              observer.unobserve(entry.target);
            });
          },
          { threshold, rootMargin: '0px 0px -10% 0px' }
        )
      );
    }
    return observers.get(threshold);
  };

  const observeReveal = (element, requestedThreshold) => {
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      reveal(element);
      return;
    }

    // An element taller than the screen can never be e.g. 70% visible; cap the threshold.
    const fitsRatio = Math.min(1, (window.innerHeight * 0.8) / Math.max(element.offsetHeight, 1));
    const threshold = Math.round(Math.min(requestedThreshold, fitsRatio) * 100) / 100;
    getObserver(threshold).observe(element);
  };

  const bindRevealAttribute = (element) => {
    if (element.hasAttribute('data-oblure-reveal-bound')) return;
    element.setAttribute('data-oblure-reveal-bound', '');

    const requested = parseFloat(element.dataset.oblureReveal);
    observeReveal(element, Number.isFinite(requested) ? requested : DEFAULT_THRESHOLD);
  };

  let autoplayObserver = null;

  const bindAutoplay = (video) => {
    if (video.hasAttribute('data-oblure-autoplay-bound')) return;
    video.setAttribute('data-oblure-autoplay-bound', '');

    autoplayObserver ??= new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting && !reducedMotion.matches) {
            // Can be refused (e.g. data saver); the poster then stays.
            target.play().catch(() => {});
          } else {
            target.pause();
          }
        });
      },
      { rootMargin: '200px 0px' }
    );
    autoplayObserver.observe(video);
  };

  const bindGlow = (element) => {
    if (element.querySelector(':scope > .oblure-glow')) return;

    const light = document.createElement('span');
    light.className = 'oblure-glow';
    light.setAttribute('aria-hidden', 'true');
    element.append(light);

    let frame = null;
    element.addEventListener('pointermove', (event) => {
      if (!finePointer.matches || reducedMotion.matches || frame) return;

      frame = requestAnimationFrame(() => {
        frame = null;
        const bounds = element.getBoundingClientRect();
        element.style.setProperty('--oblure-glow-x', `${event.clientX - bounds.left}px`);
        element.style.setProperty('--oblure-glow-y', `${event.clientY - bounds.top}px`);
        element.classList.add('is-glowing');
      });
    });
    element.addEventListener('pointerleave', () => element.classList.remove('is-glowing'));
  };

  /* Wraps a plain-text label as <span.oblure-roll><span.oblure-roll__text data-text>; the copy
     that rolls in is the ::after of the inner span. */
  const wrapRoll = (element) => {
    if (element.children.length > 0 || element.querySelector('.oblure-roll')) return;

    const label = element.textContent.trim();
    if (!label) return;

    const outer = document.createElement('span');
    outer.className = 'oblure-roll';
    const inner = document.createElement('span');
    inner.className = 'oblure-roll__text';
    inner.dataset.text = label;
    inner.textContent = label;
    outer.append(inner);
    element.replaceChildren(outer);
  };

  const scan = (scope = document) => {
    scope.querySelectorAll('[data-oblure-reveal]').forEach(bindRevealAttribute);
    scope.querySelectorAll('[data-oblure-glow]').forEach(bindGlow);
    scope.querySelectorAll('video[data-oblure-autoplay]').forEach(bindAutoplay);
    if ('oblureHoverRoll' in root.dataset) scope.querySelectorAll(ROLL_SELECTOR).forEach(wrapRoll);
  };

  const initSmoothScroll = () => {
    // The theme editor scrolls to selected sections itself; keep native scrolling there.
    if (!('oblureSmoothScroll' in root.dataset) || !window.Lenis || window.Shopify?.designMode) return;

    const desktop = window.matchMedia('(min-width: 990px) and (hover: hover) and (pointer: fine)');
    let lenis = null;

    const syncScrollLock = () => {
      if (!lenis) return;
      const locked = SCROLL_LOCK_CLASSES.some((className) => document.body.classList.contains(className));
      locked ? lenis.stop() : lenis.start();
    };

    const update = () => {
      const enabled = desktop.matches && !reducedMotion.matches;

      if (enabled && !lenis) {
        lenis = new window.Lenis({
          autoRaf: true,
          // Slightly more responsive than the default 0.1: glides, but follows the wheel closely.
          lerp: 0.14,
          anchors: true,
          allowNestedScroll: true,
          prevent: (node) => Boolean(node.closest?.(SMOOTH_SCROLL_PREVENT)),
        });
        syncScrollLock();
      } else if (!enabled && lenis) {
        lenis.destroy();
        lenis = null;
      }
    };

    new MutationObserver(syncScrollLock).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    desktop.addEventListener('change', update);
    reducedMotion.addEventListener('change', update);
    update();
  };

  if (!customElements.get('oblure-reveal')) {
    customElements.define(
      'oblure-reveal',
      class OblureReveal extends HTMLElement {
        connectedCallback() {
          observeReveal(this, DEFAULT_THRESHOLD);
        }
      }
    );
  }

  window.OblureAnimations = { scan };
  scan();
  initSmoothScroll();
  // Theme editor: sections are re-rendered without a page load.
  document.addEventListener('shopify:section:load', (event) => scan(event.target));
})();
