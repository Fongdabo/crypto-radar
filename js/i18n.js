// Thai is the source language. In English mode, Thai text in the app (not the dashboard's research, not user text) is
// swapped for English by matching known phrases, longest first, as the page renders and whenever it changes.
// To add a language: add a dictionary like EN and an entry in LANGS.
// Loaded in <head> so the saved theme and language apply before the page paints.
(function () {
  // Theme: dark (default) or light, saved on this device.
  const THEME_KEY = 'crypto-radar:theme';
  const applyTheme = t => {
    document.documentElement.dataset.theme = t;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'light' ? '#f5f7fa' : '#0b1016';
  };
  let theme = 'dark';
  try { theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
  applyTheme(theme);
  window.CRTheme = { set(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(t); } };

  // Flags are drawn as SVG: Windows shows flag emoji as two letters.
  const LANGS = {
    th: { name: 'ภาษาไทย', locale: 'th-TH', flag: '<svg viewBox="0 0 30 20" width="21" height="14" aria-hidden="true"><path fill="#A51931" d="M0 0h30v20H0z"/><path fill="#F4F5F8" d="M0 3.33h30v13.34H0z"/><path fill="#2D2A4A" d="M0 6.67h30v6.66H0z"/></svg>' },
    en: { name: 'English', locale: 'en-GB', flag: '<svg viewBox="0 0 60 30" width="21" height="14" aria-hidden="true"><path fill="#012169" d="M0 0h60v30H0z"/><path stroke="#fff" stroke-width="6" d="M0 0l60 30M60 0L0 30"/><path stroke="#C8102E" stroke-width="2" d="M0 0l60 30M60 0L0 30"/><path stroke="#fff" stroke-width="10" d="M30 0v30M0 15h60"/><path stroke="#C8102E" stroke-width="6" d="M30 0v30M0 15h60"/></svg>' },
  };
  let lang = 'th';
  try { lang = localStorage.getItem('crypto-radar:lang') || (navigator.language || '').slice(0, 2); } catch (e) {}
  if (!LANGS[lang]) lang = 'th';
  document.documentElement.lang = lang;
  window.CR_LANG = lang;
  window.CR_LOCALE = LANGS[lang].locale;

  const EN = {
    // header, toolbar, menu
    'เรดาร์คริปโต': 'Crypto Radar', 'แดชบอร์ด': 'Dashboard', 'พอร์ต': 'Portfolio', 'กราฟ': 'Charts', 'คู่มือ': 'Guide',
    // agents page
    'เอเจนต์': 'Agents', 'เอเจนต์ · เรดาร์คริปโต': 'Agents · Crypto Radar', 'เอเจนต์ทำกิจกรรมแทน': 'Activity agents',
    'เอเจนต์ 1 ตัวต่อ 1 กิจกรรม หาเงื่อนไข ตรวจลิงก์ เรียงขั้นตอน และทักคุณเมื่อถึงคิว': 'One agent per activity: it finds the requirements, checks the links, lines up the steps and messages you when it is your turn',
    'กฎ:': 'Rule:', 'เอเจนต์ไม่ถือกุญแจกระเป๋าและไม่เซ็นแทนคุณ ขั้นที่ต้องเซ็นจะมีกรอบสีส้ม บอกว่าหน้าต่าง MetaMask ควรเป็นแบบไหน กด "ฉันพร้อมเซ็น" แล้วทำตาม เซ็นเสร็จเอเจนต์จะตรวจบนเชนให้':
      'agents never hold your wallet keys and never sign for you. Steps that need a signature have an orange box that says what the MetaMask window should show. Press "I\'m ready to sign", follow it, and the agent checks the chain afterwards.',
    'กระเป๋าฟาร์ม (ดูอย่างเดียว)': 'Farm wallet (read-only)', 'วางที่อยู่ 0x... ของ Account 2': 'Paste the 0x... address of Account 2',
    'เก็บไว้ในเครื่องนี้เท่านั้น ใช้ตรวจว่าธุรกรรมสำเร็จ': 'Kept on this device only, used to check that transactions went through',
    'อัปเดต': 'Update', 'ติดตั้งแอป': 'Install app', 'กำลังโหลด…': 'Loading…', 'เมนู': 'Menu',
    'เช็กเวอร์ชันใหม่และดึงข้อมูลล่าสุด': 'Check for a new version and fetch the latest data',
    'ออนไลน์ · ข้อมูลล่าสุด': 'Online · data updated', 'ออนไลน์': 'Online', 'ออฟไลน์ · แสดงข้อมูลที่บันทึกไว้': 'Offline · showing saved data',
    'การแจ้งเตือน': 'Notifications', 'ไม่มีการแจ้งเตือน': 'No notifications', 'อ่านทั้งหมดแล้ว': 'Mark all read',
    'วันสำคัญใน 7 วัน': 'Key dates in the next 7 days', 'แจ้งเตือนราคา': 'Price alerts',
    'สลับธีมมืด/สว่าง': 'Switch dark/light theme', 'เปลี่ยนภาษา': 'Change language',
    'อัปเดตแอปและข้อมูล': 'Update app and data', 'มีอะไรใหม่': "What's new", 'สำรองข้อมูล / นำเข้า': 'Backup / import',
    'ตั้งค่าแจ้งเตือน Telegram': 'Telegram alert settings', 'ติดตั้งเป็นแอป': 'Install as app', 'เวอร์ชัน': 'Version',
    'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน · แอปนี้ไม่รับฝากเงิน ไม่เชื่อมกระเป๋า และไม่ขอ seed phrase หรือ private key ใครขอคือมิจฉาชีพ':
      'For research only, not investment advice · This app never holds funds, never takes control of a wallet, and never asks for a seed phrase or private key. Anyone who asks is a scammer.',
    'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน · แอปนี้ไม่รับฝากเงินและไม่เชื่อมกระเป๋า': 'For research only, not investment advice · This app never holds funds or takes control of a wallet',
    'เนื้อหาวิจัยในแดชบอร์ดเป็นภาษาไทย': 'The dashboard research is written in Thai',
    'มีเวอร์ชันใหม่': 'New version available', 'กดอัปเดต': 'Update now', 'ออฟไลน์อยู่ ต่ออินเทอร์เน็ตก่อนแล้วกดอัปเดตอีกครั้ง': 'You are offline. Connect to the internet and press update again.',
    'อัปเดตเป็นเวอร์ชัน': 'Updated to version', 'แล้ว · ดูมีอะไรใหม่ →': "· see what's new →", 'ข้อมูลล่าสุด': 'Data updated',
    'ออฟไลน์อยู่ กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด': 'You are offline. Showing the last saved data.',
    '23 ต.ค. 2569': '23 Oct 2026', '(ที่ใช้อยู่)': '(current)', 'เพิ่ม': 'Add', 'มีอะไรใหม่ (ประวัติเวอร์ชัน)': "What's new (version history)", 'มีคำถามหรืออยากให้เพิ่มหัวข้อ บอกในแชตได้เลย': 'Questions or topics to add? Just ask in the chat.', 'กำลังอัปเดต…': 'Updating…',
    // changelog
    'แถบเครื่องมือมุมขวาบนแบบแอป PM: สถานะออนไลน์, กระดิ่งแจ้งเตือน, ธีมมืด/สว่าง, คู่มือ, ภาษา และเมนู': 'PM-style toolbar at the top right: online status, notification bell, dark/light theme, guide, language and menu',
    'เปลี่ยนภาษาเป็นอังกฤษได้ (เนื้อหาวิจัยในแดชบอร์ดยังเป็นภาษาไทย)': 'Switch the app to English (dashboard research stays in Thai)',
    'แก้นับถอยหลังที่แสดงรายการซ้ำ': 'Fixed duplicate items in the countdown',
    'แดชบอร์ดเป็นภาษาอังกฤษทั้งหน้าเมื่อเลือก English รวมบทวิจัยและบทวิเคราะห์รายเหรียญ (แปลใหม่ทุกเช้า)': 'The whole dashboard is in English when English is chosen, including the research and per-coin analysis (translated every morning)', 'ธงภาษาแสดงถูกต้องบน Windows': 'Language flags now show correctly on Windows',
    'แดชบอร์ดขยายเต็มจอบนจอใหญ่ ไม่มีขอบว่างสองข้าง': 'Dashboard uses the full width on large screens', 'หน้าพอร์ตและหน้ากราฟกว้างขึ้น': 'Wider portfolio and chart pages',
    'แจ้งเตือนเข้า Telegram: ราคาถึงเป้า และเหรียญที่ถือขยับแรงเกิน 10% ใน 24 ชม.': 'Telegram alerts: price targets hit and held coins moving more than 10% in 24h',
    'เตือนบนเครื่องเมื่อเหรียญที่ถือขยับแรง (วันละครั้งต่อเหรียญ)': 'Device alert when a held coin moves sharply (once a day per coin)',
    'สรุปทุกเช้า 07:35 น. เข้า Telegram แม้ปิดแอป (ต้องตั้งค่าใน GitHub ตามคู่มือ)': 'Morning digest to Telegram at 07:35 even when the app is closed (set up in GitHub, see the guide)',
    'ตั้งราคาเป้าหมาย: เตือนเมื่อเหรียญขึ้นถึงหรือลงถึงราคาที่ตั้ง (เด้งแจ้งเตือนบนเครื่องได้)': 'Price targets: alert when a coin rises to or falls to your price (with device notifications)',
    'บันทึกซื้อขาย: สรุปจำนวนที่ถือ ต้นทุนเฉลี่ย กำไรที่ขายแล้ว และส่งออกไฟล์ CSV': 'Trade log: holdings, average cost, realized profit and CSV export',
    'ไฟล์สำรองข้อมูลรวมราคาเป้าหมายและรายการซื้อขายด้วย': 'Backups now include price targets and trades',
    'แท็บกราฟ: ดูกราฟราคาแต่ละเหรียญ 7 วัน / 30 วัน / 90 วัน / 1 ปี พร้อมข้อมูลสำคัญ': 'Charts tab: 7D / 30D / 90D / 1Y price charts with key stats',
    'บทวิเคราะห์อัตโนมัติจากตัวเลข (แนวโน้ม, RSI, กรอบราคา, ความผันผวน) และบทวิเคราะห์รายวันจาก Claude สำหรับเหรียญที่ติดตาม': 'Automatic read of the numbers (trend, RSI, range, volatility) and a daily analysis by Claude for tracked coins',
    'กดชื่อเหรียญในตารางราคาหรือในกระเป๋า เพื่อเปิดกราฟได้ทันที': 'Tap a coin in the price table or your wallet to open its chart',
    'กระเป๋าแบบบัญชีเหมือน MetaMask: รวมหลายที่อยู่ไว้ในบัญชีเดียว พร้อมยอดรวมของบัญชีและของแต่ละที่อยู่': 'MetaMask-style accounts: several addresses in one account, with totals per account and per address',
    'อ่านยอด Bitcoin, Tron และ Stellar ได้แล้ว (แอปรู้เองว่าที่อยู่เป็นเครือข่ายไหน)': 'Reads Bitcoin, Tron and Stellar balances (the chain is detected from the address)',
    'ปุ่มคัดลอกที่อยู่ แก้ชื่อบัญชี และสร้างได้หลายบัญชี': 'Copy address, rename accounts, multiple accounts',
    'แสดงเลขเวอร์ชันทุกหน้าและหน้า "มีอะไรใหม่" นี้': 'Version number on every page and this "What\'s new" page',
    'ปุ่มเชื่อม MetaMask และ Phantom แบบดูอย่างเดียว ไม่ขอเซ็นหรืออนุมัติอะไร': 'Read-only connect for MetaMask and Phantom; never asks to sign or approve',
    'เพิ่มแท็บคู่มือภาษาไทยสำหรับมือใหม่': 'Beginner guide tab', 'เพิ่มปุ่มอัปเดต และแถบแจ้งเมื่อมีเวอร์ชันใหม่': 'Update button and new-version banner',
    'อ่านยอดกระเป๋า Solana': 'Reads Solana wallets', 'อ่านยอด EVM ได้เสถียรขึ้น ลองใหม่เองเมื่อพลาด และบอกชื่อเครือข่ายที่อ่านไม่ได้': 'More reliable EVM reads: retries and names any chain that failed',
    'เปิดตัวแอป: แดชบอร์ด พอร์ตส่วนตัว ติดตั้งได้ ใช้ออฟไลน์ได้': 'Launch: dashboard, private portfolio, installable, works offline',
    // portfolio page
    'พอร์ตของฉัน · เรดาร์คริปโต': 'My portfolio · Crypto Radar', 'กราฟเหรียญ · เรดาร์คริปโต': 'Coin charts · Crypto Radar', 'คู่มือ · เรดาร์คริปโต': 'Guide · Crypto Radar',
    'พอร์ตนี้เก็บไว้ในเครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์ คนอื่นมองไม่เห็น ถ้าจะย้ายไปเครื่องอื่นให้กด "สำรองข้อมูล" แล้ว "นำเข้า" ที่เครื่องใหม่':
      'This portfolio is stored on this device only. It is never uploaded and nobody else can see it. To move it to another device, use "Backup" and then "Import" there.',
    'มูลค่ารวมทั้งหมด': 'Total value', 'ในกระเป๋า (อ่านอัตโนมัติ)': 'In wallets (auto)', 'ที่กรอกเอง': 'Entered manually', 'ต้นทุนรวม': 'Total cost',
    'กำไร/ขาดทุน (ที่กรอกเอง)': 'Profit/loss (manual)', 'กระเป๋าของฉัน': 'My wallets',
    'รวมหลายที่อยู่ไว้ในบัญชีเดียวแบบใน MetaMask แอปอ่านยอดแบบดูอย่างเดียว รองรับ Ethereum และเครือข่าย EVM (Base, Polygon, Arbitrum, Optimism), Bitcoin, Solana, Tron และ Stellar':
      'Group several addresses into one account, like MetaMask. Balances are read-only. Supports Ethereum and EVM chains (Base, Polygon, Arbitrum, Optimism), Bitcoin, Solana, Tron and Stellar.',
    '↻ อ่านยอดใหม่': '↻ Refresh balances', '+ สร้างบัญชีใหม่': '+ New account', 'เพิ่มที่อยู่': 'Add an address', 'เพิ่มเข้าบัญชี': 'Add to account',
    '🦊 เชื่อม MetaMask (ดูอย่างเดียว)': '🦊 Connect MetaMask (read-only)', '👻 เชื่อม Phantom (ดูอย่างเดียว)': '👻 Connect Phantom (read-only)', 'ตัดการเชื่อมต่อ': 'Disconnect',
    'แอปนี้จะขอแค่ "ดูที่อยู่กระเป๋า" เท่านั้น จะไม่ขอให้เซ็น อนุมัติ (Approve) หรือส่งธุรกรรมใด ๆ ถ้าเห็นคำขอแบบนั้น ให้กดปฏิเสธทันที':
      'This app only asks to see your wallet address. It never asks you to sign, approve or send a transaction. If you see such a request, reject it.',
    'หรือวางที่อยู่เอง (แอปรู้เองว่าเป็นเครือข่ายไหน)': 'Or paste an address (the chain is detected automatically)',
    'เหรียญในกระเป๋าทั้งหมด': 'All coins in wallets', 'เหรียญ': 'Coin', 'เครือข่าย': 'Network', 'จำนวน': 'Amount', 'ราคา': 'Price', 'มูลค่า': 'Value',
    'อ่านยอดจาก Blockscout หรือ RPC สาธารณะ (EVM), mempool.space (Bitcoin), Solana RPC + Jupiter (Solana), TronGrid (Tron) และ Stellar Horizon ราคาจาก CoinGecko แสดงเฉพาะเหรียญที่มีราคาในตลาด เหรียญแปลก ๆ ที่ถูกส่งเข้ากระเป๋าโดยไม่ได้ขอมักเป็นสแกม อย่ากดหรือแลกเด็ดขาด':
      'Balances from Blockscout or public RPC (EVM), mempool.space (Bitcoin), Solana RPC + Jupiter (Solana), TronGrid (Tron) and Stellar Horizon; prices from CoinGecko. Only coins with a market price are shown. Unknown coins sent to you uninvited are usually scams: never click or swap them.',
    'เพิ่มเหรียญที่ถือ (กรอกเอง)': 'Add a holding (manual)', 'ชื่อเหรียญ': 'Coin name', 'ราคาที่ซื้อ (USD ต่อเหรียญ)': 'Buy price (USD per coin)',
    'ราคาตอนนี้ (USD, กรอกเอง)': 'Current price (USD, manual)', 'เหรียญที่กรอกเอง': 'Manual holdings', 'ราคาซื้อ': 'Buy price', 'ราคาล่าสุด': 'Latest price', 'กำไร/ขาดทุน': 'Profit/loss',
    'ราคาเป้าหมาย': 'Price targets',
    'ตั้งราคาที่อยากซื้อหรืออยากขาย แอปจะเตือนเมื่อราคาถึง เช็กทันทีที่เปิดแอป และทุก 5 นาทีระหว่างที่เปิดอยู่': 'Set the price you want to buy or sell at and the app alerts you when it gets there. It checks when the app opens and every 5 minutes while open.',
    'เตือนเมื่อราคา': 'Alert when price', 'ขึ้นถึง (ขึ้นไปแตะ)': 'rises to', 'ลงถึง (ลงมาแตะ)': 'falls to', 'ราคา (USD)': 'Price (USD)', 'โน้ต (ไม่ใส่ก็ได้)': 'Note (optional)',
    'ตั้งเป้า': 'Set target', '🔔 เปิดการแจ้งเตือนบนเครื่องนี้': '🔔 Turn on notifications on this device', 'เงื่อนไข': 'Condition', 'ราคาเป้า': 'Target', 'ห่างอีก': 'Distance', 'สถานะ': 'Status',
    'แจ้งเตือนได้เฉพาะตอนที่เปิดแอปอยู่ (หรือตอนเปิดครั้งถัดไป) ถ้าต้องการให้เตือนตอนปิดแอปด้วย ให้ตั้งค่า Telegram ด้านล่าง': 'Alerts fire while the app is open (or the next time you open it). For alerts while it is closed, set up Telegram below.',
    'แจ้งเตือนเข้า Telegram': 'Telegram alerts',
    'ให้แอปส่งแจ้งเตือนเข้า Telegram ของคุณ ทั้งราคาถึงเป้า และเหรียญในพอร์ตขยับแรงเกิน 10% ใน 24 ชม. ตั้งครั้งเดียวต่อเครื่อง': 'Send alerts to your Telegram: targets hit and portfolio coins moving more than 10% in 24h. Set up once per device.',
    'ใน Telegram ค้นหา': 'In Telegram, search for', '(มีเครื่องหมายถูกสีฟ้า) พิมพ์': '(blue check mark), type', 'ตั้งชื่อบอท แล้วคัดลอก': 'name your bot, then copy the',
    'ที่ได้มาวางด้านล่าง': 'it gives you and paste it below', 'กดเข้าไปที่บอทที่เพิ่งสร้าง แล้วกด': 'Open the bot you just made and press', '(หรือพิมพ์อะไรก็ได้ส่งไป 1 ข้อความ)': '(or send it any message)',
    'กลับมากด': 'Come back and press', 'หา Chat ID ให้': 'Find my Chat ID', 'แล้วกด': 'then', 'ทดสอบส่ง': 'Send test', 'บันทึก + ทดสอบส่ง': 'Save + send test', 'ลบการตั้งค่า': 'Remove settings',
    'token ของบอทเก็บไว้ในเครื่องนี้เท่านั้น ไม่อยู่ในไฟล์สำรอง อย่าส่ง token ให้ใคร ถ้าหลุดให้กด /revoke ใน @BotFather แล้วสร้างใหม่': 'The bot token stays on this device and is not in backups. Never share it. If it leaks, use /revoke in @BotFather and make a new one.',
    'แอปส่งได้ตอนที่เปิดอยู่เท่านั้น ส่วน': 'The app can only send while it is open. The', 'สรุปทุกเช้า 07:35 น.': 'morning digest at 07:35',
    '(วันปิดแอร์ดรอป วันปลดล็อก และเหรียญที่ติดตามขยับแรง) ส่งเองได้แม้ปิดแอป ถ้าตั้งค่าใน GitHub ตามคู่มือ': '(airdrop deadlines, unlocks and big moves) is sent even when the app is closed, once set up in GitHub (see the guide).',
    'บันทึกซื้อขาย': 'Trade log',
    'จดทุกครั้งที่ซื้อหรือขาย แอปสรุปจำนวนที่ถือ ต้นทุนเฉลี่ย และกำไรที่ขายไปแล้วให้ ส่งออกเป็นไฟล์ CSV เปิดใน Excel หรือ Google Sheets ได้': 'Record every buy and sell. The app works out holdings, average cost and realized profit, and exports a CSV for Excel or Google Sheets.',
    'วันที่': 'Date', 'รายการ': 'Type', 'ซื้อ': 'Buy', 'ขาย': 'Sell', 'จำนวนเหรียญ': 'Coins', 'ราคาต่อเหรียญ': 'Price per coin', 'สกุลเงิน': 'Currency', 'บาท (THB)': 'Baht (THB)',
    'ดอลลาร์ (USD)': 'Dollar (USD)', 'ค่าธรรมเนียม': 'Fee', 'ที่ไหน': 'Where', 'กระเป๋า (DEX)': 'Wallet (DEX)', 'อื่น ๆ': 'Other', 'โน้ต': 'Note', 'บันทึก': 'Save',
    'สรุปรายเหรียญ': 'Summary by coin', 'สกุล': 'Currency', 'ถืออยู่': 'Holding', 'ต้นทุนเฉลี่ย': 'Average cost', 'ต้นทุนที่ยังถือ': 'Cost of holding', 'กำไรที่ขายแล้ว': 'Realized profit',
    'รายการทั้งหมด': 'All trades', 'รวม': 'Total', '⬇ ส่งออก CSV': '⬇ Export CSV',
    'ไฟล์นี้ช่วยรวบรวมข้อมูลไว้ใช้ตอนยื่นภาษี กฎภาษีคริปโตของไทยมีข้อยกเว้นบางกรณี (เช่น ขายผ่านกระดานที่ได้รับอนุญาต) ควรเช็กกับกรมสรรพากรหรือผู้เชี่ยวชาญอีกครั้ง กำไรคำนวณแบบต้นทุนเฉลี่ย แยกตามสกุลเงิน':
      'This file helps you gather records for tax filing. Thai crypto tax rules have exceptions (for example, sales through licensed exchanges), so check with the Revenue Department or an advisor. Profit uses the average-cost method, per currency.',
    'สำรองและย้ายข้อมูล': 'Backup and move', 'สำรองข้อมูล (ดาวน์โหลดไฟล์)': 'Backup (download file)', 'นำเข้าไฟล์สำรอง': 'Import backup',
    'ห้ามกรอก seed phrase (คำกู้กระเป๋า 12/24 คำ) หรือ private key ลงในแอปนี้หรือที่ไหนก็ตาม แอปนี้ไม่ต้องใช้ข้อมูลนั้นเลย ใครขอ = มิจฉาชีพ':
      'Never enter a seed phrase (12/24 recovery words) or private key here or anywhere else. This app never needs them. Anyone who asks is a scammer.',
    'เช่น BTC': 'e.g. BTC', 'เช่น SAND, BTC': 'e.g. SAND, BTC', 'เช่น ขายครึ่งหนึ่ง': 'e.g. sell half', 'กดปุ่มหาให้': 'press Find', 'เช่น SAND หรือ BTC': 'e.g. SAND or BTC',
    'บัญชี 1': 'Account 1', 'บัญชี': 'Account', 'บันทึกในเครื่องไม่ได้ (อาจเปิดโหมดไม่ระบุตัวตนอยู่)': 'Could not save on this device (private browsing?)',
    'ดูกราฟ': 'View chart', 'แก้ชื่อ': 'Rename', 'ชื่อบัญชี': 'Account name', 'ลบบัญชี': 'Delete account', 'ลบ "': 'Delete "',
    '" และที่อยู่ทั้งหมดในบัญชีนี้ออกจากแอป? (เงินในกระเป๋าไม่ได้หายไปไหน)': '" and all its addresses from the app? (Your funds are not affected.)',
    'ยังไม่มีที่อยู่ในบัญชีนี้ เพิ่มได้จากด้านล่าง': 'No addresses yet. Add one below.', 'คัดลอกที่อยู่': 'Copy address', 'อ่านไม่ได้': 'Unavailable',
    'ยอดล่าสุดที่อ่านได้': 'last known balance', 'เอาออก': 'Remove', 'ยังไม่ได้ใส่ที่อยู่กระเป๋า': 'No wallet address yet', 'กำลังอ่านยอดจากบล็อกเชน…': 'Reading balances from the blockchain…',
    'ตอนนี้เชื่อมต่อบล็อกเชนไม่ได้ ลองกด "อ่านยอดใหม่" อีกครั้งในอีกสักครู่': 'Cannot reach the blockchain right now. Try "Refresh balances" again shortly.',
    'ไม่พบเหรียญที่มีราคาในตลาดในกระเป๋า': 'No coins with a market price found',
    '⚠ = เหรียญที่ยังไม่ได้รับการยืนยันหรือสภาพคล่องต่ำ ราคาอาจไม่จริง อาจเป็นเหรียญสแกมที่ถูกส่งมาเอง และไม่นับรวมในยอดรวม': '⚠ = unverified or low-liquidity coin. The price may not be real and it may be an airdropped scam. Not counted in totals.',
    'อ่านไม่สำเร็จ:': 'Could not read:', '(แสดงยอดล่าสุดที่เคยอ่านได้แทน)': '(showing last known balances)',
    'มักเกิดจากเว็บสำรวจบล็อกเชนจำกัดจำนวนครั้ง กด "อ่านยอดใหม่" อีกครั้งได้': 'Usually the explorer is rate-limiting. Press "Refresh balances" again.',
    'สร้างได้สูงสุด': 'You can create up to', 'ตั้งชื่อบัญชีใหม่': 'Name the new account', 'ที่อยู่นี้อยู่ใน "': 'This address is already in "', '" แล้ว': '"',
    'บัญชีนี้ใส่ได้สูงสุด': 'This account holds up to', 'ที่อยู่': 'addresses',
    'นี่ดูเหมือน seed phrase! แอปไม่ได้บันทึกไว้ ห้ามให้ใครเห็นคำชุดนี้เด็ดขาด ให้ใส่เฉพาะที่อยู่กระเป๋า': 'That looks like a seed phrase! It was not saved. Never show these words to anyone. Enter only a wallet address.',
    'นี่ดูเหมือน private key! แอปไม่ได้บันทึกไว้ ถ้าเคยให้ใครเห็นให้ย้ายเงินไปกระเป๋าใหม่ทันที ให้ใส่เฉพาะที่อยู่กระเป๋า': 'That looks like a private key! It was not saved. If anyone has seen it, move your funds to a new wallet now. Enter only a wallet address.',
    'ไม่รู้จักที่อยู่นี้ ใส่ได้: EVM (0x…), Bitcoin (bc1… / 1… / 3…), Solana, Tron (T…), Stellar (G…) กดคัดลอกจากแอปกระเป๋าได้เลย': 'Unknown address. Supported: EVM (0x…), Bitcoin (bc1… / 1… / 3…), Solana, Tron (T…), Stellar (G…). Copy it from your wallet app.',
    'เข้า "': 'to "', 'กระเป๋า': 'Wallet', 'บนมือถือต้องเปิดแอปนี้จากเบราว์เซอร์ในแอป': "On a phone, open this app from the in-app browser of", 'หรือวางที่อยู่กระเป๋าเองในช่องด้านล่าง:': 'or paste the address below:',
    'ไม่พบ': 'Not found:', 'ในเบราว์เซอร์นี้ ติดตั้งส่วนขยายก่อน หรือวางที่อยู่กระเป๋าเองในช่องด้านล่าง': 'in this browser. Install the extension or paste the address below.',
    'เปิดในแอป': 'Open in', 'กดยืนยันการเชื่อมต่อใน': 'Approve the connection in', '(เป็นการขอดูที่อยู่เท่านั้น)': '(it only shares your address)', 'ไม่ได้รับที่อยู่จากกระเป๋า': 'No address received from the wallet',
    'เชื่อม': 'Connected', 'แล้ว (ดูอย่างเดียว)': '(read-only)', 'ยกเลิกการเชื่อมต่อแล้ว': 'Connection cancelled', 'เชื่อมต่อไม่สำเร็จ ลองใหม่ หรือวางที่อยู่เองด้านล่าง': 'Could not connect. Try again or paste the address below.',
    'กดยืนยันการเชื่อมต่อใน Phantom (เป็นการขอดูที่อยู่เท่านั้น)': 'Approve the connection in Phantom (it only shares your address)', 'เชื่อม Phantom แล้ว (ดูอย่างเดียว)': 'Phantom connected (read-only)',
    'ตัดการเชื่อมต่อแล้ว และเอาที่อยู่ที่เชื่อมไว้ออกจากรายการ': 'Disconnected and removed the connected addresses',
    'เปิดแจ้งเตือนแล้ว': 'Notifications on', 'เบราว์เซอร์บล็อกการแจ้งเตือนไว้ เปิดได้ในการตั้งค่าเว็บไซต์': 'Notifications are blocked. Allow them in the site settings.',
    'เครื่องนี้ไม่รองรับ (iPhone ต้องติดตั้งแอปลงหน้าจอโฮมก่อน)': 'Not supported here (on iPhone, add the app to the Home Screen first)', 'ยังไม่ได้ตั้งราคาเป้าหมาย': 'No price targets yet',
    'ขึ้นถึง': 'rises to', 'ลงถึง': 'falls to', 'ถึงแล้ว': 'Reached', 'รอ': 'Waiting', 'ตั้งใหม่': 'Re-arm', 'ลบ': 'Delete',
    'ใส่ชื่อเหรียญ เช่น SAND หรือ BTC': 'Enter a coin, e.g. SAND or BTC', 'ใส่ราคาเป้าหมายเป็นดอลลาร์': 'Enter the target price in USD', 'ตั้งได้สูงสุด 30 รายการ': 'Up to 30 targets',
    '· กด "เปิดการแจ้งเตือน" ด้วย เพื่อให้เด้งเตือนบนเครื่อง': '· also turn on notifications to get alerts on this device', 'ตั้งค่าแล้ว แอปจะส่งแจ้งเตือนเข้า Telegram': 'Set up. Alerts will go to Telegram.',
    'token ไม่ถูกต้อง คัดลอกจาก @BotFather ทั้งบรรทัด (หน้าตาแบบ 123456789:AA...)': 'Invalid token. Copy the whole line from @BotFather (looks like 123456789:AA...)',
    'กำลังหา…': 'Searching…', 'ยังไม่เจอ กดเข้าไปที่บอทใน Telegram แล้วกด Start หรือส่งข้อความหาบอท 1 ครั้ง แล้วกดปุ่มนี้อีกครั้ง': 'Not found yet. Open the bot in Telegram, press Start or send it a message, then press this again.',
    'เจอแล้ว': 'Found', 'กด "บันทึก + ทดสอบส่ง" ต่อได้เลย': 'Now press "Save + send test"', 'ติดต่อ Telegram ไม่ได้:': 'Cannot reach Telegram:', 'token ไม่ถูกต้อง': 'Invalid token',
    'ใส่ Chat ID (กด "หา Chat ID ให้")': 'Enter the Chat ID (press "Find my Chat ID")', 'กำลังส่งข้อความทดสอบ…': 'Sending a test message…',
    'ส่งสำเร็จ เช็กใน Telegram ได้เลย บันทึกการตั้งค่าแล้ว': 'Sent. Check Telegram. Settings saved.', 'ส่งไม่สำเร็จ:': 'Send failed:', '(เช็ก token และกด Start ที่บอทแล้วหรือยัง)': '(check the token and that you pressed Start on the bot)',
    'ลบการตั้งค่า Telegram ในเครื่องนี้?': 'Remove the Telegram settings on this device?', 'ลบแล้ว': 'Removed', 'ยังไม่มีรายการ': 'Nothing yet', 'ขายมากกว่าที่บันทึกว่าซื้อ': 'Sold more than recorded buys',
    'ลบรายการนี้?': 'Delete this trade?', 'ใส่วันที่': 'Enter a date', 'ใส่ชื่อเหรียญ เช่น BTC': 'Enter a coin, e.g. BTC', 'ใส่จำนวนเหรียญและราคาให้ถูกต้อง': 'Enter a valid amount and price',
    'การซื้อ': ' buy', 'การขาย': ' sell', 'ดาวน์โหลดไฟล์ CSV แล้ว': 'CSV downloaded', 'เหรียญอื่น (กรอกเอง)': 'Other coin (type it)', 'ยังไม่มีเหรียญในพอร์ต เพิ่มได้จากช่องด้านบน': 'No holdings yet. Add one above.',
    '(กรอกเอง)': '(manual)', 'กรุณาเลือกหรือกรอกชื่อเหรียญ (ตัวอักษร/ตัวเลขเท่านั้น)': 'Choose or type a coin (letters and digits only)', 'กรุณากรอกจำนวนและราคาที่ซื้อให้ถูกต้อง': 'Enter a valid amount and buy price',
    'บันทึกแล้ว': 'Saved', 'ดาวน์โหลดไฟล์สำรองแล้ว เก็บไว้ในที่ปลอดภัย': 'Backup downloaded. Keep it somewhere safe.', 'นำเข้าเรียบร้อย': 'Imported', 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปนี้': 'This is not a backup from this app',
    'ราคาล่าสุด ณ': 'Prices as of', '· อัปเดตทุกเช้าประมาณ 06:47 น.': '· updated every morning around 06:47', 'โหลดราคาไม่ได้': 'Could not load prices', 'นำเข้า': 'Import',
    'เหรียญ และ': 'coins and', 'ที่อยู่ใน': 'addresses in', 'บัญชี และ': 'accounts and', 'รายการซื้อขาย แทนข้อมูลเดิมในเครื่องนี้?': 'trades, replacing the data on this device?',
    'แผงกระเป๋าฝังขวาแบบ MetaMask: บัญชี ยอดรวม เหรียญแยกเครือข่าย (ดูอย่างเดียว)': 'MetaMask-style wallet panel on the right: account, total and coins by network (read-only)',
    'แท็บกิจกรรม: เว็บทางการที่ตรวจแล้ว ตัวตรวจลิงก์ก่อนเชื่อมกระเป๋า และสิ่งที่กดได้/ห้ามกด': 'Activities tab: verified official sites, a link checker before connecting, and what is safe to approve',
    'ฟอนต์ภาษาไทยใหม่ (Noto Sans Thai Looped) อ่านง่ายขึ้น ใช้ได้แม้ออฟไลน์': 'New Thai font (Noto Sans Thai Looped), easier to read, works offline',
    'การ์ดนับถอยหลังกดไปเว็บทางการได้': 'Countdown cards link to official sites',
    'กระเป๋าแบบแท็บ: แสดงเฉพาะกระเป๋าที่คุณเพิ่มไว้ สลับได้ทั้งในหน้าพอร์ตและแผงด้านขวา กด + เพื่อเพิ่ม': 'Wallet tabs: only the wallets you added, switchable on the Portfolio page and in the side panel; + to add one',
    'เชื่อม Ronin Wallet และกระเป๋าอื่นที่ติดตั้งในเบราว์เซอร์ได้ (ดูอย่างเดียว)': 'Connect Ronin Wallet and other wallets installed in the browser (read-only)',
    'อ่านยอดบนเครือข่าย Ronin: RON, AXS, SLP, WETH และ USDC': 'Reads Ronin balances: RON, AXS, SLP, WETH and USDC',
    // wallet tabs
    'แสดงเฉพาะกระเป๋าที่คุณเพิ่มไว้ กดแท็บเพื่อสลับกระเป๋า กด + เพื่อเพิ่ม แอปอ่านยอดแบบดูอย่างเดียว รองรับ Ethereum และเครือข่าย EVM (Base, Polygon, Arbitrum, Optimism, Ronin), Bitcoin, Solana, Tron และ Stellar':
      'Only the wallets you added are shown. Tap a tab to switch wallets, + to add one. Balances are read-only. Supports Ethereum and EVM chains (Base, Polygon, Arbitrum, Optimism, Ronin), Bitcoin, Solana, Tron and Stellar.',
    'เพิ่มกระเป๋า': 'Add wallet', 'เอากระเป๋านี้ออก': 'Remove this wallet', 'เชื่อมกระเป๋า (ดูอย่างเดียว)': 'Connect a wallet (read-only)',
    'หรือวางที่อยู่เอง': 'Or paste an address', 'เพิ่มเข้า': 'Add to', '+ กระเป๋าใหม่': '+ New wallet',
    'ที่อยู่กระเป๋า (แอปรู้เองว่าเป็นเครือข่ายไหน)': 'Wallet address (the chain is detected automatically)',
    'เหรียญใน': 'Coins in', 'เหรียญในกระเป๋าทั้งหมด': 'All coins in wallets', 'เพิ่มแล้ว · เชื่อมใหม่': 'Added · reconnect', 'ยังไม่ได้ติดตั้ง': 'Not installed',
    'กระเป๋าของคุณอยู่ในเบราว์เซอร์อื่น? (เช่น ติดตั้ง MetaMask ไว้ใน Chrome แต่ตอนนี้เปิดด้วย Edge)': 'Is your wallet in another browser? (for example, MetaMask is in Chrome but you opened this in Edge)',
    'เว็บแอปเลือกเบราว์เซอร์ให้เองไม่ได้ ให้เปิดหน้านี้ในเบราว์เซอร์ที่มีกระเป๋าของคุณอยู่แล้ว:': 'A web app cannot pick the browser for you. Open this page in the browser that already has your wallet:',
    '📋 คัดลอกลิงก์หน้านี้': '📋 Copy link to this page',
    'กดคัดลอกลิงก์ (หรือกดปุ่มเปิดในเบราว์เซอร์ด้านบน ถ้ามี)': 'Copy the link (or use an "Open in" button above, if shown)',
    'เปิดเบราว์เซอร์ที่มีกระเป๋าของคุณ แล้ววางลิงก์ในช่องที่อยู่เว็บ': 'Open the browser that has your wallet and paste the link into the address bar',
    'กดแท็บ + เพิ่มกระเป๋า แล้วเลือกกระเป๋าอีกครั้ง': 'Open the + Add wallet tab and pick your wallet again',
    'แนะนำ: ติดตั้งแอปจากเบราว์เซอร์นั้น (เมนู ⋮ → ติดตั้งแอป) แอปจะเปิดด้วยเบราว์เซอร์นั้นทุกครั้ง และเห็นกระเป๋าเลย': 'Tip: install the app from that browser (menu ⋮ → Install app). The app then always opens in that browser and sees your wallet.',
    'ถ้ากดเชื่อมแล้วกระเป๋าขึ้นหน้า "Create a new wallet" หรือ "I have an existing wallet" แปลว่ากระเป๋าของคุณไม่ได้อยู่ในเบราว์เซอร์นี้ ให้ปิดหน้านั้นได้เลย': 'If the wallet shows "Create a new wallet" or "I have an existing wallet" after you press connect, your wallet is not in this browser. Just close that page.',
    'อย่านำคำกู้คืน (Seed Phrase) ไปกรอกในเบราว์เซอร์ที่สองเพื่อการนี้': 'Do not type your Seed Phrase into a second browser for this.',
    'ใช้เบราว์เซอร์เดิม หรือวางที่อยู่เองด้านล่างแทน': 'Use your usual browser, or paste the address below instead.',
    'ตอนนี้แอปนี้เปิดด้วย': 'This app is running in',
    'ตอนนี้คุณเปิดหน้านี้ด้วย': 'You opened this page in',
    'เปิดใน': 'Open in',
    'คัดลอกแล้ว นำไปวางในเบราว์เซอร์ที่มีกระเป๋า': 'Copied. Paste it into the browser that has your wallet.',
    '(เป็นการขอดูที่อยู่เท่านั้น) ถ้า': '(it only shares your address). If',
    'ขึ้นหน้าสร้างกระเป๋าใหม่ แปลว่ากระเป๋าไม่ได้อยู่ในเบราว์เซอร์นี้ ให้ปิดหน้านั้น อย่ากรอกคำกู้คืน แล้วใช้ปุ่มวางที่อยู่ด้านบนแทน': 'shows a "create a new wallet" page, your wallet is not in this browser. Close that page, do not type your recovery phrase, and use the paste-address button above instead.',
    '📋 วางที่อยู่กระเป๋าที่คัดลอกไว้': '📋 Paste the wallet address you copied',
    'ง่ายสุด: เปิด MetaMask แล้วกดที่ที่อยู่ (0x…) ใต้ชื่อบัญชีเพื่อคัดลอก แล้วกดปุ่มนี้ ไม่ต้องเชื่อมต่อ ไม่ต้องเซ็นอะไร': 'Easiest: open MetaMask, click the address (0x…) under the account name to copy it, then press this button. No connecting, nothing to sign.',
    'หรือเชื่อมกระเป๋าในเบราว์เซอร์นี้ (ดูอย่างเดียว)': 'Or connect a wallet in this browser (read-only)',
    'อ่านคลิปบอร์ดไม่ได้ ให้กด Ctrl+V (มือถือ: กดค้างแล้วเลือกวาง) ในช่องที่อยู่ด้านล่าง แล้วกดเพิ่ม': 'Could not read the clipboard. Press Ctrl+V (on a phone: long-press and Paste) in the address box below, then press Add.',
    'เพิ่มกระเป๋าแล้ว กำลังอ่านยอด… (กดชื่อแท็บเพื่อเปลี่ยนชื่อได้)': 'Wallet added, reading balances… (you can rename it in its tab)',
    'กระเป๋าของคุณอยู่ในเบราว์เซอร์ไหน?': 'Which browser has your wallet?',
    'แอปเห็นได้เฉพาะกระเป๋าที่ติดตั้งในเบราว์เซอร์ที่เปิดแอปอยู่': 'The app can only see wallets installed in the browser it is open in',
    'ตอนนี้คือ': 'now:',
    'เบราว์เซอร์นี้': 'This browser',
    'เชื่อมกระเป๋าที่ติดตั้งในเบราว์เซอร์นี้เลย': 'Connect the wallet installed in this browser',
    'เปิดแอปนี้ใน': 'Open this app in',
    'แล้วกดเชื่อมที่นั่น': 'and connect there',
    'เปิด': 'Open',
    'แล้วพิมพ์': 'and type',
    'กำลังเปิด Edge… ถ้าไม่ขึ้น': 'Opening Edge… If nothing happens:',
    'คัดลอกลิงก์แล้ว ✓': 'Link copied ✓',
    'แล้ว Enter': 'then Enter',
    '(เบราว์เซอร์อื่นสั่งเปิด Chrome ให้โดยตรงไม่ได้)': '(other browsers cannot open Chrome directly)',
    'ปิด': 'Close',
    'กดเชื่อมกระเป๋าแล้วถามก่อนว่ากระเป๋าอยู่ในเบราว์เซอร์ไหน (เบราว์เซอร์นี้ / Chrome / Edge / Brave) ถ้าอยู่อีกเบราว์เซอร์ แอปพาไปเปิดที่นั่นให้': 'Connect now asks which browser holds your wallet (this one / Chrome / Edge / Brave) and helps you open the app there',
    'ปุ่มเดียว "วางที่อยู่กระเป๋าที่คัดลอกไว้" ไม่ต้องเชื่อมต่อ': 'One button "Paste the wallet address you copied", no connecting needed',
    'เตือนตอนกดเชื่อม: ถ้ากระเป๋าขึ้นหน้าสร้างกระเป๋าใหม่ ให้ปิด อย่ากรอกคำกู้คืนในเบราว์เซอร์ที่สอง': 'Warning on connect: if the wallet shows a create-new-wallet page, close it and never type your recovery phrase into a second browser',
    'แจ้งเตือนได้เฉพาะตอนที่เปิดแอปอยู่ (หรือตอนเปิดครั้งถัดไป)': 'Alerts work only while the app is open (or the next time you open it)',
    'ปิดการแจ้งเตือน Telegram ไว้ก่อน': 'Telegram alerts switched off for now',
    'เชื่อมด้วยปุ่มกระเป๋า (ไม่จำเป็น)': 'Connect with a wallet button (optional)',
    'หรือพิมพ์ที่อยู่เอง': 'Or type the address yourself',
    'ตอนนี้ MetaMask อาจขึ้นป้ายแดงว่าเว็บนี้ "Malicious — flagged as unsafe" เพราะระบบสแกนอัตโนมัติจับเว็บใหม่บน github.io ที่ขอเชื่อมกระเป๋า เรากำลังยื่นเรื่องให้ตรวจใหม่ ระหว่างนี้': 'MetaMask may currently show a red "Malicious — flagged as unsafe" label for this site, because automatic scanners flag new github.io sites that ask to connect a wallet. We are asking for a re-review. Until then,',
    'ถ้าเห็นป้ายนั้น ให้กด "Back to safety" แล้วใช้ปุ่ม "วางที่อยู่กระเป๋า" ด้านบนแทน': 'if you see that label, press "Back to safety" and use the "Paste wallet address" button above instead.',
    'ได้ผลเหมือนกัน และปลอดภัยกว่าเพราะไม่ต้องเชื่อมอะไรเลย': 'It gives the same result and is safer, since nothing gets connected.',
    'แสดงยอดล่าสุดที่เคยอ่านได้แทน': 'Showing the last balance that was read instead.',
    'กด "อ่านยอดใหม่" อีกครั้งได้': 'Press "Re-read balances" to try again.',
    'เรียกถี่เกินไป (ผู้ให้บริการจำกัด) ลองใหม่อีกสักครู่': 'too many requests (provider limit), try again shortly',
    'ผู้ให้บริการไม่อนุญาตให้เรียกจากเบราว์เซอร์': 'the provider does not allow calls from a browser',
    'ผู้ให้บริการขัดข้องชั่วคราว': 'the provider is temporarily down',
    'ผู้ให้บริการตอบช้าเกินไป': 'the provider took too long to answer',
    'เชื่อมต่อผู้ให้บริการไม่ได้ (เน็ต, ตัวบล็อกโฆษณา หรือ VPN อาจบล็อกอยู่)': 'could not reach the provider (internet, an ad blocker or a VPN may be blocking it)',
    'ผู้ให้บริการตอบกลับผิดปกติ': 'the provider sent an unexpected answer',
    'แก้ "อ่านไม่ได้": Solana และ EVM ใช้ผู้ให้บริการสำรองเมื่อตัวหลักบล็อก และเครือข่ายเดียวพังจะไม่ทำให้ทั้งกระเป๋าอ่านไม่ได้อีก': 'Fixed "can\'t read": Solana and EVM fall back to other providers when the main one blocks, and one failing network no longer marks the whole wallet unreadable',
    'บอกเหตุผลจริงเมื่ออ่านยอดไม่ได้': 'Shows the real reason when a balance cannot be read',
    'ปุ่มวางที่อยู่กระเป๋าเป็นทางหลัก ปุ่มเชื่อมกระเป๋าย้ายไปเป็นตัวเลือกเสริม': 'Paste wallet address is now the main way; wallet connect buttons moved to an optional section',
    'พบในเบราว์เซอร์นี้': 'Found in this browser', 'ไม่พบ': 'Not found:', 'ในเบราว์เซอร์นี้ ติดตั้งจากเว็บทางการก่อน หรือวางที่อยู่เองด้านล่าง': 'in this browser. Install it from the official site first, or paste an address below.',
    'ดาวน์โหลด': 'Download', '(เว็บทางการ) ↗': '(official site) ↗', 'บนมือถือต้องเปิดแอปนี้จากเบราว์เซอร์ในแอป': 'On a phone, open this app in the in-app browser of',
    'หรือวางที่อยู่เองด้านล่าง:': 'or paste an address below:', 'เปิดในแอป': 'Open in', 'ชื่อกระเป๋า': 'Wallet name',
    'เอา': 'Remove', 'ออกจากแอป? (เงินในกระเป๋าไม่ได้หายไปไหน แอปแค่เลิกอ่านยอด)': 'from the app? (Your funds stay where they are; the app just stops reading the balance.)',
    'ยังไม่มีที่อยู่ในกระเป๋านี้ เพิ่มได้ที่แท็บ "+"': 'No addresses in this wallet yet. Add one on the "+" tab.', 'ยังไม่มีที่อยู่ในกระเป๋านี้': 'No addresses in this wallet yet',
    'เพิ่มกระเป๋าได้สูงสุด': 'You can add up to', ' ใบ': ' wallets', 'กระเป๋านี้ใส่ได้สูงสุด': 'This wallet holds up to', ' ที่อยู่': ' addresses',
    'ไม่รู้จักที่อยู่นี้ ใส่ได้: EVM / Ronin (0x… หรือ ronin:…), Bitcoin (bc1… / 1… / 3…), Solana, Tron (T…), Stellar (G…) กดคัดลอกจากแอปกระเป๋าได้เลย': 'Unknown address. Accepted: EVM / Ronin (0x… or ronin:…), Bitcoin (bc1… / 1… / 3…), Solana, Tron (T…), Stellar (G…). Copy it from your wallet app.',
    'อ่านยอดจาก Blockscout หรือ RPC สาธารณะ (EVM), mempool.space (Bitcoin), Solana RPC + Jupiter (Solana), TronGrid (Tron), Stellar Horizon และ Ronin RPC ราคาจาก CoinGecko แสดงเฉพาะเหรียญที่มีราคาในตลาด เหรียญแปลก ๆ ที่ถูกส่งเข้ากระเป๋าโดยไม่ได้ขอมักเป็นสแกม อย่ากดหรือแลกเด็ดขาด':
      'Balances from Blockscout or public RPC (EVM), mempool.space (Bitcoin), Solana RPC + Jupiter (Solana), TronGrid (Tron), Stellar Horizon and Ronin RPC; prices from CoinGecko. Only coins with a market price are shown. Unknown coins sent to you uninvited are usually scams: never click or swap them.',
    // coin page
    'ค้นหา': 'Search', 'เลือกเหรียญด้านบนเพื่อดูกราฟและบทวิเคราะห์': 'Pick a coin above to see its chart and analysis',
    'ราคาและกราฟจาก CoinGecko (สำรองด้วย Binance) บทวิเคราะห์เป็นข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน': 'Prices and charts from CoinGecko (Binance as backup). Analysis is for research, not investment advice.',
    'ค้นหาเหรียญ เช่น BTC, SAND, Solana': 'Search coins, e.g. BTC, SAND, Solana', 'เหรียญเกมที่ติดตาม': 'Tracked game coins', 'เหรียญในกระเป๋าของฉัน': 'Coins in my wallets', 'เหรียญหลัก': 'Major coins',
    'กำลังค้นหา…': 'Searching…', 'ไม่พบเหรียญนี้': 'Coin not found', '(อันดับ': '(rank', 'ค้นหาไม่ได้ตอนนี้ (CoinGecko จำกัดจำนวนครั้ง) ลองใหม่ในอีกสักครู่': 'Search is unavailable right now (CoinGecko rate limit). Try again shortly.',
    'เหนือ': 'above', 'ใต้': 'below', 'แรงซื้อยังนำ': ': buyers still lead', 'แรงขายยังนำ': ': sellers still lead', 'ยังไม่มีทิศทางชัด': ': no clear direction yet',
    '(ร้อนแรง ขึ้นเร็ว มีโอกาสย่อ)': '(overheated, may pull back)', '(ถูกขายหนัก อาจเด้งได้ แต่ยังไม่ใช่สัญญาณกลับตัว)': '(heavily sold, may bounce, not a reversal signal)', '(ปกติ)': '(normal)',
    '(สูงมาก ขึ้นลงแรง)': '(very high, big swings)', '(สูง)': '(high)', '(ปานกลาง)': '(moderate)',
    'โหลดข้อมูลเหรียญนี้ไม่ได้ตอนนี้ (อาจถูกจำกัดจำนวนครั้ง) ลองกดใหม่ในอีกสักครู่': 'Could not load this coin right now (maybe rate-limited). Try again shortly.',
    '· อันดับ': '· rank', '(24 ชม.)': '(24h)', '7 วัน': '7D', '30 วัน': '30D', '90 วัน': '90D', '1 ปี': '1Y', 'ข้อมูลสำคัญ': 'Key stats', 'มูลค่าตลาด': 'Market cap',
    'ปริมาณซื้อขาย 24 ชม.': '24h volume', 'เปลี่ยนแปลง': 'Change', 'สูงสุดตลอดกาล': 'All-time high', 'เหรียญหมุนเวียน': 'Circulating supply', 'เหรียญทั้งหมด': 'Total supply',
    'บทวิเคราะห์': 'Analysis', 'ขาขึ้น': 'Uptrend', 'ขาลง': 'Downtrend', 'ไซด์เวย์': 'Sideways', 'จากการค้นคว้าของ Claude': "Claude's research", 'ข้อมูล ณ': 'as of', 'ความเสี่ยง': 'Risk',
    'เรื่องที่ต้องจับตา': 'Watch for', 'ยังไม่มีบทวิเคราะห์จาก Claude สำหรับเหรียญนี้ (มีเฉพาะเหรียญที่แดชบอร์ดติดตาม อัปเดตทุกเช้า)': 'No analysis from Claude for this coin yet (only coins the dashboard tracks, updated each morning).',
    'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำให้ซื้อหรือขาย ตัวเลขในอดีตบอกอนาคตไม่ได้ ลงเงินเท่าที่เสียได้เท่านั้น': 'For research only, not a buy or sell call. Past numbers do not predict the future. Only invest what you can afford to lose.',
    'ข้อมูลยังน้อยเกินไปสำหรับวิเคราะห์': 'Not enough data to analyse', 'อ่านจากตัวเลขอัตโนมัติ': 'Automatic read of the numbers', 'ดึงข้อมูลย้อนหลังไม่ได้ตอนนี้': 'Could not fetch history right now',
    'กำลังโหลดกราฟ…': 'Loading chart…', 'ข้อมูลจาก': 'Data from', 'โหลดกราฟไม่ได้ตอนนี้ ลองใหม่ในอีกสักครู่': 'Could not load the chart. Try again shortly.',
    'ราคาอยู่': 'Price is', 'ค่าเฉลี่ย 30 วัน (': 'the 30-day average (', 'RSI 14 วัน =': '14-day RSI =', 'กรอบราคา 30 วัน: ต่ำสุด': '30-day range: low', '· สูงสุด': '· high',
    '(ราคาตอนนี้อยู่': '(now at', '% ของกรอบ)': '% of the range)', 'ความผันผวนต่อปี ≈': 'Annualised volatility ≈', 'ต่ำกว่าจุดสูงสุดตลอดกาล': 'Below its all-time high by',
    'มีเหรียญหมุนเวียนแค่': 'Only', '% ของทั้งหมด ยังมีเหรียญรอปลดล็อกออกมาอีก อาจกดดันราคา': '% of supply is circulating; more unlocks are coming and may weigh on the price',
    // alerts
    'ราคาตอนนี้ $': 'Now $', '(เป้า $': '(target $', 'ขึ้นแรง +': 'up +', 'ลงแรง': 'down', '% ใน 24 ชม.': '% in 24h', '· เป็นเหรียญที่คุณถืออยู่': '· a coin you hold',
    'ราคาเป้าหมาย ': 'price target ', ' ขึ้นถึง': ' rose to', ' ลงถึง': ' fell to',
    'ถึงราคาเป้าหมาย': 'its target price', 'ขึ้นถึงราคาเป้าหมาย': 'rose to its target price', 'ลงถึงราคาเป้าหมาย': 'fell to its target price',
  };
  // Changelog lines are rendered from app.js too.
  const DICTS = { en: EN };
  const dict = DICTS[lang];
  const keys = dict ? Object.keys(dict).sort((a, b) => b.length - a.length) : [];
  const thai = /[฀-๿]/;

  function tr(s) {
    if (!dict || !thai.test(s)) return s;
    const trimmed = s.trim();
    if (dict[trimmed] != null) return s.replace(trimmed, dict[trimmed]);
    let out = s;
    for (const k of keys) { if (!thai.test(out)) break; if (out.includes(k)) out = out.split(k).join(dict[k]); }
    // Half-translated text reads worse than Thai, so keep the original unless every Thai part was known.
    return thai.test(out) ? s : out;
  }
  window.t = tr;

  // The dashboard page has its own phrase list (i18n/page-<lang>.json, loaded by index.html) and is translated strictly:
  // a text is changed only when every Thai part of it is known, so research text is never left half-translated.
  let dashDict = null, dashKeys = [];
  function trDash(s) {
    if (!dashDict || !thai.test(s)) return s;
    const trimmed = s.trim();
    const exact = dashDict[trimmed] != null ? dashDict[trimmed] : dict[trimmed];
    if (exact != null) return s.replace(trimmed, exact);
    // Thai dates (22 ต.ค. 2569, 25 ต.ค. 69, ต.ค. 2569) become 22 Oct 2026.
    let out = s.replace(THAI_DATE, (m, d, mon, y) => (d ? d + ' ' : '') + MONTHS[mon] + (y ? ' ' + (y.length === 2 ? 2000 + ((+y + 57) % 100) : +y > 2400 ? +y - 543 : +y) : ''));
    for (const k of dashKeys) { if (!thai.test(out)) break; if (out.includes(k)) out = out.split(k).join(dashDict[k]); }
    return thai.test(out) ? s : out;
  }
  const MONTHS = { 'ม.ค.': 'Jan', 'ก.พ.': 'Feb', 'มี.ค.': 'Mar', 'เม.ย.': 'Apr', 'พ.ค.': 'May', 'มิ.ย.': 'Jun', 'ก.ค.': 'Jul', 'ส.ค.': 'Aug', 'ก.ย.': 'Sep', 'ต.ค.': 'Oct', 'พ.ย.': 'Nov', 'ธ.ค.': 'Dec' };
  const THAI_DATE = new RegExp('(?:(\\d{1,2}) )?(' + Object.keys(MONTHS).map(m => m.replace(/\./g, '\\.')).join('|') + ')(?: (\\d{4}|\\d{2})(?!\\d))?', 'g');
  const inDash = n => !!(n.closest && n.closest('#dash-root'));
  const SKIP = '[data-no-i18n], script, style, code, textarea, [data-lang]';
  function walk(root) {
    if (!dict) return;
    const el = root.nodeType === 1 ? root : root.parentElement;
    if (!el || el.closest(SKIP)) return;
    const f = inDash(el) ? trDash : tr;
    if (f === trDash && !dashDict) return;
    const text = n => { if (thai.test(n.nodeValue)) { const v = f(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } };
    const attrs = n => { for (const a of ['placeholder', 'title', 'aria-label']) { const v = n.getAttribute(a); if (v && thai.test(v)) { const t = f(v); if (t !== v) n.setAttribute(a, t); } } };
    if (root.nodeType === 3) return text(root);
    if (root.nodeType !== 1) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) text(n); else attrs(n); }
  }
  if (dict) {
    document.title = tr(document.title);
    const start = () => {
      walk(document.body);
      new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') walk(m.target); else m.addedNodes.forEach(walk); } })
        .observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    // Native dialogs.
    const _c = window.confirm.bind(window), _p = window.prompt.bind(window);
    window.confirm = m => _c(tr(String(m)));
    window.prompt = (m, d) => _p(tr(String(m)), d == null ? d : tr(String(d)));
  }

  // Dashboard data: English copies live in data/en/ (scripts/translate-data.py); a file not translated yet falls back to Thai.
  window.crFetchData = (id, query) => {
    const get = dir => fetch(dir + encodeURIComponent(id) + '.json' + (query || ''), { cache: 'no-cache' });
    if (lang === 'th') return get('data/');
    return get('data/' + lang + '/').then(r => (r.ok ? r : get('data/'))).catch(() => get('data/'));
  };

  window.CRI18n = {
    lang, LANGS,
    // index.html hands over the dashboard's phrase list once it has loaded it.
    setDashDict(d) {
      if (!dict || !d) return;
      dashDict = d; dashKeys = Object.keys(d).sort((a, b) => b.length - a.length);
      const r = document.getElementById('dash-root'); if (r) walk(r);
    },
    set(l) { if (!LANGS[l] || l === lang) return; try { localStorage.setItem('crypto-radar:lang', l); } catch (e) {} location.reload(); },
  };
})();
