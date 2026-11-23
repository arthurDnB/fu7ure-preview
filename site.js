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
  const imageStage = byId("image-stage");
  const stageFooter = stage.querySelector(".stage-footer");
  const styleControls = [...callouts.querySelectorAll(".callout")].map((element) => ({
    element,
    link: element.querySelector("a"),
    label: element.querySelector(".style-name"),
    logo: element.querySelector(".style-mark"),
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

  const sceneDesigns = {
    "r2-sasha": {
      brands: [{ name: "R2", logo: "r2" }, { name: "MOLOT", logo: "molot" }],
      front: [[.365, .39], [.62, .405]], rear: [[.64, .41], [.34, .40]],
    },
    "tsubasa-qu4nt": {
      brands: [{ name: "H4J1ME", logo: "h4j1me" }, { name: "8888", logo: "8888" }],
      front: [[.33, .40], [.665, .365]], rear: [[.67, .41], [.328, .385]],
    },
    "v3sp3r-l0wk3y": {
      brands: [{ name: "R4V3NS", logo: "ravens" }, { name: "ROLL3RZ", logo: "rollers" }],
      front: [[.365, .415], [.663, .395]], rear: [[.655, .414], [.332, .391]],
      finish: [[.587, .395], [.753, .344]],
    },
  };

  const scenes = [...gallery.querySelectorAll(".still-look")].map((article) => {
    const [opening, reveal] = article.querySelectorAll("img");
    return {
      article,
      design: sceneDesigns[article.id],
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
    styleControls.forEach(({ element, link, label, logo }, styleIndex) => {
      const style = scene.styles[styleIndex];
      element.dataset.tone = style.tone;
      label.textContent = style.name;
      const mark = scene.design.brands[styleIndex];
      logo.src = "media/marks/" + mark.logo + ".png";
      logo.alt = mark.name;
      logo.title = mark.name;
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

  function followCast(design, rearAmount, finishAmount, frontScale) {
    const stageBox = stage.getBoundingClientRect();
    const imageBox = imageStage.getBoundingClientRect();
    const cover = getComputedStyle(front).objectFit === "cover";
    const ratio = front.naturalWidth / front.naturalHeight || 16 / 9;
    const height = (cover ? Math.max : Math.min)(imageBox.height, imageBox.width / ratio);
    const width = height * ratio;
    const noMargin = stageBox.width < 600;
    const margin = noMargin ? 12 : Math.max(16, stageBox.width * .023);
    const gap = noMargin ? 9 : 17;
    const limitY = stageFooter.offsetTop - 8;
    const lerp = (from, to, amount) => from + (to - from) * amount;
    const within = (value, low, high) => Math.max(low, Math.min(value, high));
    const offsets = design.front.map(([frontX, frontY], index) => {
      const [rearX, rearY] = design.rear[index];
      const [finishX, finishY] = design.finish?.[index] || design.front[index];
      const u = lerp(lerp(frontX, rearX, rearAmount), finishX, finishAmount);
      const v = lerp(lerp(frontY, rearY, rearAmount), finishY, finishAmount);
      const nudge = lerp(frontScale, 1, Math.max(rearAmount, finishAmount));
      return {
        x: within(imageBox.left - stageBox.left + imageBox.width / 2 + (u - .5) * width * nudge, margin, stageBox.width - margin),
        y: within(imageBox.top - stageBox.top + imageBox.height / 2 + (v - .5) * height * nudge, margin, limitY),
        control: styleControls[index],
      };
    }).sort((a, b) => a.x - b.x);

    offsets.forEach((offset, index) => {
      const { link } = offset.control;
      offset.w = link.offsetWidth;
      offset.h = link.offsetHeight;
      const preferred = index === 0 ? offset.x - offset.w - gap : offset.x + gap;
      offset.left = within(preferred, margin, stageBox.width - margin - offset.w);
      const docked = noMargin || Math.abs(preferred - offset.left) > 10;
      const top = docked ? offset.y + Math.max(offset.h + 10, imageBox.height * .17) : offset.y - offset.h / 2;
      offset.top = within(top, margin, limitY - offset.h);
    });

    const [left, right] = offsets;
    if (left.left + left.w + gap > right.left && Math.abs(left.top - right.top) < Math.max(left.h, right.h)) {
      left.left = Math.max(margin, right.left - left.w - gap);
      if (left.left + left.w + gap > right.left) {
        left.top = within(right.top - left.h - gap, margin, limitY - left.h);
      }
    }

    offsets.forEach(({ control, x, y, left, top, w, h }) => {
      const dx = within(x, left, left + w) - x;
      const dy = within(y, top, top + h) - y;
      const style = control.element.style;
      style.setProperty("--pin-x", x + "px");
      style.setProperty("--pin-y", y + "px");
      style.setProperty("--label-x", left + "px");
      style.setProperty("--label-y", top + "px");
      style.setProperty("--leader-width", Math.hypot(dx, dy) + "px");
      style.setProperty("--leader-angle", Math.atan2(dy, dx) + "rad");
    });
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
    const frontScale = 1 + 0.025 * ease(progress / 0.6);
    front.style.setProperty("--scale", String(frontScale));
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
    followCast(scene.design, rearAmount, finishAmount, frontScale);
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
    const destination = anchor?.closest("[data-after-film]");
    const keepSection = destination &&
      (!modeInitialized || destination.getBoundingClientRect().top <= header.offsetHeight + 12);
    const resumeIndex = wasOn ? Math.max(0, currentScene) : closestGalleryScene();
    motionOn = !smallViewport.matches && (manualMotion ?? !reducedMotion.matches);
    motionButton.hidden = smallViewport.matches;
    motionButton.setAttribute("aria-pressed", String(motionOn));
    journey.hidden = !motionOn;
    gallery.hidden = motionOn;

    if (keepSection) {
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
  styleControls.forEach(({ logo }) => logo.addEventListener("load", schedule));
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
