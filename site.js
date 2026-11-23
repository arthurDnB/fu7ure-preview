(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const journey = byId("journey");
  const stage = byId("stage");
  const gallery = byId("still-sequence");
  const motionButton = byId("motion");
  const header = document.querySelector(".masthead");
  const front = byId("frame-front");
  const rear = byId("frame-detail");
  const finish = byId("frame-finish");
  const pillar = byId("pillar");
  const title = byId("look-title");
  const indexLabel = byId("look-index");
  const callouts = byId("callouts");
  const styleControls = [...callouts.querySelectorAll(".callout")].map((element) => ({
    element,
    link: element.querySelector("a"),
    label: element.querySelector(".style-name"),
  }));
  const viewLabel = byId("view-label");
  const tracker = byId("tracker-fill");
  const orbitButton = byId("orbit");
  const orbitLabel = byId("orbit-label");
  const jumps = [...document.querySelectorAll("[data-jump]")];
  const videoContainer = byId("videos");
  const merchandise = byId("merchandise");
  const collectionNav = merchandise.querySelector(".collection-nav");
  const collectionLinks = [...collectionNav.querySelectorAll("a")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const smallViewport = matchMedia("(max-height: 470px), (max-width: 760px) and (max-height: 560px)");
  const config = window.fu7ureVideos || {};

  const scenes = [...gallery.querySelectorAll(".still-look")].map((article) => {
    const [opening, reveal] = article.querySelectorAll("img");
    return {
      article,
      title: article.querySelector("h2").textContent,
      styles: [...article.querySelectorAll(".style-legend div")].map((item) => ({
        name: item.querySelector("dt a").firstChild.textContent.trim(),
        href: item.querySelector("dt a").getAttribute("href"),
        tone: item.dataset.tone,
      })),
      opening,
      reveal,
      videoPath: config[article.id],
      video: null,
    };
  });
  const last = scenes.length - 1;
  let manualMotion;
  let motionOn = false;
  let currentScene = -1;
  let currentProgress = 0;
  let modeInitialized = false;
  let backdrop = "";
  let frameRequest = 0;

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const ease = (value) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };

  function scrollRange() {
    const { top, height } = journey.getBoundingClientRect();
    return {
      start: top + scrollY - header.offsetHeight,
      distance: Math.max(1, height - stage.offsetHeight),
    };
  }

  function jumpTo(index, progress = 0) {
    const { start, distance } = scrollRange();
    scrollTo({ top: start + distance * (index + progress) / scenes.length, behavior: "instant" });
    schedule();
  }

  function selectScene(index) {
    const scene = scenes[index];
    currentScene = index;
    front.src = scene.opening.getAttribute("src");
    rear.src = scene.reveal.getAttribute("src");
    title.textContent = scene.title;
    styleControls.forEach(({ element, link, label }, styleIndex) => {
      const style = scene.styles[styleIndex];
      element.dataset.tone = style.tone;
      label.textContent = style.name;
      link.href = style.href;
    });
    indexLabel.textContent = String(index + 1).padStart(2, "0") + " / " + String(scenes.length).padStart(2, "0");
    jumps.forEach((button, buttonIndex) => {
      if (index === buttonIndex) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    ensureVideo(scene);
  }

  function ensureVideo(scene) {
    if (!scene.videoPath || scene.video) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.tabIndex = -1;
    scene.video = video;
    for (const event of ["loadedmetadata", "loadeddata", "progress", "seeked", "error"]) {
      video.addEventListener(event, schedule);
    }
    video.src = scene.videoPath;
    videoContainer.append(video);
  }

  function seekVideos(index, progress) {
    let filmReady = false;
    scenes.forEach(({ video }, videoIndex) => {
      if (!video) return;
      let visible = false;
      if (index === videoIndex && !video.error && Number.isFinite(video.duration) && video.seekable.length && video.seekable.end(video.seekable.length - 1) > 0) {
        const target = progress * Math.max(0, video.duration - 1 / 30);
        if (!video.seeking && Math.abs(video.currentTime - target) > 1 / 35) {
          video.currentTime = target;
        }
        if (video.readyState >= 2) video.dataset.decoded = "true";
        visible = video.dataset.decoded === "true";
      }
      video.style.opacity = visible ? "1" : "0";
      filmReady = filmReady || visible;
    });
    return filmReady;
  }

  function render() {
    if (!motionOn) return;
    const { start, distance } = scrollRange();
    const track = clamp((scrollY - start) / distance);
    const chapter = track * scenes.length;
    const index = Math.min(last, Math.floor(chapter + 0.001));
    const progress = clamp(chapter - index);
    const scene = scenes[index];
    if (index !== currentScene) selectScene(index);
    currentProgress = progress;

    const rearAmount = ease((progress - 0.19) / 0.34);
    const finishAmount = index === last ? ease((progress - 0.72) / 0.20) : 0;
    const visibleFrame = finishAmount >= 0.5 ? "CLOSING VIEW" : rearAmount >= 0.5 ? "REAR ANGLE" : "FRONT VIEW";
    front.style.setProperty("--scale", String(1 + 0.025 * ease(progress / 0.6)));
    rear.style.opacity = String(rearAmount);
    finish.style.opacity = String(finishAmount);

    const filmReady = seekVideos(index, progress);
    let offset = 101;
    if (!filmReady && index > 0 && progress < 0.15) {
      offset = -101 * ease(progress / 0.15);
    } else if (!filmReady && index < last && progress > 0.85) {
      offset = 101 * (1 - ease((progress - 0.85) / 0.15));
    }
    pillar.style.transform = "translateX(" + offset + "%)";
    const swapped = visibleFrame === "REAR ANGLE" && !filmReady;
    styleControls.forEach(({ element }, styleIndex) => {
      element.dataset.side = (styleIndex === 1) !== swapped ? "right" : "left";
    });
    callouts.toggleAttribute("data-film", filmReady);
    const wipeOpacity = offset <= 0 ? Math.abs(offset) / 101 : offset / 101;
    const labelOpacity = Math.max(0.18, wipeOpacity);
    const flipOpacity = filmReady ? 1 : Math.max(0.42, Math.abs(rearAmount - 0.5) * 2);
    const closingOpacity = filmReady || index !== last ? 1 : Math.max(0.42, Math.abs(finishAmount - 0.5) * 2);
    callouts.style.setProperty("--callout-opacity", String(Math.min(labelOpacity, flipOpacity, closingOpacity)));

    const art = visibleFrame === "CLOSING VIEW" ? finish : visibleFrame === "REAR ANGLE" ? scene.reveal : scene.opening;
    const artworkSource = art.getAttribute("src");
    if (artworkSource !== backdrop) {
      backdrop = artworkSource;
      stage.style.setProperty("--scene-image", 'url("' + backdrop + '")');
    }
    tracker.style.transform = "scaleX(" + track + ")";
    viewLabel.textContent = filmReady ? "DANCE FILM" : visibleFrame;
    front.alt = finishAmount >= 0.5 ? finish.dataset.description :
      rearAmount >= 0.5 ? scene.reveal.alt : scene.opening.alt;
    orbitLabel.textContent = progress < 0.54 ? "Scroll to explore" :
      index < last ? "Next styles" : progress < 0.94 ? "Closing view" : "Back to start";
  }

  function schedule() {
    if (!motionOn || frameRequest) return;
    frameRequest = requestAnimationFrame(() => {
      frameRequest = 0;
      render();
    });
  }

  function closestGalleryScene() {
    const probe = header.offsetHeight + innerHeight * 0.25;
    return scenes.reduce((closest, scene, index) =>
      scene.article.getBoundingClientRect().top <= probe ? index : closest, 0);
  }

  function syncMode() {
    const wasOn = motionOn;
    const anchor = byId(location.hash.slice(1));
    const keepMerchandise = anchor && merchandise.contains(anchor) &&
      (!modeInitialized || merchandise.getBoundingClientRect().top <= header.offsetHeight + 12);
    const resumeIndex = wasOn ? Math.max(0, currentScene) : closestGalleryScene();
    motionOn = !smallViewport.matches && (manualMotion ?? !reducedMotion.matches);
    motionButton.hidden = smallViewport.matches;
    motionButton.setAttribute("aria-pressed", String(motionOn));
    journey.hidden = !motionOn;
    gallery.hidden = motionOn;

    if (keepMerchandise) {
      if (!modeInitialized || motionOn !== wasOn) {
        requestAnimationFrame(() => anchor.scrollIntoView({ behavior: "instant" }));
      }
    } else if (motionOn && !wasOn) {
      const requested = scenes.findIndex(({ article }) => "#" + article.id === location.hash);
      jumpTo(requested >= 0 ? requested : resumeIndex, resumeIndex === 0 && requested < 0 ? 0 : 0.18);
    } else if (!motionOn && wasOn) {
      scenes[resumeIndex].article.scrollIntoView();
    }
    modeInitialized = true;
    schedule();
  }

  function markCollection() {
    const target = byId(location.hash.slice(1));
    const expandable = target?.closest(".product-expander");
    if (expandable && !expandable.open) {
      expandable.open = true;
      requestAnimationFrame(() => target.scrollIntoView({ behavior: "instant" }));
    }
    const parent = target?.closest(".collection");
    const activeHash = parent ? "#" + parent.id : location.hash;
    for (const link of collectionLinks) {
      if (link.getAttribute("href") === activeHash) {
        link.setAttribute("aria-current", "location");
        const navBounds = collectionNav.getBoundingClientRect();
        const linkBounds = link.getBoundingClientRect();
        if (linkBounds.left < navBounds.left) collectionNav.scrollLeft -= navBounds.left - linkBounds.left;
        else if (linkBounds.right > navBounds.right) collectionNav.scrollLeft += linkBounds.right - navBounds.right;
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }
  addEventListener("hashchange", markCollection);
  merchandise.querySelector(".accessory-jump").addEventListener("click", () => {
    byId("track-accessories").closest(".product-expander").open = true;
  });

  jumps.forEach((button, index) => button.addEventListener("click", () => jumpTo(index, index ? 0.17 : 0)));
  orbitButton.addEventListener("click", () => {
    if (currentProgress < 0.54) jumpTo(currentScene, 0.58);
    else if (currentScene < last) jumpTo(currentScene + 1, 0.17);
    else if (currentProgress < 0.94) jumpTo(last, 1);
    else jumpTo(0);
  });
  motionButton.hidden = false;
  motionButton.addEventListener("click", () => {
    manualMotion = !motionOn;
    syncMode();
  });
  reducedMotion.addEventListener("change", syncMode);
  smallViewport.addEventListener("change", syncMode);
  addEventListener("resize", schedule, { passive: true });
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("pageshow", schedule);

  // Start from nearby frames so a fast scroll never has to fetch the next chapter from scratch.
  addEventListener("load", () => {
    for (const scene of scenes) {
      for (const ref of [scene.opening, scene.reveal]) {
        const image = new Image();
        image.src = ref.getAttribute("src");
      }
    }
  }, { once: true });
  syncMode();
  markCollection();
})();
