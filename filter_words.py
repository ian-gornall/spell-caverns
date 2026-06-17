"""
Filter google-10000-english-usa-no-swears.txt down to ~2500-3000
age-appropriate words for a US grades 3-5 spelling game.
"""
import re

# ── Explicit removal blocklist ────────────────────────────────────────────────
REMOVE = {
    # web / tech / file junk
    'http','https','www','com','net','org','html','php','url','login',
    'email','blog','click','jpg','png','pdf','gif','css','api','faq',
    'pic','pics','info','online','website','google','youtube','facebook',
    'twitter','instagram','amazon','microsoft','iphone','android','adobe',
    'myspace','ebay','paypal','gmail','yahoo','bing','wiki','wikipedia',
    'rss','xml','sql','javascript','jquery','wordpress','drupal','firefox',
    'safari','chrome','itunes','ipad','ipod','bluetooth','wifi','hdtv',
    'lcd','hdmi','vga','usb','dvd','dvds','mp','mp3','mp4',
    'xbox','playstation','wii','blu','favicon','captcha','bandwidth',
    'streaming','firewall','antivirus','malware','spyware','ransomware',
    'phishing','hacker','cybersecurity','blockchain','cryptocurrency',
    'widget','plugin','addon','toolbar','sidebar','avatar','thumbnail',
    'screenshot','username','password','signup','signin','logout',
    'homepage','webpage','domain','hosting','server','browser',
    'internet','network','wireless','download','upload','algorithm',
    'analytics','dashboard','middleware','repository','deployment',
    'permalink','trackback','pingback','unsubscribe','notifications',
    'disclaimer','subscription','sitemap','webmaster','weblog','blogging',
    'tripadvisor','cnet','pubmed','mediawiki','lightbox',

    # abbreviations / two-letter state codes / acronyms
    'tv','dvd','pm','st','inc','ltd','dept','vs','etc','ie','eg',
    'lol','omg','diy','fyi','btw','asap','eta','iq','gps','atm',
    'aka','rsvp','vip','mba','phd','md','dr','mr','mrs','ms',
    'uk','eu','un','usd','mph','rpm',
    # US state abbreviations used as words
    'ny','ca','tx','fl','pa','oh','il','ga','mi','nj','wa','az','ma',
    'tn','nc','in','mo','md','wi','mn','co','al','sc','la','ky','or',
    'ok','ct','ut','ia','nv','ar','ms','ks','ne','nm','id','hi','nh',
    'me','mt','ri','nd','sd','ak','dc','wv','de','vt','wy',
    # other 2-letter web/abbrev noise
    'ip','au','fi','po','va','se','el','en','co','re','di','da','du',
    'na','sa','es','em','ex','ne','le','la','de','le','os','im','op',
    'av','ad','ap','aa','iv','ii','iii','eur','usr','int','var','devel',
    'acc','pda','avg','rom','dna','diff','ap','wi','wa',

    # personal names (only names, not common words)
    'robbie','kevin','jordan','joseph','louis','phillip','raymond',
    'leon','lance','marcus','ross','travis','kelly','shannon','keith',
    'craig','derek','darren','brett','cody','chad','blake','seth',
    'evan','dean','tyler','trevor','logan','cole','colt',
    'brandon','jason','ryan','kyle','dylan','adam','alex',
    'jessica','ashley','brittany','megan','kaitlyn','madison','alyssa',
    'hannah','emily','sarah','rachel','laura','jennifer','melissa',
    'amanda','stephanie','samantha','nicole','tiffany','natasha',
    'britney','miley','oprah','madonna','einstein','darwin','tesla',
    'obama','trump','clinton','lincoln','kennedy','reagan',
    'stephen','elizabeth','charles','william','thomas','richard',
    'michael','robert','george','james','peter','paul','david','john',
    'martin','andrew','christopher','edward','henry','frank','harry',
    'jack','eric','taylor','miller','wilson','johnson','jones','smith',
    'jackson','williams','davis','davis','scott','chris','bob','jim',
    'mike','tom','steve','joe','bob','tim','ron','dan','lee','don',
    'brian','daniel','mark','mary','ann','pat','joan','jane','kate',
    'alan','diane','linda','carol','chris','sue',

    # US cities that appear here only as proper names
    'philadelphia','chicago','houston','phoenix','dallas','detroit',
    'memphis','denver','seattle','boston','portland','nashville',
    'baltimore','milwaukee','albuquerque','tucson','fresno','sacramento',
    'cleveland','pittsburgh','cincinnati','indianapolis','columbus',
    'charlotte','raleigh','jacksonville','orlando','tampa','miami',
    'atlanta','minneapolis','omaha','tulsa','aurora',
    'angeles','francisco','diego','ontario','toronto','sydney',
    'vegas','mesa','bakersfield','henderson','reno','buffalo',
    'corpus','anchorage','louisville',

    # US states as proper names (where they appear purely as state names)
    'pennsylvania','mississippi','connecticut','louisiana','tennessee',
    'minnesota','wisconsin','kentucky','arkansas','oklahoma','nebraska',
    'wyoming','delaware','montana','vermont','illinois','michigan',
    'indiana','colorado','virginia','carolina','georgia','carolina',
    'maryland','missouri','dakota','nevada','oregon','hawaii','maine',
    'arizona','florida','massachusetts','washington','alaska',
    'jersey','iowa','utah','alabama','ohio',

    # foreign countries / regions (not commonly in kids vocab)
    'laos','swaziland','mauritius','seychelles','vanuatu','suriname',
    'tuvalu','kiribati','nauru','palau','micronesia','comoros',
    'moldova','tajikistan','kyrgyzstan','turkmenistan',
    'macau','brunei','maldives','belize','guyana','micronesia',
    'kong','zealand','scotland','ireland','austria','netherlands',
    'singapore','brazil','israel','india','china','japan','korea',
    'russia','france','germany','spain','italy','mexico','africa',
    'australia','canada','europe','america','asia','japan',
    'iraq','europe','latin','africa','pacific',

    # brands / product names
    'samsung','nokia','motorola','ericsson','siemens','panasonic',
    'toshiba','hitachi','nintendo','sega','atari','dell','apple',
    'cisco','oracle','ibm','intel','amd','nvidia','canon','ford',
    'windows','linux','java','mac','disney',

    # finance / legal / corporate / medical adult jargon
    'mortgage','equity','invoice','liability','dividend','plaintiff',
    'jurisdiction','pursuant','hereby','thereof','revenue','corporate',
    'municipal','statutory','demographic','portfolio',
    'amortization','depreciation','arbitration','collateral','derivative',
    'hedging','litigation','liquidation','insolvency','fiscal',
    'appropriations','regulatory','deductible','annuity',
    'brokerage','fiduciary','indemnity','subpoena','affidavit',
    'deposition','injunction','mediation','arbitrator','notarized',
    'procurement','requisition','compliance','contractual',
    'subsidiary','acquisition','merger','divestiture','shareholder',
    'stockholder','reimbursement','expenditure','allocation','subsidy',
    'tariff','franchise','trademark','patent','copyright','intellectual',
    'pharmaceutical','dosage','prescription','prognosis',
    'pathology','oncology','cardiology','neurology','gynecology',
    'anesthesia','biopsy','catheter','chemotherapy','dialysis',
    'mammography','radiology','ventilator',
    'epidemiology','immunization','vaccination','contraception',
    'foreclosure','bankruptcy','receivership','creditor','garnishment',
    'lien','escrow','underwriting','actuarial','infringement',
    'stakeholders','deliverables','scalable','monetize','synergy',
    'optimization','sustainability','accountability','governance',
    'stewardship','constituency','referendum','subcommittee',
    'filibuster','gerrymander','redistricting','lobbyist',
    'deregulation','privatization','nationalization','globalization',
    'outsourcing','downsizing','commercialization','securitization',
    'cardiovascular','musculoskeletal','gastrointestinal','neurological',
    'psychiatric','dermatological','nephrology','pulmonology',
    'endocrinology','hematology','bacteriology','virology','parasitology',
    'administrative','organizational','implementations','specifications',
    'authorization','authentication','configurations','parliamentary',
    'constitutional','multinational','entrepreneurial','governmental',
    'bureaucratic','insurance','finance','financial','attorney','lawyer',
    'laws','regulations','statute','amendment','ordinance',
    'commerce','trading','auction','auctions','wholesale','retail',
    'vendor','vendors','merchant','suppliers','manufacturer',
    'manufacturers','dealers','dealer','broker','brokerage',
    'accounting','census','economics','economy','employment','unemployment',
    'congress','senate','parliament','district','precinct','ward',
    'borough','township','municipality','province','territory',
    'administration','ministry','bureau','commission','committee',

    # adult content / drugs / gambling / alcohol / mature
    'porn','porno','nude','naked','sex','sexual','sexy',
    'casino','gambling','poker','blackjack','roulette','lottery',
    'marijuana','cannabis','cocaine','heroin','meth','amphetamine',
    'whiskey','bourbon','vodka','tequila','rum','gin','brandy','wine',
    'stripper','escort','prostitute','brothel','condom','viagra',
    'lesbian','bisexual','homosexual','transgender','heterosexual',
    'personals','hookup','dating','lingerie','babes','oral','breast',
    'mature','adult','adults','xxx','nude',
    'drugs','drug','aids','hiv','cancer','disease','surgery','therapy',
    'patient','patients','medicine','medical','hospital','pharmacy',
    'clinical','diagnosis','treatment','nursing','healthcare','recovery',
    'smoking','alcohol','beer','cocktail',

    # archaic / formal / foreign particles
    'thee','thou','thy','hath','doth','whilst','amongst',
    'henceforth','heretofore','notwithstanding','aforementioned',
    'gratis','prima','per','via','et','de','la','le','des','les',
    'von','zum','du','kon','kong',

    # web e-commerce noise
    'deals','coupon','coupons','promo','checkout','cart','wishlist',
    'refund','rebate','cashback','affiliate','advertise','advertisement',
    'ads','advert','sponsored','promotion','promotions','offers',
    'portal','beta','zip','bid','logo','brand','brands','classified',
    'classifieds','nationwide','metro','suburban','mailing',
    'newsletter','newsletters','subscribe','subscription',
    'keywords','keyword','trademarks','phentermine',

    # misc noise / abbreviations found in corpus
    'ctrl','theta','subjective','arbor','isbn','prev','ed','usr',
    'mon','wed','thu','fri','sat','oct','nov','dec','jan','feb','mar',
    'jun','jul','aug','sep','apr','tue','int','sec','min','vol',
    'pro','non','anti','sub','mid','multi','pre','co','re','en',
    'ex','di','da','du','na','sa','es','em','ne','le','la','de',
    'nov','oct','sep','aug','jul','jun','apr','mar','feb','jan',
    'los','las','san','el','al','par','ave','blvd','rd','biol',
    'misc','ops','admin','dev','op','rom','dna','diff','var',
    'bin','prog','impl','spec','cfg','tmp','dir','pkg','src',
    'ini','exe','sys','log','err','msg','req','res','str','num',
    'bool','char','null','void','array','hash','obj','ptr',
    'gamma','alpha','delta','beta','sigma','theta','lambda','omega',
    'pubmed','pubchem','nih','cdc','fda','doj','dod','cia','fbi',
    'nfl','nba','nhl','mlb','mls','nascar','espn',

    # single letters except a and i
    'b','c','d','e','f','g','h','j','k','l','m','n','o',
    'p','q','r','s','t','u','v','w','x','y','z',

    # further words found in corpus scan — tech/corporate/names/inappropriate
    # tech jargon
    'programming','external','documentation','configuration','comprehensive',
    'parameters','perl','lib','offline','implementation','implementations',
    'integrated','servers','server','devices','virtual','device',
    'desktop','install','installation','module','modules','scripts',
    'nodes','node','processor','processors','adapter','kernel','mysql',
    'unix','aol','gnu','iso','spec','specs','rom','dna','diff',
    'broadband','multimedia','gaming','script','disk','disks','drive',
    'framework','frameworks','protocol','protocols','query','queries',
    'annotation','variable','variables','import','export','function',
    'functions','parameter','compiling','compiler','executable',
    'binary','registry','cache','buffer','stack','queue','heap',
    'pointer','reference','interface','interfaces','class','object',
    'array','hash','string','boolean','integer','float','null','void',
    'const','typeof','instanceof','constructor','prototype','method',
    # names appearing in corpus
    'lewis','howard','rome','arab','jeff','dave','tony','matt',
    'anderson','sam','allen','clark','gary','jose','antonio',
    'patrick','kim','ben','bob','jim','ron','scott',
    'eric','tom','tim','dan','mike','joe','alan',
    # inappropriate/adult/graphic
    'babe','consent','virgin','criminal','nuclear','defense',
    'violence','abuse','kill','killed','hate','illegal','weapons',
    'lesbians','blonde','pregnancy','disability','disabled',
    'holdem','slot','gambling','slot','casino',
    'visa','salary','compensation','audit','financing','investor',
    'securities','transactions','stocks','stock','banking',
    'retirement','contractor','employer','employees',
    # corporate/business jargon
    'personnel','designated','assembly','legislation','officials',
    'guidelines','criteria','applicable','certified','certification',
    'certificates','regulatory','compliance','procurement',
    'wholesale','vendor','vendors','merchant','supplier','suppliers',
    'manufacturers','dealers','dealer','operator','operators',
    'affiliate','affiliates','sponsor','sponsors','sponsored',
    'endorsement','commission','committees','bureau','bureaus',
    'firms','firm','enterprise','enterprises','corporation','corporations',
    'utilities','utility','regulation','regulations','officer','officers',
    'dimensions','objectives','objectives','initiatives','mandate',
    'mandate','provisions','criteria','provision','provisions',
    # web/commerce noise
    'reserved','listings','listing','classifieds','classified','ads',
    'mailing','newsletters','newsletter','subscribe','subscription',
    'sitemap','webmaster','bookmark','permalink','trackback',
    'shopping','checkout','cart','wishlist','refund','rebate',
    'cashback','promo','promotions','portal','beta','bids','bid',
    'logo','brand','brands','specials','clearance','merchandise',
    'wholesale','marketplace','marketplace','marketplace',
    # places
    'orlando','tampa','dallas','houston','detroit','phoenix',
    'columbus','charlotte','raleigh','jacksonville','memphis',
    'louisville','pittsburgh','cleveland','cincinnati','indianapolis',
    'milwaukee','omaha','tulsa','aurora','mesa','bakersfield',
    'henderson','reno','buffalo','anchorage','corpus',
    'angeles','francisco','diego','ontario','toronto','sydney',
    'vegas','hampshire','cambridge','oxford','manchester',
    'atlantic','caribbean','pacific','mediterranean',
    'taiwan','thailand','sweden','switzerland','belgium','iran',
    'pakistan','costa','czech','greece','turkey',
    # final cleanup pass from full corpus scan
    'england','blogs','columbia','websites','del','ac','verzeichnis',
    'ha','ea','ab','utc','der','characteristics','representatives',
    'cheats','advisory','cam','appendix','glossary','enforcement',
    'pub','authorities','identification','ram','appliances','curriculum',
    'psychology','dental','celebrity','commitment','efficiency',
    'authorized','jewish','linear','alliance','inventory','organisation',
    'lifestyle','converter','alliance','converter','organisation',
    'proceedings','transmission','institution','investigation',
    'directed','searching','sporting','affected','experiences',
    'contracts','hosted','diseases','concerning','developers','equivalent',
    'chemistry','neighborhood','agenda','advisory','cam',
    'circumstances','identification','ram','leaving',
    'enforcement','mesh','hardcover','appendix','glossary',
    'celebrity','pub','cables','requirement','authorities',
    'biology','dental','representatives','biography','leisure',
    'attractions','authorized','crazy','upcoming','efficiency',
    'linear','commitment','specialty','carrier','linked',
    'interviews','concepts','relating','assume','confidence',
    'connections','inventory','converter','organisation','lifestyle',
    'becoming','objective','indicated','alliance','confirm',
    # additional items found in late-list scan
    'strip','hairy','latina','nasa','specification','specifications',
    'seminar','investments','diversity','deposit','accessibility',
    'dutch','sensitive','templates','formats','folder','completion',
    'pulse','universities','contractors','voting','courts','subscriptions',
    'pearl','alexander','anniversary','broadcast','converted',
    'improvements','si','poland','womens','textbooks',
    'qty','uniprotkb','birmingham','legislative','consultant',
    'controller','ownership','researchers','researcher',
    'vietnam','malaysia','anne','conferences','consumption','flashing',
    'surveys','micro','laptops','mens','ref','submission','consumers',
    'transaction','contributions','initiative','execution','ultra',
    'idaho','databases','epinions','bulletin','inspection','cancel',
    'committed','extensive','candidate','outstanding','modifications',
    'applicable','respective','editorial','multimedia','computing',
    'integration','framework','protocols','integration',
    'residential','anime','industries','query','clip','partnership',
    'provisions','strategic','spam','bytes','compatible','residential',
    'consulting','recreation','managed','failed','participants',
    'bath','leads','austin','theater','springs','missouri','estimate',
    'criteria','hong','vice','associate','enlarge','behavior','truck',
    'logging','logged','laptop','vintage','gaming','feeds','billion',
    'destination','faster','intelligence','bought','nations','route',
    'residential','zoom','blow','battle','speak','decisions',
    'wire','principles','suggestions','rural','shared','replacement',
    'tape','judge','cent','forced','fight','apartment','height',
    'zero','speaker','filed','obtain','offices','designer','remain',
    'managed','failed','marriage','roll','banks','secret',
    'savings','graphic','atom','payments','estimated','binding','brief',
    'anonymous','straight','script','served','wants','miscellaneous',
    'prepared','alert','integration','tag','interview','mix','installed',
    'queen','credits','fix','handle','sweet','desk','dave','hong',
    'vice','associate','truck','behavior','enlarge','ray','frequently',
    'measure','changing','votes','duty','looked','discussions','gain',
    'festival','laboratory','ocean','flights','experts','signs','lack',
    'depth','whatever','laptop','vintage','explore','spa','concept',
    'nearly','eligible','reality','forgot','handling','origin','knew',
    'feeds','billion','destination','faster','intelligence','bought',
    'con','nations','route','followed','broken','zoom','blow','battle',
    'speak','decisions','industries','query','partnership',
    'editorial','expression','provisions','speech','wire','principles',
    'suggestions','rural','shared','sounds','replacement','tape',
    'judge','spam','bytes','cent','forced','compatible','fight',
    'apartment','height','zero','speaker','filed','obtain','consulting',
    'recreation','offices','designer','remain','managed','failed',
    'marriage','roll','banks','participants','secret',
    # misc junk in corpus
    'afford','aff','profanity','xxx','cum','ass','bitch','crap',
    'damn','hell','coke','beer','vodka','booze','liquor',
    'weed','hash','crack','acid',  # drug refs
    'rape','torture','genocide','massacre','assassination',
    'terrorism','terrorist','suicide','homicide',
    'abort','abortio','fetus',
    'gay','bisexual','queer','dyke','fag',  # slur forms (gay itself is fine as adjective but appears in slur context in this list)
    'interracial',  # adult content context in this list
    'xxx','porn','nude',  # already listed but make sure
    'ringtones',
    # corporate/finance terms found in scan
    'revenue','fiscal','portfolio','equity','asset','assets','liabilities',
    'deficit','surplus','inflation','deflation','recession','gdp','gnp',
    'nasdaq','nyse','dow','ftse','ipo','etf','roth','ira','k','401',
    'taxation','deduction','exemption','withholding',
    'semiconductor','microprocessor','bandwidth','latency','throughput',
    'protocol','packet','ethernet','router','modem','firewall',
    'encryption','decryption','authentication','authorization',
    # misc adult/news words a 9-year-old doesn't write
    'unemployment','recession','geopolitics','bureaucracy',
    'propaganda','ideology','radical','extremist',
    'insurgent','guerrilla','mercenary','insurgency',
}

# ── Words that look like abbreviations but ARE fine to keep ──────────────────
KEEP_OK = {
    # Genuine common English words (2-letter or short) that must survive
    'ok','am','an','do','go','he','hi','if','in','is','it','me','my',
    'no','of','on','or','so','to','up','we','be','by','as','at',
    'ax','id','ox','ah','aw','oy','ad',
}

CONSONANTS = set('bcdfghjklmnpqrstvwxyz')

# "Why" was being wrongly caught — fix: only drop 2-letter if both consonants
# and not a known real word; "why" has a vowel-equivalent 'y' sometimes but
# actually 'w','h','y' — y is in CONSONANTS, so "wy" would be caught but not "why"
# The real issue: our heuristic uses CONSONANTS which includes 'y'.
# Fix: treat 'y' as NOT a consonant for this heuristic only.
HEURISTIC_CONSONANTS = set('bcdfghjklmnpqrstvwxz')  # y excluded

REAL_2_LETTER = {
    'an','as','at','be','by','do','go','he','hi','if','in',
    'is','it','me','my','no','of','on','or','so','to','up',
    'we','ax','ox','ok','ad','ah','aw','id','oy', 'am',
}

def looks_like_abbrev(word):
    if len(word) == 2 and word not in REAL_2_LETTER:
        if all(c in HEURISTIC_CONSONANTS for c in word):
            return True
    if len(word) == 3 and all(c in HEURISTIC_CONSONANTS for c in word):
        return True
    return False


def is_valid(word):
    if not re.match(r'^[a-z]+$', word):
        return False, 'invalid_chars'
    if len(word) == 0:
        return False, 'empty'
    if len(word) == 1 and word not in ('a', 'i'):
        return False, 'single_letter'
    # KEEP_OK overrides REMOVE (these are genuine common words, not abbreviations)
    if word in KEEP_OK:
        return True, None
    if word in REMOVE:
        return False, 'blocklist'
    if looks_like_abbrev(word):
        return False, 'abbrev_heuristic'
    return True, None


# ── Read and filter ───────────────────────────────────────────────────────────
removed_log = []
kept = []
seen = set()

with open(r'C:\Users\iango\spell\wordlist_raw.txt', encoding='utf-8') as f:
    for line in f:
        word = line.strip().lower()
        if not word:
            continue
        if word in seen:
            continue
        ok, reason = is_valid(word)
        if not ok:
            removed_log.append((word, reason))
            continue
        seen.add(word)
        kept.append(word)

final = kept[:3000]

# ── Report ────────────────────────────────────────────────────────────────────
print(f"Source: google-10000-english-usa-no-swears.txt")
print(f"Raw lines fetched: 9884")
print(f"Words surviving filter: {len(kept)}")
print(f"Final word count (capped at 3000): {len(final)}")
print(f"Unique check: {len(set(final))}")
print()
print(f"First 20:     {' '.join(final[:20])}")
print(f"Around 500:   {' '.join(final[500:510])}")
print(f"Around 1000:  {' '.join(final[1000:1010])}")
print(f"Around 1500:  {' '.join(final[1500:1510])}")
print(f"Around 2000:  {' '.join(final[2000:2010])}")
print(f"Around 2500:  {' '.join(final[2500:2510])}")
print(f"Last 10:      {' '.join(final[-10:])}")
print()
interesting = [(w, r) for w, r in removed_log
               if r not in ('single_letter', 'invalid_chars', 'empty')]
print("Sample removed words (first 25):")
for w, r in interesting[:25]:
    print(f"  {w:30s}  ({r})")

with open(r'C:\Users\iango\spell\final_words.txt', 'w', encoding='utf-8') as f:
    for w in final:
        f.write(w + '\n')
