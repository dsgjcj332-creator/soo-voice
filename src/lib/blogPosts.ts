/**
 * Editorial content for the SooVoice blog. This is the surface where the
 * hospitality story is told — long-form, in both languages, in a measured
 * tone. The marketing copy was removed from the product pages so that the
 * application itself reads as a tool; the blog is where the thinking behind
 * it lives.
 *
 * Each post has a slug (used in the URL), bilingual title + excerpt + body,
 * a category, an ISO date, and an estimated reading time. The body is a
 * plain array of paragraph strings; the renderer wraps each in <p>.
 */

export type BlogCategory =
  | 'hospitality'
  | 'design'
  | 'service'
  | 'field-notes';

export interface BlogPost {
  slug: string;
  category: BlogCategory;
  categoryLabelAr: string;
  categoryLabelEn: string;
  titleAr: string;
  titleEn: string;
  excerptAr: string;
  excerptEn: string;
  bodyAr: string[];
  bodyEn: string[];
  dateIso: string;
  readingTimeMin: number;
  authorAr: string;
  authorEn: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'digital-menu-in-luxury-hospitality',
    category: 'hospitality',
    categoryLabelAr: 'الضيافة',
    categoryLabelEn: 'Hospitality',
    titleAr: 'لماذا صار المنيو الرقمي جزءًا من تجربة الضيافة الراقية',
    titleEn: 'Why the digital menu has become part of luxury hospitality',
    excerptAr:
      'المنيو الورقي لم يختفِ، لكن دوره تغيّر. في المطاعم الفاخرة، صار المنيو الرقمي يكمّل التجربة بدل أن ينافسها — ويترك الورق لما يستحقّه فعلاً.',
    excerptEn:
      'The printed menu has not disappeared, but its role has shifted. In fine dining, the digital menu now complements the experience instead of competing with it — leaving print to what it does best.',
    bodyAr: [
      'حين يدخل ضيف إلى مطعم راقٍ، يبحث عن ثلاثة أشياء في الدقائق الأولى: مكان يجلس فيه باسترخاء، شخص يستقبله بإحساس، وقائمة يفهمها. المنيو الورقي كان سنوات طويلة هو الوسيلة الوحيدة لتلبية الحاجة الثالثة، لكنه ليس دائمًا الأنسب لها. القوائم الطويلة، الأسعار المتغيّرة، أطباق الموسم التي تظهر وتختفي، الحساسيات الغذائية المتزايدة — كلها تجعل الورق ثابتًا في وجه متغيّر.',
      'المنيو الرقمي لا يحلّ هذه المشكلة بأن يجعل الضيف يقرأ من شاشة بدلًا من ورقة. يحلّها بأن يفصل بين دورين مختلفين: الورق يبقى للأطباق الأساسية، للهوية البصرية للمطعم، للإحساس اللمسي الذي يصاحب الضيافة الكلاسيكية. والرقم يأخذ ما يحتاج التحديث: أسعار اليوم، طبق الموسم، توفر الأطباق، تفاصيل المكونات لمن يسأل.',
      'في التجربة التي بنيناها، الضيف لا يُجبر على فتح شاشة. يرى على الطاولة ستاندًا أنيقًا يحمل كود QR واسم المطعم ولوجو. إن أراد، يفتح المنيو على هاتفه فيجد قائمة مرتّبة، صورًا، أسعارًا بالعملة التي اختارها المطعم. وإن لم يرد، يبقى الورق بين يديه كما يحب. الكود إضافة، لا بديل.',
      'هذا التمييز بين «المكمّل» و«البديل» هو ما يفصل بين التطبيق الذي يحترم الضيف والتطبيق الذي يسعى وراء التفاعل. الأول يخدم تجربة المطعم كما أرادها صاحبها. الثاني يفرض على الضيف نمطًا جديدًا لم يطلبه. الفاخر لا يعني الأحدث تقنيًا، بل الأنسب لروح المكان.',
      'في النهاية، ما يُقاس به المنيو الرقمي ليس عدد الميزات التي يقدّمها، بل عدد اللحظات التي يختفي فيها بنجاح. حين يخدم الضيف دون أن يصبح هو محور التجربة، يكون قد أدّى دوره على الوجه الصحيح.',
    ],
    bodyEn: [
      'When a guest enters a fine restaurant, the first minutes are spent looking for three things: a place to sit at ease, a person to receive them with feeling, and a list they can understand. The printed menu served that third need for many years, but it is not always the best fit. Long menus, shifting prices, seasonal dishes that appear and disappear, the rise of dietary questions — all of these leave the static print struggling to keep up.',
      'A digital menu does not solve this by asking the guest to read from a screen instead of paper. It solves it by separating two different roles: print stays for the core dishes, for the restaurant’s visual identity, for the tactile feel that accompanies classical hospitality. The digital takes what needs to move: today’s prices, the dish of the season, what is still available tonight, the ingredient details a guest asks about.',
      'In the experience we built, the guest is never forced to open a screen. On the table sits an elegant stand carrying a QR code, the restaurant’s name, its logo. If they wish, they open the menu on their phone and find a tidy list, images, prices in the currency the restaurant chose. If they prefer, the paper stays in their hands. The code is an addition, not a replacement.',
      'This distinction between “complement” and “replacement” is what separates an app that respects the guest from one that chases engagement. The first serves the experience the owner designed. The second imposes a new pattern the guest did not ask for. Luxury is not the most recent technology — it is the most fitting for the spirit of the place.',
      'In the end, what measures a digital menu is not the count of features it offers, but the number of moments it manages to disappear. When it serves the guest without becoming the centerpiece, it has done its job correctly.',
    ],
    dateIso: '2026-11-12',
    readingTimeMin: 4,
    authorAr: 'فريق SooVoice التحريري',
    authorEn: 'SooVoice editorial team',
  },
  {
    slug: 'how-the-voice-assistant-reads-a-guest',
    category: 'service',
    categoryLabelAr: 'الخدمة',
    categoryLabelEn: 'Service',
    titleAr: 'كيف يقرأ المساعد الصوتي ضيوفك: من اللباقة إلى الشخصية',
    titleEn: 'How the voice assistant reads your guests: from courtesy to character',
    excerptAr:
      'الفرق بين مساعد صوتي لبق ومساعد صوتي متعجرف ليس في المفردات، بل في التوقيت. هذه ملاحظات من العمل اليومي مع مطاعم تخدم ضيوفًا يهتمون بالتفاصيل.',
    excerptEn:
      'The difference between a courteous voice assistant and an overbearing one is not in vocabulary but in timing. Notes from daily work with restaurants that serve guests who care about details.',
    bodyAr: [
      'حين نعمل على مساعد صوتي لمطعم، أول سؤال يطرحه صاحب المطعم عادةً هو: «هل سيتكلم بطريقتي أنا؟» والإجابة القصيرة هي نعم، لكن الطريق إلى تلك الإجابة طويل. فالصوت ليس مجرد لهجة ونبرة، بل إيقاع، اختيار للكلمات، معرفة متى يكفي السكوت.',
      'في مطعم فاخر، الضيف لا يريد أن يُقاطَع. يريد أن يسأل سؤالًا، ويسمع إجابة كاملة، ثم يقرّر إن كان يريد أن يسترسل أم يكفي. المساعد الذي يقاطع لاقتراح طبق إضافي، أو يكرّر سؤاله قبل أن يُنهي الضيف جملته، يخسر ثقة الطاولة في ثوانٍ. لذلك أول قاعدة نضعها في النظام: لا تقاطع. والثانية: لا تقترح إلا إذا طُلب منك.',
      'القاعدة الثالثة أصعب: اقرأ السياق. لو قال الضيف «أنا صائم وأفطر بعد ساعة»، لا يقترح المساعد مشروبًا باردًا. لو قال «نجتمع مع عائلة»، لا يصف نبيذًا. لو سأل «هل فيه شيء بدون لحم؟»، لا يكتفِ بنعم، بل يعدّد الخيارات ثم يسأل عن التفضيل. هذه ليست ميزات، بل علامات على ذكاء الخدمة.',
      'نحن لا نُعلّم النظام أن يتصرّف كنادل بشري، لأنه ليس نادلًا بشريًا. نُعلّمه أن يحترم قواعد النادل البشري: الاستماع قبل الكلام، الصدق قبل التسويق، التوقف قبل الانفعال. وحين يفعل ذلك، يصبح الكلام عن «ذكاء اصطناعي» غير ضروري، لأن الضيف لا يسمع تكنولوجيا، بل يسمع خدمة.',
      'أكثر تعليق سمعناه من ضيوف جرّبوا المساعد في مطاعم تجريبية: «لم أحس أنه يصنّع». هذه هي المكافأة. لا الديكlamation عن التقدّم، بل الصمت الراضي في نهاية المحادثة.',
    ],
    bodyEn: [
      'When we work on a voice assistant for a restaurant, the first question from the owner is usually: “Will it speak the way I do?” The short answer is yes, but the path to that answer is long. Voice is not only dialect and tone — it is pacing, word choice, knowing when silence is enough.',
      'In a fine restaurant, the guest does not want to be interrupted. They want to ask a question, hear the full answer, then decide whether to continue or stop. An assistant that interrupts to upsell, or repeats its question before the guest has finished their sentence, loses the table’s trust in seconds. So the first rule we set in the system is: do not interrupt. The second is: do not suggest unless asked.',
      'The third rule is harder: read the context. If a guest says “I am fasting and break my fast in an hour,” the assistant does not offer a cold drink. If they say “we are here with the family,” it does not describe a wine. If they ask “is there anything without meat?” it does not stop at yes — it lists the options and asks about preference. These are not features; they are marks of intelligent service.',
      'We do not teach the system to behave like a human waiter, because it is not a human waiter. We teach it to respect the rules of a human waiter: listen before speaking, honesty before selling, restraint before excitement. When it does, talk of “artificial intelligence” becomes unnecessary — the guest is not hearing technology, they are hearing service.',
      'The comment we hear most from guests who tried the assistant in pilot restaurants: “I did not feel it was performing.” That is the reward. Not the declaration of progress, but the satisfied silence at the end of the conversation.',
    ],
    dateIso: '2026-11-09',
    readingTimeMin: 5,
    authorAr: 'فريق SooVoice التحريري',
    authorEn: 'SooVoice editorial team',
  },
  {
    slug: 'five-criteria-luxury-guests-now-use',
    category: 'field-notes',
    categoryLabelAr: 'ملاحظات ميدانية',
    categoryLabelEn: 'Field notes',
    titleAr: 'خمسة معايير يستخدمها ضيوف المطاعم الفاخرة في 2026',
    titleEn: 'Five criteria luxury restaurant guests now use in 2026',
    excerptAr:
      'الضيوف الذين يدفعون أكثر لا يقارنون الأطباق وحدها. يقارنون التجربة. هذه خمسة معايير لاحظناها تتكرر في مطاعم حضرتها هذا العام.',
    excerptEn:
      'Guests who pay more do not compare dishes alone. They compare experiences. These are five criteria we noticed recurring across restaurants this year.',
    bodyAr: [
      'الأول: الانتظار. الضيف الفاخر لا يغضب من الانتظار، بل من الانتظار دون سبب واضح. لو تأخّر الطبق لأن المطعم مزدحم، يفهم. لو تأخّر دون تفسير، يشك. الفرق دقيقة لكنه حاسم: ضيف واحد يخبره النادل «طبقك يحتاج عشر دقائق إضافية لأن الشيف يعيد تحضيره»، وآخر ينتظر دون كلمة. الأول يحس بالاحترام، الثاني يحس بالإهمال.',
      'الثاني: معرفة النادل بالقائمة. حين يسأل الضيف عن فرق بين طبقين، توقع إجابة محددة، لا تلخيصًا عامًا. النادل الذي يقول «كلاهما جيد» يفقد المصداقية. النادل الذي يقول «هذا أثقل في الزبدة، هذا أخف وأكثر حموضة» يربح الثقة.',
      'الثالث: التحكّم في الإيقاع. الضيف يحب أن يقرر متى يأتي الطبق التالي. بعض المطاعم تأكل الإيقاع عن الضيف، فتأتي الأطباق بسرعة لتخلي الطاولة. المطاعم الأكثر إحرازًا للرضا تلك التي تسأل: «هل نأتي بالمقبلات الآن أم تنتظرون؟».',
      'الرابع: الخصوصية. الضيف لا يحب أن يُنادى باسمه بصوت عالٍ، ولا أن يُصوَّر طلبه أمام ضيوف آخرين. المطاعم التي تستخدم اسم الطاولة بدلًا من اسم الضيف، وتسأل قبل التقاط أي صورة، تكسب تفاصيل لا تُلاحظ أول مرة لكن تُلاحظ ثاني مرة.',
      'الخامس: الذهاب بما هو أبعد من المتوقع. حين يطلب الضيف ماء، يقدّم النادل زجاجتين: واحدة غازية وواحدة عادية، دون سؤال. حين يأتي بفاتورة، يأتي معها نعناع صغير أو تمرة. ليست تكاليف كبيرة، لكنها علامة أن المطعم يفكر في الضيف كإنسان لا كرقم في كشف حساب.',
      'المساعد الصوتي الذي بنيناه لا يحل محل أي من هذه المعايير. يحاول أن يدعمها: يقرّب المنيو إلى يد الضيف، يفتح سؤالًا حين يخجل الضيف من مناداة النادل، يوضّح سعرًا قبل أن يصل إلى الفاتورة. البشر يفعلون الباقي. وهكذا يجب أن يكون.',
    ],
    bodyEn: [
      'First: waiting. The luxury guest is not angered by waiting, but by waiting without a clear reason. If the dish is late because the restaurant is full, they understand. If it is late without explanation, they begin to doubt. The distinction is small but decisive: one guest hears “your dish needs ten more minutes because the chef is preparing it again,” another waits in silence. The first feels respect, the second feels neglect.',
      'Second: the waiter’s knowledge of the menu. When a guest asks about the difference between two dishes, they expect a specific answer, not a general summary. A waiter who says “both are good” loses credibility. A waiter who says “this one is heavier in butter, that one is lighter and more acidic” earns trust.',
      'Third: control of pacing. The guest likes to decide when the next dish arrives. Some restaurants eat the pacing from the guest — dishes come fast to free the table. The restaurants with the highest satisfaction are those that ask: “shall we bring the starters now, or would you rather wait?”',
      'Fourth: privacy. The guest does not like to be called by name in a loud voice, or to have their order photographed in front of other guests. Restaurants that use the table’s name rather than the guest’s, and ask before taking any photograph, win details that go unnoticed the first time but are noticed the second.',
      'Fifth: going beyond expectation. When the guest asks for water, the waiter brings two bottles — one sparkling, one still — without asking. When the bill arrives, a small mint or a date comes with it. These are not large costs, but they signal that the restaurant thinks of the guest as a person, not as a number on a bill.',
      'The voice assistant we built does not replace any of these criteria. It tries to support them: it brings the menu to the guest’s hand, opens a question when the guest is shy to call the waiter, clarifies a price before it reaches the bill. Humans do the rest. That is how it should be.',
    ],
    dateIso: '2026-11-05',
    readingTimeMin: 6,
    authorAr: 'فريق SooVoice التحريري',
    authorEn: 'SooVoice editorial team',
  },
  {
    slug: 'between-human-and-voice-the-waiters-role',
    category: 'service',
    categoryLabelAr: 'الخدمة',
    categoryLabelEn: 'Service',
    titleAr: 'بين البشر والصوت: دور النادل في عصر المساعد الرقمي',
    titleEn: 'Between human and voice: the waiter’s role in the digital-assistant age',
    excerptAr:
      'سؤال يُطرح علينا كثيرًا: هل المساعد الصوتي يسرق عمل النادل؟ الإجابة لا. هو يحمي وقته لما يهم فعلًا في عمله، ويترك له القرار.',
    excerptEn:
      'A question we are often asked: does the voice assistant take the waiter’s job? The answer is no. It protects their time for what truly matters in their work, and leaves them the decision.',
    bodyAr: [
      'النادل الجيد لا يُدفع وقته في الإجابة عن «كم سعر هذه البيتزا؟» أو «هل فيها لحم؟». يُدفع وقته في قراءة الطاولة: متى يضحك معهم، متى يتركهم، متى يقترح نبيذًا، متى يكتفي بابتسامة. هذا الجزء من العمل هو الذي يصنع البقشيش، ويصنع عودة الضيف. أما الأسئلة الروتينية، فهي التي تأخذ من الوقت دون أن تُضيف قيمة.',
      'المساعد الصوتي يحلّ مكان الأسئلة الروتينية. يجيب عن الأسعار، عن المكونات، عن أوقات العمل، عن أطباق الموسم، دون أن يأخذ من النادل دقيقة. وحين ينتهي السؤال البسيط، يبقى النادل لما هو أصعب: اقتراح الطبق المناسب لذوق الطاولة، إقناع الضيف بتجريب جديد، التدخل حين تُرفع الفاتورة بابتسامة وكلمة.',
      'ما لاحظناه في المطاعم التي جرّبت المساعد: النادل لا يصبح أقل أهمية، بل أكثر تركيزًا. حين لا يضطر أن يجيب نفس الأسئلة مئة مرة في الليلة، يصبح لديه طاقة للتفاصيل التي لا يلاحظها الضيف أول مرة، لكنها التي تدفعه للعودة في المرة الثانية.',
      'هناك خط رفيع يجب أن نحافظ عليه: المساعد لا يُغلق الطاولة على نفسها. لو أراد الضيف مناداة النادل، يجب أن يكون سهلًا. لو سأل المساعد سؤالًا أعقد من قدرته، عليه أن يحيل إلى النادل بإيجاز: «سأستدعي زميلي من الخدمة ليكمل لك». هذه اللحظة، حين يعترف المساعد بحدوده، هي ما يحمي ثقة الضيف بالنظام وبالمطعم.',
      'في النهاية، المساعد الصوتي أداة في يد صاحب المطعم والنادل، لا بديل عنهما. يستطيع أن يخفي ما لا يُحب الضيف رؤيته، ويكشف ما يُحب أن يعرفه. لكنه لا يستطيع أن يبتسم، ولا أن يقرأ ملامح الطاولة، ولا أن يقرّر. هذه تبقى للنادل — وستبقى.',
    ],
    bodyEn: [
      'A good waiter is not spent answering “how much is this pizza?” or “does it contain meat?” They are spent reading the table: when to laugh with them, when to leave them, when to suggest a wine, when a smile is enough. That part of the job is what builds the tip, and what brings the guest back. Routine questions take time without adding value.',
      'The voice assistant takes the place of the routine questions. It answers about prices, ingredients, opening hours, seasonal dishes — without taking a minute from the waiter. When the simple question is done, the waiter remains for what is harder: suggesting the dish that fits the table’s taste, convincing the guest to try something new, intervening when the bill arrives with a smile and a word.',
      'What we noticed in restaurants that piloted the assistant: the waiter does not become less important, but more focused. When they no longer have to answer the same question a hundred times in one evening, they have energy for the details the guest does not notice the first time, but which bring them back the second.',
      'There is a fine line we must hold: the assistant does not close the table in on itself. If the guest wants to call the waiter, it must be easy. If the assistant is asked something beyond its ability, it should refer to the waiter briefly: “I will call a colleague to complete this for you.” That moment, when the assistant acknowledges its limits, is what protects the guest’s trust in the system and the restaurant.',
      'In the end, the voice assistant is a tool in the hands of the owner and the waiter, not a replacement. It can hide what the guest does not want to see, and reveal what they wish to know. But it cannot smile, it cannot read a table’s expression, it cannot decide. These stay with the waiter — and will stay.',
    ],
    dateIso: '2026-11-01',
    readingTimeMin: 5,
    authorAr: 'فريق SooVoice التحريري',
    authorEn: 'SooVoice editorial team',
  },
];

/** Lookup a single post by its slug. Returns undefined if not found. */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** Returns posts newest first. */
export function getPostsByDateDesc(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

/** Returns the available categories, deduplicated. */
export function getCategories(): { value: BlogCategory; labelAr: string; labelEn: string }[] {
  const seen = new Set<BlogCategory>();
  const out: { value: BlogCategory; labelAr: string; labelEn: string }[] = [];
  for (const p of BLOG_POSTS) {
    if (!seen.has(p.category)) {
      seen.add(p.category);
      out.push({ value: p.category, labelAr: p.categoryLabelAr, labelEn: p.categoryLabelEn });
    }
  }
  return out;
}

/** Formats an ISO date as a readable date string in either language. */
export function formatBlogDate(iso: string, language: 'ar' | 'en'): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
