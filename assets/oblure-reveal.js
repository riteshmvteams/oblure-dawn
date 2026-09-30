/**
 * <oblure-reveal>
 *
 * Reveals its [data-oblure-reveal-item] children (fade + rise from below, one after the
 * other) the first time it scrolls into view. Styles: assets/oblure-reveal.css.
 *
 * Content is only hidden once `oblure-js` is on <html> (set inline by the section), so it
 * stays visible without JavaScript. Visitors who prefer reduced motion see it right away.
 * Works in the theme editor too: a re-rendered section connects a fresh element.
 */
if (!customElements.get('oblure-reveal')) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  class OblureReveal extends HTMLElement {
    #observer = null;

    connectedCallback() {
      if (reducedMotion.matches || !('IntersectionObserver' in window)) {
        this.#reveal();
        return;
      }

      this.#observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          this.#reveal();
          this.#observer?.disconnect();
        },
        // Starts once a little of the section is inside the viewport's lower edge.
        { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
      );
      this.#observer.observe(this);
    }

    disconnectedCallback() {
      this.#observer?.disconnect();
    }

    #reveal() {
      this.classList.add('is-visible');
    }
  }

  customElements.define('oblure-reveal', OblureReveal);
}
