import type { CapabilitiesPageContent } from "./types";

/**
 * Capabilities & Machinery (Stage 1E): the page's labels and notes. Machine facts are not repeated here — names, types,
 * capabilities, rated powers, services, photos and sources come from machines.ts, whose records cite company profile
 * p.7 — and nothing is stated beyond them. Page 7 prints the names (four with their rated power) and the photos; the
 * types, capability sentences and services are the records' own wording, so the notes below never call them the
 * profile's. Reused wording: "Laser cutting systems" (the Laser Cutting service page), "Peak laser power" (the services
 * overview), "Rated power" (the service pages), "Not stated in the company profile" (About's machine table) and the
 * services overview's closing invitation.
 */
export const capabilitiesPage: CapabilitiesPageContent = {
  hero: {
    eyebrow: { en: "Our machinery", ar: "معداتنا" },
    explore: { en: "Explore the machinery", ar: "استكشف المعدات" },
    fleet: { en: "The machinery at a glance", ar: "المعدات في لمحة" },
    facts: {
      machines: { en: "Machines", ar: "المعدات" },
      laser: { en: "Laser cutting systems", ar: "أنظمة القص بالليزر" },
      peak: { en: "Peak laser power", ar: "أعلى قدرة ليزر" },
    },
  },
  power: {
    label: { en: "Rated power", ar: "القدرة المقننة" },
    title: { en: "Laser power, as the profile states it.", ar: "قدرة الليزر كما يذكرها الملف التعريفي." },
    intro: {
      en: "The company profile gives a rated power for each of the four laser cutting machines. It gives none for the CNC press brake or the laser welding machine.",
      ar: "يذكر الملف التعريفي القدرة المقننة لكل ماكينة من ماكينات القص بالليزر الأربع، ولا يذكرها لمكبس الثني CNC ولا لماكينة اللحام بالليزر.",
    },
    chart: { en: "Rated power of each laser cutting machine, in watts", ar: "القدرة المقننة لكل ماكينة قص بالليزر، بالواط" },
    unit: { en: "W", ar: "واط" },
  },
  console: {
    label: { en: "Machinery", ar: "المعدات" },
    title: { en: "Six machines. Choose one.", ar: "ست معدات… اختر إحداها." },
    intro: {
      en: "Select a machine to see its type, its rated power where the profile states one, and the service it supports.",
      ar: "اختر معدّة لعرض نوعها، وقدرتها المقننة حيث يذكرها الملف التعريفي، والخدمة التي تدعمها.",
    },
    list: { en: "Choose a machine", ar: "اختر المعدّة" },
    showing: { en: "Showing", ar: "المعروضة الآن" },
    schematic: { en: "Process concept · illustrative, not to scale", ar: "مفهوم العملية · رسم توضيحي بغير مقياس" },
  },
  register: {
    label: { en: "Technical register", ar: "السجل الفني" },
    title: { en: "Six machines, side by side.", ar: "ست معدات جنبًا إلى جنب." },
    intro: {
      en: "Machine names and rated powers are as the company profile lists them, on page 7. Specifications it does not give are left out.",
      ar: "أسماء المعدات وقدراتها المقننة كما يوردها الملف التعريفي في الصفحة 7، ولا نعرض مواصفات لم يذكرها.",
    },
    caption: { en: "Machinery listed in the company profile", ar: "المعدات الواردة في الملف التعريفي" },
    number: { en: "No.", ar: "م" },
    machine: { en: "Machine", ar: "المعدّة" },
    type: { en: "Type", ar: "النوع" },
  },
  services: {
    label: { en: "From machine to service", ar: "من المعدّة إلى الخدمة" },
    title: { en: "The services these machines support.", ar: "الخدمات التي تدعمها هذه المعدات." },
    intro: {
      en: "Each machine supports one of RAWASY's service lines. Open a service for its scope and how the work is done.",
      ar: "تدعم كل معدّة أحد خطوط خدمة رواسي. افتح صفحة الخدمة للاطلاع على نطاقها وآلية العمل.",
    },
    machines: { en: "Machines", ar: "المعدات" },
    open: { en: "Explore the service", ar: "استكشف الخدمة" },
  },
  source: {
    label: { en: "Source", ar: "المصدر" },
    title: { en: "About these specifications", ar: "حول هذه المواصفات" },
    body: {
      en: "The machinery on this page is listed in RAWASY's company profile, page 7, which names each machine and gives the rated power of the four laser cutting machines. The profile states no other specification for these machines, so this page shows none. To discuss a particular part, send your drawings with a quote request.",
      ar: "المعدات المعروضة في هذه الصفحة واردة في الملف التعريفي لرواسي، الصفحة 7، الذي يذكر اسم كل معدّة والقدرة المقننة لماكينات القص بالليزر الأربع. ولا يذكر الملف مواصفات أخرى لهذه المعدات، فلا تعرض الصفحة أيًّا منها. ولمناقشة قطعة بعينها، أرسل مخططاتك مع طلب عرض السعر.",
    },
  },
  fields: {
    power: { en: "Rated power", ar: "القدرة المقننة" },
    service: { en: "Related service", ar: "الخدمة المرتبطة" },
    source: { en: "Source", ar: "المصدر" },
    notStated: { en: "Not stated in the company profile", ar: "غير مذكورة في الملف التعريفي" },
    profile: { en: "Company profile", ar: "الملف التعريفي" },
    /** "{n}" is replaced by the page number. */
    page: { en: "p.{n}", ar: "ص {n}" },
  },
  quote: { en: "Request a quote", ar: "اطلب عرض سعر" },
  serviceLink: { en: "{service} service", ar: "خدمة {service}" },
  cta: {
    label: { en: "Start a project", ar: "ابدأ مشروعك" },
    title: { en: "Have a part to cut, bend or weld?", ar: "لديك قطعة تحتاج إلى قص أو ثني أو لحام؟" },
    body: {
      en: "Share a drawing or a short brief, and we'll suggest the right combination of cutting, forming and fabrication for your project.",
      ar: "شاركنا مخططًا أو وصفًا مختصرًا، وسنقترح عليك المزيج المناسب من القص والتشكيل والتصنيع لمشروعك.",
    },
    links: [
      { route: "contact", hash: "quote", label: { en: "Request a quote", ar: "اطلب عرض سعر" } },
      { route: "services", label: { en: "Services", ar: "الخدمات" } },
      { route: "projects", label: { en: "Projects", ar: "المشاريع" } },
    ],
  },
};
