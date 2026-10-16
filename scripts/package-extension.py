"""Build a self-contained Chromium new-tab extension, using only Python stdlib."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent


def build(output):
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'extension/manifest.json').read_text())
    with tempfile.TemporaryDirectory(prefix='.qidian-build-', dir=output) as temporary:
        staging = Path(temporary) / 'qidian-newtab'
        staging.mkdir()
        for name in ('index.html', 'README.md', 'app.js', 'config.js', 'theme.js', 'styles.css', 'liquid-glass.css', 'LICENSE', 'THIRD_PARTY_NOTICES.md'):
            shutil.copy2(ROOT / name, staging / name)
        for name in ('icons', 'LICENSES'):
            shutil.copytree(ROOT / name, staging / name)
        # Ship the corresponding build sources alongside the readable runtime files.
        shutil.copytree(ROOT / 'extension', staging / 'extension')
        (staging / 'scripts').mkdir()
        shutil.copy2(ROOT / 'scripts/package-extension.py', staging / 'scripts/package-extension.py')
        shutil.copytree(ROOT / 'extension/icons', staging / 'extension-icons')
        shutil.copy2(ROOT / 'extension/boot.js', staging / 'extension-boot.js')
        shutil.copy2(ROOT / 'extension/README.md', staging / '安装说明.md')
        (staging / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        html = (ROOT / 'index.html').read_text()
        if '<script>' in html or 'src="theme.js"' not in html:
            raise ValueError('The extension must use external scripts compatible with Manifest V3 CSP.')
        html = html.replace('  <link rel="icon"', '  <script src="extension-boot.js"></script>\n  <link rel="icon"', 1)
        html = html.replace('class="brand" href="./"', 'class="brand" href="newtab.html"', 1)
        (staging / 'newtab.html').write_text(html)
        if not (staging / manifest['chrome_url_overrides']['newtab']).is_file():
            raise ValueError('Missing new-tab entry point.')

        # Keep builds repeatable; archive names are relative to the extension root.
        archive = output / f'qidian-newtab-{manifest["version"]}.zip'
        with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as bundle:
            for file in sorted(staging.rglob('*')):
                if file.is_file():
                    info = ZipInfo(file.relative_to(staging).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
                    info.compress_type = ZIP_DEFLATED
                    info.external_attr = 0o100644 << 16
                    bundle.writestr(info, file.read_bytes())
        target = output / 'qidian-newtab'
        if target.exists():
            shutil.rmtree(target)
        shutil.move(staging, target)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        (output / 'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n')
        print(f'Extension folder: {target}\nZIP: {archive}\nSHA256: {digest}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    build(parser.parse_args().output.resolve())
