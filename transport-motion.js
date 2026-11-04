// Keep the original illustration as fallback until the animation layers load.
const scene = document.querySelector('[data-transport-scene]');
if (scene) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = scene.querySelector('.transport-motion');
  const still = scene.querySelector('.transport-still');
  const button = scene.querySelector('.transport-toggle');
  let ready = false;
  let paused = false;
  let visible = false;
  const update = () => {
    const active = ready && !reducedMotion.matches;
    motion.toggleAttribute('hidden', !active);
    still.hidden = active;
    button.hidden = !active;
    const running = active && visible && !paused && !document.hidden;
    scene.classList.toggle('motion-running', running);
    scene.classList.toggle('motion-enabled', active);
    scene.closest('.journey-intro').classList.toggle('journey-driving', running);
    scene.closest('.journey-intro').classList.toggle('journey-road-enabled', active);
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? 'Animatie afspelen' : 'Animatie pauzeren';
  };
  button.addEventListener('click', () => { paused = !paused; update(); });
  reducedMotion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
  observer.observe(scene);
  const preload = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = src;
  });
  // Start loading near the viewport; loading failure leaves the static image intact.
  const loader = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    loader.disconnect();
    Promise.all(['assets/transport-empty.png', 'assets/transport-illustration.png'].map(preload))
      .then(() => {
        motion.querySelectorAll('image[data-href]').forEach(image => {
          image.setAttribute('href', image.dataset.href);
        });
        ready = true;
        update();
      })
      .catch(() => { ready = false; update(); });
  }, { rootMargin: '200px' });
  loader.observe(scene);
}
