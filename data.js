// ONE source of truth for every shop in the prototype.
//
// The lesson of v1: every screen kept its own array, so a Lead appeared in the
// verify list, a supplier read as a lead, and a price differed between two
// cards. Here there is one list. Screens filter it. They never restate it.
//
// Four independent things are true of a shop at any moment:
//
//   stage     how far it has come      pre_survey → survey → lead → supplier
//             (A Supplier that has not delivered yet is not a stage of its own:
//             activity new · first_order_out · non_committed says so. D.notDelivered.)
//   data      is the number right      confirmed · unconfirmed · wrong
//
// "Not answering" is NOT a data value. It is a count of unanswered calls
// (tries) and sits beside data. A shop whose number is confirmed can still
// go quiet; that does not make the number wrong. D.notAnswering(s) reads it.
//   activity  are they giving us oil   not_started · new · first_order_out · non_committed · active · inactive
//   price     where the money stands   not_discussed · in_negotiation · agreed · increase_requested
//                                      counter_offered · renegotiating · refused
//
// Illegal combinations throw when this file loads, so a shop that contradicts
// itself cannot reach a screen. That check is the whole point of the file.

(function (root) {
  "use strict";

  var STAGES = ["pre_survey", "survey", "lead", "supplier"];

  var LABEL = {
    stage: {
      pre_survey:   { en: "Pre-Survey",   ar: "قبل المسح" },
      survey:       { en: "Survey",       ar: "مسح" },
      lead:         { en: "Lead",         ar: "عميل محتمل" },
      supplier:     { en: "Supplier",     ar: "مورد" },
    },
    data: {
      confirmed:     { en: "Confirmed",      ar: "مؤكَّد" },
      unconfirmed:   { en: "Unconfirmed",    ar: "غير مؤكَّد" },
      wrong:         { en: "Wrong",          ar: "خاطئ" },
    },
    activity: {
      not_started:     { en: "Not Started",     ar: "لم يبدأ" },
      new:             { en: "New",             ar: "جديد" },
      first_order_out: { en: "First Order Out", ar: "أول طلب صادر" },
      non_committed:   { en: "Non-Committed",   ar: "غير ملتزم" },
      active:          { en: "Active",          ar: "نشط" },
      inactive:        { en: "Inactive",        ar: "غير نشط" },
    },
    price: {
      not_discussed:      { en: "Not Discussed",      ar: "لم يُناقش" },
      in_negotiation:     { en: "In Negotiation",     ar: "قيد التفاوض" },
      agreed:             { en: "Agreed",             ar: "متفق عليه" },
      increase_requested: { en: "Increase Requested", ar: "طُلبت زيادة" },
      counter_offered:    { en: "Counter Offered",    ar: "عُرض سعر مقابل" },
      renegotiating:      { en: "Renegotiating",      ar: "إعادة تفاوض" },
      refused:            { en: "Refused",            ar: "مرفوض" },
    },
  };

  // What a stage may and may not carry. Breaking one of these is a bug in the
  // data, not a display problem, so it stops the file loading.
  var LAW = {
    pre_survey: {
      activity: ["not_started"],
      price: ["not_discussed"],
      collections: 0,
      needs: ["name", "area", "reach"],
      never: ["agreedPrice", "verifiedOn"],
    },
    survey: {
      activity: ["not_started"],
      price: ["not_discussed"],
      collections: 0,
      needs: ["name", "area", "reach", "surveyor"],
      never: ["agreedPrice", "verifiedOn"],
    },
    lead: {
      activity: ["not_started"],
      price: ["in_negotiation", "not_discussed", "refused", "increase_requested", "counter_offered"],
      collections: 0,
      // Two ways in: a surveyor's form verified on a call, or a phone survey
      // the agent finished himself (rule 6, amended). One of the two dates.
      needs: ["name", "area", "reach", "agent", "becameLead"],
      never: ["agreedPrice"],
    },
    // A price agreed makes a Supplier. Until the first load is weighed and paid
    // it is new / first_order_out / non_committed, with no collections; after
    // that it is active or inactive, with at least one.
    supplier: {
      activity: ["new", "first_order_out", "non_committed", "active", "inactive"],
      price: ["agreed", "increase_requested", "counter_offered", "renegotiating", "refused"],
      needs: ["name", "area", "reach", "agent", "becameLead", "agreedPrice", "collectionDay"],
      never: [],
    },
  };

  var PREFIX = { pre_survey: "PS", survey: "SV", lead: "LD", supplier: "SP" };

  // The survey form's own answer lists. They live here rather than on the form
  // so an answer stored on a shop can be checked against them when this file
  // loads — a survey carrying an outlet type the form cannot offer is a bug.
  // Answers are stored as keys. The label is looked up, never stored.
  var FORM = {
    outletTypes: [
      { k: "grill",          en: "Grill / charcoal",  ar: "مشويات / فحم" },
      { k: "fried_chicken",  en: "Fried chicken",     ar: "دجاج مقلي" },
      { k: "koshary",        en: "Koshary",           ar: "كشري" },
      { k: "fish",           en: "Fish",              ar: "أسماك" },
      { k: "mandi",          en: "Mandi",             ar: "مندي" },
      { k: "shawarma",       en: "Shawarma",          ar: "شاورما" },
      { k: "crepe",          en: "Crepe / pastry",    ar: "كريب وحلويات" },
      { k: "bakery",         en: "Bakery / sweets",   ar: "مخبز / حلويات" },
      { k: "cafe",           en: "Café",              ar: "مقهى" },
      { k: "pizza",          en: "Pizza",             ar: "بيتزا" },
      { k: "breakfast",      en: "Breakfast / fuul",  ar: "فطار / فول" },
      { k: "hotel",          en: "Hotel / catering",  ar: "فندق / تموين" },
      { k: "other",          en: "Other",             ar: "أخرى" },
    ],
    oilTypes: [
      { k: "corn",             en: "Corn",             ar: "ذرة" },
      { k: "soya",             en: "Soya",             ar: "صويا" },
      { k: "palm_olein",       en: "Palm olein",       ar: "أولين نخيل" },
      { k: "palm_shortening",  en: "Palm shortening",  ar: "سمن نخيل" },
      { k: "blend",            en: "Blend",            ar: "خليط" },
      { k: "other",            en: "Other",            ar: "أخرى" },
    ],
    sellingTo: [
      { k: "not_selling",  en: "Not selling it to anyone",  ar: "لا يبيعه لأحد" },
      { k: "competitor",   en: "Selling to a competitor",   ar: "يبيعه لمنافس" },
      { k: "undecided",    en: "Undecided",                 ar: "لم يقرر" },
    ],
    willingness: [
      { k: "yes",    en: "Yes",    ar: "نعم" },
      { k: "no",     en: "No",     ar: "لا" },
      { k: "maybe",  en: "Maybe",  ar: "ربما" },
    ],
    competitors: [
      { k: "masria",  en: "Masria Oils",   ar: "مصرية للزيوت" },
      { k: "delta",   en: "Delta Collect", ar: "دلتا كوليكت" },
    ],
  };

  // name en/ar, area en/ar, type en/ar, contact en/ar, phone, then the state.
  function shop(o) { return o; }

  var SHOPS = [
    // ---- Pre-Survey: a name, an area, a way to reach them. Nobody has been.
    shop({ id: "PS-0412", name: { en: "Ful W Taameya El Sobky", ar: "فول وطعمية السبكي" },
      area: { en: "Giza 2", ar: "الجيزة 2" }, type: { en: "Breakfast", ar: "فطار" },
      contact: { en: "Sobky", ar: "السبكي" }, phone: "0100 774 2218",
      stage: "pre_survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      addedBy: { en: "H. Fawzy, agent", ar: "ه. فوزي، موظف" }, addedOn: "18 Sep" }),
    shop({ id: "PS-0413", name: { en: "Zad El Mosafer", ar: "زاد المسافر" },
      area: { en: "Nasr City 1", ar: "مدينة نصر 1" }, type: { en: "Grill", ar: "مشويات" },
      contact: { en: "Abu Hamza", ar: "أبو حمزة" }, phone: "0111 208 4470",
      stage: "pre_survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      addedBy: { en: "H. Fawzy, agent", ar: "ه. فوزي، موظف" }, addedOn: "18 Sep" }),
    shop({ id: "PS-0414", name: { en: "El Shabrawy Giza", ar: "الشبراوي الجيزة" },
      area: { en: "Giza 1", ar: "الجيزة 1" }, type: { en: "Egyptian", ar: "مصري" },
      contact: { en: "Nader Shabrawy", ar: "نادر الشبراوي" }, phone: "0122 661 9034",
      stage: "pre_survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      addedBy: { en: "S. Wahba, Financial Manager", ar: "س. وهبة، المدير المالي" }, addedOn: "17 Sep" }),
    shop({ id: "PS-0415", name: { en: "Sea Gull Fish", ar: "سي جل للأسماك" },
      area: { en: "Alexandria 2", ar: "الإسكندرية 2" }, type: { en: "Fish", ar: "أسماك" },
      contact: { en: "Wael Roushdy", ar: "وائل رشدي" }, phone: "0155 903 7781",
      stage: "pre_survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      addedBy: { en: "H. Fawzy, agent", ar: "ه. فوزي، موظف" }, addedOn: "15 Sep", tries: 3 }),
    shop({ id: "PS-0416", name: { en: "Pizza Napoli", ar: "بيتزا نابولي" },
      area: { en: "Maadi 1", ar: "المعادي 1" }, type: { en: "Pizza", ar: "بيتزا" },
      contact: { en: "Marco Aziz", ar: "ماركو عزيز" }, phone: "0100 442 8891",
      stage: "pre_survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      addedBy: { en: "N. Halim, Senior Manager", ar: "ن. حليم، المدير العام" }, addedOn: "19 Sep" }),
    shop({ id: "PS-0417", name: { en: "Hadramout Haram", ar: "حضرموت الهرم" },
      area: { en: "Haram 1", ar: "الهرم 1" }, type: { en: "Mandi", ar: "مندي" },
      contact: { en: "Salem Awad", ar: "سالم عوض" }, phone: "0128 337 5560",
      stage: "pre_survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      addedBy: { en: "H. Fawzy, agent", ar: "ه. فوزي، موظف" }, addedOn: "19 Sep" }),

    // ---- Survey: a surveyor has been, or is going. Waiting on the call.
    shop({ id: "SV-0388", name: { en: "Koshary El Tahrir", ar: "كشري التحرير" },
      area: { en: "Downtown 2", ar: "وسط البلد 2" }, type: { en: "Koshary", ar: "كشري" },
      contact: { en: "Hosni Tahrir", ar: "حسني التحرير" }, phone: "0100 118 2276",
      stage: "survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "11 Sep 18:20",
      gps: "±6 m", complete: 92, askedAtDoor: "5.80", volume: 180,
      survey: { by: "surveyor", city: { en: "Cairo", ar: "القاهرة" }, coords: "30.0459, 31.2357",
        street: { en: "Champollion", ar: "شامبليون" },
        address: { en: "Building 7, under the arcade", ar: "عمارة 7، تحت الممر" },
        outletPhone: "02 2574 1180", outletType: "koshary", oilType: "corn",
        sellingTo: "not_selling", willingness: "yes" } }),
    shop({ id: "SV-0389", name: { en: "Mandi House Dokki", ar: "بيت المندي الدقي" },
      area: { en: "Dokki 3", ar: "الدقي 3" }, type: { en: "Mandi and grill", ar: "مندي ومشويات" },
      contact: { en: "Fahd El Sayed", ar: "فهد السيد" }, phone: "0111 664 3390",
      stage: "survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "12 Sep 16:40",
      gps: "±11 m", complete: 88, askedAtDoor: "6.20", volume: 420,
      survey: { by: "surveyor", city: { en: "Cairo", ar: "القاهرة" }, coords: "30.0385, 31.2118",
        street: { en: "Tahrir Street", ar: "شارع التحرير" },
        address: { en: "Building 22, ground floor", ar: "عمارة 22، الدور الأرضي" },
        outletPhone: "02 3762 4417", outletType: "mandi", oilType: "palm_olein",
        sellingTo: "competitor", competitor: "masria",
        contractLength: { en: "12 months", ar: "12 شهراً" }, contractEnds: "31 Dec",
        willingness: "maybe",
        rep: { en: "Ayman Fahd", ar: "أيمن فهد" }, repPhone: "0111 664 3391" } }),
    shop({ id: "SV-0390", name: { en: "Fish Market Alexandria", ar: "سوق السمك الإسكندرية" },
      area: { en: "Alexandria 1", ar: "الإسكندرية 1" }, type: { en: "Fish", ar: "أسماك" },
      contact: { en: "Sameh Bahr", ar: "سامح بحر" }, phone: "0122 550 8817",
      stage: "survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "12 Sep 11:05",
      gps: "±8 m", complete: 94, askedAtDoor: "5.80", volume: 240,
      survey: { by: "surveyor", city: { en: "Alexandria", ar: "الإسكندرية" }, coords: "31.1975, 29.8925",
        street: { en: "Safeya Zaghloul", ar: "صفية زغلول" },
        address: { en: "Shop 4, the fish souk arcade", ar: "محل 4، ممر سوق السمك" },
        outletPhone: "03 4862 2210", outletType: "fish", oilType: "blend",
        sellingTo: "undecided", willingness: "yes" } }),
    shop({ id: "SV-0391", name: { en: "Shawarma El Reem", ar: "شاورما الريم" },
      area: { en: "Nasr City 2", ar: "مدينة نصر 2" }, type: { en: "Shawarma", ar: "شاورما" },
      contact: { en: "Reem Adel", ar: "ريم عادل" }, phone: "0100 992 3341",
      stage: "survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "13 Sep 13:20",
      gps: "±9 m", complete: 91, askedAtDoor: "6.00", volume: 280,
      survey: { by: "surveyor", city: { en: "Cairo", ar: "القاهرة" }, coords: "30.0626, 31.3402",
        street: { en: "Mostafa El Nahhas", ar: "مصطفى النحاس" },
        address: { en: "Building 14, next to the pharmacy", ar: "عمارة 14، بجوار الصيدلية" },
        outletType: "shawarma", oilType: "soya",
        sellingTo: "not_selling", willingness: "yes",
        rep: { en: "Ahmed Adel", ar: "أحمد عادل" }, repPhone: "0100 992 3342" } }),
    shop({ id: "SV-0392", name: { en: "Crepe Deluxe Maadi", ar: "كريب ديلوكس المعادي" },
      area: { en: "Maadi 2", ar: "المعادي 2" }, type: { en: "Crepe and pastry", ar: "كريب وحلويات" },
      contact: { en: "Peter Naguib", ar: "بيتر نجيب" }, phone: "0155 220 6674",
      stage: "survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "13 Sep 10:02",
      gps: "±42 m", complete: 72, askedAtDoor: "6.10", volume: 120, sendBack: "gps",
      survey: { by: "surveyor", city: { en: "Cairo", ar: "القاهرة" }, coords: "29.9602, 31.2569",
        address: { en: "Unit 3, Road 9", ar: "وحدة 3، شارع 9" },
        outletType: "crepe", oilType: "palm_shortening" } }),
    shop({ id: "SV-0393", name: { en: "Grill House Haram", ar: "جريل هاوس الهرم" },
      area: { en: "Haram 2", ar: "الهرم 2" }, type: { en: "Grill", ar: "مشويات" },
      contact: { en: "Ashraf Kamel", ar: "أشرف كامل" }, phone: "0128 771 4408",
      stage: "survey", data: "unconfirmed", activity: "not_started", price: "not_discussed",
      surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "14 Sep 09:15",
      gps: "±7 m", complete: 64, askedAtDoor: "5.95", volume: 160, sendBack: "incomplete",
      survey: { by: "surveyor", city: { en: "Cairo", ar: "القاهرة" }, coords: "29.9885, 31.1551",
        address: { en: "Next to the petrol station, Haram Street", ar: "بجوار محطة البنزين، شارع الهرم" },
        outletType: "grill" } }),

    // ---- Lead: verified, and a price on the table. Nothing collected.
    shop({ id: "LD-0841", name: { en: "Al Nour Grill", ar: "النور جريل" },
      area: { en: "Nasr City 2", ar: "مدينة نصر 2" }, type: { en: "Grill", ar: "مشويات" },
      contact: { en: "Sayed El Nour", ar: "سيد النور" }, phone: "0100 447 1882",
      stage: "lead", data: "confirmed", activity: "not_started", price: "in_negotiation",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "14 Sep 10:40", gps: "±7 m", complete: 96, verifiedOn: "16 Sep", askedPrice: "6.35",
      rounds: [
        { side: "us", amount: "5.80", when: "16 Sep", who: { en: "opening, from the tier table", ar: "الافتتاح، من جدول الشرائح" } },
        { side: "them", amount: "6.35", when: "16 Sep", who: { en: "the owner held out", ar: "صاحب المحل تمسّك" } },
      ] }),
    shop({ id: "LD-0842", name: { en: "Zahret El Bustan", ar: "زهرة البستان" },
      area: { en: "Zamalek 1", ar: "الزمالك 1" }, type: { en: "Café", ar: "مقهى" },
      contact: { en: "Bustan Gaber", ar: "بستان جابر" }, phone: "0111 330 9925",
      stage: "lead", data: "confirmed", activity: "not_started", price: "in_negotiation",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "15 Sep 12:15", gps: "±9 m", complete: 93, verifiedOn: "17 Sep", askedPrice: "6.40",
      rounds: [
        { side: "us", amount: "5.90", when: "17 Sep", who: { en: "opening", ar: "الافتتاح" } },
        { side: "them", amount: "6.40", when: "17 Sep", who: { en: "they want more", ar: "يريدون أكثر" } },
        { side: "us", amount: "6.10", when: "20 Sep", who: { en: "our counter", ar: "عرضنا المقابل" } },
      ] }),
    shop({ id: "LD-0843", name: { en: "Kebdet El Prince", ar: "كبدة الأمير" },
      area: { en: "Downtown 1", ar: "وسط البلد 1" }, type: { en: "Liver and brain", ar: "كبدة ومخ" },
      contact: { en: "Sameh El Prince", ar: "سامح الأمير" }, phone: "0122 118 7734",
      stage: "lead", data: "confirmed", activity: "not_started", price: "in_negotiation",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "13 Sep 15:30", gps: "±6 m", complete: 97, verifiedOn: "15 Sep", askedPrice: "6.00",
      callBack: "21 Sep 16:00" }),
    shop({ id: "LD-0844", name: { en: "Abou Shakra Giza", ar: "أبو شقرة الجيزة" },
      area: { en: "Mohandessin 1", ar: "المهندسين 1" }, type: { en: "Grill", ar: "مشويات" },
      contact: { en: "Hazem Shakra", ar: "حازم شقرة" }, phone: "0100 663 2218",
      stage: "lead", data: "confirmed", activity: "not_started", price: "in_negotiation",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "12 Sep 09:50", gps: "±8 m", complete: 91, verifiedOn: "14 Sep", askedPrice: "6.15" }),
    shop({ id: "LD-0845", name: { en: "Samakmak Alexandria", ar: "سمكمك الإسكندرية" },
      area: { en: "Alexandria 2", ar: "الإسكندرية 2" }, type: { en: "Fish", ar: "أسماك" },
      contact: { en: "Mamdouh Samak", ar: "ممدوح سمك" }, phone: "0155 447 8890",
      stage: "lead", data: "confirmed", activity: "not_started", price: "in_negotiation",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "8 Sep 14:05", gps: "±12 m", complete: 89, verifiedOn: "10 Sep", askedPrice: "6.25", tries: 4 }),

    // ---- Leads the call center surveyed itself, by phone. No surveyor has
    // stood at either, so the location is unproved and a job is out for it.
    // Rule 6 (amended): finishing the phone survey is what makes it a Lead.
    shop({ id: "LD-0846", name: { en: "Broasted El Sham", ar: "بروستد الشام" },
      area: { en: "Nasr City 1", ar: "مدينة نصر 1" }, type: { en: "Fried chicken", ar: "دجاج مقلي" },
      contact: { en: "Firas Haddad", ar: "فراس حداد" }, phone: "0100 336 9942",
      stage: "lead", data: "confirmed", activity: "not_started", price: "not_discussed",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" },
      phoneSurveyOn: "19 Sep", locationDue: "22 Sep",
      locationWith: { en: "A. Sameh", ar: "أ. سامح" },
      askedAtDoor: "6.30", volume: 260,
      survey: { by: "phone", city: { en: "Cairo", ar: "القاهرة" },
        street: { en: "Abbas El Akkad", ar: "عباس العقاد" },
        address: { en: "Building 61, first floor", ar: "عمارة 61، الدور الأول" },
        outletType: "fried_chicken", oilType: "palm_olein",
        sellingTo: "not_selling", willingness: "yes" } }),
    shop({ id: "LD-0847", name: { en: "Fatatri El Hoda", ar: "فطاطري الهدى" },
      area: { en: "Faisal 2", ar: "فيصل 2" }, type: { en: "Pastry", ar: "فطاير" },
      contact: { en: "Hoda Mansour", ar: "هدى منصور" }, phone: "0122 447 1103",
      stage: "lead", data: "confirmed", activity: "not_started", price: "in_negotiation",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" },
      phoneSurveyOn: "15 Sep", locationDue: "18 Sep",
      locationWith: { en: "M. Fawzy", ar: "م. فوزي" },
      askedPrice: "6.10", askedAtDoor: "6.10", volume: 140,
      survey: { by: "phone", city: { en: "Cairo", ar: "القاهرة" },
        address: { en: "Above the bakery, Faisal main street", ar: "فوق المخبز، شارع فيصل الرئيسي" },
        outletType: "bakery", oilType: "soya",
        sellingTo: "undecided", willingness: "maybe" } }),

    // ---- Supplier, not delivered yet: a price agreed, nothing collected.
    shop({ id: "SP-0147", name: { en: "Cilantro Maadi", ar: "سيلانترو المعادي" },
      area: { en: "Maadi 4", ar: "المعادي 4" }, type: { en: "Café", ar: "مقهى" },
      contact: { en: "Nourhan Adly", ar: "نورهان عدلي" }, phone: "0100 229 5561",
      stage: "supplier", data: "confirmed", activity: "new", price: "agreed",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "10 Sep 11:20", gps: "±5 m", complete: 98, verifiedOn: "12 Sep",
      agreedPrice: "6.00", agreedOn: "14 Sep", collectionDay: { en: "Sunday, weekly", ar: "الأحد، أسبوعياً" },
      rep: { en: "Saeed Nour", ar: "سعيد نور" }, repPhone: "0100 229 5562" }),
    shop({ id: "SP-0148", name: { en: "Bakery, Zamalek", ar: "مخبز الزمالك" },
      area: { en: "Zamalek 2", ar: "الزمالك 2" }, type: { en: "Bakery", ar: "مخبز" },
      contact: { en: "Yara Fouad", ar: "يارا فؤاد" }, phone: "0111 552 3307",
      stage: "supplier", data: "confirmed", activity: "first_order_out", price: "agreed",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "6 Sep 16:45", gps: "±7 m", complete: 95, verifiedOn: "9 Sep",
      agreedPrice: "6.05", agreedOn: "11 Sep", collectionDay: { en: "Wednesday, weekly", ar: "الأربعاء، أسبوعياً" },
      rep: { en: "Yara Fouad", ar: "يارا فؤاد" }, repPhone: "0111 552 3307",
      firstOrderOn: "19 Sep" }),
    shop({ id: "SP-0149", name: { en: "Zamalek Fish House", ar: "بيت السمك الزمالك" },
      area: { en: "Zamalek 1", ar: "الزمالك 1" }, type: { en: "Fish", ar: "أسماك" },
      contact: { en: "Kamal Bahgat", ar: "كمال بهجت" }, phone: "0122 993 4418",
      stage: "supplier", data: "confirmed", activity: "non_committed", price: "agreed",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "26 Aug 10:10", gps: "±9 m", complete: 92, verifiedOn: "28 Aug",
      agreedPrice: "6.10", agreedOn: "1 Sep", collectionDay: { en: "Monday, weekly", ar: "الاثنين، أسبوعياً" },
      rep: { en: "Kamal Bahgat", ar: "كمال بهجت" }, repPhone: "0122 993 4418",
      firstOrderOn: "5 Sep", failedReason: "competitor" }),

    // ---- Supplier: a price and real collections.
    shop({ id: "SP-0092", name: { en: "El Prince Imbaba", ar: "محل الأمير إمبابة" },
      area: { en: "Imbaba 1", ar: "إمبابة 1" }, type: { en: "Grill", ar: "مشويات" },
      contact: { en: "Mohamed El Prince", ar: "محمد الأمير" }, phone: "0100 551 2908",
      stage: "supplier", data: "confirmed", activity: "active", price: "increase_requested",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "31 Jul 09:30", gps: "±6 m", complete: 99, verifiedOn: "2 Aug",
      agreedPrice: "6.10", agreedOn: "4 Aug", collectionDay: { en: "Sunday and Wednesday", ar: "الأحد والأربعاء" },
      rep: { en: "Mohamed El Prince", ar: "محمد الأمير" }, repPhone: "0100 551 2908",
      askedPrice: "6.45", askedOn: "19 Sep", withApprover: { en: "Financial Manager", ar: "المدير المالي" },
      collections: [
        { when: "18 Sep", kg: 190, price: "6.10" }, { when: "15 Sep", kg: 160, price: "6.10" },
        { when: "11 Sep", kg: 205, price: "6.10" }, { when: "8 Sep", kg: 175, price: "6.10" },
      ] }),
    shop({ id: "SP-0088", name: { en: "Abou Tarek Branch 3", ar: "أبو طارق فرع 3" },
      area: { en: "Downtown 1", ar: "وسط البلد 1" }, type: { en: "Koshary", ar: "كشري" },
      contact: { en: "Tarek Selim", ar: "طارق سليم" }, phone: "0100 331 7742",
      stage: "supplier", data: "confirmed", activity: "active", price: "counter_offered",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "30 May 13:15", gps: "±8 m", complete: 96, verifiedOn: "1 Jun",
      agreedPrice: "6.00", agreedOn: "2 Jun", collectionDay: { en: "Tuesday, weekly", ar: "الثلاثاء، أسبوعياً" },
      rep: { en: "Tarek Selim", ar: "طارق سليم" }, repPhone: "0100 331 7742",
      askedPrice: "6.30", askedOn: "17 Sep", counterPrice: "6.15", counterOn: "20 Sep",
      collections: [
        { when: "17 Sep", kg: 410, price: "6.00" }, { when: "10 Sep", kg: 385, price: "6.00" },
        { when: "3 Sep", kg: 430, price: "6.00" },
      ] }),
    shop({ id: "SP-0071", name: { en: "Hadramout Faisal", ar: "حضرموت فيصل" },
      area: { en: "Faisal 2", ar: "فيصل 2" }, type: { en: "Mandi", ar: "مندي" },
      contact: { en: "Nasser Awad", ar: "ناصر عوض" }, phone: "0128 337 5561",
      stage: "supplier", data: "confirmed", activity: "active", price: "agreed",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "8 May 10:00", gps: "±7 m", complete: 94, verifiedOn: "10 May",
      agreedPrice: "6.05", agreedOn: "11 May", collectionDay: { en: "Thursday, weekly", ar: "الخميس، أسبوعياً" },
      rep: { en: "Nasser Awad", ar: "ناصر عوض" }, repPhone: "0128 337 5561", tries: 3,
      collections: [
        { when: "12 Sep", kg: 320, price: "6.05" }, { when: "5 Sep", kg: 295, price: "6.05" },
      ] }),
    shop({ id: "SP-0064", name: { en: "Tabali Haram", ar: "تبالي الهرم" },
      area: { en: "Haram 3", ar: "الهرم 3" }, type: { en: "Grill", ar: "مشويات" },
      contact: { en: "Sherif Tabali", ar: "شريف تبالي" }, phone: "0100 884 2217",
      stage: "supplier", data: "confirmed", activity: "active", price: "refused",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "6 Mar 11:45", gps: "±5 m", complete: 97, verifiedOn: "8 Mar",
      agreedPrice: "6.20", agreedOn: "9 Mar", collectionDay: { en: "Saturday, weekly", ar: "السبت، أسبوعياً" },
      rep: { en: "Sherif Tabali", ar: "شريف تبالي" }, repPhone: "0100 884 2217",
      askedPrice: "6.60", askedOn: "16 Sep", refusedOn: "18 Sep", atRisk: true,
      collections: [
        { when: "14 Sep", kg: 240, price: "6.20" }, { when: "7 Sep", kg: 255, price: "6.20" },
      ] }),
    shop({ id: "SP-0059", name: { en: "Koshary Abou Emad", ar: "كشري أبو عماد" },
      area: { en: "Dokki 1", ar: "الدقي 1" }, type: { en: "Koshary", ar: "كشري" },
      contact: { en: "Emad Fathy", ar: "عماد فتحي" }, phone: "0111 447 2290",
      stage: "supplier", data: "confirmed", activity: "active", price: "agreed",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "A. Sameh", ar: "أ. سامح" }, surveyedOn: "12 Feb 15:20", gps: "±10 m", complete: 93, verifiedOn: "14 Feb",
      agreedPrice: "5.95", agreedOn: "15 Feb", collectionDay: { en: "Monday, weekly", ar: "الاثنين، أسبوعياً" },
      rep: { en: "Emad Fathy", ar: "عماد فتحي" }, repPhone: "0111 447 2290",
      collections: [
        { when: "16 Sep", kg: 280, price: "5.95" }, { when: "9 Sep", kg: 310, price: "5.95" },
        { when: "2 Sep", kg: 265, price: "5.95" },
      ] }),
    shop({ id: "SP-0041", name: { en: "Sea Gate Fish", ar: "بوابة البحر للأسماك" },
      area: { en: "Alexandria 1", ar: "الإسكندرية 1" }, type: { en: "Fish", ar: "أسماك" },
      contact: { en: "Gamal Sayed", ar: "جمال سيد" }, phone: "0122 660 3318",
      stage: "supplier", data: "confirmed", activity: "inactive", price: "agreed",
      agent: { en: "H. Fawzy", ar: "ه. فوزي" }, surveyor: { en: "M. Fawzy", ar: "م. فوزي" }, surveyedOn: "2 Jan 09:15", gps: "±8 m", complete: 95, verifiedOn: "3 Jan",
      agreedPrice: "6.15", agreedOn: "5 Jan", collectionDay: { en: "Friday, weekly", ar: "الجمعة، أسبوعياً" },
      rep: { en: "Gamal Sayed", ar: "جمال سيد" }, repPhone: "0122 660 3318",
      inactiveSince: "28 Aug", inactiveReason: "competitor",
      collections: [
        { when: "21 Aug", kg: 180, price: "6.15" }, { when: "14 Aug", kg: 195, price: "6.15" },
      ] }),
  ];

  // ---- the rest of the book -----------------------------------------------
  //
  // The shops above are the ones with stories: the refused price, the shop
  // that never delivered, the two surveyed by phone. They are not a business.
  // Operations plans six trucks a day, and six trucks need a book of shops to
  // draw on, so the rest is generated here — coherent by construction and
  // checked by the same loader as everything else. Deterministic: no random,
  // so the same shop is in the same place on every screen and every reload.

  var BRAND = [
    ["Koshary", "كشري"], ["Grill", "مشويات"], ["Shawarma", "شاورما"], ["Mandi", "مندي"],
    ["Broasted", "بروستد"], ["Fish", "أسماك"], ["Bakery", "مخبز"], ["Café", "مقهى"],
    ["Pizza", "بيتزا"], ["Fatatri", "فطاطري"], ["Ful & Taameya", "فول وطعمية"], ["Crepe", "كريب"],
    ["Kebab House", "بيت الكباب"], ["Hawawshi", "حواوشي"],
  ];
  var FAMILY = [
    ["El Sayed", "السيد"], ["Abou Amr", "أبو عمرو"], ["Farahat", "فرحات"], ["Shaker", "شاكر"],
    ["Badr", "بدر"], ["Roushdy", "رشدي"], ["Zaki", "زكي"], ["Mansour", "منصور"],
    ["Gaber", "جابر"], ["Helmy", "حلمي"], ["Fahmy", "فهمي"], ["Lotfy", "لطفي"],
    ["Ragab", "رجب"], ["Sobhy", "صبحي"], ["Nabil", "نبيل"], ["Wahba", "وهبة"],
    ["Kamel", "كامل"], ["Adly", "عدلي"], ["Shafik", "شفيق"], ["Ezzat", "عزت"],
    ["Hegazy", "حجازي"], ["Sherif", "شريف"], ["Attia", "عطية"], ["Morsy", "مرسي"],
  ];
  var FIRST = [
    ["Ahmed", "أحمد"], ["Mostafa", "مصطفى"], ["Hany", "هاني"], ["Waleed", "وليد"],
    ["Amir", "أمير"], ["Sameh", "سامح"], ["Khaled", "خالد"], ["Tamer", "تامر"],
    ["Rami", "رامي"], ["Ihab", "إيهاب"], ["Magdy", "مجدي"], ["Osama", "أسامة"],
  ];
  var AREA = [
    ["Nasr City 1", "مدينة نصر 1"], ["Nasr City 2", "مدينة نصر 2"], ["Nasr City 3", "مدينة نصر 3"],
    ["Dokki 1", "الدقي 1"], ["Dokki 3", "الدقي 3"], ["Imbaba 1", "إمبابة 1"], ["Imbaba 2", "إمبابة 2"],
    ["Haram 1", "الهرم 1"], ["Haram 2", "الهرم 2"], ["Haram 3", "الهرم 3"],
    ["Maadi 1", "المعادي 1"], ["Maadi 2", "المعادي 2"], ["Maadi 4", "المعادي 4"],
    ["Downtown 1", "وسط البلد 1"], ["Downtown 2", "وسط البلد 2"],
    ["Mohandessin 1", "المهندسين 1"], ["Mohandessin 2", "المهندسين 2"],
    ["Zamalek 1", "الزمالك 1"], ["Zamalek 2", "الزمالك 2"],
    ["Faisal 2", "فيصل 2"], ["Giza 1", "الجيزة 1"], ["Giza 2", "الجيزة 2"],
    ["Alexandria 1", "الإسكندرية 1"], ["Alexandria 2", "الإسكندرية 2"],
  ];
  var TYPE_OF = {
    Koshary: ["Koshary", "كشري", "koshary"], Grill: ["Grill", "مشويات", "grill"],
    Shawarma: ["Shawarma", "شاورما", "shawarma"], Mandi: ["Mandi", "مندي", "mandi"],
    Broasted: ["Fried chicken", "دجاج مقلي", "fried_chicken"], Fish: ["Fish", "أسماك", "fish"],
    Bakery: ["Bakery", "مخبز", "bakery"], "Café": ["Café", "مقهى", "cafe"],
    Pizza: ["Pizza", "بيتزا", "pizza"], Fatatri: ["Pastry", "فطاير", "bakery"],
    "Ful & Taameya": ["Breakfast", "فطار", "breakfast"], Crepe: ["Crepe", "كريب", "crepe"],
    "Kebab House": ["Grill", "مشويات", "grill"], Hawawshi: ["Grill", "مشويات", "grill"],
  };
  var DAY = [
    ["Saturday, weekly", "السبت، أسبوعياً"], ["Sunday, weekly", "الأحد، أسبوعياً"],
    ["Monday, weekly", "الاثنين، أسبوعياً"], ["Tuesday, weekly", "الثلاثاء، أسبوعياً"],
    ["Wednesday, weekly", "الأربعاء، أسبوعياً"], ["Thursday, weekly", "الخميس، أسبوعياً"],
  ];

  // Dates are written the way the screens show them: "14 Sep". Walking back a
  // week at a time has to cross a month boundary properly, so it is done here
  // once rather than guessed per shop.
  var MLEN = { Jan: 31, Feb: 28, Mar: 31, Apr: 30, May: 31, Jun: 30, Jul: 31, Aug: 31, Sep: 30, Oct: 31, Nov: 30, Dec: 31 };
  var MSEQ = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function back(day, month, n) {
    var d = day, mi = MSEQ.indexOf(month);
    while (n > 0) {
      var step = Math.min(n, d - 1);
      d -= step; n -= step;
      if (n > 0) { mi -= 1; d = MLEN[MSEQ[mi]]; n -= 1; }
    }
    return d + " " + MSEQ[mi];
  }

  var used = {};
  SHOPS.forEach(function (s) { used[s.name.en] = 1; });
  var phoneSeq = 0;
  function nextPhone() {
    phoneSeq += 1;
    var a = ["0100", "0111", "0122", "0128", "0155", "0106"][phoneSeq % 6];
    var b = 100 + ((phoneSeq * 37) % 900);
    var c = 1000 + ((phoneSeq * 613) % 9000);
    return a + " " + b + " " + c;
  }

  function madeUp(i, stage) {
    var br = BRAND[(i * 5) % BRAND.length];
    var fa = FAMILY[(i * 7) % FAMILY.length];
    var nameEn = br[0] + " " + fa[0];
    var ar = br[1] + " " + fa[1];
    var n = 2;
    while (used[nameEn]) { nameEn = br[0] + " " + fa[0] + " " + n; ar = br[1] + " " + fa[1] + " " + n; n += 1; }
    used[nameEn] = 1;
    var area = AREA[(i * 11) % AREA.length];
    var first = FIRST[(i * 3) % FIRST.length];
    var ty = TYPE_OF[br[0]];
    return {
      name: { en: nameEn, ar: ar },
      area: { en: area[0], ar: area[1] },
      type: { en: ty[0], ar: ty[1] },
      outletType: ty[2],
      contact: { en: first[0] + " " + fa[0], ar: first[1] + " " + fa[1] },
      phone: nextPhone(),
      stage: stage,
    };
  }

  var AGENT = { en: "H. Fawzy", ar: "ه. فوزي" };
  // The call-center agents. An away agent's outlets go to the shared pool, so
  // nothing waits for him to come back.
  // The call-center agents. Each covers zones (by the start of an area name);
  // a pre-survey someone else adds goes to the agent covering its zone, or to
  // whoever has fewest open pre-surveys. An agent who is away keeps his
  // outlets; HR names a stand-in who manages them until he is back.
  var AGENTS = [
    { en: "H. Fawzy", ar: "ه. فوزي", away: false,
      zones: ["Nasr City", "Downtown", "Dokki", "Maadi", "Faisal", "Zamalek", "Mohandessin", "Haram", "Imbaba"] },
    { en: "R. Adel", ar: "ر. عادل", away: false, zones: ["Alexandria", "Heliopolis", "Shubra"] },
    { en: "S. Nabil", ar: "س. نبيل", away: true, zones: [], standIn: { en: "H. Fawzy", ar: "ه. فوزي" } },
  ];
  var R_ADEL = { en: "R. Adel", ar: "ر. عادل" }, S_NABIL = { en: "S. Nabil", ar: "س. نبيل" };
  var SURVEYORS = [{ en: "M. Fawzy", ar: "م. فوزي" }, { en: "A. Sameh", ar: "أ. سامح" }];
  // Which surveyor covers which zones (by the start of the area name).
  var SURVEYOR_ZONES = { "M. Fawzy": ["Nasr City", "Downtown", "Dokki", "Maadi", "Zamalek", "Heliopolis", "Shubra"],
    "A. Sameh": ["Alexandria", "Faisal", "Mohandessin", "Haram", "Imbaba"] };
  var OILS = ["corn", "soya", "palm_olein", "palm_shortening", "blend"];
  var seqOf = { supplier: 100, undelivered: 200, lead: 900, survey: 400, pre_survey: 500 };
  function nextId(stage) { seqOf[stage] += 1; return PREFIX[stage === "undelivered" ? "supplier" : stage] + "-" + String(seqOf[stage]).padStart(4, "0"); }

  var GEN = [];
  // Suppliers — the book operations draws its day from.
  for (var i = 0; i < 40; i++) {
    var b = madeUp(i, "supplier");
    var price = (5.85 + (i % 8) * 0.05).toFixed(2);
    var runs = 2 + (i % 5);
    // Most collect weekly; a few every two weeks or monthly, spaced to match.
    var every = i % 10 === 7 ? 14 : i % 10 === 9 ? 28 : 7;
    var lastDay = 19 - (i % 6);
    var cols = [];
    for (var k = 0; k < runs; k++) {
      cols.push({ when: back(lastDay, "Sep", k * every), kg: 120 + ((i * 37 + k * 53) % 340), price: price,
        truck: "t" + (((i + k) % 6) + 1) });
    }
    var dead = i % 13 === 5;
    b.data = "confirmed";
    if (i % 11 === 4) b.tries = 2 + (i % 3);
    b.activity = dead ? "inactive" : "active";
    if (dead) { b.inactiveSince = back(lastDay, "Sep", runs * 7); b.inactiveReason = "competitor"; }
    b.price = "agreed";
    b.agent = i % 5 === 3 ? R_ADEL : i % 9 === 8 ? S_NABIL : AGENT;
    b.surveyor = SURVEYORS[i % 2];
    b.surveyedOn = back(1, "Sep", 60 + (i % 90)) + " 10:00";
    b.gps = "±" + (5 + (i % 8)) + " m";
    b.complete = 90 + (i % 10);
    b.verifiedOn = back(1, "Sep", 58 + (i % 90));
    b.agreedPrice = price;
    b.agreedOn = back(1, "Sep", 55 + (i % 90));
    var dEn = DAY[i % 6][0].split(",")[0], dAr = DAY[i % 6][1].split("،")[0];
    b.collectionDay = every === 14 ? { en: dEn + ", every two weeks", ar: dAr + "، كل أسبوعين" }
      : every === 28 ? { en: dEn + ", monthly", ar: dAr + "، شهرياً" }
      : { en: DAY[i % 6][0], ar: DAY[i % 6][1] };
    b.rep = b.contact;
    b.repPhone = b.phone;
    b.volume = 120 + ((i * 41) % 300);
    b.collections = cols;
    // Booked calls: the shop named a day and time. Some are due today, one is
    // overdue from yesterday, two are later in the week and must not show yet.
    var BOOK = { 2: "21 Sep 11:00", 11: "21 Sep 15:30", 20: "20 Sep 12:00", 29: "23 Sep 10:00", 38: "22 Sep 13:00",
                 7: "21 Sep 13:00", 16: "24 Sep 11:00" };
    if (BOOK[i]) b.callBack = BOOK[i];
    // "Not ready" answers in a row on collection calls. Two marks them at risk.
    if (i === 7) b.notReady = 2;
    if (i === 16) b.notReady = 1;
    // The call that made the booking always comes before the booked time.
    if (BOOK[i]) b.lastCall = { when: (BOOK[i].indexOf("20 Sep") === 0 ? "19 Sep " : "20 Sep ") + (10 + (i % 6)) + ":20", by: AGENT,
      result: b.notReady ? { en: "Not ready yet — gave a date", ar: "غير جاهزين — حددوا موعداً" }
                         : { en: "Asked to be called back", ar: "طلبوا معاودة الاتصال" } };
    else if (i % 5 === 1) b.lastCall = { when: "18 Sep 12:40", by: AGENT,
      result: { en: "Order placed", ar: "صدر طلب" } };
    b.id = nextId("supplier");
    GEN.push(b);
  }
  // Pre-suppliers — agreed, nothing collected.
  for (i = 0; i < 6; i++) {
    b = madeUp(100 + i, "supplier");
    b.data = "confirmed";
    b.activity = i === 5 ? "non_committed" : i % 2 ? "first_order_out" : "new";
    if (b.activity === "non_committed") b.failedReason = "no_oil";
    if (b.activity === "first_order_out") b.firstOrderOn = back(19, "Sep", i);
    b.price = "agreed";
    b.agent = AGENT;
    b.surveyor = SURVEYORS[i % 2];
    b.surveyedOn = back(1, "Sep", 20 + i) + " 11:30";
    b.gps = "±7 m"; b.complete = 95;
    b.verifiedOn = back(1, "Sep", 17 + i);
    b.agreedPrice = (5.95 + (i % 5) * 0.05).toFixed(2);
    b.agreedOn = back(1, "Sep", 14 + i);
    b.collectionDay = every === 14 ? { en: DAY[i % 6][0] + ", every two weeks", ar: DAY[i % 6][1] + "، كل أسبوعين" }
      : every === 28 ? { en: DAY[i % 6][0] + ", monthly", ar: DAY[i % 6][1] + "، شهرياً" }
      : { en: DAY[i % 6][0] + ", weekly", ar: DAY[i % 6][1] + "، أسبوعياً" };
    b.rep = b.contact; b.repPhone = b.phone;
    b.volume = 100 + i * 30;
    b.id = nextId("undelivered");
    GEN.push(b);
  }
  // Leads — a price on the table, nothing collected.
  for (i = 0; i < 10; i++) {
    b = madeUp(200 + i, "lead");
    b.data = "confirmed";
    if (i === 7) b.tries = 3;
    b.activity = "not_started";
    b.price = "in_negotiation";
    b.agent = AGENT;
    b.volume = 120 + i * 25;
    b.askedPrice = (6.0 + (i % 6) * 0.05).toFixed(2);
    if (i % 3 === 0) {
      // Surveyed by phone: no surveyor, no coordinates, a location job out.
      b.phoneSurveyOn = back(19, "Sep", i * 2);
      b.locationDue = back(22, "Sep", i * 2);
      b.locationWith = SURVEYORS[i % 2];
      b.survey = { by: "phone", city: { en: "Cairo", ar: "القاهرة" },
        address: { en: "On the main street", ar: "على الشارع الرئيسي" },
        outletType: b.outletType, oilType: OILS[i % 5], sellingTo: "not_selling", willingness: "yes" };
    } else {
      b.surveyor = SURVEYORS[i % 2];
      b.surveyedOn = back(18, "Sep", 4 + i) + " 09:40";
      b.gps = "±8 m"; b.complete = 92;
      b.verifiedOn = back(18, "Sep", 2 + i);
    }
    b.id = nextId("lead");
    delete b.outletType;
    GEN.push(b);
  }
  // Surveys waiting on a verifying call.
  for (i = 0; i < 6; i++) {
    b = madeUp(300 + i, "survey");
    b.data = "unconfirmed"; b.activity = "not_started"; b.price = "not_discussed";
    b.surveyor = SURVEYORS[i % 2];
    // Spread over the last six days, today included — a surveyor works today.
    b.surveyedOn = back(21, "Sep", i) + " 14:10";
    b.gps = "±" + (6 + i) + " m";
    b.complete = 88 + i;
    b.askedAtDoor = (5.9 + (i % 5) * 0.05).toFixed(2);
    b.volume = 140 + i * 30;
    b.survey = { by: "surveyor", city: { en: "Cairo", ar: "القاهرة" },
      coords: "30.0" + (400 + i * 7) + ", 31.2" + (300 + i * 11),
      address: { en: "Building " + (4 + i) + ", on the corner", ar: "عمارة " + (4 + i) + "، على الناصية" },
      outletType: b.outletType, oilType: OILS[i % 5],
      sellingTo: i % 3 === 0 ? "undecided" : "not_selling", willingness: "yes" };
    b.id = nextId("survey");
    delete b.outletType;
    GEN.push(b);
  }
  // Pre-surveys — a name, an area, a way to reach them.
  for (i = 0; i < 8; i++) {
    b = madeUp(400 + i, "pre_survey");
    b.data = "unconfirmed";
    if (i === 3) b.tries = 2;
    b.activity = "not_started"; b.price = "not_discussed";
    b.addedBy = i % 2 ? { en: "H. Fawzy, agent", ar: "ه. فوزي، موظف" }
                      : { en: "N. Halim, Senior Manager", ar: "ن. حليم، المدير العام" };
    b.addedOn = back(19, "Sep", i);
    b.id = nextId("pre_survey");
    delete b.outletType;
    GEN.push(b);
  }
  GEN.forEach(function (g) { delete g.outletType; SHOPS.push(g); });
  // Work nobody owns yet is assigned on arrival: by zone, then by fewest open.
  function autoAgent(s) {
    var area = (s.area && s.area.en) || "";
    var byZone = AGENTS.filter(function (a) { return !a.away && a.zones.some(function (z) { return area.indexOf(z) === 0; }); })[0];
    if (byZone) return { en: byZone.en, ar: byZone.ar };
    var load = AGENTS.filter(function (a) { return !a.away; }).map(function (a) {
      return { a: a, n: SHOPS.filter(function (x) { return x.agent && x.agent.en === a.en && (x.stage === "pre_survey" || x.stage === "survey"); }).length };
    }).sort(function (x, y) { return x.n - y.n; })[0].a;
    return { en: load.en, ar: load.ar };
  }
  SHOPS.forEach(function (s) { if (!s.agent) { s.agent = autoAgent(s); s.assigned = "auto"; } });
  // Test data: some pre-surveys the agent sent straight to a surveyor, so the
  // surveyor's screen has work. One is a day late.
  (function () {
    var pre = SHOPS.filter(function (s) { return s.stage === "pre_survey"; });
    [["M. Fawzy", "م. فوزي", "23 Sep"], ["M. Fawzy", "م. فوزي", "20 Sep"], ["M. Fawzy", "م. فوزي", "24 Sep"], ["A. Sameh", "أ. سامح", "23 Sep"]]
      .forEach(function (w, i) {
        var s = pre[i * 3 + 1];
        if (!s) return;
        s.surveyWith = { en: w[0], ar: w[1] };
        s.surveyDue = w[2];
        if (!s.addedBy) s.addedBy = { en: "H. Fawzy, agent", ar: "ه. فوزي، موظف" };
      });
  })();
  // How a supplier is paid: cash at the door, or on account (invoiced, paid
  // later). Sample: about one in four suppliers is on account.
  var payN = 0;
  SHOPS.forEach(function (s) { if (s.stage === "supplier" && !s.payment) { s.payment = payN % 4 === 2 ? "postpaid" : "cash"; payN++; } });
  var UNDELIVERED = ["new", "first_order_out", "non_committed"];

  // ---- the fleet ----------------------------------------------------------
  var TRUCKS = [
    { id: "t1", plate: "CAI-4471", capacity: 1200, team: "team1", driver: { en: "Tarek Hosny", ar: "طارق حسني" } },
    { id: "t2", plate: "CAI-4482", capacity: 1200, team: "team1", driver: { en: "Mahmoud Eid", ar: "محمود عيد" } },
    { id: "t3", plate: "GIZ-1130", capacity: 1200, team: "team2", driver: { en: "Kareem Nabil", ar: "كريم نبيل" } },
    { id: "t4", plate: "GIZ-1148", capacity: 1200, team: "team3", driver: { en: "Hossam Ragab", ar: "حسام رجب" } },
    { id: "t5", plate: "CAI-2207", capacity: 1200, team: "team1", driver: { en: "Yasser Lotfy", ar: "ياسر لطفي" } },
    { id: "t6", plate: "CAI-4490", capacity: 1200, team: "team2", driver: { en: "Emad Shaker", ar: "عماد شاكر" } },
  ];
  // The operations teams, as HR has them (hr.dc.html TEAMS): who runs each,
  // and the zones whose orders it takes. A truck belongs to one team; an order
  // belongs to its truck's team, or, before it is on a truck, to its shop's zone.
  var TEAMS = [
    { id: "team1", name: { en: "Team 1", ar: "الفريق 1" }, manager: { en: "Mahmoud Selim", ar: "محمود سليم" },
      zones: ["Nasr City", "Heliopolis", "Downtown", "Shubra", "Zamalek", "Maadi"] },
    { id: "team2", name: { en: "Team 2", ar: "الفريق 2" }, manager: { en: "Mostafa Farouk", ar: "مصطفى فاروق" },
      zones: ["Dokki", "Mohandessin", "Faisal", "Haram", "Imbaba"] },
    { id: "team3", name: { en: "Team 3", ar: "الفريق 3" }, manager: { en: "Adel Rashad", ar: "عادل رشاد" },
      zones: ["Alexandria"] },
  ];

  // Every collection was made by a truck. The authored shops predate the
  // fleet, so they are stamped here rather than left for a screen to guess.
  var stamp = 0;
  SHOPS.forEach(function (s) {
    (s.collections || []).forEach(function (c) {
      if (!c.truck) { c.truck = "t" + ((stamp % 6) + 1); stamp += 1; }
    });
  });

  // ---- dates are display values, so they are pairs like the rest -----------
  var MONTH = {
    Jan: "يناير", Feb: "فبراير", Mar: "مارس", Apr: "أبريل", May: "مايو", Jun: "يونيو",
    Jul: "يوليو", Aug: "أغسطس", Sep: "سبتمبر", Oct: "أكتوبر", Nov: "نوفمبر", Dec: "ديسمبر",
    today: "اليوم", tomorrow: "غداً", yesterday: "أمس", morning: "صباحاً", afternoon: "بعد الظهر",
    Monday: "الاثنين", Tuesday: "الثلاثاء", Wednesday: "الأربعاء", Thursday: "الخميس",
    Friday: "الجمعة", Saturday: "السبت", Sunday: "الأحد",
  };
  // ---- the calendar: today is the real today ------------------------------
  // The sample data was written around Sunday 21 Sep 2025. While this file
  // loads, every sample date is moved forward by the gap to the real today, so
  // the sample always reads as recent. After loading, dates are taken as given.
  var LOADING = true;
  var MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function realToday() { var t = new Date(); t.setHours(0, 0, 0, 0); return t; }
  function sampleOffset() { return Math.round((realToday() - new Date(2025, 8, 21)) / 86400000); }
  function dm(dt) { return dt.getDate() + " " + MON3[dt.getMonth()]; }
  function shiftSample(str) {
    var off = sampleOffset();
    return String(str).replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, function (m, dd, mon) {
      var t = new Date(2025, MON3.indexOf(mon), parseInt(dd, 10));
      t.setDate(t.getDate() + off);
      return dm(t);
    });
  }
  // "12 Mar" → the Date of that day in whichever year puts it nearest to today.
  function parseNear(v) {
    var m = String((v && v.en) || v || "").match(/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
    if (!m) return null;
    var t0 = realToday(), best = null;
    [t0.getFullYear() - 1, t0.getFullYear(), t0.getFullYear() + 1].forEach(function (y) {
      var c = new Date(y, MON3.indexOf(m[2]), parseInt(m[1], 10));
      // A date more than two months ahead is last year's, not next year's.
      if (c - t0 > 62 * 86400000) return;
      if (!best || Math.abs(c - t0) < Math.abs(best - t0)) best = c;
    });
    return best;
  }
  function dayIn(n) { var t = realToday(); t.setDate(t.getDate() + n); return t; }
  function asDate(v) {
    if (!v || typeof v !== "string") return v;
    if (LOADING !== false) v = shiftSample(v);
    var ar = v;
    Object.keys(MONTH).forEach(function (m) { ar = ar.split(m).join(MONTH[m]); });
    return { en: v, ar: ar };
  }
  var DATE_FIELDS = ["addedOn", "surveyedOn", "verifiedOn", "agreedOn", "askedOn",
                     "counterOn", "refusedOn", "firstOrderOn", "inactiveSince", "callBack",
                     "phoneSurveyOn", "locationDue", "surveyDue"];
  SHOPS.forEach(function (s) {
    DATE_FIELDS.forEach(function (f) { if (s[f]) s[f] = asDate(s[f]); });
    if (s.lastCall && typeof s.lastCall.when === "string") s.lastCall.when = asDate(s.lastCall.when);
    (s.collections || []).forEach(function (c) { c.when = asDate(c.when); });
    (s.rounds || []).forEach(function (r) { r.when = asDate(r.when); });
  });

  // id, shop, raised on, due, expected Kg, state, and what became of it.
  //   with_operations  raised, not yet on a truck
  //   on_a_truck       a driver has it for today
  //   collected        the oil came in · carries the weight actually taken
  //   missed           the truck went and came back with nothing
  var ORDERS = [
    { id: "OR-0311", shop: "SP-0092", raised: { en: "18 Sep", ar: "18 سبتمبر" }, due: { en: "22 Sep", ar: "22 سبتمبر" },
      expect: 190, state: "with_operations" },
    { id: "OR-0310", shop: "SP-0059", raised: { en: "18 Sep", ar: "18 سبتمبر" }, due: { en: "23 Sep", ar: "23 سبتمبر" },
      expect: 280, state: "with_operations" },
    { id: "OR-0309", shop: "SP-0088", raised: { en: "17 Sep", ar: "17 سبتمبر" }, due: { en: "21 Sep", ar: "21 سبتمبر" },
      expect: 400, state: "on_a_truck", truck: "t1", seq: 9, driver: { en: "Tarek Hosny", ar: "طارق حسني" }, accepted: true },
    { id: "OR-0308", shop: "SP-0148", raised: { en: "19 Sep", ar: "19 سبتمبر" }, due: { en: "21 Sep", ar: "21 سبتمبر" },
      expect: 120, state: "on_a_truck", truck: "t3", seq: 9, driver: { en: "Kareem Nabil", ar: "كريم نبيل" }, first: true, accepted: false },
    { id: "OR-0307", shop: "SP-0092", raised: { en: "15 Sep", ar: "15 سبتمبر" }, due: { en: "18 Sep", ar: "18 سبتمبر" },
      expect: 180, state: "collected", got: 190 },
    { id: "OR-0306", shop: "SP-0071", raised: { en: "10 Sep", ar: "10 سبتمبر" }, due: { en: "12 Sep", ar: "12 سبتمبر" },
      expect: 300, state: "collected", got: 320 },
    { id: "OR-0305", shop: "SP-0064", raised: { en: "12 Sep", ar: "12 سبتمبر" }, due: { en: "14 Sep", ar: "14 سبتمبر" },
      expect: 260, state: "collected", got: 240 },
    { id: "OR-0302", shop: "SP-0149", raised: { en: "15 Sep", ar: "15 سبتمبر" }, due: { en: "17 Sep", ar: "17 سبتمبر" },
      expect: 150, state: "missed", first: true,
      whyMissed: { en: "they said they would give it next week", ar: "قالوا سيعطونه الأسبوع القادم" } },
    { id: "OR-0304", shop: "SP-0149", raised: { en: "3 Sep", ar: "3 سبتمبر" }, due: { en: "5 Sep", ar: "5 سبتمبر" },
      expect: 150, state: "missed", first: true,
      whyMissed: { en: "the shop had sold it to someone else", ar: "المحل كان قد باعه لغيرنا" } },
    { id: "OR-0303", shop: "SP-0041", raised: { en: "19 Aug", ar: "19 أغسطس" }, due: { en: "21 Aug", ar: "21 أغسطس" },
      expect: 200, state: "collected", got: 180 },
  ];

  // The authored orders carry their dates as pairs; move them with the rest.
  ORDERS.forEach(function (o) {
    if (o.raised && o.raised.en) o.raised = asDate(o.raised.en);
    if (o.due && o.due.en) o.due = asDate(o.due.en);
  });

  var ORDER_LABEL = {
    with_operations: { en: "Not Assigned", ar: "غير مُسند" },
    on_a_truck:      { en: "On A Truck",      ar: "على سيارة" },
    collected:       { en: "Collected",       ar: "تم التحصيل" },
    missed:          { en: "Missed",          ar: "لم يُحصَّل" },
    // A stop on today's round that did not go through. It keeps its truck, so
    // Operations can still reconcile it, but it is no longer out collecting.
    returned:        { en: "Came Back",       ar: "عاد من الطريق" },
  };

  // ---- today, across the fleet --------------------------------------------
  //
  // One order per stop. A collected stop carries the weight actually taken and
  // what was paid for it; a stop that went wrong carries why, in the driver's
  // own words. Operations reads this — it does not keep a day of its own.
  var WRONG = [
    { why: "bad_oil", note: { en: "Water separated at the bottom — the driver refused it", ar: "ماء منفصل في القاع — رفضه السائق" } },
    { why: "shut", note: { en: "Shutters down, nobody answered", ar: "المحل مغلق ولم يرد أحد" } },
    { why: "no_oil", note: { en: "Nothing to collect — they had none", ar: "لا شيء للتحصيل — لا يوجد لديهم" } },
    { why: "price", note: { en: "They want more than the manifest rate", ar: "يطلبون أكثر من السعر المعتمد" } },
    { why: "not_accepted", note: { en: "Sent to the truck and not accepted", ar: "أُرسلت للسيارة ولم تُقبل" } },
  ];

  var onRound = SHOPS.filter(function (s) { return s.stage === "supplier" && s.activity === "active"; });
  var orderSeq = 400;
  var stopSeq = 0;
  var wrongCount = 0;
  TRUCKS.forEach(function (tk, ti) {
    var stops = 4 + (ti % 3);
    for (var j = 0; j < stops; j++) {
      var shop = onRound[(ti * 7 + j * 5) % onRound.length];
      if (!shop) continue;
      orderSeq += 1; stopSeq += 1;
      var expect = 100 + ((ti * 53 + j * 31) % 300);
      var o = {
        id: "OR-" + orderSeq, shop: shop.id, truck: tk.id, seq: j + 1,
        raised: asDate("20 Sep"), due: asDate("21 Sep"), expect: expect,
        at: (8 + j) + ":" + (j % 2 ? "40" : "10"),
        driver: tk.driver, state: "on_a_truck",
      };
      // Two trucks are back with everything collected — that is what makes
      // them reconcilable this evening. The rest are still out.
      var homeRun = ti === 3 || ti === 5;
      if (homeRun || j < stops - 2) {
        o.state = "collected";
        o.got = expect + ((stopSeq * 13) % 21) - 10;
        o.paid = Math.round(o.got * parseFloat(shop.agreedPrice));
      } else if (wrongCount < WRONG.length && (j === stops - 2 || (ti === 0 && j === stops - 1))) {
        // One of each way a stop can go wrong, so the day shows all five.
        o.wrong = WRONG[wrongCount].why;
        o.whyWrong = WRONG[wrongCount].note;
        wrongCount += 1;
      }
      // A driver accepts each stop on his phone before he sets off. A stop that
      // was never accepted is not a stop he will make.
      o.accepted = o.wrong === "not_accepted" ? false
        : o.state === "collected" || o.wrong ? true : (stopSeq % 3 !== 0);
      ORDERS.push(o);
    }
  });
  // Raised by the call center, not yet on any truck. The first two are due
  // today, which is what makes them operations' problem this morning.
  for (var oi = 0; oi < 5; oi++) {
    var waiting = onRound[(oi * 11 + 3) % onRound.length];
    orderSeq += 1;
    ORDERS.push({ id: "OR-" + orderSeq, shop: waiting.id, raised: asDate("20 Sep"),
      due: asDate(oi < 2 ? "21 Sep" : "22 Sep"), expect: 120 + oi * 40, state: "with_operations" });
  }

  // A collected stop IS a collection. Without this the day and the month are
  // two different sets of facts: the Today tab counts today's weight and the
  // Month tab cannot see it. Only today's are appended — the older collected
  // orders are already written on their shops.
  ORDERS.forEach(function (o) {
    if (o.state !== "collected" || !o.due || o.due.en !== dm(realToday())) return;
    var s = SHOPS.filter(function (x) { return x.id === o.shop; })[0];
    if (!s) return;
    s.collections = (s.collections || []);
    s.collections.unshift({ when: o.due, kg: o.got, price: s.agreedPrice, truck: o.truck });
  });


  // ---- the check that makes this file worth having -------------------------
  function has(s, field) {
    if (field === "reach") return !!(s.phone || (s.contact && s.contactPhone));
    if (field === "name") return !!(s.name && s.name.en);
    if (field === "area") return !!(s.area && s.area.en);
    if (field === "becameLead") return !!(s.verifiedOn || s.phoneSurveyOn);
    return !!s[field];
  }

  function inList(list, key) {
    if (!key) return true;
    return FORM[list].filter(function (o) { return o.k === key; }).length > 0;
  }

  var problems = [];
  SHOPS.forEach(function (s) {
    var law = LAW[s.stage];
    if (!law) { problems.push(s.id + ": unknown stage " + s.stage); return; }
    if (s.id.slice(0, 2) !== PREFIX[s.stage])
      problems.push(s.id + ": a " + s.stage + " should carry " + PREFIX[s.stage] + "-");
    if (law.activity.indexOf(s.activity) < 0)
      problems.push(s.id + ": a " + s.stage + " cannot be " + s.activity);
    if (law.price.indexOf(s.price) < 0)
      problems.push(s.id + ": a " + s.stage + " cannot be " + s.price);
    var n = (s.collections || []).length;
    if (law.collections === 0 && n > 0)
      problems.push(s.id + ": a " + s.stage + " cannot have collections");
    if (s.stage === "supplier" && UNDELIVERED.indexOf(s.activity) > -1 && n > 0)
      problems.push(s.id + ": a supplier that has not delivered cannot have collections");
    if (s.stage === "supplier" && UNDELIVERED.indexOf(s.activity) < 0 && n < 1)
      problems.push(s.id + ": an active or inactive supplier must have collected at least once");
    law.needs.forEach(function (f) {
      if (!has(s, f)) problems.push(s.id + ": a " + s.stage + " needs " + f);
    });
    law.never.forEach(function (f) {
      if (s[f]) problems.push(s.id + ": a " + s.stage + " cannot carry " + f);
    });
    DATE_FIELDS.forEach(function (f) {
      var v = s[f];
      if (v && v.ar && /[A-Za-z]/.test(v.ar))
        problems.push(s.id + ": " + f + " still reads English in Arabic — \"" + v.ar + "\"");
    });
    (s.collections || []).concat(s.rounds || []).forEach(function (c) {
      if (c.when && c.when.ar && /[A-Za-z]/.test(c.when.ar))
        problems.push(s.id + ": a date still reads English in Arabic — \"" + c.when.ar + "\"");
    });
    // A submitted survey has answers on it. Without them there is nothing for
    // the agent to read back, and a verification call cannot happen.
    if (s.stage === "survey" && !s.survey)
      problems.push(s.id + ": a submitted survey with no answers on it");
    if (s.survey) {
      var sv = s.survey;
      if (sv.by !== "surveyor" && sv.by !== "phone")
        problems.push(s.id + ": a survey must say how it was done");
      ["city", "address", "outletType"].forEach(function (fl) {
        if (!sv[fl]) problems.push(s.id + ": the survey has no " + fl);
      });
      if (!inList("outletTypes", sv.outletType))
        problems.push(s.id + ": outlet type " + sv.outletType + " is not one the form offers");
      if (!inList("oilTypes", sv.oilType))
        problems.push(s.id + ": oil type " + sv.oilType + " is not one the form offers");
      if (!inList("sellingTo", sv.sellingTo))
        problems.push(s.id + ": selling status " + sv.sellingTo + " is not one the form offers");
      if (!inList("willingness", sv.willingness))
        problems.push(s.id + ": willingness " + sv.willingness + " is not one the form offers");
      if (!inList("competitors", sv.competitor))
        problems.push(s.id + ": competitor " + sv.competitor + " is not one the form offers");
      if (sv.competitor && sv.sellingTo !== "competitor")
        problems.push(s.id + ": a competitor named on a shop that is not selling to one");
      if (sv.by === "surveyor" && !sv.coords)
        problems.push(s.id + ": a surveyor went but brought back no coordinates");
      if (sv.by === "phone") {
        if (sv.coords) problems.push(s.id + ": a phone survey cannot carry coordinates");
        if (s.gps || s.surveyor)
          problems.push(s.id + ": a phone survey cannot name a surveyor or a GPS accuracy");
        if (!s.phoneSurveyOn) problems.push(s.id + ": a phone survey with no date on it");
        if (!s.locationDue || !s.locationWith)
          problems.push(s.id + ": an unproved location with nobody and no date against it");
      }
    }
    if (s.phoneSurveyOn && s.verifiedOn)
      problems.push(s.id + ": a phone survey has no verification call, so it cannot be verified");

    if (s.activity === "inactive" && !s.inactiveReason)
      problems.push(s.id + ": inactive without a reason is a shop nobody can act on");
    if (s.activity === "non_committed" && !s.failedReason)
      problems.push(s.id + ": non-committed without a reason");
    if (s.price === "agreed" && !s.agreedPrice && s.stage !== "lead")
      problems.push(s.id + ": agreed with no price");
  });

  ORDERS.forEach(function (o) {
    var s = SHOPS.filter(function (x) { return x.id === o.shop; })[0];
    if (!s) { problems.push(o.id + ": no such shop " + o.shop); return; }
    if (!s.agreedPrice)
      problems.push(o.id + ": an order needs an agreed price, and " + o.shop + " has none");
    if (o.state === "collected" && !o.got)
      problems.push(o.id + ": collected without a weight");
    if (o.state === "missed" && !o.whyMissed)
      problems.push(o.id + ": missed without a reason");
    if (o.state !== "collected" && o.got)
      problems.push(o.id + ": carries a weight but is not collected");
    // A stop on a truck names the truck. Without it the screen can say both
    // "on a truck" and "given to nobody" about the same order.
    if (o.state === "collected" && o.accepted === false)
      problems.push(o.id + ": collected, but the driver never accepted it");
    if (o.state === "on_a_truck" && !o.truck)
      problems.push(o.id + ": on a truck, but no truck is named");
    if (o.truck && !TRUCKS.filter(function (t) { return t.id === o.truck; }).length)
      problems.push(o.id + ": names a truck that does not exist — " + o.truck);
  });

  SHOPS.forEach(function (s) {
    (s.collections || []).forEach(function (c) {
      if (!c.truck || !TRUCKS.filter(function (t) { return t.id === c.truck; }).length)
        problems.push(s.id + ": a collection with no truck behind it");
    });
  });

  if (problems.length) {
    console.error("[data] " + problems.length + " incoherent shop(s):\n  " + problems.join("\n  "));
  }

  // The day this prototype is set on. One definition, so a date is late on
  // every screen or on none.
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TODAY = { day: realToday().getDate(), month: realToday().getMonth() };
  var EPOCH = new Date(1970, 0, 1);
  // A date as a day count, so "late" and "in 3 days" work across months and years.
  function dayNumber(v) {
    var t = parseNear(v);
    return t ? Math.round((t - EPOCH) / 86400000) : null;
  }

  // ---- today's calls, by the one agent this prototype signs in as ------------
  // Drawn from the shops themselves so a logged call cannot point at a shop
  // that does not exist, or say something its stage makes impossible.
  var CALL_TARGET = 40;
  var CALL_OUTCOME = {
    no_answer:  { en: "No answer", ar: "لم يرد" },
    call_back:  { en: "Asked to be called back", ar: "طلبوا معاودة الاتصال" },
    price_talk: { en: "Talked price", ar: "تحدثنا في السعر" },
    verified:   { en: "Survey confirmed", ar: "تم تأكيد المسح" },
    checked_in: { en: "Checked in, all well", ar: "اطمأننا، كل شيء بخير" },
    ordered:    { en: "Placed a collection order", ar: "صدر طلب تحصيل" },
    surveying:  { en: "Answered — surveying by phone", ar: "ردّوا — مسح بالهاتف" },
    phone_survey: { en: "Phone survey finished — a Lead", ar: "انتهى المسح بالهاتف — عميل محتمل" },
    pre_saved:  { en: "Answered — sent to a surveyor", ar: "ردّوا — أُرسل إلى مساح" },
    agreed:     { en: "Price agreed — a Supplier", ar: "اتُّفق على السعر — مورد" },
  };
  var CALLS = [];
  (function () {
    var pool = SHOPS.filter(function (s) { return s.stage !== "pre_survey" && s.agent && s.agent.en === AGENT.en; });
    var times = ["08:35", "08:50", "09:10", "09:25", "09:40", "10:05", "10:20", "10:45", "11:10", "11:30", "11:55", "12:20"];
    for (var ci = 0; ci < times.length && ci < pool.length; ci++) {
      var s = pool[(ci * 7) % pool.length];
      var k = s.tries > 0 ? "no_answer"
        : s.callBack ? "call_back"
        : s.stage === "survey" ? "verified"
        : s.stage === "lead" ? "price_talk"
        : s.stage === "supplier" && s.activity === "active" ? (ci % 3 === 0 ? "ordered" : "checked_in")
        : "price_talk";
      CALLS.push({ shop: s.id, at: times[ci], outcome: k });
    }
  })();
  CALLS.forEach(function (c) {
    if (!SHOPS.filter(function (x) { return x.id === c.shop; })[0]) problems.push("call " + c.at + ": no such shop " + c.shop);
    if (!CALL_OUTCOME[c.outcome]) problems.push("call " + c.at + ": unknown outcome " + c.outcome);
  });

  // ---- what this session has recorded -----------------------------------
  // Every screen reloads this file, so anything logged on one screen would be
  // lost on the next. The journal keeps each change for the browser session and
  // replays it here, so the agent screen, the survey and the negotiation tool
  // all see the same outlets. Closing the tab clears it — there is no back end.
  var JKEY = "zeitco-journal-v3";
  function jload() { try { return JSON.parse(root.sessionStorage.getItem(JKEY) || "[]"); } catch (e) { return []; } }
  function jsave(list) { try { root.sessionStorage.setItem(JKEY, JSON.stringify(list)); } catch (e) {} }
  function jfind(id) { return SHOPS.filter(function (s) { return s.id === id; })[0] || null; }
  function japply(e) {
    if (e.op === "shop") { if (!jfind(e.shop.id)) SHOPS.push(e.shop); }
    else if (e.op === "patch") {
      var s = jfind(e.shop);
      if (s) Object.keys(e.fields).forEach(function (k) { if (e.fields[k] === null) delete s[k]; else s[k] = e.fields[k]; });
    }
    else if (e.op === "call") {
      // One conversation, one record. A survey that runs on into price and an
      // order is still the call that started it: the record keeps its start
      // time, takes the latest result, and lists the steps it went through.
      var last = CALLS[CALLS.length - 1];
      var mins = function (t) { var m = String(t || "").match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : -1; };
      var goesOn = { surveying: 1, phone_survey: 1, verified: 1, price_talk: 1, agreed: 1, pre_saved: 1 };
      if (last && e.call.live !== false && last.shop === e.call.shop && goesOn[last.outcome] && last.session
          && mins(e.call.at) - mins(last.at) >= 0 && mins(e.call.at) - mins(last.at) <= 90) {
        last.steps = (last.steps || [last.outcome]).concat(e.call.outcome);
        last.outcome = e.call.outcome;
      } else CALLS.push(Object.assign({ session: true }, e.call));
    }
    else if (e.op === "order") { if (!ORDERS.filter(function (o) { return o.id === e.order.id; }).length) ORDERS.push(e.order); }
    else if (e.op === "orderPatch") {
      var od = ORDERS.filter(function (o) { return o.id === e.order; })[0];
      if (od) Object.keys(e.fields).forEach(function (k) { od[k] = e.fields[k]; });
    }
  }
  jload().forEach(japply);

  // Settings management controls. Kept for the browser session like the journal.
  var SKEY = "zeitco-settings", DEFAULTS = { ceiling: 6.20, chase1: 2, chase2: 7, chase3: 30 };
  function sload() { try { return JSON.parse(root.sessionStorage.getItem(SKEY) || "{}"); } catch (e) { return {}; } }

  LOADING = false;
  root.ZEITCO = {
    setting: function (k) { var v = sload()[k]; return v === undefined ? DEFAULTS[k] : v; },
    setSetting: function (k, v) { var o = sload(); o[k] = v; try { root.sessionStorage.setItem(SKEY, JSON.stringify(o)); } catch (e) {} },
    // The agent's price ceiling, EGP a Kg. Management sets it; screens only read it.
    ceiling: function () { return parseFloat(this.setting("ceiling")) || DEFAULTS.ceiling; },
    journal: {
      add: function (e) { var l = jload(); l.push(e); jsave(l); japply(e); if (root.ZEITCO) root.ZEITCO._hist = {}; },
      size: function () { return jload().length; },
    },
    calls: CALLS,
    callOutcome: CALL_OUTCOME,
    callTarget: CALL_TARGET,
    shops: SHOPS,
    stages: STAGES,
    label: LABEL,
    form: FORM,
    // The label for a stored answer key. Answers are keys; this is the only
    // place a key turns into words, so a screen cannot invent its own.
    // The survey answers as label/value rows, the same for either record. A
    // phone survey and a surveyor's visit fill the same block; only "by" differs.
    surveyRows: function (s, ar) {
      var sv = s && s.survey;
      if (!sv) return [];
      var t = function (v) { return v == null ? "" : typeof v === "string" ? v : (ar ? v.ar : v.en) || ""; };
      var lab = function (list, k) { var h = (FORM[list] || []).filter(function (o) { return o.k === k; })[0]; return h ? (ar ? h.ar : h.en) : ""; };
      var how = sv.by === "phone"
        ? (ar ? "بالهاتف" : "By phone") + (sv.phoneBy ? " · " + t(sv.phoneBy) : "") + (sv.phoneOn ? " · " + t(sv.phoneOn) : (s.phoneSurveyOn ? " · " + t(s.phoneSurveyOn) : ""))
        : (ar ? "زيارة مساح" : "Surveyor visit") + (s.surveyor ? " · " + t(s.surveyor) : "") + (s.surveyedOn ? " · " + t(s.surveyedOn) : "");
      var rows = [
        [ar ? "كيف تم المسح" : "How it was surveyed", how],
        [ar ? "المدينة" : "City", t(sv.city)],
        [ar ? "الشارع" : "Street", t(sv.street)],
        [ar ? "العنوان" : "Address", t(sv.address)],
        [ar ? "هاتف المحل" : "Outlet phone", t(sv.outletPhone)],
        [ar ? "نوع المحل" : "Outlet type", lab("outletTypes", sv.outletType)],
        [ar ? "نوع الزيت" : "Oil type", lab("oilTypes", sv.oilType)],
        [ar ? "الكمية شهرياً" : "Oil a month", s.volume ? s.volume + (ar ? " كجم" : " kg") : ""],
        [ar ? "لمن يبيع" : "Selling to", lab("sellingTo", sv.sellingTo) + (sv.competitor ? " · " + (lab("competitors", sv.competitor) || sv.competitor) : "")],
        [ar ? "مدة العقد" : "Contract", t(sv.contractLength) + (sv.contractEnds ? (ar ? " · ينتهي " : " · ends ") + t(sv.contractEnds) : "")],
        [ar ? "مستعد للبيع لنا" : "Willing to sell to us", lab("willingness", sv.willingness)],
        [ar ? "مندوب التحصيل" : "Collection rep", t(sv.rep) + (sv.repPhone ? " · " + sv.repPhone : "")],
        sv.coords ? [ar ? "الإحداثيات" : "Coordinates", sv.coords] : null,
      ];
      return rows.filter(function (r) { return r && r[1]; }).map(function (r) { return { label: r[0], value: r[1] }; });
    },
    formLabel: function (list, key) {
      var hit = (FORM[list] || []).filter(function (o) { return o.k === key; })[0];
      return hit || null;
    },
    prefix: PREFIX,
    law: LAW,
    problems: problems,
    orders: ORDERS,
    orderLabel: ORDER_LABEL,
    trucks: TRUCKS,
    teams: TEAMS,
    teamOf: function (manager) { return TEAMS.filter(function (t) { return t.manager.en === manager || t.id === manager; })[0] || null; },
    teamOfShop: function (s) {
      var area = (s && s.area && s.area.en) || "";
      var t = TEAMS.filter(function (x) { return x.zones.some(function (z) { return area.indexOf(z) === 0; }); })[0];
      return t ? t.id : "team1";
    },
    teamOfOrder: function (o) {
      var tk = o && o.truck && TRUCKS.filter(function (t) { return t.id === o.truck; })[0];
      return tk ? tk.team : this.teamOfShop(this.byId(o.shop));
    },
    truck: function (id) { return TRUCKS.filter(function (t) { return t.id === id; })[0] || null; },
    ordersToday: function () {
      return ORDERS.filter(function (o) { return o.due && o.due.en === dm(realToday()); });
    },
    // Today's stop at this shop that came back and has no result logged yet.
    // It stays on Came Back From The Road until one is.
    openStop: function (id) {
      return ORDERS.filter(function (o) {
        return o.shop === id && o.due && o.due.en === dm(realToday()) && (o.wrong || o.state === "missed") && !o.resolved;
      })[0] || null;
    },
    ordersOn: function (truckId) {
      return ORDERS.filter(function (o) { return o.truck === truckId; })
        .sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    },
    // What an order is, as anyone outside Operations should read it.
    orderState: function (o) { return o.wrong ? "returned" : o.state; },
    ordersFor: function (id) { return ORDERS.filter(function (o) { return o.shop === id; }); },
    at: function (stage) { return SHOPS.filter(function (s) { return s.stage === stage; }); },
    // How many orders a Pre-Supplier has let fail. Counted from the orders,
    // so it cannot drift from what the trucks actually found.
    failedFirsts: function (s) {
      return ORDERS.filter(function (o) { return o.shop === s.id && (o.wrong || o.state === "missed"); }).length;
    },
    // Who manages this outlet today: its owner, or the stand-in HR named while
    // the owner is away. Only the Senior or Financial Manager changes the owner.
    ownerNow: function (s) {
      var a = s && s.agent && this.staff(s.agent.en);
      if (a && a.away && a.standIn) return a.standIn;
      return (s && s.agent) || null;
    },
    // An agent as HR has him today: away or not, and who stands in. HR's
    // choices are kept for the session and override the sample list.
    staff: function (name) {
      var a = AGENTS.filter(function (x) { return x.en === name; })[0];
      if (!a) return null;
      var hr = (this.setting("staffing") || {})[name];
      if (!hr) return a;
      var sin = hr.standIn ? AGENTS.filter(function (x) { return x.en === hr.standIn; })[0] : null;
      return Object.assign({}, a, { away: !!hr.away, standIn: hr.away && sin ? { en: sin.en, ar: sin.ar } : null });
    },
    setStaff: function (name, away, standIn) {
      var all = Object.assign({}, this.setting("staffing") || {});
      all[name] = { away: !!away, standIn: away ? (standIn || null) : null };
      this.setSetting("staffing", all);
    },
    // The surveyor for a zone, picked by the system.
    autoSurveyor: function (area) {
      var z = String((area && area.en) || area || "");
      var hit = SURVEYORS.filter(function (s) { return (SURVEYOR_ZONES[s.en] || []).some(function (p) { return z.indexOf(p) === 0; }); })[0];
      var s = hit || SURVEYORS[0];
      return { en: s.en, ar: s.ar };
    },
    autoAgent: autoAgent,
    // Every collection this shop has ever given, oldest first: sample history
    // before this month, then the real collections on the record. Each is an
    // executed order. {y, m (0-11), d, kg, price, id}. Made up for testing,
    // but steady per shop so the report reads the same every time.
    history: function (s) {
      if (!s || s.stage !== "supplier" || (s.activity !== "active" && s.activity !== "inactive")) return (s && s.collections || []).map(function (c, i) {
        var m = String((c.when && c.when.en) || c.when || "").match(/^(\d{1,2}) (\w{3})/);
        var od = ORDERS.filter(function (o) { return o.shop === s.id && m && String((o.due && o.due.en) || "").indexOf(m[1] + " " + m[2]) === 0; })[0];
        var pn = parseNear(c.when) || realToday();
        return { y: pn.getFullYear(), m: pn.getMonth(), d: pn.getDate(), kg: c.kg, price: parseFloat(c.price) || 0, exp: od && od.expect ? od.expect : null, id: od ? od.id : "OR-" + s.id.slice(3) + String(i).padStart(3, "0") };
      });
      this._hist = this._hist || {};
      if (this._hist[s.id]) return this._hist[s.id];
      var seed = 0; for (var i = 0; i < s.id.length; i++) seed = (seed * 31 + s.id.charCodeAt(i)) % 9973;
      var rnd = function () { seed = (seed * 48271) % 2147483647; return (seed % 1000) / 1000; };
      var line = String((s.collectionDay && s.collectionDay.en) || "");
      var every = / and /.test(line.split(",")[0]) || /twice/i.test(line) ? 3.5 : /every two weeks/i.test(line) ? 14 : /monthly/i.test(line) ? 28 : 7;
      var months = 9 + (seed % 16);
      var t0 = realToday();
      // Sample history runs up to the start of this month; the real collections follow it.
      var end = new Date(t0.getFullYear(), t0.getMonth(), 1), start = new Date(t0.getFullYear(), t0.getMonth() - months, 1 + (seed % 20));
      if (s.activity === "inactive") end = new Date(t0.getFullYear(), t0.getMonth() - 2, 1);
      var recent = (s.collections || []).map(function (c) { return c.kg; });
      var base = recent.length ? recent.reduce(function (a, b) { return a + b; }, 0) / recent.length : 180 + (seed % 300);
      var top = parseFloat(s.agreedPrice) || 6.0;
      var out = [], t = start.getTime(), n = 0, span = end.getTime() - start.getTime();
      while (t < end.getTime()) {
        var dt = new Date(t), mo = dt.getMonth();
        var season = mo === 8 || mo === 2 || mo === 3 ? 1.15 : mo === 6 || mo === 7 ? 0.85 : 1;
        var kgNow = Math.max(40, Math.round(base * season * (0.8 + rnd() * 0.4) / 5) * 5);
        if (rnd() > 0.08) out.push({ y: dt.getFullYear(), m: mo, d: dt.getDate(),
          kg: kgNow, exp: Math.max(40, Math.round(kgNow * (0.85 + rnd() * 0.35) / 10) * 10),
          price: Math.round((top - 0.45 * (1 - (t - start.getTime()) / span)) * 20) / 20,
          id: "OR-" + s.id.slice(3) + String(n++).padStart(3, "0") });
        t += every * 86400000;
      }
      // Real collections keep the id of the order that brought them in.
      var mine = ORDERS.filter(function (o) { return o.shop === s.id; });
      (s.collections || []).slice().reverse().forEach(function (c, i) {
        var w = String((c.when && c.when.en) || c.when || "");
        var m = w.match(/^(\d{1,2}) (\w{3})/);
        var od = mine.filter(function (o) { var dd = String((o.due && o.due.en) || ""); return m && dd.indexOf(m[1] + " " + m[2]) === 0; })[0];
        var pn = parseNear(w) || realToday();
        out.push({ y: pn.getFullYear(), m: pn.getMonth(), d: pn.getDate(), kg: c.kg, price: parseFloat(c.price) || top,
          exp: od && od.expect ? od.expect : null,
          id: od ? od.id : "OR-" + s.id.slice(3) + String(n++).padStart(3, "0") });
      });
      this._hist[s.id] = out;
      return out;
    },
    // ---- the road: what Operations and the driver write ------------------
    // Every one goes through the journal, so the agent screen sees it at once.
    stopReasons: [
      { k: "shut", en: "Shutters down", ar: "المحل مغلق" },
      { k: "no_answer", en: "Nobody answers", ar: "لا أحد يرد" },
      { k: "no_oil", en: "No oil ready", ar: "لا يوجد زيت جاهز" },
      { k: "wrong_address", en: "Wrong address", ar: "العنوان خطأ" },
      { k: "price", en: "Refused the price", ar: "رفضوا السعر" },
      { k: "bad_oil", en: "Bad oil — refused it", ar: "زيت سيئ — رفضته" },
      { k: "sold", en: "Sold to a competitor", ar: "باعوه لمنافس" },
    ],
    assign: function (orderId, truckId) {
      var o = ORDERS.filter(function (x) { return x.id === orderId; })[0];
      var tk = TRUCKS.filter(function (x) { return x.id === truckId; })[0];
      if (!o || !tk) return;
      var day = o.due && o.due.en;
      var seq = ORDERS.filter(function (x) { return x.truck === truckId && x.due && x.due.en === day && x.id !== orderId; })
        .reduce(function (m, x) { return Math.max(m, x.seq || 0); }, 0) + 1;
      this.journal.add({ op: "orderPatch", order: orderId, fields: { truck: truckId, seq: seq, driver: tk.driver, state: "on_a_truck", accepted: false, acceptedAt: null } });
      var s = jfind(o.shop);
      if (s && s.activity === "new") this.journal.add({ op: "patch", shop: s.id, fields: { activity: "first_order_out" } });
    },
    // A stop the driver has taken on: he pressed Accept today's stops, or it is
    // already done. Stops still out start the day unaccepted.
    isAccepted: function (o) { return !!o.acceptedAt || o.state === "collected" || !!o.wrong || o.state === "missed"; },
    unassign: function (orderId) {
      this.journal.add({ op: "orderPatch", order: orderId, fields: { truck: null, seq: null, driver: null, state: "with_operations", accepted: false } });
    },
    moveStop: function (orderId, dir) {
      var o = ORDERS.filter(function (x) { return x.id === orderId; })[0];
      if (!o || !o.truck) return;
      var day = o.due && o.due.en;
      var run = ORDERS.filter(function (x) { return x.truck === o.truck && x.due && x.due.en === day; }).sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
      var i = run.indexOf(o), j = i + dir;
      if (j < 0 || j >= run.length) return;
      var a = run[i].seq, b = run[j].seq;
      this.journal.add({ op: "orderPatch", order: run[i].id, fields: { seq: b } });
      this.journal.add({ op: "orderPatch", order: run[j].id, fields: { seq: a } });
    },
    acceptStops: function (truckId, day) {
      var self = this;
      ORDERS.filter(function (x) { return x.truck === truckId && x.due && x.due.en === day && !root.ZEITCO.isAccepted(x) && x.state === "on_a_truck" && !x.wrong; })
        .forEach(function (x) { self.journal.add({ op: "orderPatch", order: x.id, fields: { accepted: true, acceptedAt: dm(realToday()) } }); });
    },
    // The driver weighed it and paid for it. The order becomes a collection on
    // the shop, and a shop's first load makes it an active supplier.
    collect: function (orderId, kg, at, opt) {
      var o = ORDERS.filter(function (x) { return x.id === orderId; })[0];
      var s = o && jfind(o.shop);
      if (!o || !s) return;
      var price = opt && opt.price ? opt.price : parseFloat(s.agreedPrice) || 0;
      // Cash paid at the door; a shop on account is paid nothing now and owes it.
      var paid = opt && opt.paid != null ? opt.paid : (s.payment === "postpaid" ? 0 : Math.round(kg * price));
      this.journal.add({ op: "orderPatch", order: orderId, fields: { state: "collected", got: kg, paid: paid, owed: Math.round(kg * price) - paid, doneAt: at } });
      var f = { collections: [{ when: o.due, kg: kg, price: s.agreedPrice, truck: o.truck }].concat(s.collections || []), notReady: 0 };
      if (["new", "first_order_out", "non_committed"].indexOf(s.activity) > -1) { f.activity = "active"; if (!s.firstOrderOn) f.firstOrderOn = o.due; }
      if (s.activity === "inactive") f.activity = "active";
      this.journal.add({ op: "patch", shop: s.id, fields: f });
    },
    // The stop did not go through. It goes to the agent's Came Back From The
    // Road with the driver's reason; a shop that never delivered is non-committed.
    failStop: function (orderId, reason, note, at) {
      var o = ORDERS.filter(function (x) { return x.id === orderId; })[0];
      var s = o && jfind(o.shop);
      var r = this.stopReasons.filter(function (x) { return x.k === reason; })[0];
      if (!o || !r) return;
      var why = { en: r.en + (note ? " — " + note : ""), ar: r.ar + (note ? " — " + note : "") };
      this.journal.add({ op: "orderPatch", order: orderId, fields: { wrong: reason, whyWrong: why, doneAt: at } });
      if (s && ["new", "first_order_out"].indexOf(s.activity) > -1) this.journal.add({ op: "patch", shop: s.id, fields: { activity: "non_committed" } });
    },

    // What a shop actually gives, learned from its executed orders — never
    // typed. Monthly: the average of the last three full months with orders.
    // Per collection: the average of the last five. Null until there is one.
    usual: function (s) {
      var h = this.history(s);
      if (!h.length) return null;
      var last5 = h.slice(-5);
      var per = Math.round(last5.reduce(function (a, c) { return a + c.kg; }, 0) / last5.length);
      var byMonth = {};
      h.forEach(function (c) { var k = c.y * 12 + c.m; byMonth[k] = (byMonth[k] || 0) + c.kg; });
      var now = realToday().getFullYear() * 12 + realToday().getMonth();
      var full = Object.keys(byMonth).map(Number).filter(function (k) { return k < now; }).sort(function (a, b) { return b - a; }).slice(0, 3);
      var month = full.length ? Math.round(full.reduce(function (a, k) { return a + byMonth[k]; }, 0) / full.length) : null;
      return { perCollection: per, perCollectionOf: last5.length, month: month, monthOf: full.length,
        estimate: s.volume || null };
    },
    // A Supplier with a price agreed and no oil delivered yet.
    notDelivered: function (s) {
      if (s) return s.stage === "supplier" && UNDELIVERED.indexOf(s.activity) > -1;
      return SHOPS.filter(function (x) { return x.stage === "supplier" && UNDELIVERED.indexOf(x.activity) > -1; });
    },
    byId: function (id) { return SHOPS.filter(function (s) { return s.id === id; })[0] || null; },
    mine: function (who) {
      return SHOPS.filter(function (s) { return s.agent && s.agent.en === who; });
    },
    kg: function (s) {
      return (s.collections || []).reduce(function (a, c) { return a + c.kg; }, 0);
    },
    // A location nobody has stood at yet. Rule 7: due three days after the
    // phone survey or before the first collection, whichever is sooner.
    // It blocks nothing; it only shows.
    locationUnproved: function (s) { return !!(s.locationDue && !s.verifiedOn && !s.locationConfirmedOn); },
    locationLate: function (s) {
      if (!s.locationDue || s.verifiedOn || s.locationConfirmedOn) return false;
      var due = dayNumber(s.locationDue);
      return due !== null && due < dayNumber(dm(realToday()));
    },
    // Today, and days either side of it. Every screen reads these rather than
    // writing a date of its own.
    today: (function () { var t = dm(realToday()); var a = t; Object.keys(MONTH).forEach(function (m) { a = a.split(m).join(MONTH[m]); }); return { en: t, ar: a }; })(),
    todayDate: realToday,
    dateIn: dayIn,
    dayLabel: function (n) { return dm(dayIn(n || 0)); },
    todayLong: (function () {
      var t = realToday(), W = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      var WA = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      var ML = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return { en: W[t.getDay()] + " " + t.getDate() + " " + ML[t.getMonth()], ar: WA[t.getDay()] + " " + t.getDate() + " " + MONTH[MON3[t.getMonth()]] };
    })(),
    dayNumber: dayNumber,
    asDate: asDate,
    agents: AGENTS,
    agentAway: function (a) {
      var hit = this.staff((a && a.en) || a);
      return !!(hit && hit.away);
    },
    todayNumber: Math.round((realToday() - EPOCH) / 86400000),
    // "21 Sep 16:00" → "16:00". A booked call carries its time as the last word.
    timeOf: function (v) { var b = String((v && v.en) || v || "").trim().split(" "); return b.length > 2 ? b[2] : ""; },
    // The next collection. Reads the day(s) and how often from the shop's line
    // ("Sunday, weekly", "Sunday and Wednesday, twice a week", "Monday, every
    // two weeks", "Tuesday, monthly"), and counts from the last collection, so a
    // fortnightly shop is not rung every week and a shop collected late is not
    // rung again three days later. Monthly means every four weeks on that day.
    // Today is Sunday 21 Sep.
    nextCollection: function (s) {
      if (!s.collectionDay) return null;
      var WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      var line = String(s.collectionDay.en || s.collectionDay);
      var names = line.split(",")[0].split(" and ").map(function (x) { return x.trim(); })
        .filter(function (x) { return WEEK.indexOf(x) > -1; });
      if (!names.length) return null;
      var every = /every two weeks|fortnight/i.test(line) ? 14 : /monthly/i.test(line) ? 28 : 7;
      // Two days a week: at least two days apart. Otherwise the gap may run two
      // days short of the cycle, so a load taken a day or two late still counts.
      var minGap = names.length > 1 ? 2 : every - 2;
      var today = realToday();
      var toDate = parseNear;
      var last = null;
      (s.collections || []).forEach(function (c) { var d = toDate(c.when); if (d && (!last || d > last)) last = d; });
      if (!last && s.firstOrderOn && s.activity !== "non_committed") last = toDate(s.firstOrderOn);
      var DAY = 86400000;
      for (var n = 0; n < 70; n++) {
        var d = new Date(today.getTime() + n * DAY), name = WEEK[d.getDay()];
        if (names.indexOf(name) < 0) continue;
        if (last && Math.round((d - last) / DAY) < minGap) continue;
        var by = WEEK[(d.getDay() + 6) % 7];
        return { inDays: n, day: { en: name, ar: MONTH[name] }, callBy: { en: by, ar: MONTH[by] },
          date: asDate(d.getDate() + " " + MONTHS[d.getMonth()]), every: every,
          last: last ? asDate(last.getDate() + " " + MONTHS[last.getMonth()]) : null };
      }
      return null;
    },
    // An order already raised and not yet done closes the collection call.
    openOrderFor: function (s) {
      return ORDERS.filter(function (o) {
        return o.shop === s.id && !o.wrong && (o.state === "with_operations" || o.state === "on_a_truck");
      })[0] || null;
    },
  };
})(window);
