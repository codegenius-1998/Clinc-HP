#!/usr/bin/env python3
"""One-shot script: write variables.json / site-controls.css / custom.css and patch HTML hooks."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SCHEMES = {
    "blue": {
        "label": "ブルー",
        "tokens": {
            "--primary-color": "#1f6bbe",
            "--primary-inverse-color": "#fff",
            "--accent-color": "#2eb8cb",
            "--accent-inverse-color": "#fff",
            "--light-color": "#f0f7fb",
            "--light-inverse-color": "#333",
        },
    },
    "skyblue": {
        "label": "スカイブルー",
        "tokens": {
            "--primary-color": "#4ba3fc",
            "--primary-inverse-color": "#fff",
            "--accent-color": "#2d7dd2",
            "--accent-inverse-color": "#fff",
            "--light-color": "#e8f4ff",
            "--light-inverse-color": "#333",
        },
    },
    "green": {
        "label": "グリーン",
        "tokens": {
            "--primary-color": "#2d8f5f",
            "--primary-inverse-color": "#fff",
            "--accent-color": "#5cb88a",
            "--accent-inverse-color": "#fff",
            "--light-color": "#eef8f2",
            "--light-inverse-color": "#333",
        },
    },
    "navy": {
        "label": "ネイビー",
        "tokens": {
            "--primary-color": "#101f3a",
            "--primary-inverse-color": "#fff",
            "--accent-color": "#7b8269",
            "--accent-inverse-color": "#fff",
            "--light-color": "#f2f5f9",
            "--light-inverse-color": "#101f3a",
        },
    },
    "pink": {
        "label": "ピンク",
        "tokens": {
            "--primary-color": "#ff9999",
            "--primary-inverse-color": "#fff",
            "--accent-color": "#ec6262",
            "--accent-inverse-color": "#fff",
            "--light-color": "#fff5f5",
            "--light-inverse-color": "#333",
            "--bg-color": "#fff",
            "--bg-inverse-color": "#333",
        },
    },
    "coral": {
        "label": "コーラル",
        "tokens": {
            "--primary-color": "#f56270",
            "--primary-inverse-color": "#fff",
            "--accent-color": "#e04858",
            "--accent-inverse-color": "#fff",
            "--light-color": "#faf9f1",
            "--light-inverse-color": "#333",
            "--bg-color": "#faf9f1",
            "--bg-inverse-color": "#333",
        },
    },
    "olive": {
        "label": "オリーブ",
        "tokens": {
            "--primary-color": "#869a4d",
            "--primary-inverse-color": "#fff",
            "--accent-color": "#e58e3d",
            "--accent-inverse-color": "#fff",
            "--light-color": "#f9f6ef",
            "--light-inverse-color": "#472c1d",
            "--primary-light-color": "#efefdf",
            "--bg-inverse-color": "#472c1d",
        },
    },
}

# templateId -> config for variables.json generation
TEMPLATES = {
    "tp_beginner10_clinic": {
        "label": "初心者向けクリニック",
        "themeFile": "css/style.css",
        "active": "blue",
        "schemes": ["blue", "skyblue", "green", "navy", "pink"],
        "default_tokens_override": {
            "blue": {
                "--primary-color": "#0063af",
                "--primary-inverse-color": "#fff",
                "--accent-color": "#0063af",
                "--accent-inverse-color": "#fff",
                "--light-color": "#d8e8f4",
                "--light-inverse-color": "#333",
                "--bg-color": "#fff",
                "--bg-inverse-color": "#333",
            }
        },
        "sections": [
            ("about", "当院について", "#about", ["#about"]),
            ("service", "診療案内", "#service", ["#service"]),
            ("staff", "スタッフ紹介", "#staff", ["#staff"]),
            ("hours", "診療時間", "#hours", ["#hours"]),
            ("access", "アクセス", "#access", ["#access"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "serviceColumns": {
                "label": "診療案内のカラム数",
                "value": 3,
                "cssVar": "--layout-service-columns",
                "min": 1,
                "max": 4,
                "appliesTo": ".list-grid / service cards",
            },
            "contentSpace": {
                "label": "左右余白",
                "value": "5vw",
                "cssVar": "--content-space",
                "appliesTo": ":root --content-space",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
            {"id": "h1", "label": "メイン見出し", "selector": "h1", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": "img[src*='logo']"},
        ],
        "section_ids_to_ensure": {},
    },
    "tp_clinic4_pink": {
        "label": "クリニック（旧世代ピンク）",
        "themeFile": "css/style.css",
        "active": "pink",
        "schemes": ["pink", "coral", "blue", "green", "navy"],
        "sections": [
            ("new", "お知らせ", "#new", ["#new"]),
            ("about", "当院について", "#about", ["#about"]),
            ("service", "診療科目", "#service", ["#service"]),
            ("staff", "スタッフ紹介", "#staff", ["#staff"]),
            ("faq", "よくある質問", "#faq", ["#faq"]),
            ("access", "アクセス", "#access", ["#access"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "contentSpace": {
                "label": "コンテンツ余白（参考）",
                "value": "20px",
                "cssVar": "--layout-content-space",
                "appliesTo": "site-controls 経由の補助余白",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": "img[src*='logo']"},
        ],
        "section_ids_to_ensure": {},
    },
    "tp_clinic5_pink": {
        "label": "クリニック（装飾多めピンク）",
        "themeFile": "css/style.css",
        "active": "coral",
        "schemes": ["coral", "pink", "blue", "green", "navy"],
        "sections": [
            ("new", "お知らせ", "#new", ["#new"]),
            ("about", "当院について", "#about", ["#about"]),
            ("service", "診療案内", "#service", ["#service"]),
            ("staff", "スタッフ紹介", "#staff", ["#staff"]),
            ("faq", "よくある質問", "#faq", ["#faq"]),
            ("access", "アクセス", "#access", ["#access"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "contentSpace": {
                "label": "コンテンツ余白（参考）",
                "value": "20px",
                "cssVar": "--layout-content-space",
                "appliesTo": "site-controls 経由の補助余白",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": "img[src*='logo']"},
        ],
        "section_ids_to_ensure": {},
    },
    "tp_clinic6_skyblue": {
        "label": "クリニック（スカイブルー）",
        "themeFile": "css/style.css",
        "active": "skyblue",
        "schemes": ["skyblue", "blue", "green", "navy", "pink"],
        "sections": [
            ("about", "当院について", "#about", ["#about"]),
            ("service", "診療案内", "#service", ["#service"]),
            ("staff", "スタッフ紹介", "#staff", ["#staff"]),
            ("faq", "よくある質問", "#faq", ["#faq"]),
            ("access", "アクセス", "#access", ["#access"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "serviceColumns": {
                "label": "診療カードのカラム数",
                "value": 3,
                "cssVar": "--layout-service-columns",
                "min": 1,
                "max": 4,
                "appliesTo": ".list-grid1",
            },
            "contentSpace": {
                "label": "左右余白",
                "value": "5vw",
                "cssVar": "--global-space",
                "appliesTo": ":root --global-space",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": "img[src*='logo']"},
        ],
        "section_ids_to_ensure": {},
    },
    "tp_clinic7_blue": {
        "label": "クリニック（ブルー・LP統合版）",
        "themeFile": "css/theme.css",
        "active": "blue",
        "schemes": ["blue", "skyblue", "green", "navy", "pink"],
        "sections": [
            ("news", "お知らせ", "#news", []),
            ("menu", "診療メニュー", "#menu", ["#menu", "#menu1", "#menu2", "#menu3"]),
            ("feature", "医院の特徴", "#feature", ["#feature"]),
            ("greeting", "院長挨拶", "#greeting", ["#greeting"]),
            ("staff", "スタッフ紹介", "#staff", ["#staff"]),
            ("facility", "設備紹介", "#facility", ["#facility"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "staffColumns": {
                "label": "スタッフ紹介のカラム数",
                "value": 3,
                "cssVar": "--layout-staff-columns",
                "min": 1,
                "max": 4,
                "appliesTo": ".list-staff",
            },
            "facilityColumns": {
                "label": "設備紹介のカラム数",
                "value": 3,
                "cssVar": "--layout-facility-columns",
                "min": 1,
                "max": 4,
                "appliesTo": ".list-kadomaru",
            },
            "contentSpace": {
                "label": "左右余白（大）",
                "value": "5vw",
                "cssVar": "--content-space-l",
                "appliesTo": ":root --content-space-l",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
            {"id": "h1", "label": "メイン見出し", "selector": "h1", "type": "text"},
            {"id": "phone", "label": "電話番号", "selector": ".tel strong", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": ".logo img"},
            {"id": "mainimg", "label": "メインビジュアル", "path": "images/mainimg1.jpg", "selector": ".mainimg img"},
        ],
        "section_ids_to_ensure": {"news": r'(<main>\s*\n\s*<section)(?![^>]*\bid=)'},
    },
    "tp_clinic7_blue_LP": {
        "label": "クリニック（ブルー・純LP）",
        "themeFile": "css/theme.css",
        "active": "blue",
        "schemes": ["blue", "skyblue", "green", "navy", "pink"],
        "sections": [
            ("concerns", "お悩み", "#concerns", ["#concerns"]),
            ("strengths", "当院の強み", "#strengths", ["#strengths"]),
            ("menu", "診療メニュー", "#menu", ["#menu"]),
            ("flow", "治療の流れ", "#flow", ["#flow"]),
            ("staff", "スタッフ紹介", "#staff", ["#staff"]),
            ("facility", "院内・設備", "#facility", ["#facility"]),
            ("cases", "症例", "#cases", ["#cases"]),
            ("voice", "お客様の声", "#voice", ["#voice"]),
            ("faq", "よくある質問", "#faq", ["#faq"]),
            ("news", "お知らせ", "#news", ["#news"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "staffColumns": {
                "label": "スタッフ紹介のカラム数",
                "value": 3,
                "cssVar": "--layout-staff-columns",
                "min": 1,
                "max": 4,
                "appliesTo": ".list-staff",
            },
            "serviceColumns": {
                "label": "診療メニューのカラム数",
                "value": 3,
                "cssVar": "--layout-service-columns",
                "min": 1,
                "max": 4,
                "appliesTo": ".list-cource",
            },
            "contentSpace": {
                "label": "左右余白（大）",
                "value": "5vw",
                "cssVar": "--content-space-l",
                "appliesTo": ":root --content-space-l",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
            {"id": "h1", "label": "メイン見出し", "selector": "h1", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": ".logo img"},
            {"id": "mainimg", "label": "メインビジュアル", "path": "images/mainimg1.jpg", "selector": ".mainimg img"},
        ],
        # special handling below
        "section_ids_to_ensure": {},
        "lp_section_map": True,
    },
    "tp_lp3_clinic_slide": {
        "label": "クリニックLP（スライド主体）",
        "themeFile": "css/style.css",
        "active": "blue",
        "schemes": ["blue", "skyblue", "green", "navy", "pink"],
        "default_tokens_override": {
            "blue": {
                "--primary-color": "#4476b9",
                "--primary-inverse-color": "#fff",
                "--accent-color": "#c43311",
                "--accent-inverse-color": "#fff",
                "--secondary-color": "#30363d",
                "--secondary-inverse-color": "#fff",
                "--light-color": "#eef3f9",
                "--light-inverse-color": "#333",
            }
        },
        "sections": [
            ("kodawari", "こだわり", "#kodawari", ["#kodawari"]),
            ("service", "サービス", "#service", ["#service"]),
            ("flow", "ご利用の流れ", "#flow", ["#flow"]),
            ("voice", "お客様の声", "#voice", ["#voice"]),
            ("faq", "よくある質問", "#faq", ["#faq"]),
        ],
        "layout": {
            "serviceColumns": {
                "label": "サービス紹介のカラム数",
                "value": 3,
                "cssVar": "--layout-service-columns",
                "min": 1,
                "max": 4,
                "appliesTo": "service grid",
            },
            "contentSpace": {
                "label": "左右余白",
                "value": "4rem",
                "cssVar": "--content-space",
                "appliesTo": ":root --content-space",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": "img[src*='logo']"},
        ],
        "section_ids_to_ensure": {},
    },
    "tp_mix2_home": {
        "label": "ホーム・介護施設（医療転用可）",
        "themeFile": "css/theme.css",
        "active": "olive",
        "schemes": ["olive", "green", "blue", "navy", "pink"],
        "sections": [
            ("greetings", "ご挨拶", "#greetings", ["#greetings"]),
            ("info", "お知らせ", "#info", ["#info"]),
            ("service", "サービス", "#service", ["#service", "#service1", "#service2", "#service3"]),
            ("faq", "よくある質問", "#faq", ["#faq"]),
            ("access", "アクセス", "#access", ["#access"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "serviceColumns": {
                "label": "サービスカードのカラム数",
                "value": 3,
                "cssVar": "--layout-service-columns",
                "min": 1,
                "max": 4,
                "appliesTo": ".list1",
            },
            "contentSpace": {
                "label": "左右余白（大）",
                "value": "5vw",
                "cssVar": "--content-space-l",
                "appliesTo": ":root --content-space-l",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": "img[src*='logo']"},
        ],
        "section_ids_to_ensure": {},
    },
    "tp_seikotsu1_navy": {
        "label": "整骨院（ネイビー）",
        "themeFile": "css/theme.css",
        "active": "navy",
        "schemes": ["navy", "blue", "green", "pink", "olive"],
        "sections": [
            ("about", "当院について", "#about", ["#about"]),
            ("menu", "メニュー", "#menu", ["#menu"]),
            ("flow", "ご利用の流れ", "#flow", ["#flow"]),
            ("faq", "よくある質問", "#faq", ["#faq"]),
            ("access", "アクセス", "#access", ["#access"]),
            ("contact", "お問い合わせ", "#contact", ["#contact"]),
        ],
        "layout": {
            "serviceColumns": {
                "label": "メニューカードのカラム数",
                "value": 3,
                "cssVar": "--layout-service-columns",
                "min": 1,
                "max": 4,
                "appliesTo": "menu cards",
            },
            "contentSpace": {
                "label": "左右余白（大）",
                "value": "7vw",
                "cssVar": "--content-space-l",
                "appliesTo": ":root --content-space-l",
            },
        },
        "contentSlots": [
            {"id": "title", "label": "ページタイトル", "selector": "title", "type": "text"},
        ],
        "imageSlots": [
            {"id": "logo", "label": "ロゴ", "path": "images/logo.png", "selector": "img[src*='logo']"},
        ],
        "section_ids_to_ensure": {},
    },
}


def build_options(scheme_ids, overrides=None):
    overrides = overrides or {}
    options = {}
    for sid in scheme_ids:
        base = json.loads(json.dumps(SCHEMES[sid]))
        if sid in overrides:
            base["tokens"].update(overrides[sid])
        options[sid] = base
    return options


def layout_style(layout: dict) -> str:
    parts = []
    for item in layout.values():
        parts.append(f"{item['cssVar']}:{item['value']}")
    return ";".join(parts)


def write_variables_json(tid: str, cfg: dict) -> dict:
    options = build_options(cfg["schemes"], cfg.get("default_tokens_override"))
    sections = []
    for sid, label, selector, nav in cfg["sections"]:
        sections.append(
            {
                "id": sid,
                "label": label,
                "selector": selector,
                "visible": True,
                "navHrefs": nav,
                "removable": sid not in ("contact",),
            }
        )
    doc = {
        "$schema": "../schema/template-variables.schema.json",
        "templateId": tid,
        "version": 1,
        "meta": {
            "label": cfg["label"],
            "themeFile": cfg["themeFile"],
            "htmlFile": "index.html",
            "notes": "AI/管理画面は TEMPLATE_VARIABLES.md の適用手順に従うこと。",
        },
        "apply": {
            "htmlFile": "index.html",
            "themeAttribute": "html[data-theme]",
            "controlsCssFile": "css/site-controls.css",
            "customCssFile": "css/custom.css",
            "layoutStyleTarget": "html",
        },
        "colorScheme": {"active": cfg["active"], "options": options},
        "sections": sections,
        "layout": cfg["layout"],
        "customCss": {
            "file": "css/custom.css",
            "content": "",
            "description": "管理画面から注入する追加CSS。このファイル内容を丸ごと置換する。",
        },
        "contentSlots": cfg.get("contentSlots", []),
        "imageSlots": cfg.get("imageSlots", []),
    }
    path = ROOT / tid / "variables.json"
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return doc


def write_site_controls(tid: str, doc: dict) -> None:
    lines = [
        "/* site-controls.css",
        " * 管理画面 / AI 向けの制御レイヤ。",
        " * - カラースキーム: html[data-theme]",
        " * - セクション表示: [data-section][data-visible]",
        " * - レイアウト: --layout-* / 余白CSS変数",
        " * 手編集より variables.json を正本として更新すること。",
        " */",
        "",
        ":root {",
    ]
    for item in doc["layout"].values():
        lines.append(f"\t{item['cssVar']}: {item['value']};")
    lines += [
        "}",
        "",
        "/* セクション表示/非表示 */",
        '[data-section][data-visible="false"] {',
        "\tdisplay: none !important;",
        "}",
        "",
        "/* レイアウト微調整は各 style.css 側の grid-template-columns が",
        " * var(--layout-*-columns) を参照する。ここでの上書きはメディアクエリを潰すため行わない。",
        " */",
        "",
        "/* カラースキームプリセット */",
    ]
    for sid, opt in doc["colorScheme"]["options"].items():
        lines.append(f'html[data-theme="{sid}"] {{')
        for k, v in opt["tokens"].items():
            lines.append(f"\t{k}: {v};")
        lines.append("}")
        lines.append("")
    path = ROOT / tid / "css" / "site-controls.css"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_custom_css(tid: str) -> None:
    path = ROOT / tid / "css" / "custom.css"
    path.write_text(
        "/* custom.css — 管理画面から注入する追加CSS。初期は空でよい。 */\n",
        encoding="utf-8",
    )


def ensure_head_links(html: str) -> str:
    if "site-controls.css" in html and "custom.css" in html:
        return html
    # insert after last stylesheet link before </head>, or before </head>
    inject = (
        '<link rel="stylesheet" href="css/site-controls.css">\n'
        '<link rel="stylesheet" href="css/custom.css" id="site-custom-css">\n'
    )
    if "css/site-controls.css" not in html:
        # place after style.css link if present
        m = re.search(r'(<link rel="stylesheet" href="css/style\.css">\s*\n)', html)
        if m:
            html = html[: m.end()] + inject + html[m.end() :]
        else:
            html = html.replace("</head>", inject + "</head>", 1)
    elif "custom.css" not in html:
        html = html.replace(
            '<link rel="stylesheet" href="css/site-controls.css">',
            '<link rel="stylesheet" href="css/site-controls.css">\n'
            '<link rel="stylesheet" href="css/custom.css" id="site-custom-css">',
            1,
        )
    return html


def set_html_attrs(html: str, theme: str, style: str) -> str:
    # <html lang="ja"> or with existing attrs
    def repl(m):
        attrs = m.group(1) or ""
        # strip existing data-theme / style
        attrs = re.sub(r'\s*data-theme="[^"]*"', "", attrs)
        attrs = re.sub(r'\s*style="[^"]*"', "", attrs)
        return f'<html{attrs} data-theme="{theme}" style="{style}">'

    return re.sub(r"<html([^>]*)>", repl, html, count=1)


def patch_section_attrs(html: str, sections: list[dict]) -> str:
    for sec in sections:
        sid = sec["id"]
        selector = sec["selector"]
        visible = "true" if sec["visible"] else "false"
        if not selector.startswith("#"):
            continue
        eid = selector[1:]
        # Match opening tag with this id
        pattern = re.compile(
            rf'(<(?:section|div|aside|nav)\b)([^>]*\bid="{re.escape(eid)}"[^>]*)(>)',
            re.IGNORECASE,
        )

        def repl(m, _sid=sid, _visible=visible):
            start, mid, end = m.group(1), m.group(2), m.group(3)
            mid = re.sub(r'\s*data-section="[^"]*"', "", mid)
            mid = re.sub(r'\s*data-visible="[^"]*"', "", mid)
            return f'{start}{mid} data-section="{_sid}" data-visible="{_visible}"{end}'

        html, n = pattern.subn(repl, html, count=1)
        if n == 0:
            print(f"  WARN: selector {selector} not found")
    return html


def ensure_news_id_clinic7(html: str) -> str:
    # first section inside main without id -> news
    return re.sub(
        r"(<main>\s*\n<section)(?![^>]*\bid=)",
        r'\1 id="news"',
        html,
        count=1,
    )


LP_SECTION_MARKERS = [
    ("concerns", "こんなお悩みありませんか？"),
    ("strengths", "そのお悩み、当院におまかせください"),
    ("menu", "診療メニュー"),
    ("flow", "治療の流れ"),
    ("staff", "スタッフ紹介"),
    ("facility", "院内・設備紹介"),
    ("cases", "ビフォーアフター／症例"),
    ("voice", "お客様の声"),
    ("faq", "よく頂く質問"),
    ("news", "お知らせ"),
    ("contact", "お問い合わせ"),
]


def patch_lp_sections(html: str) -> str:
    """Add id/data-section to clinic7_blue_LP sections by heading text."""
    for sid, heading in LP_SECTION_MARKERS:
        # Find section that contains this h2 shortly after open tag, if id not already set
        # Pattern: <section ...> ... <h2...>heading
        pattern = re.compile(
            rf'(<section)((?![^>]*\bid=")[^>]*)(>\s*\n\s*<h2[^>]*>[^<]*{re.escape(heading)})',
            re.IGNORECASE,
        )

        def repl(m, _sid=sid):
            start, mid, rest = m.group(1), m.group(2), m.group(3)
            mid = re.sub(r'\s*data-section="[^"]*"', "", mid)
            mid = re.sub(r'\s*data-visible="[^"]*"', "", mid)
            return f'{start}{mid} id="{_sid}" data-section="{_sid}" data-visible="true"{rest}'

        html, n = pattern.subn(repl, html, count=1)
        if n == 0:
            # maybe already has id
            pattern2 = re.compile(
                rf'(<section)([^>]*\bid="{sid}"[^>]*)(>)',
                re.IGNORECASE,
            )

            def repl2(m, _sid=sid):
                start, mid, end = m.group(1), m.group(2), m.group(3)
                mid = re.sub(r'\s*data-section="[^"]*"', "", mid)
                mid = re.sub(r'\s*data-visible="[^"]*"', "", mid)
                return f'{start}{mid} data-section="{_sid}" data-visible="true"{end}'

            html, n2 = pattern2.subn(repl2, html, count=1)
            if n2 == 0:
                print(f"  WARN LP: could not mark section {sid}")
    return html


def patch_legacy_colors(tid: str) -> None:
    css_path = ROOT / tid / "css" / "style.css"
    text = css_path.read_text(encoding="utf-8")
    if tid == "tp_clinic4_pink":
        if "管理画面・AI向け変数化" not in text:
            root = """
/*CSSカスタムプロパティ（管理画面・AI向け変数化）
---------------------------------------------------------------------------*/
:root {
	--primary-color: #ff9999;
	--primary-inverse-color: #fff;
	--accent-color: #ec6262;
	--accent-inverse-color: #fff;
	--light-color: #fff5f5;
	--light-inverse-color: #333;
	--bg-color: #fff;
	--bg-inverse-color: #333;
	--layout-content-space: 20px;
}

"""
            text = text.replace('@import url(slide.css);\n', '@import url(slide.css);\n' + root, 1)
        # :root 内の定義値は置換しない
        head, sep, rest = text.partition("/*PC・タブレット・スマホ共通設定")
        if not sep:
            head, sep, rest = text.partition("/*全体の設定")
        rest = rest.replace("#ff9999", "var(--primary-color)")
        rest = rest.replace("#ec6262", "var(--accent-color)")
        rest = rest.replace("var(var(--primary-color))", "var(--primary-color)")
        rest = rest.replace("var(var(--accent-color))", "var(--accent-color)")
        text = head + sep + rest
        # 万一 :root が壊れていたら修復
        text = re.sub(
            r"(--primary-color:\s*)var\(--primary-color\)",
            r"\1#ff9999",
            text,
            count=1,
        )
        text = re.sub(
            r"(--accent-color:\s*)var\(--accent-color\)",
            r"\1#ec6262",
            text,
            count=1,
        )
    elif tid == "tp_clinic5_pink":
        if "管理画面・AI向け変数化" not in text:
            root = """
/*CSSカスタムプロパティ（管理画面・AI向け変数化）
---------------------------------------------------------------------------*/
:root {
	--primary-color: #f56270;
	--primary-inverse-color: #fff;
	--accent-color: #e04858;
	--accent-inverse-color: #fff;
	--light-color: #faf9f1;
	--light-inverse-color: #333;
	--bg-color: #faf9f1;
	--bg-inverse-color: #333;
	--layout-content-space: 20px;
}

"""
            text = text.replace('@import url(slide.css);\n', '@import url(slide.css);\n' + root, 1)
        head, sep, rest = text.partition("/*全端末（PC・タブレット・スマホ）共通設定")
        if not sep:
            head, sep, rest = text.partition("/*全体の設定")
        rest = rest.replace("#f56270", "var(--primary-color)")
        rest = rest.replace("var(var(--primary-color))", "var(--primary-color)")
        text = head + sep + rest
        text = re.sub(
            r"(--primary-color:\s*)var\(--primary-color\)",
            r"\1#f56270",
            text,
            count=1,
        )
    css_path.write_text(text, encoding="utf-8")


def patch_layout_grids() -> None:
    replacements = [
        (
            ROOT / "tp_clinic7_blue/css/style.css",
            "grid-template-columns: repeat(3, minmax(0, 1fr));\t/*3列*/",
            "grid-template-columns: repeat(var(--layout-staff-columns, 3), minmax(0, 1fr));\t/*カラム数は --layout-staff-columns */",
            1,  # only first = list-staff; facility may share - careful
        ),
    ]
    # clinic7_blue list-staff specifically
    for path, old, new, count in [
        (
            ROOT / "tp_clinic7_blue/css/style.css",
            """.list-staff {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));	/*3列*/
""",
            """.list-staff {
	display: grid;
	grid-template-columns: repeat(var(--layout-staff-columns, 3), minmax(0, 1fr));	/*カラム数は --layout-staff-columns */
""",
            1,
        ),
        (
            ROOT / "tp_clinic7_blue_LP/css/style.css",
            """.list-staff {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));	/*3列*/
""",
            """.list-staff {
	display: grid;
	grid-template-columns: repeat(var(--layout-staff-columns, 3), minmax(0, 1fr));	/*カラム数は --layout-staff-columns */
""",
            1,
        ),
        (
            ROOT / "tp_clinic7_blue/css/style.css",
            """.list-cource {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));	/*ボックス１個あたりの最低幅が260pxで自動改行*/
""",
            """.list-cource {
	display: grid;
	grid-template-columns: repeat(var(--layout-service-columns, 3), minmax(0, 1fr));	/*カラム数は --layout-service-columns */
""",
            1,
        ),
        (
            ROOT / "tp_clinic7_blue_LP/css/style.css",
            """.list-cource {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));	/*ボックス１個あたりの最低幅が260pxで自動改行*/
""",
            """.list-cource {
	display: grid;
	grid-template-columns: repeat(var(--layout-service-columns, 3), minmax(0, 1fr));	/*カラム数は --layout-service-columns */
""",
            1,
        ),
        (
            ROOT / "tp_clinic6_skyblue/css/style.css",
            "\t\tgrid-template-columns: repeat(3, 1fr);\t/*3列にする指定。4列にしたければrepeat(4, 1fr)とする。*/\n",
            "\t\tgrid-template-columns: repeat(var(--layout-service-columns, 3), 1fr);\t/*カラム数は --layout-service-columns */\n",
            1,
        ),
        (
            ROOT / "tp_beginner10_clinic/css/style.css",
            "    grid-template-columns: repeat(3, 1fr);\t/*3列にする指定。4列にしたければrepeat(4, 1fr)とする。*/\n",
            "    grid-template-columns: repeat(var(--layout-service-columns, 3), 1fr);\t/*カラム数は --layout-service-columns */\n",
            1,
        ),
        (
            ROOT / "tp_lp3_clinic_slide/css/style.css",
            "\t\tgrid-template-columns: repeat(3, 1fr);\t/*3列にする指定。4列にしたければrepeat(4, 1fr)とする。*/\n",
            "\t\tgrid-template-columns: repeat(var(--layout-service-columns, 3), 1fr);\t/*カラム数は --layout-service-columns */\n",
            1,
        ),
        (
            ROOT / "tp_mix2_home/css/style.css",
            "\tgrid-template-columns: repeat(3, minmax(0, 1fr));\t/*3列*/\n",
            "\tgrid-template-columns: repeat(var(--layout-service-columns, 3), minmax(0, 1fr));\t/*カラム数は --layout-service-columns */\n",
            1,
        ),
    ]:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        if old not in text:
            if new.strip()[:40] in text or "layout-staff-columns" in text and "list-staff" in old:
                continue
            print(f"  WARN grid patch miss: {path.name} / {old[:60]!r}")
            continue
        path.write_text(text.replace(old, new, count), encoding="utf-8")


def patch_html(tid: str, doc: dict, cfg: dict) -> None:
    path = ROOT / tid / "index.html"
    html = path.read_text(encoding="utf-8")
    if tid == "tp_clinic7_blue":
        html = ensure_news_id_clinic7(html)
    if cfg.get("lp_section_map"):
        html = patch_lp_sections(html)
    html = ensure_head_links(html)
    style = layout_style(doc["layout"])
    html = set_html_attrs(html, doc["colorScheme"]["active"], style)
    html = patch_section_attrs(html, doc["sections"])
    path.write_text(html, encoding="utf-8")


def main() -> None:
    for tid, cfg in TEMPLATES.items():
        print(f"== {tid}")
        doc = write_variables_json(tid, cfg)
        write_site_controls(tid, doc)
        write_custom_css(tid)
        if tid in ("tp_clinic4_pink", "tp_clinic5_pink"):
            patch_legacy_colors(tid)
        patch_html(tid, doc, cfg)
    patch_layout_grids()
    # also patch change.css for clinic4 if it has #ff9999
    change = ROOT / "tp_clinic4_pink/css/change.css"
    if change.exists():
        t = change.read_text(encoding="utf-8")
        t2 = t.replace("#ff9999", "var(--primary-color)")
        t2 = t2.replace("var(var(--primary-color))", "var(--primary-color)")
        if t2 != t:
            change.write_text(t2, encoding="utf-8")
            print("patched change.css")
    print("done")


if __name__ == "__main__":
    main()
