/**
 * <oblure-card-media>
 *
 * Video playback for the Oblure card (snippets/oblure-card-product.liquid) and Dawn's card
 * (snippets/card-product.liquid). Only rendered when a card has a Shopify-hosted video;
 * see snippets/oblure-card-video.liquid. Loaded globally in layout/theme.liquid, because
 * Dawn inserts some cards later (e.g. product recommendations).
 *
 * Attributes:
 * - data-has-secondary: the card shows a second media on hover.
 * - data-hover-media:   media query for when that hover swap happens (default "(hover: hover)";
 *                       Dawn's card only swaps from 990px wide).
 *
 * - A first-media video (`data-oblure-card-video="visible"`) plays while the card is on
 *   screen and pauses while the second media is shown on hover or the card scrolls away.
 * - A second-media video (`data-oblure-card-video="hover"`) restarts and plays on hover.
 * - Nothing plays for visitors who prefer reduced motion; the poster frames stay.
 * - Outside data-hover-media the second media never shows, so nothing plays for it.
 */
if (!customElements.get('oblure-card-media')) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  class OblureCardMedia extends HTMLElement {
    #abortController = null;
    #observer = null;
    #isVisible = false;
    #isHovered = false;

    connectedCallback() {
      this.card = this.closest('.oblure-card, .card-wrapper') ?? this;
      this.visibleVideo = this.querySelector('video[data-oblure-card-video="visible"]');
      this.hoverVideo = this.querySelector('video[data-oblure-card-video="hover"]');
      this.hasSecondary = this.hasAttribute('data-has-secondary');
      this.hoverQuery = window.matchMedia(this.dataset.hoverMedia || '(hover: hover)');

      this.#abortController = new AbortController();
      const { signal } = this.#abortController;

      if (this.visibleVideo) {
        this.#observer = new IntersectionObserver(
          ([entry]) => {
            this.#isVisible = entry.isIntersecting;
            this.#update();
          },
          { threshold: 0.25 }
        );
        this.#observer.observe(this);
      }

      if (this.hasSecondary) {
        // Hovering the Oblure card's color swatches doesn't count: the selected color's image
        // stays (same rule as the CSS). pointerover fires again for each child entered.
        this.card.addEventListener(
          'pointerover',
          (event) => this.#setHovered(!event.target.closest?.('.oblure-card__swatches-wrapper')),
          { signal }
        );
        this.card.addEventListener('pointerleave', () => this.#setHovered(false), { signal });
      }

      reducedMotion.addEventListener('change', () => this.#update(), { signal });
      this.hoverQuery.addEventListener(
        'change',
        () => {
          if (!this.hoverQuery.matches) this.#setHovered(false);
        },
        { signal }
      );
    }

    disconnectedCallback() {
      this.#abortController?.abort();
      this.#observer?.disconnect();
      this.visibleVideo?.pause();
      this.hoverVideo?.pause();
    }

    #setHovered(isHovered) {
      const wasHovered = this.#isHovered;
      this.#isHovered = isHovered && this.hoverQuery.matches;
      if (this.#isHovered === wasHovered) return;

      // Each hover starts the second video from the beginning.
      if (this.#isHovered && this.hoverVideo) this.hoverVideo.currentTime = 0;
      this.#update();
    }

    #update() {
      const motionAllowed = !reducedMotion.matches;
      const showingSecondary = this.#isHovered && this.hasSecondary;

      this.#setPlaying(this.visibleVideo, motionAllowed && this.#isVisible && !showingSecondary);
      this.#setPlaying(this.hoverVideo, motionAllowed && showingSecondary);
    }

    #setPlaying(video, shouldPlay) {
      if (!video) return;

      if (shouldPlay) {
        // Can be refused (e.g. data saver); the poster frame then simply stays.
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    }
  }

  customElements.define('oblure-card-media', OblureCardMedia);
}
