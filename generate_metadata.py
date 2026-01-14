import re
import os

def extract_metadata(source_file, output_file):
    with open(source_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract UserScript metadata block
    match = re.search(r'(// ==UserScript==[\s\S]*?// ==/UserScript==)', content)
    if match:
        metadata = match.group(1)
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(metadata)
        print(f"Metadata extracted to {output_file}")
    else:
        print("No metadata block found!")
        exit(1)

if __name__ == "__main__":
    source = 'bilibili_subtitle_downloader.user.js'
    output = 'bilibili_subtitle_downloader.meta.js'
    
    if os.path.exists(source):
        extract_metadata(source, output)
    else:
        print(f"Source file {source} not found!")
        exit(1)
