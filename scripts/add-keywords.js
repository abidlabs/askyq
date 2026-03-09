#!/usr/bin/env node
// One-time script to add alternateQuestions and expanded tags to all fatwas
const fs = require("fs");
const path = require("path");

const FATWAS_DIR = path.resolve(__dirname, "..", "api", "fatwas");
const FATWAS_LIST = path.resolve(__dirname, "..", "data", "fatwas.json");

// Long-tail keywords: alternateQuestions + extra tags per fatwa
const SEO_DATA = {
  "insurance-in-islam": {
    alternateQuestions: [
      "Is insurance halal or haram in Islam?",
      "Can Muslims get car insurance?",
      "Is health insurance permissible in Islam?",
      "Is life insurance haram?",
      "What is the Islamic ruling on insurance?",
    ],
    extraTags: ["halal insurance", "is insurance halal", "islamic finance", "darurah", "necessity"],
  },
  "are-stock-options-halal": {
    alternateQuestions: [
      "Are stock options haram in Islam?",
      "Is options trading permissible for Muslims?",
      "Can Muslims trade stock options?",
      "What is the Islamic ruling on call and put options?",
    ],
    extraTags: ["is options trading halal", "islamic ruling options", "call options", "put options"],
  },
  "short-selling-stocks": {
    alternateQuestions: [
      "Is short selling haram?",
      "Can Muslims short sell stocks?",
      "What does Islam say about short selling?",
      "Is selling stocks you don't own permissible?",
    ],
    extraTags: ["is short selling haram", "selling what you dont own", "islamic stock trading"],
  },
  "zakat-on-gold-jewelry": {
    alternateQuestions: [
      "Do women have to pay zakat on their gold jewelry?",
      "Is zakat due on gold ornaments worn by women?",
      "How do you calculate zakat on gold?",
      "Is there zakat on personal jewelry?",
    ],
    extraTags: ["zakat on ornaments", "gold nisab", "zakat calculation gold", "personal adornment"],
  },
  "zakat-on-long-term-investments": {
    alternateQuestions: [
      "How do I calculate zakat on my 401k?",
      "Is zakat due on retirement accounts?",
      "Do I pay zakat on mutual funds?",
      "How much zakat on stock investments?",
      "Zakat on IRA and pension funds?",
    ],
    extraTags: ["zakat 401k", "zakat retirement", "zakat IRA", "zakat on savings", "zakat calculation"],
  },
  "six-of-shawwal-and-makeup-fasts": {
    alternateQuestions: [
      "Can I combine Shawwal fasts with making up missed Ramadan fasts?",
      "Should I make up Ramadan fasts before fasting Shawwal?",
      "Can I do qada fasts and Shawwal fasts at the same time?",
      "Do makeup fasts count as Shawwal fasts?",
    ],
    extraTags: ["qada fasts", "making up fasts", "shawwal sunnah fasting", "dual intention fasting"],
  },
  "masah-on-regular-socks": {
    alternateQuestions: [
      "Can you wipe over cotton socks during wudu?",
      "Do socks have to be leather for masah?",
      "Is wiping over regular socks valid for wudu?",
      "What are the conditions for wiping over socks?",
    ],
    extraTags: ["wiping socks wudu", "khuffayn", "cloth socks wudu", "cotton socks masah"],
  },
  "halal-meat-when-visiting-others": {
    alternateQuestions: [
      "What should I do if I'm unsure about halal meat at someone's house?",
      "Is machine-slaughtered meat halal?",
      "Does stunning make meat haram?",
      "How to handle halal meat differences with other Muslims?",
    ],
    extraTags: ["machine slaughter", "hand slaughter", "dhabiha", "halal meat differences", "halal meat etiquette"],
  },
  "vanilla-extract-in-food": {
    alternateQuestions: [
      "Is vanilla extract halal?",
      "Does the alcohol in vanilla extract make food haram?",
      "Is it permissible to eat food with vanilla flavoring?",
      "Is nutmeg halal in Islam?",
      "Can Muslims eat food cooked with alcohol?",
    ],
    extraTags: ["is vanilla halal", "alcohol in cooking islam", "food flavoring alcohol", "trace alcohol halal"],
  },
  "obedience-to-parents": {
    alternateQuestions: [
      "Do you have to obey your parents in everything in Islam?",
      "Is disobeying parents a major sin?",
      "What are the limits of obeying parents in Islam?",
      "Can parents force you to do something in Islam?",
      "When can you disobey your parents Islamically?",
    ],
    extraTags: ["birr al-walidayn", "disobeying parents sin", "parental authority islam", "respecting parents limits"],
  },
  "drinking-water-while-standing": {
    alternateQuestions: [
      "Is it haram to drink water while standing?",
      "Is drinking while standing a sin in Islam?",
      "Did the Prophet drink water standing?",
      "Should Muslims always sit when drinking?",
    ],
    extraTags: ["sunnah of drinking water", "sitting while drinking", "prophetic etiquette drinking"],
  },
  "life-support-ventilator-end-of-life-decisions": {
    alternateQuestions: [
      "Is pulling the plug haram in Islam?",
      "Is removing life support considered murder in Islam?",
      "Is euthanasia allowed in Islam?",
      "What does Islam say about end-of-life decisions?",
      "Can you take someone off a ventilator in Islam?",
    ],
    extraTags: ["pulling the plug islam", "euthanasia islam", "vegetative state ruling", "brain death islam", "DNR islam"],
  },
  "abortion-outside-of-marriage": {
    alternateQuestions: [
      "Is abortion halal or haram in Islam?",
      "Can a Muslim woman get an abortion?",
      "Is abortion before 40 days allowed in Islam?",
      "What is the Islamic ruling on abortion before 120 days?",
      "Is abortion permissible for an unmarried Muslim?",
    ],
    extraTags: ["abortion before ensoulment", "islamic ruling abortion", "40 days abortion", "ruh soul 120 days"],
  },
  "marital-roles-chores-dispute-resolution": {
    alternateQuestions: [
      "Who should do housework in an Islamic marriage?",
      "Does the wife have to cook and clean in Islam?",
      "What are the husband's duties at home in Islam?",
      "How should Muslim couples resolve disputes?",
    ],
    extraTags: ["husband duties islam", "wife duties islam", "maruf marriage", "islamic marriage roles", "marital disputes"],
  },
  "english-equivalent-of-uff-to-parents": {
    alternateQuestions: [
      "What does 'uff' mean in the Quran?",
      "Is saying 'oh my god' to parents haram?",
      "Is it haram to show frustration to parents?",
      "What expressions are prohibited toward parents in Islam?",
    ],
    extraTags: ["uff quran meaning", "frustration with parents haram", "tone with parents islam", "isra 23"],
  },
  "separation-without-formal-divorce": {
    alternateQuestions: [
      "Does separation count as divorce in Islam?",
      "Are we still married if we've been separated for years?",
      "Does living apart end an Islamic marriage?",
      "Do you need a formal talaq for divorce?",
    ],
    extraTags: ["separation vs divorce islam", "marriage without talaq", "informal separation ruling", "iddah separation"],
  },
  "married-daughter-obligations-to-parents": {
    alternateQuestions: [
      "Does a married woman have to obey her parents or her husband?",
      "Can a husband prevent his wife from visiting her parents?",
      "Who comes first - husband or parents in Islam?",
      "How should a married woman care for her elderly parents?",
    ],
    extraTags: ["wife parents vs husband", "married daughter parents", "in-laws vs parents islam", "caring for parents after marriage"],
  },
  "shortening-prayer-during-leisure-travel": {
    alternateQuestions: [
      "Can you shorten prayers on vacation?",
      "Is qasr prayer allowed during holiday travel?",
      "Do you have to be traveling for work to shorten prayer?",
      "Can I combine prayers while on vacation?",
    ],
    extraTags: ["qasr vacation", "traveler prayer holiday", "shortening prayer rules", "combining prayers travel"],
  },
  "reminding-parent-with-dementia-to-pray": {
    alternateQuestions: [
      "Does a person with dementia have to pray in Islam?",
      "Is prayer obligatory for someone with Alzheimer's?",
      "Are people with mental illness accountable in Islam?",
      "Is the pen lifted for someone with dementia?",
    ],
    extraTags: ["alzheimers prayer", "mental capacity prayer", "pen lifted hadith", "taklif mental illness"],
  },
  "conventional-mortgage-permissibility": {
    alternateQuestions: [
      "Is getting a mortgage halal or haram?",
      "Can Muslims buy a house with a bank loan?",
      "Is a home loan permissible in Islam?",
      "Is paying interest on a mortgage a major sin?",
      "What is the Islamic ruling on mortgages in the West?",
    ],
    extraTags: ["is mortgage halal", "home loan islam", "buying house with interest", "riba mortgage", "islamic mortgage"],
  },
  "divorced-woman-seeking-husband": {
    alternateQuestions: [
      "Can a divorced Muslim woman look for a new husband?",
      "Is it appropriate for a woman to seek marriage in Islam?",
      "Can a divorced woman use marriage apps in Islam?",
      "How should a divorced Muslim woman find a spouse?",
    ],
    extraTags: ["divorced woman remarriage", "woman seeking marriage islam", "islamic marriage websites", "divorcee finding spouse"],
  },
  "women-leadership-roles-in-masjid": {
    alternateQuestions: [
      "Can women serve on a mosque board in Islam?",
      "Is it haram for women to have leadership roles in a masjid?",
      "Can a woman be president of a mosque?",
      "What roles can women hold in Islamic organizations?",
    ],
    extraTags: ["women mosque board", "female leadership islam", "women in masjid governance", "gender roles mosque"],
  },
  "negative-review-muslim-restaurant-backbiting": {
    alternateQuestions: [
      "Is writing a bad review considered gheebah?",
      "Is it backbiting to leave a negative Yelp review for a Muslim business?",
      "Can Muslims leave bad Google reviews?",
      "Is warning others about a bad business backbiting in Islam?",
    ],
    extraTags: ["gheebah business review", "backbiting vs honest review", "yelp review islam", "consumer rights islam"],
  },
  "ruling-on-personal-private-celebrations": {
    alternateQuestions: [
      "Are birthday celebrations haram in Islam?",
      "Is celebrating birthdays bidah?",
      "Can Muslims celebrate graduations and promotions?",
      "Is it permissible to have a birthday party in Islam?",
      "Are anniversary celebrations allowed in Islam?",
    ],
    extraTags: ["is birthday haram", "birthday bidah", "birthday party islam", "anniversary celebration halal", "personal milestones islam"],
  },
  "ruling-on-secular-national-holidays": {
    alternateQuestions: [
      "Can Muslims celebrate the 4th of July?",
      "Is celebrating Independence Day haram?",
      "Can Muslims participate in national holidays?",
      "Is it permissible for Muslims to celebrate Memorial Day?",
    ],
    extraTags: ["4th of july halal", "independence day muslim", "memorial day islam", "national celebration permissible"],
  },
  "ruling-on-celebrating-religious-holidays-of-other-faiths": {
    alternateQuestions: [
      "Can Muslims celebrate Christmas?",
      "Is it haram to celebrate Diwali as a Muslim?",
      "Can a Muslim convert attend a family Christmas dinner?",
      "Is saying Merry Christmas haram?",
      "Can Muslims exchange Christmas gifts?",
    ],
    extraTags: ["muslims christmas", "merry christmas haram", "christmas gifts islam", "diwali muslim", "interfaith holidays"],
  },
  "ruling-on-pagan-origins-and-current-practice": {
    alternateQuestions: [
      "Are things with pagan origins automatically haram?",
      "Is wearing a wedding ring haram because of pagan origins?",
      "Do the pagan origins of weekday names matter in Islam?",
      "Does historical origin determine Islamic permissibility?",
    ],
    extraTags: ["wedding ring pagan origin", "days of week pagan", "cultural practices islam", "origin vs current practice"],
  },
  "ruling-on-yoga-for-muslims": {
    alternateQuestions: [
      "Is yoga haram in Islam?",
      "Can Muslims do yoga for exercise?",
      "Is yoga shirk or forbidden?",
      "Is stretching and meditation like yoga permissible?",
      "What is the Islamic ruling on yoga?",
    ],
    extraTags: ["is yoga haram", "yoga exercise halal", "yoga shirk", "meditation islam", "yoga without spiritual elements"],
  },
  "ruling-on-halloween-participation": {
    alternateQuestions: [
      "Is Halloween haram in Islam?",
      "Can Muslim kids go trick-or-treating?",
      "Is celebrating Halloween shirk?",
      "What should Muslims do on Halloween?",
      "Is it a sin for Muslims to participate in Halloween?",
    ],
    extraTags: ["is halloween haram", "trick or treating muslim", "halloween shirk", "halloween costumes islam", "muslim kids halloween"],
  },
  "ruling-on-imitating-non-muslims": {
    alternateQuestions: [
      "Is wearing Western clothes haram in Islam?",
      "What counts as imitating non-Muslims?",
      "Is tashabbuh only about clothing?",
      "Can Muslims adopt Western cultural practices?",
    ],
    extraTags: ["western clothes islam", "tashabbuh meaning", "cultural assimilation islam", "muslim identity west"],
  },
  "ruling-on-thanksgiving-celebration": {
    alternateQuestions: [
      "Can Muslims celebrate Thanksgiving?",
      "Is Thanksgiving halal for Muslims?",
      "Is it haram to have a Thanksgiving dinner?",
      "What is the Islamic ruling on Thanksgiving?",
    ],
    extraTags: ["thanksgiving halal", "thanksgiving dinner muslim", "secular holiday islam", "giving thanks islam"],
  },
  "ruling-on-mehndi-ceremony-weddings": {
    alternateQuestions: [
      "Is the mehndi ceremony halal despite Hindu origins?",
      "Can Muslims have a henna night before the wedding?",
      "Is henna ceremony bidah or permissible?",
      "Is mehndi a Hindu practice that Muslims should avoid?",
    ],
    extraTags: ["henna night halal", "mehndi bidah", "wedding henna islam", "desi wedding customs islam"],
  },
  "ruling-on-secret-marriages": {
    alternateQuestions: [
      "Is a secret nikah valid in Islam?",
      "Can you get married without telling your family in Islam?",
      "Is it haram to have a secret marriage?",
      "What are the conditions for a valid nikah?",
      "Is an unannounced marriage valid?",
    ],
    extraTags: ["secret nikah valid", "nikah conditions", "marriage without family", "wali requirement nikah", "private marriage islam"],
  },
};

// Apply to individual fatwa JSON files
const files = fs.readdirSync(FATWAS_DIR).filter((f) => f.endsWith(".json"));
let updated = 0;

for (const file of files) {
  const filePath = path.join(FATWAS_DIR, file);
  const fatwa = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const seo = SEO_DATA[fatwa.id];
  if (!seo) continue;

  // Add alternateQuestions
  fatwa.alternateQuestions = seo.alternateQuestions;

  // Merge extra tags (avoid duplicates)
  const existingTags = new Set(fatwa.tags.map((t) => t.toLowerCase()));
  for (const tag of seo.extraTags) {
    if (!existingTags.has(tag.toLowerCase())) {
      fatwa.tags.push(tag);
      existingTags.add(tag.toLowerCase());
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(fatwa, null, 2) + "\n");
  updated++;
}

// Also update tags in data/fatwas.json
const list = JSON.parse(fs.readFileSync(FATWAS_LIST, "utf-8"));
for (const entry of list) {
  const seo = SEO_DATA[entry.id];
  if (!seo) continue;
  const existingTags = new Set(entry.tags.map((t) => t.toLowerCase()));
  for (const tag of seo.extraTags) {
    if (!existingTags.has(tag.toLowerCase())) {
      entry.tags.push(tag);
      existingTags.add(tag.toLowerCase());
    }
  }
}
fs.writeFileSync(FATWAS_LIST, JSON.stringify(list, null, 2) + "\n");

console.log(`Updated ${updated} fatwa files with alternateQuestions and expanded tags.`);
