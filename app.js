(function () {
  "use strict";

  const PEOPLE = { jack: "Jack", chelsea: "Chelsea" };
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MEALS = [["Breakfast", "breakfast"], ["Lunch", "lunch"], ["Snack", "snack"]];
  const PERSON_KEY = "food:person";

  const sum = (items, key) => items.reduce((t, i) => t + i[key], 0);
  const fmt = n => Math.round(n).toLocaleString("en-AU");
  const fmt1 = n => (Math.round(n * 10) / 10).toString();
  const num = (m, n) => m === "cal" ? fmt(n) : fmt1(n);
  const unit = m => m === "cal" ? " cal" : "g protein";
  const $ = id => document.getElementById(id);
  const tickSvg = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let person = null;
  let plan = null;
  let now = new Date();
  let todayIdx = (now.getDay() + 6) % 7;
  let current = todayIdx;
  let state = { checked: [], extras: [] };

  function getStored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function setStored(key, value) {
    try {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable */ }
  }

  function mealsFor(dayIdx) {
    const meals = MEALS.map(([label, key]) => [label, plan[key] || []]).filter(m => m[1].length);
    const dinner = plan.dinners && plan.dinners[DAYS[dayIdx].toLowerCase()];
    if (dinner) meals.push([dinner.name, dinner.items]);
    return meals;
  }
  const hasDinner = dayIdx => Boolean(plan.dinners && plan.dinners[DAYS[dayIdx].toLowerCase()]);
  const keyFor = (label, item) => label.toLowerCase().replace(/\s+/g, "-") + ":" + item.id;
  const focus = () => plan.calGoal ? "cal" : "pro";
  const goalFor = (m, planned) => (m === "cal" ? plan.calGoal : plan.proGoal) || planned;

  function dateKey(dayIdx) {
    const d = new Date(now);
    d.setDate(now.getDate() - todayIdx + dayIdx);
    const pad = n => String(n).padStart(2, "0");
    return "food:" + person + ":" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function load(dayIdx) {
    try {
      const raw = getStored(dateKey(dayIdx));
      const data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.checked) && Array.isArray(data.extras)) return data;
    } catch (e) { /* bad data: start fresh */ }
    return { checked: [], extras: [] };
  }
  function save() {
    setStored(dateKey(current), JSON.stringify(state));
  }

  function showPicker(error) {
    $("app").hidden = true;
    $("picker").hidden = false;
    $("loadErr").textContent = error || "";
    const wrap = $("people");
    wrap.innerHTML = "";
    Object.entries(PEOPLE).forEach(([id, name]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.addEventListener("click", () => choose(id));
      wrap.appendChild(b);
    });
  }

  function choose(id) {
    $("loadErr").textContent = "";
    fetch("plans/" + id + ".json")
      .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(data => {
        person = id;
        plan = data;
        setStored(PERSON_KEY, id);
        current = todayIdx;
        state = load(current);
        $("picker").hidden = true;
        $("app").hidden = false;
        render();
      })
      .catch(() => showPicker("Couldn't load " + PEOPLE[id] + "'s plan. Check your connection and try again."));
  }

  function itemRow(key, name, cal, pro, checked) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item";
    btn.setAttribute("role", "checkbox");
    btn.setAttribute("aria-checked", checked ? "true" : "false");
    btn.dataset.key = key;
    btn.innerHTML = '<span class="tick">' + tickSvg + '</span><span class="name"></span><span class="nums"></span>';
    btn.querySelector(".name").textContent = name;
    btn.querySelector(".nums").textContent = fmt(cal) + " cal · " + fmt1(pro) + "g";
    li.appendChild(btn);
    return li;
  }

  function renderDays() {
    const nav = $("days");
    nav.innerHTML = "";
    DAYS.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = d;
      b.setAttribute("aria-pressed", i === current ? "true" : "false");
      if (i === todayIdx) b.classList.add("today");
      b.addEventListener("click", () => { current = i; state = load(i); disarm(); render(); });
      nav.appendChild(b);
    });
  }

  function render() {
    renderDays();
    $("title").textContent = current === todayIdx ? "Today" : DAYS[current];
    $("switch").textContent = plan.name || PEOPLE[person];

    const meals = mealsFor(current);
    const wrap = $("meals");
    wrap.innerHTML = "";

    meals.forEach(([label, items]) => {
      const sec = document.createElement("section");
      const head = document.createElement("div");
      head.className = "meal-head";
      head.innerHTML = "<h2></h2><span></span>";
      head.querySelector("h2").textContent = label;
      head.querySelector("span").textContent = fmt(sum(items, "cal")) + " cal · " + fmt1(sum(items, "pro")) + "g";
      const ul = document.createElement("ul");
      items.forEach(it => {
        const key = keyFor(label, it);
        ul.appendChild(itemRow(key, it.name, it.cal, it.pro, state.checked.includes(key)));
      });
      sec.append(head, ul);
      wrap.appendChild(sec);
    });

    if (!hasDinner(current)) {
      const m = focus();
      const all = meals.flatMap(x => x[1]);
      const left = Math.max(0, goalFor(m, 0) - sum(all, m));
      const sec = document.createElement("section");
      sec.innerHTML = '<div class="meal-head"><h2>Dinner</h2><span>your pick</span></div><div class="budget">About <strong>' +
        num(m, left) + unit(m) + '</strong> left for dinner. Add it under Extras once you know what it is.</div>';
      wrap.appendChild(sec);
    }

    const ex = $("extras");
    ex.innerHTML = "";
    ex.hidden = state.extras.length === 0;
    state.extras.forEach((e, idx) => {
      const li = itemRow("extra:" + idx, e.name, e.cal, e.pro, true);
      const del = document.createElement("button");
      del.type = "button"; del.className = "del"; del.textContent = "Remove";
      del.addEventListener("click", () => { state.extras.splice(idx, 1); save(); render(); });
      li.appendChild(del);
      li.querySelector(".item").disabled = true;
      ex.appendChild(li);
    });

    updateTotals();
  }

  function updateTotals() {
    const meals = mealsFor(current);
    const all = meals.flatMap(m => m[1]);
    const done = { cal: 0, pro: 0 };
    meals.forEach(([label, items]) => {
      items.forEach(it => { if (state.checked.includes(keyFor(label, it))) { done.cal += it.cal; done.pro += it.pro; } });
    });
    state.extras.forEach(e => { done.cal += e.cal; done.pro += e.pro; });

    const main = focus();
    const sub = main === "cal" ? "pro" : "cal";
    const mainGoal = goalFor(main, sum(all, main));
    const subFixed = sub === "cal" ? plan.calGoal : plan.proGoal;
    const subGoal = goalFor(sub, sum(all, sub));

    $("gauge").dataset.focus = main;
    $("mainNow").textContent = num(main, done[main]);
    $("mainGoal").textContent = "/ " + num(main, mainGoal) + unit(main);
    $("mainBar").style.width = Math.min(100, done[main] / Math.max(mainGoal, 1) * 100) + "%";
    const left = mainGoal - done[main];
    $("mainLeft").textContent = left >= 0 ? num(main, left) + unit(main) + " left" : num(main, -left) + unit(main) + " over";

    $("subNow").textContent = num(sub, done[sub]);
    $("subUnit").textContent = unit(sub);
    $("subPlan").textContent = (subFixed ? "goal " : "plan ") + num(sub, subGoal) + (sub === "cal" ? " cal" : "g");
    $("subBar").style.width = Math.min(100, done[sub] / Math.max(subGoal, 1) * 100) + "%";
  }

  $("meals").addEventListener("click", e => {
    const btn = e.target.closest(".item");
    if (!btn) return;
    const key = btn.dataset.key;
    const i = state.checked.indexOf(key);
    if (i === -1) state.checked.push(key); else state.checked.splice(i, 1);
    btn.setAttribute("aria-checked", i === -1 ? "true" : "false");
    save();
    updateTotals();
  });

  $("addForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("exName").value.trim();
    const cal = Number($("exCal").value);
    const pro = $("exPro").value.trim() === "" ? 0 : Number($("exPro").value);
    if (!name || !Number.isFinite(cal) || cal < 0 || $("exCal").value.trim() === "" || !Number.isFinite(pro) || pro < 0) {
      $("err").textContent = "Add a name and calories. Protein is optional.";
      return;
    }
    $("err").textContent = "";
    state.extras.push({ name: name.slice(0, 60), cal: cal, pro: pro });
    $("exName").value = ""; $("exCal").value = ""; $("exPro").value = "";
    save(); render();
  });

  let armed = null;
  function disarm() {
    clearTimeout(armed); armed = null;
    $("reset").textContent = "Clear this day";
  }
  $("reset").addEventListener("click", () => {
    if (!armed) {
      $("reset").textContent = "Tap again to clear " + DAYS[current];
      armed = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    state = { checked: [], extras: [] };
    save(); render();
  });

  $("switch").addEventListener("click", () => {
    setStored(PERSON_KEY, null);
    disarm();
    showPicker();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !plan) return;
    const d = new Date();
    if (d.toDateString() === now.toDateString()) return;
    now = d;
    todayIdx = (now.getDay() + 6) % 7;
    current = todayIdx;
    state = load(current);
    render();
  });

  const saved = getStored(PERSON_KEY);
  if (saved && PEOPLE[saved]) choose(saved); else showPicker();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
