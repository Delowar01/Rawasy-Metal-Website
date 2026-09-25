/*
 * Lab-only interface text: option names and the labels of the preview chrome and
 * design-system sheets. None of it is website content.
 */

export type LabOption = "a" | "a2" | "b" | "c";

/** Route segment and short label of each option (A V2 refines A; A stays for comparison). */
export const labOptions: { key: LabOption; slug: string; short: string }[] = [
  { key: "a", slug: "modern-commerce-a", short: "A" },
  { key: "a2", slug: "modern-commerce-a-v2", short: "A V2" },
  { key: "b", slug: "modern-commerce-b", short: "B" },
  { key: "c", slug: "modern-commerce-c", short: "C" },
];

export const labCopy = {
  en: {
    lab: "Theme lab",
    preview: "Modern Commerce exploration",
    homepage: "Homepage",
    system: "Design system",
    note: "Light theme preview · noindex · links open the current site",
    darkLater: "Dark theme follows approval",
    optionNames: {
      a: "A · Clean Premium Commerce",
      a2: "A V2 · Clean Premium Commerce, refined",
      b: "B · Bold Industrial Commerce",
      c: "C · Minimal Luxury Commerce",
    },
    sheet: {
      palette: "Colour palette",
      paletteNote: "Orange is the anchor and the primary action; the supporting colours carry surfaces, icons, tags and states. Body text stays neutral.",
      type: "Typography",
      radius: "Radius",
      borders: "Borders",
      shadows: "Shadows",
      buttons: "Buttons",
      cards: "Cards",
      icons: "Icons, tags and badges",
      forms: "Form fields",
      display: "Display",
      heading: "Heading",
      body: "Body",
      label: "Label",
      english: "English",
      arabic: "Arabic",
      name: "Name",
      email: "Email",
      message: "Project details",
      required: "Required",
      helper: "Share drawings, quantities and timing.",
      states: { rest: "Rest", hover: "Hover", focus: "Focus", disabled: "Disabled" },
    },
    sheetA2: {
      cards: "Service, machinery and project cards",
      clients: "Client tiles",
      clientsNote: "Greyscale at rest; original colours on hover, on focus or with the switch. No counts, numbering or claims.",
      contact: "Contact blocks",
      motion: "Motion",
      motionNote:
        "One motion system: content fades and rises as it enters, cards lift 3 px, photos zoom 3.5 %, arrows move 3–4 px. Transform and opacity only. Nothing loops except the hero light, which pauses off screen. With reduced motion every final state shows at once.",
      motionRows: [
        ["Quick", "180 ms", "Colour, borders, press feedback"],
        ["Standard", "320 ms", "Card lift, arrows, menus"],
        ["Reveal", "600 ms", "Section fade-ups, accent edges"],
        ["Entrance", "900 ms", "Hero entrance, photo settle"],
        ["Ease out", "cubic-bezier(0.22, 1, 0.36, 1)", "Everything that moves"],
        ["Ease in-out", "cubic-bezier(0.65, 0, 0.35, 1)", "Signature replays"],
      ],
      motionHead: ["Token", "Value", "Use"],
      cut: "Signature · Laser cutting",
      cutNote:
        "SVG only: a kerf drawn with stroke-dashoffset, a laser head that follows the path at a constant feed rate, a white-hot tip, sparks and a static glow — no canvas, no library. It plays once when half in view (about 2.5 s), replays on hover or focus of its card, and never loops.",
      cutSteps: ["Plate enters", "Laser arms", "Kerf cuts the star", "Sparks and heat", "Part lifts out", "Edge cools"],
      engrave: "Signature · Laser engraving",
      engraveNote:
        "A brass plate engraved in raster passes: the crosshair zig-zags level with a scan line that reveals the medallion — double ring, eight-point star and the RAWASY mark — then light crosses the fresh engraving. RAWASY's own mark only: no third-party brands, part or serial numbers.",
      engraveSteps: ["Plate enters", "Crosshair arms", "Raster passes", "Pattern appears", "Light crosses", "Settles"],
      replay: "Replay",
      reveal: "Loading and reveal",
      revealNote:
        "Content is visible without JavaScript. With it, sections rise 18 px as they enter, staggered by 50–90 ms, and photos open from a smaller frame while they settle. The hero runs its entrance on load, so nothing waits for scrolling.",
      replayReveal: "Replay the reveal",
      mobile: "Mobile components",
      mobileNote:
        "The real homepage at phone width: a full-height menu with large rows and the quote button always in reach, a 2 × 3 service strip, two-column mini cards, swipe rails for the pillars, machines and projects, and laser illustrations that play once.",
      mobileFrame: "Homepage preview at phone width",
      mobileRules: [
        "Tap targets of 44 px and more",
        "Get a Quote in the header and in the menu",
        "Swipe rails, never sideways page scroll",
        "Hover effects are extras: everything works by tap and keyboard",
      ],
      tokens: "Theme tokens",
      tokensNote:
        "Every colour is a semantic token on .lab-a2. The dark theme follows approval: it redefines the same names (surfaces, text, lines, tones, shadows, scrims), so no component changes.",
      tokenHead: ["Token", "Light", "Role"],
    },
  },
  ar: {
    lab: "مختبر التصميم",
    preview: "استكشاف الطابع التجاري الحديث",
    homepage: "الصفحة الرئيسية",
    system: "نظام التصميم",
    note: "معاينة بالوضع الفاتح · غير مفهرسة · الروابط تفتح الموقع الحالي",
    darkLater: "الوضع الداكن بعد الاعتماد",
    optionNames: {
      a: "A · تجاري راقٍ ونظيف",
      a2: "A V2 · تجاري راقٍ ونظيف، بنسخة مطوّرة",
      b: "B · تجاري صناعي جريء",
      c: "C · تجاري فاخر بسيط",
    },
    sheet: {
      palette: "لوحة الألوان",
      paletteNote: "البرتقالي هو اللون الأساسي ولون الإجراء الرئيسي، والألوان المساندة للأسطح والأيقونات والوسوم والحالات. يبقى نص الفقرات محايدًا.",
      type: "الخطوط",
      radius: "استدارة الزوايا",
      borders: "الحدود",
      shadows: "الظلال",
      buttons: "الأزرار",
      cards: "البطاقات",
      icons: "الأيقونات والوسوم والشارات",
      forms: "حقول النماذج",
      display: "عنوان رئيسي",
      heading: "عنوان",
      body: "نص",
      label: "تسمية",
      english: "الإنجليزية",
      arabic: "العربية",
      name: "الاسم",
      email: "البريد الإلكتروني",
      message: "تفاصيل المشروع",
      required: "مطلوب",
      helper: "أرفق المخططات والكميات والموعد المطلوب.",
      states: { rest: "عادي", hover: "تمرير", focus: "تركيز", disabled: "معطّل" },
    },
    sheetA2: {
      cards: "بطاقات الخدمات والمعدات والمشاريع",
      clients: "شعارات العملاء",
      clientsNote: "بالرمادي في الوضع العادي، وبألوانها الأصلية عند التمرير أو التركيز أو عبر المفتاح، دون أعداد أو ترقيم أو ادعاءات.",
      contact: "عناصر التواصل",
      motion: "الحركة",
      motionNote:
        "نظام حركة واحد: يظهر المحتوى بتلاشٍ وصعود خفيف عند دخوله الشاشة، وترتفع البطاقات 3 بكسل، وتقترب الصور بنسبة 3.5٪، وتتحرك الأسهم 3–4 بكسل. الحركة بالتحويل والشفافية فقط، ولا يتكرر شيء سوى ضوء الواجهة الذي يتوقف خارج الشاشة. ومع خيار تقليل الحركة تظهر الحالة النهائية مباشرة.",
      motionRows: [
        ["سريع", "180 ms", "الألوان والحدود والاستجابة عند الضغط"],
        ["قياسي", "320 ms", "ارتفاع البطاقات والأسهم والقوائم"],
        ["ظهور", "600 ms", "ظهور الأقسام والحواف الملوّنة"],
        ["دخول", "900 ms", "دخول الواجهة واستقرار الصورة"],
        ["تباطؤ في النهاية", "cubic-bezier(0.22, 1, 0.36, 1)", "كل ما يتحرك"],
        ["تسارع ثم تباطؤ", "cubic-bezier(0.65, 0, 0.35, 1)", "إعادة تشغيل التوقيع البصري"],
      ],
      motionHead: ["الرمز", "القيمة", "الاستخدام"],
      cut: "التوقيع البصري · القص بالليزر",
      cutNote:
        "رسم SVG فقط: خط قص يُرسم تدريجيًا، ورأس ليزر يتبع المسار بسرعة تغذية ثابتة، وطرف متوهّج، وشرر، وتوهّج ثابت — دون Canvas أو مكتبات. يعمل مرة واحدة عند ظهور نصفه على الشاشة (نحو 2.5 ثانية)، ويُعاد عند التمرير على بطاقته أو التركيز عليها، ولا يتكرر تلقائيًا.",
      cutSteps: ["دخول اللوح", "تجهيز الليزر", "قص النجمة", "الشرر والحرارة", "انفصال القطعة", "تبريد الحافة"],
      engrave: "التوقيع البصري · الحفر بالليزر",
      engraveNote:
        "لوح نحاسي يُحفر على مراحل متتابعة: يتحرك مؤشر الليزر متعرّجًا بمحاذاة خط مسح يكشف الميدالية — حلقة مزدوجة ونجمة ثمانية وشعار رواسي — ثم يعبر الضوء فوق الحفر الجديد. شعار رواسي فقط: لا علامات تجارية لجهات أخرى، ولا أرقام قطع أو أرقام تسلسلية.",
      engraveSteps: ["دخول اللوح", "تجهيز المؤشر", "مرور الليزر", "ظهور النقش", "عبور الضوء", "الاستقرار"],
      replay: "إعادة التشغيل",
      reveal: "التحميل والظهور",
      revealNote:
        "المحتوى ظاهر دون JavaScript. ومعه تصعد الأقسام 18 بكسل عند دخولها الشاشة بفارق 50–90 جزءًا من الثانية، وتنفتح الصور من إطار أصغر وهي تستقر. وتبدأ حركة الواجهة عند التحميل، فلا ينتظر أي جزء التمرير.",
      replayReveal: "إعادة الظهور",
      mobile: "مكوّنات الجوال",
      mobileNote:
        "الصفحة الرئيسية الفعلية بعرض الجوال: قائمة بكامل الارتفاع بصفوف كبيرة وزر طلب عرض السعر في المتناول دائمًا، وشريط خدمات 2 × 3، وبطاقات مصغّرة في عمودين، وشرائح أفقية لمزايا رواسي والمعدات والمشاريع، ورسوم ليزر تعمل مرة واحدة.",
      mobileFrame: "معاينة الصفحة الرئيسية بعرض الجوال",
      mobileRules: [
        "مساحات لمس 44 بكسل فأكثر",
        "زر طلب عرض السعر في الترويسة وفي القائمة",
        "شرائح أفقية دون تمرير أفقي للصفحة",
        "تأثيرات التمرير إضافة فقط: كل شيء يعمل باللمس ولوحة المفاتيح",
      ],
      tokens: "رموز المظهر",
      tokensNote:
        "كل لون رمز دلالي على ‎.lab-a2. ويأتي الوضع الداكن بعد الاعتماد بإعادة تعريف الأسماء نفسها (الأسطح والنصوص والحدود والألوان المساندة والظلال والتظليل)، دون تغيير أي مكوّن.",
      tokenHead: ["الرمز", "الفاتح", "الدور"],
    },
  },
} as const;
