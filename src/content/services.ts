import type { Service, ServiceSlug } from "./types";

/** Source: company profile p.3–6 ("Our Services", "Metal Section", "Scaffolding Section"). */
export const services: Service[] = [
  {
    slug: "laser-cutting",
    index: "01",
    name: { en: "Laser Cutting", ar: "القص بالليزر" },
    tagline: {
      en: "Accurate, clean cuts for complex designs and custom requirements.",
      ar: "قصّ دقيق ونظيف للتصاميم المعقّدة والطلبات الخاصة.",
    },
    summary: {
      en: "Fibre-laser cutting for sheet metal, tubes, pipes and structural profiles — from C-channels and angle bars to H- and I-beams. 360° bevel cutting handles complex shapes and multidirectional cuts.",
      ar: "قص بالليزر للصاج والمواسير والقطاعات الحديدية — من المجاري C والزوايا إلى الكمرات H وI، مع تقنية القص المائل 360° للأشكال المعقّدة والقصّات متعددة الاتجاهات.",
    },
    body: {
      en: [
        "Our laser cutting division delivers precise, versatile results across a wide range of metal applications — sheet cutting, tube and pipe cutting, C-channel, angle bar and H-beam / I-beam cutting.",
        "With 360° bevel laser cutting technology, we handle complex shapes and multidirectional cuts with exceptional precision — supporting work that demands flexibility, strength and flawless finishes, from structural components to customised fabrication.",
      ],
      ar: [
        "يقدّم قسم القص بالليزر حلولًا دقيقة ومرنة لمختلف التطبيقات المعدنية: قص الصاج، والمواسير والأنابيب، والمجاري C، والزوايا، والكمرات H وI، بدقة وكفاءة في كل مشروع.",
        "ومع تقنية القص المائل بالليزر 360°، ننفّذ الأشكال المعقّدة والقصّات متعددة الاتجاهات بدقة عالية، لنخدم المشاريع التي تتطلب مرونة وقوة وتشطيبًا متقنًا — من المكوّنات الإنشائية إلى التصنيع حسب الطلب.",
      ],
    },
    highlights: {
      en: ["Sheet metal", "Tube & pipe", "C-channel & angle bar", "H-beam / I-beam", "360° bevel cutting"],
      ar: ["قص الصاج", "المواسير والأنابيب", "المجاري C والزوايا", "الكمرات H وI", "قص مائل 360°"],
    },
    cover: "site/laser-sparks",
    coverAlt: {
      en: "Fibre-laser cutting head throwing sparks over sheet metal",
      ar: "رأس قص ليزر فايبر يتطاير منه الشرر فوق لوح صاج",
    },
    supporting: {
      media: "projects/clock-tower-1",
      alt: { en: "Clock tower with laser-cut façade panels", ar: "برج ساعة بواجهات مقصوصة بالليزر" },
    },
    // Workshop and work-gallery photos not already shown in the page's project cards.
    // `projects/canopy-tree-1` stays out until its authorship is confirmed.
    gallery: [
      {
        media: "site/laser-head",
        caption: { en: "A laser head cutting a row of openings in steel", ar: "رأس ليزر يقص صفًا من الفتحات في الحديد" },
      },
      {
        media: "projects/perforated-beams-1",
        caption: { en: "Laser-perforated steel members in the workshop", ar: "عناصر حديدية مثقّبة بالليزر في الورشة" },
      },
      {
        media: "projects/laser-cut-components-1",
        caption: {
          en: "Laser-cut profiles with patterned openings, ready for assembly",
          ar: "قطاعات مقصوصة بالليزر بفتحات مزخرفة، جاهزة للتجميع",
        },
      },
      {
        media: "projects/tree-grate-1",
        caption: { en: "A tree grate with a linear laser-cut pattern", ar: "شبكة لحماية الأشجار بنقش خطّي مقصوص بالليزر" },
      },
      {
        media: "projects/screen-enclosures-2",
        caption: { en: "A perforated screen enclosure for a service area", ar: "ساتر معدني مثقّب لمنطقة خدمات" },
      },
      {
        media: "projects/chandelier-1",
        caption: { en: "A two-tier chandelier with laser-cut detailing", ar: "ثريا بطبقتين وتفاصيل مقصوصة بالليزر" },
      },
    ],
    machines: ["tube-cutting-12kw", "fiber-laser-combo-12kw", "fiber-laser-6kw", "fiber-laser-3kw"],
    projects: ["geometric-lanterns", "perforated-canopy-screen", "clock-tower-landmark", "suspended-lantern"],
    source: { basis: "profile", pages: [3] },
  },
  {
    slug: "cnc-bending",
    index: "02",
    name: { en: "CNC Bending", ar: "الثني بتقنية CNC" },
    tagline: {
      en: "High-precision bending for sheet metal, consistent in every piece.",
      ar: "ثني عالي الدقة للصاج بنتائج ثابتة في كل قطعة.",
    },
    summary: {
      en: "CNC press-brake bending for sheet metal and structural components — accurate angles, smooth finishes and consistent results, piece after piece, with minimal material waste.",
      ar: "ثني الصاج والمكوّنات الإنشائية بمكابس CNC — زوايا دقيقة وتشطيب ناعم ونتائج متطابقة قطعة بعد قطعة، مع أقل هدر ممكن في الخامات.",
    },
    body: {
      en: [
        "Our CNC bending service delivers high-precision forming for sheet metal and structural components. Advanced CNC control ensures accurate angles, smooth finishes and consistent results across every piece.",
        "The process lets us produce complex shapes efficiently, quickly and with minimal material waste — for industrial, structural and custom fabrication needs, tailored to each project's specifications.",
      ],
      ar: [
        "نقدّم خدمة الثني بتقنية CNC للصاج والمكوّنات الإنشائية بدقة عالية، حيث يضمن التحكم الرقمي زوايا دقيقة وتشطيبًا ناعمًا ونتائج ثابتة في كل قطعة.",
        "وتتيح لنا هذه التقنية تنفيذ الأشكال المعقّدة بسرعة وكفاءة وبأقل هدر في المواد، سواء للاستخدامات الصناعية أو الإنشائية أو التصنيع حسب الطلب، وبما يتوافق مع مواصفات كل مشروع.",
      ],
    },
    highlights: {
      en: ["Accurate, repeatable angles", "Sheet & structural parts", "Complex formed profiles", "Minimal material waste"],
      ar: ["زوايا دقيقة ومتكررة", "صاج ومكوّنات إنشائية", "قطاعات مُشكّلة معقّدة", "أقل هدر في الخامات"],
    },
    cover: "services/cnc-bending-1",
    coverAlt: {
      en: "Sheet metal being formed on a CNC press brake",
      ar: "تشكيل لوح صاج على مكبس ثني CNC",
    },
    supporting: {
      media: "services/cnc-bending-2",
      alt: { en: "Formed sheet-metal parts from a CNC press brake", ar: "قطع صاج مُشكّلة على مكبس ثني CNC" },
    },
    gallery: [
      {
        media: "services/cnc-bending-2",
        caption: { en: "A perforated sheet part formed on a press brake", ar: "قطعة صاج مثقّبة تُشكَّل على مكبس الثني" },
      },
      {
        media: "services/cnc-bending-3",
        caption: { en: "A formed profile at the press-brake tooling", ar: "قطاع مُشكَّل عند أدوات مكبس الثني" },
      },
    ],
    machines: ["cnc-press-brake"],
    // The handrails project (#31) is recorded as fabrication only, so it is not linked here.
    projects: ["perforated-metal-seating"],
    source: { basis: "profile", pages: [3, 4] },
  },
  {
    slug: "steel-structures",
    index: "03",
    name: { en: "Steel Structures", ar: "الهياكل الحديدية" },
    tagline: {
      en: "Design, manufacture and assembly of steel frameworks.",
      ar: "تصميم وتصنيع وتركيب الهياكل الحديدية.",
    },
    summary: {
      en: "Durable, precision-engineered steel frameworks for industrial and commercial projects — designed, manufactured and assembled to each client's requirements, from concept to completion.",
      ar: "هياكل حديدية متينة ومصمّمة بدقة للمشاريع الصناعية والتجارية — نصمّمها ونصنّعها ونركّبها حسب متطلبات كل عميل، من الفكرة حتى التسليم.",
    },
    body: {
      en: [
        "We specialise in the design, manufacture and assembly of high-quality steel frameworks for industrial and commercial projects. Our team delivers durable, precision-engineered structures tailored to each client's requirements — with safety, efficiency and long-term performance in mind.",
        "From concept to completion, we combine modern engineering, robust materials and expert craftsmanship to bring each vision to life.",
      ],
      ar: [
        "نتخصص في تصميم وتصنيع وتركيب الهياكل الحديدية عالية الجودة للمشاريع الصناعية والتجارية. يقدّم فريقنا منشآت متينة مصمّمة بدقة وفق متطلبات كل عميل، مع مراعاة السلامة والكفاءة والأداء على المدى الطويل.",
        "ومن الفكرة إلى التسليم، نجمع بين الهندسة الحديثة والمواد القوية والحِرفية العالية لتحويل رؤيتك إلى واقع.",
      ],
    },
    highlights: {
      en: ["Design & engineering", "Manufacture", "Assembly", "Industrial & commercial frameworks"],
      ar: ["التصميم والهندسة", "التصنيع", "التركيب", "هياكل صناعية وتجارية"],
    },
    cover: "site/steel-beams-hall",
    coverAlt: {
      en: "Fabricated steel beams and columns in a steel-structure hall",
      ar: "كمرات وأعمدة حديدية مصنّعة داخل هنجر للهياكل الحديدية",
    },
    supporting: {
      media: "site/steel-frame-dusk",
      alt: { en: "Steel portal frames of a building under construction at dusk", ar: "إطارات حديدية لمبنى قيد الإنشاء وقت الغروب" },
    },
    gallery: [
      {
        media: "services/steel-structures-1",
        caption: { en: "A large steel-framed building under construction", ar: "مبنى بهيكل حديدي كبير قيد الإنشاء" },
      },
      {
        media: "services/steel-structures-2",
        caption: { en: "Welding a steel lattice at roof level", ar: "لحام شبكة حديدية على مستوى السقف" },
      },
      {
        media: "services/steel-structures-3",
        caption: { en: "Working at height on a steel truss", ar: "العمل على ارتفاع فوق جملون حديدي" },
      },
      {
        media: "services/steel-structures-4",
        caption: { en: "A building with a faceted, illuminated façade at dusk", ar: "مبنى بواجهة متعددة الأوجه مضاءة عند الغسق" },
      },
    ],
    machines: [],
    projects: ["palm-leaf-shade-canopies", "gateway-welcome-signs", "car-park-shade-structures", "curved-steel-frames"],
    source: { basis: "profile", pages: [3, 4] },
  },
  {
    slug: "fabrication",
    index: "04",
    name: { en: "Metal Fabrication", ar: "التصنيع المعدني" },
    tagline: {
      en: "Custom metalwork, from small components to large-scale structures.",
      ar: "تصنيع معدني حسب الطلب، من القطع الصغيرة إلى المنشآت الكبيرة.",
    },
    summary: {
      en: "The full spectrum of custom metalwork — cutting, welding, grinding, forming and assembly — from small precision components to complete structural fabrication, built for strength and detail.",
      ar: "كل أعمال التصنيع المعدني حسب الطلب — القص واللحام والجلخ والتشكيل والتجميع — من القطع الدقيقة الصغيرة إلى التصنيع الإنشائي المتكامل، بقوة وعناية بأدق التفاصيل.",
    },
    body: {
      en: [
        "Our fabrication services cover the full spectrum of custom metal work — from small precision components to large-scale structural projects. With advanced equipment and skilled expertise, we deliver solutions tailored to specific design and functional requirements.",
        "Whether it's welding, assembly or complete structural fabrication, we ensure strength, durability and quality in every detail — supporting industries from construction to manufacturing.",
      ],
      ar: [
        "تغطي خدمات التصنيع لدينا كل أعمال المعادن حسب الطلب، من المكوّنات الدقيقة الصغيرة إلى المشاريع الإنشائية الكبيرة. وبفضل المعدات المتقدمة والخبرة الفنية، نقدّم حلولًا تناسب المتطلبات التصميمية والوظيفية لكل مشروع.",
        "سواء كان العمل لحامًا أو تجميعًا أو تصنيعًا إنشائيًا متكاملًا، نضمن القوة والمتانة والجودة في كل تفصيل، لنخدم قطاعات تمتد من البناء إلى الصناعة.",
      ],
    },
    highlights: {
      en: ["Welding & laser welding", "Grinding & finishing", "Forming & assembly", "Structural fabrication"],
      ar: ["اللحام واللحام بالليزر", "الجلخ والتشطيب", "التشكيل والتجميع", "تصنيع إنشائي متكامل"],
    },
    cover: "services/fabrication-workshop",
    coverAlt: {
      en: "Laser-cut lanterns and a lattice tower under fabrication in the RAWASY workshop",
      ar: "فوانيس مقصوصة بالليزر وبرج شبكي أثناء التصنيع في ورشة رواسي",
    },
    supporting: {
      media: "services/fabrication-welding",
      alt: { en: "Welder joining steel parts on a workbench", ar: "لحّام يصل قطعًا حديدية على طاولة العمل" },
    },
    // Work in progress from the workshop (the welding and grinding photos appear in the page's scope cards).
    gallery: [
      {
        media: "projects/tulip-roundabout-2",
        caption: { en: "The tulip sculpture in the workshop during fabrication", ar: "مجسم التوليب في الورشة أثناء التصنيع" },
      },
      {
        media: "projects/wave-sculpture-2",
        caption: { en: "The wave-form sculpture under fabrication", ar: "مجسم الموجة أثناء التصنيع" },
      },
      {
        media: "projects/emblem-sculptures-1",
        caption: { en: "An emblem sculpture during fabrication", ar: "مجسم الشعار أثناء التصنيع" },
      },
      {
        media: "services/fabrication-perforated-beams",
        caption: { en: "Perforated steel members stacked in the workshop", ar: "عناصر حديدية مثقّبة مرصوصة في الورشة" },
      },
      {
        media: "services/fabrication-cut-sheets",
        caption: { en: "Laser-cut patterned steel sheets stacked in the workshop", ar: "ألواح حديدية بنقوش مقصوصة بالليزر مكدّسة في الورشة" },
      },
    ],
    machines: ["laser-welding"],
    projects: ["heritage-cannon-replicas", "dome-finial-and-crescent", "sculpture-fabrication", "lattice-tower-replica"],
    source: { basis: "profile", pages: [3, 5] },
  },
  {
    slug: "laser-engraving",
    index: "05",
    name: { en: "Laser Engraving", ar: "الحفر بالليزر" },
    tagline: {
      en: "Precision engraving with high accuracy and lasting quality.",
      ar: "حفر دقيق بالليزر بجودة تدوم.",
    },
    summary: {
      en: "Precise, permanent marking on metal, wood, plastics and leather — durable identification plates, crisp logos and detailed decorative work.",
      ar: "حفر دائم ودقيق على المعادن والخشب والبلاستيك والجلود — لوحات تعريفية متينة وشعارات واضحة وأعمال زخرفية بأدق التفاصيل.",
    },
    body: {
      en: [
        "Laser engraving delivers precise, permanent, high-quality results across multiple materials — metal, wood, plastics and leather.",
        "On metal it creates sharp, durable markings that resist wear; on wood, clean detailed engravings with natural contrast; on plastics, smooth accurate designs ideal for labels and logos; and on leather, crisp impressions that last.",
      ],
      ar: [
        "يمنحك الحفر بالليزر نتائج دقيقة ودائمة وعالية الجودة على خامات متعددة: المعادن والخشب والبلاستيك والجلود.",
        "على المعدن يصنع علامات حادة ومتينة تقاوم التآكل، وعلى الخشب نقوشًا نظيفة بتفاصيل وتباين طبيعي، وعلى البلاستيك تصاميم ناعمة ودقيقة مثالية للملصقات والشعارات، وعلى الجلد بصمة واضحة تدوم.",
      ],
    },
    highlights: {
      en: ["Nameplates & identification", "Logos & branding", "Decorative detail", "Metal · wood · plastics · leather"],
      ar: ["لوحات تعريفية وبيانات", "شعارات وهويات", "زخارف ونقوش", "معدن · خشب · بلاستيك · جلد"],
    },
    cover: "services/engraving-nameplates",
    coverAlt: {
      en: "Laser-engraved metal identification plates",
      ar: "لوحات تعريفية معدنية محفورة بالليزر",
    },
    supporting: {
      media: "services/engraving-wood",
      alt: { en: "Detailed laser engraving on wood", ar: "حفر دقيق بالليزر على الخشب" },
    },
    // No authentic engraving photographs yet: the wood and rotary images are renders, and the nameplates
    // photo shows third-party branding and part/serial numbers (awaiting RAWASY's confirmation).
    gallery: [],
    machines: [],
    // The calligraphic sculptures (#13) and cannon replicas (#11) are recorded as laser-cut, not engraved.
    projects: [],
    source: { basis: "profile", pages: [3, 5] },
  },
  {
    slug: "scaffolding",
    index: "06",
    name: { en: "Scaffolding", ar: "السقالات" },
    tagline: {
      en: "Safe, reliable scaffolding for construction, maintenance and repair.",
      ar: "سقالات آمنة وموثوقة لأعمال البناء والصيانة والترميم.",
    },
    summary: {
      en: "Scaffolding and formwork solutions — wood and steel props, rental, installation, dismantling and transport — supporting construction, maintenance and repair projects.",
      ar: "حلول السقالات والشدّات — الدعامات الخشبية والحديدية والتأجير والتركيب والفك والنقل — لدعم مشاريع البناء والصيانة والترميم.",
    },
    body: {
      en: [
        "RAWASY provides safe and reliable scaffolding solutions to support construction, maintenance and repair projects.",
        "Our services include formwork, wood and steel props, rental options, installation, dismantling and transport. With strong, adaptable systems and professional service, we focus on safety, efficiency and quality on every project.",
      ],
      ar: [
        "توفّر رواسي حلول سقالات آمنة وموثوقة لدعم مشاريع البناء والصيانة والترميم.",
        "وتشمل خدماتنا الشدّات، والدعامات الخشبية والحديدية، وخيارات التأجير، والتركيب والفك والنقل. وبأنظمة قوية ومرنة وخدمة احترافية، نحرص على السلامة والكفاءة والجودة في كل مشروع.",
      ],
    },
    highlights: {
      en: ["Formwork systems", "Wood & steel props", "Rental", "Installation, dismantling & transport"],
      ar: ["أنظمة الشدّات", "دعامات خشبية وحديدية", "التأجير", "التركيب والفك والنقل"],
    },
    cover: "services/scaffolding-2",
    coverAlt: {
      en: "Workers on a scaffolding system at a construction site",
      ar: "عمّال على منظومة سقالات في موقع إنشاء",
    },
    supporting: {
      media: "services/scaffolding-props",
      alt: { en: "Steel props and scaffolding components", ar: "دعامات حديدية ومكوّنات سقالات" },
    },
    // The props and trailer photos illustrate the page's scope section.
    gallery: [
      {
        media: "services/scaffolding-1",
        caption: { en: "A large scaffolding system around a structure under construction", ar: "منظومة سقالات كبيرة حول منشأة قيد الإنشاء" },
      },
      {
        media: "services/scaffolding-3",
        caption: { en: "Scaffolding filling a building site between two structures", ar: "سقالات تملأ موقع إنشاء بين منشأتين" },
      },
      {
        media: "services/scaffolding-5",
        caption: { en: "A scaffolding tower with an internal stair", ar: "برج سقالات بدرج داخلي" },
      },
      {
        media: "site/scaffold-silhouettes",
        caption: { en: "Workers on scaffolding at sunset", ar: "عمّال على السقالات وقت الغروب" },
      },
    ],
    machines: [],
    projects: [],
    source: { basis: "profile", pages: [2, 6], note: "\"New Struck(s)\" in the source is unclear and omitted." },
  },
];

export const serviceSlugs = services.map((s) => s.slug) as ServiceSlug[];

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
