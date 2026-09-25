import type { ServiceDetail, ServiceSlug } from "./types";

/**
 * Service detail pages (stage 1D). Every fact restates the company profile
 * (p.3–7) or the service and machine records; nothing is estimated. The
 * process steps are a website-level general workflow, not a certified
 * procedure, and each page says so. Sectors come from the industries records
 * (with their basis); `uses` are project types named in the profile.
 */
export const serviceDetails: Record<ServiceSlug, ServiceDetail> = {
  "laser-cutting": {
    section: "metal",
    meta: [
      { label: { en: "Laser cutting systems", ar: "أنظمة القص بالليزر" }, value: { en: "04", ar: "04" } },
      { label: { en: "Peak laser power", ar: "أعلى قدرة ليزر" }, value: { en: "12,000 W", ar: "12,000 واط" } },
      { label: { en: "Bevel cutting", ar: "القص المائل" }, value: { en: "360°", ar: "360°" } },
      { label: { en: "Cuts", ar: "نطاق القص" }, value: { en: "Sheet · Tube · Profile", ar: "صاج · مواسير · قطاعات" } },
    ],
    overview: { title: { en: "Precise cuts in sheet, tube and profile.", ar: "قصّ دقيق للصاج والمواسير والقطاعات." } },
    scope: {
      title: { en: "Sheet, tube and structural sections.", ar: "الصاج والمواسير والقطاعات الإنشائية." },
      intro: {
        en: "The forms our laser cutting division works with, as listed in our company profile.",
        ar: "الأشكال التي يعمل عليها قسم القص بالليزر كما يذكرها ملفنا التعريفي.",
      },
      items: [
        { slug: "sheet", title: { en: "Sheet metal", ar: "الصاج" } },
        { slug: "tube", title: { en: "Tube & pipe", ar: "المواسير والأنابيب" } },
        { slug: "channel", title: { en: "C-channel", ar: "المجاري C" } },
        { slug: "angle", title: { en: "Angle bar", ar: "الزوايا" } },
        { slug: "beam", title: { en: "H-beam / I-beam", ar: "الكمرات H وI" } },
        {
          slug: "bevel",
          title: { en: "360° bevel cutting", ar: "القص المائل 360°" },
          body: { en: "Complex shapes and multidirectional cuts.", ar: "للأشكال المعقّدة والقصّات متعددة الاتجاهات." },
        },
      ],
    },
    process: {
      title: { en: "From drawing to cut part.", ar: "من المخطط إلى القطعة المقصوصة." },
      intro: { en: "How a laser cutting job typically moves through the workshop.", ar: "كيف يسير عادةً عمل القص بالليزر داخل الورشة." },
      steps: [
        {
          slug: "drawing",
          title: { en: "Drawing", ar: "المخطط" },
          body: { en: "We review your drawing or file, the material and the quantities.", ar: "نراجع مخططك أو ملفك، والخامة والكميات." },
        },
        {
          slug: "setup",
          title: { en: "Setup", ar: "التجهيز" },
          body: {
            en: "The job is set up on the laser that suits it: sheet, tube or profile.",
            ar: "نجهّز العمل على الليزر المناسب له: صاج أو مواسير أو قطاعات.",
          },
        },
        {
          slug: "cut",
          title: { en: "Cutting", ar: "القص" },
          body: {
            en: "Parts are cut by laser, with bevel cuts where the design calls for them.",
            ar: "تُقصّ القطع بالليزر، مع القص المائل حيث يتطلبه التصميم.",
          },
        },
        {
          slug: "check",
          title: { en: "Checking", ar: "المطابقة" },
          body: { en: "Cut parts are checked against the drawing.", ar: "نطابق القطع المقصوصة مع المخطط." },
        },
        {
          slug: "next",
          title: { en: "Next stage", ar: "المرحلة التالية" },
          body: { en: "Parts move on to bending, fabrication or delivery.", ar: "تنتقل القطع إلى الثني أو التصنيع أو التسليم." },
        },
      ],
    },
    machines: {
      title: { en: "Four laser machines.", ar: "أربع ماكينات ليزر." },
      intro: {
        en: "The laser cutting machines listed in our company profile, with the rated power it gives for each.",
        ar: "ماكينات القص بالليزر المذكورة في ملفنا التعريفي، مع القدرة المقننة لكل منها.",
      },
    },
    applications: {
      title: { en: "Where laser-cut work is used.", ar: "أين تُستخدم أعمال القص بالليزر." },
      intro: {
        en: "Sectors named in our company profile, and website classifications drawn from our work gallery.",
        ar: "قطاعات مذكورة في ملفنا التعريفي، وتصنيفات للموقع مستمدة من معرض أعمالنا.",
      },
      uses: [
        { en: "Structural components", ar: "المكوّنات الإنشائية" },
        { en: "Custom fabrication", ar: "التصنيع حسب الطلب" },
      ],
    },
    gallery: {
      title: { en: "Laser-cut work.", ar: "أعمال مقصوصة بالليزر." },
      intro: { en: "From the workshop and our work gallery.", ar: "من الورشة ومن معرض أعمالنا." },
    },
    why: {
      title: { en: "Why RAWASY for laser cutting.", ar: "لماذا رواسي للقص بالليزر." },
      points: [
        {
          slug: "power",
          title: { en: "Up to 12,000 W", ar: "حتى 12,000 واط" },
          body: { en: "Four laser machines, rated from 3,000 to 12,000 W.", ar: "أربع ماكينات ليزر بقدرات من 3,000 إلى 12,000 واط." },
        },
        {
          slug: "bevel",
          title: { en: "360° bevel cutting", ar: "قص مائل 360°" },
          body: { en: "Complex shapes and multidirectional cuts.", ar: "أشكال معقّدة وقصّات متعددة الاتجاهات." },
        },
        {
          slug: "range",
          title: { en: "Sheet to structural sections", ar: "من الصاج إلى القطاعات" },
          body: {
            en: "Sheet, tube and pipe, C-channel, angle bar, and H- and I-beams.",
            ar: "الصاج والمواسير والأنابيب والمجاري C والزوايا والكمرات H وI.",
          },
        },
        {
          slug: "next",
          title: { en: "Ready for the next stage", ar: "جاهزة للمرحلة التالية" },
          body: {
            en: "Cut parts can move straight on to bending, fabrication or engraving.",
            ar: "يمكن أن تنتقل القطع المقصوصة مباشرة إلى الثني أو التصنيع أو الحفر.",
          },
        },
      ],
    },
    related: ["cnc-bending", "fabrication", "laser-engraving"],
    projects: {
      title: { en: "Laser-cut projects.", ar: "مشاريع القص بالليزر." },
      intro: {
        en: "Selected work from our gallery where laser cutting plays a part.",
        ar: "أعمال مختارة من معرضنا يدخل فيها القص بالليزر.",
      },
    },
    cta: {
      label: { en: "Laser cutting quote", ar: "عرض سعر للقص بالليزر" },
      title: { en: "Send us your drawing.", ar: "أرسل لنا مخططك." },
      body: {
        en: "Share the file, the material and the quantities, and we'll reply with a quotation.",
        ar: "شاركنا الملف والخامة والكميات، وسنرد عليك بعرض سعر.",
      },
    },
  },

  "cnc-bending": {
    section: "metal",
    meta: [
      { label: { en: "Machine", ar: "الماكينة" }, value: { en: "CNC press brake", ar: "مكبس ثني CNC" } },
      { label: { en: "Forms", ar: "نطاق التشكيل" }, value: { en: "Sheet & structural parts", ar: "الصاج والمكوّنات الإنشائية" } },
      { label: { en: "Results", ar: "النتائج" }, value: { en: "Accurate angles, consistent pieces", ar: "زوايا دقيقة وقطع متطابقة" } },
    ],
    overview: { title: { en: "Accurate angles, piece after piece.", ar: "زوايا دقيقة… قطعة بعد قطعة." } },
    scope: {
      title: { en: "What we form.", ar: "ما نشكّله." },
      intro: {
        en: "High-precision forming for industrial, structural and custom fabrication needs.",
        ar: "تشكيل عالي الدقة للاحتياجات الصناعية والإنشائية والتصنيع حسب الطلب.",
      },
      items: [
        {
          slug: "sheet",
          title: { en: "Sheet metal", ar: "ألواح الصاج" },
          body: { en: "Bends with accurate angles and smooth finishes.", ar: "ثني بزوايا دقيقة وتشطيب ناعم." },
        },
        {
          slug: "structural",
          title: { en: "Structural components", ar: "المكوّنات الإنشائية" },
          body: { en: "Formed parts for structural work.", ar: "قطع مُشكَّلة للأعمال الإنشائية." },
        },
        {
          slug: "complex",
          title: { en: "Complex shapes", ar: "الأشكال المعقّدة" },
          body: { en: "Produced efficiently and quickly.", ar: "تُنفَّذ بكفاءة وسرعة." },
        },
        {
          slug: "repeat",
          title: { en: "Repeat pieces", ar: "القطع المتكررة" },
          body: {
            en: "Consistent across every piece, with minimal material waste.",
            ar: "نتائج ثابتة في كل قطعة، وبأقل هدر في الخامات.",
          },
        },
      ],
    },
    process: {
      title: { en: "From flat part to formed profile.", ar: "من القطعة المسطحة إلى القطاع المُشكَّل." },
      intro: { en: "How a bending job typically moves through the workshop.", ar: "كيف يسير عادةً عمل الثني داخل الورشة." },
      steps: [
        {
          slug: "drawing",
          title: { en: "Drawing", ar: "المخطط" },
          body: { en: "We review the drawing, the material and the bends it needs.", ar: "نراجع المخطط والخامة والثنيات المطلوبة." },
        },
        {
          slug: "setup",
          title: { en: "Setup", ar: "التجهيز" },
          body: { en: "The press brake is programmed and tooled for the part.", ar: "نبرمج مكبس الثني ونجهّز أدواته للقطعة." },
        },
        {
          slug: "bend",
          title: { en: "Bending", ar: "الثني" },
          body: { en: "Each bend is formed under CNC control.", ar: "تُشكَّل كل ثنية بتحكم رقمي CNC." },
        },
        {
          slug: "check",
          title: { en: "Checking", ar: "المطابقة" },
          body: { en: "Angles and dimensions are checked against the drawing.", ar: "نطابق الزوايا والأبعاد مع المخطط." },
        },
        {
          slug: "next",
          title: { en: "Next stage", ar: "المرحلة التالية" },
          body: {
            en: "Formed parts move on to fabrication, assembly or delivery.",
            ar: "تنتقل القطع المُشكَّلة إلى التصنيع أو التجميع أو التسليم.",
          },
        },
      ],
    },
    machines: {
      title: { en: "The press brake.", ar: "مكبس الثني." },
      intro: { en: "The CNC press brake listed in our company profile.", ar: "مكبس الثني CNC المذكور في ملفنا التعريفي." },
    },
    applications: {
      title: { en: "Where formed parts are used.", ar: "أين تُستخدم القطع المُشكَّلة." },
      intro: {
        en: "Uses and sectors named in our company profile, and categories from our work gallery.",
        ar: "استخدامات وقطاعات مذكورة في ملفنا التعريفي، وتصنيفات من معرض أعمالنا.",
      },
      uses: [
        { en: "Industrial work", ar: "الأعمال الصناعية" },
        { en: "Structural work", ar: "الأعمال الإنشائية" },
        { en: "Custom fabrication", ar: "التصنيع حسب الطلب" },
      ],
    },
    gallery: {
      title: { en: "At the press brake.", ar: "عند مكبس الثني." },
      intro: { en: "Images from our company profile.", ar: "صور من ملفنا التعريفي." },
    },
    why: {
      title: { en: "Why RAWASY for CNC bending.", ar: "لماذا رواسي للثني بتقنية CNC." },
      points: [
        {
          slug: "control",
          title: { en: "CNC control", ar: "تحكم رقمي CNC" },
          body: { en: "Accurate angles, smooth finishes and consistent results.", ar: "زوايا دقيقة وتشطيب ناعم ونتائج ثابتة." },
        },
        {
          slug: "shapes",
          title: { en: "Complex shapes", ar: "أشكال معقّدة" },
          body: { en: "Formed efficiently and quickly.", ar: "تُنفَّذ بكفاءة وسرعة." },
        },
        {
          slug: "waste",
          title: { en: "Minimal waste", ar: "أقل هدر" },
          body: { en: "Forming with minimal material waste.", ar: "تشكيل بأقل هدر في الخامات." },
        },
        {
          slug: "next",
          title: { en: "Cut, then bend", ar: "القص ثم الثني" },
          body: {
            en: "Laser-cut parts can go straight to the press brake.",
            ar: "يمكن أن تنتقل القطع المقصوصة بالليزر مباشرة إلى مكبس الثني.",
          },
        },
      ],
    },
    related: ["laser-cutting", "fabrication", "steel-structures"],
    projects: {
      title: { en: "Formed work.", ar: "أعمال مُشكَّلة." },
      intro: { en: "Work from our gallery where CNC bending plays a part.", ar: "أعمال من معرضنا يدخل فيها الثني بتقنية CNC." },
    },
    cta: {
      label: { en: "CNC bending quote", ar: "عرض سعر للثني" },
      title: { en: "Discuss your formed parts.", ar: "ناقش معنا قطعك المُشكَّلة." },
      body: {
        en: "Send the drawing, the material and the quantities, and we'll reply with a quotation.",
        ar: "أرسل المخطط والخامة والكميات، وسنرد عليك بعرض سعر.",
      },
    },
  },

  "steel-structures": {
    section: "metal",
    meta: [
      { label: { en: "Scope", ar: "النطاق" }, value: { en: "Design · Manufacture · Assembly", ar: "التصميم · التصنيع · التركيب" } },
      { label: { en: "Projects", ar: "المشاريع" }, value: { en: "Industrial & commercial", ar: "صناعية وتجارية" } },
      { label: { en: "Delivery", ar: "التنفيذ" }, value: { en: "Concept to completion", ar: "من الفكرة حتى التسليم" } },
    ],
    overview: {
      title: { en: "Frameworks built for the long term.", ar: "هياكل تُبنى للمدى الطويل." },
      media: {
        media: "site/steel-frame-dusk",
        caption: {
          en: "Steel portal frames of a building under construction at dusk",
          ar: "إطارات حديدية لمبنى قيد الإنشاء وقت الغروب",
        },
      },
    },
    scope: {
      title: { en: "Design, manufacture, assembly.", ar: "تصميم وتصنيع وتركيب." },
      intro: {
        en: "We design, manufacture and assemble steel frameworks to each client's requirements.",
        ar: "نصمّم الهياكل الحديدية ونصنّعها ونركّبها وفق متطلبات كل عميل.",
      },
      items: [
        {
          slug: "design",
          title: { en: "Design & engineering", ar: "التصميم والهندسة" },
          body: {
            en: "Frameworks tailored to the client's requirements, with safety, efficiency and long-term performance in mind.",
            ar: "هياكل مصمّمة وفق متطلبات العميل، مع مراعاة السلامة والكفاءة والأداء على المدى الطويل.",
          },
        },
        {
          slug: "manufacture",
          title: { en: "Manufacture", ar: "التصنيع" },
          body: {
            en: "Precision-engineered steel, made with robust materials and skilled craftsmanship.",
            ar: "هياكل مصنّعة بدقة هندسية، بمواد قوية وحِرفية عالية.",
          },
        },
        {
          slug: "assembly",
          title: { en: "Assembly", ar: "التركيب" },
          body: {
            en: "Frameworks assembled for industrial and commercial projects.",
            ar: "تركيب الهياكل للمشاريع الصناعية والتجارية.",
          },
        },
      ],
    },
    process: {
      title: { en: "How a structure comes together.", ar: "كيف يتكامل الهيكل." },
      intro: {
        en: "The typical stages of a steel structure, from requirements to handover.",
        ar: "المراحل المعتادة للهيكل الحديدي، من المتطلبات حتى التسليم.",
      },
      steps: [
        {
          slug: "requirements",
          title: { en: "Requirements", ar: "المتطلبات" },
          body: { en: "We start from your requirements and drawings.", ar: "نبدأ من متطلباتك ومخططاتك." },
        },
        {
          slug: "design",
          title: { en: "Design", ar: "التصميم" },
          body: { en: "The framework is designed and detailed for manufacture.", ar: "نصمّم الهيكل ونُعدّ تفاصيله للتصنيع." },
        },
        {
          slug: "manufacture",
          title: { en: "Manufacture", ar: "التصنيع" },
          body: { en: "Members are cut, formed and welded in the workshop.", ar: "تُقصّ العناصر وتُشكَّل وتُلحم في الورشة." },
        },
        {
          slug: "assembly",
          title: { en: "Assembly", ar: "التركيب" },
          body: {
            en: "The structure is assembled, on site where that is part of the scope.",
            ar: "يُركَّب الهيكل، وفي الموقع متى كان ذلك ضمن نطاق العمل.",
          },
        },
        {
          slug: "handover",
          title: { en: "Handover", ar: "التسليم" },
          body: { en: "The completed framework is handed over.", ar: "نسلّم الهيكل مكتملًا." },
        },
      ],
    },
    applications: {
      title: { en: "Where our structures are used.", ar: "أين تُستخدم هياكلنا." },
      intro: {
        en: "Sectors named in our company profile, and website classifications drawn from our work gallery.",
        ar: "قطاعات مذكورة في ملفنا التعريفي، وتصنيفات للموقع مستمدة من معرض أعمالنا.",
      },
    },
    gallery: {
      title: { en: "Steel frameworks.", ar: "هياكل حديدية." },
      intro: { en: "Images from our company profile.", ar: "صور من ملفنا التعريفي." },
    },
    why: {
      title: { en: "Why RAWASY for steel structures.", ar: "لماذا رواسي للهياكل الحديدية." },
      points: [
        {
          slug: "concept",
          title: { en: "Concept to completion", ar: "من الفكرة حتى التسليم" },
          body: { en: "Design, manufacture and assembly from one partner.", ar: "التصميم والتصنيع والتركيب لدى شريك واحد." },
        },
        {
          slug: "durable",
          title: { en: "Built for the long term", ar: "متانة على المدى الطويل" },
          body: {
            en: "Durable frameworks, designed with safety, efficiency and long-term performance in mind.",
            ar: "هياكل متينة مصمّمة مع مراعاة السلامة والكفاءة والأداء على المدى الطويل.",
          },
        },
        {
          slug: "craft",
          title: { en: "Engineering and craft", ar: "الهندسة والحِرفية" },
          body: { en: "Modern engineering, robust materials and expert craftsmanship.", ar: "هندسة حديثة ومواد قوية وحِرفية عالية." },
        },
        {
          slug: "site",
          title: { en: "Site support alongside", ar: "دعم ميداني إلى جانبها" },
          body: {
            en: "Our scaffolding section supports construction work on site.",
            ar: "يدعم قسم السقالات لدينا أعمال البناء في الموقع.",
          },
        },
      ],
    },
    related: ["fabrication", "cnc-bending", "scaffolding"],
    projects: {
      title: { en: "Structural work.", ar: "أعمال إنشائية." },
      intro: {
        en: "Shade structures, gateways and frames from our work gallery.",
        ar: "مظلات وبوابات وهياكل من معرض أعمالنا.",
      },
    },
    cta: {
      label: { en: "Steel structures quote", ar: "عرض سعر للهياكل الحديدية" },
      title: { en: "Request a project quote.", ar: "اطلب عرض سعر لمشروعك." },
      body: {
        en: "Tell us about the structure, the location and the timeline, and we'll reply with a quotation.",
        ar: "أخبرنا عن الهيكل والموقع والمدة الزمنية، وسنرد عليك بعرض سعر.",
      },
    },
  },

  fabrication: {
    section: "metal",
    meta: [
      { label: { en: "Scale", ar: "الحجم" }, value: { en: "Small parts to large structures", ar: "من القطع الصغيرة إلى المنشآت الكبيرة" } },
      { label: { en: "Work", ar: "الأعمال" }, value: { en: "Cut · Weld · Grind · Assemble", ar: "قص · لحام · جلخ · تجميع" } },
      { label: { en: "Equipment", ar: "المعدات" }, value: { en: "Laser welding", ar: "اللحام بالليزر" } },
    ],
    heroDetail: {
      media: "site/welder-sparks",
      caption: { en: "A welder at work, with sparks flying", ar: "لحّام أثناء العمل وسط تطاير الشرر" },
    },
    overview: { title: { en: "Custom metalwork, strong in every detail.", ar: "أعمال معدنية حسب الطلب… متينة في كل تفصيل." } },
    scope: {
      title: { en: "The work of the workshop.", ar: "أعمال الورشة." },
      intro: {
        en: "Cutting, welding, grinding, forming and assembly, from single pieces to complete structural fabrication.",
        ar: "القص واللحام والجلخ والتشكيل والتجميع، من القطعة الواحدة إلى التصنيع الإنشائي المتكامل.",
      },
      items: [
        {
          slug: "welding",
          title: { en: "Welding", ar: "اللحام" },
          body: { en: "Joints made for strength and durability.", ar: "وصلات تحقق القوة والمتانة." },
          media: {
            media: "services/fabrication-welding",
            caption: { en: "A welder joining steel parts on a workbench", ar: "لحّام يصل قطعًا حديدية على طاولة العمل" },
          },
        },
        {
          slug: "laser-welding",
          title: { en: "Laser welding", ar: "اللحام بالليزر" },
          body: { en: "Handheld laser welding for clean, precise joints.", ar: "لحام يدوي بالليزر لوصلات نظيفة ودقيقة." },
          media: {
            media: "services/fabrication-laser-welding",
            caption: { en: "Handheld laser welding", ar: "لحام يدوي بالليزر" },
          },
        },
        {
          slug: "grinding",
          title: { en: "Grinding & finishing", ar: "الجلخ والتشطيب" },
          body: { en: "Parts ground and finished with care.", ar: "جلخ القطع وتشطيبها بعناية." },
          media: {
            media: "services/fabrication-grinding",
            caption: { en: "Grinding a steel part", ar: "جلخ قطعة حديدية" },
          },
        },
        {
          slug: "assembly",
          title: { en: "Assembly & structural fabrication", ar: "التجميع والتصنيع الإنشائي" },
          body: {
            en: "From assembled pieces to complete structural fabrication.",
            ar: "من تجميع القطع إلى التصنيع الإنشائي المتكامل.",
          },
          media: {
            media: "projects/curved-frames-1",
            caption: {
              en: "Curved, welded steel frames with lattice bracing in the workshop",
              ar: "إطارات حديدية مقوّسة ملحومة بتدعيم شبكي في الورشة",
            },
          },
        },
      ],
    },
    process: {
      title: { en: "Understand, prepare, fabricate.", ar: "نفهم ونجهّز ثم نصنّع." },
      intro: { en: "The typical stages of a fabrication job.", ar: "المراحل المعتادة لأعمال التصنيع." },
      steps: [
        {
          slug: "understand",
          title: { en: "Understand", ar: "الفهم" },
          body: { en: "We study the design and the functional requirements.", ar: "ندرس التصميم والمتطلبات الوظيفية." },
        },
        {
          slug: "prepare",
          title: { en: "Prepare", ar: "التجهيز" },
          body: { en: "Material is cut and formed ready for fabrication.", ar: "تُقصّ الخامات وتُشكَّل استعدادًا للتصنيع." },
        },
        {
          slug: "fabricate",
          title: { en: "Fabricate", ar: "التصنيع" },
          body: { en: "Parts are welded, ground and finished.", ar: "تُلحم القطع وتُجلخ وتُشطَّب." },
        },
        {
          slug: "assemble",
          title: { en: "Assemble", ar: "التجميع" },
          body: { en: "Components are assembled into the finished piece.", ar: "تُجمَّع المكوّنات لتكتمل القطعة." },
        },
        {
          slug: "inspect",
          title: { en: "Inspect", ar: "الفحص" },
          body: { en: "The work is checked for fit and finish.", ar: "نفحص العمل من حيث المطابقة والتشطيب." },
        },
        {
          slug: "deliver",
          title: { en: "Deliver", ar: "التسليم" },
          body: { en: "Finished work is prepared for delivery.", ar: "نجهّز العمل المكتمل للتسليم." },
        },
      ],
    },
    machines: {
      title: { en: "Laser welding.", ar: "اللحام بالليزر." },
      intro: { en: "The laser welding machine listed in our company profile.", ar: "ماكينة اللحام بالليزر المذكورة في ملفنا التعريفي." },
    },
    applications: {
      title: { en: "From construction to manufacturing.", ar: "من البناء إلى الصناعة." },
      intro: {
        en: "Sectors named in our company profile, and website classifications drawn from our work gallery.",
        ar: "قطاعات مذكورة في ملفنا التعريفي، وتصنيفات للموقع مستمدة من معرض أعمالنا.",
      },
    },
    gallery: {
      title: { en: "On the workshop floor.", ar: "من أرضية الورشة." },
      intro: {
        en: "Work in progress, from our company profile and work gallery.",
        ar: "أعمال قيد التنفيذ، من ملفنا التعريفي ومعرض أعمالنا.",
      },
    },
    why: {
      title: { en: "Why RAWASY for fabrication.", ar: "لماذا رواسي للتصنيع المعدني." },
      points: [
        {
          slug: "scale",
          title: { en: "Any scale", ar: "بمختلف الأحجام" },
          body: {
            en: "From small precision components to large-scale structural projects.",
            ar: "من المكوّنات الدقيقة الصغيرة إلى المشاريع الإنشائية الكبيرة.",
          },
        },
        {
          slug: "laser-welding",
          title: { en: "Laser welding", ar: "اللحام بالليزر" },
          body: { en: "Handheld laser welding for clean, precise joints.", ar: "لحام يدوي بالليزر لوصلات نظيفة ودقيقة." },
        },
        {
          slug: "strength",
          title: { en: "Strength and detail", ar: "القوة والتفاصيل" },
          body: { en: "Strength, durability and quality in every detail.", ar: "القوة والمتانة والجودة في كل تفصيل." },
        },
        {
          slug: "custom",
          title: { en: "Made to your requirements", ar: "حسب متطلباتك" },
          body: {
            en: "Solutions tailored to specific design and functional requirements.",
            ar: "حلول تناسب المتطلبات التصميمية والوظيفية لكل مشروع.",
          },
        },
      ],
    },
    related: ["laser-cutting", "cnc-bending", "steel-structures"],
    projects: {
      title: { en: "Fabricated pieces.", ar: "قطع من تصنيعنا." },
      intro: {
        en: "Replicas, sculptures and custom pieces from our work gallery.",
        ar: "مجسمات ومنحوتات وقطع خاصة من معرض أعمالنا.",
      },
    },
    cta: {
      label: { en: "Fabrication quote", ar: "عرض سعر للتصنيع" },
      title: { en: "Discuss your fabrication requirement.", ar: "ناقش معنا متطلبات التصنيع." },
      body: {
        en: "Share drawings, sketches or a short brief, and we'll reply with a quotation.",
        ar: "شاركنا مخططات أو رسومات أو وصفًا مختصرًا، وسنرد عليك بعرض سعر.",
      },
    },
  },

  "laser-engraving": {
    section: "metal",
    meta: [
      { label: { en: "Materials", ar: "الخامات" }, value: { en: "Metal · Wood · Plastics · Leather", ar: "معدن · خشب · بلاستيك · جلد" } },
      { label: { en: "Work", ar: "الأعمال" }, value: { en: "Plates · Logos · Decorative detail", ar: "لوحات · شعارات · زخارف" } },
      { label: { en: "Result", ar: "النتيجة" }, value: { en: "Permanent, precise marking", ar: "حفر دائم ودقيق" } },
    ],
    overview: { title: { en: "Permanent marks, precise detail.", ar: "علامات دائمة… وتفاصيل دقيقة." } },
    scope: {
      title: { en: "Four materials, one precise process.", ar: "أربع خامات… بدقة واحدة." },
      intro: {
        en: "Precise, permanent, high-quality results on metal, wood, plastics and leather.",
        ar: "نتائج دقيقة ودائمة وعالية الجودة على المعادن والخشب والبلاستيك والجلود.",
      },
      items: [
        {
          slug: "metal",
          title: { en: "Metal", ar: "المعادن" },
          body: { en: "Sharp, durable markings that resist wear.", ar: "علامات حادة ومتينة تقاوم التآكل." },
        },
        {
          slug: "wood",
          title: { en: "Wood", ar: "الخشب" },
          body: { en: "Clean, detailed engravings with natural contrast.", ar: "نقوش نظيفة بتفاصيل دقيقة وتباين طبيعي." },
        },
        {
          slug: "plastics",
          title: { en: "Plastics", ar: "البلاستيك" },
          body: { en: "Smooth, accurate designs, ideal for labels and logos.", ar: "تصاميم ناعمة ودقيقة، مثالية للملصقات والشعارات." },
        },
        {
          slug: "leather",
          title: { en: "Leather", ar: "الجلود" },
          body: { en: "Crisp impressions that last.", ar: "بصمة واضحة تدوم." },
        },
      ],
    },
    process: {
      title: { en: "From artwork to engraved piece.", ar: "من التصميم إلى القطعة المحفورة." },
      intro: { en: "How an engraving job typically runs.", ar: "كيف يسير عادةً عمل الحفر بالليزر." },
      steps: [
        {
          slug: "artwork",
          title: { en: "Artwork", ar: "التصميم" },
          body: { en: "We review your artwork or text, the material and the quantities.", ar: "نراجع التصميم أو النص، والخامة والكميات." },
        },
        {
          slug: "setup",
          title: { en: "Setup", ar: "التجهيز" },
          body: { en: "The design is prepared for the material it will be engraved on.", ar: "نجهّز التصميم وفق الخامة التي سيُحفر عليها." },
        },
        {
          slug: "engrave",
          title: { en: "Engraving", ar: "الحفر" },
          body: { en: "The laser engraves the design into the surface.", ar: "يحفر الليزر التصميم على سطح الخامة." },
        },
        {
          slug: "check",
          title: { en: "Checking", ar: "المطابقة" },
          body: { en: "Each piece is checked against the artwork.", ar: "نطابق كل قطعة مع التصميم." },
        },
        {
          slug: "deliver",
          title: { en: "Delivery", ar: "التسليم" },
          body: { en: "Finished pieces are prepared for delivery.", ar: "نجهّز القطع المنتهية للتسليم." },
        },
      ],
    },
    applications: {
      title: { en: "What engraving is used for.", ar: "استخدامات الحفر بالليزر." },
      intro: { en: "Uses named in our company profile.", ar: "استخدامات مذكورة في ملفنا التعريفي." },
      uses: [
        { en: "Identification plates", ar: "لوحات تعريفية" },
        { en: "Logos & labels", ar: "شعارات وملصقات" },
        { en: "Decorative detail", ar: "زخارف وتفاصيل دقيقة" },
      ],
    },
    why: {
      title: { en: "Why RAWASY for engraving.", ar: "لماذا رواسي للحفر بالليزر." },
      points: [
        {
          slug: "materials",
          title: { en: "Four materials", ar: "أربع خامات" },
          body: { en: "Metal, wood, plastics and leather.", ar: "المعادن والخشب والبلاستيك والجلود." },
        },
        {
          slug: "lasting",
          title: { en: "Made to last", ar: "نتيجة تدوم" },
          body: { en: "Permanent marks, and on metal, markings that resist wear.", ar: "علامات دائمة، ونقوش تقاوم التآكل على المعادن." },
        },
        {
          slug: "detail",
          title: { en: "Fine detail", ar: "تفاصيل دقيقة" },
          body: { en: "Crisp logos and detailed decorative work.", ar: "شعارات واضحة وأعمال زخرفية بأدق التفاصيل." },
        },
      ],
    },
    related: ["laser-cutting", "fabrication"],
    cta: {
      label: { en: "Engraving quote", ar: "عرض سعر للحفر" },
      title: { en: "Send us your artwork.", ar: "أرسل لنا تصميمك." },
      body: {
        en: "Share the artwork, the material and the quantities, and we'll reply with a quotation.",
        ar: "شاركنا التصميم والخامة والكميات، وسنرد عليك بعرض سعر.",
      },
    },
  },

  scaffolding: {
    section: "scaffolding",
    meta: [
      { label: { en: "Systems", ar: "الأنظمة" }, value: { en: "Formwork · Wood & steel props", ar: "الشدّات · الدعامات الخشبية والحديدية" } },
      { label: { en: "Service", ar: "الخدمة" }, value: { en: "Rental · Installation · Transport", ar: "التأجير · التركيب · النقل" } },
      { label: { en: "Supports", ar: "مجالات الخدمة" }, value: { en: "Construction · Maintenance · Repair", ar: "البناء · الصيانة · الترميم" } },
    ],
    overview: { title: { en: "Safe, reliable support on site.", ar: "دعم آمن وموثوق في موقع العمل." } },
    scope: {
      title: { en: "Scaffolding, formwork and props.", ar: "السقالات والشدّات والدعامات." },
      intro: {
        en: "Our services include formwork, wood and steel props, rental options, installation, dismantling and transport.",
        ar: "تشمل خدماتنا الشدّات، والدعامات الخشبية والحديدية، وخيارات التأجير، والتركيب والفك والنقل.",
      },
      items: [
        { slug: "formwork", title: { en: "Formwork systems", ar: "أنظمة الشدّات" } },
        { slug: "props", title: { en: "Wood & steel props", ar: "الدعامات الخشبية والحديدية" } },
        { slug: "rental", title: { en: "Rental services", ar: "خدمات التأجير" } },
        { slug: "installation", title: { en: "Installation & dismantling", ar: "التركيب والفك" } },
        { slug: "transport", title: { en: "Transportation", ar: "النقل" } },
      ],
      media: [
        {
          media: "services/scaffolding-4",
          caption: { en: "Scaffolding components loaded on a flatbed trailer", ar: "مكوّنات سقالات محمّلة على مقطورة مسطحة" },
        },
        {
          media: "services/scaffolding-props",
          caption: { en: "Steel props and scaffolding components", ar: "دعامات حديدية ومكوّنات سقالات" },
        },
      ],
    },
    process: {
      title: { en: "Delivered, installed, taken down.", ar: "نقل وتركيب ثم فك." },
      intro: {
        en: "The typical cycle of a scaffolding job, from planning to dismantling.",
        ar: "الدورة المعتادة لأعمال السقالات، من التخطيط حتى الفك.",
      },
      steps: [
        {
          slug: "plan",
          title: { en: "Planning", ar: "التخطيط" },
          body: { en: "We look at the site, the work and how long it will run.", ar: "ندرس الموقع وطبيعة العمل ومدته." },
        },
        {
          slug: "transport",
          title: { en: "Transport", ar: "النقل" },
          body: { en: "Scaffolding and props are delivered to site.", ar: "ننقل السقالات والدعامات إلى الموقع." },
        },
        {
          slug: "install",
          title: { en: "Installation", ar: "التركيب" },
          body: { en: "The system is installed for the work ahead.", ar: "نركّب المنظومة بما يناسب الأعمال المطلوبة." },
        },
        {
          slug: "use",
          title: { en: "In use", ar: "الاستخدام" },
          body: { en: "The scaffolding supports the work, on rental where agreed.", ar: "تدعم السقالات سير العمل، بنظام التأجير عند الاتفاق." },
        },
        {
          slug: "dismantle",
          title: { en: "Dismantling", ar: "الفك" },
          body: { en: "When the work is done, it is dismantled and taken away.", ar: "عند انتهاء العمل نفكّها وننقلها من الموقع." },
        },
      ],
    },
    applications: {
      title: { en: "Support for construction, maintenance and repair.", ar: "دعم لأعمال البناء والصيانة والترميم." },
      intro: {
        en: "The project types and sectors named in our company profile.",
        ar: "أنواع المشاريع والقطاعات المذكورة في ملفنا التعريفي.",
      },
      uses: [
        { en: "Construction projects", ar: "مشاريع البناء" },
        { en: "Maintenance", ar: "الصيانة" },
        { en: "Repair", ar: "الترميم" },
      ],
    },
    gallery: {
      title: { en: "Scaffolding on site.", ar: "السقالات في المواقع." },
      intro: { en: "Images from our company profile.", ar: "صور من ملفنا التعريفي." },
    },
    why: {
      title: { en: "Why RAWASY for scaffolding.", ar: "لماذا رواسي للسقالات." },
      points: [
        {
          slug: "safety",
          title: { en: "Safety first", ar: "السلامة أولًا" },
          body: {
            en: "Safe, reliable scaffolding, with a focus on safety, efficiency and quality.",
            ar: "سقالات آمنة وموثوقة، مع تركيز على السلامة والكفاءة والجودة.",
          },
        },
        {
          slug: "systems",
          title: { en: "Strong, adaptable systems", ar: "أنظمة قوية ومرنة" },
          body: { en: "Scaffolding, formwork, and wood and steel props.", ar: "سقالات وشدّات ودعامات خشبية وحديدية." },
        },
        {
          slug: "service",
          title: { en: "A complete service", ar: "خدمة متكاملة" },
          body: { en: "Rental, installation, dismantling and transport.", ar: "التأجير والتركيب والفك والنقل." },
        },
        {
          slug: "metal",
          title: { en: "Backed by a metal section", ar: "يساندها قسم للمعادن" },
          body: {
            en: "Our metal section covers cutting, bending, fabrication and steel structures.",
            ar: "يغطي قسم المعادن لدينا القص والثني والتصنيع والهياكل الحديدية.",
          },
        },
      ],
    },
    related: ["steel-structures", "fabrication"],
    cta: {
      label: { en: "Scaffolding quote", ar: "عرض سعر للسقالات" },
      title: { en: "Plan your site support.", ar: "خطّط لدعم موقعك." },
      body: {
        en: "Tell us about the site, the work and how long you need the scaffolding, and we'll reply with a quotation.",
        ar: "أخبرنا عن الموقع وطبيعة العمل والمدة التي تحتاج فيها السقالات، وسنرد عليك بعرض سعر.",
      },
    },
  },
};
