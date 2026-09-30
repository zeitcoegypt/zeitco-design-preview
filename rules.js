// What may be done, and by whom. Screens ask this file; they never decide.
//
// The lesson of v1: each screen worked out its own outcome list, so a
// pre-supplier with no collections was offered "they have stopped supplying".
// Here, outcomes are a function of the shop's four statuses. A screen that
// renders something impossible is a bug in this file, in one place.

(function (root) {
  "use strict";

  var T = function (en, ar) { return { en: en, ar: ar }; };

  // ---- how the call itself went ------------------------------------------
  var RESULTS = [
    { key: "answered", label: T("Answered", "ردّوا"),
      what: T("Somebody picked up — say what it came to", "ردّ أحدهم — قل إلامَ انتهت") },
    { key: "no_answer", label: T("No Answer", "لا رد"),
      what: T("Rang out. Books the next attempt and moves you on", "رنّ بلا رد. يحدد المحاولة التالية ويمضي بك") },
    { key: "busy", label: T("Busy", "مشغول"),
      what: T("Engaged. Books another attempt later today", "الخط مشغول. يحدد محاولة أخرى اليوم") },
    { key: "phone_off", label: T("Phone Is Off", "الهاتف مغلق"),
      what: T("Books tomorrow. Three in a row and it needs a new number", "يحدد الغد. وثلاث مرات متتالية تعني رقماً جديداً") },
    { key: "out_of_service", label: T("Out Of Service", "الرقم غير مستخدم"),
      what: T("The number is gone — this needs a reverification", "الرقم لم يعد يعمل — وهذا يحتاج إعادة تحقق") },
  ];

  // ---- what the call came to, given where the shop actually stands --------
  //
  // Read the guards, not the list: each outcome states the condition under
  // which it can have happened. An outcome with no honest condition is not
  // offered, which is the whole mechanism.
  function outcomes(s) {
    var o = [];
    var add = function (key, label, what, colour) {
      o.push({ key: key, label: label, what: what, colour: colour || "#10231C" });
    };

    if (s.stage === "pre_survey") {
      add("send_surveyor", T("Send Surveyor", "أرسل مساحاً"),
        T("Turns this into a survey for the zone's surveyor", "يحوّله إلى مسح لمساح المنطقة"), "#1F5240");
      add("phone_survey", T("Phone Survey", "مسح بالهاتف"),
        T("I take the details; a surveyor still confirms the location", "آخذ البيانات، ويبقى إثبات الموقع على مساح"), "#2C5578");
      add("call_back", T("Call Back", "معاودة الاتصال"),
        T("Not a good time to talk · books the time they asked for", "ليس وقتاً مناسباً · يحجز الوقت الذي طلبوه"), "#B3261E");
      add("not_interested", T("Not Interested", "غير مهتم"),
        T("Keeps the record, stops the calling", "يحفظ السجل ويوقف الاتصال"), "#B3261E");
      return o;
    }

    if (s.stage === "survey") {
      add("go_through", T("Go through the record with them", "راجع السجل معهم"),
        T("Line by line. Nothing verifies until every line is settled", "سطراً سطراً. ولا يتحقق شيء حتى تُحسم كل سطر"), "#1F5240");
      add("wrong_shop", T("Wrong shop — not the business surveyed", "محل خاطئ — ليس ما مُسح"),
        T("Cannot be fixed by phone · back to the zone's surveyor", "لا يُصحَّح بالهاتف · يعود لمساح المنطقة"), "#B3261E");
      add("call_back", T("Asked to be called back", "طلبوا معاودة الاتصال"),
        T("Books the time they asked for", "يحجز الوقت الذي طلبوه"), "#B3261E");
      add("not_interested", T("Not interested after all", "غير مهتم في النهاية"),
        T("Keeps the record, stops the calling", "يحفظ السجل ويوقف الاتصال"), "#B3261E");
      return o;
    }

    if (s.stage === "lead" && s.price === "increase_requested") {
      add("told_waiting", T("Told them we are still waiting", "أبلغتهم أننا ما زلنا ننتظر"),
        T("Nothing else I can do until management answers", "لا شيء آخر حتى تجيب الإدارة"), "#B3261E");
      add("call_back", T("Asked to be called back", "طلبوا معاودة الاتصال"),
        T("Books the time they asked for", "يحجز الوقت الذي طلبوه"), "#B3261E");
      return o;
    }
    if (s.stage === "lead" && s.price === "counter_offered") {
      add("took_counter", T("They accepted management's price", "قبلوا سعر الإدارة"),
        T("Carries on to Supplier, where I set the collection up", "يمضي إلى مورد، حيث أرتّب التحصيل"), "#1F5240");
      add("refused_counter", T("They refused it", "رفضوه"),
        T("Their answer goes back up to management", "ردّهم يعود إلى الإدارة"), "#B3261E");
      add("not_interested", T("Not interested", "غير مهتم"),
        T("Keeps the record, stops the calling", "يحفظ السجل ويوقف الاتصال"), "#B3261E");
      return o;
    }

    if (s.stage === "lead") {
      // A lead has no agreed price behind it, so the agent is free to his
      // ceiling. This is the only stage where that is true.
      add("agreed", T("Price agreed on this call", "اتُّفق على السعر في هذه المكالمة"),
        T("Carries on to Supplier, where I set the collection up", "يمضي إلى مورد، حيث أرتّب التحصيل"), "#1F5240");
      add("negotiating", T("Still negotiating", "ما زال التفاوض"),
        T("Free to my ceiling — no deal exists yet", "حر حتى سقفي — لا اتفاق بعد"), "#10231C");
      add("above_ceiling", T("They want more than my ceiling", "يريدون أكثر من سقفي"),
        T("Goes up for a decision · I say nothing back until it comes", "يصعد لقرار · ولا أردّ حتى يصل"), "#B3261E");
      add("call_back", T("Asked to be called back", "طلبوا معاودة الاتصال"),
        T("Books the time they asked for", "يحجز الوقت الذي طلبوه"), "#B3261E");
      add("not_interested", T("Not interested", "غير مهتم"),
        T("Keeps the record, stops the calling", "يحفظ السجل ويوقف الاتصال"), "#B3261E");
      return o;
    }

    // ---- a price exists: pre-supplier and supplier share these rules ------
    if (s.price === "increase_requested") {
      add("told_waiting", T("Told them we are still waiting", "أبلغتهم أننا ما زلنا ننتظر"),
        T("Nothing else I can do until management answers", "لا شيء آخر حتى تجيب الإدارة"), "#B3261E");
      add("order", T("Place a collection order", "إصدار طلب تحصيل"),
        T("At the old price, until a new one is approved", "بالسعر القديم حتى يُعتمد جديد"), "#1F5240");
      return o;
    }

    if (s.price === "counter_offered") {
      add("took_counter", T("They accepted our counter", "قبلوا عرضنا المقابل"),
        T("The new price is live from the next collection", "السعر الجديد يسري من التحصيل القادم"), "#1F5240");
      add("refused_counter", T("They refused our counter", "رفضوا عرضنا المقابل"),
        T("Their answer is the next round, and it goes back up", "ردّهم هو الجولة التالية، ويصعد مرة أخرى"), "#B3261E");
      if (s.activity !== "inactive" && s.activity !== "non_committed")
      add("refused_stopping", T("They refused and are stopping", "رفضوا وسيتوقفون"),
        T("Marks them " + (s.stage === "supplier" ? "inactive" : "non-committed") + " · the reason goes on the record",
          "يجعلهم " + (s.stage === "supplier" ? "غير نشطين" : "غير ملتزمين") + " · والسبب يُثبت في السجل"), "#B3261E");
      return o;
    }

    if (s.price === "renegotiating") {
      add("settled_within", T("We agreed within my ceiling", "اتفقنا في حدود سقفي"),
        T("Management handed it back to me, so I can close it", "الإدارة أعادته إليّ، فأستطيع إغلاقه"), "#1F5240");
      add("still_going", T("Still renegotiating", "ما زالت إعادة التفاوض"),
        T("Another round, still inside my ceiling", "جولة أخرى، وما زلت داخل سقفي"), "#10231C");
      add("above_ceiling", T("They want more than my ceiling", "يريدون أكثر من سقفي"),
        T("Back up to management — it is not mine to give", "يعود إلى الإدارة — فليس لي أن أمنحه"), "#B3261E");
      return o;
    }

    if (s.price === "refused") {
      add("accepted_old", T("They accepted the old price", "قبلوا السعر القديم"),
        T("Clears the at-risk flag · we carry on as before", "يُزيل علامة الخطر · ونمضي كما كنّا"), "#1F5240");
      add("order", T("Place a collection order", "إصدار طلب تحصيل"),
        T("At the agreed price", "بالسعر المتفق"), "#1F5240");
      if (s.activity !== "inactive" && s.activity !== "non_committed") {
        add(s.stage === "supplier" ? "stopped" : "no_first",
          s.stage === "supplier"
            ? T("They are stopping over it", "سيتوقفون بسببه")
            : T("They will not deliver after all", "لن يورّدوا في النهاية"),
          T("The reason goes on the record", "السبب يُثبت في السجل"), "#B3261E");
      }
      return o;
    }

    // price === "agreed"
    add("order", T("Place a collection order", "إصدار طلب تحصيل"),
      T("At the agreed price", "بالسعر المتفق"), "#1F5240");
    if (s.activity === "active" || s.activity === "new")
      add("not_ready", T("Not ready — they gave a date", "غير جاهزين — حددوا موعداً"),
        T("Books a scheduled call for that date · twice in a row marks them at risk",
          "يحجز مكالمة مجدولة لذلك الموعد · ومرتان متتاليتان تجعلانهم معرّضين للفقد"), "#B3261E");
    add("call_back", T("Asked to be called back", "طلبوا معاودة الاتصال"),
      T("Books the time they asked for", "يحجز الوقت الذي طلبوه"), "#B3261E");
    add("asks_more", T("They want a higher price", "يريدون سعراً أعلى"),
      T("I record what they ask, once — then management decides", "أسجّل ما يطلبونه مرة واحدة — ثم تقرر الإدارة"), "#B3261E");

    if (window.ZEITCO.notDelivered(s)) {
      if (s.activity === "non_committed") {
        // Already failed. The only thing a call can add is a way back.
        add("will_deliver", T("They will deliver after all", "سيورّدون في النهاية"),
          T("Back to a first order · the non-committed mark clears", "يعود إلى أول طلب · وتُزال علامة عدم الالتزام"), "#1F5240");
      } else {
        // They have never supplied, so they cannot stop. They fail a first order.
        add("no_first", T("They did not deliver the first order", "لم يورّدوا أول طلب"),
          T("Marks them non-committed — a price agreed and no oil", "يجعلهم غير ملتزمين — سعر متفق وبلا زيت"), "#B3261E");
      }
    } else if (s.activity === "inactive") {
      // Already stopped, and the reason is already on the record.
      add("supplying_again", T("They are supplying again", "عادوا إلى التوريد"),
        T("Back to active · the at-risk flag clears", "يعودون نشطين · وتُزال علامة الخطر"), "#1F5240");
    } else {
      add("stopped", T("They have stopped supplying", "توقفوا عن التوريد"),
        T("Marks them inactive — and I say why", "يجعلهم غير نشطين — وأقول السبب"), "#B3261E");
    }
    return o;
  }

  // ---- why they stopped, in the words that fit which one it is ------------
  var WHY_STOPPED = [
    { key: "dead", label: T("Number no longer works", "الرقم لم يعد يعمل"),
      then: T("Raises a reverification — nothing is wrong with the relationship", "يرفع طلب إعادة تحقق — فلا خلل في العلاقة") },
    { key: "competitor", label: T("Selling to a competitor", "يبيع لمنافس"),
      then: T("Goes to management, who decide whether to compete on price", "يذهب للإدارة لتقرر المنافسة على السعر") },
    { key: "closed", label: T("Shop has closed", "المحل أُغلق"),
      then: T("Leaves my list — there is nothing to collect", "يخرج من قائمتي — فلا شيء يُجمع") },
    { key: "low_volume", label: T("Not producing enough oil", "الإنتاج لا يكفي"),
      then: T("Called again in a month rather than chased weekly", "يُتصل به بعد شهر بدل المتابعة الأسبوعية") },
    { key: "unhappy", label: T("Unhappy with us", "غير راضٍ عنّا"),
      then: T("The reason goes to management, because it is ours to fix", "السبب يذهب للإدارة، فالخلل عندنا") },
    { key: "wont_say", label: T("They will not say", "لا يقولون"),
      then: T("The driver asks in person at the next opportunity", "يسأل السائق شخصياً في أول فرصة") },
  ];

  var WHY_NEVER = [
    { key: "dead", label: T("Number no longer works", "الرقم لم يعد يعمل"),
      then: T("Raises a reverification — we may simply have lost them", "يرفع طلب إعادة تحقق — فربما فقدنا التواصل فقط") },
    { key: "competitor", label: T("Sold it to a competitor instead", "باعوه لمنافس بدلاً منّا"),
      then: T("Goes to management — we agreed a price and were outbid", "يذهب للإدارة — اتفقنا على سعر وسبقنا غيرنا") },
    { key: "closed", label: T("Shop has closed", "المحل أُغلق"),
      then: T("Leaves my list — there is nothing to collect", "يخرج من قائمتي — فلا شيء يُجمع") },
    { key: "low_volume", label: T("Not producing enough oil yet", "الإنتاج لا يكفي بعد"),
      then: T("Called again in a month rather than chased weekly", "يُتصل به بعد شهر بدل المتابعة الأسبوعية") },
    { key: "changed_mind", label: T("Changed their mind about the price", "غيّروا رأيهم في السعر"),
      then: T("Reopens the negotiation — the agreement never became real", "يعيد فتح التفاوض — فالاتفاق لم يصر واقعاً") },
    { key: "wont_say", label: T("They will not say", "لا يقولون"),
      then: T("The driver asks in person at the next opportunity", "يسأل السائق شخصياً في أول فرصة") },
  ];

  function whyList(outcomeKey) {
    return outcomeKey === "no_first" ? WHY_NEVER : WHY_STOPPED;
  }

  // ---- what the agent may do at all, at this moment ----------------------
  function powers(s) {
    var p = [];
    var can = function (yes, label) { p.push({ yes: yes, label: label }); };
    can(s.stage === "survey", T("Correct the record — on this call only", "تصحيح السجل — في هذه المكالمة فقط"));
    can(true, T("Log the outcome of the call", "تسجيل نتيجة المكالمة"));
    can(s.stage === "supplier",
      T("Place a collection order", "إصدار طلب تحصيل"));
    can(s.stage === "lead" || s.price === "renegotiating",
      T("Negotiate up to my ceiling", "التفاوض حتى سقفي"));
    can(false, T("Change the record after it is verified", "تغيير السجل بعد التحقق"));
    can(false, T("Re-verify without approval", "إعادة التحقق دون موافقة"));
    can(false, T("Reopen a negotiation myself", "فتح التفاوض بنفسي"));
    can(false, T("Reassign the shop to another agent", "نقل المحل إلى موظف آخر"));
    return p;
  }

  // ---- the lines read back on a verifying call ---------------------------
  var CHECK = [
    { key: "name", label: T("Outlet Name", "اسم المنفذ"), from: "name" },
    { key: "contact", label: T("Who we ask for", "من نطلبه"), from: "contact" },
    { key: "phone", label: T("Phone", "الهاتف"), from: "phone" },
    { key: "area", label: T("Area", "المنطقة"), from: "area" },
    { key: "type", label: T("Outlet Food Category", "فئة طعام المحل"), from: "type" },
  ];

  // ---- and where he may go once it passes --------------------------------
  var NEXT = [
    { key: "negotiate", label: T("Start negotiating now", "ابدأ التفاوض الآن"),
      what: T("Same call · I open with the tier price and work to my ceiling", "المكالمة نفسها · أفتح بسعر الشريحة وأعمل حتى سقفي") },
    { key: "agreed_now", label: T("They agreed a price on this call", "اتفقوا على سعر في هذه المكالمة"),
      what: T("Carries straight on to Supplier, where I set the collection up", "يمضي مباشرة إلى مورد، حيث أرتّب التحصيل") },
    { key: "later", label: T("Leave it as a Lead for now", "اتركه عميلاً محتملاً الآن"),
      what: T("Verified and in my list · I call them back to talk price", "متحقَّق ومدرج عندي · أعاود الاتصال للحديث عن السعر") },
  ];

  // ---- who owns a shop, and who may move it ------------------------------
  var OWNERSHIP = {
    holds: T("The agent who verified it holds the shop.", "الموظف الذي تحقق منه يحتفظ بالمحل."),
    until: T("It stays with them until it is reassigned, and only the financial or Senior Manager can reassign it.",
             "ويبقى معه حتى يُنقل، ولا ينقله إلا المدير المالي أو المدير العام."),
  };

  var APPROVERS = {
    price: T("The financial or Senior Manager, whoever sees it first", "المدير المالي أو المدير العام، أيهما رآه أولاً"),
    reverify: T("The financial or Senior Manager", "المدير المالي أو المدير العام"),
    reassign: T("The financial or Senior Manager only", "المدير المالي أو المدير العام فقط"),
  };

  // ---- what a manager may answer to a price request ----------------------
  var ANSWERS = [
    { key: "approve", label: T("Approve the increase", "الموافقة على الزيادة"),
      then: T("The agent closes it and takes the order", "يغلقه الموظف ويأخذ الطلب") },
    { key: "counter", label: T("Counter at our price", "عرض سعرنا المقابل"),
      then: T("The agent puts it to the shop; their answer comes back up", "يعرضه الموظف على المحل، ويعود ردّهم") },
    { key: "hand_back", label: T("Negotiate within your ceiling", "تفاوض في حدود سقفك"),
      then: T("The agent may settle it himself, below his limit", "للموظف أن يُنهيه بنفسه، دون حدّه") },
    { key: "refuse", label: T("Refuse", "الرفض"),
      then: T("The old price stands, and the shop is flagged at risk", "يبقى السعر القديم، ويُعلَّم المحل كمعرّض للفقد") },
  ];

  root.ZRULES = {
    // Read live from the management setting, so a change shows on every screen.
    get ceiling() { return root.ZEITCO && root.ZEITCO.ceiling ? root.ZEITCO.ceiling() : 6.20; },
    results: RESULTS,
    outcomes: outcomes,
    whyList: whyList,
    whyStopped: WHY_STOPPED,
    whyNever: WHY_NEVER,
    powers: powers,
    check: CHECK,
    next: NEXT,
    ownership: OWNERSHIP,
    approvers: APPROVERS,
    answers: ANSWERS,
    // A supplier's agreed price is management's; a lead's is the agent's.
    // Once the owner has answered, the shop is never a Pre-Survey again.
    // Complete on the phone: a Lead. A surveyor still needed: a Survey.
    stageAfterAnswer: function (complete) { return complete ? "lead" : "survey"; },
    priceIsMine: function (s) { return s.stage === "lead" || s.price === "renegotiating"; },
    needsWhy: function (key) { return key === "stopped" || key === "no_first" || key === "refused_stopping"; },
  };
})(window);
