/**
 * 運動療育むーん 採用エントリーフォーム 受信スクリプト（Google Apps Script）
 * ------------------------------------------------------------------
 * 役割：recruit.html から送信された応募を受け取り、
 *   ① スプレッドシートに1行追記して蓄積
 *   ② MOONさんの Gmail に新着通知メールを送信（→ここから定型文で返信）
 *   ③（任意）公式LINE（Messaging API）にプッシュ通知
 * ------------------------------------------------------------------
 * ●セットアップ手順は同フォルダの「設定手順.md」を参照。
 */

// ===== 設定（ここだけ書き換える）=====
var CONFIG = {
  // ① 通知メールの宛先（応募が来たらここに届く）
  NOTIFY_EMAIL: 'undouryoikumoon@gmail.com',

  // ② LINE通知を使う場合のみ入力（使わないなら空のまま）
  //    LINE公式アカウント(Messaging API)のチャネルアクセストークン（長期）
  LINE_CHANNEL_ACCESS_TOKEN: '',
  //    通知の送信先ユーザー/グループID（friend追加後に取得。空ならbroadcast）
  LINE_TO: '',

  // ③ 蓄積先シートのタブ名（自動作成されます）
  SHEET_NAME: '応募一覧'
};

// 受け取る項目（キー: 見出し）順番どおりにシート列になります
var FIELDS = [
  ['_submitted_at',   '受信日時'],
  ['name',            'お名前'],
  ['kana',            'ふりがな'],
  ['birthday',        '生年月日'],
  ['gender',          '性別'],
  ['tel',             '電話番号'],
  ['email',           'メール'],
  ['area',            'お住まい'],
  ['sports_history',  '運動歴'],
  ['sport',           '主な競技・種目'],
  ['active_status',   '現役/引退'],
  ['best_record',     '最高成績・レベル'],
  ['desired_role',    '希望職種'],
  ['employment_type', '希望勤務形態'],
  ['license',         '保有資格'],
  ['motivation',      '志望動機・自己PR'],
  ['_source',         '流入元']
];

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    // 1) スプレッドシートに追記
    saveToSheet_(p);

    // 2) 通知メール
    sendMail_(p);

    // 3) LINE通知（設定があれば）
    if (CONFIG.LINE_CHANNEL_ACCESS_TOKEN) {
      try { pushLine_(p); } catch (le) { /* LINE失敗でも応募自体は成功扱い */ }
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// 動作確認用（ブラウザでURLを開くと表示）
function doGet() {
  return ContentService
    .createTextOutput('運動療育むーん 採用エントリー受信スクリプト：稼働中')
    .setMimeType(ContentService.MimeType.TEXT);
}

function saveToSheet_(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(FIELDS.map(function (f) { return f[1]; }));
    sh.getRange(1, 1, 1, FIELDS.length).setFontWeight('bold').setBackground('#d5f2ee');
    sh.setFrozenRows(1);
  }
  var row = FIELDS.map(function (f) { return p[f[0]] || ''; });
  sh.appendRow(row);
}

function sendMail_(p) {
  var subject = '【採用エントリー】' + (p.name || '氏名未記入') + ' さん（運動療育むーん）';
  var lines = ['運動療育むーん 採用フォームに新しいエントリーがありました。', ''];
  FIELDS.forEach(function (f) {
    if (f[0].charAt(0) === '_') return;
    lines.push('■ ' + f[1] + '：' + (p[f[0]] || '（未記入）'));
  });
  lines.push('', '─────────────', '受信日時：' + (p._submitted_at || ''), '流入元：' + (p._source || ''));
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: subject,
    body: lines.join('\n'),
    replyTo: p.email || CONFIG.NOTIFY_EMAIL
  });
}

function pushLine_(p) {
  var text = '🎽 採用エントリーが届きました\n'
    + '━━━━━━━━━━\n'
    + '👤 ' + (p.name || '') + '（' + (p.kana || '') + '）\n'
    + '📞 ' + (p.tel || '') + '\n'
    + '✉️ ' + (p.email || '') + '\n'
    + '🏅 ' + (p.sport || '') + ' / ' + (p.active_status || '') + '\n'
    + '💼 希望：' + (p.desired_role || '') + ' / ' + (p.employment_type || '') + '\n'
    + '━━━━━━━━━━\n'
    + '詳細はスプレッドシート/メールをご確認ください。';

  var payload = { messages: [{ type: 'text', text: text }] };
  var url;
  if (CONFIG.LINE_TO) {
    payload.to = CONFIG.LINE_TO;
    url = 'https://api.line.me/v2/bot/message/push';
  } else {
    url = 'https://api.line.me/v2/bot/message/broadcast';
  }
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 【動作テスト用】Apps Scriptエディタでこの関数を選んで「実行」すると、
 * ダミー応募でメール・シート・LINEの全部が動くか確認できます。
 * LINEだけ試したい場合は下の testLineOnly() を実行。
 */
function testAll() {
  doPost({ parameter: {
    _submitted_at: new Date().toLocaleString('ja-JP'),
    name: 'テスト 太郎', kana: 'てすと たろう',
    tel: '090-0000-0000', email: 'test@example.com',
    sport: 'テスト競技', active_status: '現役',
    desired_role: '児童指導員・運動療育スタッフ', employment_type: '正社員',
    sports_history: 'テスト送信です', _source: 'test'
  }});
}

/**
 * 【LINEだけテスト】トークン/通知先が正しいか確認。実行ログに結果が出ます。
 * ※LINE_TO を入れていれば その人/グループにだけ届きます（誤爆防止）。
 *   LINE_TO が空だと broadcast＝そのLINE公式アカウントの友だち全員に届くので注意。
 */
function testLineOnly() {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN) {
    Logger.log('LINE_CHANNEL_ACCESS_TOKEN が未設定です。CONFIGに貼ってください。');
    return;
  }
  var res = pushLine_({
    name: 'テスト 太郎', kana: 'てすと たろう',
    tel: '090-0000-0000', email: 'test@example.com',
    sport: 'テスト競技', active_status: '現役',
    desired_role: '児童指導員', employment_type: '正社員'
  });
  Logger.log('LINE送信 HTTP %s / %s', res.getResponseCode(), res.getContentText());
  if (res.getResponseCode() === 200) Logger.log('✅ 成功：LINEを確認してください');
  else Logger.log('❌ 失敗：トークン(長期の長い方か)・通知先IDを見直してください');
}
