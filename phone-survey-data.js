// What the agent's phone survey needs on top of data.js. It is a separate file
// on purpose: data.js is loaded by every v2 screen, and these four additions
// belong inside it. Until they are moved there, a screen that needs any of them
// loads this file straight after data.js.
//
//   1. cities and zones, so a brand-new shop can be placed by hand
//   2. the city a shop is in, for a search that covers the whole city
//   3. locationConfirmedOn: the day a surveyor stood at a phone survey's shop and
//      proved where it is. It is not a verification (a phone survey has none),
//      so verifiedOn stays empty and this is its own date.
//   4. the two rules that keep that date honest

(function (root) {
  "use strict";
  var D = root.ZEITCO;
  if (!D) { console.error("[phone-survey-data] load data.js first"); return; }

  var CITIES = [
    { k: "Cairo", en: "Cairo", ar: "القاهرة" },
    { k: "Alexandria", en: "Alexandria", ar: "الإسكندرية" },
  ];

  // Zone names carry their city in the seeded data ("Alexandria 1"), and every
  // other zone is in Cairo. In the real app this comes from Settings, not a name.
  function cityOfZone(name) { return /^Alexandria/.test(name || "") ? "Alexandria" : "Cairo"; }

  var seen = {}, ZONES = [];
  D.shops.forEach(function (s) {
    var en = s.area && s.area.en;
    if (!en || seen[en]) return;
    seen[en] = true;
    ZONES.push({ en: en, ar: s.area.ar, city: cityOfZone(en) });
  });

  D.cities = CITIES;
  D.zones = ZONES;
  D.zonesIn = function (city) {
    return ZONES.filter(function (z) { return z.city === city; }).map(function (z) { return z.en; });
  };
  D.cityOf = function (s) {
    return (s && s.survey && s.survey.city && s.survey.city.en) || cityOfZone(s && s.area && s.area.en);
  };

  // ---- location proof ------------------------------------------------------
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayNumber(v) {
    var bits = String((v && v.en) || v || "").split(" ");
    var d = parseInt(bits[0], 10), m = MONTHS.indexOf(bits[1]);
    return isNaN(d) || m < 0 ? null : m * 31 + d;
  }
  var TODAY = dayNumber(D.today);

  // Unproved until a surveyor confirms it. Rule 7: due three days after the phone
  // survey or before the first collection, whichever is sooner. Blocks nothing.
  D.locationUnproved = function (s) { return !!(s.locationDue && !s.locationConfirmedOn); };
  D.locationLate = function (s) {
    if (!s.locationDue || s.locationConfirmedOn) return false;
    var due = dayNumber(s.locationDue);
    return due !== null && TODAY !== null && due < TODAY;
  };

  var problems = [];
  D.shops.forEach(function (s) {
    if (s.locationConfirmedOn && !s.phoneSurveyOn)
      problems.push(s.id + ": a location was confirmed on a shop that was never a phone survey");
    if (s.locationConfirmedOn && !s.locationDue)
      problems.push(s.id + ": a location confirmed that nobody was ever asked to confirm");
    if (s.locationConfirmedOn && s.verifiedOn)
      problems.push(s.id + ": a confirmed location is not a verification, so verifiedOn must stay empty");
  });
  if (problems.length) {
    D.problems = (D.problems || []).concat(problems);
    console.error("[phone-survey-data] " + problems.length + " incoherent shop(s):\n  " + problems.join("\n  "));
  }
})(window);
