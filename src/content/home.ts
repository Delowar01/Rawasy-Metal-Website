import type { Localized } from "./types";

/** Homepage copy. Section order mirrors the Phase 1 homepage sequence. */
export const home = {
  hero: {
    eyebrow: { en: "RAWASY United International", ar: "رواسي المتحدة العالمية" },
    headline: {
      en: ["Engineering", "metal into", "possibility."],
      ar: ["نُشكّل المعدن", "بدقّة هندسية", "ونصنع الممكن."],
    } as Localized<string[]>,
    sub: {
      en: "Advanced metal fabrication, laser cutting, CNC bending, steel structures and custom industrial solutions in Saudi Arabia.",
      ar: "حلول متقدمة في التصنيع المعدني والقص بالليزر والثني بتقنية CNC والهياكل الحديدية، وحلول صناعية حسب الطلب في المملكة العربية السعودية.",
    },
    primaryCta: { en: "Explore Our Capabilities", ar: "اكتشف قدراتنا" },
    secondaryCta: { en: "Start a Project", ar: "ابدأ مشروعك" },
    location: { en: "Riyadh · Saudi Arabia", ar: "الرياض · المملكة العربية السعودية" },
    scroll: { en: "Scroll", ar: "مرّر" },
    plate: {
      part: { en: "Part RW-01", ar: "القطعة RW-01" },
      sequence: { en: "Cut sequence", ar: "تسلسل القص" },
    },
  },
  intro: {
    label: { en: "Who we are", ar: "من نحن" },
    statement: {
      en: "A Saudi metal partner — from the first laser cut to the finished structure.",
      ar: "شريك سعودي في المعادن، من أول قصّة ليزر حتى الهيكل المكتمل.",
    },
    paragraphs: {
      en: [
        "RAWASY delivers excellence in the metal industry through innovation, precision and reliability. With expertise in laser cutting, CNC bending, steel structure manufacturing and fabrication, we provide complete solutions tailored to clients across diverse industries.",
        "We combine advanced technology with skilled craftsmanship to meet the highest standards of quality — meeting deadlines while exceeding expectations.",
      ],
      ar: [
        "تقدّم رواسي التميّز في قطاع المعادن من خلال الابتكار والدقة والموثوقية. وبخبرتنا في القص بالليزر والثني بتقنية CNC وتصنيع الهياكل الحديدية والتصنيع المعدني، نقدّم حلولًا متكاملة مصمّمة لاحتياجات عملائنا في مختلف القطاعات.",
        "نجمع بين التقنية المتقدمة والحِرفية العالية لنحقق أعلى معايير الجودة، ونلتزم بالمواعيد ونتجاوز التوقعات.",
      ],
    } as Localized<string[]>,
    beyondLabel: { en: "Beyond metalwork", ar: "إلى جانب الأعمال المعدنية" },
    beyond: {
      en: ["Scaffolding", "Formwork systems", "Wood & steel props", "Rental services", "Transportation"],
      ar: ["السقالات", "أنظمة الشدّات", "الدعامات الخشبية والحديدية", "خدمات التأجير", "النقل"],
    } as Localized<string[]>,
    visionLabel: { en: "Our vision", ar: "رؤيتنا" },
    link: { en: "About RAWASY", ar: "تعرّف على رواسي" },
  },
  process: {
    label: { en: "Key capabilities", ar: "قدراتنا الأساسية" },
    title: { en: "From flat sheet to finished structure.", ar: "من لوح الصاج… إلى الهيكل المكتمل." },
    intro: {
      en: "Six connected disciplines in one team — so a drawing moves from cutting to installation without changing hands.",
      ar: "ستة تخصصات مترابطة ضمن فريق واحد، لينتقل مشروعك من القص حتى التركيب دون التنقّل بين جهات متعددة.",
    },
  },
  services: {
    label: { en: "Services", ar: "الخدمات" },
    title: { en: "Six service lines. One accountable partner.", ar: "ست خدمات متكاملة… وشريك واحد مسؤول." },
    intro: {
      en: "From precision laser cutting to scaffolding on site — each service works on its own or as part of a complete package.",
      ar: "من القص الدقيق بالليزر إلى السقالات في الموقع — كل خدمة تعمل منفردة أو ضمن حزمة متكاملة.",
    },
    open: { en: "Explore service", ar: "تفاصيل الخدمة" },
    all: { en: "All services", ar: "جميع الخدمات" },
    figure: { en: "Fig.", ar: "شكل" },
  },
  statement: {
    lines: {
      en: ["Precision in every cut.", "Strength in every structure."],
      ar: ["دقّة في كل قصّة،", "وقوة في كل هيكل."],
    } as Localized<string[]>,
    caption: {
      en: "360° bevel laser cutting · CNC forming · Structural fabrication",
      ar: "قص مائل بالليزر 360° · تشكيل CNC · تصنيع إنشائي",
    },
  },
  machinery: {
    label: { en: "Machinery", ar: "المعدات" },
    title: { en: "The equipment behind the precision.", ar: "المعدات التي تصنع الدقة." },
    intro: {
      en: "Fibre lasers up to 12,000 W, CNC press-brake forming and laser welding.",
      ar: "ليزر فايبر بقدرة تصل إلى 12,000 واط، وثني بمكابس CNC، ولحام بالليزر.",
    },
    power: { en: "Rated power", ar: "القدرة" },
    usedFor: { en: "Used for", ar: "الاستخدام" },
    service: { en: "Related service", ar: "الخدمة المرتبطة" },
    all: { en: "All machinery", ar: "كل المعدات" },
    notStated: { en: "—", ar: "—" },
  },
  projects: {
    label: { en: "Selected work", ar: "مختارات من أعمالنا" },
    title: { en: "Built in metal. Made to be seen.", ar: "أعمال من المعدن… تلفت الأنظار." },
    intro: {
      en: "Landmark sculptures, shade structures, laser-cut screens and custom pieces from RAWASY's portfolio.",
      ar: "مجسمات ومعالم ومظلات وسواتر مقصوصة بالليزر وقطع خاصة من أعمال رواسي.",
    },
    all: { en: "View all projects", ar: "جميع المشاريع" },
    view: { en: "View project", ar: "عرض المشروع" },
  },
  industries: {
    label: { en: "Industries", ar: "القطاعات" },
    title: { en: "Where our metal works.", ar: "أين تعمل حلولنا؟" },
    note: {
      en: "Sectors reflect RAWASY's service lines and delivered work.",
      ar: "القطاعات مبنية على خدمات رواسي وأعمالها المنفّذة.",
    },
    all: { en: "Industries we serve", ar: "القطاعات التي نخدمها" },
  },
  why: {
    label: { en: "Why RAWASY", ar: "لماذا رواسي" },
    title: {
      en: "A partner that builds with integrity and delivers with precision.",
      ar: "شريك يبني بنزاهة، وينفّذ بدقة، ويقف خلف عمله بعد التسليم.",
    },
    intro: {
      en: "Choosing RAWASY means partnering with a company that values precision, trust and innovation at every step.",
      ar: "اختيارك لرواسي يعني شراكة مع شركة تقدّر الدقة والثقة والابتكار في كل خطوة.",
    },
  },
  metrics: {
    label: { en: "At a glance", ar: "لمحة سريعة" },
    title: { en: "Capability you can measure.", ar: "قدرات واضحة بالأرقام." },
    footnote: { en: "Figures from RAWASY's company profile.", ar: "الأرقام من الملف التعريفي لرواسي." },
  },
  clients: {
    label: { en: "Clients", ar: "عملاؤنا" },
    title: { en: "Working alongside Saudi industry.", ar: "شركاء النجاح." },
    intro: {
      en: "Manufacturers, contractors and specialist fabricators that have worked with RAWASY.",
      ar: "مصانع ومقاولون وشركات تصنيع متخصصة تعاملت مع رواسي.",
    },
    all: { en: "All clients", ar: "جميع العملاء" },
  },
  certificates: {
    label: { en: "Compliance", ar: "الامتثال" },
    title: { en: "Registered. Licensed. Accountable.", ar: "مسجّلون ومرخّصون… وملتزمون." },
    intro: {
      en: "RAWASY is a registered Saudi company with VAT registration and a municipal commercial activity licence.",
      ar: "رواسي شركة سعودية مسجّلة في السجل التجاري وفي ضريبة القيمة المضافة، وتحمل رخصة نشاط تجاري من البلدية.",
    },
    note: { en: "Registration numbers are available on request.", ar: "أرقام التسجيل متاحة عند الطلب." },
    view: { en: "View certificate", ar: "عرض الشهادة" },
    redacted: {
      en: "Numbers, QR codes and personal details are redacted in this preview.",
      ar: "تم إخفاء الأرقام ورموز QR والبيانات الشخصية في هذه المعاينة.",
    },
    all: { en: "Certificates & compliance", ar: "الشهادات والامتثال" },
  },
  cta: {
    label: { en: "Start a project", ar: "ابدأ مشروعك" },
    title: {
      en: "Have a drawing, a concept or a challenge? Let's shape it in metal.",
      ar: "عندك مخطط أو فكرة أو تحدٍّ؟ نحوّله إلى واقع من المعدن.",
    },
    steps: {
      en: ["Share your drawings or brief", "Receive a technical quotation", "We cut, fabricate and deliver"],
      ar: ["أرسل مخططاتك أو متطلباتك", "استلم عرض سعر فنيًا", "نقصّ ونصنّع ونسلّم"],
    } as Localized<string[]>,
    primary: { en: "Start a Project", ar: "ابدأ مشروعك" },
    whatsapp: { en: "Chat on WhatsApp", ar: "تواصل عبر واتساب" },
  },
};
