import type {
  CertificatesPageContent,
  ClientsPageContent,
  IndustriesPageContent,
  ProjectsPageContent,
  ServicePageContent,
  ServicesPageContent,
} from "./types";

/**
 * Copy for the services overview, industries, clients and certificates pages.
 * Facts come from the company profile (p.3–6, p.12–15) and the metrics already
 * shown on the homepage; nothing here adds new claims.
 */
export const servicesPage: ServicesPageContent = {
  hero: {
    eyebrow: { en: "What we do", ar: "ما نقدّمه" },
    title: { en: "Six services, from sheet to site.", ar: "ست خدمات… من لوح الصاج إلى موقع العمل." },
    intro: {
      en: "Our metal division delivers high-precision, durable solutions for modern industries, and our scaffolding section supports construction, maintenance and repair projects.",
      ar: "يقدّم قسم المعادن لدينا حلولًا عالية الدقة ومتينة لمتطلبات الصناعة الحديثة، ويدعم قسم السقالات مشاريع البناء والصيانة والترميم.",
    },
    meta: [
      { label: { en: "Service lines", ar: "خطوط الخدمة" }, value: { en: "06", ar: "06" } },
      { label: { en: "Peak laser power", ar: "أعلى قدرة ليزر" }, value: { en: "12,000 W", ar: "12,000 واط" } },
      { label: { en: "Bevel cutting", ar: "القص المائل" }, value: { en: "360°", ar: "360°" } },
    ],
  },
  plateLabel: { en: "Services at a glance", ar: "الخدمات في لمحة" },
  indexLabel: { en: "Service index", ar: "فهرس الخدمات" },
  includesLabel: { en: "Includes", ar: "تشمل" },
  equipmentLabel: { en: "Equipment", ar: "المعدات" },
  open: { en: "Explore", ar: "تفاصيل" },
  cta: {
    label: { en: "Not sure where to start?", ar: "من أين تبدأ؟" },
    title: { en: "Send your drawings — we'll help you choose.", ar: "أرسل مخططاتك… ونساعدك في الاختيار." },
    body: {
      en: "Share a drawing or a short brief, and we'll suggest the right combination of cutting, forming and fabrication for your project.",
      ar: "شاركنا مخططًا أو وصفًا مختصرًا، وسنقترح عليك المزيج المناسب من القص والتشكيل والتصنيع لمشروعك.",
    },
    links: [
      { route: "contact", label: { en: "Request a quote", ar: "اطلب عرض سعر" } },
      { route: "capabilities", label: { en: "Machinery", ar: "المعدات" } },
      { route: "projects", label: { en: "Projects", ar: "المشاريع" } },
    ],
  },
};

/** Labels shared by the six service detail pages (stage 1D). Per-service copy is in service-details.ts. */
export const servicePage: ServicePageContent = {
  sections: {
    metal: { en: "Metal section", ar: "قسم المعادن" },
    scaffolding: { en: "Scaffolding section", ar: "قسم السقالات" },
  },
  service: { en: "Service", ar: "الخدمة" },
  quote: { en: "Request a quote", ar: "اطلب عرض سعر" },
  seeWork: { en: "See the work", ar: "شاهد الأعمال" },
  labels: {
    overview: { en: "Overview", ar: "نظرة عامة" },
    scope: { en: "What we provide", ar: "ما نقدّمه" },
    process: { en: "How we work", ar: "آلية العمل" },
    machines: { en: "Machinery", ar: "المعدات" },
    applications: { en: "Applications", ar: "مجالات الاستخدام" },
    gallery: { en: "Gallery", ar: "معرض الصور" },
    why: { en: "Why RAWASY", ar: "لماذا رواسي" },
    related: { en: "Related services", ar: "خدمات مرتبطة" },
    projects: { en: "Projects", ar: "المشاريع" },
  },
  includes: { en: "Includes", ar: "تشمل" },
  processNote: {
    en: "A general outline of the workflow, not a certified procedure. The exact steps are agreed for each project.",
    ar: "صورة عامة لسير العمل وليست إجراءً معتمدًا، وتُحدَّد الخطوات الفعلية لكل مشروع.",
  },
  machine: {
    power: { en: "Rated power", ar: "القدرة المقننة" },
    capabilities: { en: "Capabilities & machinery", ar: "القدرات والمعدات" },
    link: { en: "See all machinery", ar: "جميع المعدات" },
  },
  applications: {
    sectors: { en: "Sectors", ar: "القطاعات" },
    uses: { en: "Used for", ar: "تُستخدم في" },
    work: { en: "Seen in our work", ar: "في أعمالنا" },
    link: { en: "All sectors", ar: "جميع القطاعات" },
  },
  explore: { en: "Explore", ar: "تفاصيل" },
  relatedTitle: { en: "Services that work alongside.", ar: "خدمات مكمّلة." },
  allServices: { en: "All services", ar: "جميع الخدمات" },
  allProjects: { en: "All projects", ar: "جميع المشاريع" },
  cta: {
    call: { en: "Call", ar: "اتصل" },
    or: { en: "Or explore", ar: "أو تصفّح" },
    services: { en: "All services", ar: "جميع الخدمات" },
    projects: { en: "Projects", ar: "المشاريع" },
  },
};

export const industriesPage: IndustriesPageContent = {
  hero: {
    eyebrow: { en: "Applications", ar: "مجالات التطبيق" },
    title: { en: "Metal for construction, industry and the public realm.", ar: "حلول معدنية للبناء والصناعة والأماكن العامة." },
    intro: {
      en: "RAWASY's services support construction, infrastructure, industrial and commercial projects. Our work gallery also shows architectural, public-realm, street-furniture and signage work.",
      ar: "تدعم خدمات رواسي مشاريع البناء والبنية التحتية والصناعة والقطاع التجاري، كما تُظهر أعمالنا المنفّذة تطبيقات في العمارة والأماكن العامة وأثاث الشوارع واللوحات.",
    },
    meta: [
      { label: { en: "Sectors", ar: "القطاعات" }, value: { en: "08", ar: "08" } },
      { label: { en: "Named in our profile", ar: "مذكورة في ملفنا التعريفي" }, value: { en: "04", ar: "04" } },
      { label: { en: "From our work gallery", ar: "من معرض أعمالنا" }, value: { en: "04", ar: "04" } },
    ],
  },
  listLabel: { en: "Sectors", ar: "القطاعات" },
  basis: {
    profile: { en: "Named in the company profile", ar: "مذكور في الملف التعريفي" },
    inferred: { en: "Website classification, based on our work gallery", ar: "تصنيف للموقع مبني على معرض أعمالنا" },
  },
  relatedLabel: { en: "Related services", ar: "خدمات مرتبطة" },
  note: {
    label: { en: "About these sectors", ar: "حول هذه القطاعات" },
    title: { en: "How the sectors are classified.", ar: "كيف صنّفنا هذه القطاعات." },
    paragraphs: {
      en: [
        "Construction, infrastructure, industrial and commercial projects are named in RAWASY's company profile.",
        "Architecture & façades, public realm & landmarks, street furniture & shade, and signage & gateways are website classifications, drawn from the types of work in our gallery. They describe where the work applies — they are not claims about specific clients or contracts.",
      ],
      ar: [
        "قطاعات المقاولات والبناء والبنية التحتية والصناعة والمشاريع التجارية مذكورة في الملف التعريفي لرواسي.",
        "أما العمارة والواجهات، والأماكن العامة والمعالم، وأثاث الشوارع والمظلات، واللوحات والبوابات، فهي تصنيفات للموقع مستمدة من أنواع الأعمال في معرضنا، وتوضّح مجالات تطبيق أعمالنا دون أن تمثّل إشارة إلى عملاء أو عقود بعينها.",
      ],
    },
  },
  cta: {
    label: { en: "Start a project", ar: "ابدأ مشروعك" },
    title: { en: "Working in one of these sectors?", ar: "تعمل في أحد هذه القطاعات؟" },
    body: {
      en: "Tell us what you're building and we'll show you how our services can support it.",
      ar: "أخبرنا بما تعمل على تنفيذه، وسنوضّح لك كيف تدعمه خدماتنا.",
    },
    links: [
      { route: "contact", label: { en: "Request a quote", ar: "اطلب عرض سعر" } },
      { route: "services", label: { en: "Services", ar: "الخدمات" } },
    ],
  },
};

export const clientsPage: ClientsPageContent = {
  hero: {
    eyebrow: { en: "Who we have worked with", ar: "جهات تعاملنا معها" },
    title: { en: "Our clients", ar: "عملاؤنا" },
    intro: {
      en: "Manufacturers, contractors and specialist fabricators that have worked with RAWASY, as presented in our company profile.",
      ar: "مصانع ومقاولون وشركات تصنيع متخصصة تعاملت مع رواسي، كما يعرضها ملفنا التعريفي.",
    },
  },
  listLabel: { en: "Client logos", ar: "شعارات العملاء" },
  colours: { en: "Original colours", ar: "الألوان الأصلية" },
  note: {
    en: "Logos are shown to identify organisations that have worked with RAWASY. They remain the trademarks of their respective owners.",
    ar: "تُعرض الشعارات للتعريف بالجهات التي تعاملت مع رواسي، وتبقى علامات تجارية مملوكة لأصحابها.",
  },
  cta: {
    label: { en: "Work with RAWASY", ar: "اعمل مع رواسي" },
    title: { en: "Have a project in mind?", ar: "لديك مشروع؟" },
    links: [
      { route: "contact", label: { en: "Request a quote", ar: "اطلب عرض سعر" } },
      { route: "projects", label: { en: "Projects", ar: "المشاريع" } },
    ],
  },
};

export const certificatesPage: CertificatesPageContent = {
  hero: {
    eyebrow: { en: "Registration & licensing", ar: "التسجيل والترخيص" },
    title: { en: "Certificates & compliance", ar: "الشهادات والامتثال" },
    intro: {
      en: "RAWASY is a registered Saudi company. Its commercial registration, VAT registration and municipal commercial activity licence are shown below as redacted previews.",
      ar: "رواسي شركة سعودية مسجّلة. نعرض أدناه السجل التجاري وشهادة التسجيل في ضريبة القيمة المضافة ورخصة النشاط التجاري البلدية كنسخ معاينة أُخفيت فيها البيانات الحساسة.",
    },
  },
  registerLabel: { en: "Document register", ar: "سجل الوثائق" },
  columns: {
    number: { en: "No.", ar: "م" },
    document: { en: "Document", ar: "الوثيقة" },
    issuer: { en: "Issued by", ar: "جهة الإصدار" },
    reference: { en: "Reference", ar: "المرجع" },
  },
  reference: { en: "Available on request", ar: "متاح عند الطلب" },
  view: { en: "View document", ar: "عرض الوثيقة" },
  previewLabel: { en: "Redacted preview", ar: "نسخة معاينة منقّحة" },
  versions: { en: ["English version", "Arabic version"], ar: ["النسخة الإنجليزية", "النسخة العربية"] },
  dialogNote: {
    en: "Numbers, QR codes and personal details are redacted in this preview.",
    ar: "تم إخفاء الأرقام ورموز QR والبيانات الشخصية في هذه المعاينة.",
  },
  redaction: {
    label: { en: "About the previews", ar: "حول نسخ المعاينة" },
    title: { en: "Sensitive details stay covered.", ar: "البيانات الحساسة تبقى مخفية." },
    points: {
      en: [
        "Registration numbers, QR codes, barcodes and personal details are covered with solid blocks in every preview. Nothing of the original information remains under them.",
        "The previews come from RAWASY's company profile and are shown for reference only. They are not certified copies.",
        "Registration numbers are available on request.",
      ],
      ar: [
        "تُغطّى أرقام التسجيل ورموز QR والباركود والبيانات الشخصية بكتل مصمتة في كل نسخة معاينة، ولا يبقى تحتها شيء من البيانات الأصلية.",
        "نسخ المعاينة مأخوذة من الملف التعريفي لشركة رواسي، وتُعرض للاطلاع فقط وليست نسخًا مصدّقة.",
        "أرقام التسجيل متاحة عند الطلب.",
      ],
    },
  },
  cta: {
    label: { en: "Questions?", ar: "لديك استفسار؟" },
    title: { en: "Need a document for a tender or supplier registration?", ar: "تحتاج وثيقة لمناقصة أو تسجيل مورّد؟" },
    links: [
      { route: "contact", label: { en: "Contact RAWASY", ar: "تواصل مع رواسي" } },
      { route: "about", label: { en: "About RAWASY", ar: "عن رواسي" } },
    ],
  },
};

/**
 * Projects overview. Titles and summaries come from the work gallery in the
 * company profile; categories are website classifications. No counts, clients,
 * locations or years are stated.
 */
export const projectsPage: ProjectsPageContent = {
  hero: {
    eyebrow: { en: "Selected work", ar: "مختارات من أعمالنا" },
    title: { en: "Built in metal. Made to be seen.", ar: "أعمال من المعدن… تلفت الأنظار." },
    intro: {
      en: "Landmark sculptures, shade structures, laser-cut screens, architectural metal and custom pieces from RAWASY's work gallery.",
      ar: "مجسمات ومعالم ومظلات وسواتر مقصوصة بالليزر وأعمال معدنية معمارية وقطع خاصة من معرض أعمال رواسي.",
    },
    meta: [
      { label: { en: "Source", ar: "المصدر" }, value: { en: "Company profile work gallery", ar: "معرض الأعمال في الملف التعريفي" } },
      { label: { en: "Workshop", ar: "الورشة" }, value: { en: "Riyadh · Saudi Arabia", ar: "الرياض · المملكة العربية السعودية" } },
      { label: { en: "Disciplines", ar: "التخصصات" }, value: { en: "Cutting · Forming · Fabrication", ar: "القص · التشكيل · التصنيع" } },
    ],
    quickFilter: { en: "Browse by category", ar: "تصفّح حسب الفئة" },
  },
  featured: { label: { en: "Featured project", ar: "مشروع مميّز" }, slug: "tulip-roundabout-sculpture" },
  editorial: {
    label: { en: "Highlights", ar: "أبرز الأعمال" },
    title: { en: "Landmarks, lanterns and shade.", ar: "معالم وفوانيس ومظلات." },
    intro: {
      en: "A closer look at pieces from the gallery — from the workshop floor to the finished installation.",
      ar: "نظرة أقرب على قطع من معرض الأعمال… من أرضية الورشة إلى التركيب النهائي.",
    },
    slugs: ["clock-tower-landmark", "wave-form-sculpture", "suspended-lantern", "palm-leaf-shade-canopies"],
  },
  gallery: {
    label: { en: "Gallery", ar: "المعرض" },
    title: { en: "All projects", ar: "جميع المشاريع" },
    intro: {
      en: "Filter the gallery by the kind of work. Categories describe what each piece shows; they are website classifications.",
      ar: "صفِّ المعرض حسب نوع العمل. الفئات تصف ما تُظهره كل قطعة، وهي تصنيفات خاصة بالموقع.",
    },
    filterLabel: { en: "Filter projects by category", ar: "تصفية المشاريع حسب الفئة" },
    all: { en: "All", ar: "الكل" },
    showing: { en: "Showing", ar: "المعروض" },
  },
  index: {
    label: { en: "Project index", ar: "فهرس المشاريع" },
    title: { en: "Every project by gallery reference.", ar: "كل المشاريع حسب رقمها في المعرض." },
    note: {
      en: "Scope, materials, locations, clients and years appear on a project only once RAWASY has confirmed them.",
      ar: "لا تظهر تفاصيل النطاق والخامات والمواقع والعملاء والسنوات إلا بعد تأكيدها من رواسي.",
    },
  },
  view: { en: "View project", ar: "عرض المشروع" },
  refLabel: { en: "Ref.", ar: "المرجع" },
  cta: {
    label: { en: "Start a project", ar: "ابدأ مشروعك" },
    title: { en: "Have a piece like this in mind?", ar: "لديك فكرة لقطعة مماثلة؟" },
    links: [
      { route: "contact", label: { en: "Request a quote", ar: "اطلب عرض سعر" } },
      { route: "services", label: { en: "Our services", ar: "خدماتنا" } },
      { route: "about", label: { en: "About RAWASY", ar: "عن رواسي" } },
    ],
  },
};
