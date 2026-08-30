// i18n: static UI strings (EN/FR/JA). Runtime status strings in pipeline.js
// call window.t() the same way, falling back to English if a key is missing.
const I18N = {
  en: {
    "nav.github_title": "View on GitHub",
    "nav.live_demo": "Live Demo",
    "nav.lang_title": "Change language",

    "hero.title": "Detect Yu-Gi-Oh! cards in real-time.",
    "hero.desc": "DRAW2 uses a state-of-the-art model architecture trained on 13,000+ cards. It recognizes them automatically under real dueling conditions, something no prior system does at this scale currently.<br><br>Try the demo below to run the model on your own GPU in real time. Nothing is uploaded or stored by us.",
    "hero.cta_try": "Try it now!",
    "hero.cta_contact": "Get in Touch",
    "hero.cta_streamer": "Streamer? Get the OBS plugin →",
    "hero.proof_alt": "DRAW2 detecting and naming Yu-Gi-Oh! cards live on a dueling mat, overlaying bounding boxes and card names in real time",

    "community.reddit_title": "I trained again my deep learning model...",
    "community.reddit_desc": "“About a year and a half ago, I shared a little project that could recognize Yu-Gi-Oh! cards... This time, it's an OBS plugin, so it's actually easy to use...”",
    "community.read_post": "Read the original post",
    "community.x_desc": "As creator of DRAW2 (3 years in the making), I know how tough #Yu-Gi-Oh! cards detection is. I'm completing my PhD thesis in 2 months, so I believe I can offer expert insight on this subject.",
    "community.read_thread": "Read the original Thread",
    "community.medium_title": "How I trained my model...",
    "community.medium_badge": "Deep Dive",
    "community.medium_desc": "A complete breakdown of the data collection, labeling process with YOLO, and how Vision Transformers handle the 13k+ classification classes.",
    "community.read_article": "Read the article",

    "demo.title": "Live Demo",
    "demo.model_label": "Model",
    "demo.model_flash": "Flash",
    "demo.model_medium": "Medium",
    "demo.model_max": "Max",
    "demo.btn_download": "Download Model",
    "demo.dropzone_title": "Drop an Image",
    "demo.dropzone_hint": "or select a file, or paste (Ctrl+V)",
    "demo.btn_camera": "Use Camera",
    "demo.sample_label": "Or try a sample",
    "demo.sample_photo": "Sample photo",
    "demo.sample_gif": "Sample GIF",
    "demo.sample_video": "Sample video",
    "demo.source_video": "Source video ↗",
    "demo.output_placeholder": "Detection output will appear here",
    "demo.btn_live": "Live Detect",
    "demo.btn_snap": "Capture",
    "demo.fullscreen_title": "View fullscreen",
    "demo.console_label": "console",
    "demo.executing": "Executing",
    "demo.waiting_input": "> Waiting for input...",
    "demo.results_placeholder": "Cards detected will appear here",
    "demo.detection_output": "Detection Output",
    "demo.clear_all": "Clear All",
    "demo.fullscreen_close_title": "Close",
    "demo.fullscreen_alt": "Detection result, enlarged",

    "footer.desc": "{draw2} is an independent open-source project by {hichtala}. It is not affiliated with, endorsed by, or sponsored by Konami Digital Entertainment. “Yu-Gi-Oh!” is a trademark of Konami.",
    "footer.designed_by": "Website designed by {amine}",

    "runtime.dl_yolo": "Downloading YOLO detector (39 MB)",
    "runtime.compiling_yolo": "Compiling YOLO session",
    "runtime.dl_vit": "Downloading ViT classifier ({size})",
    "runtime.compiling_vit": "Compiling ViT session",
    "runtime.warming_up": "Warming up GPU pipelines...",
    "runtime.ready": "Ready",
    "runtime.engine_ready": "Engine Ready",
    "runtime.retry": "Retry",
    "runtime.loading": "Loading",
    "runtime.live_detect": "Live Detect",
    "runtime.stop_detecting": "Stop Detecting",
    "runtime.download_gif": "Download GIF",
    "runtime.model_downloaded": "Model {model} downloaded",

    "log.found_cards": "Found {count} card(s)",
    "log.card_progress": "Card {idx}/{total}: \"{name}\" ({pct}%)",
    "log.done_in": "Done in {ms}ms",
    "log.loading_sample": "Loading sample: {name}...",
    "log.loading_gif_encoder": "Loading GIF encoder...",
    "log.extract_video": "Extracting frames from video ({dur}s @ {fps}fps, {w}x{h})...",
    "log.extract_gif": "Extracting frames from GIF ({count} frames)...",
    "log.extraction_done": "Extraction done: {count} frames",
    "log.running_detection": "Running detection on {count} key frame(s)...",
    "log.keyframe_done": "Key frame detection done",
    "log.rendering_frames": "Rendering {count} frame(s)...",
    "log.frame_rendering_done": "Frame rendering done",
    "log.encoding_gif": "Encoding output GIF...",
    "log.gif_ready": "GIF ready ({size} KB)"
  },
  fr: {
    "nav.github_title": "Voir sur GitHub",
    "nav.live_demo": "Démo",
    "nav.lang_title": "Changer de langue",
    "hero.title": "Un détecteur de cartes Yu-Gi-Oh! en temps réel.",
    "hero.desc": "DRAW2 s'appuie sur une architecture de modèles de pointe, entraînée sur plus de 13 000 cartes. Il les reconnaît automatiquement en conditions réelles de duel, ce qu'aucun autre système ne fait aujourd'hui avec autant de précision.<br><br>Essayez la démo ci-dessous pour exécuter le modèle sur votre propre GPU en temps réel. Rien n'est envoyé ni stocké de notre côté.",
    "hero.cta_try": "Essayer la démo",
    "hero.cta_contact": "Nous contacter",
    "hero.cta_streamer": "Streamer ? Récupérez le plugin OBS →",
    "hero.proof_alt": "DRAW2 détectant et nommant des cartes Yu-Gi-Oh! en direct sur un tapis de duel, avec incrustation des cadres de détection et des noms de cartes en temps réel",
    "community.reddit_title": "J'ai encore entraîné mon modèle de deep learning...",
    "community.reddit_desc": "« Il y a environ un an et demi, j'ai partagé un petit projet capable de reconnaître les cartes Yu-Gi-Oh!... Cette fois, c'est un plugin OBS, donc c'est vraiment simple à utiliser... »",
    "community.read_post": "Lire le post original",
    "community.x_desc": "En tant que créateur de DRAW2 (3 ans de développement), je sais à quel point la détection des cartes #Yu-Gi-Oh! est difficile. Je termine ma thèse de doctorat dans 2 mois, donc je pense pouvoir apporter un éclairage d'expert sur ce sujet.",
    "community.read_thread": "Lire le fil original",
    "community.medium_title": "Comment j'ai entraîné mon modèle...",
    "community.medium_badge": "Analyse approfondie",
    "community.medium_desc": "Une présentation complète de la collecte de données, du processus d'annotation avec YOLO, et de la façon dont les Vision Transformers gèrent les plus de 13 000 catégories.",
    "community.read_article": "Lire l'article",
    "demo.title": "Démo en temps réel",
    "demo.model_label": "Modèle",
    "demo.model_flash": "Flash",
    "demo.model_medium": "Medium",
    "demo.model_max": "Max",
    "demo.btn_download": "Télécharger le modèle",
    "demo.dropzone_title": "Déposez une image",
    "demo.dropzone_hint": "ou sélectionnez un fichier, ou collez (Ctrl+V)",
    "demo.btn_camera": "Utiliser la caméra",
    "demo.sample_label": "Ou essayez un exemple",
    "demo.sample_photo": "Photo d'exemple",
    "demo.sample_gif": "GIF d'exemple",
    "demo.sample_video": "Vidéo d'exemple",
    "demo.source_video": "Vidéo source ↗",
    "demo.output_placeholder": "Le résultat de la détection s'affichera ici",
    "demo.btn_live": "Détection en direct",
    "demo.btn_snap": "Capturer",
    "demo.fullscreen_title": "Voir en plein écran",
    "demo.console_label": "console",
    "demo.executing": "Exécution",
    "demo.waiting_input": "> En attente du modèle...",
    "demo.results_placeholder": "Les cartes détectées s'afficheront ici",
    "demo.detection_output": "Résultat de la détection",
    "demo.clear_all": "Tout effacer",
    "demo.fullscreen_close_title": "Fermer",
    "demo.fullscreen_alt": "Résultat de la détection, agrandi",
    "footer.desc": "{draw2} est un projet open-source indépendant créé par {hichtala}. Il n'est ni affilié à, ni approuvé, ni sponsorisé par Konami Digital Entertainment. « Yu-Gi-Oh! » est une marque déposée de Konami.",
    "footer.designed_by": "Site conçu par {amine}",
    "runtime.dl_yolo": "Téléchargement du détecteur YOLO (39 Mo)",
    "runtime.compiling_yolo": "Compilation de la session YOLO",
    "runtime.dl_vit": "Téléchargement du classificateur ViT ({size})",
    "runtime.compiling_vit": "Compilation de la session ViT",
    "runtime.warming_up": "Préchauffage des pipelines GPU...",
    "runtime.ready": "Prêt",
    "runtime.engine_ready": "Moteur prêt",
    "runtime.retry": "Réessayer",
    "runtime.loading": "Chargement",
    "runtime.live_detect": "Détection en direct",
    "runtime.stop_detecting": "Arrêter la détection",
    "runtime.download_gif": "Télécharger le GIF",
    "runtime.model_downloaded": "Modèle {model} téléchargé",

    "log.found_cards": "{count} carte(s) trouvée(s)",
    "log.card_progress": "Carte {idx}/{total} : \"{name}\" ({pct} %)",
    "log.done_in": "Terminé en {ms} ms",
    "log.loading_sample": "Chargement de l'exemple : {name}...",
    "log.loading_gif_encoder": "Chargement de l'encodeur GIF...",
    "log.extract_video": "Extraction des frames de la vidéo ({dur}s @ {fps}fps, {w}x{h})...",
    "log.extract_gif": "Extraction des frames du GIF ({count} frames)...",
    "log.extraction_done": "Extraction terminée : {count} frames",
    "log.running_detection": "Détection en cours sur {count} frame(s) clé(s)...",
    "log.keyframe_done": "Détection des frames clés terminée",
    "log.rendering_frames": "Rendu de {count} frame(s)...",
    "log.frame_rendering_done": "Rendu des frames terminé",
    "log.encoding_gif": "Encodage du GIF...",
    "log.gif_ready": "GIF prêt ({size} Ko)"
  },
  ja: {
    "nav.github_title": "GitHubで見る",
    "nav.live_demo": "ライブデモ",
    "nav.lang_title": "言語を切り替え",
    "hero.title": "遊戯王カードをリアルタイムで検出。",
    "hero.desc": "DRAW2は13,000枚以上のカードで学習した最新のモデルアーキテクチャを採用しています。実際のデュエル環境下でもカードを自動認識でき、これほどの規模でこれを実現したシステムはこれまでありませんでした。<br><br>下のデモから、お使いのGPUでリアルタイムにモデルを試せます。画像がアップロードされたり保存されたりすることは一切ありません。",
    "hero.cta_try": "今すぐ試す",
    "hero.cta_contact": "お問い合わせ",
    "hero.cta_streamer": "配信者の方へ、OBSプラグインはこちら →",
    "hero.proof_alt": "デュエルマット上の遊戯王カードをDRAW2がリアルタイムで検出し、バウンディングボックスとカード名を重ねて表示している様子",
    "community.reddit_title": "ディープラーニングモデルをまた学習させてみた……",
    "community.reddit_desc": "「1年半ほど前、遊戯王カードを認識できる小さなプロジェクトを公開しました……今回はOBSプラグインなので、実際にかなり使いやすくなっています……」",
    "community.read_post": "元の投稿を読む",
    "community.x_desc": "DRAW2の作者として(制作期間3年)、#遊戯王 カードの検出がどれだけ難しいか身をもって知っています。2ヶ月後に博士論文を提出予定なので、この分野について専門的な知見を提供できると思っています。",
    "community.read_thread": "元のスレッドを読む",
    "community.medium_title": "モデルをどう学習させたか……",
    "community.medium_badge": "徹底解説",
    "community.medium_desc": "データ収集からYOLOによるラベリング作業、そしてVision Transformerが13,000以上の分類クラスをどう扱っているかまで、詳しく解説します。",
    "community.read_article": "記事を読む",
    "demo.title": "ライブデモ",
    "demo.model_label": "モデル",
    "demo.model_flash": "Flash",
    "demo.model_medium": "Medium",
    "demo.model_max": "Max",
    "demo.btn_download": "モデルをダウンロード",
    "demo.dropzone_title": "画像をドロップ",
    "demo.dropzone_hint": "ファイルを選択、または貼り付け (Ctrl+V)",
    "demo.btn_camera": "カメラを使う",
    "demo.sample_label": "またはサンプルを試す",
    "demo.sample_photo": "サンプル画像",
    "demo.sample_gif": "サンプルGIF",
    "demo.sample_video": "サンプル動画",
    "demo.source_video": "元動画を見る ↗",
    "demo.output_placeholder": "検出結果がここに表示されます",
    "demo.btn_live": "ライブ検出",
    "demo.btn_snap": "撮影",
    "demo.fullscreen_title": "全画面表示",
    // console.* left untranslated on purpose: the log panel stays in English for JA
    "demo.results_placeholder": "検出されたカードがここに表示されます",
    "demo.detection_output": "検出結果",
    "demo.clear_all": "すべてクリア",
    "demo.fullscreen_close_title": "閉じる",
    "demo.fullscreen_alt": "検出結果の拡大表示",
    "footer.desc": "{draw2}は{hichtala}による独立系オープンソースプロジェクトです。Konami Digital Entertainmentとの提携や承認、後援は一切受けていません。「Yu-Gi-Oh!」はKonamiの商標です。",
    "footer.designed_by": "ウェブサイトデザイン: {amine}",
    "runtime.dl_yolo": "YOLO検出器をダウンロード中 (39 MB)",
    "runtime.compiling_yolo": "YOLOセッションをコンパイル中",
    "runtime.dl_vit": "ViT分類器をダウンロード中 ({size})",
    "runtime.compiling_vit": "ViTセッションをコンパイル中",
    "runtime.warming_up": "GPUパイプラインをウォームアップ中...",
    "runtime.ready": "準備完了",
    "runtime.engine_ready": "エンジン準備完了",
    "runtime.retry": "再試行",
    "runtime.loading": "読み込み中",
    "runtime.live_detect": "ライブ検出",
    "runtime.stop_detecting": "検出を停止",
    "runtime.download_gif": "GIFをダウンロード",
    "runtime.model_downloaded": "モデル {model} をダウンロードしました"
  }
};

const LANGS = ["en", "fr", "ja"];
let currentLang = "en";

function detectLang() {
  const saved = localStorage.getItem("draw2_lang");
  if (saved && LANGS.includes(saved)) return saved;
  return "en";
}

function t(key, vars = {}) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v);
  return str;
}

function applyI18n() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    let html = t(el.getAttribute("data-i18n-html"));
    el.querySelectorAll("[data-i18n-slot]").forEach(slot => {
      html = html.replace(`{${slot.getAttribute("data-i18n-slot")}}`, slot.outerHTML);
    });
    el.innerHTML = html;
  });
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    el.getAttribute("data-i18n-attr").split(",").forEach(pair => {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key));
    });
  });

  const langBtn = document.getElementById("lang-toggle-label");
  if (langBtn) langBtn.textContent = currentLang.toUpperCase();
}

function setLang(lang) {
  currentLang = LANGS.includes(lang) ? lang : "en";
  localStorage.setItem("draw2_lang", currentLang);
  applyI18n();
}

currentLang = detectLang();
window.t = t;
window.setLang = setLang;
window.getLang = () => currentLang;
document.addEventListener("DOMContentLoaded", applyI18n);
