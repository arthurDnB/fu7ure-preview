(() => {
  "use strict";

  const dialog = document.getElementById("photo-viewer");
  if (typeof dialog?.showModal !== "function") return;

  window.createProductPhotoViewer = ({ name, alt, frames }) => {
    const viewport = dialog.querySelector(".photo-viewer-viewport");
    const image = viewport.querySelector("img");
    const caption = dialog.querySelector("#photo-viewer-caption");
    const reset = dialog.querySelector(".photo-viewer-reset");
    const zoomOut = dialog.querySelector('[data-zoom-step="-1"]');
    const zoomIn = dialog.querySelector('[data-zoom-step="1"]');
    const arrows = [...dialog.querySelectorAll("[data-photo-step]")];
    const maxZoom = 3;

    let index = 0;
    let zoom = 1;
    let opener;
    let drag;

    dialog.querySelector("#photo-viewer-title").textContent = name;
    arrows.forEach((arrow) => { arrow.hidden = frames.length < 2; });

    function sizeImage() {
      if (!dialog.open) return;
      const ratio = image.naturalWidth / image.naturalHeight || 1;
      const width = Math.min(viewport.clientWidth, viewport.clientHeight * ratio) * zoom;
      image.style.width = width + "px";
      image.style.height = width / ratio + "px";
    }

    function setZoom(level) {
      const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth;
      const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight;
      zoom = Math.min(maxZoom, Math.max(1, level));
      sizeImage();
      viewport.scrollLeft = viewport.scrollWidth * centerX - viewport.clientWidth / 2;
      viewport.scrollTop = viewport.scrollHeight * centerY - viewport.clientHeight / 2;
      viewport.toggleAttribute("data-zoomed", zoom > 1);
      zoomOut.setAttribute("aria-disabled", String(zoom === 1));
      zoomIn.setAttribute("aria-disabled", String(zoom === maxZoom));
      reset.textContent = Math.round(zoom * 100) + "%";
    }

    function displayPhoto(position) {
      index = (position + frames.length) % frames.length;
      const frame = frames[index];
      image.src = frame.src;
      image.alt = index === 0 ? alt : name + " — " + frame.label;
      caption.textContent = frame.label + " · " + (index + 1) + " / " + frames.length;
      setZoom(1);
    }

    const stepPhoto = (step) => {
      if (frames.length > 1) displayPhoto(index + step);
    };
    const stepZoom = (step) => setZoom(zoom + step * 0.5);

    arrows.forEach((arrow) => {
      arrow.addEventListener("click", () => stepPhoto(Number(arrow.dataset.photoStep)));
    });
    zoomOut.addEventListener("click", () => stepZoom(-1));
    zoomIn.addEventListener("click", () => stepZoom(1));
    reset.addEventListener("click", () => setZoom(1));
    image.addEventListener("load", sizeImage);
    new ResizeObserver(sizeImage).observe(viewport);

    dialog.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (direction) {
        if (event.shiftKey && zoom > 1) viewport.scrollLeft += direction * 64;
        else stepPhoto(direction);
      } else if (event.key === "+" || event.key === "=") {
        stepZoom(1);
      } else if (event.key === "-") {
        stepZoom(-1);
      } else if (event.key === "0") {
        setZoom(1);
      } else {
        return;
      }
      event.preventDefault();
    });

    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" || event.button !== 0 || zoom === 1) return;
      viewport.setPointerCapture(event.pointerId);
      drag = {
        x: event.clientX, y: event.clientY,
        left: viewport.scrollLeft, top: viewport.scrollTop,
      };
      viewport.setAttribute("data-dragging", "");
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!drag || !viewport.hasPointerCapture(event.pointerId)) return;
      viewport.scrollLeft = drag.left + drag.x - event.clientX;
      viewport.scrollTop = drag.top + drag.y - event.clientY;
    });
    viewport.addEventListener("lostpointercapture", () => {
      drag = undefined;
      viewport.removeAttribute("data-dragging");
    });
    dialog.addEventListener("close", () => opener?.focus({ preventScroll: true }));

    return (position, trigger) => {
      opener = trigger;
      dialog.showModal();
      displayPhoto(position);
    };
  };
})();
