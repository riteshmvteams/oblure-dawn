/**
 * <oblure-hero-slider>
 *
 * Background slideshow of sections/oblure-hero.liquid, matching the old site's
 * Elementor slideshow: Swiper fade effect, autoplay, rewinds after the last slide,
 * no controls, and an optional slow "Ken Burns" zoom on the current image.
 *
 * - Needs two or more slides; with one it stays a static image.
 * - Autoplay is off for visitors who prefer reduced motion.
 * - Theme editor: selecting a Slide block shows it and pauses autoplay.
 *
 * Swiper (assets/swiper-bundle.min.js) is normally loaded by the section. The theme editor
 * doesn't run scripts in re-rendered sections, so it is loaded here if it isn't there yet.
 */
if (!customElements.get('oblure-hero-slider')) {
  let swiperPromise = null;

  const loadSwiper = (src) => {
    if (window.Swiper) return Promise.resolve();

    swiperPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.append(script);
    });

    return swiperPromise;
  };

  class OblureHeroSlider extends HTMLElement {
    static ZOOM_CLASS = 'is-zooming';

    #swiper = null;
    #abortController = null;

    async connectedCallback() {
      if (this.querySelectorAll('.swiper-slide').length < 2) return;

      try {
        await loadSwiper(this.dataset.swiperSrc);
      } catch (error) {
        console.error('[oblure-hero-slider]', error);
        return;
      }

      // The section may have been re-rendered while Swiper was loading.
      if (!this.isConnected || this.#swiper) return;

      this.#init();
      this.#bindEditorEvents();
    }

    disconnectedCallback() {
      this.#abortController?.abort();
      this.#swiper?.destroy(true, false);
      this.#swiper = null;
    }

    #init() {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.#swiper = new window.Swiper(this, {
        effect: 'fade',
        fadeEffect: { crossFade: true },
        speed: Number(this.dataset.transitionDuration) || 2000,
        rewind: true,
        allowTouchMove: false,
        autoplay: reduceMotion
          ? false
          : {
              delay: Number(this.dataset.slideDuration) || 4000,
              disableOnInteraction: false,
            },
        on: {
          // The incoming slide starts zooming as it fades in...
          slideChangeTransitionStart: (swiper) => this.#startZoom(swiper.slides[swiper.activeIndex]),
          // ...and the outgoing one keeps zooming until it has fully faded out.
          slideChangeTransitionEnd: (swiper) => this.#resetZoom(swiper.slides[swiper.activeIndex]),
        },
      });

      this.#startZoom(this.#swiper.slides[this.#swiper.activeIndex]);
    }

    /* Two frames so the browser paints the unzoomed state first and the transition runs. */
    #startZoom(slide) {
      if (!slide || !this.hasAttribute('data-zoom')) return;
      requestAnimationFrame(() => requestAnimationFrame(() => slide.classList.add(OblureHeroSlider.ZOOM_CLASS)));
    }

    #resetZoom(activeSlide) {
      this.#swiper?.slides.forEach((slide) => {
        if (slide !== activeSlide) slide.classList.remove(OblureHeroSlider.ZOOM_CLASS);
      });
    }

    #bindEditorEvents() {
      if (!window.Shopify?.designMode) return;

      this.#abortController = new AbortController();
      const { signal } = this.#abortController;

      document.addEventListener(
        'shopify:block:select',
        (event) => {
          const index = this.#swiper?.slides.indexOf(event.target);
          if (index === undefined || index < 0) return;

          this.#swiper.autoplay?.stop();
          this.#swiper.slideTo(index, 0);
          this.#startZoom(event.target);
          this.#resetZoom(event.target);
        },
        { signal }
      );

      document.addEventListener(
        'shopify:block:deselect',
        (event) => {
          if (!this.#swiper?.slides.includes(event.target)) return;
          // Respect reduced motion: only resume if autoplay was enabled at init.
          if (this.#swiper.params.autoplay?.enabled) this.#swiper.autoplay.start();
        },
        { signal }
      );
    }
  }

  customElements.define('oblure-hero-slider', OblureHeroSlider);
}
