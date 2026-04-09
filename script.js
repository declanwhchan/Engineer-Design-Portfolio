const homeLink = document.querySelector(".nav-brand");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.getElementById("site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const sectionRail = document.querySelector(".section-rail");
const sectionRailViewport = document.querySelector(".section-rail__viewport");
const sectionRailLinks = [...document.querySelectorAll("[data-section-link]")];
const landingSection = document.getElementById("landing");
const portfolioStartSection = document.getElementById("position");
const mediaCarousels = [...document.querySelectorAll("[data-carousel]")];
const waterCanvas = document.querySelector(".water-interaction");

const SCROLL_STATE_KEY = "engineering-portfolio-scroll-y";
const navigationEntry = performance.getEntriesByType?.("navigation")?.[0] ?? null;
const shouldRestoreScroll = navigationEntry?.type === "reload";
let hasRestoredInitialScroll = false;

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const WHEEL_ITEM_SPACING = 52;

let activeSectionIndex = 0;
let lastScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
let scrollStopTimer;
let isWheelDragging = false;
let wheelDragPointerId = null;
let wheelDragStartY = 0;
let wheelDragStartIndex = 0;
let wheelDragMoved = false;
let suppressWheelClick = false;
let wheelTargetIndex = null;
let wheelTargetTimer = null;
let waterInteractionInitialized = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSectionIndexById(sectionId) {
  return sectionRailLinks.findIndex((link) => link.dataset.sectionLink === sectionId);
}

function getSectionIdByIndex(index) {
  return sectionRailLinks[index]?.dataset.sectionLink ?? null;
}

function setWheelState(activeIndex) {
  if (!sectionRailLinks.length) {
    return;
  }

  const clampedIndex = clamp(activeIndex, 0, sectionRailLinks.length - 1);
  const nearestIndex = Math.round(clampedIndex);
  activeSectionIndex = clampedIndex;

  sectionRailLinks.forEach((link, index) => {
    const offset = index - clampedIndex;
    const absOffset = Math.abs(offset);
    const translate = offset * WHEEL_ITEM_SPACING;
    const scale = Math.max(0.72, 1 - absOffset * 0.12);
    const opacity = Math.max(0.18, 1 - absOffset * 0.22);
    const blur = Math.max(0, absOffset - 1) * 0.6;
    const tilt = offset * -11;
    const isActive = index === nearestIndex;

    link.classList.toggle("active", isActive);
    link.style.setProperty("--wheel-translate", `${translate}px`);
    link.style.setProperty("--wheel-scale", String(scale));
    link.style.setProperty("--wheel-opacity", String(opacity));
    link.style.setProperty("--wheel-blur", `${blur}px`);
    link.style.setProperty("--wheel-tilt", `${tilt}deg`);

    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function setActiveSection(sectionId) {
  const sectionIndex = getSectionIndexById(sectionId);
  if (sectionIndex >= 0) {
    setWheelState(sectionIndex);
  }
}

function holdWheelAtIndex(sectionIndex) {
  wheelTargetIndex = clamp(sectionIndex, 0, sectionRailLinks.length - 1);
  window.clearTimeout(wheelTargetTimer);
  setWheelState(wheelTargetIndex);

  wheelTargetTimer = window.setTimeout(() => {
    wheelTargetIndex = null;
    updateSectionRail();
  }, 900);
}

function scrollToSectionIndex(sectionIndex, behavior = "smooth") {
  const sectionId = getSectionIdByIndex(sectionIndex);
  const section = sectionId ? document.getElementById(sectionId) : null;

  if (!section) {
    return;
  }

  section.scrollIntoView({ behavior, block: "start" });
}

function findCurrentSectionId() {
  const viewportCenter = window.innerHeight * 0.42;
  let bestId = sectionRailLinks[0]?.dataset.sectionLink ?? null;
  let bestDistance = Number.POSITIVE_INFINITY;

  sectionRailLinks.forEach((link) => {
    const section = document.getElementById(link.dataset.sectionLink);
    if (!section) {
      return;
    }

    const rect = section.getBoundingClientRect();
    const sectionCenter = rect.top + rect.height / 2;
    const distance = Math.abs(sectionCenter - viewportCenter);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = section.id;
    }
  });

  return bestId;
}

function updateSectionRail() {
  if (isWheelDragging) {
    return;
  }

  const currentSectionId = findCurrentSectionId();

  if (wheelTargetIndex !== null) {
    setWheelState(wheelTargetIndex);

    if (currentSectionId && getSectionIndexById(currentSectionId) === wheelTargetIndex) {
      window.clearTimeout(wheelTargetTimer);
      wheelTargetIndex = null;
    }

    return;
  }

  if (currentSectionId) {
    setActiveSection(currentSectionId);
  }
}

function updateScrollBuddy() {
  const currentScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const isScrollingDown = currentScrollTop > lastScrollTop + 1;
  const isScrollingUp = currentScrollTop < lastScrollTop - 1;

  if (isScrollingDown) {
    document.body.classList.add("buddy-scroll-down");
    document.body.classList.remove("buddy-scroll-up");
  } else if (isScrollingUp) {
    document.body.classList.add("buddy-scroll-up");
    document.body.classList.remove("buddy-scroll-down");
  }

  lastScrollTop = Math.max(currentScrollTop, 0);

  window.clearTimeout(scrollStopTimer);
  scrollStopTimer = window.setTimeout(() => {
    document.body.classList.remove("buddy-scroll-down");
    document.body.classList.remove("buddy-scroll-up");
  }, 120);
}

function startWheelDrag(event) {
  if (!sectionRailViewport || !sectionRailLinks.length) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  window.clearTimeout(wheelTargetTimer);
  wheelTargetIndex = null;
  isWheelDragging = true;
  wheelDragPointerId = event.pointerId;
  wheelDragStartY = event.clientY;
  wheelDragStartIndex = activeSectionIndex;
  wheelDragMoved = false;

  sectionRail?.classList.add("section-rail--dragging");
  document.body.classList.add("section-rail-dragging");
  sectionRailViewport.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveWheelDrag(event) {
  if (!isWheelDragging || event.pointerId !== wheelDragPointerId) {
    return;
  }

  const deltaY = event.clientY - wheelDragStartY;
  if (Math.abs(deltaY) > 4) {
    wheelDragMoved = true;
  }

  const nextIndex = clamp(
    wheelDragStartIndex - deltaY / WHEEL_ITEM_SPACING,
    0,
    sectionRailLinks.length - 1
  );

  setWheelState(nextIndex);
  event.preventDefault();
}

function endWheelDrag(event) {
  if (!isWheelDragging || (event && event.pointerId !== wheelDragPointerId)) {
    return;
  }

  const snappedIndex = Math.round(activeSectionIndex);

  sectionRail?.classList.remove("section-rail--dragging");
  document.body.classList.remove("section-rail-dragging");

  if (sectionRailViewport && wheelDragPointerId !== null) {
    try {
      sectionRailViewport.releasePointerCapture?.(wheelDragPointerId);
    } catch (error) {
      // Ignore release errors when capture has already been cleared.
    }
  }

  isWheelDragging = false;
  wheelDragPointerId = null;

  if (wheelDragMoved) {
    suppressWheelClick = true;
    window.setTimeout(() => {
      suppressWheelClick = false;
    }, 220);

    holdWheelAtIndex(snappedIndex);
    scrollToSectionIndex(snappedIndex, "smooth");
  } else {
    setWheelState(snappedIndex);
  }
}

function updatePrePortfolioState() {
  if (!landingSection || !portfolioStartSection) {
    document.body.classList.remove("before-portfolio");
    return;
  }

  const portfolioTop = portfolioStartSection.getBoundingClientRect().top;
  document.body.classList.toggle("before-portfolio", portfolioTop > window.innerHeight * 0.2);
}

function initializeCarousel(carousel) {
  const slides = [...carousel.querySelectorAll(".media-carousel__slide")];
  const prevButton = carousel.querySelector(".media-carousel__button--prev");
  const nextButton = carousel.querySelector(".media-carousel__button--next");
  const currentLabel = carousel.querySelector("[data-carousel-current]");
  const totalLabel = carousel.querySelector("[data-carousel-total]");

  if (slides.length === 0) {
    return;
  }

  let currentIndex = 0;

  function getCircularOffset(index) {
    let offset = index - currentIndex;
    const half = slides.length / 2;

    if (offset > half) {
      offset -= slides.length;
    }

    if (offset < -half) {
      offset += slides.length;
    }

    return offset;
  }

  function updateCarousel() {
    slides.forEach((slide, index) => {
      const offset = getCircularOffset(index);
      let state = "hidden";
      let shift = 0;
      let rotate = 0;
      let scale = 0.7;

      if (offset === 0) {
        state = "active";
        shift = 0;
        rotate = 0;
        scale = 1;
      } else if (offset === -1) {
        state = "prev";
        shift = -260;
        rotate = 36;
        scale = 0.82;
      } else if (offset === 1) {
        state = "next";
        shift = 260;
        rotate = -36;
        scale = 0.82;
      }

      slide.dataset.state = state;
      slide.style.setProperty("--carousel-shift", `${shift}px`);
      slide.style.setProperty("--carousel-rotate", `${rotate}deg`);
      slide.style.setProperty("--carousel-scale", String(scale));
      slide.setAttribute("aria-hidden", state === "hidden" ? "true" : "false");
    });

    if (currentLabel) {
      currentLabel.textContent = String(currentIndex + 1);
    }

    if (totalLabel) {
      totalLabel.textContent = String(slides.length);
    }
  }

  prevButton?.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel();
  });

  nextButton?.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
  });

  updateCarousel();
}

window.addEventListener(
  "scroll",
  () => {
    updateScrollBuddy();
    updateSectionRail();
    updatePrePortfolioState();
  },
  { passive: true }
);

function readSavedScrollPosition() {
  try {
    const rawValue = sessionStorage.getItem(SCROLL_STATE_KEY);
    if (rawValue === null) {
      return null;
    }

    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  } catch (error) {
    return null;
  }
}

function persistScrollPosition() {
  try {
    sessionStorage.setItem(
      SCROLL_STATE_KEY,
      String(window.scrollY || document.documentElement.scrollTop || 0)
    );
  } catch (error) {
    // Ignore storage failures for local file previews.
  }
}

function getReloadTargetSection() {
  const hashTargetId = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";
  const hashTarget = hashTargetId ? document.getElementById(hashTargetId) : null;
  const hashSection = hashTarget?.closest?.(".section-shell") ?? hashTarget;

  if (hashSection instanceof HTMLElement) {
    return hashSection;
  }

  const savedScrollPosition = readSavedScrollPosition();
  if (savedScrollPosition === null) {
    return null;
  }

  const probeY = savedScrollPosition + 120;
  let bestSection = null;

  sectionRailLinks.forEach((link) => {
    const section = document.getElementById(link.dataset.sectionLink);
    if (!(section instanceof HTMLElement)) {
      return;
    }

    if (section.offsetTop <= probeY) {
      bestSection = section;
    }
  });

  return bestSection;
}

function restoreInitialScrollPosition() {
  if (hasRestoredInitialScroll || !shouldRestoreScroll) {
    return;
  }

  hasRestoredInitialScroll = true;

  const targetSection = getReloadTargetSection();
  if (!targetSection) {
    return;
  }

  targetSection.scrollIntoView({ behavior: "auto", block: "start" });
}

function initializePageState() {
  document.body.classList.remove("buddy-scroll-down");
  document.body.classList.remove("buddy-scroll-up");

  initializeCTMFCards();
  initializeInlineFigureSliders();
  initializeWaterInteraction();
  mediaCarousels.forEach(initializeCarousel);

  restoreInitialScrollPosition();
  lastScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  updatePrePortfolioState();
  updateSectionRail();

  window.requestAnimationFrame(() => {
    updatePrePortfolioState();
    updateSectionRail();
    document.documentElement.classList.remove("page-preload");
  });
}

window.addEventListener("resize", () => {
  updateSectionRail();
  updatePrePortfolioState();
});

window.addEventListener("pagehide", persistScrollPosition);
window.addEventListener("beforeunload", persistScrollPosition);

if (sectionRailViewport) {
  sectionRailViewport.addEventListener("pointerdown", startWheelDrag);
  sectionRailViewport.addEventListener("pointermove", moveWheelDrag);
  sectionRailViewport.addEventListener("pointerup", endWheelDrag);
  sectionRailViewport.addEventListener("pointercancel", endWheelDrag);
  sectionRailViewport.addEventListener("lostpointercapture", endWheelDrag);
}

sectionRailLinks.forEach((link, index) => {
  link.addEventListener("click", (event) => {
    if (suppressWheelClick) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    holdWheelAtIndex(index);
    scrollToSectionIndex(index, "smooth");
  });
});

if (homeLink) {
  homeLink.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (siteNav && siteNav.classList.contains("open")) {
      siteNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
});


function initializeCTMFCards() {
  const ctmfCards = [...document.querySelectorAll(".ctmf-stack .ctmf-card")];

  ctmfCards.forEach((card, index) => {
    if (card.querySelector(".ctmf-toggle")) {
      return;
    }

    const toggleButton = document.createElement("button");
    const cardId = card.id || `ctmf-card-${index + 1}`;
    const meta = card.querySelector(".ctmf-meta");

    card.id = cardId;
    toggleButton.type = "button";
    toggleButton.className = "ctmf-toggle";
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.setAttribute("aria-controls", cardId);
    toggleButton.innerHTML = '<span class="ctmf-toggle__arrow" aria-hidden="true">&darr;</span><span class="ctmf-toggle__label">Read More</span>';

    toggleButton.addEventListener("click", () => {
      const isExpanded = card.classList.toggle("is-expanded");
      toggleButton.setAttribute("aria-expanded", String(isExpanded));

      const arrow = toggleButton.querySelector(".ctmf-toggle__arrow");
      const label = toggleButton.querySelector(".ctmf-toggle__label");

      if (arrow) {
        arrow.innerHTML = isExpanded ? "&uarr;" : "&darr;";
      }

      if (label) {
        label.textContent = isExpanded ? "Show Less" : "Read More";
      }
    });

    meta?.insertAdjacentElement("afterend", toggleButton);
  });
}


initializePageState();

function initializeInlineFigureSliders() {
  const sliders = [...document.querySelectorAll("[data-inline-slider]")];

  sliders.forEach((slider) => {
    const slides = [...slider.querySelectorAll(".inline-figure-slider__slide")];
    const prevButton = slider.querySelector(".inline-figure-slider__button--prev");
    const nextButton = slider.querySelector(".inline-figure-slider__button--next");
    let dots = [...slider.querySelectorAll(".inline-figure-slider__dot")];

    function syncCaptionHeights() {
      const viewport = slider.querySelector(".inline-figure-slider__viewport");
      const viewportWidth = viewport?.clientWidth || slider.clientWidth || 0;
      let tallestCaption = 0;

      slides.forEach((slide) => {
        const caption = slide.querySelector("figcaption");
        if (!caption) {
          return;
        }

        const previousDisplay = slide.style.display;
        const previousPosition = slide.style.position;
        const previousVisibility = slide.style.visibility;
        const previousPointerEvents = slide.style.pointerEvents;
        const previousWidth = slide.style.width;
        const previousMaxWidth = slide.style.maxWidth;
        const previousMinWidth = slide.style.minWidth;

        slide.style.display = "grid";
        slide.style.position = "absolute";
        slide.style.visibility = "hidden";
        slide.style.pointerEvents = "none";

        if (viewportWidth) {
          slide.style.width = `${viewportWidth}px`;
          slide.style.maxWidth = `${viewportWidth}px`;
          slide.style.minWidth = `${viewportWidth}px`;
        }

        caption.style.minHeight = "0";
        caption.style.height = "auto";
        tallestCaption = Math.max(tallestCaption, Math.ceil(caption.getBoundingClientRect().height));

        slide.style.display = previousDisplay;
        slide.style.position = previousPosition;
        slide.style.visibility = previousVisibility;
        slide.style.pointerEvents = previousPointerEvents;
        slide.style.width = previousWidth;
        slide.style.maxWidth = previousMaxWidth;
        slide.style.minWidth = previousMinWidth;
      });

      slides.forEach((slide) => {
        const caption = slide.querySelector("figcaption");
        if (caption) {
          const captionHeight = tallestCaption ? `${tallestCaption}px` : "";
          caption.style.minHeight = captionHeight;
          caption.style.height = captionHeight;
        }
      });
    }

    if (slides.length < 2) {
      prevButton?.setAttribute("hidden", "hidden");
      nextButton?.setAttribute("hidden", "hidden");
      slides[0]?.classList.add("is-active");
      syncCaptionHeights();
      window.addEventListener("resize", syncCaptionHeights);
      window.addEventListener("load", syncCaptionHeights, { once: true });
      return;
    }

    let currentIndex = 0;

    if (!dots.length) {
      const dotsWrapper = document.createElement("div");
      dotsWrapper.className = "inline-figure-slider__dots";
      dotsWrapper.setAttribute("aria-label", "Figure slider position");

      slides.forEach((slide, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "inline-figure-slider__dot";
        dot.setAttribute("aria-label", "Show figure " + (index + 1));
        dot.addEventListener("click", () => {
          currentIndex = index;
          updateSlides();
        });
        dotsWrapper.appendChild(dot);
      });

      slider.appendChild(dotsWrapper);
      dots = [...dotsWrapper.querySelectorAll(".inline-figure-slider__dot")];
    }

    function updateSlides() {
      slides.forEach((slide, index) => {
        const isActive = index === currentIndex;
        slide.classList.toggle("is-active", isActive);
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");
      });

      dots.forEach((dot, index) => {
        const isActive = index === currentIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    }

    syncCaptionHeights();
    window.addEventListener("resize", syncCaptionHeights);
    window.addEventListener("load", syncCaptionHeights, { once: true });

    prevButton?.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      updateSlides();
    });

    nextButton?.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % slides.length;
      updateSlides();
    });

    updateSlides();
  });
}



function initializeWaterInteraction() {
  if (
    waterInteractionInitialized ||
    !waterCanvas ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }

  waterInteractionInitialized = true;

  const context = waterCanvas.getContext("2d");
  if (!context) {
    return;
  }

  const ripples = [];
  const droplets = [];
  const trailPoints = [];
  const pointer = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.35,
    active: false
  };

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    waterCanvas.width = Math.round(window.innerWidth * ratio);
    waterCanvas.height = Math.round(window.innerHeight * ratio);
    waterCanvas.style.width = `${window.innerWidth}px`;
    waterCanvas.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function addRipple(x, y, radius, strength, speed, colorShift = 0) {
    ripples.push({
      x,
      y,
      radius,
      strength,
      speed,
      life: 1,
      colorShift
    });
  }

  function addDropletBurst(x, y) {
    for (let index = 0; index < 9; index += 1) {
      const angle = (Math.PI * 2 * index) / 9 + Math.random() * 0.28;
      const velocity = 1.2 + Math.random() * 1.8;
      droplets.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 0.4,
        radius: 1.4 + Math.random() * 2.2,
        life: 1
      });
    }
  }

  function updatePointer(x, y) {
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;

    const lastPoint = trailPoints[trailPoints.length - 1];
    const dx = lastPoint ? x - lastPoint.x : 999;
    const dy = lastPoint ? y - lastPoint.y : 999;
    const distance = Math.hypot(dx, dy);

    if (!lastPoint || distance > 14) {
      trailPoints.push({
        x,
        y,
        life: 1
      });
    }

    if (trailPoints.length > 8) {
      trailPoints.shift();
    }
  }

  function renderTrail() {
    if (trailPoints.length < 2) {
      return;
    }

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let index = 1; index < trailPoints.length; index += 1) {
      const previous = trailPoints[index - 1];
      const current = trailPoints[index];
      const fade = current.life * (index / trailPoints.length);
      const gradient = context.createLinearGradient(previous.x, previous.y, current.x, current.y);
      gradient.addColorStop(0, `rgba(104, 210, 255, ${0.02 + fade * 0.08})`);
      gradient.addColorStop(0.5, `rgba(152, 238, 255, ${0.06 + fade * 0.16})`);
      gradient.addColorStop(1, `rgba(206, 245, 255, ${0.03 + fade * 0.08})`);

      context.beginPath();
      context.strokeStyle = gradient;
      context.lineWidth = 6 + fade * 14;
      context.moveTo(previous.x, previous.y);
      context.quadraticCurveTo(
        (previous.x + current.x) / 2,
        (previous.y + current.y) / 2,
        current.x,
        current.y
      );
      context.stroke();
    }

    context.restore();
  }

  function renderRipples() {
    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const ripple = ripples[index];
      ripple.radius += ripple.speed;
      ripple.life *= 0.968;

      if (ripple.life < 0.03) {
        ripples.splice(index, 1);
        continue;
      }

      const glow = context.createRadialGradient(
        ripple.x,
        ripple.y,
        Math.max(0, ripple.radius * 0.2),
        ripple.x,
        ripple.y,
        ripple.radius
      );
      glow.addColorStop(0, `hsla(${194 + ripple.colorShift}, 100%, 84%, 0)`);
      glow.addColorStop(0.55, `hsla(${198 + ripple.colorShift}, 100%, 78%, ${ripple.strength * ripple.life})`);
      glow.addColorStop(1, `hsla(${204 + ripple.colorShift}, 100%, 72%, 0)`);

      context.beginPath();
      context.strokeStyle = glow;
      context.lineWidth = 1.2 + ripple.life * 3.4;
      context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function renderDroplets() {
    for (let index = droplets.length - 1; index >= 0; index -= 1) {
      const droplet = droplets[index];
      droplet.x += droplet.vx;
      droplet.y += droplet.vy;
      droplet.vx *= 0.988;
      droplet.vy = droplet.vy * 0.988 + 0.015;
      droplet.life *= 0.958;

      if (droplet.life < 0.04) {
        droplets.splice(index, 1);
        continue;
      }

      context.beginPath();
      context.fillStyle = `rgba(185, 240, 255, ${droplet.life * 0.6})`;
      context.arc(droplet.x, droplet.y, droplet.radius * droplet.life + 0.4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function tick() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    trailPoints.forEach((point, index) => {
      point.life *= index === trailPoints.length - 1 ? 0.992 : 0.955;
    });

    while (trailPoints.length && trailPoints[0].life < 0.08) {
      trailPoints.shift();
    }

    if (pointer.active && trailPoints.length) {
      const shimmer = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 44);
      shimmer.addColorStop(0, "rgba(220, 249, 255, 0.16)");
      shimmer.addColorStop(0.4, "rgba(115, 214, 255, 0.08)");
      shimmer.addColorStop(1, "rgba(115, 214, 255, 0)");
      context.fillStyle = shimmer;
      context.beginPath();
      context.arc(pointer.x, pointer.y, 44, 0, Math.PI * 2);
      context.fill();
    }

    renderTrail();
    renderRipples();
    renderDroplets();
    window.requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resizeCanvas);

  window.addEventListener(
    "pointermove",
    (event) => {
      updatePointer(event.clientX, event.clientY);
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerdown",
    (event) => {
      updatePointer(event.clientX, event.clientY);
      addRipple(event.clientX, event.clientY, 12, 0.34, 2.1, 8);
      addRipple(event.clientX, event.clientY, 27, 0.18, 1.45, 0);
      addDropletBurst(event.clientX, event.clientY);
    },
    { passive: true }
  );

  resizeCanvas();
  tick();
}

function setCTMFCardExpanded(card, shouldExpand) {
  if (!card) {
    return;
  }

  const toggleButton = card.querySelector('.ctmf-toggle');
  card.classList.toggle('is-expanded', shouldExpand);

  if (!toggleButton) {
    return;
  }

  toggleButton.setAttribute('aria-expanded', String(shouldExpand));

  const arrow = toggleButton.querySelector('.ctmf-toggle__arrow');
  const label = toggleButton.querySelector('.ctmf-toggle__label');

  if (arrow) {
    arrow.innerHTML = shouldExpand ? '&uarr;' : '&darr;';
  }

  if (label) {
    label.textContent = shouldExpand ? 'Show Less' : 'Read More';
  }
}

function openCTMFCardById(cardId) {
  const targetCard = document.getElementById(cardId);
  if (!targetCard) {
    return;
  }

  const cardStack = targetCard.closest('.ctmf-stack');
  cardStack?.querySelectorAll('.ctmf-card.is-expanded').forEach((card) => {
    if (card !== targetCard) {
      setCTMFCardExpanded(card, false);
    }
  });

  setCTMFCardExpanded(targetCard, true);

  const parentSection = targetCard.closest('.section-shell');
  if (parentSection?.id) {
    const sectionIndex = getSectionIndexById(parentSection.id);
    if (sectionIndex >= 0) {
      holdWheelAtIndex(sectionIndex);
    }
  }

  window.requestAnimationFrame(() => {
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

const ctmfNavLinks = [...document.querySelectorAll('[data-ctmf-link]')];

ctmfNavLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.dataset.ctmfTarget;
    if (!targetId) {
      return;
    }

    event.preventDefault();
    openCTMFCardById(targetId);

    const navItem = link.closest('.site-nav__item--has-menu');
    const parentSectionHref = navItem?.querySelector('.site-nav__link')?.getAttribute('href');
    if (parentSectionHref && parentSectionHref.startsWith('#')) {
      window.requestAnimationFrame(() => {
        history.replaceState(null, '', parentSectionHref);
      });
    }

    if (siteNav && siteNav.classList.contains('open')) {
      siteNav.classList.remove('open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    }
  });
});





