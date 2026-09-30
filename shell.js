// The chrome every screen wears: the same tabs, in the same order, with the
// same words. In v1 each screen built its own header, so moving between them
// shifted the layout and one screen's logo led to a manager's dashboard.
//
// A screen imports its nav from here. It cannot diverge because there is
// nothing to diverge from.

(function (root) {
  "use strict";

  var T = function (en, ar) { return { en: en, ar: ar }; };

  var TABS = {
    agent: [
      { key: "day", label: T("My Day", "يومي") },
      { key: "pre_survey", label: T("Pre-Surveys", "قبل المسح") },
      { key: "survey", label: T("Surveys", "المسوح") },
      { key: "lead", label: T("Leads", "العملاء المحتملون") },
      { key: "supplier", label: T("Suppliers", "المورّدون") },
      { key: "orders", label: T("Orders", "الطلبات") },
      { key: "settings", label: T("Settings", "الإعدادات") },
    ],
  };

  var ROLE = {
    agent: { label: T("Call Center · Agent", "مركز الاتصال · موظف"), colour: "#2C5578", bg: "#E8EEF4" },
    financial: { label: T("Financial Manager", "المدير المالي"), colour: "#7A5CA8", bg: "#F0EAF7" },
    senior: { label: T("Senior Manager", "المدير العام"), colour: "#B3261E", bg: "#FBE9E7" },
  };

  var WORDS = {
    logout: T("Log out", "تسجيل الخروج"),
    today: (window.ZEITCO ? T(window.ZEITCO.todayLong.en, window.ZEITCO.todayLong.ar) : T("", "")),
    back: T("Back", "رجوع"),
    cancel: T("Cancel", "إلغاء"),
    newPreSurvey: T("+ New Pre-Survey", "+ محل جديد قبل المسح"),
  };

  var INK = "#10231C", GREEN = "#1F5240", RED = "#B3261E", AMBER = "#B3261E",
      MUTED = "#55655D", FAINT = "#8A9188", LINE = "#E4DFD4", HAIR = "#F4F1EA",
      PAPER = "#FAF6EE", SAND = "#F6F2E9";

  // Who is signed in, per role, until there is a real login. Names follow HR's
  // people records (hr.dc.html PEOPLE / ROLES), the one list of staff.
  var ME = {
    agent: { name: T("H. Fawzy", "ه. فوزي"), role: T("Call-center agent", "موظف مركز الاتصال") },
    ops: { name: T("Mahmoud Selim", "محمود سليم"), role: T("Operations manager · Team 1", "مدير العمليات · الفريق 1") },
    hr: { name: T("M. Adly", "م. عدلي"), role: T("HR administrator", "مسؤول الموارد البشرية") },
    senior: { name: T("N. Halim", "ن. حليم"), role: T("Senior Manager", "المدير العام") },
    financial: { name: T("S. Wahba", "س. وهبة"), role: T("Financial Manager", "المدير المالي") },
  };

  // The Screens menu: only the screens a role may open (PAGES.md). An agent,
  // HR, a driver and a surveyor each have one screen, so they get no menu.
  var S = function (en, ar, href) { return { label: T(en, ar), href: href }; };
  var SCREENS = {
    ops: function () {
      var Z = window.ZEITCO, team = Z && Z.teamOf ? Z.teamOf("Mahmoud Selim") : null;
      var mine = team && Z ? Z.trucks.filter(function (t) { return t.team === team.id; }) : [];
      return [S("Operations", "العمليات", "operations.dc.html")].concat(mine.map(function (t) {
        return S("Driver view · " + t.plate + " · " + t.driver.en, "شاشة السائق · " + t.plate + " · " + t.driver.ar, "driver.dc.html?truck=" + t.id);
      }));
    },
    senior: function () {
      return [S("Senior Manager", "المدير العام", "senior.dc.html"), S("Finance department", "قسم المالية", "financial.dc.html"),
        S("Call center", "مركز الاتصال", "agent.dc.html"), S("Operations", "العمليات", "operations.dc.html?team=all"),
        S("HR", "الموارد البشرية", "hr.dc.html"), S("Driver (truck t1)", "السائق (t1)", "driver.dc.html?truck=t1"),
        S("Surveyor", "المساح", "surveyor.dc.html")];
    },
    financial: function () {
      return [S("Financial Manager", "المدير المالي", "senior.dc.html?role=financial"), S("Finance department", "قسم المالية", "financial.dc.html"),
        S("Call center", "مركز الاتصال", "agent.dc.html"), S("Operations", "العمليات", "operations.dc.html?team=all"),
        S("HR (no pay settings)", "الموارد البشرية (دون إعدادات الأجور)", "hr.dc.html"), S("Driver (truck t1)", "السائق (t1)", "driver.dc.html?truck=t1"),
        S("Surveyor", "المساح", "surveyor.dc.html")];
    },
  };

  root.ZSHELL = {
    me: ME,
    // What the top bar adds to every screen: who you are, and your Screens menu.
    // who / role may be passed in when the screen knows better (driver, surveyor).
    bar: function (role, lang, who, roleLine) {
      var ar = lang === "ar", tx = function (v) { return v && typeof v === "object" ? (ar ? v.ar || v.en : v.en) : v || ""; };
      var m = ME[role] || {};
      var here = (location.pathname.split("/").pop() || "") + location.search;
      var list = (SCREENS[role] ? SCREENS[role]() : []).map(function (s) {
        var on = here === s.href || here.split("?")[0] === s.href;
        return { label: tx(s.label), href: s.href, bg: on ? "#F1F6F3" : "#fff", ink: on ? GREEN : INK };
      });
      return { who: tx(who || m.name), role: tx(roleLine || m.role), screens: list, hasScreens: list.length > 1,
        screensWord: ar ? "الشاشات ▾" : "Screens ▾" };
    },
    tabs: function (role) { return TABS[role] || TABS.agent; },
    role: ROLE,
    words: WORDS,
    ink: { INK: INK, GREEN: GREEN, RED: RED, AMBER: AMBER, MUTED: MUTED,
           FAINT: FAINT, LINE: LINE, HAIR: HAIR, PAPER: PAPER, SAND: SAND },
    // One reading of the language, shared with every other screen.
    lang: function () {
      try {
        var v = localStorage.getItem("zeitco-lang");
        return v === "ar" || v === "en" ? v : "ar";
      } catch (e) { return "ar"; }
    },
    setLang: function (v) {
      try { localStorage.setItem("zeitco-lang", v); } catch (e) {}
    },
  };
})(window);
