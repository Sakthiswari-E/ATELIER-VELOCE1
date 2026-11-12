// Atelier Véloce - Interactive Engine (Vanilla JS)
// Enhanced Animation System inspired by NestSpace architecture

// Signal that JavaScript has loaded and executed successfully
document.documentElement.classList.add('js-ready');

// Top-level state declarations - defined FIRST to prevent any Temporal Dead Zone errors
let lenisInstance = null;
let smoothScrollInitialized = false;
let scrollRevealsInitialized = false;

function initAtelier() {
  const subsystems = [
    ['Theme & RTL', initThemeAndRtl],
    ['Smooth Scroll', initSmoothScroll],
    ['Scroll Reveals', initScrollReveals],
    ['Counters', initAnimatedCounters],
    ['Hero Parallax', initHeroParallax],
    ['Navbar', initNavbar],
    ['Before/After', initBeforeAfterSliders],
    ['Cost Estimator', initCostEstimator],
    ['Consultation Modal', initConsultationModal],
    ['Portfolio Filters', initPortfolioFilters],
    ['Lightbox', initLightbox],
    ['FAQ Accordions', initFaqAccordions],
    ['Material Explorer', initMaterialExplorer],
    ['Toast & Forms', initToastAndForms],
  ];

  subsystems.forEach(([name, fn]) => {
    try {
      fn();
    } catch (err) {
      console.warn(`[Atelier] Non-fatal initialization notice in ${name}:`, err);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAtelier);
} else {
  initAtelier();
}

/* -------------------------------------------------------------
   0. Lenis Smooth Momentum Scrolling
   ------------------------------------------------------------- */
function initSmoothScroll() {
  if (smoothScrollInitialized) return;
  smoothScrollInitialized = true;

  if (lenisInstance) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  try {
    const LenisClass = window.Lenis || globalThis.Lenis || (typeof Lenis !== 'undefined' ? Lenis : null);
    if (LenisClass) {
      lenisInstance = new LenisClass({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        touchMultiplier: 1.5,
      });

      // Global reference for debugging and external integrations
      window.lenis = lenisInstance;

      let rafId = null;
      function raf(time) {
        if (lenisInstance) {
          lenisInstance.raf(time);
          rafId = requestAnimationFrame(raf);
        }
      }
      rafId = requestAnimationFrame(raf);

      // GSAP / ScrollTrigger sync if present
      if (typeof ScrollTrigger !== 'undefined') {
        lenisInstance.on('scroll', ScrollTrigger.update);
        if (typeof gsap !== 'undefined') {
          gsap.ticker.add((time) => {
            lenisInstance.raf(time * 1000);
          });
          gsap.ticker.lagSmoothing(0);
        }
      }
    }
  } catch (e) {
    console.warn('Lenis smooth scroll initialization skipped:', e);
  }

  // Smooth scroll for in-page anchors
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;
      try {
        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();
          if (lenisInstance && typeof lenisInstance.scrollTo === 'function') {
            lenisInstance.scrollTo(targetElem, { offset: -90 });
          } else {
            targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      } catch (err) {
        // Invalid selector, ignore gracefully
      }
    });
  });
}

/* -------------------------------------------------------------
   0.1 Bi-Directional Scroll Reveal System
   ------------------------------------------------------------- */
function initScrollReveals() {
  if (scrollRevealsInitialized) return;
  scrollRevealsInitialized = true;

  const revealElements = document.querySelectorAll(
    '.reveal, .reveal-left, .reveal-right, .reveal-scale, .img-curtain-reveal'
  );
  if (revealElements.length === 0) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealElements.forEach(el => el.classList.add('revealed'));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const el = entry.target;
        if (entry.isIntersecting) {
          el.classList.add('revealed');
        } else {
          // Reverse exit only when scrolling back UP above the element (element is below viewport)
          if (entry.boundingClientRect.top > 0) {
            el.classList.remove('revealed');
          }
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: '0px 0px -35px 0px'
    }
  );

  revealElements.forEach(el => revealObserver.observe(el));

  // Immediate check for elements currently visible in viewport (e.g. hero section)
  requestAnimationFrame(() => {
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('revealed');
      }
    });
  });

  // Failsafe timer: guarantee all above-the-fold content is revealed even on slow scroll triggers
  setTimeout(() => {
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 150) {
        el.classList.add('revealed');
      }
    });
  }, 800);
}

/* -------------------------------------------------------------
   0.2 Animated Counters with Bi-directional Replay
   ------------------------------------------------------------- */
function initAnimatedCounters() {
  const counters = document.querySelectorAll('.counter-val');
  if (counters.length === 0) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const target = entry.target;
        if (entry.isIntersecting) {
          const rawTarget = target.getAttribute('data-target') || '0';
          const endValue = parseFloat(rawTarget);
          const isDecimal = rawTarget.includes('.');
          const duration = 1400;
          const prefix = target.getAttribute('data-prefix') || '';
          const suffix = target.getAttribute('data-suffix') || '';
          const startTime = performance.now();

          if (prefersReduced) {
            target.textContent = `${prefix}${rawTarget}${suffix}`;
            return;
          }

          function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic curve
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const currentVal = easeOutProgress * endValue;

            if (isDecimal) {
              target.textContent = `${prefix}${currentVal.toFixed(1)}${suffix}`;
            } else {
              target.textContent = `${prefix}${Math.floor(currentVal).toLocaleString()}${suffix}`;
            }

            if (progress < 1) {
              target._counterRaf = requestAnimationFrame(updateCounter);
            } else {
              target.textContent = `${prefix}${isDecimal ? endValue.toFixed(1) : endValue.toLocaleString()}${suffix}`;
            }
          }

          if (target._counterRaf) cancelAnimationFrame(target._counterRaf);
          target._counterRaf = requestAnimationFrame(updateCounter);
        } else {
          // Reset on exit so returning replays counter
          if (target._counterRaf) cancelAnimationFrame(target._counterRaf);
          const prefix = target.getAttribute('data-prefix') || '';
          const suffix = target.getAttribute('data-suffix') || '';
          target.textContent = `${prefix}0${suffix}`;
        }
      });
    },
    { threshold: 0.15 }
  );

  counters.forEach(c => counterObserver.observe(c));
}

/* -------------------------------------------------------------
   0.3 Hero Subtle Mouse & Scroll Parallax
   ------------------------------------------------------------- */
function initHeroParallax() {
  const heroSection = document.querySelector('section');
  const parallaxItems = document.querySelectorAll('.parallax-subtle');
  if (!heroSection || parallaxItems.length === 0) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  heroSection.addEventListener('mousemove', (e) => {
    if (window.innerWidth < 1024) return;
    const rect = heroSection.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width - 0.5;
    const yRatio = (e.clientY - rect.top) / rect.height - 0.5;

    parallaxItems.forEach(item => {
      const speed = parseFloat(item.getAttribute('data-parallax-speed') || '12');
      const x = xRatio * speed;
      const y = yRatio * speed;
      item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  });

  heroSection.addEventListener('mouseleave', () => {
    parallaxItems.forEach(item => {
      item.style.transform = 'translate3d(0, 0, 0)';
    });
  });
}

/* -------------------------------------------------------------
   1. Theme (Dark/Light) & RTL Management
   ------------------------------------------------------------- */
function initThemeAndRtl() {
  const darkToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  const rtlToggleBtns = document.querySelectorAll('.rtl-toggle-btn');

  // Check initial dark mode
  const savedTheme = localStorage.getItem('atelier_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcons();

  darkToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      const isDark = document.documentElement.classList.contains('dark');
      localStorage.setItem('atelier_theme', isDark ? 'dark' : 'light');
      updateThemeIcons();
    });
  });

  // Check initial RTL
  const savedRtl = localStorage.getItem('atelier_rtl');
  if (savedRtl === 'rtl') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', 'en');
  }

  rtlToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const currentDir = document.documentElement.getAttribute('dir');
      const newDir = currentDir === 'rtl' ? 'ltr' : 'rtl';
      document.documentElement.setAttribute('dir', newDir);
      document.documentElement.setAttribute('lang', newDir === 'rtl' ? 'ar' : 'en');
      localStorage.setItem('atelier_rtl', newDir);
    });
  });
}

function updateThemeIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  document.querySelectorAll('.theme-icon-sun').forEach(el => {
    el.style.display = isDark ? 'block' : 'none';
  });
  document.querySelectorAll('.theme-icon-moon').forEach(el => {
    el.style.display = isDark ? 'none' : 'block';
  });
}

/* -------------------------------------------------------------
   2. Responsive Navbar & Mobile Drawer
   ------------------------------------------------------------- */
function initNavbar() {
  const header = document.querySelector('header');
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const backdrop = document.getElementById('mobile-backdrop');
  const homeDropdownBtn = document.getElementById('home-dropdown-btn');
  const homeDropdownMenu = document.getElementById('home-dropdown-menu');

  // Sticky header elevation & scroll direction tracker
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
  window.addEventListener('scroll', () => {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    if (Math.abs(currentScrollY - lastScrollY) > 4) {
      const direction = currentScrollY > lastScrollY ? 'down' : 'up';
      document.documentElement.setAttribute('data-scroll-direction', direction);
      lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    }

    if (currentScrollY > 20) {
      header?.classList.add('shadow-md', 'backdrop-blur-md');
    } else {
      header?.classList.remove('shadow-md');
    }
  }, { passive: true });

  // Highlight active nav indicator based on URL
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('nav-active');
    }
  });

  // Mobile menu toggle
  function toggleMobileMenu(forceClose = false) {
    if (!mobileMenu || !backdrop) return;
    const isCurrentlyOpen = !mobileMenu.classList.contains('hidden');
    const shouldClose = forceClose ? true : isCurrentlyOpen;

    const toggleSvg = mobileToggle?.querySelector('svg');

    if (shouldClose) {
      mobileMenu.classList.add('hidden');
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (lenisInstance && typeof lenisInstance.start === 'function') {
        lenisInstance.start();
      }
      mobileToggle?.setAttribute('aria-expanded', 'false');
      if (toggleSvg) {
        toggleSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />';
      }
    } else {
      mobileMenu.classList.remove('hidden');
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (lenisInstance && typeof lenisInstance.stop === 'function') {
        lenisInstance.stop();
      }
      mobileToggle?.setAttribute('aria-expanded', 'true');
      if (toggleSvg) {
        toggleSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />';
      }
    }
  }

  mobileToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileMenu();
  });
  backdrop?.addEventListener('click', () => toggleMobileMenu(true));

  // Close mobile menu when any navigation link or CTA button inside it is clicked
  mobileMenu?.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => {
      toggleMobileMenu(true);
    });
  });

  // Client Login action handler
  document.querySelectorAll('a[href="#login"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.showToast === 'function') {
        window.showToast('Client Portal: Authentication is currently active for commissioned clients.');
      }
    });
  });

  // Home dropdown desktop
  homeDropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    homeDropdownMenu?.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (homeDropdownMenu && !homeDropdownMenu.contains(e.target) && !homeDropdownBtn?.contains(e.target)) {
      homeDropdownMenu.classList.add('hidden');
    }
  });

  // Escape key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleMobileMenu(true);
      homeDropdownMenu?.classList.add('hidden');
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1280) {
      toggleMobileMenu(true);
    }
  });
}

/* -------------------------------------------------------------
   3. Interactive Before & After Renovation Slider
   ------------------------------------------------------------- */
function initBeforeAfterSliders() {
  const containers = document.querySelectorAll('.before-after-container');

  containers.forEach(container => {
    const divider = container.querySelector('.before-after-divider');
    const beforeOverlay = container.querySelector('.before-after-overlay');
    let isDragging = false;

    function updatePosition(clientX) {
      const rect = container.getBoundingClientRect();
      let percent = ((clientX - rect.left) / rect.width) * 100;
      if (percent < 1) percent = 1;
      if (percent > 99) percent = 99;

      divider.style.left = `${percent}%`;
      beforeOverlay.style.clipPath = `polygon(0 0, ${percent}% 0, ${percent}% 100%, 0 100%)`;
    }

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      updatePosition(e.clientX);
    });

    container.addEventListener('touchstart', (e) => {
      isDragging = true;
      if (e.touches[0]) updatePosition(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) updatePosition(e.clientX);
    });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches[0]) updatePosition(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('touchend', () => { isDragging = false; });
  });
}

/* -------------------------------------------------------------
   4. Interactive Design Process Cost & Timeline Estimator
   ------------------------------------------------------------- */
function initCostEstimator() {
  const root = document.getElementById('cost-estimator');
  if (!root) return;

  // Handle Home-Premium Estimator variant if present
  const disciplineBtns = root.querySelectorAll('.estimator-discipline-btn');
  if (disciplineBtns.length > 0) {
    initPremiumEstimator(root, disciplineBtns);
    return;
  }

  const typeBtns = root.querySelectorAll('.estimator-type-btn');
  const slider = root.querySelector('#estimator-area-slider');
  const areaVal = root.querySelector('#estimator-area-val');
  const tierBtns = root.querySelectorAll('.estimator-tier-btn');
  const demolitionCheck = root.querySelector('#estimator-demolition');
  const joineryCheck = root.querySelector('#estimator-joinery');
  const resultBudget = root.querySelector('#estimator-total-budget');
  const resultTimeline = root.querySelector('#estimator-total-timeline');
  const resultRate = root.querySelector('#estimator-rate-sqft');
  const bookBtn = root.querySelector('#estimator-book-btn');

  let spaceType = 'residential';
  let areaSqFt = 2400;
  let designTier = 'signature';

  const baseRates = {
    residential: { signature: 38, couture: 65 },
    penthouse: { signature: 45, couture: 80 },
    kitchen: { signature: 60, couture: 95 },
    commercial: { signature: 32, couture: 55 },
  };

  function calculate() {
    const rate = baseRates[spaceType][designTier];
    let total = areaSqFt * rate;
    if (demolitionCheck?.checked) total += 6500;
    if (joineryCheck?.checked) total += 12000;

    let weeks = 8;
    if (areaSqFt > 1500) weeks = 12;
    if (areaSqFt > 3500) weeks = 16;
    if (areaSqFt > 6000) weeks = 22;
    if (designTier === 'couture') weeks += 4;

    if (resultBudget) resultBudget.textContent = `$${total.toLocaleString()}`;
    if (resultTimeline) resultTimeline.textContent = `${weeks} - ${weeks + 3} Weeks`;
    if (resultRate) resultRate.textContent = `$${rate} / sq.ft`;
    if (areaVal) areaVal.textContent = `${Number(areaSqFt).toLocaleString()} sq.ft`;
  }

  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('border-brand-secondary', 'bg-brand-secondary/15', 'font-bold'));
      btn.classList.add('border-brand-secondary', 'bg-brand-secondary/15', 'font-bold');
      spaceType = btn.dataset.type;
      calculate();
    });
  });

  tierBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tierBtns.forEach(b => b.classList.remove('border-brand-secondary', 'bg-brand-secondary/15'));
      btn.classList.add('border-brand-secondary', 'bg-brand-secondary/15');
      designTier = btn.dataset.tier;
      calculate();
    });
  });

  slider?.addEventListener('input', (e) => {
    areaSqFt = Number(e.target.value);
    calculate();
  });

  demolitionCheck?.addEventListener('change', calculate);
  joineryCheck?.addEventListener('change', calculate);

  bookBtn?.addEventListener('click', () => {
    openConsultationModal({
      discipline: spaceType === 'kitchen' ? 'Modular Kitchens' : spaceType === 'commercial' ? 'Commercial Workspaces' : 'Residential Architecture',
      area: `${areaSqFt.toLocaleString()} sq.ft`
    });
  });

  calculate();
}

function initPremiumEstimator(root, disciplineBtns) {
  const slider = root.querySelector('#estimator-sqft-slider');
  const sqftDisplay = root.querySelector('#estimator-sqft-display');
  const tierBtns = root.querySelectorAll('.estimator-tier-btn');
  const costDisplay = root.querySelector('#estimator-cost-display');
  const timeDisplay = root.querySelector('#estimator-time-display');
  const rateDisplay = root.querySelector('#estimator-rate-sqft');
  const bookBtn = root.querySelector('#estimator-book-btn');

  let discipline = 'residential';
  let sqft = 2500;
  let tier = 'signature';

  const rates = {
    residential: { standard: 32, signature: 38, haute: 65 },
    commercial: { standard: 28, signature: 32, haute: 55 },
    kitchen: { standard: 48, signature: 60, haute: 95 },
    turnkey: { standard: 36, signature: 44, haute: 75 }
  };

  const activeClasses = ['border-brand-secondary', 'bg-brand-secondary', 'text-brand-primary', 'font-bold'];
  const inactiveClasses = ['border-[#3D3A36]', 'text-[#FAF8F5]'];

  function update() {
    const rate = rates[discipline]?.[tier] || 38;
    const baseTotal = sqft * rate;
    const low = Math.round(baseTotal * 0.95);
    const high = Math.round(baseTotal * 1.18);

    let minWeeks = 8;
    let maxWeeks = 12;
    if (sqft > 1500) { minWeeks = 10; maxWeeks = 14; }
    if (sqft > 3500) { minWeeks = 14; maxWeeks = 18; }
    if (sqft > 6000) { minWeeks = 18; maxWeeks = 24; }
    if (tier === 'haute') { minWeeks += 2; maxWeeks += 4; }

    if (costDisplay) costDisplay.textContent = `$${low.toLocaleString()} – $${high.toLocaleString()}`;
    if (timeDisplay) timeDisplay.textContent = `${minWeeks} – ${maxWeeks} Weeks`;
    if (rateDisplay) rateDisplay.textContent = `$${rate} / sq.ft`;
    if (sqftDisplay) sqftDisplay.textContent = `${Number(sqft).toLocaleString()} sq.ft`;
  }

  disciplineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      disciplineBtns.forEach(b => {
        b.classList.remove(...activeClasses);
        b.classList.add(...inactiveClasses);
      });
      btn.classList.remove(...inactiveClasses);
      btn.classList.add(...activeClasses);
      discipline = btn.dataset.discipline || 'residential';
      update();
    });
  });

  tierBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tierBtns.forEach(b => {
        b.classList.remove(...activeClasses);
        b.classList.add(...inactiveClasses);
      });
      btn.classList.remove(...inactiveClasses);
      btn.classList.add(...activeClasses);
      tier = btn.dataset.tier || 'signature';
      update();
    });
  });

  slider?.addEventListener('input', (e) => {
    sqft = Number(e.target.value);
    update();
  });

  bookBtn?.addEventListener('click', () => {
    const disciplineMap = {
      residential: 'Residential Architecture',
      commercial: 'Commercial Workspaces',
      kitchen: 'Modular Kitchens',
      turnkey: 'Turnkey Renovation'
    };
    openConsultationModal({
      discipline: disciplineMap[discipline] || 'Residential Architecture',
      area: `${sqft.toLocaleString()} sq.ft`
    });
  });

  update();
}

/* -------------------------------------------------------------
   5. Complimentary Consultation Modal
   ------------------------------------------------------------- */
function initConsultationModal() {
  const modal = document.getElementById('consultation-modal');
  const openBtns = document.querySelectorAll('[data-open-consultation]');
  const closeBtns = modal?.querySelectorAll('[data-close-consultation]');
  const form = document.getElementById('consultation-form');
  const confirmBox = document.getElementById('consultation-confirmation');
  const refDisplay = document.getElementById('consultation-ref-display');
  const resetBtn = document.getElementById('consultation-reset-btn');

  openBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openConsultationModal();
    });
  });

  closeBtns?.forEach(btn => {
    btn.addEventListener('click', () => {
      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
      document.body.style.overflow = '';
    });
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const ref = `AV-${Math.floor(100000 + Math.random() * 900000)}`;
    if (refDisplay) refDisplay.textContent = ref;
    form.classList.add('hidden');
    confirmBox?.classList.remove('hidden');
  });

  resetBtn?.addEventListener('click', () => {
    form?.reset();
    form?.classList.remove('hidden');
    confirmBox?.classList.add('hidden');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
    document.body.style.overflow = '';
  });
}

function openConsultationModal(prefill = {}) {
  const modal = document.getElementById('consultation-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';

  if (prefill.discipline) {
    const select = modal.querySelector('select[name="projectDiscipline"]');
    if (select) select.value = prefill.discipline;
  }
}

/* -------------------------------------------------------------
   6. Portfolio Category Filtering (Smooth Animated Transition)
   ------------------------------------------------------------- */
function initPortfolioFilters() {
  const filterBtns = document.querySelectorAll('.portfolio-filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  if (filterBtns.length === 0) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('border-brand-secondary', 'bg-brand-secondary', 'text-brand-primary', 'font-bold');
        b.classList.add('border-brand-border');
      });
      btn.classList.add('border-brand-secondary', 'bg-brand-secondary', 'text-brand-primary', 'font-bold');
      btn.classList.remove('border-brand-border');

      const cat = btn.dataset.category;
      projectCards.forEach((card, index) => {
        const matches = (cat === 'All' || card.dataset.category === cat);
        if (matches) {
          card.classList.remove('hidden');
          card.style.opacity = '0';
          card.style.transform = 'translateY(16px) scale(0.96)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) scale(1)';
          }, (index % 4) * 50);
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
}

/* -------------------------------------------------------------
   7. Image Lightbox Modal
   ------------------------------------------------------------- */
let currentLightboxImages = [];
let currentLightboxIdx = 0;

function initLightbox() {
  const modal = document.getElementById('lightbox-modal');
  const closeBtn = document.getElementById('lightbox-close-btn');
  const prevBtn = document.getElementById('lightbox-prev-btn');
  const nextBtn = document.getElementById('lightbox-next-btn');

  closeBtn?.addEventListener('click', () => {
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
    document.body.style.overflow = '';
  });

  prevBtn?.addEventListener('click', () => {
    if (currentLightboxImages.length === 0) return;
    currentLightboxIdx = (currentLightboxIdx > 0) ? currentLightboxIdx - 1 : currentLightboxImages.length - 1;
    updateLightboxImage();
  });

  nextBtn?.addEventListener('click', () => {
    if (currentLightboxImages.length === 0) return;
    currentLightboxIdx = (currentLightboxIdx < currentLightboxImages.length - 1) ? currentLightboxIdx + 1 : 0;
    updateLightboxImage();
  });

  document.addEventListener('keydown', (e) => {
    if (modal && !modal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
      }
      if (e.key === 'ArrowLeft') prevBtn?.click();
      if (e.key === 'ArrowRight') nextBtn?.click();
    }
  });

  // Attach to zoom buttons
  document.querySelectorAll('[data-open-lightbox]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const imagesAttr = btn.dataset.images;
      const title = btn.dataset.title || '';
      currentLightboxImages = imagesAttr ? imagesAttr.split(',') : [btn.dataset.src];
      currentLightboxIdx = 0;
      openLightbox(title);
    });
  });
}

function openLightbox(title = '') {
  const modal = document.getElementById('lightbox-modal');
  const titleEl = document.getElementById('lightbox-title');
  if (!modal) return;
  if (titleEl) titleEl.textContent = title;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  updateLightboxImage();
}

function updateLightboxImage() {
  const imgEl = document.getElementById('lightbox-img');
  const counterEl = document.getElementById('lightbox-counter');
  if (imgEl && currentLightboxImages[currentLightboxIdx]) {
    imgEl.src = currentLightboxImages[currentLightboxIdx];
  }
  if (counterEl) {
    counterEl.textContent = `${currentLightboxIdx + 1} / ${currentLightboxImages.length}`;
  }
}

/* -------------------------------------------------------------
   8. FAQ Accordions
   ------------------------------------------------------------- */
function initFaqAccordions() {
  const triggers = document.querySelectorAll('.faq-trigger');
  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const parent = trigger.closest('.faq-item');
      const content = parent.querySelector('.faq-content');
      const icon = trigger.querySelector('.faq-icon');
      const isExpanded = !content.classList.contains('hidden');

      // Close other FAQs
      document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
      document.querySelectorAll('.faq-icon').forEach(i => i.classList.remove('rotate-180'));

      if (!isExpanded) {
        content.classList.remove('hidden');
        icon?.classList.add('rotate-180');
      }
    });
  });
}

/* -------------------------------------------------------------
   9. Material Swatch Explorer (Home Premium)
   ------------------------------------------------------------- */
function initMaterialExplorer() {
  const swatches = document.querySelectorAll('.material-swatch-btn');
  const previewImg = document.getElementById('swatch-preview-img');
  const titleEl = document.getElementById('swatch-title');
  const originEl = document.getElementById('swatch-origin');
  const finishEl = document.getElementById('swatch-finish');
  const descEl = document.getElementById('swatch-desc');

  if (swatches.length === 0) return;

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('border-brand-secondary', 'bg-brand-secondary', 'text-brand-primary', 'font-bold'));
      swatch.classList.add('border-brand-secondary', 'bg-brand-secondary', 'text-brand-primary', 'font-bold');

      if (previewImg) previewImg.src = swatch.dataset.img;
      if (titleEl) titleEl.textContent = swatch.dataset.name;
      if (originEl) originEl.textContent = `${swatch.dataset.category} • ${swatch.dataset.origin}`;
      if (finishEl) finishEl.textContent = `Finish: ${swatch.dataset.finish}`;
      if (descEl) descEl.textContent = swatch.dataset.desc;
    });
  });
}

/* -------------------------------------------------------------
   10. Toast Notification System & Form Feedback
   ------------------------------------------------------------- */
function initToastAndForms() {
  // Global Toast Dispatcher
  window.showToast = function (message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    const icon = type === 'success'
      ? `<svg class="w-4 h-4 text-brand-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
      : `<svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

    toast.innerHTML = `
      <div class="w-6 h-6 border border-brand-secondary/40 flex items-center justify-center shrink-0">
        ${icon}
      </div>
      <div class="flex-1 leading-snug">${message}</div>
      <button class="text-[#A39B92] hover:text-[#FAF8F5] transition-colors p-1" aria-label="Close notification">&times;</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    const closeBtn = toast.querySelector('button');
    const dismiss = () => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 400);
    };

    closeBtn?.addEventListener('click', dismiss);
    setTimeout(dismiss, 4500);
  };

  // Intercept lookbook newsletter forms
  document.querySelectorAll('footer form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (input && input.value) {
        window.showToast(`Monographs subscription confirmed for ${input.value}.`);
        input.value = '';
      }
    });
  });
}


