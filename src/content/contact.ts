import type { ContactPageContent } from "./types";

/**
 * Contact / request-a-quote page. Contact details themselves come from
 * `company.ts` (profile p.16). The quote form has no delivery backend yet: it
 * validates in the browser and hands the prepared request to the visitor's own
 * email app or WhatsApp. Nothing is sent or stored by the website.
 */
export const contactPage: ContactPageContent = {
  hero: {
    eyebrow: { en: "Start a project", ar: "ابدأ مشروعك" },
    title: { en: "Let's talk about your project.", ar: "لنتحدث عن مشروعك." },
    intro: {
      en: "Share your drawings, quantities and timeline. Call us, message us on WhatsApp or send an email — or prepare a detailed quote request below.",
      ar: "شاركنا مخططاتك والكميات والجدول الزمني. اتصل بنا أو راسلنا عبر واتساب أو البريد الإلكتروني، أو جهّز طلب عرض سعر مفصّلًا أدناه.",
    },
  },
  actions: {
    quote: { en: "Request a quote", ar: "اطلب عرض سعر" },
    call: { en: "Call", ar: "اتصال" },
    findUs: { en: "Find us", ar: "موقعنا" },
  },
  methods: {
    label: { en: "Direct contact", ar: "تواصل مباشر" },
    phone: { en: "Phone", ar: "الهاتف" },
    whatsapp: { en: "WhatsApp", ar: "واتساب" },
    chat: { en: "Chat", ar: "محادثة" },
    send: { en: "Send email", ar: "أرسل بريدًا" },
    email: { en: "Email", ar: "البريد الإلكتروني" },
    address: { en: "Address", ar: "العنوان" },
    viewMap: { en: "View map", ar: "عرض الخريطة" },
    name: { en: "Registered name", ar: "الاسم المسجّل" },
    stepsLabel: { en: "How it works", ar: "طريقة الطلب" },
  },
  location: {
    label: { en: "Location", ar: "الموقع" },
    title: { en: "Find us in Riyadh.", ar: "موقعنا في الرياض." },
    intro: {
      en: "RAWASY's address is in Al Mashael, Sulay, in Riyadh. Open it in Google Maps for directions.",
      ar: "يقع عنوان رواسي في حي المشاعل بالسلي في الرياض. افتحه في خرائط Google للحصول على الاتجاهات.",
    },
    contact: { en: "Direct contact", ar: "تواصل مباشر" },
    mapTitle: {
      en: "Google map of RAWASY's address: Al Mashael, Sulay, Riyadh",
      ar: "خريطة Google لعنوان رواسي: حي المشاعل، السلي، الرياض",
    },
    mapCaption: { en: "Google Maps · located from the address", ar: "خرائط Google · الموقع بحسب العنوان" },
    directions: { en: "Get directions", ar: "الحصول على الاتجاهات" },
    openMap: { en: "Open in Google Maps", ar: "فتح في خرائط Google" },
  },
  form: {
    label: { en: "Quote request", ar: "طلب عرض سعر" },
    title: { en: "Request a quote", ar: "اطلب عرض سعر" },
    intro: {
      en: "Tell us about your project. The more we know, the more precise our quotation can be.",
      ar: "أخبرنا عن مشروعك؛ فكلما زادت التفاصيل، كان عرض السعر أدق.",
    },
    status: {
      en: "When your request is ready, you send it to RAWASY from your own email app or WhatsApp. This website does not send or store the information you enter.",
      ar: "عند اكتمال طلبك، ترسله إلى رواسي من تطبيق بريدك الإلكتروني أو عبر واتساب. لا يرسل هذا الموقع المعلومات التي تدخلها ولا يحتفظ بها.",
    },
    steps: {
      en: [
        "Fill in your project details.",
        "Prepare the request and check the summary.",
        "Send it from your email app or WhatsApp, with your drawings attached.",
      ],
      ar: ["املأ تفاصيل مشروعك.", "جهّز الطلب وراجع الملخّص.", "أرسله من تطبيق بريدك أو عبر واتساب، مع إرفاق مخططاتك."],
    },
    requiredNote: { en: "Fields marked * are required.", ar: "الحقول المعلّمة بـ * مطلوبة." },
    groups: {
      details: { en: "Your details", ar: "بياناتك" },
      project: { en: "Project", ar: "المشروع" },
      message: { en: "Details and drawings", ar: "التفاصيل والمخططات" },
    },
    noscript: {
      en: "JavaScript is off, so the button below opens your email app with your details as plain text. Attach your drawings there.",
      ar: "جافاسكربت غير مفعّل؛ لذلك يفتح الزر أدناه تطبيق بريدك الإلكتروني ببياناتك كنص عادي. أرفق مخططاتك هناك.",
    },
    fields: {
      fullName: { label: { en: "Full name", ar: "الاسم الكامل" } },
      company: { label: { en: "Company", ar: "الشركة" } },
      email: { label: { en: "Email", ar: "البريد الإلكتروني" }, placeholder: { en: "name@company.com", ar: "name@company.com" } },
      phone: {
        label: { en: "Phone", ar: "رقم الجوال" },
        hint: { en: "Include the country code, for example +966.", ar: "أضف مفتاح الدولة، مثل ‎+966." },
        placeholder: { en: "+966 5X XXX XXXX", ar: "+966 5X XXX XXXX" },
      },
      service: { label: { en: "Service", ar: "الخدمة" }, placeholder: { en: "Choose a service", ar: "اختر الخدمة" } },
      projectType: { label: { en: "Project type", ar: "نوع المشروع" }, placeholder: { en: "Choose a type", ar: "اختر النوع" } },
      requirement: {
        label: { en: "Estimated requirement", ar: "الاحتياج التقديري" },
        hint: {
          en: "Quantities, dimensions, materials or thickness — whatever you know so far.",
          ar: "الكميات أو المقاسات أو الخامات أو السماكات — ما يتوفّر لديك حتى الآن.",
        },
      },
      location: {
        label: { en: "Project location", ar: "موقع المشروع" },
        hint: { en: "City or region.", ar: "المدينة أو المنطقة." },
      },
      message: {
        label: { en: "Project details", ar: "تفاصيل المشروع" },
        hint: {
          en: "Describe what you need, key dates and anything else we should know.",
          ar: "صف ما تحتاجه والمواعيد المهمة وأي معلومات أخرى تفيدنا.",
        },
      },
      files: { label: { en: "Drawings and files", ar: "المخططات والملفات" } },
    },
    serviceOther: { en: "Several services / not sure yet", ar: "أكثر من خدمة / لم أحدّد بعد" },
    projectTypes: [
      { value: "new-project", label: { en: "New project", ar: "مشروع جديد" } },
      { value: "custom-piece", label: { en: "Custom piece or one-off", ar: "قطعة خاصة أو طلب منفرد" } },
      { value: "production", label: { en: "Repeat or production parts", ar: "قطع متكررة أو إنتاج بالكمية" } },
      { value: "rental", label: { en: "Scaffolding rental", ar: "تأجير سقالات" } },
      { value: "maintenance", label: { en: "Maintenance or repair", ar: "صيانة أو ترميم" } },
      { value: "other", label: { en: "Other", ar: "أخرى" } },
    ],
    files: {
      accept: [".pdf", ".dwg", ".dxf", ".step", ".stp", ".jpg", ".jpeg", ".png"],
      maxFiles: 5,
      maxSizeMb: 10,
      choose: { en: "Choose files", ar: "اختر الملفات" },
      drop: { en: "or drop them here", ar: "أو أفلتها هنا" },
      remove: { en: "Remove", ar: "إزالة" },
      units: { kb: { en: "KB", ar: "كيلوبايت" }, mb: { en: "MB", ar: "ميجابايت" } },
      note: {
        en: "PDF, DWG, DXF, STEP, JPG or PNG · up to 5 files · 10 MB each. Files stay on your device — you'll attach them when you send the request.",
        ar: "PDF أو DWG أو DXF أو STEP أو JPG أو PNG · حتى 5 ملفات · 10 ميجابايت لكل ملف. تبقى الملفات على جهازك، وسترفقها بنفسك عند إرسال الطلب.",
      },
    },
    submit: { en: "Prepare request", ar: "تجهيز الطلب" },
    errors: {
      summary: { en: "Please check the highlighted details:", ar: "يرجى مراجعة البيانات التالية:" },
      fullName: { en: "Enter your full name.", ar: "أدخل اسمك الكامل." },
      email: { en: "Enter your email address.", ar: "أدخل بريدك الإلكتروني." },
      emailInvalid: { en: "Enter a valid email address, like name@company.com.", ar: "أدخل بريدًا إلكترونيًا صحيحًا، مثل name@company.com." },
      phone: { en: "Enter your phone number.", ar: "أدخل رقم جوالك." },
      phoneInvalid: { en: "Enter a phone number with 8 to 15 digits.", ar: "أدخل رقم هاتف من 8 إلى 15 رقمًا." },
      service: { en: "Choose a service.", ar: "اختر الخدمة." },
      message: { en: "Describe your project.", ar: "صف مشروعك." },
      messageShort: { en: "Add a little more detail — at least 20 characters.", ar: "أضف مزيدًا من التفاصيل، 20 حرفًا على الأقل." },
      fileType: { en: "{name} isn't a supported file type.", ar: "نوع الملف {name} غير مدعوم." },
      fileSize: { en: "{name} is larger than 10 MB.", ar: "حجم الملف {name} أكبر من 10 ميجابايت." },
      fileCount: { en: "You can add up to 5 files.", ar: "يمكنك إضافة 5 ملفات كحد أقصى." },
    },
    ready: {
      title: { en: "Your request is ready to send", ar: "طلبك جاهز للإرسال" },
      body: {
        en: "It hasn't been sent yet. Choose how to send it to RAWASY:",
        ar: "لم يُرسَل الطلب بعد. اختر طريقة إرساله إلى رواسي:",
      },
      email: { en: "Send by email", ar: "إرسال بالبريد الإلكتروني" },
      whatsapp: { en: "Send on WhatsApp", ar: "إرسال عبر واتساب" },
      copy: { en: "Copy request", ar: "نسخ الطلب" },
      copied: { en: "Copied", ar: "تم النسخ" },
      copyFailed: { en: "Couldn't copy. Select the text below instead.", ar: "تعذّر النسخ. حدّد النص أدناه يدويًا." },
      attach: { en: "Remember to attach your files:", ar: "تذكّر إرفاق ملفاتك:" },
      filesLine: { en: "Files to attach", ar: "ملفات للإرفاق" },
      fallback: {
        en: "If your email app opens without the full details, copy the request and paste it into your message.",
        ar: "إذا فُتح تطبيق البريد دون التفاصيل كاملة، انسخ الطلب والصقه في رسالتك.",
      },
      edit: { en: "Edit request", ar: "تعديل الطلب" },
      subject: { en: "Quote request", ar: "طلب عرض سعر" },
      preview: { en: "Request summary", ar: "ملخص الطلب" },
    },
    privacy: {
      text: {
        en: "Read how we handle the information you share in our {link}.",
        ar: "اطّلع على طريقة تعاملنا مع المعلومات التي تشاركها في {link}.",
      },
      link: { en: "Privacy Policy", ar: "سياسة الخصوصية" },
    },
  },
};
