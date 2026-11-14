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
  {
    slug: 'building-voice-persona-for-luxury-restaurant',
    category: 'design',
    categoryLabelAr: 'التصميم',
    categoryLabelEn: 'Design',
    titleAr: 'بناء شخصية صوتية لمطعمك الفاخر: خطوات عملية',
    titleEn: 'Building a voice persona for your luxury restaurant: practical steps',
    excerptAr:
      'كل مطعم فاخر له صوت. السؤال ليس «ما الصوت الذي يُعجب الضيف»، بل «ما الصوت الذي يخدم مطعمي». هذه خطوات عملية لاختيار الشخصية الصوتية.',
    excerptEn:
      'Every luxury restaurant has a voice. The question is not “which voice does the guest like” but “which voice serves my restaurant.” Practical steps for choosing the voice persona.',
    bodyAr: [
      'حين يفكر صاحب مطعم فاخر في مساعد صوتي، أول ما يتبادر إلى ذهنه هو «ما الصوت الذي يُعجب ضيوفي؟». هذا السؤال طبيعي لكنه يبدأ من الطرف الخطأ. الصوت الذي يُعجب الضيف لا يهمّ بقدر ما يهمّ الصوت الذي يخدم مطعمك. الضيف يدخل المطعم باختياره، يحبه أو يكرهه، لكنه يأتي توقعًا لروح المكان — ولا يمكن أن يأتي توقعًا لصوت لولاه لما جاء.',
      'الخطوة الأولى: ابدأ بشخصية مطعمك، لا بصوتك. مطعم تراثي عائلي من 1962 لا يصلح له صوت شاب مرح، ولا مطعم عصري يقدّم tasting menu يصلح له صوت رسمي جدًا. اكتب جملة واحدة تصف مطعمك: «نحن مطعم عائلي عريق، نقدّم مأكولات شرقية أصيلة، وخدمتنا دافئة دون أن تكون مألوفة». من هذه الجملة تبدأ كل القرارات الصوتية.',
      'الخطوة الثانية: اختبر قبل أن تنشر. لا تكفي القراءة عن الصوت في صفحة إعدادات، ولا يكفي سماع عينة لخمس ثوانٍ. اكتب ثلاث جمل يُرجّح أن يقولها المساعد في خدمة حقيقية — مثلاً «أهلًا بكم، ماذا يمكنني أن أقترح اليوم؟» و«هل تفضّلون طبقًا أخفّ أم أثقل؟» و«ننصح بتجريب طبق الموسم» — واسمعها بصوت كل خيار متاح. الفرق بين الأصوات يظهر في الإجابات الطويلة، لا في التحية.',
      'الخطوة الثالثة: لا تختر صوتًا يُحاكي النادل البشري. الاختيار الذي يخسر أحيانًا يكون الأذكى: صوت هادئ، رسمي قليلًا، لا يحاول إضحاك الضيف ولا التقرّب منه. الصوت الذي «يحاول» يخسر. الصوت الذي يخدم يحترم. الفاخر لا يحتاج صوتًا ودودًا، يحتاج صوتًا حاضرًا.',
      'الخطوة الرابعة: راجع الشخصية كل ثلاثة أشهر. الصوت الذي يصلح لموسم قد لا يصلح لآخر. في الصيف، الضيوف يريدون إيقاعًا أسرع. في الشتاء، أبطأ. في المناسبات، أكثر رسمية. لا تحبس صوت مطعمك في خيار واحد — اترك نفسك حرية التغيير. الأداة الجيدة تتيح لك ذلك دون أن تطلب منك إعادة بناء المساعد.',
      'في النهاية، الشخصية الصوتية لمطعمك ليست قرارًا تقنيًا. هي قرار في روح المكان. كلما احترمته أكثر، احترمك الضيف أكثر.',
    ],
    bodyEn: [
      'When a luxury restaurant owner thinks of a voice assistant, the first question that comes to mind is “which voice will my guests like?” This question is natural but begins from the wrong end. The voice the guest likes matters less than the voice that serves your restaurant. The guest enters your restaurant by their own choice — they love it or hate it — but they come expecting the spirit of the place, not the sound of an assistant who would not exist without that place.',
      'First step: begin with your restaurant’s character, not your voice. A heritage family restaurant from 1962 does not suit a cheerful young voice; a modern tasting-menu restaurant does not suit an overly formal one. Write one sentence describing your restaurant: “We are a heritage family restaurant, serving authentic oriental cuisine, with warm service that is not overly familiar.” From this sentence, every voice decision begins.',
      'Second step: test before you publish. Reading about voices on a settings page is not enough, and listening to a five-second sample is not enough. Write three sentences the assistant is likely to say in real service — “Welcome, what may I suggest today?” and “Would you prefer a lighter or heavier dish?” and “I recommend trying the seasonal dish” — and listen to them in every available voice. The difference between voices shows in long answers, not in the greeting.',
      'Third step: do not choose a voice that imitates a human waiter. The choice that sometimes loses can be the smarter one: a quiet, slightly formal voice, one that does not try to make the guest laugh or to grow close to them. The voice that tries loses. The voice that serves respects. Luxury does not need a friendly voice — it needs a present voice.',
      'Fourth step: review the persona every three months. The voice that suits one season may not suit another. In summer, guests want a faster pace. In winter, slower. On special occasions, more formal. Do not lock your restaurant’s voice into one choice — leave yourself the freedom to change. A good tool lets you do that without rebuilding the assistant.',
      'In the end, your restaurant’s voice persona is not a technical decision. It is a decision about the spirit of the place. The more you respect it, the more your guest respects you in return.',
    ],
    dateIso: '2026-11-14',
    readingTimeMin: 5,
    authorAr: 'فريق SooVoice التحريري',
    authorEn: 'SooVoice editorial team',
  },
  {
    slug: 'multi-language-per-table-why-it-matters',
    category: 'service',
    categoryLabelAr: 'الخدمة',
    categoryLabelEn: 'Service',
    titleAr: 'لماذا يفتح بعض ضيوفك المنيو بلغة أخرى — ولماذا هذا مهم',
    titleEn: 'Why some of your guests open the menu in another language — and why it matters',
    excerptAr:
      'في المطاعم الفاخرة التي تستقبل ضيوفًا من جنسيات مختلفة، قراءة المنيو باللغة المناسبة ليست تفصيلة، بل لحظة ضيافة صامتة.',
    excerptEn:
      'In luxury restaurants that host guests from many nationalities, reading the menu in the right language is not a detail — it is a quiet moment of hospitality.',
    bodyAr: [
      'تخيل ضيفًا يدخل مطعمك الفاخر في القاهرة، وهو لا يتكلم العربية. يُجَلس على الطاولة، يحاول قراءة المنيو، يطلب مساعدة النادل الذي — رغم حرصه — يجد صعوبة في شرح الأطباق بالإنجليزية. الضيف يطلب بيتزا لأنها الكلمة الوحيدة التي يعرفها، رغم أن المطعم يقدّم أطباقًا يستحق تجريبها أكثر. النادل يكسب طلبًا، لكن الضيف يخسر تجربة.',
      'في التجربة التي بنيناها، صاحب المطعم يستطيع أن يُسند لكل طاولة لغة افتتاحية: طاولة 1 بالعربية افتراضًا، طاولة 5 بالإنجليزية، طاولة 7 بالفرنسية. حين يفتح الضيف QR الطاولة، المنيو يبدأ بلغته. لا يحتاج أن يبحث عن زر «EN» في زاوية الشاشة، ولا أن يسأل النادل. اللغة موجودة، كأنها جزء من الطاولة.',
      'هذا التفصيل قد يبدو صغيرًا. لكنه ليس صغيرًا في لحظته. الضيف الذي يدخل مطعمًا لأول مرة، في بلد ليس لغته الأم، يبحث عن إشارة أنه مرغوب. اللغة إشارة قوية: «نحن نعرف أنك هنا، ونتكلّف عناء تجهيز المنيو لك». حين يفتح الكود ويرى لغته، يهدأ قليلًا. يقرأ بثقة. يسأل المساعد الصوتي بلا حواجز. يأكل ما يريد، لا ما يجرؤ على طلبه.',
      'الجمال في هذا النظام أنه خفي. صاحب المطعم يُسند اللغة مرة واحدة من لوحة الـ floor plan، وينساها. الضيف لا يرى الزر، لا يرى الإعداد — يرى فقط المنيو بلغته، كأنه وُلد هكذا. أما المطعم الذي يفعل ذلك، فيُلاحَظ بغياب ما يُلاحَظ عند غيره: لا أحد يسأل «هل فيه منيو إنجليزي؟».',
      'الفاخر في الضيافة لا يعني الفخامة الظاهرة. يعني الراحة الخفية. حين تخدم ضيفك دون أن يطلب، حين تجهّز له ما يحتاج قبل أن يعرف أنه يحتاجه — هناك تكون قد وصلت.',
    ],
    bodyEn: [
      'Imagine a guest entering your luxury restaurant in Cairo, who does not speak Arabic. They are seated at the table, try to read the menu, and call the waiter — who, despite good intentions, struggles to explain the dishes in English. The guest orders a pizza because it is the only word they recognize, even though the restaurant offers dishes worth trying more. The waiter earns an order; the guest loses an experience.',
      'In the experience we built, the owner can assign each table a default language: table 1 in Arabic by default, table 5 in English, table 7 in French. When the guest scans the QR on the table, the menu opens in their language. They do not need to look for an “EN” button in the corner, or to ask the waiter. The language is there, as if part of the table itself.',
      'This detail may seem small. But it is not small in its moment. A guest entering a restaurant for the first time, in a country where they do not speak the language, looks for a signal that they are welcome. Language is a strong signal: “we know you are here, and we took the trouble to prepare the menu for you.” When they scan the code and see their language, they relax a little. They read with confidence. They ask the voice assistant without barriers. They eat what they want, not what they dared to order.',
      'The beauty of this system is its quietness. The owner assigns the language once from the floor plan panel and forgets it. The guest does not see the button, does not see the setting — they see only the menu in their language, as if it were born that way. And the restaurant that does this is noticed by what is absent at other places: no one asks “do you have an English menu?”',
      'Luxury in hospitality is not visible opulence. It is quiet comfort. When you serve your guest without their asking, when you prepare for them what they need before they know they need it — there you have arrived.',
    ],
    dateIso: '2026-11-13',
    readingTimeMin: 4,
    authorAr: 'فريق SooVoice التحريري',
    authorEn: 'SooVoice editorial team',
  },
  {
    slug: 'what-the-numbers-tell-you-about-your-service',
    category: 'field-notes',
    categoryLabelAr: 'ملاحظات ميدانية',
    categoryLabelEn: 'Field notes',
    titleAr: 'ما تخبرك به الأرقام عن خدمتك — وما لا تخبرك به',
    titleEn: 'What the numbers tell you about your service — and what they don\u2019t',
    excerptAr:
      'لوحة التحليلات ليست لمعرفة كم ضيف جاء. هي لمعرفة كم ضيف لم يعد — ولماذا. هذه قراءة في ما تكشفه الأرقام وما تخفيه.',
    excerptEn:
      'The analytics dashboard is not for knowing how many guests came. It is for knowing how many did not return — and why. A reading of what numbers reveal and what they hide.',
    bodyAr: [
      'حين يطلب صاحب مطعم فاخر لوحة تحليلات، يظن عادةً أنه يريد أن يرى «كم ضيف جاء». هذا خطأ. لوحة التحليلات التي تقول «500 ضيف هذا الأسبوع» لا تخدم أحدًا. هي تُطمئن صاحب المطعم لخمس ثوانٍ، ثم تُنسى. لوحة التحليلات الفعلية تخبره بأشياء لا يعرفها، لا بأشياء يعرفها.',
      'أول رقم يستحق القراءة: متى يبدأ ضيوفك بالسؤال؟ لو لاحظت أن معظم الأسئلة عن طبق الموسم تأتي بين السابعة والثامنة مساءً، فهذا وقت الذروة. هذا يعني أن نادلًا إضافيًا في هذه الساعة قد يرفع متوسط طلب الطاولة. ليس تخمينًا — رقم. أما الساعة التي لا يأتي فيها أي سؤال، فهي ساعة ضائعة: يمكن استثمارها في تنظيف، أو إغلاق طبق غير مطلوب.',
      'ثاني رقم: أكثر الأطباق سؤالاً. حين تكتشف أن طبقًا معينًا يُسأل عنه 80 مرة في الشهر لكنه لا يُطلب إلا 3 مرات، فهذه إشارة. إما أن المساعد لا يجيب عنه بوضوح، أو أن سعره غير متناسب مع توقعات الضيف بعد سماع المكونات. التغيير الصغير — تحسين وصف الطبق، أو تعديل سعره — قد يحوّل فضولًا إلى طلب.',
      'ثالث رقم: نسبة محادثات الـ chef specials. لو فتح 60% من الضيوف المنيو، لكن 5% فقط سألوا عن «أطباق الشيف السرية»، فالإشارة أن الطريقة التي يُعرض بها هذا القسم على المساعد الصوتي غير فعّالة. ربما يحتاج تلميحًا أقوى في تحية المساعد، أو تذكيرًا على الطاولة بأن الأطباق السرية موجودة.',
      'هذه الأرقام لا تخبرك بالقصة كاملة. لا تخبرك أن ضيفًا معينًا لم يعد لأن النادل أخطأ في طلبه. لا تخبرك أن المطعم يفقد ضيوفه لأن الوقت المتأخر زاد دون إنذار. لا تخبرك أن جودة الطعام تراجعت. لكنها تُلمح. تشير. تُذكّرك بأن تسأل.',
      'أخيرًا: لوحة التحليلات ليست استبدالاً للحديث مع النادل. هي تكمل له. حين ترى رقمًا غريبًا، اسأل النادل عن تفسيره. النادل الذي يعمل في الصالة كل يوم يرى ما لا تراه الأرقام. والأرقام ترى ما ينساه النادل في زحمة الخدمة. الاثنان معًا — لا واحد منهما — هما الطريق.',
    ],
    bodyEn: [
      'When a luxury restaurant owner asks for an analytics dashboard, they usually think they want to see “how many guests came.” This is a mistake. A dashboard that says “500 guests this week” serves no one. It comforts the owner for five seconds, then is forgotten. A real dashboard tells them things they do not know, not things they already know.',
      'First number worth reading: when do your guests start asking? If you notice that most questions about the seasonal dish come between seven and eight in the evening, that is peak time. It means an extra waiter at that hour may raise the table-average order. Not a guess — a number. As for the hour when no questions come, it is a lost hour: it can be invested in cleaning, or in removing a dish nobody asks for.',
      'Second number: the most-asked dishes. When you find that a certain dish is asked about 80 times a month but ordered only three times, that is a signal. Either the assistant does not describe it clearly, or its price does not match what the guest expects after hearing the ingredients. A small change — refining the dish description, or adjusting its price — may turn curiosity into an order.',
      'Third number: the share of chef-specials conversations. If 60% of guests open the menu, but only 5% ask about the “secret chef dishes,” that signals the way this section is presented to the voice assistant is not effective. It may need a stronger hint in the assistant’s greeting, or a quiet reminder on the table that the secret dishes exist.',
      'These numbers do not tell the whole story. They do not tell you that a particular guest did not return because the waiter got their order wrong. They do not tell you the restaurant is losing guests because late hours extended without notice. They do not tell you food quality dropped. But they hint. They point. They remind you to ask.',
      'Finally: the analytics dashboard is not a replacement for talking to the waiter. It complements them. When you see a strange number, ask the waiter for their interpretation. The waiter who works the floor every day sees what the numbers do not. And the numbers see what the waiter forgets in the rush of service. Both together — not either alone — is the way.',
    ],
    dateIso: '2026-11-08',
    readingTimeMin: 6,
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
