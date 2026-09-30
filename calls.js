// The calls an agent should make, and why. One place, read by every screen
// that shows an outlet — the agent's workspace and the full outlet page — so
// the list and the outlet can never give two different reasons.
(function (root) {
  "use strict";
  var ME = { en: "H. Fawzy", ar: "ه. فوزي" };
  var api = {
    lang: "en",
    t(v) { return v && typeof v === "object" ? (v[this.lang] || v.en) : v; },

  // Whose calls these are. An agent sees and works only the outlets he
  // manages: his own, and an away agent's while HR has named him stand-in.
  // There is no shared pool — unowned work is assigned on arrival.
  pool() { return false; },
  mine(s) {
    const o = root.ZEITCO.ownerNow(s);
    return !!(o && o.en === ME.en);
  },

  // The latest time this outlet was called today, or "".
  loggedAt(id) {
    return window.ZEITCO.calls.filter((c) => c.shop === id).map((c) => c.at).sort().pop() || "";
  },

  // The six kinds of call. The tag is shown on the list and on the outlet, so
  // the agent knows which conversation he is about to have before he dials.
  callType(k, ar) {
    const T = {
      scheduled:    ["Scheduled",    "مجدولة",   "#2C5578", "#E6EEF6"],
      collection:   ["Collection",   "تحصيل",    "#1F5240", "#E3F0E8"],
      followup:     ["Follow-up",    "متابعة",   "#B3261E", "#FBE9E7"],
      retry:        ["Retry",        "إعادة",    "#B3261E", "#FBE9E7"],
      winback:      ["Win-back",     "استعادة",  "#5B4A8A", "#EFECF6"],
      verification: ["Verification", "تحقق",     "#55655D", "#EDEAE2"],
    }[k] || ["", "", "#55655D", "transparent"];
    return { label: ar ? T[1] : T[0], ink: T[2], bg: T[3] };
  },

  atRisk(s) {
    return s.price === "refused" || s.activity === "non_committed" || s.activity === "inactive"
      || (s.notReady || 0) >= 2;
  },

  // Every call open on this outlet, most pressing first. A call closes when a
  // result is logged against it — an order placed, a date booked — not when
  // the day passes, so a shop dealt with yesterday does not come back today.
  // Rank: 0 scheduled and due · 1 collection on its last day · 2 follow-up ·
  // 3 collection inside its window · 4 retry · 5 win-back · 6 verification.
  callsFor(s, ar) {
    const D = window.ZEITCO, t = (v) => this.t(v);
    const R = (en, a) => (ar ? a : en);
    const now = D.todayNumber;
    const out = [];
    if (!this.mine(s)) return out;
    if (s.callBack) {
      const n = D.dayNumber(s.callBack), at = D.timeOf(s.callBack);
      if (n !== null && n <= now) out.push({ type: "scheduled", rank: 0, today: true, order: n * 10000 + parseInt((at || "0").replace(":", ""), 10),
        due: n < now ? R("Overdue", "متأخرة") : (at || R("Today", "اليوم")),
        short: n < now ? R("Booked for " + t(s.callBack) + " — missed", "محجوزة " + t(s.callBack) + " — فاتت")
                       : R("They asked for a call at " + at, "طلبوا مكالمة الساعة " + at),
        why: R("They asked to be called " + t(s.callBack) + ".", "طلبوا أن نتصل " + t(s.callBack) + ".")
          + (n < now ? R(" That time has passed.", " وقد فات الموعد.") : ""),
        goal: s.notReady
          ? R("Ask again whether they have oil, and how much. If they do, place the order.",
              "اسألهم مجدداً هل لديهم زيت وكم. فإن كان، أصدر الطلب.")
          : R("Pick up where the last call stopped.", "أكمل من حيث توقفت المكالمة الأخيرة.") });
    }
    const nc = D.nextCollection(s);
    // Called one or two days ahead, never on the day itself — by then the
    // trucks are already out.
    if (nc && nc.inDays >= 1 && nc.inDays <= 2 && s.stage === "supplier"
        && (s.activity === "active" || s.activity === "new") && !D.openOrderFor(s) && !s.callBack) {
      const first = D.notDelivered(s);
      const last = nc.inDays <= 1;
      out.push({ type: "collection", rank: last ? 1 : 3, today: true, order: nc.inDays,
        due: nc.inDays === 0 ? R("Today", "اليوم") : last ? R("Today · last day", "اليوم · آخر يوم") : R("By ", "قبل ") + t(nc.callBy),
        short: nc.inDays === 0
          ? R("Collection is today — no order yet", "التحصيل اليوم — ولا طلب بعد")
          : (first ? R("First order ", "أول طلب ") : R("Collection ", "التحصيل ")) + t(nc.day) + R(" — confirm oil", " — أكّد الزيت"),
        why: nc.inDays === 0
          ? R("Their collection day is today and no order has been placed.", "يوم تحصيلهم اليوم ولم يصدر طلب.")
          : R((first ? "Their first collection" : "Their collection") + " is on " + t(nc.day) + " " + t(nc.date) + ". No order is placed yet.",
              (first ? "أول تحصيل لهم" : "تحصيلهم") + " يوم " + t(nc.day) + " " + t(nc.date) + ". ولم يصدر طلب بعد.")
            + (nc.every !== 7 || nc.last ? R(" ", " ") + [
                nc.every === 14 ? R("Every two weeks.", "كل أسبوعين.") : nc.every === 28 ? R("Monthly.", "شهرياً.") : "",
                nc.last ? R("Last collected " + t(nc.last) + ".", "آخر تحصيل " + t(nc.last) + ".") : "",
              ].filter(Boolean).join(" ") : ""),
        goal: R("Confirm they have oil and how much, then place the order. Not ready? Book the date they give.",
                "تأكد أن لديهم زيتاً وكم، ثم أصدر الطلب. غير جاهزين؟ احجز الموعد الذي يحددونه.") });
    }
    const atDoor = D.orders.some((o) => o.shop === s.id && o.atDoor && !o.wrong && o.state === "on_a_truck");
    if (s.price === "counter_offered" && !atDoor) out.push({ type: "followup", rank: 2, today: true, due: R("Today", "اليوم"),
      short: s.decision && s.decision.kind === "approved"
        ? R("Management approved " + s.counterPrice + " — tell them", "الإدارة وافقت على " + s.counterPrice + " — أبلِغهم")
        : R("Management countered at " + s.counterPrice + " — tell them", "الإدارة قابلت بـ" + s.counterPrice + " — أبلِغهم"),
      why: R("They asked for " + s.askedPrice + ". " + (s.decision && s.decision.kind === "approved" ? "Management approved it" : "Management answered " + s.counterPrice)
               + (s.decision && s.decision.reason ? ": \"" + s.decision.reason + "\"" : "") + ".",
             "طلبوا " + s.askedPrice + ". " + (s.decision && s.decision.kind === "approved" ? "وافقت الإدارة" : "ردّت الإدارة بـ" + s.counterPrice)
               + (s.decision && s.decision.reason ? ": «" + s.decision.reason + "»" : "") + "."),
      goal: R("Give them management's price and log whether they accept it.", "أبلِغهم بسعر الإدارة وسجّل هل يقبلونه.") });
    if (s.price === "refused") out.push({ type: "followup", rank: 2, today: true, due: R("Today", "اليوم"),
      short: R("Their increase was refused — at risk", "رُفض طلبهم — معرّض للفقد"),
      why: s.agreedPrice
        ? R("They asked for " + s.askedPrice + " and management refused. The old price, " + s.agreedPrice + ", stands.",
            "طلبوا " + s.askedPrice + " ورفضت الإدارة. والسعر القديم " + s.agreedPrice + " قائم.")
        : R("They asked for " + s.askedPrice + " and management refused.", "طلبوا " + s.askedPrice + " ورفضت الإدارة."),
      reason: s.decision && s.decision.reason ? s.decision.reason : "",
      goal: R("Tell them, and find out whether they stay with us at the price that stands.", "أبلِغهم، واعرف هل يبقون معنا بالسعر القائم.") });
    if (s.tries > 0) out.push({ type: "retry", rank: 4, today: true, order: -s.tries,
      due: R("Try ", "المحاولة ") + (s.tries + 1),
      short: R("Not answering · " + s.tries + " tries", "لا يردّون · " + s.tries + " محاولات"),
      why: R(s.tries + " calls and nobody has picked up.", s.tries + " مكالمات ولم يردّ أحد."),
      goal: s.tries >= 2
        ? R("Get somebody on the line. If this try fails too, raise a reverification.", "أن يردّ أحد. وإن لم يردّ هذه المرة أيضاً، اطلب إعادة تحقق.")
        : R("Get somebody on the line.", "أن يردّ أحد.") });
    // A Pre-Supplier that let an order fail is never dropped. How hard we chase
    // changes with how often it has failed: soon after one failure, weekly after
    // two, and monthly from three on. The clock runs from the last contact —
    // the last call or the last failed stop, whichever is later.
    if (s.activity === "non_committed") {
      const fails = D.failedFirsts ? Math.max(1, D.failedFirsts(s)) : 1;
      const tier = fails >= 3 ? "long" : fails === 2 ? "weekly" : "soon";
      // The gaps are a management setting (Settings → Failed Pre-Supplier Chase).
      const gap = (k, dflt) => Math.max(1, parseInt(D.setting ? D.setting(k) : dflt, 10) || dflt);
      const every = { soon: gap("chase1", 2), weekly: gap("chase2", 7), long: gap("chase3", 30) }[tier];
      const lastFail = D.ordersFor(s.id).filter((o) => o.wrong || o.state === "missed")
        .map((o) => D.dayNumber(o.due)).filter((n) => n !== null).sort((a, b) => b - a)[0];
      const lastCall = s.lastCall ? D.dayNumber(s.lastCall.when) : null;
      const from = Math.max(lastFail || 0, lastCall || 0) || now;
      const dueIn = from + every - now;
      const TIER = {
        soon: [R("Failed once · call within " + every + " days", "فشل مرة · اتصل خلال " + every + " أيام"), R("Find out why, and place a new first order if they will give oil.", "اعرف السبب، وأصدر أول طلب جديد إن كانوا سيعطون زيتاً.")],
        weekly: [R("Failed twice · chase every " + every + " days", "فشل مرتين · متابعة كل " + every + " أيام"), R("Keep the door open. Ask every " + every + " days whether they have oil for us.", "أبقِ الباب مفتوحاً. اسأل كل " + every + " أيام هل لديهم زيت لنا.")],
        long: [R("Failed " + fails + " times · chase every " + every + " days", "فشل " + fails + " مرات · متابعة كل " + every + " أيام"), R("A short check-in every " + every + " days. If anything has changed, place an order.", "اتصال شهري قصير. إن تغيّر شيء، أصدر طلباً.")],
      }[tier];
      if (dueIn <= 0) out.push({ type: "winback", rank: tier === "soon" ? 2 : 5, today: true, order: -fails,
        due: dueIn < 0 ? R("Overdue", "متأخرة") : R("Today", "اليوم"),
        short: TIER[0],
        why: R("They agreed " + s.agreedPrice + " and " + (fails === 1 ? "the first order" : fails + " orders") + " came back with no oil.",
               "اتفقوا على " + s.agreedPrice + " و" + (fails === 1 ? "عاد أول طلب" : "عادت " + fails + " طلبات") + " بلا زيت."),
        goal: TIER[1], tier });
    }
    if (s.activity === "inactive") out.push({ type: "winback", rank: 5, due: R("This week", "هذا الأسبوع"),
      short: R("Stopped supplying", "توقف عن التوريد"),
      why: R("They have stopped giving us oil" + (s.inactiveSince ? " since " + t(s.inactiveSince) : "") + ".",
             "توقفوا عن إعطائنا الزيت" + (s.inactiveSince ? " منذ " + t(s.inactiveSince) : "") + "."),
      goal: R("Find out why, and whether they will start again.", "اعرف السبب، وهل سيعودون.") });
    // A pre-survey the agent kept is his to call; one sent to a surveyor waits
    // for the visit and is not called.
    if (s.stage === "pre_survey" && !s.surveyWith && !s.callBack && !(s.tries > 0)) out.push({ type: "followup", rank: 5,
      due: R("This week", "هذا الأسبوع"),
      short: R("New pre-survey — first call", "قبل مسح جديد — أول مكالمة"),
      why: R("Added " + (t(s.addedOn) || "recently") + ". Nobody has spoken to them yet.", "أُضيف " + (t(s.addedOn) || "مؤخراً") + ". لم يتحدث إليهم أحد بعد."),
      goal: R("Do the survey with them on the phone, or send the surveyor.", "أجرِ المسح معهم بالهاتف، أو أرسل المساح.") });
    if (s.stage === "survey" && !s.sendBack) out.push({ type: "verification", rank: 6, due: R("This week", "هذا الأسبوع"),
      short: R("Survey waiting to be verified", "مسح ينتظر التحقق"),
      why: R("A surveyor has submitted their survey. Nothing in it counts until it is checked.", "سلّم المساح المسح. ولا يُعتدّ بشيء فيه حتى يُتحقق منه."),
      goal: R("Go through what the surveyor recorded with the owner. If it holds, it becomes a Lead.", "راجع ما سجّله المساح مع المالك. فإن صحّ، صار عميلاً محتملاً.") });
    const done = this.loggedAt(s.id);
    const open = done ? out.filter((c) => c.type === "scheduled"
      && D.dayNumber(s.callBack) === now && D.timeOf(s.callBack) > done) : out;
    return open.sort((a, b) => a.rank - b.rank);
  },

  // The top call, plus what else is open, for the outlet card and the list.
  callFor(s, ar) {
    const cs = this.callsFor(s, ar);
    if (!cs.length) return null;
    const c = cs[0];
    return Object.assign({}, c, {
      urgency: c.rank <= 1 ? 0 : c.rank <= 3 ? 1 : 2,
      also: cs.slice(1).map((x) => this.callType(x.type, ar).label + ": " + x.short).join(" · "),
    });
  },

  };
  root.ZCALLS = {
    me: ME,
    as: function (lang) { var o = Object.create(api); o.lang = lang || "en"; return o; },
  };
})(window);
