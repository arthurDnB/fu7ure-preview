(() => {
  "use strict";

  const destinations = {
    AU: {
      country: "Australia",
      regionLabel: "State or territory",
      regions: ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"],
      sample: { city: "Brisbane", region: "QLD", postcode: "4000" },
      standard: { price: 1200, days: "3–6 business days" },
      express: { price: 2000, days: "1–3 business days" }
    },
    NZ: {
      country: "New Zealand",
      regionLabel: "Region",
      regions: [
        "Auckland", "Bay of Plenty", "Canterbury", "Gisborne", "Hawke’s Bay", "Manawatū-Whanganui",
        "Marlborough", "Nelson", "Northland", "Otago", "Southland", "Taranaki", "Tasman", "Waikato",
        "Wellington", "West Coast"
      ],
      sample: { city: "Wellington", region: "Wellington", postcode: "6011" },
      standard: { price: 2000, days: "5–9 business days" },
      express: { price: 3200, days: "3–5 business days" }
    }
  };
  const orderPrefix = "fu7ure-preview:demo-order:";
  const historyLimit = 10;
  const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });
  const moneyInCents = (price) => Math.round(price * 100);
  const lineTotal = (item) => moneyInCents(item.unitPrice) * item.quantity;

  function summarize(items, delivery) {
    const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return { subtotal, count, delivery, total: subtotal + delivery };
  }

  function orderSignature(items) {
    return JSON.stringify(items.map(({ key, size, quantity, unitPrice }) => [key, size, quantity, unitPrice]));
  }

  function readOrder(key, value) {
    const record = JSON.parse(value);
    if (record && /^F7D-[0-9A-F]{10}$/.test(record.reference) &&
        key === orderPrefix + record.reference &&
        Number.isSafeInteger(record.count) && record.count > 0 &&
        Number.isSafeInteger(record.total) && record.total > 0 &&
        Number.isSafeInteger(record.date) && record.date > 0 && record.date < 8.64e15) {
      return record;
    }
    return null;
  }

  function createOrderHistory() {
    const inMemory = new Map();

    function read() {
      const orders = new Map(inMemory);
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith(orderPrefix)) continue;
          try {
            const order = readOrder(key, localStorage.getItem(key));
            if (order) orders.set(order.reference, order);
          } catch {
            // Ignore malformed entries and keep reading the other demo orders.
          }
        }
      } catch {
        // The current page can still show orders when storage is unavailable.
      }
      return [...orders.values()].sort((first, second) => second.date - first.date);
    }

    function save(order) {
      try {
        localStorage.setItem(orderPrefix + order.reference, JSON.stringify(order));
      } catch {
        inMemory.set(order.reference, order);
        for (const former of read().slice(historyLimit)) inMemory.delete(former.reference);
        return false;
      }
      for (const former of read().slice(historyLimit)) {
        inMemory.delete(former.reference);
        try {
          localStorage.removeItem(orderPrefix + former.reference);
        } catch {
          // The history still only displays the most recent orders.
        }
      }
      return true;
    }

    return { read, save };
  }

  function createReference() {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    return "F7D-" + Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function init({ dialog, getOrder, clearBag, money }) {
    if (typeof dialog?.showModal !== "function") return null;

    const find = (id) => dialog.querySelector("#" + id);
    const format = (cents) => money(cents / 100);
    const form = find("shipping-form");
    const country = form.elements.namedItem("country");
    const region = form.elements.namedItem("region");
    const delivery = form.elements.namedItem("delivery");
    const history = createOrderHistory();
    const stepNames = ["delivery", "review", "complete"];
    const headings = {
      delivery: "shipping-heading",
      review: "review-heading",
      complete: "checkout-complete-title",
      orders: "checkout-orders-title",
      empty: "checkout-empty-title"
    };
    let items = [];
    let view;
    let returnFocus;
    let historyIsTemporary = false;

    function show(nextView, opener) {
      view = nextView;
      const step = stepNames.indexOf(view);
      const isOrders = view === "orders";
      find("checkout-title").textContent = isOrders ? "Demo orders" : "Demo checkout";
      find("checkout-content").hidden = step === -1;
      find("checkout-note").hidden = view === "complete";
      find("checkout-orders").hidden = !isOrders;
      find("checkout-empty-cart").hidden = view !== "empty";
      form.hidden = view !== "delivery";
      find("shipping-review").hidden = view !== "review";
      find("checkout-review-actions").hidden = view !== "review";
      find("checkout-complete").hidden = view !== "complete";
      [...find("checkout-steps").children].forEach((part, index) => {
        if (index === step) part.setAttribute("aria-current", "step");
        else part.removeAttribute("aria-current");
      });
      if (!dialog.open) {
        returnFocus = opener instanceof HTMLElement ? opener : document.activeElement;
        dialog.showModal();
      }
      dialog.scrollTop = 0;
      find(headings[view]).focus({ preventScroll: true });
    }

    function setDestination() {
      const destination = destinations[country.value];
      const first = new Option("Choose " + destination.regionLabel.toLowerCase(), "", true, true);
      first.disabled = true;
      region.replaceChildren(first, ...destination.regions.map((name) => new Option(name)));
      find("checkout-region-label").textContent = destination.regionLabel;
      for (const name of ["standard", "express"]) {
        const method = destination[name];
        find("checkout-" + name + "-window").textContent = method.days;
        find("checkout-" + name + "-price").textContent = format(method.price);
      }
    }

    function renderTotals() {
      const method = destinations[country.value][delivery.value];
      const totals = summarize(items, method.price);
      find("checkout-subtotal").textContent = format(totals.subtotal);
      find("checkout-shipping").textContent = format(totals.delivery);
      find("checkout-total").textContent = format(totals.total);
      return totals;
    }

    function renderItems() {
      const rows = items.map((item) => {
        const row = document.createElement("li");
        const image = document.createElement("img");
        const label = document.createElement("div");
        const name = document.createElement("strong");
        const variant = document.createElement("span");
        const amount = document.createElement("span");
        const size = item.size === "One size" ? item.size : "Size " + item.size;
        image.src = item.image;
        image.alt = "";
        image.width = 48;
        image.height = 48;
        name.textContent = item.name;
        variant.textContent = size + " · Qty " + item.quantity;
        amount.textContent = format(lineTotal(item));
        label.append(name, variant);
        row.append(image, label, amount);
        return row;
      });
      find("checkout-items").replaceChildren(...rows);
    }

    function clearDetails() {
      form.reset();
      find("shipping-address").textContent = "";
      find("shipping-method").textContent = "";
      find("checkout-receipt-email").textContent = "";
      find("checkout-feedback").textContent = "";
    }

    function open(opener) {
      clearDetails();
      items = getOrder();
      setDestination();
      renderItems();
      renderTotals();
      show(items.length ? "delivery" : "empty", opener);
    }

    function renderHistory() {
      const recent = history.read().slice(0, historyLimit);
      const rows = recent.map((order) => {
        const row = document.createElement("li");
        const label = document.createElement("div");
        const reference = document.createElement("strong");
        const when = document.createElement("time");
        const summary = document.createElement("div");
        const amount = document.createElement("strong");
        const count = document.createElement("span");
        const date = new Date(order.date);
        reference.textContent = order.reference;
        when.dateTime = date.toISOString();
        when.textContent = dateFormat.format(date);
        amount.textContent = format(order.total);
        count.textContent = order.count + (order.count === 1 ? " item" : " items");
        label.append(reference, when);
        summary.append(amount, count);
        row.append(label, summary);
        return row;
      });
      find("checkout-order-history-note").textContent = historyIsTemporary
        ? "Some demo orders are only available until this page closes."
        : "Recent demo orders from this browser.";
      find("checkout-orders-list").replaceChildren(...rows);
      find("checkout-orders-empty").hidden = rows.length > 0;
    }

    function openOrders(opener) {
      clearDetails();
      renderHistory();
      show("orders", opener);
    }

    country.addEventListener("change", () => {
      setDestination();
      renderTotals();
    });
    form.addEventListener("change", (event) => {
      if (event.target.name === "delivery") renderTotals();
    });

    find("fill-checkout-sample").addEventListener("click", () => {
      const fields = {
        name: "Sample Customer",
        street: "10 Sample Street",
        email: "fit-test@example.com",
        unit: "",
        ...destinations[country.value].sample
      };
      for (const [name, value] of Object.entries(fields)) form.elements.namedItem(name).value = value;
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (view !== "delivery" || !form.reportValidity()) return;
      items = getOrder();
      if (!items.length) {
        clearDetails();
        show("empty");
        return;
      }
      const fields = new FormData(form);
      const field = (name) => fields.get(name).trim();
      const destination = destinations[country.value];
      find("shipping-address").textContent = [
        field("name"), field("street"), field("unit"),
        field("city") + ", " + region.value + " " + field("postcode"), destination.country
      ].filter(Boolean).join("\n");
      const method = delivery.value === "express" ? "Express" : "Standard";
      find("shipping-method").textContent = method + " · " + destination[delivery.value].days;
      find("checkout-receipt-email").textContent = field("email");
      renderItems();
      renderTotals();
      show("review");
    });

    find("edit-shipping").addEventListener("click", () => {
      find("checkout-feedback").textContent = "";
      show("delivery");
    });
    find("finish-checkout").addEventListener("click", () => {
      if (view !== "review") return;
      const latest = getOrder();
      if (!latest.length) {
        clearDetails();
        show("empty");
        return;
      }
      if (orderSignature(items) !== orderSignature(latest)) {
        items = latest;
        renderItems();
        renderTotals();
        find("checkout-feedback").textContent = "Your bag changed. Review the updated order before placing it.";
        return;
      }
      const { count, total } = renderTotals();
      const reference = createReference();
      const saved = history.save({ reference, date: Date.now(), count, total });
      if (!saved) historyIsTemporary = true;
      find("checkout-reference").textContent = reference;
      find("checkout-confirmation-note").textContent = saved
        ? "Saved to demo order history in this browser."
        : "Available in demo order history until this page closes.";
      clearDetails();
      show("complete");
      clearBag();
    });

    find("checkout-view-orders").addEventListener("click", () => openOrders());
    window.addEventListener("storage", (event) => {
      if (dialog.open && view === "orders" && (event.key === null || event.key.startsWith(orderPrefix))) {
        renderHistory();
      }
    });
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      clearDetails();
      items = [];
      if (returnFocus?.isConnected && !returnFocus.matches(":disabled")) {
        returnFocus.focus({ preventScroll: true });
      } else {
        returnFocus?.closest("dialog[open]")?.querySelector(".bag-close button")?.focus();
      }
      returnFocus = null;
    });

    return { open, openOrders };
  }

  window.fu7ureCheckout = { init };
})();
