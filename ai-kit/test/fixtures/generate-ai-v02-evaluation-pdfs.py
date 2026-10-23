"""Build deterministic, text-native synthetic CVs for the AI-V02 review.

Uses only Python's standard library and PDF base fonts. Run from any directory:
python3 ai-kit/test/fixtures/generate-ai-v02-evaluation-pdfs.py
"""

from pathlib import Path


OUT = Path(__file__).resolve().parent
PAGE_WIDTH, PAGE_HEIGHT = 612, 792


def pdf_text(value):
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def text(commands, x, y, value, size=10, bold=False, color="0.14 0.20 0.28"):
    font = "F2" if bold else "F1"
    commands.append(
        f"BT /{font} {size} Tf {color} rg 1 0 0 1 {x} {y} Tm ({pdf_text(value)}) Tj ET"
    )


def line(commands, x1, y1, x2, y2, color="0.76 0.81 0.86"):
    commands.append(f"{color} RG 0.7 w {x1} {y1} m {x2} {y2} l S")


def write_pdf(filename, commands):
    stream = ("\n".join(commands) + "\n").encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
         "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>").encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"endstream",
    ]
    output = bytearray(b"%PDF-1.4\n%Synthetic evaluation fixture\n")
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n".encode()
    )
    (OUT / filename).write_bytes(output)


def standard_cv():
    c = []
    text(c, 40, 755, "SYNTHETIC EVALUATION FIXTURE - All people and organizations are fictional", 8,
         color="0.35 0.40 0.46")
    text(c, 40, 721, "Mira Vale", 21, bold=True)
    text(c, 40, 702, "Software Developer", 11)
    line(c, 40, 686, 572, 686)

    def heading(y, label):
        text(c, 40, y, label, 10, bold=True, color="0.12 0.32 0.51")
        line(c, 40, y - 5, 572, y - 5)

    heading(664, "PROFESSIONAL SUMMARY")
    text(c, 40, 644, "Builds web applications and internal tools with attention to reliability and usability.")

    heading(615, "TECHNICAL SKILLS")
    text(c, 40, 595, "Languages: TypeScript, JavaScript, SQL")
    text(c, 40, 580, "Frameworks: React, Next.js, Node.js, Express")
    text(c, 40, 565, "Data and testing: PostgreSQL, Redis, Jest")

    heading(536, "WORK EXPERIENCE")
    text(c, 40, 516, "Northstar Systems (fictional) | Software Developer | Jan 2022 - Mar 2025", bold=True)
    text(c, 50, 499, "Built a React/TypeScript onboarding UI for the internal operations team.")
    text(c, 50, 484, "In an internal test of 40 users, median completion time fell from 12 to 8 minutes.")
    text(c, 50, 469, "Implemented a Node.js/PostgreSQL API used by 6 internal teams.")
    text(c, 40, 445, "Cedarline Lab (fictional) | Junior Software Developer | Jul 2020 - Dec 2021", bold=True)
    text(c, 50, 428, "Maintained an Express API and added Jest tests for account workflows.")

    heading(397, "PROJECTS")
    text(c, 40, 377, "Queueboard | Personal project | Apr - Jun 2024", bold=True)
    text(c, 50, 360, "Built a task board with Next.js and Redis; load tested at 500 concurrent sessions.")
    text(c, 40, 336, "Release Notes Helper | Team project | 2021", bold=True)
    text(c, 50, 319, "Created a TypeScript script that grouped pull request titles for weekly review.")

    heading(288, "EDUCATION")
    text(c, 40, 268, "BSc Computer Science | Fictional Polytechnic | 2016 - 2020")

    heading(237, "LANGUAGES")
    text(c, 40, 217, "English - professional working proficiency (self-reported)")
    write_pdf("ai-v02-standard-developer-synthetic.pdf", c)


def sparse_cv():
    c = []
    text(c, 40, 755, "SYNTHETIC EVALUATION FIXTURE - All people and organizations are fictional", 8,
         color="0.35 0.40 0.46")
    text(c, 40, 721, "Avery Solis", 21, bold=True)
    text(c, 40, 702, "Operations-focused product technologist", 11)
    line(c, 40, 687, 572, 687)
    line(c, 212, 668, 212, 212)
    left = [
        ("TOOLS", True),
        ("Python; SQL; Figma", False),
        ("", False),
        ("LANGUAGES", True),
        ("French - conversational", False),
        ("", False),
        ("SHORT COURSE", True),
        ("Harbor Studio (fictional)", False),
        ("Service Design, 2022", False),
        ("", False),
        ("PROFILE NOTE", True),
        ("Open to product operations", False),
        ("or technical support work.", False),
        ("", False),
        ("EARLIER NOTE", True),
        ("2019-2020: service", False),
        ("design practice.", False),
        ("Organization not stated.", False),
    ]
    right = [
        ("RECENT WORK", True),
        ("Willowline Tools (fictional)", True),
        ("Product Technologist | 2022-2024", False),
        ("Helped a support team pilot a queue", False),
        ("handoff checklist. A team note reports", False),
        ("median handoff time moved from 2 days", False),
        ("to 1 day during the pilot. Individual", False),
        ("contribution to that change is not stated.", False),
        ("", False),
        ("SELECTED PROJECT", True),
        ("Shift Notes | 2021", True),
        ("Prototype for shift updates using", False),
        ("Python and SQLite. Described as a team", False),
        ("effort; individual role not stated.", False),
        ("", False),
        ("PORTFOLIO CAPTION", True),
        ("Willowline Tools, Product Technologist", False),
        ("2023-present (conflicts with work dates).", False),
    ]
    for row, (l, r) in enumerate(zip(left, right)):
        y = 650 - row * 23
        if l[0]:
            text(c, 40, y, l[0], 9 if l[1] else 9.3, bold=l[1],
                 color="0.12 0.32 0.51" if l[1] else "0.14 0.20 0.28")
        if r[0]:
            text(c, 231, y, r[0], 9 if r[1] else 9.3, bold=r[1],
                 color="0.12 0.32 0.51" if r[1] else "0.14 0.20 0.28")
    write_pdf("ai-v02-sparse-two-column-synthetic.pdf", c)


if __name__ == "__main__":
    standard_cv()
    sparse_cv()
