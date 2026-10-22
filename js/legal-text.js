// Legal text for Ace It (ACEIT): the Terms of Service and the Privacy Policy, kept as plain data.
// Pure data with no imports, so Node tests can load it directly (see tools/test_legal.mjs).
// Rules for editing: ASCII only, no backslashes, no double quotes inside a string, no raw line breaks inside a string.
// Inline emphasis uses the app's markdown subset: **bold** and *italic* only. No email addresses, phone numbers or web addresses.
// When the wording changes in a way that matters, raise the version and the date below. Users are then asked to accept again.

export const TERMS_VERSION = "1.0";
export const TERMS_UPDATED = "2026-10-21";
export const PRIVACY_VERSION = "1.0";
export const PRIVACY_UPDATED = "2026-10-21";

export const TERMS = {
  title: "Terms of Service",
  version: TERMS_VERSION,
  updated: TERMS_UPDATED,
  intro: [
    "Welcome to Ace It, also written ACEIT. Ace It is a small study app that offers course summaries, flashcards, quizzes, games, notes and progress tracking to help students learn and revise.",
    "These Terms of Service (the **Terms**) are a legal agreement between you and the Owner of Ace It. They explain what you can expect from the Service and what we expect from you. Please read them carefully before you create an account or use the Service.",
    "By ticking the box when you sign up, or by accepting an updated version when you are asked to, you agree to be bound by these Terms and by our Privacy Policy. If you do not agree, please do not create an account and do not use the Service.",
    "The Privacy Policy is a separate document that explains what personal information we collect, why we collect it, how we protect it and what choices you have. These Terms and the Privacy Policy refer to each other and should be read together. Both are available inside the Service at any time.",
    "Ace It is created and run by an individual student. It is not a company, a school or a government body. These Terms are written to be clear and fair, and they also contain the protections that allow one person to operate the Service safely."
  ],
  sections: [
    {
      id: "definitions",
      title: "Definitions",
      paras: [
        "In these Terms, the words below have the meanings shown. A defined word has the same meaning whether it is used in the singular or the plural."
      ],
      items: [
        "**Service** means Ace It, also written ACEIT: the study app and website, the Course Materials, the flashcards, quizzes, games, notes, glossaries and progress features, the sharing and challenge features, Customer Service, and any updates, new features or related tools that we provide.",
        "**Owner**, **we**, **us** and **our** mean the individual student in Alberta, Canada, who created and owns Ace It. The Owner is an individual and not a school, college, university or company.",
        "**You** and **User** mean the person who creates an Account or otherwise uses the Service.",
        "**Account** means the personal profile, login details and stored information that you create in order to use the Service.",
        "**Course Materials** mean the summaries, explanations, glossaries, questions, flashcards, quizzes, games, diagrams and other educational material made available through the Service.",
        "**User Content** means anything that you submit to or create in the Service, including questions, flashcards, notes, feedback, reviews, ratings, profile photos and support questions.",
        "**Class Code** means a code issued by an Instructor or School Manager that lets a Student join a particular class in the Service.",
        "**Customer Service** means the in-app contact feature found under *Profile*, then *Customer Service*, then *Ask a question*.",
        "**Privacy Policy** means the separate Privacy Policy published inside the Service, in the version in force from time to time.",
        "**Age of majority** means the age at which a person is legally an adult in the province or territory where that person lives. In Alberta it is 18."
      ]
    },
    {
      id: "interpretation",
      title: "How to Read These Terms",
      paras: [
        "In these Terms, the word including means including without limitation. A reference to a law includes that law as amended or replaced. Where we describe a feature of the Service, that does not mean the feature will always be available, because the Service may change as described in the section *Changes to the Service, Suspension and Shutdown*.",
        "References to a section are to the section with that title in these Terms. Examples are given to help you understand a rule and do not limit it."
      ]
    },
    {
      id: "acceptance",
      title: "Acceptance of the Terms",
      paras: [
        "You accept these Terms when you tick the box at sign-up that confirms you have read and agree to the Terms of Service and the Privacy Policy, and then create your Account. The box is never ticked for you, and you cannot create an Account unless you tick it.",
        "When you accept, we store a record of the date and time of your acceptance and the version of the Terms and the Privacy Policy that you agreed to. We keep this record so that we can show what was agreed. It is also described in the Privacy Policy.",
        "From time to time we may publish a new version of the Terms. When that happens, existing users are asked to review and accept the new version the next time they log in. You may be unable to keep using the Service until you accept it. If you do not wish to accept a new version, you may stop using the Service and ask us to delete your Account as described in the section *Account Deletion*.",
        "You agree that ticking the box, creating an Account, and accepting a new version when asked are each a valid electronic signature and form a binding agreement to the extent the law allows. You also agree that we may keep and rely on our electronic records of your acceptance.",
        "These Terms apply to every use of the Service, including limited uses without an Account, such as any demonstration mode that we may offer."
      ]
    },
    {
      id: "purpose",
      title: "Purpose of Ace It",
      paras: [
        "Ace It is built for the academic development of its creator as a student, and for classmates and other students who may benefit from it. It is a personal, student-run project that grew out of the creator's own studying.",
        "It is not a commercial tutoring company, and it is not a school. Ace It is not affiliated with, endorsed by or sponsored by any school, university, college, instructor, publisher or other institution unless the Service clearly says so. The names of courses, schools and instructors appear only to help you organize your studying.",
        "We do not charge a fee for the Service at the date of these Terms. If we introduce paid features in the future, we will describe them separately, and you will not be charged unless you clearly agree to them.",
        "Because the Service is a student project, it may change quickly. We ask for your understanding if features are added, changed or removed."
      ]
    },
    {
      id: "eligibility",
      title: "Eligibility and Age Requirement",
      paras: [
        "You must be at least 13 years old to create an Account or use the Service. If you are under 13, you must not use the Service. If we learn that an Account belongs to a person under 13, we will close it and delete the information associated with it.",
        "If you are 13 or older but have not yet reached the age of majority where you live, you may use the Service only with the permission of a parent or legal guardian. The age of majority is 18 in Alberta and 19 in some other provinces and territories. By creating an Account you confirm that you have that permission. A parent or guardian who permits a minor to use the Service agrees to these Terms on the minor's behalf and shares responsibility for the minor's compliance with them.",
        "You must not use the Service if the law bars you from doing so, or if we have previously removed your Account for breaking these Terms and have not clearly allowed you to return.",
        "The Service is designed for students in Canada, but it can be reached from other countries. If you use it from elsewhere, you are responsible for following the laws that apply to you.",
        "You confirm that you meet every requirement in this section when you create your Account and each time you use the Service."
      ]
    },
    {
      id: "accounts",
      title: "Your Account and Roles",
      paras: [
        "To use most features you need an Account. You agree to give accurate and current information, including a working email address and a first name or display name, and to keep that information up to date. You must not use another person's name or identity in a misleading way.",
        "An Account is for one person only. You must not share your Account, let anyone else log in as you, or create accounts for other people without their knowledge. If you are a minor, a parent or guardian may help you, but the Account remains yours.",
        "Some classes in the Service are joined with a Class Code. Use a Class Code only for a class that you are entitled to join. Do not post Class Codes publicly or share them with people outside the class.",
        "Every Account has a role, which determines what you can see and do in the Service. Roles are assigned by the Service according to the Class Codes you use, or by the Owner. You must not try to obtain a role that you have not been given. Instructors and School Managers act for themselves or for their schools. The Owner does not employ or supervise them, and is not responsible for what an Instructor or School Manager says or adds to a class. The roles are:"
      ],
      items: [
        "**Student:** a person who uses the Service to study, joins classes with Class Codes, and sees their own progress.",
        "**Instructor:** a person who teaches a class in the Service. An Instructor can see the name, email address and progress of the Students in that Instructor's class, and can add or manage class material as the Service permits.",
        "**School Manager:** a person who looks after a school or a group of classes in the Service. A School Manager can see the same information for the classes of that school.",
        "**Administrator:** a person who operates the Service on behalf of the Owner. An Administrator can manage Accounts, classes and Course Materials, and can access Account information to the extent needed to run, secure and support the Service."
      ]
    },
    {
      id: "acceptable-use",
      title: "Account Rules and Acceptable Use",
      paras: [
        "You are free to use the Service for your own learning, and we want it to be a respectful place for everyone. When you use the Service, you agree to follow the law, to respect other people, and to follow the rules in this section and in the section *Security and Your Account*.",
        "You agree that you will not do, attempt or encourage any of the following:"
      ],
      items: [
        "break any law or regulation, or infringe the rights of any person, including privacy and intellectual property rights;",
        "harass, bully, threaten, intimidate or discriminate against anyone, or submit hateful, violent, sexually explicit or otherwise inappropriate material;",
        "impersonate another person, or misrepresent your identity, your role, your school or your relationship with anyone;",
        "use the Service to cheat in your studies or to help others to cheat, including by sharing confidential assessment questions or by breaking the academic integrity rules of your school;",
        "post or share personal information about another person without that person's permission;",
        "send spam, advertising, chain messages or other unsolicited promotions;",
        "use the Service, its Course Materials or its data for commercial purposes, such as a tutoring business or resale, without the Owner's written permission;",
        "interfere with other people's use of the Service or with the studying of other Students;",
        "collect, or try to collect, information about other users, or try to access another person's Account, class or data;",
        "submit User Content that you have no right to submit; or",
        "do anything that could damage the Service, the Owner, or the reputation of either."
      ]
    },
    {
      id: "security",
      title: "Security and Your Account",
      paras: [
        "You are responsible for keeping your password and your Account secure. Choose a strong password that you do not use anywhere else, keep it confidential, and log out of shared or public devices. The Service lets you log out of every device where you are signed in, and you should use that option if you think someone else has your password.",
        "You are responsible for all activity that happens under your Account, whether or not you authorized it, unless the activity results from our failure to use the reasonable safeguards described in these Terms and in the Privacy Policy. If you suspect that your Account has been accessed without your permission, tell us right away through Customer Service.",
        "To protect the Service, its users and the Owner, you agree not to do, attempt, or help anyone else to do, any of the following:"
      ],
      items: [
        "hack, probe, scan or test the Service or the systems behind it for weaknesses, or access any part of the Service, any data or any Account that you are not authorized to access;",
        "scrape, crawl, harvest or copy the Service or its content by automated or bulk means;",
        "reverse engineer, decompile, disassemble or try to extract the source code, structure or database of the Service, except to the extent that the law does not allow this restriction;",
        "use bots, scripts, macros, browser extensions that automate actions, or any other automated or non-human means to access the Service, or to answer questions, play games or earn rewards;",
        "cheat, or use any exploit, glitch or vulnerability, to tamper with scores, streaks, badges, XP, levels, challenges, the 60-second sprint, flashcard schedules or any other progress or reward record, including by editing network requests, browser storage or the code of the app;",
        "bypass, disable, test or overload any protection, access control, role restriction, rate limit or other security feature of the Service;",
        "send requests, traffic or data at a volume or in a way that could slow down, disrupt or overload the Service;",
        "upload or transmit any virus, malware, harmful code or file designed to interfere with the Service or with any device;",
        "share your Account with others, or post Class Codes or login details publicly; or",
        "assist, encourage or enable anyone else to do any of these things."
      ]
    },
    {
      id: "security-enforcement",
      title: "Security Enforcement and Reporting Vulnerabilities",
      paras: [
        "If we believe, in our sole discretion, that you have broken or tried to break the rules on security or acceptable use, we may suspend, restrict or terminate your Account immediately and without notice. We may also remove or reset any affected scores, badges, XP, streaks or other records, remove User Content, and take any other step that the law allows, including reporting the matter to your school, to the police or to other authorities, and seeking legal remedies. We are not required to explain our reasons, and we are not required to restore anything that we remove for these reasons.",
        "No system is completely secure. We use reasonable safeguards, which are described in the Privacy Policy, but we cannot promise that the Service will never be accessed, disrupted, damaged or misused without authorization. To the maximum extent permitted by law, the Owner is not liable for unauthorized access to, or use or disclosure of, your Account or your information, except to the extent that it results from our failure to use reasonable safeguards, and then only as limited by the section *Limitation of Liability*.",
        "If you discover a security weakness or a way to cheat, please report it through Customer Service. Do not exploit it, do not access more information than you need to show the problem, do not tell others how to exploit it, and give us a reasonable time to fix it before you discuss it publicly. We will not take action against a person only because that person made a good-faith report that follows this paragraph.",
        "We will never ask you for your password. If anyone claims to be the Owner and asks for your password, do not give it, and tell us through Customer Service."
      ]
    },
    {
      id: "data-use",
      title: "Use of Data",
      paras: [
        "The Service records information about how you study, including your progress, answers, scores and activity. You agree that the Owner may use this information to operate the Service, to improve the Course Materials, for example by finding questions that are unclear, too easy or too hard, and for the development, testing and security of the app.",
        "Wherever possible we use this information in aggregated or anonymized form. Aggregated means combined with the information of many other users. Anonymized means stripped of details that identify you, so that it cannot reasonably be used to identify you.",
        "Your personal information is never sold. We also do not use it for advertising: the Service contains no advertising, and we do not share personal information with advertisers, data brokers or marketing companies.",
        "Instructors and School Managers of a class that you join can see your name, email address and progress for that class, so that they can support you and see how the class is doing. This is explained in the Privacy Policy, which also describes the rest of what we collect, who can see it, how long we keep it, and your rights.",
        "The Privacy Policy forms part of these Terms. If these Terms and the Privacy Policy differ on how personal information is handled, the Privacy Policy prevails."
      ]
    },
    {
      id: "user-content",
      title: "Your Content",
      paras: [
        "You keep ownership of the User Content that you submit. These Terms do not transfer that ownership to us.",
        "To run and improve the Service, you grant the Owner a worldwide, non-exclusive, royalty-free licence to use, store, reproduce, adapt and display your User Content. The licence lets us, for example, save your notes and flashcards, show your review or rating inside the Service, resize your profile photo, read your support questions, and use your feedback to improve the Course Materials. We may allow the providers who help us run the Service to use this licence on our behalf, but only for that purpose.",
        "The licence lasts for as long as we hold the User Content. It also covers copies in backups that have not yet been deleted, and aggregated or anonymized information made from your User Content that can no longer be linked to you.",
        "You promise that you own your User Content or have the right to submit it, that it does not infringe anyone's rights, that it does not break the law or these Terms, and that it does not include personal information about other people unless they have agreed. Do not submit sensitive information such as health details, government identification numbers or financial information.",
        "Profile photos must be appropriate for a school audience. They must not contain nudity, violence, hateful symbols or unlawful material, must not show another person without that person's permission, and must not use images that you have no right to use. We may remove any profile photo, and replace it with a default avatar, at any time.",
        "We are not required to monitor User Content, but we may review, refuse, edit or remove any User Content at any time and for any reason, including where we believe that it breaks these Terms. If you give us suggestions or feedback, we may use them freely and without any obligation to you.",
        "Material that an Instructor adds to a class is the responsibility of that Instructor."
      ]
    },
    {
      id: "intellectual-property",
      title: "Intellectual Property",
      paras: [
        "The Service belongs to the Owner or to the Owner's licensors. This includes the names Ace It and ACEIT, the logo, the design and layout, the badge artwork, the code, and the Course Materials created for the Service. These are protected by copyright and other laws, and all rights that are not expressly granted to you are reserved.",
        "Subject to these Terms, we grant you a limited, personal, non-commercial, non-exclusive, non-transferable and revocable licence to access and use the Service for your own study. This licence ends when your Account ends or when we withdraw it under these Terms.",
        "You must not copy, reproduce, publish, distribute, sell, rent, sublicense or make derivative works of the Service or any part of it. You must not remove copyright or ownership notices, or use the name, logo or badge artwork of Ace It in a way that suggests endorsement or confuses people, without our written permission. Using the sharing features of the Service, and telling your classmates about it, is fine.",
        "Some Course Materials are study aids that draw on teaching materials created by instructors, publishers and other authors. Those original materials, and the copyright in them, remain the property of their owners, and our summaries and questions do not transfer or replace those rights. Please respect the copyright of your instructors and of the publishers of your course materials, and do not use the Service to copy or redistribute their work.",
        "If you are a rights holder and you believe that something in the Service infringes your rights, tell us through Customer Service. Please identify the work, say where it appears in the Service, and explain your connection to it. We will review the report in good faith and, where appropriate, remove or correct the material."
      ]
    },
    {
      id: "educational-disclaimer",
      title: "Educational Disclaimer",
      paras: [
        "Ace It is a study aid. It is not a substitute for attending class, reading your assigned materials, doing your assignments or following your instructor's directions, and it does not guarantee any grade, credit, standing, qualification or other result.",
        "The Course Materials may contain errors, omissions, simplifications or out-of-date information. They may not match your course syllabus, which depends on your instructor, your school, the term and the way your course is delivered, whether in person, online or in a hybrid format. Different instructors may emphasize different topics, use different terms or test in different ways.",
        "Always follow your instructor's and your school's official materials, announcements and assessment instructions. If something in the Service conflicts with them, the official materials are the ones to follow.",
        "Scores, levels, mastery indicators and progress bars are estimates intended to help you plan and stay motivated. They are not predictions of your results, and they are not an official record of your learning.",
        "You are responsible for following the academic integrity rules of your school. Do not use the Service in any assessment, test or exam where its use is not allowed.",
        "The Course Materials are educational information only. They are not professional, safety, legal or medical advice. If you find an error, please let us know through Customer Service so that we can correct it."
      ]
    },
    {
      id: "sharing-notifications",
      title: "Notifications, Sharing and Challenges",
      paras: [
        "The Service can show notifications inside the app and, if you allow it in your browser or device, send optional device notifications. You can turn notifications on or off at any time in the settings in your *Profile*. You can also change the permission in your browser or device settings. We do not send marketing notifications. We may still show or send important messages about your Account, such as security notices or changes to these Terms.",
        "You can share links with friends to games, scores and challenges, using the share sheet provided by your browser or operating system. A link contains the game, the score and your first name. A person who opens the link sees that information, and needs an Account of their own to play or to take up a challenge. Recipients do not see your email address, your other scores or your progress through the link.",
        "Because the information is carried in the link itself, anyone who receives the link, or who sees it where you post it, may be able to read your first name and the score. Share links only with people you trust. Once a link is sent, we cannot control where it goes, or what the app you used to send it does with it.",
        "Challenges are friendly competitions for fun and study. There are no prizes and no wagering. The rules, scoring and availability of challenges may change, and results that we believe were obtained in breach of these Terms may be removed or reset.",
        "Do not use sharing or challenges to harass, spam or pressure other people. The Privacy Policy explains in more detail what is in a sharing link and how notifications work."
      ]
    },
    {
      id: "third-party",
      title: "Third-Party Services",
      paras: [
        "The Service depends on services provided by other companies. At the date of these Terms, these include a cloud database and authentication provider, Supabase, which stores account and study data; a code hosting provider and static website hosting service, GitHub and GitHub Pages, which deliver the app to your browser; and the share sheet, notification and storage features of your own browser and operating system.",
        "These third parties operate under their own terms and privacy practices, which apply when you use their services. We do not control them. The Owner is not responsible for the actions, omissions, outages, security incidents, policies or content of any third party, or for any fee that your internet provider or mobile carrier charges you for using the Service.",
        "We try to choose reliable providers, but if a provider changes its service, has an outage or ends its relationship with us, the Service may be affected or may stop working.",
        "If the Service ever links to another website or service, we provide the link for convenience only, and we do not endorse or control what is on the other side of it."
      ]
    },
    {
      id: "warranties",
      title: "Disclaimer of Warranties",
      paras: [
        "To the maximum extent permitted by law, the Service and all Course Materials are provided **as is** and **as available**, without warranties of any kind, whether express or implied.",
        "This means that we do not promise or guarantee, among other things, that the Service will meet your needs, that it will be available without interruption, that it will be secure, accurate, complete or error-free, that defects will be corrected, that information you get from it is reliable, or that it will be free of viruses or other harmful components. We disclaim all implied warranties and conditions, including those of merchantability, fitness for a particular purpose, quiet enjoyment and non-infringement.",
        "You use the Service at your own risk. No advice or information that you get from the Owner or through the Service creates a warranty that is not expressly written in these Terms.",
        "Some jurisdictions do not allow certain warranties to be excluded. In those places, the exclusions above apply only as far as the law permits."
      ]
    },
    {
      id: "liability",
      title: "Limitation of Liability",
      paras: [
        "To the maximum extent permitted by law, the Owner will not be liable to you for any indirect, incidental, special, consequential, exemplary or punitive damages, or for any loss of profits, loss of data, loss of grades or marks, loss of academic standing, loss of opportunities, loss of goodwill or other intangible loss, arising out of or in connection with the Service or these Terms, however caused and on any legal theory, even if we have been told that such loss is possible.",
        "This includes losses caused by errors in the Course Materials, by the loss or corruption of your progress or other data, by unauthorized access to your Account, by the unavailability of the Service, by the conduct of other users, Instructors or School Managers, or by the acts of third-party providers.",
        "To the maximum extent permitted by law, the total liability of the Owner to you for all claims arising out of or relating to the Service or these Terms, whether in contract, in tort including negligence, or otherwise, will not exceed 100 Canadian dollars.",
        "Some jurisdictions do not allow certain limits or exclusions of liability, for example for death or personal injury caused by negligence, or for fraud or wilful misconduct, and some give consumers rights that cannot be waived. In those cases the limits in these Terms apply only as far as the law permits, and nothing in these Terms limits any right you have that cannot lawfully be limited.",
        "You acknowledge that these limits are a fair allocation of risk for a Service that is provided to you free of charge by an individual student, and that the Service would not be offered without them."
      ]
    },
    {
      id: "indemnification",
      title: "Indemnification",
      paras: [
        "You agree to defend, indemnify and hold harmless the Owner from and against any claims, demands, losses, liabilities, damages, costs and expenses, including reasonable legal fees, that arise out of or relate to your breach of these Terms, your User Content, your misuse of the Service, your violation of any law or of any person's rights, or any activity under your Account for which you are responsible under these Terms.",
        "Where practical, we will tell you promptly about a claim, and you agree to cooperate reasonably with us. The Owner may take control of the defence of any claim at their own expense, and doing so does not release you from your obligations under this section.",
        "If you are a minor, this section applies to you only as far as the law permits. A parent or guardian who permits a minor to use the Service also accepts responsibility under this section, again only as far as the law permits."
      ]
    },
    {
      id: "service-changes",
      title: "Changes to the Service, Suspension and Shutdown",
      paras: [
        "We may change, add, suspend or remove any part of the Service at any time and for any reason. This includes features, Course Materials, scores, badges, challenges and the way progress is calculated. We may also limit access, take the Service offline for maintenance, or stop providing the Service altogether.",
        "Where practical, we will make reasonable efforts to give notice of significant changes, for example through a message in the app. We are not required to give notice, and sudden changes may be needed for security, legal or technical reasons.",
        "If we decide to close the Service completely, we will try to give you time to download your data using the *Download my data* option in your *Profile*. We are not liable to you or to anyone else for any change, suspension or shutdown of the Service, or for the loss of any information that results from it."
      ]
    },
    {
      id: "account-deletion",
      title: "Account Deletion",
      paras: [
        "You may ask us to delete your Account at any time. To do so, send a request through Customer Service by going to *Profile*, then *Customer Service*, then *Ask a question*. Before you ask, you may wish to use *Download my data* in your *Profile* to keep a copy of your information.",
        "When we receive your request, your Account is scheduled for deletion. It is then permanently deleted after a grace period of 22 days. This gives you time to change your mind.",
        "If you log in again with the same email address within the 22 days, the deletion is cancelled automatically and your Account is restored. If you do nothing, then when the 22 days end the deletion is permanent. It cannot be undone, and we will not be able to recover your Account, your progress or your other information.",
        "Permanent deletion removes the information that identifies you and the study records linked to you, as the Privacy Policy describes. Some information may remain for a limited time. Backups are overwritten on a cycle, records of Customer Service questions and of your acceptance of the Terms may be kept for a limited period for legal reasons, and aggregated or anonymized information that no longer identifies you may be kept. The Privacy Policy sets out those periods.",
        "Links that you shared before deletion may stop working. Deleting your Account does not take back information that other people received from you before the deletion, such as a score that a friend saw.",
        "These Terms continue to apply to anything that happened before the deletion, and the sections that are meant to survive the end of your Account, listed in the section *General Provisions*, continue to apply afterwards."
      ]
    },
    {
      id: "termination",
      title: "Suspension and Termination by the Owner",
      paras: [
        "We may suspend, restrict or terminate your Account, or your access to any part of the Service, at any time. We may do this without notice if you break these Terms, in particular the rules on acceptable use and security, if we believe that your use puts the Service, other users or the Owner at risk, if we are required to by law, or if the Service is discontinued. In other cases we will make reasonable efforts to give notice where practical.",
        "If your Account is suspended or terminated, your licence to use the Service ends immediately. We may delete your Account and the information in it, subject to the Privacy Policy, and we may keep limited records that we need to enforce these Terms and to prevent a person from returning after being removed. We are not required to return your content or progress to you.",
        "You may stop using the Service at any time. If you simply stop using it, your Account remains until you ask for it to be deleted or until we close it."
      ]
    },
    {
      id: "retention",
      title: "Data Retention",
      paras: [
        "We keep personal information only for as long as we need it for the purposes described in the Privacy Policy. In general, we keep your Account information and study records while your Account is active, so that your progress stays available to you.",
        "After you ask us to delete your Account, the process in the section *Account Deletion* applies, and the retention periods in the Privacy Policy apply to anything that is kept afterwards. We may also keep information for longer where the law requires it, or where it is reasonably needed to deal with a security incident, abuse of the Service or a legal claim.",
        "Please read the Privacy Policy for the details of what is kept, why, and for how long."
      ]
    },
    {
      id: "changes",
      title: "Changes to These Terms",
      paras: [
        "We may update these Terms from time to time, for example when we add features, change how the Service works, or need to reflect a change in the law. Each version has a version number and a date of last update, which appear at the top of these Terms.",
        "When we publish a new version, we will tell you through a notice in the app. Existing users will be asked to accept the new version on their next login. If you keep using the Service after a change takes effect, or accept the new version when asked, you agree to the updated Terms.",
        "If you do not agree with a new version, you should stop using the Service, and you may ask us to delete your Account. Changes do not apply to a dispute that started before the change. We may correct typing errors and make other changes that do not alter the meaning of the Terms without asking you to accept them again, although the date will still change."
      ]
    },
    {
      id: "governing-law",
      title: "Governing Law and Disputes",
      paras: [
        "These Terms and your use of the Service are governed by the laws of the Province of Alberta and the federal laws of Canada that apply there, without regard to any rules about conflicts of laws.",
        "If you have a concern or a dispute, please start by contacting us through Customer Service and giving us a reasonable opportunity, of at least 30 days, to resolve it informally. Most concerns can be settled this way.",
        "If a dispute cannot be resolved informally, you and the Owner agree that the courts of the Province of Alberta have jurisdiction over it, and you agree to submit to the jurisdiction of those courts. Nothing in this section prevents you from making a complaint to a privacy regulator, or from exercising rights that the law gives you and that cannot be waived."
      ]
    },
    {
      id: "notices",
      title: "Notices",
      paras: [
        "We may give you notice by displaying it in the Service, by showing a message when you log in, or by sending a message to the email address on your Account where we judge that to be appropriate. A notice is effective when we post or send it.",
        "You may contact us, and give us any notice under these Terms, only through Customer Service. We cannot accept notices sent in other ways. You are responsible for keeping the email address on your Account current."
      ]
    },
    {
      id: "accessibility",
      title: "Accessibility",
      paras: [
        "We want the Service to be usable by as many students as possible. The *Profile* includes settings for light and dark appearance, text size, an easy-read font and reduced motion, and these choices are saved on your device. If you find a barrier that stops you from using the Service, please tell us through Customer Service. We will try to find a reasonable way to help, but we cannot promise to meet every need."
      ]
    },
    {
      id: "force-majeure",
      title: "Events Beyond Our Control",
      paras: [
        "The Owner is not responsible for any failure or delay in providing the Service that is caused by events beyond our reasonable control. These include outages or changes at hosting, database or internet providers, power or network failures, cyber attacks, natural disasters, fires, floods, epidemics, strikes, acts of government, and war or civil disturbance. We will try to restore the Service as soon as reasonably possible, but we are not liable for any loss caused by these events."
      ]
    },
    {
      id: "general",
      title: "General Provisions",
      paras: [
        "The following general terms apply to these Terms."
      ],
      items: [
        "**Severability.** If any part of these Terms is found to be invalid or unenforceable, that part will be limited or removed to the smallest extent necessary, and the rest of the Terms will remain in effect.",
        "**Entire agreement.** These Terms, together with the Privacy Policy, are the entire agreement between you and the Owner about the Service, and they replace any earlier understanding about it.",
        "**No waiver.** If we do not enforce a right or a provision of these Terms, that does not mean that we give it up. A waiver is effective only if the Owner makes it clearly and in writing.",
        "**Assignment.** You may not assign or transfer your rights or obligations under these Terms without our written consent. The Owner may assign these Terms, in whole or in part, to a person who takes over the Service, for example if the Service is handed to another student or organization, and we will tell you in the app if that happens. Any attempted assignment in breach of this paragraph is void.",
        "**Survival.** Provisions that by their nature should continue after your Account ends will survive, including those on the licence to User Content, intellectual property, security enforcement, disclaimers, limitation of liability, indemnification, governing law and these general provisions.",
        "**Headings.** Headings are for convenience only and do not affect how these Terms are read.",
        "**Language.** These Terms are written in English. If a translation is offered, the English version prevails.",
        "**No partnership.** Nothing in these Terms makes you and the Owner partners, joint venturers, employees or agents of each other.",
        "**No third-party rights.** Except as these Terms say, no one other than you and the Owner has rights under these Terms."
      ]
    },
    {
      id: "contact",
      title: "How to Contact Us",
      paras: [
        "The only way to contact the Owner about the Service, these Terms or the Privacy Policy is through Customer Service in the app. Go to *Profile*, then *Customer Service*, then *Ask a question*, and write your message there.",
        "We do not provide an email address, a telephone number or a postal address for contact. Please do not include your password or other private information in a message. We read questions as time permits. Because Ace It is run by one student, we cannot promise a particular response time, but we will try to reply within a reasonable period."
      ]
    }
  ]
};

export const PRIVACY = {
  title: "Privacy Policy",
  version: PRIVACY_VERSION,
  updated: PRIVACY_UPDATED,
  intro: [
    "This Privacy Policy explains how Ace It, also written ACEIT, collects, uses, stores, shares and protects personal information, and what choices and rights you have. We have tried to write it in plain language.",
    "Ace It is a small study app created and owned by an individual student in Alberta, Canada, referred to here as the Owner, **we**, **us** and **our**. It is not a school, a college, a university or a company.",
    "This Privacy Policy is separate from, and works together with, our Terms of Service. The Terms of Service and this Privacy Policy refer to each other. When you tick the box at sign-up you agree to both, and we keep a record of the date and time and of the version that you agreed to.",
    "Words that begin with a capital letter, such as Service, Account, Instructor, School Manager and Customer Service, have the meanings given in the Terms of Service."
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who We Are and Scope",
      paras: [
        "The Owner of Ace It is responsible for the personal information described in this Privacy Policy and is the person who answers privacy questions. The Owner is an individual. You can reach us only through Customer Service, which you will find under *Profile*, then *Customer Service*, then *Ask a question*.",
        "This Privacy Policy applies to the Ace It app and website and to the features inside it, including accounts, classes, study tools, games, sharing, challenges, notifications and Customer Service. It does not apply to other websites, apps or services, including those of your school, your Instructors or the providers who help us. Those have their own policies.",
        "Schools, Instructors and School Managers who use Ace It for their classes are separate from us. They are responsible for how they use the information that they see about their Students, in line with their own obligations. We are not a school, and we do not hold your official school records.",
        "We aim to follow the Personal Information Protection and Electronic Documents Act of Canada, called PIPEDA, and the Personal Information Protection Act of Alberta, called PIPA, to the extent that they apply to us. We treat their principles as our standard even where it is not certain that they apply. We do not claim any security certification or audit for the Service."
      ]
    },
    {
      id: "information-collected",
      title: "Information We Collect",
      paras: [
        "We try to collect only the information that we need to run the Service. Some of it you give to us, some of it the Service records as you use it, and some of it our technical providers record automatically. The information falls into these groups:"
      ],
      items: [
        "**Account information.** Your email address, your first name or display name, and your password. Your password is handled by our authentication provider. It is stored only in hashed form and is never visible to us.",
        "**Study data.** Your progress through topics, the answers you give, your quiz and game scores, your streaks, XP, levels and badges, your flashcard review history and schedule, your personal bests including those in the 60-second sprint, and the shares and challenges that you send or receive.",
        "**Class data.** The classes you join, the school that each class belongs to, your role, and exam dates that you or your Instructors set.",
        "**Profile photo or avatar.** The photo, symbol or colour that you choose to represent you, if you choose one.",
        "**Reviews, ratings and feedback.** Anything you write when you rate or review the Service or the Course Materials, or when you send us feedback.",
        "**Customer Service questions.** The questions and messages that you send us through Customer Service, and our replies.",
        "**Terms acceptance record.** The date and time at which you accepted the Terms of Service and this Privacy Policy, and the version of each that you accepted.",
        "**Device data kept in your browser.** Settings and information that your browser stores for the Service, such as your theme, your accessibility choices, your notification choices, a cache of your progress, and a session token that keeps you logged in. See the section *Cookies, Local Storage and Offline Files*.",
        "**Notification preferences.** Whether you have turned notifications on or off and, if you turn on device notifications, the technical details that your browser or device provides so that notifications can be delivered.",
        "**Technical logs and error reports.** Information that the Service and our hosting and database providers record automatically when you use the Service, such as your IP address, the type of browser and device, the time of requests, and error messages. We use these to keep the Service working and secure."
      ]
    },
    {
      id: "not-collected",
      title: "Information We Do Not Collect",
      paras: [
        "The Service has no payments, so we do not collect payment card or bank information. We do not collect your precise location, your contacts or your government identification numbers. We do not use third-party analytics tools or advertising tools that follow you across the web.",
        "Please do not put sensitive information, such as health details or identification numbers, into Customer Service questions, feedback, notes or any other User Content. If you do, we may delete it."
      ]
    },
    {
      id: "how-we-use",
      title: "How We Use Information",
      paras: [
        "We use personal information only for the purposes below, which we identify to you before or when we collect the information. We do not use personal information for advertising, and we do not use it for a new purpose without asking you first. We use it:"
      ],
      items: [
        "to create and run your Account, log you in and keep you signed in;",
        "to save and sync your progress so that it is the same on every device you use;",
        "to show your classes and progress to the Instructors and School Managers of classes that you have joined;",
        "to provide features such as quizzes, games, streaks, badges, flashcard schedules, challenges and sharing;",
        "to send the notifications that you have asked for and important messages about your Account;",
        "to improve the Course Materials and develop the app, in aggregated or anonymized form wherever possible;",
        "to protect the Service and its users, including by detecting cheating, abuse, security threats and errors;",
        "to answer your Customer Service questions and to handle feedback, reviews and reports;",
        "to keep a record of your agreement to the Terms of Service and this Privacy Policy; and",
        "to comply with the law, to respond to lawful requests, and to establish, exercise or defend legal claims."
      ]
    },
    {
      id: "consent",
      title: "Consent and Legal Framework",
      paras: [
        "Canadian privacy law is built around consent. Under PIPEDA and PIPA, an organization collects, uses and discloses personal information with the knowledge and consent of the individual, except where the law allows otherwise.",
        "You give your consent when you tick the box at sign-up to agree to the Terms of Service and this Privacy Policy, and create your Account. For routine activities that are obviously part of using a study app, such as saving your quiz score, we rely on that consent and on the reasonable expectations you have when you use the app. For activities that are optional, such as device notifications or sharing a link, we rely on your clear choice to turn them on or to use them.",
        "You may withdraw your consent at any time, subject to legal and contractual restrictions and to reasonable notice. You can turn off notifications in your *Profile*, you can stop sharing, and you can ask us to delete your Account through Customer Service. If you withdraw consent to the information that is needed to run the Service, we can no longer provide the Service to you.",
        "If you are under the age of majority, we rely on the permission of a parent or guardian as well as on your own consent, as described in the section *Children and Minors*.",
        "We will not collect information by misleading you, and we will ask for your consent again before we use your information for a new purpose that we have not described here."
      ]
    },
    {
      id: "principles",
      title: "Our Privacy Principles",
      paras: [
        "We organize our approach around the ten fair information principles on which PIPEDA and PIPA are built. In practice they mean the following for you:"
      ],
      items: [
        "**Accountability.** The Owner is responsible for the personal information in our care, including information handled for us by providers, and is the person who answers privacy questions.",
        "**Identifying purposes.** We tell you why we collect information, in this Privacy Policy and in the Service, before or when we collect it.",
        "**Consent.** We ask for your consent as described in the section *Consent and Legal Framework*.",
        "**Limiting collection.** We collect only what we need for the purposes that we have identified.",
        "**Limiting use, disclosure and retention.** We use and share information only for those purposes, and we keep it only as long as we need it, as set out in the section *Retention and Deletion*.",
        "**Accuracy.** We try to keep information accurate and up to date. You can change your display name in your *Profile*, and you can ask us to correct other information through Customer Service.",
        "**Safeguards.** We protect information with safeguards that suit its sensitivity, as described in the section *How We Store and Protect Information*.",
        "**Openness.** We publish this Privacy Policy, and we will answer questions about our practices through Customer Service.",
        "**Individual access.** You can ask to see the personal information that we hold about you, and you can download much of it yourself using *Download my data* in your *Profile*.",
        "**Challenging compliance.** You can challenge how we handle your information by contacting us through Customer Service, and you can complain to a privacy regulator."
      ]
    },
    {
      id: "storage-security",
      title: "How We Store and Protect Information",
      paras: [
        "Your information is stored with a cloud database and authentication provider, Supabase, and the app files are delivered to your browser through a code hosting and static website hosting service, GitHub and GitHub Pages. These providers process information on our behalf.",
        "We use safeguards that are appropriate for a small student-run project. They include the following:"
      ],
      items: [
        "information is encrypted in transit between your device and the Service;",
        "access rules are enforced at the database level, so that an Account can read and change only the records that its role allows;",
        "passwords are handled by the authentication provider in hashed form and are never visible to us;",
        "two-step login is available as an option for staff accounts, such as those of Instructors and Administrators;",
        "access to stored personal information is limited to the people who need it to run, support and secure the Service; and",
        "we ask you to protect your own Account by using a strong, unique password and by logging out of shared devices."
      ]
    },
    {
      id: "security-limits",
      title: "Limits of Security and Breach Notification",
      paras: [
        "Our providers may apply their own security measures, such as encryption of stored data, but we do not control them. We do not claim that the Service holds any security certification or has passed any audit.",
        "No system is perfectly secure. We cannot guarantee the absolute security of your information, and you use the Service with that understanding. Please do your part by keeping your password private and by telling us promptly through Customer Service if you suspect a problem.",
        "If a breach of security safeguards involves your personal information and creates a real risk of significant harm to you, we will notify you and, where the law requires it, the relevant privacy commissioner, as soon as feasible after we determine that the breach has occurred. We keep a record of breaches. Our notice will describe what happened, what information was involved and what steps you can take, and will be given through the Service or to the email address on your Account."
      ]
    },
    {
      id: "who-can-see",
      title: "Who Can See Your Information",
      paras: [
        "Your personal information is never sold, rented or traded. We do not use it for advertising, and we do not share it with advertisers, data brokers or marketers.",
        "Other students cannot see your email address, your progress or your Account details. The only information that another student can see is what you choose to put in a sharing link or a challenge, as described in the section *Sharing Links and Challenges*.",
        "Your information is visible only to the following people and organizations, and only for the purposes described in this Privacy Policy:"
      ],
      items: [
        "**You.** You can see all of your own information in the Service.",
        "**Instructors and School Managers.** The Instructors and School Managers of a class that you joined can see your name, email address and progress for that class, together with a summary such as percent complete, mastery and when you last opened the app. They use it to support you and to see how the class is doing. Instructors and School Managers of other classes and schools cannot see it.",
        "**Administrators.** The Owner, and any Administrators that the Owner appoints, can see Account details and other information to the extent needed to run, secure and support the Service and to answer Customer Service questions.",
        "**Service providers.** The providers described in the section *How We Store and Protect Information* process information for us. We use them only to provide the Service, and we do not authorize them to use your information for advertising.",
        "**Legal and safety reasons.** We may disclose information if the law requires it, if a court or authority with the power to do so asks for it, or if it is needed to protect the safety of a person, to investigate a serious breach of the Terms of Service, or to establish or defend a legal claim.",
        "**A new operator.** If the Service is handed over to another person or organization, your information may be transferred to them. We would tell you in the app, and the new operator would have to honour this Privacy Policy or ask for your consent to a new one.",
        "**With your consent.** We share information in other ways only when you ask us to or when you agree."
      ]
    },
    {
      id: "aggregated",
      title: "Aggregated and Anonymized Information",
      paras: [
        "To improve the Course Materials, we analyze how students use the Service, for example which questions are missed most often, which topics take longest to learn and which explanations need work. Wherever possible we do this with aggregated or anonymized information.",
        "Aggregated information combines data from many users. Anonymized information has had the details that identify you removed, so that it cannot reasonably be used to identify you. We do not try to re-identify anonymized information, and we do not share it in a way that would let someone else do so.",
        "Instructors and School Managers may see class-level summaries, such as how a class is doing overall, in addition to the individual information described above. Aggregated and anonymized information no longer identifies you, so it may be kept after your Account is deleted, as described in the section *Retention and Deletion*."
      ]
    },
    {
      id: "retention",
      title: "Retention and Deletion",
      paras: [
        "We keep your personal information while your Account is active, so that your progress and settings stay available to you.",
        "You can ask us to delete your Account at any time through Customer Service. Your Account is then scheduled for deletion, and it is permanently deleted after a grace period of 22 days. If you log in again with the same email address within the 22 days, the deletion is cancelled and your Account is restored. After 22 days the deletion is permanent and cannot be undone.",
        "When deletion is complete, we delete your Account information, study data, class memberships, profile photo or avatar, reviews, ratings and feedback, and notification preferences from the live Service.",
        "Some information is kept for a limited time after deletion, as follows:"
      ],
      items: [
        "**Backups.** Our providers keep backups for disaster recovery. We expect backups that contain your information to cycle off within 35 days after the permanent deletion, and we do not restore deleted Accounts from backups except to recover the Service after a failure.",
        "**Customer Service questions and Terms acceptance records.** These may be kept for up to 24 months after deletion where we need them to answer a complaint, to enforce the Terms of Service or to defend against a legal claim.",
        "**Security and abuse records.** Limited records of Accounts that were suspended or removed for breaking the Terms of Service may be kept for up to 24 months, to protect the Service and its users.",
        "**Aggregated and anonymized information.** This may be kept for as long as it is useful, because it no longer identifies you.",
        "**Provider logs.** Technical logs held by our hosting and database providers are kept under their own schedules, which we do not control.",
        "**Legal requirements.** We may keep information for longer where the law requires it."
      ]
    },
    {
      id: "your-rights",
      title: "Your Rights and Choices",
      paras: [
        "We try to answer requests within 30 days, and we do not charge for ordinary requests. To protect you, we deal with requests that come through your own logged-in Account, and we may ask you to confirm who you are. If we cannot do what you ask, for example because the law requires us to keep information, we will explain why.",
        "You have the following rights and choices:"
      ],
      items: [
        "**Access.** You may ask for the personal information that we hold about you. You can download much of it yourself using *Download my data* in your *Profile*. For anything else, contact Customer Service.",
        "**Correction.** You may change your display name in your *Profile*, and you may ask us to correct other information that is inaccurate or incomplete.",
        "**Deletion.** You may ask us to delete your Account, as described in the section *Retention and Deletion*.",
        "**Withdrawing consent.** You may withdraw your consent as described in the section *Consent and Legal Framework*.",
        "**A copy of your data.** *Download my data* gives you a copy of your information in a common file format that you can keep or move.",
        "**Challenging compliance.** If you think that we have not followed this Privacy Policy or the law, tell us through Customer Service. We will look into it and reply.",
        "**Complaints to a regulator.** You have the right to complain to the Office of the Privacy Commissioner of Canada and to the Office of the Information and Privacy Commissioner of Alberta."
      ]
    },
    {
      id: "children",
      title: "Children and Minors",
      paras: [
        "You must be at least 13 years old to use the Service. We do not knowingly collect personal information from anyone under 13. If we learn that we have, we will close that Account and delete the information.",
        "If you are 13 or older but under the age of majority in your province or territory, which is 18 in Alberta and 19 in some other places, you may use the Service only with the permission of a parent or guardian, as stated in the Terms of Service.",
        "Because Customer Service is our only way of being contacted, a parent or guardian who wants to see, correct or delete a minor's information should make the request through the minor's Account. We may ask questions to confirm the request.",
        "We do not collect more information from minors than from other users, and we do not use anyone's information for advertising."
      ]
    },
    {
      id: "local-storage",
      title: "Cookies, Local Storage and Offline Files",
      paras: [
        "We do not use advertising cookies or tracking cookies, and we do not use third-party analytics services.",
        "The Service stores some information in your browser's local storage on your device so that it can work properly. This includes your preferences, such as theme and text size, your accessibility choices, your notification choices, a cache of your progress, and a session token that keeps you logged in. This information is used only to make the Service work.",
        "The Service also uses a service worker, which is a small background script in your browser. It saves copies of the app files so that the Service can load quickly and work offline.",
        "You can clear this information at any time. Logging out removes your session token. You can also clear site data in your browser settings, or uninstall the app if you added it to your home screen. If you do, you will be logged out, your saved preferences and offline copy will be removed from that device, and you will need to log in again. Progress that has already been synchronized with your Account is not lost.",
        "Our hosting and database providers use ordinary technical means, such as web requests and security tokens, to deliver the Service. We do not use them to track you across other websites."
      ]
    },
    {
      id: "notifications",
      title: "Notifications",
      paras: [
        "Ace It can show notifications inside the app. If you choose, it can also send device notifications through your browser or operating system. Device notifications are optional and need your permission. Nothing is sent to your device until you opt in.",
        "You can turn notifications on or off at any time in the settings in your *Profile*. You can also change the permission in your browser or device settings. When you turn them off, we stop sending them.",
        "We use notifications for things that help you study and use the Service, such as reminders, challenges from friends, class messages and important messages about your Account. We do not send marketing or promotional notifications."
      ]
    },
    {
      id: "sharing",
      title: "Sharing Links and Challenges",
      paras: [
        "You can share links with friends to games, scores and challenges. A link contains the game, the score and your first name. It does not contain your email address, your other scores or your progress.",
        "To open the game or take up a challenge, the recipient needs an Account of their own. Because the information is part of the link, anyone who receives the link, or who sees it where you post it, may be able to read your first name and the score, even before they log in. Share links only with people you trust.",
        "You choose who receives a link and which app you use to send it. The share sheet that appears is provided by your browser or operating system, and the app you choose then handles the link under its own privacy practices. We cannot take a link back once it has been sent.",
        "People who take part in a challenge can see the first names and scores that are part of that challenge. They cannot see your email address or the rest of your progress."
      ]
    },
    {
      id: "international",
      title: "International Transfers",
      paras: [
        "The providers who host the Service and store its data may process and store information in data centres outside Alberta, including outside Canada. We do not control the location of those data centres, and the location may change over time.",
        "When information is processed outside Canada, it is subject to the laws of the place where it is held, and courts, law enforcement and other authorities there may be able to access it under those laws.",
        "We choose reputable providers and rely on the contractual and technical protections that they offer, such as encryption in transit and access controls. We remain responsible for personal information in our care, including information handled for us by providers. If you do not want your information handled in this way, please do not use the Service."
      ]
    },
    {
      id: "changes",
      title: "Changes to This Privacy Policy",
      paras: [
        "We may update this Privacy Policy from time to time. Each version has a version number and a date of last update, shown at the top. When we make a significant change, we will tell you through a notice in the app.",
        "When a new version of the Terms of Service or of this Privacy Policy is published, existing users will be asked to accept the new version on their next login. We will not use your information for a new purpose without asking for your consent first."
      ]
    },
    {
      id: "contact",
      title: "How to Contact Us",
      paras: [
        "The only way to contact the Owner about privacy is through Customer Service in the app: *Profile*, then *Customer Service*, then *Ask a question*. We do not provide an email address, a telephone number or a postal address.",
        "You can ask questions about this Privacy Policy, ask to see, correct or delete your information, withdraw your consent, or make a complaint. Please do not include your password or other sensitive information in your message. We will try to reply within 30 days. If you are not satisfied with our reply, you may complain to the Office of the Privacy Commissioner of Canada or to the Office of the Information and Privacy Commissioner of Alberta."
      ]
    }
  ]
};
