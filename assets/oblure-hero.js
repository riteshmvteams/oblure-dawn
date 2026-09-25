/**
 * <oblure-hero>
 *
 * Used by sections/oblure-hero.liquid. Only does work when the section lays Dawn's
 * header over the image (`data-overlay-header`):
 * - keeps `--oblure-header-height` on <html> in sync with the header's height
 * - toggles `.oblure-header--scrolled` on `.section-header` after `data-scroll-offset` px
 */
if (!customElements.get('oblure-hero')) {
  class OblureHero extends HTMLElement {
    static SCROLLED_CLASS = 'oblure-header--scrolled';
    static OVERLAY_CLASS = 'oblure-header-overlay';

    #abortController = null;
    #resizeObserver = null;
    #frameId = null;

    connectedCallback() {
      if (!this.hasAttribute('data-overlay-header')) return;

      this.header = document.querySelector('.section-header');
      if (!this.header) return;

      this.scrollBackground = this.dataset.scrollBackground === 'true';
      this.scrollOffset = Number(this.dataset.scrollOffset) || 0;

      document.documentElement.classList.add(OblureHero.OVERLAY_CLASS);

      this.#abortController = new AbortController();
      this.#observeHeaderHeight();

      if (this.scrollBackground) {
        window.addEventListener('scroll', () => this.#requestUpdate(), {
          passive: true,
          signal: this.#abortController.signal,
        });
        this.#update();
      }
    }

    disconnectedCallback() {
      this.#abortController?.abort();
      this.#resizeObserver?.disconnect();
      if (this.#frameId) cancelAnimationFrame(this.#frameId);
      this.#frameId = null;

      // Leave the header exactly as Dawn renders it (e.g. when the section is removed in the editor).
      this.header?.classList.remove(OblureHero.SCROLLED_CLASS);
      document.documentElement.classList.remove(OblureHero.OVERLAY_CLASS);
      document.documentElement.style.removeProperty('--oblure-header-height');
    }

    #observeHeaderHeight() {
      // The theme editor re-renders sections without running their inline scripts,
      // so make sure a value exists even when the page is already scrolled.
      if (!document.documentElement.style.getPropertyValue('--oblure-header-height')) this.#setHeaderHeight();

      this.#resizeObserver = new ResizeObserver(() => {
        // Dawn's "Reduce logo size" sticky option shrinks the header while scrolling.
        // Only measure at the top of the page so the hero doesn't shift under it.
        if (window.scrollY > 0) return;
        this.#setHeaderHeight();
      });
      this.#resizeObserver.observe(this.header);
    }

    #setHeaderHeight() {
      document.documentElement.style.setProperty('--oblure-header-height', `${this.header.offsetHeight}px`);
    }

    #requestUpdate() {
      if (this.#frameId) return;
      this.#frameId = requestAnimationFrame(() => this.#update());
    }

    #update() {
      this.#frameId = null;
      this.header.classList.toggle(OblureHero.SCROLLED_CLASS, window.scrollY > this.scrollOffset);
    }
  }

  customElements.define('oblure-hero', OblureHero);
}
