import type { AboutContent } from "./types";

/**
 * About page. Source: company profile p.2 ("About us", "Our vision"), p.6
 * ("Scaffolding section") and p.16 ("Why choose us", "What sets us apart").
 * The six-step process is a website framework, not a certified procedure.
 */
export const about: AboutContent = {
  hero: {
    eyebrow: { en: "Company", ar: "الشركة" },
    title: { en: "Metalwork, engineered in Riyadh.", ar: "تصنيع معدني بدقّة هندسية، من الرياض." },
    intro: {
      en: "RAWASY United International delivers laser cutting, CNC bending, steel structures, fabrication, laser engraving and scaffolding — combining advanced technology with skilled craftsmanship.",
      ar: "تقدّم رواسي المتحدة العالمية خدمات القص بالليزر والثني بتقنية CNC والهياكل الحديدية والتصنيع المعدني والحفر بالليزر والسقالات، وتجمع فيها بين التقنية المتقدمة والحِرفية العالية.",
    },
    nameplate: { en: "Registered name", ar: "الاسم المسجّل" },
    meta: [
      { label: { en: "Base", ar: "المقر" }, value: { en: "Riyadh · Saudi Arabia", ar: "الرياض · المملكة العربية السعودية" } },
      { label: { en: "Entity", ar: "الكيان" }, value: { en: "Limited liability company", ar: "شركة ذات مسؤولية محدودة" } },
      { label: { en: "Service lines", ar: "خطوط الخدمة" }, value: { en: "06", ar: "06" } },
    ],
    media: "services/fabrication-workshop",
    mediaAlt: {
      en: "Laser-cut lanterns and a lattice tower under fabrication in the RAWASY workshop",
      ar: "فوانيس مقصوصة بالليزر وبرج شبكي أثناء التصنيع في ورشة رواسي",
    },
    caption: {
      en: "In the workshop — laser-cut lanterns and a lattice tower",
      ar: "داخل الورشة — فوانيس مقصوصة بالليزر وبرج شبكي",
    },
  },
  overview: {
    label: { en: "Who we are", ar: "من نحن" },
    title: { en: "One partner across metal and construction work.", ar: "شريك واحد لأعمال المعادن والإنشاءات." },
    paragraphs: {
      en: [
        "At RAWASY, we deliver excellence in the metal industry through innovation, precision and reliability. With expertise in laser cutting, CNC bending, steel structure manufacturing and fabrication, we provide comprehensive solutions tailored to clients across diverse industries.",
        "Beyond metalwork, we support projects with scaffolding, formwork systems, wood and steel props, rental services and transportation. This integrated approach lets us support projects of all scales with efficiency, safety and durability.",
        "We combine advanced technology with skilled craftsmanship to meet high standards of quality — keeping to deadlines and aiming to exceed expectations.",
      ],
      ar: [
        "نعمل في رواسي على تقديم التميّز في قطاع المعادن من خلال الابتكار والدقة والموثوقية. وبخبرتنا في القص بالليزر والثني بتقنية CNC وتصنيع الهياكل الحديدية والتصنيع المعدني، نقدّم حلولًا متكاملة مصمّمة لاحتياجات عملائنا في مختلف القطاعات.",
        "وإلى جانب الأعمال المعدنية، ندعم المشاريع بالسقالات وأنظمة الشدّات والدعامات الخشبية والحديدية وخدمات التأجير والنقل. ويتيح لنا هذا النهج المتكامل خدمة المشاريع بمختلف أحجامها بكفاءة وأمان ومتانة.",
        "نجمع بين التقنية المتقدمة والحِرفية العالية لنحقق معايير جودة عالية، ونلتزم بالمواعيد ونسعى إلى تجاوز التوقعات.",
      ],
    },
    servicesLabel: { en: "Six service lines", ar: "ستة خطوط خدمة" },
  },
  vision: {
    label: { en: "Our vision", ar: "رؤيتنا" },
    aimsLabel: { en: "We strive to", ar: "ونسعى إلى" },
  },
  beyond: {
    label: { en: "Beyond metalwork", ar: "إلى جانب الأعمال المعدنية" },
    title: { en: "Scaffolding and site support.", ar: "السقالات ودعم مواقع العمل." },
    intro: {
      en: "RAWASY provides safe and reliable scaffolding solutions to support construction, maintenance and repair projects — with strong, adaptable systems and professional service.",
      ar: "توفّر رواسي حلول سقالات آمنة وموثوقة لدعم مشاريع البناء والصيانة والترميم، بأنظمة قوية ومرنة وخدمة احترافية.",
    },
    items: [
      { en: "Formwork systems", ar: "أنظمة الشدّات" },
      { en: "Wood & steel props", ar: "الدعامات الخشبية والحديدية" },
      { en: "New structures", ar: "الإنشاءات الجديدة" },
      { en: "Rental services", ar: "خدمات التأجير" },
      { en: "Installation & dismantling", ar: "التركيب والفك" },
      { en: "Transportation", ar: "النقل" },
    ],
    media: "services/scaffolding-3",
    mediaAlt: {
      en: "Large scaffolding system around a structure under construction",
      ar: "منظومة سقالات كبيرة حول منشأة قيد الإنشاء",
    },
    link: { en: "Scaffolding service", ar: "خدمة السقالات" },
  },
  process: {
    label: { en: "How we work", ar: "كيف نعمل" },
    title: { en: "From drawing to site, in six steps.", ar: "من المخطط إلى الموقع… في ست خطوات." },
    intro: {
      en: "An outline of how a project typically moves with RAWASY. The exact steps, scope and responsibilities are agreed with each client.",
      ar: "صورة عامة لمسار المشروع مع رواسي، أما الخطوات والنطاق والمسؤوليات فتُحدَّد بالاتفاق مع كل عميل.",
    },
    steps: [
      {
        slug: "understand",
        title: { en: "Understand", ar: "الفهم" },
        body: {
          en: "We review your drawings, requirements, quantities and timeline.",
          ar: "نراجع مخططاتك ومتطلباتك والكميات والجدول الزمني.",
        },
      },
      {
        slug: "engineer",
        title: { en: "Engineer", ar: "التخطيط الهندسي" },
        body: {
          en: "We plan cutting, forming and assembly around the design and the materials.",
          ar: "نخطّط لمراحل القص والتشكيل والتجميع وفق التصميم والخامات.",
        },
      },
      {
        slug: "fabricate",
        title: { en: "Fabricate", ar: "التصنيع" },
        body: {
          en: "Cutting, bending, welding and assembly — on fibre lasers, CNC press brakes and laser welding.",
          ar: "قص وثني ولحام وتجميع باستخدام ليزر الفايبر ومكابس الثني CNC واللحام بالليزر.",
        },
      },
      {
        slug: "inspect",
        title: { en: "Inspect", ar: "الفحص" },
        body: {
          en: "Parts are checked against the drawings before they leave the workshop.",
          ar: "نطابق القطع مع المخططات قبل خروجها من الورشة.",
        },
      },
      {
        slug: "deliver",
        title: { en: "Deliver", ar: "التوصيل" },
        body: {
          en: "Transport to site, with logistics support.",
          ar: "النقل إلى موقع المشروع مع دعم لوجستي.",
        },
      },
      {
        slug: "install",
        title: { en: "Install", ar: "التركيب" },
        body: {
          en: "Steel structure assembly and scaffolding installation on site, where they are part of the scope.",
          ar: "تركيب الهياكل الحديدية والسقالات في الموقع متى كانت ضمن نطاق العمل.",
        },
      },
    ],
  },
  why: {
    label: { en: "Why RAWASY", ar: "لماذا رواسي" },
    title: { en: "What sets RAWASY apart.", ar: "ما الذي يميّز رواسي." },
    intro: {
      en: "Many companies specialise in one or two areas. RAWASY brings metal fabrication, steel structures, scaffolding and formwork together — so a project can move from drawing to site with one partner.",
      ar: "تتخصص شركات كثيرة في مجال أو اثنين، بينما تجمع رواسي التصنيع المعدني والهياكل الحديدية والسقالات والشدّات، لينتقل المشروع من المخطط إلى الموقع مع شريك واحد.",
    },
  },
  cta: {
    label: { en: "Next steps", ar: "الخطوة التالية" },
    title: { en: "Put this to work on your project.", ar: "لنضع هذه الخبرة في خدمة مشروعك." },
    links: [
      {
        route: "services",
        label: { en: "Explore our services", ar: "استكشف خدماتنا" },
        description: { en: "Six service lines, from laser cutting to scaffolding.", ar: "ستة خطوط خدمة، من القص بالليزر إلى السقالات." },
      },
      {
        route: "projects",
        label: { en: "See selected projects", ar: "شاهد مختارات من أعمالنا" },
        description: { en: "Sculptures, shade structures, screens and custom pieces.", ar: "مجسمات ومظلات وسواتر وقطع خاصة." },
      },
      {
        route: "contact",
        label: { en: "Request a quote", ar: "اطلب عرض سعر" },
        description: { en: "Send your drawings and requirements.", ar: "أرسل مخططاتك ومتطلباتك." },
      },
    ],
  },
};
