"""Builds the printable worksheet PDF from ledger-spec.json (the single source of truth)."""
import json, re, sys
from reportlab import rl_config
rl_config.invariant = 1  # reproducible output: no timestamps or random IDs, so CI can diff it
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, HRFlowable, KeepTogether)

SPEC_PATH = sys.argv[1] if len(sys.argv) > 1 else "spec/ledger-spec.json"
OUT_PATH = sys.argv[2] if len(sys.argv) > 2 else "public/worksheet/spouse-ledger-worksheet.pdf"
import hashlib
SPEC_BYTES = open(SPEC_PATH, "rb").read()
spec = json.loads(SPEC_BYTES)
# check:spec reads this back from the PDF to prove the committed worksheet matches the spec.
SPEC_STAMP = "ledger-spec sha256:" + hashlib.sha256(SPEC_BYTES).hexdigest()
meta, DIS = spec["meta"], spec["disclaimers"]
PARTS = {p["id"]: p for p in spec["parts"]}

styles = getSampleStyleSheet()
navy, gray, line_gray = colors.HexColor("#1f2d3d"), colors.HexColor("#5a6472"), colors.HexColor("#c7ccd1")
PW = 6.7 * inch

P = lambda name, **kw: ParagraphStyle(name, parent=kw.pop("parent", styles["Normal"]), **kw)
title_style = P("T", parent=styles["Title"], fontSize=32, leading=40, textColor=navy, spaceAfter=14, alignment=TA_CENTER)
subtitle_style = P("ST", fontSize=13, leading=18, textColor=gray, alignment=TA_CENTER, spaceAfter=4)
section_title = P("SecT", parent=styles["Heading1"], fontSize=18, leading=22, textColor=navy, spaceBefore=0, spaceAfter=4)
section_sub = P("SecS", fontSize=10, leading=13, textColor=gray, spaceAfter=12, fontName="Helvetica-Oblique")
field_label = P("FL", fontSize=10.5, textColor=navy, spaceBefore=10, spaceAfter=2, fontName="Helvetica-Bold", keepWithNext=1)
helper_text = P("HT", fontSize=8.5, leading=11, textColor=gray, spaceAfter=2, fontName="Helvetica-Oblique", keepWithNext=1)
disc_style = P("D", fontSize=8.5, textColor=gray, spaceAfter=10, fontName="Helvetica-Oblique", leading=12)
body = P("B", fontSize=10, leading=14)
tag_style = P("Tag", fontSize=10, textColor=gray, fontName="Helvetica-Bold", spaceAfter=2)
cell_hdr = P("CH", fontSize=8, leading=10, textColor=colors.white, fontName="Helvetica-Bold")
cell_txt = P("CT", fontSize=8.5, leading=10, textColor=navy)
check_style = P("CK", fontSize=10, leading=14, leftIndent=22, firstLineIndent=-22, spaceAfter=4)


def mk(text):
    """Escape, then allow **bold** and newlines."""
    t = escape(text or "")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    return t.replace("\n", "<br/>")


def blank_line():
    t = Table([[""]], colWidths=[PW], rowHeights=[17])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.7, line_gray)]))
    return t


def field(label, helper=None, lines=1):
    out = [Paragraph(mk(label), field_label)]
    if helper: out.append(Paragraph(mk(helper), helper_text))
    for _ in range(lines):
        out += [Spacer(1, 3), blank_line()]
    return out


def header(tag, title, subtitle):
    out = [Paragraph(mk(tag), tag_style), Paragraph(mk(title), section_title)]
    if subtitle: out.append(Paragraph(mk(subtitle), section_sub))
    out.append(HRFlowable(width="100%", thickness=1.2, color=navy, spaceAfter=8))
    return out


def grid(headers, widths, rows, row_h=22, labels=None):
    data = [[Paragraph(mk(h), cell_hdr) for h in headers]]
    for i in range(rows):
        row = [""] * len(headers)
        if labels and i < len(labels) and labels[i]:
            row[0] = Paragraph(mk(labels[i]), cell_txt)
        data.append(row)
    sc = PW / sum(widths)
    t = Table(data, colWidths=[w * sc for w in widths], rowHeights=[20] + [row_h] * rows, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), navy), ("GRID", (0, 0), (-1, -1), 0.5, line_gray),
                           ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f9fa")])]))
    return [Spacer(1, 4), t, Spacer(1, 6)]


def contact_card(role):
    t = Table([["Name / Firm:", "", "Phone:", ""], ["Email:", "", "Notes:", ""]],
              colWidths=[0.85 * inch, 2.5 * inch, 0.65 * inch, 2.7 * inch])
    t.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 9), ("TEXTCOLOR", (0, 0), (-1, -1), navy),
                           ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                           ("LINEBELOW", (1, 0), (1, -1), 0.6, line_gray), ("LINEBELOW", (3, 0), (3, -1), 0.6, line_gray),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return KeepTogether([Paragraph(mk(role), P("Role", fontSize=9.5, textColor=navy, fontName="Helvetica-Bold", spaceBefore=7, spaceAfter=1)), t])


def checklist(items):
    return [Paragraph("[&nbsp;&nbsp;&nbsp;]&nbsp;&nbsp;" + mk(i["text"]), check_style) for i in items]


def render_block(b):
    t = b["type"]
    if t == "pagebreak": return [PageBreak()]
    if t == "text": return field(b["label"], b.get("helper"), b.get("lines", 1))
    if t == "heading": return [Paragraph(mk(b["text"]), field_label)]
    if t == "info": return [Paragraph(mk(b["text"]), body), Spacer(1, 4)]
    if t == "disclaimer": return [Paragraph(mk(DIS[b["ref"]]), disc_style)]
    if t == "checklist": return [Paragraph("<b>%s</b>" % mk(b["label"]), field_label), Spacer(1, 2)] + checklist(b["items"])
    if t == "table":
        out = [Paragraph(mk(b["label"]), field_label)]
        if b.get("helper"): out.append(Paragraph(mk(b["helper"]), helper_text))
        return out + grid([c["label"] for c in b["columns"]], [c["w"] for c in b["columns"]], b["rows"], b.get("rowHeight", 22), b.get("rowLabels"))
    if t == "contacts":
        return [Paragraph("<b>%s</b>" % mk(b["label"]), field_label)] + [contact_card(r["label"]) for r in b["roles"]]
    if t == "subsection": return header(b["tag"], b["title"], b.get("subtitle"))
    raise ValueError("unknown block type: " + t)


story = []
# cover
story += [Spacer(1, 1.4 * inch), Paragraph(meta["title"], title_style), Paragraph(mk(meta["subtitle"]), subtitle_style),
          Paragraph(mk(meta["subtitle2"]), subtitle_style), Spacer(1, 0.5 * inch),
          HRFlowable(width="60%", thickness=1, color=line_gray, hAlign="CENTER"), Spacer(1, 0.4 * inch),
          Paragraph(mk(meta["blurb"]), P("CN", parent=body, alignment=TA_CENTER, textColor=gray, fontSize=10.5, leading=15)),
          Spacer(1, 0.8 * inch)]
for f in meta["coverFields"]: story += field(f["label"], f.get("helper"))
story += [Spacer(1, 0.5 * inch), Paragraph(mk(DIS["short"]), P("CD", parent=disc_style, alignment=TA_CENTER))]
story.append(PageBreak())

secs = spec["sections"]
start = [s for s in secs if s["number"] == 0][0]
rest = [s for s in secs if s["number"] != 0]


def render_section(s):
    out = header(f'{PARTS[s["part"]]["tag"]}  •  SECTION {s["number"]}', s["title"], s.get("subtitle"))
    for b in s["blocks"]: out += render_block(b)
    return out


story += render_section(start)
story.append(PageBreak())

# tracker (generated from sections, so it can never drift)
story += [Paragraph("Completion Tracker", section_title), Paragraph("Date each section when it's filled in. Re-date when you review it.", section_sub)]
labels = [f'{s["number"]}. {s["shortTitle"]}' for s in rest] + meta["trackerExtras"]
story += grid(["Section", "Completed", "Last reviewed", "Next review"], [3.2, 1.2, 1.2, 1.2], len(labels), 24, labels)
story.append(PageBreak())

for s in rest:
    story += render_section(s)
    story.append(PageBreak())

rl = meta["reviewLog"]
story += [Paragraph(rl["title"], section_title), Paragraph(mk(rl["subtitle"]), section_sub)]
story += grid(rl["columns"], [1.4, 3.8, 1.4], rl["rows"], 28)


def footer(c, d):
    c.saveState(); c.setFont("Helvetica", 8); c.setFillColor(gray)
    c.drawString(0.9 * inch, 0.5 * inch, meta["footer"] + "  •  v" + spec["specVersion"])
    c.drawRightString(letter[0] - 0.9 * inch, 0.5 * inch, f"Page {d.page}")
    c.restoreState()


# drop a trailing PageBreak if the last section left one dangling before the review log
SimpleDocTemplate(OUT_PATH, pagesize=letter, topMargin=0.7 * inch, bottomMargin=0.8 * inch, leftMargin=0.9 * inch,
                  rightMargin=0.9 * inch, title="Spouse Ledger Worksheet v" + spec["specVersion"], subject=SPEC_STAMP).build(story, onFirstPage=footer, onLaterPages=footer)
print("built", OUT_PATH)
