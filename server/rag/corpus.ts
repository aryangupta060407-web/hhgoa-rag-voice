import type { SourceDocument } from "./types";
import { EXPANDED_COMPACT_SOURCE_PASSAGES } from "./compactCorpus.generated";
import { COMPACT_VALIDATION_DOCUMENTS } from "./compactValidation.generated";

/**
 * A provenance-preserving compact validation slice extracted offline from
 * ai4bharat/MSMARCO-XI / validation / hinval.parquet on 2026-08-21.
 * Each document retains its upstream query ID, language, source query, and
 * selected passage. This subset is intentionally small enough for a 512 MB
 * live-demo container; the offline index builder supports larger shards.
 */
export const MSMARCO_XI_SOURCE = "ai4bharat/MSMARCO-XI";
export const MSMARCO_XI_SPLIT = "validation/hinval.parquet";

export const SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    queryId: 1102432,
    queryType: "DESCRIPTION",
    language: "hin_Deva",
    englishQuery: "what is a corporation",
    translatedQuery: "कॉर्पोरेशन क्या है?",
    englishAnswer: "A corporation is a company or group of people authorized to act as a single entity and recognized as such in law.",
    translatedAnswer: "निगम एक कंपनी या लोगों का समूह होता है जो एक एकल इकाई के रूप में कार्य करने के लिए अधिकृत होता है और कानून में इस प्रकार से मान्यता प्राप्त होती है।",
    englishPassage: "McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity legally a person and recognized as such in law. Early incorporated entities were established by charter.",
    translatedPassage: "मैकडॉनल्ड कॉर्पोरेशन दुनिया के सबसे पहचानने योग्य निगमों में से एक है। एक निगम एक कंपनी या लोगों का समूह है जो एक एकल इकाई कानूनी रूप से एक व्यक्ति के रूप में कार्य करने के लिए अधिकृत है और कानून में इस तरह से मान्यता प्राप्त है। प्रारंभिक निगमित संस्थाएं चार्टर द्वारा स्थापित की गई थीं।",
  },
  {
    queryId: 1102431,
    queryType: "DESCRIPTION",
    language: "hin_Deva",
    englishQuery: "why did rachel carson write the obligation to endure",
    translatedQuery: "रेचल कार्सन ने क्यों एक दायित्व बर्दाश्त करने के लिए लिखा",
    englishAnswer: "Rachel Carson writes The Obligation to Endure because man creates more problems by polluting the environment while trying to eliminate unwanted insects and weeds.",
    translatedAnswer: "रेचल कार्सन ने लिखा है कि द ओब्लिगेशन टू एंड्योर क्योंकि उनका मानना है कि जैसे-जैसे आदमी अवांछित कीड़ों और खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह वास्तव में पर्यावरण को प्रदूषित करके और अधिक समस्याएं पैदा कर रहा है।",
    englishPassage: "Carson believes that as man tries to eliminate unwanted insects and weeds, he is actually causing more problems by polluting the environment with DDT and harming living things. Carson adds that the intensification of agriculture is causing other major problems, like newly developed insects and diseases.",
    translatedPassage: "कार्सन का मानना है कि जैसे-जैसे मनुष्य अवांछित कीटों और खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह वास्तव में पर्यावरण को प्रदूषित करके और अधिक समस्याएँ पैदा कर रहा है, उदाहरण के लिए डी डी टी और जीवित चीजों को नुकसान पहुँचा रहा है। कार्सन कहते हैं कि कृषि की तीव्रता अन्य प्रमुख समस्याएँ पैदा कर रही है।",
  },
  {
    queryId: 205107,
    queryType: "DESCRIPTION",
    language: "hin_Deva",
    englishQuery: "honesty or integrity definition",
    translatedQuery: "ईमानदारी या सच्चाई की परिभाषा",
    englishAnswer: "Honesty is the condition of being honest. Integrity is the value and morals of an individual in relation to honesty.",
    translatedAnswer: "ईमानदारी ईमानदार होने की स्थिति है। निष्ठा ईमानदारी के संबंध में व्यक्ति का मूल्य और नैतिकता है।",
    englishPassage: "Honesty is the condition of being honest, sincerity or fairness, virtue or respect. Integrity is the value and morals of an individual in relation to honesty, including adherence to facts.",
    translatedPassage: "ईमानदारी बहु-पक्षीयता है: ईमानदार होने की स्थिति, ईमानदारी या निष्पक्षता, और गुण या सम्मान। ईमानदारी एक व्यक्ति का मूल्य और नैतिकता है जो तथ्यों का पालन है।",
  },
  {
    queryId: 300122,
    queryType: "NUMERIC",
    language: "hin_Deva",
    englishQuery: "how many women did frank gifford marry",
    translatedQuery: "फ्रैंक गिफोर्ड ने कितनी महिलाओं से शादी की",
    englishAnswer: "Frank Gifford married three women.",
    translatedAnswer: "फ्रैंक गिफोर्ड ने तीन महिलाओं से शादी की।",
    englishPassage: "Frank Gifford was born in Santa Monica, California. He was known for NFL Monday Night Football and Super Bowl XXIX. He was married to Kathie Lee Gifford, Astrid Gifford and Maxine Avis Ewart.",
    translatedPassage: "फ्रैंक गिफोर्ड का जन्म सांता मोनिका, कैलिफोर्निया में हुआ था। वह एनएफएल मंडे नाइट फुटबॉल और सुपर बाउल पर अपने काम के लिए जाने जाते हैं। उनकी शादी कैथी ली गिफोर्ड, एस्ट्रिड गिफोर्ड और मैक्सिन एविस एवार्ट से हुई थी।",
  },
  {
    queryId: 233826,
    queryType: "NUMERIC",
    language: "hin_Deva",
    englishQuery: "how fast does an eagle travel",
    translatedQuery: "बाज़ कितनी तेजी से यात्रा करता है",
    englishAnswer: "Eagles fly 30 to 55 mph and dive at over 100 mph.",
    translatedAnswer: "ईगल 30 से 55 मील प्रति घंटे की रफ्तार से उड़ते हैं और 100 मील प्रति घंटे से अधिक की रफ्तार से गोता लगाते हैं।",
    englishPassage: "Eagles fly 30 to 55 mph and dive at over 100 mph. Eagles can soar for hours on warm air currents, which conserves energy, especially during long migrations.",
    translatedPassage: "ईगल 30 से 55 मील प्रति घंटे की रफ्तार से उड़ते हैं और 100 मील प्रति घंटे से अधिक की रफ्तार से गोता लगाते हैं। ईगल गर्म हवा की धाराओं पर घंटों तक उड़ सकते हैं, जिससे ऊर्जा की बचत होती है।",
  },
  {
    queryId: 1090355,
    queryType: "NUMERIC",
    language: "hin_Deva",
    englishQuery: "stubhub toll free number",
    translatedQuery: "स्टबहब टोल फ्री नंबर",
    englishAnswer: "The StubHub toll-free number is 866-788-2482.",
    translatedAnswer: "स्टबहब का टोल मुक्त नंबर 866-788-2482 है।",
    englishPassage: "StubHub toll-free number 866-788-2482. While 866-788-2482 is StubHub's best toll-free number, there are three total ways to get in touch with them.",
    translatedPassage: "स्टबहब टोल-मुक्त नंबर 866-788-2482। जबकि 866-788-2482 स्टबहब का सर्वश्रेष्ठ टोल-मुक्त नंबर है, उनके साथ संपर्क करने के कुल तीन तरीके हैं।",
  },
  {
    queryId: 260880,
    queryType: "NUMERIC",
    language: "hin_Deva",
    englishQuery: "how long for cantaloupe to mature",
    translatedQuery: "कैंटालूप को कितने समय तक परिपक्व होना है",
    englishAnswer: "Cantaloupe vines normally take 90 days to grow from seed to ripe fruit.",
    translatedAnswer: "खरबूजे की बेलों को बीज से पके फल तक बढ़ने में सामान्यतः 90 दिन लगते हैं।",
    englishPassage: "Cantaloupes take up to 45 days to develop from pollinated blossoms. Cantaloupes take 35 to 45 days to ripen after the flower has been pollinated. Cantaloupe vines normally take 90 days to grow from seed to ripe fruit.",
    translatedPassage: "खरबूजे परागित फूलों से विकसित होने में 45 दिन तक का समय लेते हैं। खरबूजे परागण के बाद पकने में 35 से 45 दिन लगते हैं। खरबूजे की बेलें आम तौर पर बीज से पके फल तक बढ़ने में 90 दिन लगते हैं।",
  },
  {
    queryId: 116898,
    queryType: "DESCRIPTION",
    language: "hin_Deva",
    englishQuery: "definition arbitrary",
    translatedQuery: "परिभाषा मनमानी है",
    englishAnswer: "Arbitrary describes a decision based on personal will rather than reason, judgment, rules, or standards.",
    translatedAnswer: "मनमाना निर्णय वह है जो तर्क या निर्णय के बजाय व्यक्तिगत इच्छा या विवेक पर आधारित हो।",
    englishPassage: "The term arbitrary describes a course of action or a decision that is not based on reason or judgment but on personal will or discretion without regard to rules or standards. An arbitrary decision is made without regard for facts and circumstances presented.",
    translatedPassage: "मनमाना शब्द कार्रवाई के तरीके या निर्णय का वर्णन करता है जो तर्क या निर्णय पर आधारित नहीं है, बल्कि नियमों या मानकों की परवाह किए बिना व्यक्तिगत इच्छा या विवेक पर आधारित होता है। मनमाना निर्णय प्रस्तुत तथ्यों और परिस्थितियों की परवाह किए बिना लिया जाता है।",
  },
  ...COMPACT_VALIDATION_DOCUMENTS,
];

export const SUPPLEMENTAL_COMPACT_SOURCE_PASSAGES = EXPANDED_COMPACT_SOURCE_PASSAGES;
