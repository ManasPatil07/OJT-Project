(function () {
  "use strict";

  
  const STORAGE_KEY = "fancy_task_dashboard_v2";
  let tasks = loadTasks();

  let currentPeriod = null;
  let activeSlot = null;

  
  const dailyList = document.getElementById("daily-tasks");
  const weeklyList = document.getElementById("weekly-tasks");
  const monthlyList = document.getElementById("monthly-tasks");
  const nameInput = document.getElementById("task-name");
  const typeInput = document.getElementById("task-type");
  const dateInput = document.getElementById("task-date");
  const timeInput = document.getElementById("task-time");
  const addBtn = document.getElementById("add-btn");
  const slotsArea = document.getElementById("slotsArea");
  const periodBtns = document.querySelectorAll(".period-btn");
  const clearFilterBtn = document.getElementById("clear-filter");
  const jumpTodayBtn = document.getElementById("jump-today");

  // -------------------------
  // Storage helpers
  // -------------------------
  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadTasks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (err) {
      console.error("Failed to load tasks from storage", err);
      return [];
    }
  }

  function generateId() {
    return (
      "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    );
  }

  // Combine date + time input into a Date object (or null when no date provided)
  function combineDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    return timeStr
      ? new Date(dateStr + "T" + timeStr)
      : new Date(dateStr + "T12:00");
  }

  // -------------------------
  // Task CRUD
  // -------------------------
  addBtn.addEventListener("click", function () {
    const name = nameInput.value.trim();
    if (!name) return alert("Enter a task name");
    const type = typeInput.value;
    const dueDate = dateInput.value || null;
    const dueTime = timeInput.value || null;
    const due = combineDateTime(dueDate, dueTime);

    const t = {
      id: generateId(),
      name: name,
      type: type,
      due: due ? due.toISOString() : null,
      completed: false,
      createdAt: Date.now(),
    };

    tasks.unshift(t);
    saveTasks();
    nameInput.value = "";
    dateInput.value = "";
    timeInput.value = "";
    activeSlot = null;
    renderAll();
  });

  function toggleComplete(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const willComplete = !t.completed;
    if (willComplete && isTaskOverdue(t)) {
      alert("Cannot mark an overdue task as completed");
      return;
    }
    t.completed = willComplete;
    saveTasks();
    renderAll();
  }

  function deleteTask(id) {
    if (!confirm("Delete this task?")) return;
    tasks = tasks.filter((x) => x.id !== id);
    saveTasks();
    renderAll();
  }

  // -------------------------
  // Slot helpers (for timeline)
  // -------------------------
  function getSlotsForPeriod(period) {
    if (period === "daily")
      return ["Early", "Morning", "Noon", "Afternoon", "Evening", "Night"];
    if (period === "weekly")
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return ["1-7", "8-14", "15-21", "22-28", "29-31"];
  }

  function getSlotForTask(task, period) {
    if (!task.due) return null;
    const d = new Date(task.due);
    if (period === "daily") {
      const hr = d.getHours();
      if (hr < 6) return "Early";
      if (hr < 12) return "Morning";
      if (hr < 14) return "Noon";
      if (hr < 17) return "Afternoon";
      if (hr < 20) return "Evening";
      return "Night";
    }
    if (period === "weekly")
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const day = d.getDate();
    if (day <= 7) return "1-7";
    if (day <= 14) return "8-14";
    if (day <= 21) return "15-21";
    if (day <= 28) return "22-28";
    return "29-31";
  }

  function renderSlots() {
    if (!currentPeriod) {
      // When no specific period is selected (overall view), hide the slot timeline
      if (slotsArea) slotsArea.innerHTML = "";
      return;
    }
    const slots = getSlotsForPeriod(currentPeriod);
    const counts = Object.fromEntries(slots.map((s) => [s, 0]));

    tasks
      .filter((t) => t.type === currentPeriod)
      .forEach((t) => {
        const s = getSlotForTask(t, currentPeriod);
        if (s && counts[s] !== undefined) counts[s]++;
      });

    slotsArea.innerHTML = "";
    slots.forEach((s) => {
      const el = document.createElement("div");
      el.className = "slot" + (activeSlot === s ? " active" : "");
      el.setAttribute("data-slot", s);
      el.innerHTML = `<div style=\"font-weight:700\">${s}</div><div class=\"muted\" style=\"font-size:12px\">${
        counts[s] || 0
      } tasks</div>`;
      el.onclick = function () {
        activeSlot = activeSlot === s ? null : s;
        renderAll();
      };
      slotsArea.appendChild(el);
    });
  }

  // -------------------------
  // Task element rendering
  // -------------------------
  function isTaskOverdue(t) {
    return !t.completed && t.due && new Date(t.due) < new Date();
  }

  function createTaskElement(t) {
    const li = document.createElement("li");
    li.className = "task-item";

    // Left column: name + meta
    const left = document.createElement("div");
    left.className = "task-left";

    const name = document.createElement("div");
    name.className = "task-name";
    name.textContent = t.name;
    if (t.completed) name.style.textDecoration = "line-through";
    name.onclick = function () {
      toggleComplete(t.id);
    };

    const meta = document.createElement("div");
    meta.className = "task-meta";
    const parts = [t.type.charAt(0).toUpperCase() + t.type.slice(1)];
    let dueDateStr = null;
    if (t.due) {
      const d = new Date(t.due);
      parts.push("Due: " + d.toLocaleString());
      dueDateStr = d.toLocaleDateString();
    }
    meta.textContent = parts.join(" • ");

    if (isTaskOverdue(t)) {
      const mspan = document.createElement("span");
      mspan.className = "meta-overdue";
      mspan.textContent = " ⏰ Overdue";
      meta.appendChild(mspan);
    }

    left.appendChild(name);
    left.appendChild(meta);

    // Right column: badge/date/delete
    const right = document.createElement("div");
    right.className = "task-right";

    if (dueDateStr) {
      const dueEl = document.createElement("div");
      dueEl.className = "due-date";
      dueEl.textContent = dueDateStr;
      if (isTaskOverdue(t)) {
        li.classList.add("overdue");
        const badge = document.createElement("span");
        badge.className = "badge overdue";
        badge.textContent = "OVERDUE";
        right.appendChild(badge);
      }
      right.appendChild(dueEl);
    } else {
      const created = document.createElement("small");
      created.className = "muted";
      created.textContent = new Date(t.createdAt).toLocaleDateString();
      right.appendChild(created);
    }

    const del = document.createElement("button");
    del.className = "btn-delete";
    del.textContent = "Delete";
    del.onclick = function () {
      deleteTask(t.id);
    };
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    if (t.completed) li.style.opacity = 0.7;
    return li;
  }

  function renderLists() {
    dailyList.innerHTML = "";
    weeklyList.innerHTML = "";
    monthlyList.innerHTML = "";

    const groups = { daily: [], weekly: [], monthly: [] };
    tasks.forEach((t) => groups[t.type] && groups[t.type].push(t));

    function sortfn(a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return b.createdAt - a.createdAt;
    }

    function applyAndAppend(listEl, items, period) {
      let filtered = items;
      if (activeSlot && period === currentPeriod)
        filtered = items.filter(
          (t) => getSlotForTask(t, period) === activeSlot
        );
      filtered
        .sort(sortfn)
        .forEach((t) => listEl.appendChild(createTaskElement(t)));
    }

    applyAndAppend(dailyList, groups.daily, "daily");
    applyAndAppend(weeklyList, groups.weekly, "weekly");
    applyAndAppend(monthlyList, groups.monthly, "monthly");
  }

  // -------------------------
  // Metrics & charts
  // -------------------------
  function calculateMetrics() {
    const m = {
      total: tasks.length,
      completed: tasks.filter((t) => t.completed).length,
      daily: { total: 0, completed: 0 },
      weekly: { total: 0, completed: 0 },
      monthly: { total: 0, completed: 0 },
    };
    tasks.forEach((t) => {
      m[t.type].total++;
      if (t.completed) m[t.type].completed++;
    });
    return m;
  }

  // Return simple progress metrics for a given period or overall when period is falsy
  function getProgressMetrics(period) {
    const m = calculateMetrics();
    if (!period) return { total: m.total, completed: m.completed };
    if (!m[period]) return { total: 0, completed: 0 };
    return { total: m[period].total, completed: m[period].completed };
  }

  // Generic chart renderers that accept a container selector and metrics
  function drawD3ProgressTo(containerSelector, m) {
    const container =
      typeof containerSelector === "string"
        ? document.querySelector(containerSelector)
        : containerSelector;
    if (!container) return;
    let svg = container.querySelector("svg");
    if (!svg)
      (svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")),
        container.appendChild(svg);
    const svgSel = d3.select(svg);
    const width = Math.max(300, container.clientWidth - 20);
    const height = 72;
    const p = m.total ? m.completed / m.total : 0;
    const pct = Math.round(p * 100);
    svgSel
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
    svgSel.selectAll("*").remove();
    svgSel
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#162029");
    svgSel
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("width", 0)
      .attr("height", height)
      .attr("fill", "#ef4444")
      .transition()
      .duration(700)
      .attr("width", width * p);
    svgSel
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("dy", "0.36em")
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("font-size", 16)
      .text(
        m.total === 0
          ? "No tasks yet"
          : `${pct}% complete (${m.completed}/${m.total})`
      );
  }

  function drawPieTo(containerSelector, m) {
    const container =
      typeof containerSelector === "string"
        ? document.querySelector(containerSelector)
        : containerSelector;
    if (!container) return;
    let div = container.querySelector(".plotly-pie");
    if (!div)
      (div = document.createElement("div")),
        (div.className = "plotly-pie"),
        (div.style.height = "260px"),
        container.appendChild(div);
    const data = [
      {
        values: [m.daily.total, m.weekly.total, m.monthly.total],
        labels: ["Daily", "Weekly", "Monthly"],
        type: "pie",
        marker: {
          colors: ["#4CAF50", "#2196F3", "#FF9800"],
          line: {
            color: getComputedStyle(document.body).backgroundColor,
            width: 2,
          },
        },
        textinfo: "label+value",
        textposition: "inside",
        insidetextorientation: "radial",
      },
    ];
    const layout = {
      margin: { t: 8, b: 8, l: 8, r: 120 },
      height: 260,
      legend: { orientation: "v", x: 1.02, xanchor: "left", y: 0.5 },
      paper_bgcolor: getComputedStyle(document.body).backgroundColor,
      font: { color: "#e6eef6" },
    };
    Plotly.newPlot(div, data, layout, {
      responsive: true,
      displayModeBar: false,
    });
  }

    function drawStatusPies(m) {
      const now = new Date();
      function countsFor(period) {
        const list = tasks.filter((t) => t.type === period);
        const total = list.length;
        let completed = 0;
        let overdue = 0;
        list.forEach((t) => {
          if (t.completed) completed++;
          else if (t.due && new Date(t.due) < now) overdue++;
        });
        const incomplete = total - completed - overdue;
        return { total, completed, incomplete, overdue };
      }

      const daily = countsFor("daily");
      const weekly = countsFor("weekly");
      const monthly = countsFor("monthly");

      function renderPieInto(id, counts) {
        const container = document.querySelector(id);
        if (!container) return;
        let div = container.querySelector(".plotly-status");
        if (!div) { div = document.createElement("div"); div.className = "plotly-status"; div.style.height = "100%"; container.appendChild(div); }
        const data = [{ values: [counts.completed, counts.incomplete, counts.overdue], labels: ["Completed", "Incomplete", "Overdue"], type: "pie", marker: { colors: ["#10B981", "#60A5FA", "#EF4444"] }, textinfo: "label+value", textposition: "inside" }];
        const layout = { margin: { t: 8, b: 8, l: 8, r: 8 }, height: 220, paper_bgcolor: getComputedStyle(document.body).backgroundColor, font: { color: "#e6eef6" } };
        Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false });
      }

      renderPieInto("#pie-daily-status", daily);
      renderPieInto("#pie-weekly-status", weekly);
      renderPieInto("#pie-monthly-status", monthly);
    }

  function drawBarTo(containerSelector, m) {
    const container =
      typeof containerSelector === "string"
        ? document.querySelector(containerSelector)
        : containerSelector;
    if (!container) return;
    let div = container.querySelector(".plotly-bar");
    if (!div)
      (div = document.createElement("div")),
        (div.className = "plotly-bar"),
        (div.style.height = "260px"),
        container.appendChild(div);
    const dp = m.daily.total ? (m.daily.completed / m.daily.total) * 100 : 0;
    const wp = m.weekly.total ? (m.weekly.completed / m.weekly.total) * 100 : 0;
    const mp = m.monthly.total
      ? (m.monthly.completed / m.monthly.total) * 100
      : 0;
    const data = [
      {
        x: ["Daily", "Weekly", "Monthly"],
        y: [dp, wp, mp],
        type: "bar",
        marker: { color: ["#4CAF50", "#2196F3", "#FF9800"] },
        hovertemplate: "%{x}: %{y:.1f}%<extra></extra>",
      },
    ];
    const layout = {
      margin: { t: 8, b: 40, l: 40, r: 10 },
      height: 260,
      yaxis: { range: [0, 100], title: "Completion %", gridcolor: "#334155" },
      font: { color: "#e6eef6" },
      paper_bgcolor: getComputedStyle(document.body).backgroundColor,
      plot_bgcolor: getComputedStyle(document.body).backgroundColor,
    };
    Plotly.newPlot(div, data, layout, {
      responsive: true,
      displayModeBar: false,
    });
  }

  // -------------------------
  // Page-level rendering
  // -------------------------
  function renderAll() {
    renderSlots();
    renderLists();
    const m = calculateMetrics();
    const progressMetrics = getProgressMetrics(currentPeriod);
    // Draw the progress bar for the selected period (or overall when none selected)
    drawD3ProgressTo("#overall-progress-card", progressMetrics);
    // Pie and bar still show the overall breakdown
    drawPieTo("#pie-chart-plot", m);
    drawBarTo("#bar-chart-plot", m);
    drawStatusPies(m);
    highlightPeriodButtons();
  }

  function highlightPeriodButtons() {
    periodBtns.forEach((b) => {
      const p = b.dataset.period;
      if (p === currentPeriod) b.classList.add("active");
      else b.classList.remove("active");
    });
  }

  periodBtns.forEach((b) => {
    b.addEventListener("click", function () {
      const p = b.dataset.period;
      if (!p) return;
      // toggle: clicking the active period will clear selection (show overall)
      currentPeriod = currentPeriod === p ? null : p;
      activeSlot = null;
      renderAll();
    });
  });

  clearFilterBtn.addEventListener("click", function () {
    activeSlot = null;
    renderAll();
  });

  jumpTodayBtn.addEventListener("click", function () {
    const now = new Date();
    if (currentPeriod === "weekly") {
      activeSlot = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        now.getDay()
      ];
    } else if (currentPeriod === "monthly") {
      const d = now.getDate();
      activeSlot =
        d <= 7
          ? "1-7"
          : d <= 14
          ? "8-14"
          : d <= 21
          ? "15-21"
          : d <= 28
          ? "22-28"
          : "29-31";
    } else {
      const hr = now.getHours();
      activeSlot =
        hr < 6
          ? "Early"
          : hr < 12
          ? "Morning"
          : hr < 14
          ? "Noon"
          : hr < 17
          ? "Afternoon"
          : hr < 20
          ? "Evening"
          : "Night";
    }
    renderAll();
  });

  // -------------------------
  // Initial sample data (first-run)
  // -------------------------
  if (!tasks || tasks.length === 0) {
    tasks = [
      {
        id: generateId(),
        name: "Read 20 pages",
        type: "daily",
        due: new Date(new Date().setHours(8, 30, 0, 0)).toISOString(),
        completed: false,
        createdAt: Date.now() - 1000 * 60 * 60 * 24,
      },
      {
        id: generateId(),
        name: "Morning run",
        type: "daily",
        due: new Date(new Date().setHours(6, 0, 0, 0)).toISOString(),
        completed: true,
        createdAt: Date.now() - 1000 * 60 * 60 * 20,
      },
      {
        id: generateId(),
        name: "Weekly planning",
        type: "weekly",
        due: (function () {
          const d = new Date();
          d.setDate(d.getDate() + 2);
          return d.toISOString();
        })(),
        completed: false,
        createdAt: Date.now() - 1000 * 60 * 60 * 48,
      },
      {
        id: generateId(),
        name: "Pay rent",
        type: "monthly",
        due: (function () {
          const d = new Date();
          d.setDate(5);
          return d.toISOString();
        })(),
        completed: false,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
      },
    ];
    saveTasks();
  }

  // Resize handling
  let rt = null;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      renderAll();
    }, 220);
  });

  // Initial render
  renderAll();

  // Small public API used by console/tests
  window.__taskDashboard = {
    tasks: tasks,
    addLocal: function (n, t, d, ti) {
      const dIso = combineDateTime(d, ti);
      tasks.unshift({
        id: generateId(),
        name: n,
        type: t,
        due: dIso ? dIso.toISOString() : null,
        completed: false,
        createdAt: Date.now(),
      });
      saveTasks();
      renderAll();
    },
  };

  // -------------------------
  // Charts overlay & dashboard overlay functions (reused by header buttons)
  // -------------------------
  function showChartsPage() {
    if (document.getElementById("charts-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "charts-overlay";
    overlay.className = "charts-overlay";
    const panel = document.createElement("div");
    panel.className = "charts-panel card";
    const header = document.createElement("div");
    header.className = "charts-header";
    header.innerHTML = '<h3 style="margin:0">Overview Charts</h3>';
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn";
    closeBtn.textContent = "Close";
    closeBtn.style.marginLeft = "12px";
    closeBtn.onclick = function () {
      overlay.remove();
    };
    header.appendChild(closeBtn);
    const grid = document.createElement("div");
    grid.className = "charts-grid";
    const left = document.createElement("div");
    left.className = "charts-left";
    left.innerHTML =
      '<div id="overlay-progress" class="overlay-progress"></div>' +
      '<div id="overlay-bar" class="overlay-bar"></div>' +
      '<div class="left-pies" style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap">' +
      '  <div class="status-pie-card card" style="flex:1 1 0"><h4 style="margin:8px 8px 0 8px">Daily Status</h4><div id="pie-daily-status" style="height:240px"></div></div>' +
      '  <div class="status-pie-card card" style="flex:1 1 0"><h4 style="margin:8px 8px 0 8px">Weekly Status</h4><div id="pie-weekly-status" style="height:240px"></div></div>' +
      '  <div class="status-pie-card card" style="flex:1 1 0"><h4 style="margin:8px 8px 0 8px">Monthly Status</h4><div id="pie-monthly-status" style="height:240px"></div></div>' +
      '</div>';
    const right = document.createElement("div");
    right.className = "charts-right";
    right.innerHTML = '<div class="overall-card card"><h4 style="margin:8px 8px 0 8px">Overall Breakdown</h4><div id="overlay-pie" class="overlay-pie overall-pie"></div></div>';
    grid.appendChild(left);
    grid.appendChild(right);
    panel.appendChild(header);
    panel.appendChild(grid);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    const m = calculateMetrics();
    drawD3ProgressTo("#overlay-progress", m);
    drawBarTo("#overlay-bar", m);
    drawPieTo("#overlay-pie", m);
    drawStatusPies(m);
  }

  window.showChartsPage = showChartsPage;

  function showAnalyticsPage() {
    showChartsPage();
  }

  function createTaskRowForOverlay(t) {
    const row = document.createElement("div");
    row.className = "overlay-task-row";
    const left = document.createElement("div");
    left.className = "overlay-task-left";
    const name = document.createElement("div");
    name.className = "overlay-task-name";
    name.textContent = t.name;
    if (t.completed) name.style.textDecoration = "line-through";
    const meta = document.createElement("div");
    meta.className = "overlay-task-meta";
    const parts = [t.type.charAt(0).toUpperCase() + t.type.slice(1)];
    if (t.due) parts.push("Due: " + new Date(t.due).toLocaleString());
    meta.textContent = parts.join(" • ");
    left.appendChild(name);
    left.appendChild(meta);
    const right = document.createElement("div");
    right.className = "overlay-task-right";
    const state = document.createElement("div");
    state.className = t.completed ? "overlay-state completed" : "overlay-state";
    state.textContent = t.completed ? "Done" : "Open";
    right.appendChild(state);
    row.appendChild(left);
    row.appendChild(right);
    if (!t.completed && t.due && new Date(t.due) < new Date())
      row.classList.add("overdue");
    return row;
  }

  function showDashboardPage() {
    if (document.getElementById("dashboard-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "dashboard-overlay";
    overlay.className = "charts-overlay";
    const panel = document.createElement("div");
    panel.className = "charts-panel card";
    const header = document.createElement("div");
    header.className = "charts-header";
    header.innerHTML = '<h3 style="margin:0">Tasks Dashboard</h3>';
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn";
    closeBtn.textContent = "Close";
    closeBtn.style.marginLeft = "12px";
    closeBtn.onclick = function () {
      overlay.remove();
    };
    header.appendChild(closeBtn);
    const content = document.createElement("div");
    content.className = "dashboard-overlay-content";
    const groups = { daily: [], weekly: [], monthly: [] };
    tasks.forEach((t) => {
      if (groups[t.type]) groups[t.type].push(t);
    });
    ["daily", "weekly", "monthly"].forEach((type) => {
      const box = document.createElement("div");
      box.className = "dashboard-group card";
      const title = document.createElement("h4");
      title.textContent =
        type.charAt(0).toUpperCase() + type.slice(1) + " Tasks";
      box.appendChild(title);
      const list = document.createElement("div");
      list.className = "dashboard-list";
      if (groups[type].length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No tasks";
        list.appendChild(empty);
      }
      groups[type]
        .sort((a, b) => b.createdAt - a.createdAt)
        .forEach((t) => list.appendChild(createTaskRowForOverlay(t)));
      box.appendChild(list);
      content.appendChild(box);
    });
    const main = document.createElement("div");
    main.className = "dashboard-main";
    const leftCol = document.createElement("div");
    leftCol.className = "dashboard-left";
    leftCol.appendChild(content);
    const rightCol = document.createElement("div");
    rightCol.className = "dashboard-right";
    rightCol.innerHTML = '<div id="dashboard-pie" class="overlay-pie"></div>';
    main.appendChild(leftCol);
    main.appendChild(rightCol);
    panel.appendChild(header);
    panel.appendChild(main);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    const m = calculateMetrics();
    drawPieTo("#dashboard-pie", m);
  }

  window.showAnalyticsPage = showAnalyticsPage;
  window.showDashboardPage = showDashboardPage;
})();
