from pathlib import Path
import subprocess
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter
except Exception:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "Pillow"])
    from PIL import Image, ImageDraw, ImageFilter

OUT = Path("/Users/waelio/Code/Welcom/Welcom/Assets.xcassets/AppIcon.appiconset")
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 1024


def gradient(top, bottom):
    img = Image.new("RGBA", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        t = y / (SIZE - 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        for x in range(SIZE):
            px[x, y] = (r, g, b, 255)
    return img


def draw_icon(top, bottom, ring, bubble, filename):
    img = gradient(top, bottom)
    d = ImageDraw.Draw(img)

    highlight = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.ellipse((140, 110, 870, 830), fill=(255, 255, 255, 44))
    highlight = highlight.filter(ImageFilter.GaussianBlur(34))
    img.alpha_composite(highlight)

    cx = cy = SIZE // 2
    r_outer = 330
    r_inner = 220

    d.ellipse((cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer), fill=ring)
    d.ellipse((cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner), fill=(0, 0, 0, 0))

    # left bubble
    lx, ly, bw, bh = 210, 350, 240, 170
    d.rounded_rectangle((lx, ly, lx + bw, ly + bh), radius=54, fill=bubble)
    d.polygon([(lx + 40, ly + bh - 8), (lx + 80, ly + bh - 8), (lx + 52, ly + bh + 38)], fill=bubble)

    # right bubble
    rx, ry = 574, 510
    d.rounded_rectangle((rx, ry, rx + bw, ry + bh), radius=54, fill=bubble)
    d.polygon([(rx + bw - 40, ry + bh - 8), (rx + bw - 80, ry + bh - 8), (rx + bw - 52, ry + bh + 38)], fill=bubble)

    img.save(OUT / filename, "PNG")


def write_contents_json():
    text = """{
  \"images\" : [
    {
      \"filename\" : \"AppIcon-Light-1024.png\",
      \"idiom\" : \"universal\",
      \"platform\" : \"ios\",
      \"size\" : \"1024x1024\"
    },
    {
      \"appearances\" : [
        {
          \"appearance\" : \"luminosity\",
          \"value\" : \"dark\"
        }
      ],
      \"filename\" : \"AppIcon-Dark-1024.png\",
      \"idiom\" : \"universal\",
      \"platform\" : \"ios\",
      \"size\" : \"1024x1024\"
    },
    {
      \"appearances\" : [
        {
          \"appearance\" : \"luminosity\",
          \"value\" : \"tinted\"
        }
      ],
      \"filename\" : \"AppIcon-Tinted-1024.png\",
      \"idiom\" : \"universal\",
      \"platform\" : \"ios\",
      \"size\" : \"1024x1024\"
    }
  ],
  \"info\" : {
    \"author\" : \"xcode\",
    \"version\" : 1
  }
}
"""
    (OUT / "Contents.json").write_text(text)


def main():
    draw_icon((56, 96, 255), (132, 86, 255), (255, 255, 255, 232), (255, 255, 255, 236), "AppIcon-Light-1024.png")
    draw_icon((18, 24, 44), (44, 28, 74), (132, 165, 255, 236), (208, 223, 255, 246), "AppIcon-Dark-1024.png")
    draw_icon((10, 90, 130), (38, 170, 150), (236, 255, 250, 242), (236, 255, 250, 246), "AppIcon-Tinted-1024.png")
    write_contents_json()
    print("Generated icons in", OUT)


if __name__ == "__main__":
    main()
