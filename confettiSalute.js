/**
 * Запускает салют из конфетти внутри указанного блока.
 *
 * @param {HTMLElement} container   - блок (div), в котором рисуется салют
 * @param {string[]} colors         - массив цветов конфетти (CSS-цвета)
 * @param {number} duration         - общее время проигрывания салюта, мс
 * @param {number} shotInterval     - пауза между "выстрелами" (залпами), мс
 * @param {Function} callback       - вызывается после завершения и очистки памяти
 */
export function confettiSalute(container, colors, duration, shotInterval, callback) {
  console.log('Запуск салюта');
  if (!container) {
    if (typeof callback === 'function') callback();
    return;
  }
  console.log('Запуск салюта в блоке:', container);
  // --- подготовка canvas ---
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';

  const prevPosition = getComputedStyle(container).position;
  if (prevPosition === 'static') {
    container.style.position = 'relative';
  }

  const rect = container.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 300;
  const height = rect.height || container.clientHeight || 300;
  canvas.width = width;
  canvas.height = height;

  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let particles = [];
  let rafId = null;
  let shotTimerId = null;
  let stopTimerId = null;
  let stopped = false;

  const GRAVITY = 0.12;
  const FRICTION = 0.99;
  const PARTICLES_PER_SHOT = 60;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function createShot() {
    // случайная точка "выстрела" внизу блока
    const originX = randomBetween(width * 0.2, width * 0.8);
    const originY = height;
    // случайная точка взрыва конфетти в верхней части блока
    const targetY = randomBetween(height * 0.15, height * 0.5);

    for (let i = 0; i < PARTICLES_PER_SHOT; i++) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(2, 6);
      particles.push({
        x: originX,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: randomBetween(4, 8),
        color: randomColor(),
        rotation: randomBetween(0, Math.PI * 2),
        rotationSpeed: randomBetween(-0.2, 0.2),
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        alpha: 1,
        decay: randomBetween(0.005, 0.015)
      });
    }
  }

  function update() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.vy += GRAVITY;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0) return;

      ctx.save();
      ctx.globalAlpha = Math.max(p.alpha, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // убираем "умершие" частицы
    particles = particles.filter((p) => p.alpha > 0 && p.y < height + 50);

    if (!stopped) {
      rafId = requestAnimationFrame(update);
    }
  }

  function cleanup() {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (shotTimerId) clearInterval(shotTimerId);
    if (stopTimerId) clearTimeout(stopTimerId);

    ctx.clearRect(0, 0, width, height);
    canvas.remove();

    if (prevPosition === 'static') {
      container.style.position = '';
    }

    // явно освобождаем ссылки
    particles = [];
    rafId = null;
    shotTimerId = null;
    stopTimerId = null;

    if (typeof callback === 'function') callback();
  }

  // первый залп сразу, затем по интервалу
  createShot();
  shotTimerId = setInterval(createShot, shotInterval);
  rafId = requestAnimationFrame(update);

  stopTimerId = setTimeout(cleanup, duration);
}
