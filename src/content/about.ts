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
    // "New Struck(s)" in the profile is unclear and stays out until RAWASY clarifies it (ASSET_INVENTORY item 7).
    items: [
      { slug: "formwork", label: { en: "Formwork systems", ar: "أنظمة الشدّات" } },
      { slug: "props", label: { en: "Wood & steel props", ar: "الدعامات الخشبية والحديدية" } },
      { slug: "rental", label: { en: "Rental services", ar: "خدمات التأجير" } },
      { slug: "installation", label: { en: "Installation & dismantling", ar: "التركيب والفك" } },
      { slug: "transport", label: { en: "Transportation", ar: "النقل" } },
    ],
    media: "services/scaffolding-1",
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
  what: {
    label: { en: "What we do", ar: "ما نقدّمه" },
    title: { en: "Metalwork and scaffolding, from one partner.", ar: "الأعمال المعدنية والسقالات… من شريك واحد." },
    intro: {
      en: "RAWASY's services fall into two sections — metal and scaffolding — so one company can take a project from the first cut to support on site.",
      ar: "تنقسم خدمات رواسي إلى قسمين: المعادن والسقالات، لتتولى جهة واحدة المشروع من أول قصّة حتى دعم الموقع.",
    },
    divisions: [
      {
        slug: "metal",
        label: { en: "Metal section", ar: "قسم المعادن" },
        title: { en: "Metalwork and fabrication", ar: "الأعمال المعدنية والتصنيع" },
        body: {
          en: "Laser cutting, CNC bending, steel structures, metal fabrication and laser engraving.",
          ar: "القص بالليزر، والثني بتقنية CNC، والهياكل الحديدية، والتصنيع المعدني، والحفر بالليزر.",
        },
        link: { en: "Core metal services", ar: "خدمات المعادن الأساسية" },
      },
      {
        slug: "scaffolding",
        label: { en: "Scaffolding section", ar: "قسم السقالات" },
        title: { en: "Scaffolding and site support", ar: "السقالات ودعم مواقع العمل" },
        body: {
          en: "Scaffolding, formwork systems, wood and steel props, rental, installation and dismantling, and transportation.",
          ar: "السقالات، وأنظمة الشدّات، والدعامات الخشبية والحديدية، والتأجير، والتركيب والفك، والنقل.",
        },
        link: { en: "Scaffolding and support", ar: "السقالات والدعم" },
      },
    ],
  },
  metal: {
    label: { en: "Core metal services", ar: "خدمات المعادن الأساسية" },
    title: { en: "Cut, formed, fabricated and finished.", ar: "قصّ وتشكيل وتصنيع وتشطيب." },
    intro: {
      en: "Each service works on its own or as part of a complete package.",
      ar: "كل خدمة تعمل منفردة أو ضمن حزمة متكاملة.",
    },
    explore: { en: "Explore", ar: "استكشف" },
  },
  approach: {
    label: { en: "Engineering approach", ar: "نهجنا الهندسي" },
    title: { en: "Advanced technology, skilled craftsmanship.", ar: "تقنية متقدمة… وحِرفية عالية." },
    intro: {
      en: "RAWASY pairs fibre-laser cutting, CNC forming and laser welding with skilled hands — technology for accuracy, craftsmanship for the finish.",
      ar: "تجمع رواسي بين القص بليزر الفايبر والتشكيل بتقنية CNC واللحام بالليزر وبين الأيدي الماهرة؛ التقنية للدقة، والحِرفية للإتقان.",
    },
  },
  workshop: {
    label: { en: "In the workshop", ar: "داخل الورشة" },
    title: { en: "Work in progress.", ar: "أعمال قيد التنفيذ." },
    intro: {
      en: "Pieces on the workshop floor, from cut sheets to sculptures taking shape.",
      ar: "قطع على أرض الورشة، من الألواح المقصوصة إلى مجسّمات تتشكّل.",
    },
    // Genuine workshop photos only (see ASSET_INVENTORY): no AI-marked, render or third-party-branded images.
    photos: [
      { media: "services/fabrication-workshop", caption: { en: "Lanterns and a lattice tower under fabrication", ar: "فوانيس وبرج شبكي أثناء التصنيع" } },
      { media: "projects/geometric-lanterns-1", caption: { en: "Polyhedral lanterns with laser-cut patterns", ar: "فوانيس متعددة الأوجه بنقوش مقصوصة بالليزر" } },
      { media: "projects/perforated-beams-1", caption: { en: "Perforated steel beams", ar: "كمرات حديدية مثقّبة" } },
      { media: "projects/wheat-monument-2", caption: { en: "The wheat stalks monument in fabrication", ar: "مجسّم سنابل القمح أثناء التصنيع" } },
      { media: "projects/curved-frames-1", caption: { en: "Curved steel frames", ar: "إطارات حديدية منحنية" } },
      { media: "projects/heritage-cannons-1", caption: { en: "Finishing a heritage cannon replica", ar: "تشطيب مجسّم مدفع تراثي" } },
      { media: "services/fabrication-cut-sheets", caption: { en: "Laser-cut patterned sheets", ar: "ألواح بنقوش مقصوصة بالليزر" } },
    ],
  },
  machinery: {
    label: { en: "Machinery", ar: "المعدات" },
    title: { en: "The equipment behind the precision.", ar: "المعدات التي تصنع الدقة." },
    intro: {
      en: "Four fibre-laser cutting systems up to 12,000 W, CNC press-brake forming and laser welding.",
      ar: "أربعة أنظمة قص بليزر الفايبر بقدرة تصل إلى 12,000 واط، وثني بمكابس CNC، ولحام بالليزر.",
    },
    link: { en: "Capabilities & machinery", ar: "القدرات والمعدات" },
    machine: { en: "Machine", ar: "المعدّة" },
    type: { en: "Type", ar: "النوع" },
    power: { en: "Rated power", ar: "القدرة" },
  },
  projects: {
    label: { en: "Selected work", ar: "مختارات من أعمالنا" },
    title: { en: "From the workshop to the city.", ar: "من الورشة… إلى المدينة." },
    intro: {
      en: "Landmark sculptures, shade structures, screens and custom pieces from RAWASY's work gallery.",
      ar: "مجسّمات معلَمية ومظلات وسواتر وقطع خاصة من معرض أعمال رواسي.",
    },
    link: { en: "All projects", ar: "جميع المشاريع" },
    slugs: ["tulip-roundabout-sculpture", "clock-tower-landmark", "palm-leaf-shade-canopies", "geometric-lanterns"],
  },
  clients: {
    label: { en: "Clients", ar: "عملاؤنا" },
    title: { en: "Working alongside Saudi industry.", ar: "شركاء النجاح." },
    intro: {
      en: "Manufacturers, contractors and specialist fabricators that have worked with RAWASY.",
      ar: "مصانع ومقاولون وشركات تصنيع متخصصة تعاملت مع رواسي.",
    },
    link: { en: "All clients", ar: "جميع العملاء" },
  },
  compliance: {
    label: { en: "Compliance", ar: "الامتثال" },
    title: { en: "Registered. Licensed. Accountable.", ar: "مسجّلون ومرخّصون… وملتزمون." },
    intro: {
      en: "A registered Saudi company with VAT registration and a municipal commercial activity licence.",
      ar: "شركة سعودية مسجّلة في السجل التجاري وفي ضريبة القيمة المضافة، وتحمل رخصة نشاط تجاري من البلدية.",
    },
    link: { en: "Certificates & compliance", ar: "الشهادات والامتثال" },
    note: {
      en: "Numbers, QR codes and personal details are redacted in these previews.",
      ar: "أُخفيت الأرقام ورموز QR والبيانات الشخصية في هذه المعاينات.",
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
