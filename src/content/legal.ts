import type { LegalChrome, LegalDocument } from "./types";

/**
 * Privacy policy and website terms. Written for the website as it is built
 * today (no analytics, no form backend). Points that need RAWASY or legal
 * confirmation carry a `pending` note, which is shown on the page until it is
 * resolved. No compliance frameworks, data locations, retention periods or
 * governing-law clauses are asserted.
 */
export const legalChrome: LegalChrome = {
  updated: { en: "Last updated", ar: "آخر تحديث" },
  appliesTo: { en: "Applies to", ar: "ينطبق على" },
  appliesToValue: { en: "This website, in English and Arabic", ar: "هذا الموقع بنسختيه العربية والإنجليزية" },
  onThisPage: { en: "On this page", ar: "في هذه الصفحة" },
  pending: { en: "Pending confirmation", ar: "بانتظار التأكيد" },
  contactLabels: {
    email: { en: "Email", ar: "البريد الإلكتروني" },
    phone: { en: "Phone", ar: "الهاتف" },
    address: { en: "Address", ar: "العنوان" },
  },
};

export const privacyPolicy: LegalDocument = {
  slug: "privacy",
  hero: {
    eyebrow: { en: "Legal", ar: "قانوني" },
    title: { en: "Privacy Policy", ar: "سياسة الخصوصية" },
    intro: {
      en: "How RAWASY handles the information you share with us through this website.",
      ar: "كيف تتعامل رواسي مع المعلومات التي تشاركها معنا عبر هذا الموقع.",
    },
  },
  updated: "2026-09-24",
  sections: [
    {
      id: "who-we-are",
      title: { en: "Who we are", ar: "من نحن" },
      body: {
        en: [
          "This website is operated by RAWASY UNITED INTERNATIONAL CO. LTD., Al Mashael, Sulay, Riyadh 14325, Saudi Arabia. In this policy, “RAWASY”, “we” and “us” refer to the company.",
          "This policy explains what information you may share with us through the website, and how we handle it.",
        ],
        ar: [
          "تدير هذا الموقع شركة رواسي المتحدة العالمية المحدودة، حي المشاعل، السلي، الرياض 14325، المملكة العربية السعودية. ويُقصد بـ«رواسي» أو «نحن» في هذه السياسة الشركةُ نفسها.",
          "توضّح هذه السياسة المعلومات التي قد تشاركها معنا عبر الموقع، وكيف نتعامل معها.",
        ],
      },
    },
    {
      id: "information",
      title: { en: "Information you share with us", ar: "المعلومات التي تشاركها معنا" },
      body: {
        en: [
          "We only receive personal information that you choose to send us — for example when you:",
          {
            list: [
              "call us, or message us on WhatsApp",
              "send us an email",
              "prepare a quote request on this website and send it by email or WhatsApp",
            ],
          },
          "This can include your name, company, email address, phone number, project details, and any drawings or files you attach.",
        ],
        ar: [
          "لا نتلقى من المعلومات الشخصية إلا ما تختار أن ترسله إلينا، مثلًا عندما:",
          {
            list: ["تتصل بنا أو تراسلنا عبر واتساب", "ترسل إلينا بريدًا إلكترونيًا", "تُعِدّ طلب عرض سعر في هذا الموقع وترسله بالبريد الإلكتروني أو عبر واتساب"],
          },
          "وقد يشمل ذلك اسمك وشركتك وبريدك الإلكتروني ورقم هاتفك وتفاصيل مشروعك، وأي مخططات أو ملفات ترفقها.",
        ],
      },
    },
    {
      id: "quote-form",
      title: { en: "How the quote request form works", ar: "كيف يعمل نموذج طلب عرض السعر" },
      body: {
        en: [
          "The quote request form checks your entries in your browser and prepares a message. It does not send your information to our servers or store it on the website.",
          "Your request reaches us only when you send it yourself — from your email app or through WhatsApp — together with any files you attach there.",
          "If the form is connected to an online submission service in the future, this policy will be updated first.",
        ],
        ar: [
          "يتحقق نموذج طلب عرض السعر من البيانات التي تُدخلها داخل متصفحك ويُعِدّ منها رسالة، ولا يرسل معلوماتك إلى خوادمنا ولا يحفظها في الموقع.",
          "ولا يصلنا طلبك إلا عندما ترسله بنفسك من تطبيق بريدك الإلكتروني أو عبر واتساب، مع أي ملفات ترفقها هناك.",
          "وإذا رُبط النموذج مستقبلًا بخدمة إرسال عبر الإنترنت، فسنحدّث هذه السياسة قبل ذلك.",
        ],
      },
    },
    {
      id: "use",
      title: { en: "How we use your information", ar: "كيف نستخدم معلوماتك" },
      body: {
        en: [
          "We use the information you send us to:",
          {
            list: [
              "respond to your enquiry",
              "prepare quotations and discuss your project",
              "plan, deliver and support the work you ask us to carry out",
              "keep a record of our correspondence with you",
            ],
          },
        ],
        ar: [
          "نستخدم المعلومات التي ترسلها إلينا من أجل:",
          {
            list: ["الرد على استفسارك", "إعداد عروض الأسعار ومناقشة مشروعك", "تخطيط الأعمال التي تطلبها منا وتنفيذها ودعمها", "الاحتفاظ بسجل لمراسلاتنا معك"],
          },
        ],
      },
    },
    {
      id: "sharing",
      title: { en: "Sharing", ar: "مشاركة المعلومات" },
      body: {
        en: [
          "When you contact us by email or WhatsApp, your messages are also handled by those service providers, under their own terms and privacy policies.",
          "We do not sell your personal information.",
        ],
        ar: [
          "عندما تتواصل معنا بالبريد الإلكتروني أو عبر واتساب، يتعامل مزوّدو هذه الخدمات أيضًا مع رسائلك وفق شروطهم وسياسات الخصوصية الخاصة بهم.",
          "لا نبيع معلوماتك الشخصية.",
        ],
      },
      pending: {
        en: "RAWASY to confirm this statement, and whether any other parties (for example subcontractors or transport providers) receive project information.",
        ar: "بانتظار تأكيد رواسي لهذه العبارة، وما إذا كانت أي جهات أخرى (كمقاولي الباطن أو مزوّدي النقل) تتلقى معلومات المشاريع.",
      },
    },
    {
      id: "cookies",
      title: { en: "Cookies and preferences", ar: "ملفات تعريف الارتباط والتفضيلات" },
      body: {
        en: [
          "The website saves only small preference settings in your browser:",
          {
            list: [
              "a cookie named NEXT_LOCALE, set when you switch language, which remembers English or Arabic for up to one year",
              "your light or dark theme choice, saved in your browser's local storage",
              "a setting for the current browsing session, so the short introduction animation plays only once",
            ],
          },
          "These settings stay in your browser. They are not used to identify you or track you across other websites, and the website does not use advertising cookies.",
        ],
        ar: [
          "لا يحفظ الموقع في متصفحك سوى إعدادات تفضيل بسيطة:",
          {
            list: [
              "ملف تعريف ارتباط باسم NEXT_LOCALE يُحفظ عند تغيير اللغة، ويتذكّر اختيارك بين العربية والإنجليزية لمدة تصل إلى سنة",
              "اختيارك للوضع الفاتح أو الداكن، ويُحفظ في التخزين المحلي لمتصفحك",
              "إعداد خاص بجلسة التصفح الحالية حتى لا تُعرض الحركة التمهيدية القصيرة إلا مرة واحدة",
            ],
          },
          "تبقى هذه الإعدادات في متصفحك، ولا تُستخدم لتحديد هويتك أو تتبّعك في مواقع أخرى، ولا يستخدم الموقع ملفات تعريف ارتباط إعلانية.",
        ],
      },
    },
    {
      id: "analytics",
      title: { en: "Analytics", ar: "أدوات التحليل" },
      body: {
        en: ["The website does not currently use analytics or tracking tools. If this changes, this policy will be updated."],
        ar: ["لا يستخدم الموقع حاليًا أي أدوات تحليل أو تتبّع، وإذا تغيّر ذلك فسنحدّث هذه السياسة."],
      },
    },
    {
      id: "technical",
      title: { en: "Technical information", ar: "المعلومات التقنية" },
      body: {
        en: [
          "Like most websites, the servers that host this website may record basic technical information when pages are requested — such as your IP address, browser type and the pages visited — so that the site can be delivered and kept secure.",
        ],
        ar: [
          "كما هو الحال في معظم المواقع، قد تسجّل الخوادم التي تستضيف هذا الموقع معلومات تقنية أساسية عند طلب الصفحات، مثل عنوان IP ونوع المتصفح والصفحات التي تمت زيارتها، وذلك لتقديم الموقع والحفاظ على أمنه.",
        ],
      },
      pending: {
        en: "RAWASY to confirm the hosting provider and its log settings before launch.",
        ar: "بانتظار تأكيد رواسي لمزوّد الاستضافة وإعدادات السجلات لديه قبل الإطلاق.",
      },
    },
    {
      id: "links",
      title: { en: "Other services", ar: "الخدمات الأخرى" },
      body: {
        en: [
          "Links on this website can open services run by others, such as WhatsApp, Facebook or your email app. Their own privacy policies apply when you use them.",
        ],
        ar: [
          "قد تفتح بعض الروابط في هذا الموقع خدمات تديرها جهات أخرى، مثل واتساب وفيسبوك وتطبيق بريدك الإلكتروني، وتنطبق عليها سياسات الخصوصية الخاصة بها عند استخدامها.",
        ],
      },
    },
    {
      id: "security",
      title: { en: "Security", ar: "أمن المعلومات" },
      body: {
        en: [
          "We take reasonable steps to protect the information you share with us. No way of sending information over the internet is completely secure, so please don't send sensitive personal information — such as identity numbers — unless your project needs it.",
        ],
        ar: [
          "نتخذ إجراءات معقولة لحماية المعلومات التي تشاركها معنا. ولأنه لا توجد وسيلة آمنة تمامًا لنقل المعلومات عبر الإنترنت، نرجو ألا ترسل معلومات شخصية حساسة مثل أرقام الهوية إلا إذا تطلّبها مشروعك.",
        ],
      },
    },
    {
      id: "retention",
      title: { en: "How long we keep information", ar: "مدة الاحتفاظ بالمعلومات" },
      body: {
        en: [
          "We keep correspondence and project information for as long as we need it to respond to you, to carry out and support your project, and for our business records.",
        ],
        ar: ["نحتفظ بالمراسلات ومعلومات المشاريع طوال المدة التي نحتاجها للرد عليك وتنفيذ مشروعك ودعمه، ولأغراض سجلاتنا التجارية."],
      },
      pending: {
        en: "RAWASY to confirm specific retention periods.",
        ar: "بانتظار تأكيد رواسي لمدد الاحتفاظ المحددة.",
      },
    },
    {
      id: "choices",
      title: { en: "Your choices", ar: "خياراتك" },
      body: {
        en: ["You can contact us at any time to ask what information we hold about you, or to ask us to correct or delete it."],
        ar: ["يمكنك التواصل معنا في أي وقت للاستفسار عن المعلومات التي نحتفظ بها عنك، أو لطلب تصحيحها أو حذفها."],
      },
      pending: {
        en: "RAWASY to confirm how these requests are handled, and any legal requirements that apply.",
        ar: "بانتظار تأكيد رواسي لآلية التعامل مع هذه الطلبات، وأي متطلبات نظامية تنطبق عليها.",
      },
    },
    {
      id: "changes",
      title: { en: "Changes to this policy", ar: "التعديلات على هذه السياسة" },
      body: {
        en: ["We may update this policy as the website develops. The date at the top of this page shows when it was last changed."],
        ar: ["قد نحدّث هذه السياسة مع تطوّر الموقع، ويوضّح التاريخ في أعلى الصفحة موعد آخر تحديث لها."],
      },
    },
    {
      id: "contact",
      title: { en: "Contact us about privacy", ar: "تواصل معنا بشأن الخصوصية" },
      body: {
        en: ["For any question about this policy or your information, contact us:"],
        ar: ["لأي استفسار عن هذه السياسة أو عن معلوماتك، تواصل معنا:"],
      },
      contact: true,
    },
  ],
};

export const websiteTerms: LegalDocument = {
  slug: "terms",
  hero: {
    eyebrow: { en: "Legal", ar: "قانوني" },
    title: { en: "Website Terms", ar: "شروط استخدام الموقع" },
    intro: {
      en: "The terms that apply when you use the RAWASY website.",
      ar: "الشروط التي تنطبق عند استخدامك موقع رواسي الإلكتروني.",
    },
  },
  updated: "2026-09-24",
  sections: [
    {
      id: "about",
      title: { en: "About this website", ar: "عن هذا الموقع" },
      body: {
        en: [
          "This website is operated by RAWASY UNITED INTERNATIONAL CO. LTD., Riyadh, Saudi Arabia. It provides general information about our company, services, capabilities and work.",
          "By using the website, you agree to these terms.",
        ],
        ar: [
          "تدير هذا الموقع شركة رواسي المتحدة العالمية المحدودة في الرياض، المملكة العربية السعودية، ويقدّم معلومات عامة عن الشركة وخدماتها وقدراتها وأعمالها.",
          "واستخدامك للموقع يعني موافقتك على هذه الشروط.",
        ],
      },
    },
    {
      id: "use",
      title: { en: "Using the website", ar: "استخدام الموقع" },
      body: {
        en: [
          "Please use the website lawfully and respectfully. You agree not to:",
          {
            list: [
              "use it in a way that breaks any applicable law or regulation",
              "try to gain unauthorised access to the website or the systems behind it",
              "interfere with how it works — for example with malicious code or excessive automated requests",
              "copy or reuse its content in ways these terms don't allow",
            ],
          },
        ],
        ar: [
          "نرجو استخدام الموقع بطريقة نظامية ولائقة، وتوافق على ألا:",
          {
            list: [
              "تستخدمه بطريقة تخالف أي أنظمة أو لوائح معمول بها",
              "تحاول الوصول دون تصريح إلى الموقع أو الأنظمة التي يعمل عليها",
              "تعطّل عمله، مثل استخدام برمجيات ضارة أو طلبات آلية مفرطة",
              "تنسخ محتواه أو تعيد استخدامه بطرق لا تسمح بها هذه الشروط",
            ],
          },
        ],
      },
    },
    {
      id: "intellectual-property",
      title: { en: "Intellectual property", ar: "الملكية الفكرية" },
      body: {
        en: [
          "The RAWASY name and logo, and the text, photographs, graphics and design of this website, belong to RAWASY or are used with permission. You may view and share pages for personal reference or internal business use. Any other reuse needs our written permission.",
          "Client logos are shown to identify organisations that have worked with RAWASY, and remain the trademarks of their respective owners.",
        ],
        ar: [
          "اسم رواسي وشعارها، ونصوص هذا الموقع وصوره ورسوماته وتصميمه، مملوكة لرواسي أو مستخدمة بإذن. ويمكنك تصفّح الصفحات ومشاركتها للاطلاع الشخصي أو للاستخدام الداخلي في أعمالك، أما أي استخدام آخر فيتطلب موافقة كتابية منا.",
          "تُعرض شعارات العملاء للتعريف بالجهات التي تعاملت مع رواسي، وتبقى علامات تجارية مملوكة لأصحابها.",
        ],
      },
      pending: {
        en: "RAWASY to confirm licences for the stock and supplier photography used on the site (see the asset inventory).",
        ar: "بانتظار تأكيد رواسي لتراخيص الصور المأخوذة من مكتبات الصور أو من الموردين والمستخدمة في الموقع (انظر قائمة الأصول).",
      },
    },
    {
      id: "accuracy",
      title: { en: "Content accuracy", ar: "دقة المحتوى" },
      body: {
        en: [
          "We aim to keep the website accurate and up to date, but its content is general information only. Capabilities, equipment, specifications and images may change, and some images show representative work.",
          "Please confirm any detail that matters to your project with us directly.",
        ],
        ar: [
          "نحرص على أن يكون محتوى الموقع دقيقًا ومحدّثًا، لكنه معلومات عامة فقط؛ فالقدرات والمعدات والمواصفات والصور قد تتغيّر، وبعض الصور تعرض أعمالًا توضيحية.",
          "يرجى التأكد معنا مباشرة من أي تفصيل يهمّ مشروعك.",
        ],
      },
    },
    {
      id: "quotations",
      title: { en: "Quotations and project information", ar: "عروض الأسعار ومعلومات المشاريع" },
      body: {
        en: [
          "Nothing on this website is an offer or a binding quotation. Prices, scope, specifications, timelines and terms are confirmed in a written quotation or agreement for each project, which takes precedence over the website.",
        ],
        ar: [
          "لا يُعدّ أي محتوى في هذا الموقع عرضًا أو عرض سعر مُلزِمًا. وتُحدَّد الأسعار والنطاق والمواصفات والمدد الزمنية والشروط في عرض سعر أو اتفاقية مكتوبة لكل مشروع، وتكون لها الأولوية على ما يرد في الموقع.",
        ],
      },
    },
    {
      id: "links",
      title: { en: "Links to other services", ar: "الروابط إلى خدمات أخرى" },
      body: {
        en: ["The website links to services run by others, such as WhatsApp and Facebook. We are not responsible for their content or practices."],
        ar: ["يتضمن الموقع روابط إلى خدمات تديرها جهات أخرى، مثل واتساب وفيسبوك، ولسنا مسؤولين عن محتواها أو ممارساتها."],
      },
    },
    {
      id: "liability",
      title: { en: "Liability", ar: "المسؤولية" },
      body: {
        en: [
          "To the extent permitted by applicable law, RAWASY is not liable for any loss or damage arising from the use of this website, or from reliance on its general information. Nothing in these terms limits any liability that cannot be limited by law.",
        ],
        ar: [
          "في حدود ما تسمح به الأنظمة المعمول بها، لا تتحمل رواسي المسؤولية عن أي خسارة أو ضرر ينشأ عن استخدام هذا الموقع أو الاعتماد على معلوماته العامة، ولا يحدّ أي بند في هذه الشروط من مسؤولية لا يجوز الحدّ منها نظامًا.",
        ],
      },
      pending: {
        en: "This wording needs legal review before launch.",
        ar: "تحتاج هذه الصياغة إلى مراجعة قانونية قبل الإطلاق.",
      },
    },
    {
      id: "changes",
      title: { en: "Changes to the website and these terms", ar: "التعديلات على الموقع وهذه الشروط" },
      body: {
        en: ["We may update the website and these terms from time to time. The date at the top of this page shows when the terms were last changed."],
        ar: ["قد نحدّث الموقع وهذه الشروط من وقت لآخر، ويوضّح التاريخ في أعلى الصفحة موعد آخر تحديث للشروط."],
      },
    },
    {
      id: "contact",
      title: { en: "Contact", ar: "التواصل" },
      body: {
        en: ["Questions about these terms? Contact us:"],
        ar: ["لديك سؤال عن هذه الشروط؟ تواصل معنا:"],
      },
      contact: true,
    },
  ],
};

export const legalDocuments = { privacy: privacyPolicy, terms: websiteTerms };
