(() => {
  const narrowLayout = matchMedia("(max-width: 650px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const explorers = [...document.querySelectorAll("[data-explorer]")].map(setupExplorer);

  function setupExplorer(explorer) {
    const list = explorer.querySelector("[data-tabs]");
    const tabs = [...list.querySelectorAll("[data-target]")];
    const panels = tabs.map((tab) => document.getElementById(tab.dataset.target));
    const controls = explorer.querySelector("[data-step-controls]");
    const steps = controls ? [...controls.querySelectorAll("[data-step]")] : [];
    const count = controls?.querySelector("[data-count]");
    const map = list.classList.contains("map-controls");
    let active = -1;

    list.setAttribute("role", "tablist");
    for (const [index, tab] of tabs.entries()) {
      const panel = panels[index];
      tab.id = `${panel.id}-tab`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      panel.tabIndex = 0;
      tab.addEventListener("click", (event) => {
        select(index, true);
        if (map && narrowLayout.matches && event.detail > 0) {
          panel.scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
        }
      });
    }

    const setOrientation = () => {
      const vertical = map || (controls && !narrowLayout.matches);
      list.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
    };
    setOrientation();
    narrowLayout.addEventListener("change", setOrientation);

    function select(index, updateLink = false) {
      if (index < 0 || index >= tabs.length) return false;
      const selected = tabs[index];
      if (index !== active) {
        tabs.forEach((tab, i) => {
          tab.setAttribute("aria-selected", String(i === index));
          tab.tabIndex = i === index ? 0 : -1;
          panels[i].hidden = i !== index;
        });
        active = index;
        if (controls) {
          steps[0].disabled = active === 0;
          steps[1].disabled = active === tabs.length - 1;
          count.textContent = `${active + 1} of ${tabs.length}`;
        }
        const bounds = selected.getBoundingClientRect();
        const strip = list.getBoundingClientRect();
        if (bounds.left < strip.left) list.scrollLeft -= strip.left - bounds.left;
        if (bounds.right > strip.right) list.scrollLeft += bounds.right - strip.right;
      }
      if (updateLink) history.replaceState(history.state, "", "#" + panels[index].id);
      return true;
    }

    list.addEventListener("keydown", (event) => {
      if (!tabs.includes(event.target)) return;
      const vertical = list.getAttribute("aria-orientation") === "vertical";
      const previousKey = vertical ? "ArrowUp" : "ArrowLeft";
      const nextKey = vertical ? "ArrowDown" : "ArrowRight";
      const previous = (active - 1 + tabs.length) % tabs.length;
      const next = (active + 1) % tabs.length;
      const target = { [previousKey]: previous, [nextKey]: next, Home: 0, End: tabs.length - 1 }[event.key];
      if (!Number.isInteger(target)) return;
      event.preventDefault();
      select(target, true);
      tabs[target].focus({ preventScroll: true });
    });

    for (const [i, step] of steps.entries()) {
      step.addEventListener("click", () => {
        select(active + Number(step.dataset.step), true);
        if (step.disabled) steps[1 - i].focus({ preventScroll: true });
      });
    }
    const initial = panels.findIndex((panel) => "#" + panel.id === location.hash);
    list.hidden = false;
    if (controls) controls.hidden = false;
    explorer.dataset.ready = "";
    select(Math.max(0, initial));
    function reveal(id) {
      const index = panels.findIndex((panel) => panel.id === id);
      if (!select(index)) return null;
      if (map) return narrowLayout.matches ? panels[index] : list.closest(".city-map");
      return list;
    }
    return { panels, reveal };
  }

  function activateLink() {
    const id = location.hash.slice(1);
    for (const explorer of explorers) {
      const scrollTarget = explorer.reveal(id);
      if (!scrollTarget) continue;
      requestAnimationFrame(() => scrollTarget.scrollIntoView({ block: "start" }));
      break;
    }
  }

  if (explorers.some(({ panels }) => panels.some((panel) => "#" + panel.id === location.hash))) {
    addEventListener("load", activateLink, { once: true });
  }
  addEventListener("hashchange", activateLink);

  const progress = document.querySelector(".reading-track span");
  const nav = document.querySelector(".lore-subnav");
  const links = [...nav.querySelectorAll("a")];
  const sections = links.map((link) => document.getElementById(link.hash.slice(1)));
  let scheduled = false;

  function updateScrollState() {
    scheduled = false;
    const remaining = document.documentElement.scrollHeight - innerHeight;
    const ratio = remaining > 0 ? Math.min(1, Math.max(0, scrollY / remaining)) : 0;
    progress.style.transform = `scaleX(${ratio})`;
    const boundary = nav.getBoundingClientRect().bottom + 50;
    const active = sections.findLastIndex((section) => section.getBoundingClientRect().top <= boundary);
    links.forEach((link, index) => {
      if (index === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function scheduleScrollState() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateScrollState);
  }

  addEventListener("scroll", scheduleScrollState, { passive: true });
  addEventListener("resize", scheduleScrollState);
  new ResizeObserver(scheduleScrollState).observe(document.querySelector("main"));
  scheduleScrollState();
})();
