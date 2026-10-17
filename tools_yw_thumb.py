"""把义教课标 PDF 的指定页范围渲染成缩略图网格，用于肉眼定位词汇表所在页。"""
import sys
import pymupdf

PDF = 'data/src/义务教育英语课程标准（2022年版）.pdf'
START = int(sys.argv[1]) if len(sys.argv) > 1 else 140
END = int(sys.argv[2]) if len(sys.argv) > 2 else 201
COLS = 6
W = 300          # 每格宽（像素）
OUT = sys.argv[3] if len(sys.argv) > 3 else 'data/_thumb.png'

doc = pymupdf.open(PDF)
pages = list(range(START, min(END, doc.page_count)))
rows = (len(pages) + COLS - 1) // COLS

shots = []
for pno in pages:
    pix = doc[pno].get_pixmap(dpi=72)
    img = pymupdf.Pixmap(pix)
    shots.append((pno, img))

# 用 PyMuPDF 自带能力拼图：先各自转 PNG 再由 PyMuPDF 合成
import io
tiles = []
for pno, img in shots:
    png = img.tobytes('png')
    t = pymupdf.Pixmap(png)
    scale = W / t.width
    t = pymupdf.Pixmap(t, 0) if scale == 1 else None
    tiles.append((pno, png, img.width, img.height))

# 改用 Pillow（PyMuPDF 无直接缩放合成 API）
try:
    from PIL import Image
except ImportError:
    raise SystemExit('需要 Pillow：pip install pillow')

cell_w = W
cell_h = int(W * 1.414) + 22
sheet = Image.new('RGB', (cell_w * COLS, cell_h * rows), 'white')
from PIL import ImageDraw
dr = ImageDraw.Draw(sheet)
for idx, (pno, png, ow, oh) in enumerate(tiles):
    im = Image.open(io.BytesIO(png)).convert('RGB')
    im.thumbnail((cell_w - 8, cell_h - 26))
    r, c = divmod(idx, COLS)
    x = c * cell_w + 4
    y = r * cell_h + 20
    sheet.paste(im, (x, y))
    dr.text((x, r * cell_h + 4), 'p%d' % pno, fill='red')
sheet.save(OUT)
print('written', OUT, sheet.size, 'pages', pages[0], '-', pages[-1])
