import struct, zlib, os

def create_png(w, h, r, g, b):
    raw = b""
    for _ in range(h):
        raw += b"\x00" + bytes([r, g, b, 255]) * w
    def cht(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + cht(b"IHDR", ihdr) + cht(b"IDAT", zlib.compress(raw)) + cht(b"IEND", b"")

base = r"D:\Zestok\Mobile\android\app\src\main\res"
sizes = {"mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96, "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192}

for d, s in sizes.items():
    dp = os.path.join(base, d)
    os.makedirs(dp, exist_ok=True)
    for n in ["ic_launcher.png", "ic_launcher_round.png"]:
        with open(os.path.join(dp, n), "wb") as f:
            f.write(create_png(s, s, 33, 150, 243))
    with open(os.path.join(dp, "ic_launcher_foreground.png"), "wb") as f:
        f.write(create_png(s, s, 255, 255, 255))
    print(f"Done {d}")
print("All icons generated")
